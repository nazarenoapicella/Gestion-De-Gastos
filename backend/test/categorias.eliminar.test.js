import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEntorno } from './helpers.js';

function idDe(db, nombre, tipo = 'GASTO') {
  return db.prepare('SELECT id FROM categorias WHERE nombre = ? AND tipo = ?').get(nombre, tipo).id;
}

function existe(db, id) {
  return db.prepare('SELECT COUNT(*) AS n FROM categorias WHERE id = ?').get(id).n === 1;
}

// Los movimientos y presupuestos se insertan directo en la base: todavía no existen sus endpoints.
function insertarMovimiento(db, categoriaId) {
  return db
    .prepare(
      `INSERT INTO movimientos (monto_centavos, fecha, categoria_id, descripcion, creado_en)
       VALUES (123456, '2026-10-29', ?, 'Supermercado', '2026-10-30T15:00:00.000Z')`
    )
    .run(categoriaId);
}

function insertarPresupuesto(db, categoriaId, limiteCentavos) {
  return db
    .prepare('INSERT INTO presupuestos (categoria_id, limite_centavos, actualizado_en) VALUES (?, ?, ?)')
    .run(categoriaId, limiteCentavos, '2026-10-30T15:00:00.000Z');
}

function contar(db, tabla) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).get().n;
}

test('T-07.1 / CA-07.8: eliminar "Salud" (sin movimientos) responde 204 y desaparece de la lista', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Salud');
    const { status, cuerpo } = await pedir('DELETE', `/api/categorias/${id}`);
    assert.equal(status, 204);
    assert.equal(cuerpo, null);

    const lista = await pedir('GET', '/api/categorias');
    assert.equal(lista.cuerpo.length, 10);
    assert.ok(!lista.cuerpo.some((c) => c.nombre === 'Salud'));
    assert.equal(existe(db, id), false);
  }));

test('T-07.2 / CA-07.9: eliminar "Alimentación" con 1 movimiento responde 409 y no borra nada', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Alimentación');
    insertarMovimiento(db, id);

    const { status, cuerpo } = await pedir('DELETE', `/api/categorias/${id}`);
    assert.equal(status, 409);
    assert.equal(cuerpo.error.codigo, 'CATEGORIA_CON_MOVIMIENTOS');
    assert.match(cuerpo.error.mensaje, /desactiv/i, 'debe sugerir desactivarla');

    assert.equal(existe(db, id), true);
    assert.equal(contar(db, 'movimientos'), 1);
  }));

test('T-07.3 / CA-07.7: eliminar "Otros gastos" responde 409 CATEGORIA_PROTEGIDA', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Otros gastos');
    const { status, cuerpo } = await pedir('DELETE', `/api/categorias/${id}`);
    assert.equal(status, 409);
    assert.equal(cuerpo.error.codigo, 'CATEGORIA_PROTEGIDA');
    assert.equal(existe(db, id), true);
  }));

test('T-07.4 / CB-17: eliminar "Educación" con presupuesto y sin movimientos responde 204 y borra su presupuesto', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Educación');
    insertarPresupuesto(db, id, 5000000);
    assert.equal(contar(db, 'presupuestos'), 1);

    const { status } = await pedir('DELETE', `/api/categorias/${id}`);
    assert.equal(status, 204);
    assert.equal(existe(db, id), false);
    assert.equal(contar(db, 'presupuestos'), 0);
  }));

test('T-07.5: eliminar una categoría inexistente responde 404 NO_ENCONTRADO', () =>
  conEntorno(async ({ db, pedir }) => {
    // Precondición: la ruta existe y funciona con una categoría real.
    const real = await pedir('DELETE', `/api/categorias/${idDe(db, 'Vivienda')}`);
    assert.equal(real.status, 204);

    const { status, cuerpo } = await pedir('DELETE', '/api/categorias/9999');
    assert.equal(status, 404);
    assert.equal(cuerpo.error.codigo, 'NO_ENCONTRADO');
  }));

test('T-07.6 / RN-09: eliminar una categoría desactivada y sin movimientos responde 204', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Ocio');
    db.prepare('UPDATE categorias SET activa = 0 WHERE id = ?').run(id);

    const { status } = await pedir('DELETE', `/api/categorias/${id}`);
    assert.equal(status, 204);
    assert.equal(existe(db, id), false);
  }));

// Agregado: un id que no es un número entero no existe.
test('T-07.7: un id que no es número responde 404 NO_ENCONTRADO', () =>
  conEntorno(async ({ db, pedir }) => {
    const real = await pedir('DELETE', `/api/categorias/${idDe(db, 'Transporte')}`);
    assert.equal(real.status, 204);

    for (const ruta of ['/api/categorias/abc', '/api/categorias/1.5', '/api/categorias/-1']) {
      const { status, cuerpo } = await pedir('DELETE', ruta);
      assert.equal(status, 404, ruta);
      assert.equal(cuerpo.error.codigo, 'NO_ENCONTRADO', ruta);
    }
  }));

// Agregado: orden de los chequeos. La protección se informa antes que los movimientos.
test('T-07.8: una protegida con movimientos responde CATEGORIA_PROTEGIDA (no CATEGORIA_CON_MOVIMIENTOS)', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Otros gastos');
    insertarMovimiento(db, id);

    const { status, cuerpo } = await pedir('DELETE', `/api/categorias/${id}`);
    assert.equal(status, 409);
    assert.equal(cuerpo.error.codigo, 'CATEGORIA_PROTEGIDA');
  }));

// Agregado (RN-08): desactivar no habilita a eliminar si hay movimientos.
test('T-07.9 / RN-08: una categoría desactivada con movimientos tampoco se puede eliminar', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Alimentación');
    insertarMovimiento(db, id);
    db.prepare('UPDATE categorias SET activa = 0 WHERE id = ?').run(id);

    const { status, cuerpo } = await pedir('DELETE', `/api/categorias/${id}`);
    assert.equal(status, 409);
    assert.equal(cuerpo.error.codigo, 'CATEGORIA_CON_MOVIMIENTOS');
    assert.equal(existe(db, id), true);
  }));

// Agregado: eliminar una categoría no toca a las demás ni a sus datos.
test('T-07.10: eliminar una categoría no afecta los movimientos ni los presupuestos de otras', () =>
  conEntorno(async ({ db, pedir }) => {
    const alimentacion = idDe(db, 'Alimentación');
    insertarMovimiento(db, alimentacion);
    insertarPresupuesto(db, alimentacion, 5000000);

    const { status } = await pedir('DELETE', `/api/categorias/${idDe(db, 'Salud')}`);
    assert.equal(status, 204);

    assert.equal(contar(db, 'movimientos'), 1);
    assert.equal(contar(db, 'presupuestos'), 1);
    assert.equal(existe(db, alimentacion), true);
  }));