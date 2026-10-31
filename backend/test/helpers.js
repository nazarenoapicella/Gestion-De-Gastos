import { createApp } from '../src/app.js';
import { abrirBase, inicializarEsquema } from '../src/db/index.js';
import { sembrarCategorias } from '../src/db/seed.js';

// Reloj fijo de las pruebas: 2026-10-30 a las 12:00 de Buenos Aires (15:00 UTC).
export const RELOJ_FIJO = () => new Date('2026-10-30T15:00:00Z');

// Levanta una app en un puerto aleatorio y devuelve la URL base y cómo cerrarla.
function levantar(app) {
  return new Promise((resolve) => {
    const servidor = app.listen(0, () => {
      resolve({
        base: `http://127.0.0.1:${servidor.address().port}`,
        cerrar: () =>
          new Promise((fin) => {
            servidor.closeAllConnections?.();
            servidor.close(fin);
          }),
      });
    });
  });
}

// Entorno de prueba: base en memoria con el seed, app levantada y un cliente HTTP mínimo.
export async function crearEntorno({ reloj = RELOJ_FIJO } = {}) {
  const db = abrirBase(':memory:');
  inicializarEsquema(db);
  sembrarCategorias(db);

  const servidor = await levantar(createApp({ db, reloj }));

  // Devuelve { status, cuerpo }; cuerpo es null si la respuesta no trae contenido (204).
  async function pedir(metodo, ruta, cuerpo) {
    const opciones = { method: metodo, headers: {} };
    if (cuerpo !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }
    const res = await fetch(`${servidor.base}${ruta}`, opciones);
    const texto = await res.text();
    return { status: res.status, cuerpo: texto ? JSON.parse(texto) : null };
  }

  return {
    db,
    pedir,
    cerrar: async () => {
      await servidor.cerrar();
      db.close();
    },
  };
}

// Ejecuta una prueba con un entorno nuevo y lo cierra siempre al terminar.
export async function conEntorno(prueba, opciones) {
  const entorno = await crearEntorno(opciones);
  try {
    await prueba(entorno);
  } finally {
    await entorno.cerrar();
  }
}