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

test('T-01.5: aplica cabeceras de seguridad y no sirve fuentes de pruebas', async () => {
  const { base, cerrar } = await levantar(createApp());
  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.headers.get('x-powered-by'), null);
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.headers.get('x-frame-options'), 'DENY');
    assert.equal(health.headers.get('referrer-policy'), 'same-origin');
    assert.match(health.headers.get('content-security-policy') || '', /default-src 'self'/);
    assert.equal(health.headers.get('cache-control'), 'no-store');

    const testSource = await fetch(`${base}/test/categorias.test.js`);
    assert.equal(testSource.status, 404);
  } finally {
    await cerrar();
  }
});

test('T-01.6: rechaza cuerpos JSON mayores a 16 KiB con 413', async () => {
  const { base, cerrar } = await levantar(createApp());
  try {
    const res = await fetch(`${base}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dato: 'x'.repeat(17 * 1024) }),
    });
    assert.equal(res.status, 413);
    const cuerpo = await res.json();
    assert.equal(cuerpo.error.codigo, 'CUERPO_DEMASIADO_GRANDE');
  } finally {
    await cerrar();
  }
});
