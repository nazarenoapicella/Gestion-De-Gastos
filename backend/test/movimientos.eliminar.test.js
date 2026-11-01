import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEntorno } from './helpers.js';

function idDe(db, nombre, tipo = 'GASTO') {
  return db.prepare('SELECT id FROM categorias WHERE nombre = ? AND tipo = ?').get(nombre, tipo).id;
}

// Inserta directo en la base: así estas pruebas no dependen de las rutas de alta.
function insertarMovimiento(db, { categoria = 'Alimentación', descripcion = 'Original' } = {}) {
  const resultado = db
    .prepare(
      `INSERT INTO movimientos (monto_centavos, fecha, categoria_id, descripcion, creado_en)
       VALUES (100000, '2026-10-15', ?, ?, '2026-10-01T10:00:00.000Z')`
    )
    .run(idDe(db, categoria), descripcion);
  return Number(resultado.lastInsertRowid);
}

function contarMovimientos(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM movimientos').get().n;
}

test('T-10.1 / CA-04.1: eliminar un movimiento existente responde 204 y después GET responde 404', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = insertarMovimiento(db);

    const { status, cuerpo } = await pedir('DELETE', `/api/movimientos/${id}`);
    assert.equal(status, 204);
    assert.equal(cuerpo, null);

    const leido = await pedir('GET', `/api/movimientos/${id}`);
    assert.equal(leido.status, 404);
    assert.equal(leido.cuerpo.error.codigo, 'NO_ENCONTRADO');
  }));

test('T-10.2 / CA-04.3: eliminar un movimiento inexistente responde 404 NO_ENCONTRADO', () =>
  conEntorno(async ({ db, pedir }) => {
    // Precondición: la ruta existe y funciona con un movimiento real.
    const real = await pedir('DELETE', `/api/movimientos/${insertarMovimiento(db)}`);
    assert.equal(real.status, 204);

    const { status, cuerpo } = await pedir('DELETE', '/api/movimientos/9999');
    assert.equal(status, 404);
    assert.equal(cuerpo.error.codigo, 'NO_ENCONTRADO');
  }));

test('T-10.3: con 3 movimientos, eliminar uno deja 2 y no toca a los otros', () =>
  conEntorno(async ({ db, pedir }) => {
    const a = insertarMovimiento(db, { descripcion: 'A' });
    const b = insertarMovimiento(db, { descripcion: 'B' });
    const c = insertarMovimiento(db, { descripcion: 'C' });
    assert.equal(contarMovimientos(db), 3);

    const { status } = await pedir('DELETE', `/api/movimientos/${b}`);
    assert.equal(status, 204);

    assert.equal(contarMovimientos(db), 2);
    const quedan = db
      .prepare('SELECT id FROM movimientos ORDER BY id')
      .all()
      .map((fila) => fila.id);
    assert.deepEqual(quedan, [a, c]);
  }));

test('T-10.4: eliminar un movimiento no elimina su categoría', () =>
  conEntorno(async ({ db, pedir }) => {
    const categoriaId = idDe(db, 'Alimentación');
    const id = insertarMovimiento(db, { categoria: 'Alimentación' });

    const { status } = await pedir('DELETE', `/api/movimientos/${id}`);
    assert.equal(status, 204);

    const categoria = db.prepare('SELECT COUNT(*) AS n FROM categorias WHERE id = ?').get(categoriaId);
    assert.equal(categoria.n, 1);
  }));

// Agregado: un id que no es un número entero no existe.
test('T-10.5: un id que no es número responde 404 NO_ENCONTRADO y no borra nada', () =>
  conEntorno(async ({ db, pedir }) => {
    const real = await pedir('DELETE', `/api/movimientos/${insertarMovimiento(db)}`);
    assert.equal(real.status, 204);

    const intacto = insertarMovimiento(db);
    for (const ruta of ['/api/movimientos/abc', '/api/movimientos/1.5', '/api/movimientos/-1']) {
      const { status, cuerpo } = await pedir('DELETE', ruta);
      assert.equal(status, 404, ruta);
      assert.equal(cuerpo.error.codigo, 'NO_ENCONTRADO', ruta);
    }
    assert.equal(contarMovimientos(db), 1);
    assert.ok(db.prepare('SELECT id FROM movimientos WHERE id = ?').get(intacto));
  }));

// Agregado: es lo que pasa con un doble clic en "Eliminar" (CB-25 / D-20): el segundo pedido no existe.
test('T-10.6: repetir el DELETE sobre el mismo id responde 404 la segunda vez', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = insertarMovimiento(db);

    const primero = await pedir('DELETE', `/api/movimientos/${id}`);
    assert.equal(primero.status, 204);

    const segundo = await pedir('DELETE', `/api/movimientos/${id}`);
    assert.equal(segundo.status, 404);
    assert.equal(segundo.cuerpo.error.codigo, 'NO_ENCONTRADO');
  }));

// Agregado (RN-09): un movimiento de una categoría desactivada también se puede eliminar.
test('T-10.7 / RN-09: eliminar un movimiento de una categoría desactivada responde 204 y la categoría sigue desactivada', () =>
  conEntorno(async ({ db, pedir }) => {
    const categoriaId = idDe(db, 'Ocio');
    const id = insertarMovimiento(db, { categoria: 'Ocio' });
    db.prepare('UPDATE categorias SET activa = 0 WHERE id = ?').run(categoriaId);

    const { status } = await pedir('DELETE', `/api/movimientos/${id}`);
    assert.equal(status, 204);
    assert.equal(contarMovimientos(db), 0);

    const categoria = db.prepare('SELECT activa FROM categorias WHERE id = ?').get(categoriaId);
    assert.equal(categoria.activa, 0);
  }));