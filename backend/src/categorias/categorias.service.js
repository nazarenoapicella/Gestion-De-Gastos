import { ErrorDeNegocio } from '../errores.js';
import { limpiarNombre, normalizarNombre } from '../utils/texto.js';
import * as repositorio from './categorias.repository.js';

// Service: reglas de negocio de categorías (RN-01, RN-06).

export const TIPOS = ['INGRESO', 'GASTO'];
export const LARGO_MAXIMO_NOMBRE = 30;

const MENSAJE_GENERAL = 'Revisá los datos ingresados.';

function errorDeValidacion(campos) {
  return new ErrorDeNegocio(400, 'VALIDACION', MENSAJE_GENERAL, campos);
}

// RN-06: entre 1 y 30 caracteres, sin espacios sobrantes. Devuelve { valor } o { error }.
export function revisarNombre(nombre) {
  if (typeof nombre !== 'string') return { error: 'El nombre es obligatorio.' };
  const limpio = limpiarNombre(nombre);
  if (limpio.length === 0) return { error: 'El nombre es obligatorio.' };
  if (limpio.length > LARGO_MAXIMO_NOMBRE) {
    return { error: `El nombre no puede superar los ${LARGO_MAXIMO_NOMBRE} caracteres.` };
  }
  return { valor: limpio };
}

// RN-01: el tipo es INGRESO o GASTO.
export function revisarTipo(tipo) {
  if (!TIPOS.includes(tipo)) return { error: 'El tipo debe ser INGRESO o GASTO.' };
  return { valor: tipo };
}

// Los filtros llegan como texto de la URL. Devuelve los filtros ya convertidos.
function revisarFiltros({ tipo, activa } = {}) {
  const campos = {};
  const filtros = {};

  if (tipo !== undefined) {
    const r = revisarTipo(tipo);
    if (r.error) campos.tipo = r.error;
    else filtros.tipo = r.valor;
  }

  if (activa !== undefined) {
    if (activa === 'true') filtros.activa = true;
    else if (activa === 'false') filtros.activa = false;
    else campos.activa = 'El filtro activa debe ser true o false.';
  }

  if (Object.keys(campos).length > 0) throw errorDeValidacion(campos);
  return filtros;
}

export function crearServicioCategorias(db) {
  return {
    listar(consulta) {
      return repositorio.listar(db, revisarFiltros(consulta));
    },

    crear(cuerpo) {
      const { nombre, tipo } = cuerpo ?? {};
      const resultadoNombre = revisarNombre(nombre);
      const resultadoTipo = revisarTipo(tipo);

      const campos = {};
      if (resultadoNombre.error) campos.nombre = resultadoNombre.error;
      if (resultadoTipo.error) campos.tipo = resultadoTipo.error;
      if (Object.keys(campos).length > 0) throw errorDeValidacion(campos);

      // La unicidad la garantiza la base (UNIQUE): así no hay carrera entre
      // "preguntar si existe" y "crear" (plan §6).
      try {
        return repositorio.crear(db, {
          nombre: resultadoNombre.valor,
          nombreNormalizado: normalizarNombre(resultadoNombre.valor),
          tipo: resultadoTipo.valor,
        });
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          const mensaje = 'Ya existe una categoría con ese nombre.';
          throw new ErrorDeNegocio(409, 'NOMBRE_DUPLICADO', mensaje, { nombre: mensaje });
        }
        throw err;
      }
    },
  };
}