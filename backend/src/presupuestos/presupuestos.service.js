import { ErrorDeNegocio } from '../errores.js';
import { validarMontoCentavos } from '../utils/dinero.js';
import { convertirId } from '../utils/id.js';
import * as repositorioCategorias from '../categorias/categorias.repository.js';
import * as repositorio from './presupuestos.repository.js';

// Service: reglas de negocio de presupuestos (RN-02, RN-09, RN-15).

const MENSAJE_GENERAL = 'Revisá los datos ingresados.';

function errorNoEncontrado(mensaje) {
  return new ErrorDeNegocio(404, 'NO_ENCONTRADO', mensaje);
}

// RN-02 / RN-15: el límite tiene el mismo rango que un monto. La utilidad de dinero lanza un error;
// acá se convierte en { valor } o { error } para juntarlo con los demás en una sola respuesta.
function revisarLimite(limiteCentavos) {
  try {
    return { valor: validarMontoCentavos(limiteCentavos, 'limiteCentavos') };
  } catch (err) {
    if (err instanceof ErrorDeNegocio && err.campos.limiteCentavos) {
      return { error: err.campos.limiteCentavos };
    }
    throw err;
  }
}

export function crearServicioPresupuestos(db, { reloj = () => new Date() } = {}) {
  // Lee la categoría y luego escribe: va en una transacción para que nada cambie entre medio (plan §6).
  const definirLimite = db.transaction((categoriaId, cuerpo) => {
    const categoria = repositorioCategorias.buscarPorId(db, categoriaId);
    if (!categoria) throw errorNoEncontrado('La categoría no existe.');

    const campos = {};

    // RN-15: solo las categorías de gasto y activas tienen presupuesto (RN-09).
    if (categoria.tipo !== 'GASTO') {
      campos.categoriaId = 'Solo las categorías de gasto pueden tener presupuesto.';
    } else if (!categoria.activa) {
      campos.categoriaId = 'La categoría está desactivada. Activala para definirle un límite.';
    }

    const resultadoLimite = revisarLimite((cuerpo ?? {}).limiteCentavos);
    if (resultadoLimite.error) campos.limiteCentavos = resultadoLimite.error;

    if (Object.keys(campos).length > 0) {
      throw new ErrorDeNegocio(400, 'VALIDACION', MENSAJE_GENERAL, campos);
    }

    return repositorio.guardar(db, {
      categoriaId: categoria.id,
      limiteCentavos: resultadoLimite.valor,
      actualizadoEn: reloj().toISOString(), // UTC, solo informativa
    });
  });

  return {
    // Orden de los chequeos: id inválido (404), categoría inexistente (404), datos inválidos (400).
    // Definir un límite sobre una categoría que ya tiene uno lo reemplaza (RN-15).
    definirLimite(categoriaIdTexto, cuerpo) {
      const categoriaId = convertirId(categoriaIdTexto);
      if (categoriaId === null) throw errorNoEncontrado('La categoría no existe.');
      return definirLimite(categoriaId, cuerpo);
    },

    // Es una sola sentencia: si no borró nada, esa categoría no tenía límite (o no existe).
    quitarLimite(categoriaIdTexto) {
      const categoriaId = convertirId(categoriaIdTexto);
      if (categoriaId === null) throw errorNoEncontrado('La categoría no tiene un límite definido.');
      if (!repositorio.eliminar(db, categoriaId)) {
        throw errorNoEncontrado('La categoría no tiene un límite definido.');
      }
    },
  };
}