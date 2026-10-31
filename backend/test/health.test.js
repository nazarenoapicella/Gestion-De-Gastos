import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApp } from '../src/app.js';
import { manejadorDeErrores, manejadorNoEncontrado } from '../src/errores.js';

// Levanta la app en un puerto aleatorio y devuelve la URL base y una función para cerrarla.
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

test('T-01.1: GET /api/health responde 200 con estado ok', async () => {
  const { base, cerrar } = await levantar(createApp());
  try {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { estado: 'ok' });
  } finally {
    await cerrar();
  }
});

test('T-01.2: una ruta inexistente responde 404 NO_ENCONTRADO', async () => {
  const { base, cerrar } = await levantar(createApp());
  try {
    const res = await fetch(`${base}/api/inexistente`);
    assert.equal(res.status, 404);
    const cuerpo = await res.json();
    assert.equal(cuerpo.error.codigo, 'NO_ENCONTRADO');
  } finally {
    await cerrar();
  }
});

test('T-01.3: un JSON inválido responde 400 JSON_INVALIDO', async () => {
  const { base, cerrar } = await levantar(createApp());
  try {
    const res = await fetch(`${base}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{rota',
    });
    assert.equal(res.status, 400);
    const cuerpo = await res.json();
    assert.equal(cuerpo.error.codigo, 'JSON_INVALIDO');
  } finally {
    await cerrar();
  }
});

test('T-01.4: una excepción inesperada responde 500 ERROR_INTERNO sin exponer el detalle', async (t) => {
  t.mock.method(console, 'error', () => {}); // evita ensuciar la salida del test

  const app = express();
  app.get('/api/falla', () => {
    throw new Error('secreto-interno-123');
  });
  app.use(manejadorNoEncontrado);
  app.use(manejadorDeErrores);

  const { base, cerrar } = await levantar(app);
  try {
    const res = await fetch(`${base}/api/falla`);
    assert.equal(res.status, 500);
    const texto = await res.text();
    assert.equal(JSON.parse(texto).error.codigo, 'ERROR_INTERNO');
    assert.ok(!texto.includes('secreto-interno-123'), 'no debe filtrar el mensaje interno');
  } finally {
    await cerrar();
  }
});