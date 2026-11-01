import { ErrorDeNegocio } from '../errores.js';
import { limpiarNombre, normalizarNombre } from '../utils/texto.js';
import * as repositorio from './categorias.repository.js';

// Service: reglas de negocio de categorías (RN-01, RN-06, RN-07, RN-09).

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

// Cuerpo del PATCH: nombre y/o activa. El tipo no se puede modificar (RN-06).
// Devuelve solo los cambios válidos; si hay algo mal, lanza 400 con todos los campos a la vez.
function revisarCambios(cuerpo) {
  const { nombre, activa, tipo } = cuerpo ?? {};
  const campos = {};
  const cambios = {};

  if (tipo !== undefined) {
    campos.tipo = 'El tipo de una categoría no se puede modificar.';
  }
  if (nombre !== undefined) {
    const r = revisarNombre(nombre);
    if (r.error) campos.nombre = r.error;
    else cambios.nombre = r.valor;
  }
  if (activa !== undefined) {
    if (typeof activa === 'boolean') cambios.activa = activa;
    else campos.activa = 'El valor de activa debe ser true o false.';
  }

  if (Object.keys(campos).length === 0 && Object.keys(cambios).length === 0) {
    campos.cuerpo = 'Indicá el nombre o si la categoría está activa.';
  }
  if (Object.keys(campos).length > 0) throw errorDeValidacion(campos);
  return cambios;
}

// Un id válido es un entero positivo escrito solo con dígitos; cualquier otra cosa no existe.
function convertirId(texto) {
  if (!/^\d+$/.test(texto)) return null;
  const id = Number(texto);
  return Number.isSafeInteger(id) ? id : null;
}

function errorNoEncontrada() {
  return new ErrorDeNegocio(404, 'NO_ENCONTRADO', 'La categoría no existe.');
}

// Si la base rechazó por UNIQUE, es un nombre repetido dentro del mismo tipo (RN-06).
function traducirErrorDeBase(err) {
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    const mensaje = 'Ya existe una categoría con ese nombre.';
    return new ErrorDeNegocio(409, 'NOMBRE_DUPLICADO', mensaje, { nombre: mensaje });
  }
  return err;
}

export function crearServicioCategorias(db) {
  // Lee y luego escribe: va en una transacción para que nada cambie entre medio (plan §6).
  const aplicarCambios = db.transaction((id, cambios) => {
    const categoria = repositorio.buscarPorId(db, id);
    if (!categoria) throw errorNoEncontrada();

    // RN-07: las protegidas no se renombran ni se desactivan.
    // Activar una protegida no cambia nada (siempre están activas), así que se permite.
    if (categoria.protegida && (cambios.nombre !== undefined || cambios.activa === false)) {
      throw new ErrorDeNegocio(
        409,
        'CATEGORIA_PROTEGIDA',
        'Esta categoría es protegida: no se puede renombrar ni desactivar.'
      );
    }

    return repositorio.actualizar(db, id, {
      nombre: cambios.nombre,
      nombreNormalizado: cambios.nombre !== undefined ? normalizarNombre(cambios.nombre) : undefined,
      activa: cambios.activa,
    });
  });

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
        throw traducirErrorDeBase(err);
      }
    },

    // Orden de los chequeos: cuerpo inválido (400), categoría inexistente (404),
    // categoría protegida (409), nombre repetido (409).
    modificar(idTexto, cuerpo) {
      const cambios = revisarCambios(cuerpo);
      const id = convertirId(idTexto);
      if (id === null) throw errorNoEncontrada();

      try {
        return aplicarCambios(id, cambios);
      } catch (err) {
        throw traducirErrorDeBase(err);
      }
    },
  };
}