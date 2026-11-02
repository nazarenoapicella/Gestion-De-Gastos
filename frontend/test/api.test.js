import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, ErrorDeApi } from '../js/api.js';

const json = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

// Reemplaza fetch por una respuesta fija. Devuelve el simulador para inspeccionar cómo se lo llamó.
function simularFetch(t, respuesta) {
  return t.mock.method(globalThis, 'fetch', async () => respuesta);
}

// Verifica que la promesa falle con un ErrorDeApi que tenga (al menos) las propiedades indicadas.
async function assertErrorDeApi(promesa, esperado) {
  await assert.rejects(promesa, (err) => {
    assert.ok(err instanceof ErrorDeApi, 'debe ser un ErrorDeApi');
    for (const [clave, valor] of Object.entries(esperado)) {
      assert.deepEqual(err[clave], valor, clave);
    }
    return true;
  });
}

// Agregado: la tarea pide que api.js "traduzca el formato de error"; estas pruebas lo fijan.
test('T-16.6: GET devuelve el JSON de la respuesta y pide la ruta indicada', async (t) => {
  const simulado = simularFetch(t, json({ estado: 'ok' }));

  const datos = await api.get('/api/health');
  assert.deepEqual(datos, { estado: 'ok' });

  const [ruta, opciones] = simulado.mock.calls[0].arguments;
  assert.equal(ruta, '/api/health');
  assert.equal(opciones.method, 'GET');
  assert.equal(opciones.body, undefined);
});

test('T-16.7: POST envía el cuerpo como JSON', async (t) => {
  const simulado = simularFetch(t, json({ id: 7 }, 201));

  const datos = await api.post('/api/categorias', { nombre: 'Mascotas', tipo: 'GASTO' });
  assert.deepEqual(datos, { id: 7 });

  const [, opciones] = simulado.mock.calls[0].arguments;
  assert.equal(opciones.method, 'POST');
  assert.equal(opciones.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(opciones.body), { nombre: 'Mascotas', tipo: 'GASTO' });
});

test('T-16.8: una respuesta 204 (sin contenido) devuelve null', async (t) => {
  const simulado = simularFetch(t, new Response(null, { status: 204 }));

  assert.equal(await api.delete('/api/movimientos/1'), null);
  assert.equal(simulado.mock.calls[0].arguments[1].method, 'DELETE');
});

test('T-16.9 / D-19: un error de la API se traduce a ErrorDeApi con su código, mensaje y campos', async (t) => {
  const mensajeDeCampo = 'El monto debe estar entre $ 0,01 y $ 999.999.999,99.';
  simularFetch(
    t,
    json(
      {
        error: {
          codigo: 'VALIDACION',
          mensaje: 'Revisá los datos ingresados.',
          campos: { montoCentavos: mensajeDeCampo },
        },
      },
      400
    )
  );

  await assertErrorDeApi(api.post('/api/movimientos', {}), {
    status: 400,
    codigo: 'VALIDACION',
    message: 'Revisá los datos ingresados.',
    campos: { montoCentavos: mensajeDeCampo },
  });
});

test('T-16.10: si no hay conexión, falla con ErrorDeApi SIN_CONEXION y estado 0', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Failed to fetch');
  });

  await assertErrorDeApi(api.get('/api/categorias'), { status: 0, codigo: 'SIN_CONEXION', campos: {} });
});

test('T-16.11: un error que no viene en el formato de la API (ej. una página 502) da ERROR_DE_RESPUESTA', async (t) => {
  simularFetch(t, new Response('<html>Bad Gateway</html>', { status: 502 }));

  await assertErrorDeApi(api.get('/api/categorias'), { status: 502, codigo: 'ERROR_DE_RESPUESTA', campos: {} });
});

test('T-16.12: una respuesta exitosa que no es JSON da RESPUESTA_INESPERADA', async (t) => {
  simularFetch(t, new Response('esto no es json', { status: 200 }));

  await assertErrorDeApi(api.get('/api/categorias'), { status: 200, codigo: 'RESPUESTA_INESPERADA' });
});