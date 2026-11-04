// Lógica pura de la pantalla de categorías (T-19): validación del nombre, agrupación y acciones permitidas.
// Espeja las reglas de la spec (RN-06, RN-07) para avisar rápido; el servidor sigue siendo quien decide.
// No usa el DOM: se prueba con node:test.

export const LARGO_MAXIMO_NOMBRE = 30; // RN-06

const NOMBRES_DE_TIPOS = { GASTO: 'gastos', INGRESO: 'ingresos' };

// Sin espacios al inicio y al final y con los espacios repetidos reducidos a uno (igual que el servidor, RN-06).
export function limpiarNombre(texto) {
  return String(texto).trim().replace(/\s+/g, ' ');
}

// RN-06: entre 1 y 30 caracteres después de limpiar. El largo se mide con .length, igual que el servidor,
// de modo que el formulario nunca acepta algo que el servidor vaya a rechazar por largo.
// Devuelve { ok: true, valor } o { ok: false, error }.
export function validarNombre(texto) {
  if (typeof texto !== 'string') return { ok: false, error: 'Ingresá el nombre de la categoría.' };

  const valor = limpiarNombre(texto);
  if (valor === '') return { ok: false, error: 'Ingresá el nombre de la categoría.' };
  if (valor.length > LARGO_MAXIMO_NOMBRE) {
    return { ok: false, error: `El nombre no puede superar los ${LARGO_MAXIMO_NOMBRE} caracteres.` };
  }
  return { ok: true, valor };
}

// Separa las categorías por tipo, conservando el orden en que llegan.
export function agruparPorTipo(categorias) {
  return {
    GASTO: categorias.filter((c) => c.tipo === 'GASTO'),
    INGRESO: categorias.filter((c) => c.tipo === 'INGRESO'),
  };
}

// RN-07, RN-09: acciones que se ofrecen para una categoría. Las protegidas no tienen ninguna.
// Activar solo se ofrece a las desactivadas, y desactivar solo a las activas.
export function accionesDe(categoria) {
  if (categoria.protegida) return [];
  return categoria.activa ? ['renombrar', 'desactivar', 'eliminar'] : ['renombrar', 'activar', 'eliminar'];
}

// Frase que describe una categoría: sirve para los lectores de pantalla y para las ventanas.
export function describirCategoria(categoria) {
  if (!Object.hasOwn(NOMBRES_DE_TIPOS, categoria.tipo)) throw new TypeError('El tipo debe ser GASTO o INGRESO.');
  let texto = `${categoria.nombre}, categoría de ${NOMBRES_DE_TIPOS[categoria.tipo]}`;
  if (!categoria.activa) texto += ', desactivada';
  return texto;
}