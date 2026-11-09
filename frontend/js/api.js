// Cliente de la API. Traduce el formato de error de D-19 a una excepción que las pantallas
// pueden mostrar junto a cada campo. Las rutas se pasan completas, con su query ("/api/movimientos?mes=2026-10").

export class ErrorDeApi extends Error {
  constructor({ status = 0, codigo, mensaje, campos = {} }) {
    super(mensaje);
    this.name = 'ErrorDeApi';
    this.status = status; // 0 si ni siquiera hubo respuesta
    this.codigo = codigo;
    this.campos = campos; // { nombreDelCampo: 'mensaje' }
  }
}

// Aviso de cambios: se emite un evento "cambio" cada vez que el servidor acepta una escritura
// (POST, PUT, PATCH o DELETE). Las partes de la pantalla que dependen de los datos que cambian otras
// (como el aviso de presupuestos) lo escuchan para ponerse al día solas, sin que cada pantalla tenga que avisarles.
export const cambios = new EventTarget();
const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.';
const MENSAJE_INESPERADO = 'El servidor respondió de forma inesperada. Intentá de nuevo.';

async function pedir(metodo, ruta, cuerpo) {
  const opciones = { method: metodo, headers: { Accept: 'application/json' }, cache: 'no-store' };
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  let respuesta;
  let texto;
  try {
    respuesta = await fetch(ruta, opciones);
    texto = await respuesta.text();
  } catch {
    throw new ErrorDeApi({ codigo: 'SIN_CONEXION', mensaje: MENSAJE_SIN_CONEXION });
  }

  // Sin contenido (204) es null; si hay texto que no es JSON, queda undefined.
  let datos = null;
  if (texto !== '') {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = undefined;
    }
  }

    if (respuesta.ok) {
    // El servidor aceptó una escritura: los datos cambiaron, aunque la respuesta no se pueda leer.
    if (metodo !== 'GET') cambios.dispatchEvent(new Event('cambio'));
    if (datos === undefined) {
      throw new ErrorDeApi({ status: respuesta.status, codigo: 'RESPUESTA_INESPERADA', mensaje: MENSAJE_INESPERADO });
    }
    return datos;
  }

  const error = datos?.error;
  if (error && typeof error.codigo === 'string') {
    throw new ErrorDeApi({
      status: respuesta.status,
      codigo: error.codigo,
      mensaje: error.mensaje ?? MENSAJE_INESPERADO,
      campos: error.campos ?? {},
    });
  }
  throw new ErrorDeApi({ status: respuesta.status, codigo: 'ERROR_DE_RESPUESTA', mensaje: MENSAJE_INESPERADO });
}

export const api = {
  get: (ruta) => pedir('GET', ruta),
  post: (ruta, cuerpo) => pedir('POST', ruta, cuerpo),
  put: (ruta, cuerpo) => pedir('PUT', ruta, cuerpo),
  patch: (ruta, cuerpo) => pedir('PATCH', ruta, cuerpo),
  delete: (ruta) => pedir('DELETE', ruta),
};