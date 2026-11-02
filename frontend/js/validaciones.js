// Validación del formulario de movimientos. Espeja las reglas de la spec (RN-01 a RN-05) para avisar
// rápido y evitar pedidos que ya se sabe que van a fallar. El servidor sigue siendo quien decide.
// Son funciones puras: no usan el DOM.

import { parsearMonto } from './format.js';

export const FECHA_MINIMA = '2000-01-01'; // RN-03
export const MONTO_MINIMO_CENTAVOS = 1; // RN-02
export const MONTO_MAXIMO_CENTAVOS = 99999999999; // RN-02
export const LARGO_MAXIMO_DESCRIPCION = 140; // RN-05
export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires'; // D-06

const TIPOS = ['INGRESO', 'GASTO'];
const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

// "Hoy" según la zona horaria de Argentina (D-06), no según el reloj de la computadora.
// A diferencia de format.js, acá sí se usa Intl: se necesita la zona horaria del servidor.
// `ahora` se puede inyectar para fijarlo en las pruebas.
export function hoyEnArgentina(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const valor = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

function esBisiesto(anio) {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

function existeEnElCalendario(anio, mes, dia) {
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const dias = [31, esBisiesto(anio) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia <= dias[mes - 1];
}

// Cada función devuelve { valor } si el dato es válido o { error } con el mensaje para la persona.

function revisarTipo(tipo) {
  if (!TIPOS.includes(tipo)) return { error: 'Elegí si es un gasto o un ingreso.' };
  return { valor: tipo };
}

// RN-02, RN-14: monto escrito con coma decimal; entre $ 0,01 y $ 999.999.999,99.
function revisarMonto(texto) {
  if (typeof texto !== 'string' || texto.trim() === '') return { error: 'Ingresá el monto.' };

  const centavos = parsearMonto(texto);
  if (centavos === null) {
    return { error: 'Ingresá un monto válido: usá coma para los centavos (hasta 2 decimales), por ejemplo 1.234,56.' };
  }
  if (centavos < MONTO_MINIMO_CENTAVOS) return { error: 'El monto debe ser de al menos $ 0,01.' };
  if (centavos > MONTO_MAXIMO_CENTAVOS) return { error: 'El monto no puede superar $ 999.999.999,99.' };
  return { valor: centavos };
}

// RN-03: fecha AAAA-MM-DD que exista en el calendario, entre el 2000-01-01 y hoy, ambos inclusive.
function revisarFecha(fecha, hoy) {
  if (typeof fecha !== 'string' || fecha.trim() === '') return { error: 'Elegí la fecha.' };

  const partes = FORMATO_FECHA.exec(fecha);
  if (!partes || !existeEnElCalendario(Number(partes[1]), Number(partes[2]), Number(partes[3]))) {
    return { error: 'La fecha no es válida.' };
  }
  if (fecha < FECHA_MINIMA) return { error: 'La fecha no puede ser anterior al 01/01/2000.' };
  if (fecha > hoy) return { error: 'La fecha no puede ser futura.' };
  return { valor: fecha };
}

// RN-04: hay que elegir una categoría. El selector entrega texto; la API espera el número.
// (Que exista, sea del tipo y esté activa lo decide el servidor.)
function revisarCategoria(valor) {
  const texto = typeof valor === 'number' ? String(valor) : valor;
  if (typeof texto !== 'string' || texto === '') return { error: 'Elegí una categoría.' };

  const id = /^\d+$/.test(texto) ? Number(texto) : NaN;
  if (!Number.isSafeInteger(id)) return { error: 'La categoría elegida no es válida.' };
  return { valor: id };
}

// RN-05: opcional; se recortan los espacios de los extremos; vacía es null; hasta 140 caracteres.
function revisarDescripcion(valor) {
  if (valor === undefined || valor === null) return { valor: null };
  if (typeof valor !== 'string') return { error: 'La descripción debe ser un texto.' };

  const recortada = valor.trim();
  if (recortada === '') return { valor: null };
  if (Array.from(recortada).length > LARGO_MAXIMO_DESCRIPCION) {
    return { error: `La descripción no puede superar los ${LARGO_MAXIMO_DESCRIPCION} caracteres.` };
  }
  return { valor: recortada };
}

// Valida lo que leyó el formulario ({ tipo, monto, fecha, categoriaId, descripcion }, todo texto).
// `hoy` es el texto AAAA-MM-DD de hoyEnArgentina().
// Devuelve { ok: true, payload } con lo que espera la API, o { ok: false, errores } con un mensaje
// por cada campo inválido (todos juntos): { tipo?, monto?, fecha?, categoriaId?, descripcion? }.
export function validarMovimiento(entrada, hoy) {
  if (typeof hoy !== 'string' || !FORMATO_FECHA.test(hoy)) {
    throw new TypeError('"hoy" debe ser un texto con el formato AAAA-MM-DD.');
  }
  const { tipo, monto, fecha, categoriaId, descripcion } = entrada ?? {};

  const resultados = {
    tipo: revisarTipo(tipo),
    monto: revisarMonto(monto),
    fecha: revisarFecha(fecha, hoy),
    categoriaId: revisarCategoria(categoriaId),
    descripcion: revisarDescripcion(descripcion),
  };

  const errores = {};
  for (const [campo, resultado] of Object.entries(resultados)) {
    if (resultado.error) errores[campo] = resultado.error;
  }
  if (Object.keys(errores).length > 0) return { ok: false, errores };

  return {
    ok: true,
    payload: {
      tipo: resultados.tipo.valor,
      montoCentavos: resultados.monto.valor,
      fecha: resultados.fecha.valor,
      categoriaId: resultados.categoriaId.valor,
      descripcion: resultados.descripcion.valor,
    },
  };
}

// RN-04, RN-09: categorías que el selector ofrece para el tipo elegido: solo las activas.
// Al editar, `categoriaActualId` es la que el movimiento ya tiene: se ofrece aunque esté desactivada
// (siempre que sea del tipo elegido), para poder dejarla. Mantiene el orden de la lista recibida.
export function categoriasOfrecidas(categorias, tipo, categoriaActualId = null) {
  return categorias.filter((c) => c.tipo === tipo && (c.activa || c.id === categoriaActualId));
}