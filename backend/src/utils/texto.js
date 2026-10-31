// Deja el nombre sin espacios al inicio y al final y con los espacios repetidos reducidos a uno.
export function limpiarNombre(nombre) {
  return String(nombre).trim().replace(/\s+/g, ' ');
}

// Forma comparable del nombre: sin tildes, en minúsculas y con espacios colapsados (RN-06).
// "  Alimentación " -> "alimentacion"
export function normalizarNombre(nombre) {
  return limpiarNombre(nombre)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}