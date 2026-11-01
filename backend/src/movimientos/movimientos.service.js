import { ErrorDeNegocio } from '../errores.js';
import { validarMontoCentavos } from '../utils/dinero.js';
import { hoy, validarFechaMovimiento } from '../utils/fecha.js';
import { revisarTipo } from '../categorias/categorias.service.js';
import * as repositorioCategorias from '../categorias/categorias.repository.js';
import * as repositorio from './movimientos.repository.js';

// Service: reglas de negocio de movimientos (RN-01 a RN-05, RN-09).

export const LARGO_MAXIMO_DESCRIPCION = 140;

const MENSAJE_GENERAL = 'Revisá los datos ingresados.';

function errorDeValidacion(campos) {
  return new ErrorDeNegocio(400, 'VALIDACION', MENSAJE_GENERAL, campos);
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
// `tipo` es null si el tipo enviado ya resultó inválido (ese error se informa aparte).
function revisarCategoria(db, categoriaId, tipo) {
  if (typeof categoriaId !== 'number' || !Number.isSafeInteger(categoriaId)) {
    return { error: 'Elegí una categoría.' };
  }
  const categoria = repositorioCategorias.buscarPorId(db, categoriaId);
  if (!categoria) return { error: 'La categoría elegida no existe.' };
  if (tipo !== null && categoria.tipo !== tipo) {
    return { error: 'La categoría no corresponde al tipo del movimiento.' };
  }
  if (!categoria.activa) return { error: 'La categoría está desactivada. Elegí una activa.' };
  return { valor: categoria };
}

export function crearServicioMovimientos(db, { reloj = () => new Date(), zonaHoraria } = {}) {
  // Lee la categoría y luego inserta: va en una transacción para que nada cambie entre medio (plan §6).
  const crearMovimiento = db.transaction((cuerpo) => {
    const { tipo, montoCentavos, fecha, categoriaId, descripcion } = cuerpo ?? {};

    // El reloj se lee una sola vez: "hoy" y la fecha de carga salen del mismo instante.
    const ahora = reloj();
    const fechaHoy = hoy(() => ahora, zonaHoraria);

    const resultadoTipo = revisarTipo(tipo);
    const resultadoMonto = capturar(() => validarMontoCentavos(montoCentavos), 'montoCentavos');
    const resultadoFecha = capturar(() => validarFechaMovimiento(fecha, fechaHoy), 'fecha');
    const resultadoCategoria = revisarCategoria(db, categoriaId, resultadoTipo.error ? null : resultadoTipo.valor);
    const resultadoDescripcion = revisarDescripcion(descripcion);

    const campos = {};
    if (resultadoTipo.error) campos.tipo = resultadoTipo.error;
    if (resultadoMonto.error) campos.montoCentavos = resultadoMonto.error;
    if (resultadoFecha.error) campos.fecha = resultadoFecha.error;
    if (resultadoCategoria.error) campos.categoriaId = resultadoCategoria.error;
    if (resultadoDescripcion.error) campos.descripcion = resultadoDescripcion.error;
    if (Object.keys(campos).length > 0) throw errorDeValidacion(campos);

    return repositorio.crear(db, {
      montoCentavos: resultadoMonto.valor,
      fecha: resultadoFecha.valor,
      categoriaId: resultadoCategoria.valor.id,
      descripcion: resultadoDescripcion.valor,
      creadoEn: ahora.toISOString(), // UTC, solo informativa
    });
  });

  return {
    crear(cuerpo) {
      return crearMovimiento(cuerpo);
    },
  };
}