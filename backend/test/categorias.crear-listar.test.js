import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEntorno } from './helpers.js';

test('T-05.1: GET /api/categorias lista las 11 del seed, GASTO primero y cada grupo por nombre', () =>
  conEntorno(async ({ pedir }) => {
    const { status, cuerpo } = await pedir('GET', '/api/categorias');
    assert.equal(status, 200);
    assert.equal(cuerpo.length, 11);
    assert.deepEqual(
      cuerpo.map((c) => `${c.tipo}:${c.nombre}`),
      [
        'GASTO:Alimentación',
        'GASTO:Educación',
        'GASTO:Ocio',
        'GASTO:Otros gastos',
        'GASTO:Salud',
        'GASTO:Servicios',
        'GASTO:Transporte',
        'GASTO:Vivienda',
        'INGRESO:Otros ingresos',
        'INGRESO:Sueldo',
        'INGRESO:Ventas',
      ]
    );
    assert.deepEqual(Object.keys(cuerpo[0]).sort(), ['activa', 'id', 'nombre', 'protegida', 'tipo']);
    assert.equal(cuerpo[0].activa, true);
    assert.equal(cuerpo[0].protegida, false);
  }));

test('T-05.2: el filtro tipo devuelve 8 gastos o 3 ingresos; un tipo inválido da 400', () =>
  conEntorno(async ({ pedir }) => {
    const gastos = await pedir('GET', '/api/categorias?tipo=GASTO');
    assert.equal(gastos.status, 200);
    assert.equal(gastos.cuerpo.length, 8);

    const ingresos = await pedir('GET', '/api/categorias?tipo=INGRESO');
    assert.equal(ingresos.status, 200);
    assert.equal(ingresos.cuerpo.length, 3);

    const invalido = await pedir('GET', '/api/categorias?tipo=OTRO');
    assert.equal(invalido.status, 400);
    assert.equal(invalido.cuerpo.error.codigo, 'VALIDACION');
    assert.ok(invalido.cuerpo.error.campos.tipo);
  }));

test('T-05.3 / CA-07.1: crear "  Mascotas " (GASTO) guarda "Mascotas", activa y no protegida', () =>
  conEntorno(async ({ pedir }) => {
    const { status, cuerpo } = await pedir('POST', '/api/categorias', {
      nombre: '  Mascotas ',
      tipo: 'GASTO',
    });
    assert.equal(status, 201);
    assert.equal(cuerpo.nombre, 'Mascotas');
    assert.equal(cuerpo.tipo, 'GASTO');
    assert.equal(cuerpo.activa, true);
    assert.equal(cuerpo.protegida, false);
    assert.ok(Number.isInteger(cuerpo.id));

    const lista = await pedir('GET', '/api/categorias');
    assert.equal(lista.cuerpo.length, 12);
  }));

test('T-05.4 / CA-07.2: "Alimentacion" (sin tilde) es duplicado de "Alimentación" -> 409', () =>
  conEntorno(async ({ pedir }) => {
    const { status, cuerpo } = await pedir('POST', '/api/categorias', {
      nombre: 'Alimentacion',
      tipo: 'GASTO',
    });
    assert.equal(status, 409);
    assert.equal(cuerpo.error.codigo, 'NOMBRE_DUPLICADO');
    assert.ok(cuerpo.error.campos.nombre);

    const lista = await pedir('GET', '/api/categorias');
    assert.equal(lista.cuerpo.length, 11);
  }));

test('T-05.5 / CB-14: "  alimentación  " con espacios y minúsculas también es duplicado -> 409', () =>
  conEntorno(async ({ pedir }) => {
    const { status, cuerpo } = await pedir('POST', '/api/categorias', {
      nombre: '  alimentación  ',
      tipo: 'GASTO',
    });
    assert.equal(status, 409);
    assert.equal(cuerpo.error.codigo, 'NOMBRE_DUPLICADO');
  }));

test('T-05.6 / CA-07.3, CB-15: el mismo nombre se permite en distinto tipo', () =>
  conEntorno(async ({ pedir }) => {
    const gasto = await pedir('POST', '/api/categorias', { nombre: 'Regalos', tipo: 'GASTO' });
    assert.equal(gasto.status, 201);

    const ingreso = await pedir('POST', '/api/categorias', { nombre: 'Regalos', tipo: 'INGRESO' });
    assert.equal(ingreso.status, 201);
    assert.notEqual(gasto.cuerpo.id, ingreso.cuerpo.id);

    // y el mismo nombre repetido dentro del mismo tipo sí se rechaza
    const repetido = await pedir('POST', '/api/categorias', { nombre: 'regalos', tipo: 'GASTO' });
    assert.equal(repetido.status, 409);
  }));

test('T-05.7 / CA-07.4, CB-16: el nombre vacío, ausente o de más de 30 caracteres da 400; de 30 se acepta', () =>
  conEntorno(async ({ pedir }) => {
    const casos = [
      { nombre: '', tipo: 'GASTO' },
      { nombre: '   ', tipo: 'GASTO' },
      { nombre: 'A'.repeat(31), tipo: 'GASTO' },
      { nombre: 123, tipo: 'GASTO' },
      { tipo: 'GASTO' },
    ];
    for (const cuerpoEnviado of casos) {
      const { status, cuerpo } = await pedir('POST', '/api/categorias', cuerpoEnviado);
      assert.equal(status, 400, JSON.stringify(cuerpoEnviado));
      assert.equal(cuerpo.error.codigo, 'VALIDACION');
      assert.ok(cuerpo.error.campos.nombre, JSON.stringify(cuerpoEnviado));
    }

    const limite = await pedir('POST', '/api/categorias', { nombre: 'A'.repeat(30), tipo: 'GASTO' });
    assert.equal(limite.status, 201);
  }));

test('T-05.8 / CA-07.4: un tipo inválido o ausente da 400 con error en el campo tipo', () =>
  conEntorno(async ({ pedir }) => {
    const casos = [{ nombre: 'Varios', tipo: 'OTRO' }, { nombre: 'Varios' }, { nombre: 'Varios', tipo: 'gasto' }];
    for (const cuerpoEnviado of casos) {
      const { status, cuerpo } = await pedir('POST', '/api/categorias', cuerpoEnviado);
      assert.equal(status, 400, JSON.stringify(cuerpoEnviado));
      assert.equal(cuerpo.error.codigo, 'VALIDACION');
      assert.ok(cuerpo.error.campos.tipo, JSON.stringify(cuerpoEnviado));
    }
  }));

test('T-05.9: el filtro activa separa activas e inactivas; un valor inválido da 400', () =>
  conEntorno(async ({ db, pedir }) => {
    db.prepare("UPDATE categorias SET activa = 0 WHERE nombre = 'Ocio'").run();

    const activas = await pedir('GET', '/api/categorias?activa=true');
    assert.equal(activas.status, 200);
    assert.equal(activas.cuerpo.length, 10);
    assert.ok(!activas.cuerpo.some((c) => c.nombre === 'Ocio'));

    const inactivas = await pedir('GET', '/api/categorias?activa=false');
    assert.equal(inactivas.status, 200);
    assert.deepEqual(
      inactivas.cuerpo.map((c) => c.nombre),
      ['Ocio']
    );

    const invalido = await pedir('GET', '/api/categorias?activa=quizas');
    assert.equal(invalido.status, 400);
    assert.ok(invalido.cuerpo.error.campos.activa);
  }));

// Agregado: la API informa todos los errores a la vez, para mostrarlos juntos en el formulario.
test('T-05.10: con nombre y tipo inválidos a la vez, el error informa ambos campos', () =>
  conEntorno(async ({ pedir }) => {
    const { status, cuerpo } = await pedir('POST', '/api/categorias', { nombre: '', tipo: 'OTRO' });
    assert.equal(status, 400);
    assert.ok(cuerpo.error.campos.nombre);
    assert.ok(cuerpo.error.campos.tipo);
  }));