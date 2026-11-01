// Convierte el :id de la URL en un entero positivo.
// Devuelve null si no es un número entero escrito solo con dígitos ("abc", "1.5", "-1"):
// un id así no puede existir, así que se informa como 404.
export function convertirId(texto) {
  if (typeof texto !== 'string' || !/^\d+$/.test(texto)) return null;
  const id = Number(texto);
  return Number.isSafeInteger(id) ? id : null;
}