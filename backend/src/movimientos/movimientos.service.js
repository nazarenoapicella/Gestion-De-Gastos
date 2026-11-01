import { ErrorDeNegocio } from '../errores.js';
import { validarMontoCentavos } from '../utils/dinero.js';
import { hoy, validarFechaMovimiento } from '../utils/fecha.js';
import { convertirId } from '../utils/id.js';
import { revisarTipo } from '../categorias/categorias.service.js';
import * as repositorioCategorias from '../categorias/categorias.repository.js';
import * as repositorio from './movimientos.repository.js';

// Service: reglas de negocio de movimientos (RN-01 a RN-05, RN-09, RN-10).

export const LARGO_MAXIMO_DESCRIPCION = 140;

const MENSAJE_GENERAL = 'Revisá los datos ingresados.';

function errorDeValidacion(campos) {
  return new ErrorDeNegocio(400, 'VALIDACION', MENSAJE_GENERAL, campos);
}

function errorNoEncontrado() {
  return new ErrorDeNegocio(404, 'NO_ENCONTRADO', 'El movimiento no existe.');
}

// Las utilidades de dinero y fecha lanzan un ErrorDeNegocio. Acá se convierte en
// { valor } o { error } para juntar los errores de todos los campos en una sola respuesta.
function capturar(validar, campo) {
  try {
    return { valor: validar() };
  } catch (err) {
    if (err instanceof ErrorDeNegocio && err.campos[campo]) return { error: err.campos[campo] };
    throw err;
  }
}

// RN-05: opcional; se recortan los espacios de los extremos; vacía se guarda como null;
// máximo 140 caracteres (se cuentan caracteres, igual que el CHECK de la base).
function revisarDescripcion(descripcion) {
  if (descripcion === undefined || descripcion === null) return { valor: null };
  if (typeof descripcion !== 'string') return { error: 'La descripción debe ser un texto.' };

  const recortada = descripcion.trim();
  if (recortada === '') return { valor: null };
  if (Array.from(recortada).length > LARGO_MAXIMO_DESCRIPCION) {
    return { error: `La descripción no puede superar los ${LARGO_MAXIMO_DESCRIPCION} caracteres.` };
  }
  return { valor: recortada };
}

// RN-04: la categoría debe existir, ser del mismo tipo que el movimiento y estar activa.
// RN-09: al editar, la categoría que el movimiento ya tiene puede quedar aunque esté inactiva
// (`categoriaActualId`); para cambiarla hay que elegir una activa.
// `tipo` es null si el tipo enviado ya resultó inválido (ese error se informa aparte).
function revisarCategoria(db, categoriaId, tipo, categoriaActualId) {
  if (typeof categoriaId !== 'number' || !Number.isSafeInteger(categoriaId)) {
    return { error: 'Elegí una categoría.' };
  }
  const categoria = repositorioCategorias.buscarPorId(db, categoriaId);
  if (!categoria) return { error: 'La categoría elegida no existe.' };
  if (tipo !== null && categoria.tipo !== tipo) {
    return { error: 'La categoría no corresponde al tipo del movimiento.' };
  }
  if (!categoria.activa && categoria.id !== categoriaActualId) {
    return { error: 'La categoría está desactivada. Elegí una activa.' };
  }
  return { valor: categoria };
}

export function crearServicioMovimientos(db, { reloj = () => new Date(), zonaHoraria } = {}) {
  // Valida el cuerpo completo. El alta y la edición comparten estas reglas (RN-10).
  // Devuelve los valores ya limpios o lanza un 400 con todos los campos con error a la vez.
  // `ahora` es el instante en que se atiende el pedido; de ahí sale "hoy".
  function revisarCuerpo(cuerpo, ahora, categoriaActualId = null) {
    const { tipo, montoCentavos, fecha, categoriaId, descripcion } = cuerpo ?? {};
    const fechaHoy = hoy(() => ahora, zonaHoraria);

    const resultadoTipo = revisarTipo(tipo);
    const resultadoMonto = capturar(() => validarMontoCentavos(montoCentavos), 'montoCentavos');
    const resultadoFecha = capturar(() => validarFechaMovimiento(fecha, fechaHoy), 'fecha');
    const resultadoCategoria = revisarCategoria(
      db,
      categoriaId,
      resultadoTipo.error ? null : resultadoTipo.valor,
      categoriaActualId
    );
    const resultadoDescripcion = revisarDescripcion(descripcion);

    const campos = {};
    if (resultadoTipo.error) campos.tipo = resultadoTipo.error;
    if (resultadoMonto.error) campos.montoCentavos = resultadoMonto.error;
    if (resultadoFecha.error) campos.fecha = resultadoFecha.error;
    if (resultadoCategoria.error) campos.categoriaId = resultadoCategoria.error;
    if (resultadoDescripcion.error) campos.descripcion = resultadoDescripcion.error;
    if (Object.keys(campos).length > 0) throw errorDeValidacion(campos);

    return {
      montoCentavos: resultadoMonto.valor,
      fecha: resultadoFecha.valor,
      categoriaId: resultadoCategoria.valor.id,
      descripcion: resultadoDescripcion.valor,
    };
  }

  // Lee la categoría y luego inserta: va en una transacción para que nada cambie entre medio (plan §6).
  const crearMovimiento = db.transaction((cuerpo) => {
    // El reloj se lee una sola vez: "hoy" y la fecha de carga salen del mismo instante.
    const ahora = reloj();
    const valores = revisarCuerpo(cuerpo, ahora);
    return repositorio.crear(db, { ...valores, creadoEn: ahora.toISOString() }); // UTC, solo informativa
  });

  // Busca el movimiento, valida y actualiza en una transacción.
  const editarMovimiento = db.transaction((id, cuerpo) => {
    const actual = repositorio.buscarPorId(db, id);
    if (!actual) throw errorNoEncontrado();

    const valores = revisarCuerpo(cuerpo, reloj(), actual.categoriaId);
    return repositorio.actualizar(db, id, valores);
  });

  return {
    crear(cuerpo) {
      return crearMovimiento(cuerpo);
    },

    obtener(idTexto) {
      const id = convertirId(idTexto);
      if (id === null) throw errorNoEncontrado();

      const movimiento = repositorio.buscarPorId(db, id);
      if (!movimiento) throw errorNoEncontrado();
      return movimiento;
    },

    // Orden de los chequeos: id inválido (404), movimiento inexistente (404), cuerpo inválido (400).
    // Primero se busca el movimiento porque la regla de categoría inactiva depende de la que tiene hoy.
    editar(idTexto, cuerpo) {
      const id = convertirId(idTexto);
      if (id === null) throw errorNoEncontrado();
      return editarMovimiento(id, cuerpo);
    },

    
    // Borrado definitivo (RN-10; la confirmación previa la pide la interfaz).
    // Es una sola sentencia, así que no hace falta transacción: si no borró nada, no existía.
    eliminar(idTexto) {
      const id = convertirId(idTexto);
      if (id === null) throw errorNoEncontrado();
      if (!repositorio.eliminar(db, id)) throw errorNoEncontrado();
    },
  };
}