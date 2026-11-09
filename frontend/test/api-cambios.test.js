import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErrorDeApi, api, cambios } from '../js/api.js';

const json = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

// Cuenta los eventos "cambio" que se emiten durante la prueba y deja de escuchar al terminar.
function contarCambios(t) {
  let cantidad = 0;
  const alCambiar = () => {
    cantidad += 1;
  };
  cambios.addEventListener('cambio', alCambiar);
  t.after(() => cambios.removeEventListener('cambio', alCambiar));
  return () => cantidad;
}

test('T-21.7: cada escritura aceptada por el servidor (POST, PUT, PATCH, DELETE) emite un evento "cambio"', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json({ id: 1 }));
  const cantidad = contarCambios(t);

  await api.post('/api/categorias', { nombre: 'Mascotas', tipo: 'GASTO' });
  assert.equal(cantidad(), 1);

  await api.put('/api/presupuestos/1', { limiteCentavos: 5000000 });
  assert.equal(cantidad(), 2);

  await api.patch('/api/categorias/1', { activa: false });
  assert.equal(cantidad(), 3);

  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  await api.delete('/api/movimientos/1');
  assert.equal(cantidad(), 4);
});

test('T-21.8: una consulta (GET) no emite ningún evento', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json([]));
  const cantidad = contarCambios(t);

  await api.get('/api/categorias');
  await api.get('/api/movimientos?mes=2026-10');
  assert.equal(cantidad(), 0);
});

test('T-21.9: una escritura rechazada o sin conexión no emite ningún evento', async (t) => {
  const cantidad = contarCambios(t);

  t.mock.method(globalThis, 'fetch', async () =>
    json({ error: { codigo: 'VALIDACION', mensaje: 'Revisá los datos ingresados.', campos: {} } }, 400)
  );
  await assert.rejects(api.post('/api/movimientos', {}), ErrorDeApi);

  t.mock.method(globalThis, 'fetch', async () =>
    json({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'El movimiento no existe.', campos: {} } }, 404)
  );
  await assert.rejects(api.delete('/api/movimientos/9999'), ErrorDeApi);

  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(api.put('/api/presupuestos/1', { limiteCentavos: 1 }), ErrorDeApi);

  assert.equal(cantidad(), 0);
});

// El servidor aceptó el cambio aunque la respuesta no se pueda leer: los datos cambiaron igual.
test('T-21.10: una escritura aceptada con una respuesta ilegible emite el evento y falla con RESPUESTA_INESPERADA', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('esto no es json', { status: 200 }));
  const cantidad = contarCambios(t);

  await assert.rejects(api.post('/api/movimientos', {}), (err) => {
    assert.ok(err instanceof ErrorDeApi);
    assert.equal(err.codigo, 'RESPUESTA_INESPERADA');
    return true;
  });
  assert.equal(cantidad(), 1);
});