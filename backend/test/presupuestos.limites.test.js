import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEntorno } from './helpers.js';

const AHORA = '2026-10-30T15:00:00.000Z'; // reloj fijo de las pruebas, en UTC

function idDe(db, nombre, tipo = 'GASTO') {
  return db.prepare('SELECT id FROM categorias WHERE nombre = ? AND tipo = ?').get(nombre, tipo).id;
}

function desactivar(db, nombre) {
  db.prepare('UPDATE categorias SET activa = 0 WHERE id = ?').run(idDe(db, nombre));
}

// Copias simples de las filas, para poder compararlas con deepEqual.
function filasDe(db) {
  return db
    .prepare('SELECT categoria_id, limite_centavos, actualizado_en FROM presupuestos ORDER BY categoria_id')
    .all()
    .map((fila) => ({ ...fila }));
}

const ruta = (id) => `/api/presupuestos/${id}`;

test('T-14.1 / CA-08.1: definir $ 50.000,00 para "Alimentación" responde 200 y lo guarda en 5000000 centavos', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Alimentación');

    const { status, cuerpo } = await pedir('PUT', ruta(id), { limiteCentavos: 5000000 });
    assert.equal(status, 200);
    assert.deepEqual(cuerpo, { categoriaId: id, limiteCentavos: 5000000 });
    assert.deepEqual(filasDe(db), [{ categoria_id: id, limite_centavos: 5000000, actualizado_en: AHORA }]);
  }));

test('T-14.2 / CA-08.2: un segundo PUT reemplaza el límite y sigue habiendo una sola fila', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Alimentación');
    await pedir('PUT', ruta(id), { limiteCentavos: 5000000 });

    const { status, cuerpo } = await pedir('PUT', ruta(id), { limiteCentavos: 6000000 });
    assert.equal(status, 200);
    assert.equal(cuerpo.limiteCentavos, 6000000);

    const filas = filasDe(db);
    assert.equal(filas.length, 1);
    assert.equal(filas[0].limite_centavos, 6000000);
  }));

test('T-14.3 / CA-08.3: definir un límite para "Sueldo" (INGRESO) da 400 en categoriaId y no guarda nada', () =>
  conEntorno(async ({ db, pedir }) => {
    const { status, cuerpo } = await pedir('PUT', ruta(idDe(db, 'Sueldo', 'INGRESO')), {
      limiteCentavos: 5000000,
    });
    assert.equal(status, 400);
    assert.equal(cuerpo.error.codigo, 'VALIDACION');
    assert.ok(cuerpo.error.campos.categoriaId);
    assert.deepEqual(filasDe(db), []);
  }));

test('T-14.4 / CA-08.4: un límite 0, negativo, con decimales, de texto, nulo, ausente o mayor al máximo da 400 en limiteCentavos', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Alimentación');

    const cuerpos = [
      { limiteCentavos: 0 },
      { limiteCentavos: -1 },
      { limiteCentavos: 12.5 },
      { limiteCentavos: '100' },
      { limiteCentavos: 100000000000 },
      { limiteCentavos: null },
      {},
    ];
    for (const enviado of cuerpos) {
      const { status, cuerpo } = await pedir('PUT', ruta(id), enviado);
      assert.equal(status, 400, JSON.stringify(enviado));
      assert.equal(cuerpo.error.codigo, 'VALIDACION', JSON.stringify(enviado));
      assert.ok(cuerpo.error.campos.limiteCentavos, JSON.stringify(enviado));
    }
    assert.deepEqual(filasDe(db), []);
  }));

// Agregado (RN-15): el límite tiene el mismo rango que un monto (RN-02).
test('T-14.5 / RN-15: un límite de 1 centavo y uno de 99999999999 se aceptan', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Alimentación');

    const minimo = await pedir('PUT', ruta(id), { limiteCentavos: 1 });
    assert.equal(minimo.status, 200);

    const maximo = await pedir('PUT', ruta(id), { limiteCentavos: 99999999999 });
    assert.equal(maximo.status, 200);
    assert.equal(filasDe(db)[0].limite_centavos, 99999999999);
  }));

test('T-14.6 / CA-08.5: definir un límite para una categoría desactivada da 400 en categoriaId', () =>
  conEntorno(async ({ db, pedir }) => {
    desactivar(db, 'Ocio');

    const { status, cuerpo } = await pedir('PUT', ruta(idDe(db, 'Ocio')), { limiteCentavos: 5000000 });
    assert.equal(status, 400);
    assert.ok(cuerpo.error.campos.categoriaId);
    assert.deepEqual(filasDe(db), []);
  }));

test('T-14.7: PUT sobre una categoría inexistente responde 404 NO_ENCONTRADO', () =>
  conEntorno(async ({ db, pedir }) => {
    // Precondición: la ruta existe y funciona con una categoría real.
    const real = await pedir('PUT', ruta(idDe(db, 'Alimentación')), { limiteCentavos: 5000000 });
    assert.equal(real.status, 200);

    const { status, cuerpo } = await pedir('PUT', ruta(9999), { limiteCentavos: 5000000 });
    assert.equal(status, 404);
    assert.equal(cuerpo.error.codigo, 'NO_ENCONTRADO');
    assert.equal(filasDe(db).length, 1);
  }));

test('T-14.8 / CA-08.6: DELETE de un límite existente responde 204; un segundo DELETE responde 404', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Alimentación');
    await pedir('PUT', ruta(id), { limiteCentavos: 5000000 });

    const primero = await pedir('DELETE', ruta(id));
    assert.equal(primero.status, 204);
    assert.equal(primero.cuerpo, null);
    assert.deepEqual(filasDe(db), []);

    const segundo = await pedir('DELETE', ruta(id));
    assert.equal(segundo.status, 404);
    assert.equal(segundo.cuerpo.error.codigo, 'NO_ENCONTRADO');
  }));

test('T-14.9: DELETE sobre una categoría sin límite o inexistente responde 404', () =>
  conEntorno(async ({ db, pedir }) => {
    // Precondición: el DELETE funciona cuando sí hay un límite.
    const id = idDe(db, 'Alimentación');
    await pedir('PUT', ruta(id), { limiteCentavos: 5000000 });
    const real = await pedir('DELETE', ruta(id));
    assert.equal(real.status, 204);

    const sinLimite = await pedir('DELETE', ruta(idDe(db, 'Transporte')));
    assert.equal(sinLimite.status, 404);
    assert.equal(sinLimite.cuerpo.error.codigo, 'NO_ENCONTRADO');

    const inexistente = await pedir('DELETE', ruta(9999));
    assert.equal(inexistente.status, 404);
  }));

// Agregado: un id que no es un número entero no existe.
test('T-14.10: un id que no es número responde 404 NO_ENCONTRADO en PUT y en DELETE', () =>
  conEntorno(async ({ db, pedir }) => {
    const real = await pedir('PUT', ruta(idDe(db, 'Alimentación')), { limiteCentavos: 5000000 });
    assert.equal(real.status, 200);

    for (const id of ['abc', '1.5', '-1']) {
      const poner = await pedir('PUT', ruta(id), { limiteCentavos: 5000000 });
      assert.equal(poner.status, 404, `PUT ${id}`);
      assert.equal(poner.cuerpo.error.codigo, 'NO_ENCONTRADO', `PUT ${id}`);

      const quitar = await pedir('DELETE', ruta(id));
      assert.equal(quitar.status, 404, `DELETE ${id}`);
      assert.equal(quitar.cuerpo.error.codigo, 'NO_ENCONTRADO', `DELETE ${id}`);
    }
    assert.equal(filasDe(db).length, 1);
  }));

// Agregado: se informan todos los errores a la vez, igual que en movimientos.
test('T-14.11: con una categoría de ingreso y un límite 0 a la vez, el error informa ambos campos', () =>
  conEntorno(async ({ db, pedir }) => {
    const { status, cuerpo } = await pedir('PUT', ruta(idDe(db, 'Sueldo', 'INGRESO')), { limiteCentavos: 0 });
    assert.equal(status, 400);
    assert.ok(cuerpo.error.campos.categoriaId);
    assert.ok(cuerpo.error.campos.limiteCentavos);
  }));

// Agregado (RN-09): el límite de una categoría desactivada se conserva, y se puede quitar.
test('T-14.12 / RN-09: se puede quitar el límite de una categoría desactivada', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Ocio');
    await pedir('PUT', ruta(id), { limiteCentavos: 2000000 });
    desactivar(db, 'Ocio');

    const { status } = await pedir('DELETE', ruta(id));
    assert.equal(status, 204);
    assert.deepEqual(filasDe(db), []);
  }));

// Agregado: cada categoría tiene su propio límite.
test('T-14.13: definir o quitar el límite de una categoría no toca el de las demás', () =>
  conEntorno(async ({ db, pedir }) => {
    const alimentacion = idDe(db, 'Alimentación');
    const transporte = idDe(db, 'Transporte');
    await pedir('PUT', ruta(alimentacion), { limiteCentavos: 5000000 });
    await pedir('PUT', ruta(transporte), { limiteCentavos: 1000000 });

    await pedir('PUT', ruta(alimentacion), { limiteCentavos: 6000000 });
    assert.deepEqual(
      filasDe(db).map((f) => [f.categoria_id, f.limite_centavos]).sort((a, b) => a[0] - b[0]),
      [
        [alimentacion, 6000000],
        [transporte, 1000000],
      ].sort((a, b) => a[0] - b[0])
    );

    await pedir('DELETE', ruta(alimentacion));
    assert.deepEqual(
      filasDe(db).map((f) => [f.categoria_id, f.limite_centavos]),
      [[transporte, 1000000]]
    );
  }));

// Agregado: primero se busca la categoría y después se valida el cuerpo (igual que en la edición de movimientos).
test('T-14.14: PUT sobre una categoría inexistente con un cuerpo inválido responde 404 (no 400)', () =>
  conEntorno(async ({ db, pedir }) => {
    const real = await pedir('PUT', ruta(idDe(db, 'Alimentación')), { limiteCentavos: 5000000 });
    assert.equal(real.status, 200);

    const { status, cuerpo } = await pedir('PUT', ruta(9999), { limiteCentavos: 0 });
    assert.equal(status, 404);
    assert.equal(cuerpo.error.codigo, 'NO_ENCONTRADO');
  }));

// Agregado (RN-09): desactivar una categoría conserva su presupuesto.
test('T-14.15 / RN-09: desactivar una categoría con límite no elimina el límite', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Ocio');
    const definido = await pedir('PUT', ruta(id), { limiteCentavos: 2000000 });
    assert.equal(definido.status, 200);

    const desactivada = await pedir('PATCH', `/api/categorias/${id}`, { activa: false });
    assert.equal(desactivada.status, 200);

    assert.deepEqual(
      filasDe(db).map((f) => [f.categoria_id, f.limite_centavos]),
      [[id, 2000000]]
    );
  }));