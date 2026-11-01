import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEntorno } from './helpers.js';

// Distinta del reloj fijo de las pruebas (2026-10-30T15:00:00Z): así se nota si se pisa.
const CREADO_EN = '2026-10-01T10:00:00.000Z';

function idDe(db, nombre, tipo = 'GASTO') {
  return db.prepare('SELECT id FROM categorias WHERE nombre = ? AND tipo = ?').get(nombre, tipo).id;
}

function desactivar(db, nombre, tipo = 'GASTO') {
  db.prepare('UPDATE categorias SET activa = 0 WHERE id = ?').run(idDe(db, nombre, tipo));
}

// Inserta directo en la base: así estas pruebas no dependen de la ruta de alta.
function insertarMovimiento(
  db,
  { montoCentavos = 100000, fecha = '2026-10-15', categoria = 'Alimentación', tipo = 'GASTO', descripcion = 'Original' } = {}
) {
  const resultado = db
    .prepare(
      `INSERT INTO movimientos (monto_centavos, fecha, categoria_id, descripcion, creado_en)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(montoCentavos, fecha, idDe(db, categoria, tipo), descripcion, CREADO_EN);
  return Number(resultado.lastInsertRowid);
}

function filaDe(db, id) {
  return db.prepare('SELECT * FROM movimientos WHERE id = ?').get(id);
}

// Cuerpo completo y válido para el PUT; cada prueba pisa solo lo que quiere probar.
function cuerpoValido(db, cambios = {}) {
  return {
    tipo: 'GASTO',
    montoCentavos: 150050,
    fecha: '2026-10-15',
    categoriaId: idDe(db, 'Alimentación'),
    descripcion: 'Nueva',
    ...cambios,
  };
}

test('T-09.1 / CA-03.1: editar monto y descripción responde 200, GET lo refleja y id y creadoEn no cambian', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = insertarMovimiento(db, { montoCentavos: 100000 });

    const { status, cuerpo } = await pedir('PUT', `/api/movimientos/${id}`, cuerpoValido(db));
    assert.equal(status, 200);
    assert.equal(cuerpo.id, id);
    assert.equal(cuerpo.montoCentavos, 150050);
    assert.equal(cuerpo.descripcion, 'Nueva');
    assert.equal(cuerpo.creadoEn, CREADO_EN);

    const leido = await pedir('GET', `/api/movimientos/${id}`);
    assert.equal(leido.status, 200);
    assert.equal(leido.cuerpo.montoCentavos, 150050);
    assert.equal(leido.cuerpo.descripcion, 'Nueva');
    assert.equal(leido.cuerpo.creadoEn, CREADO_EN);
  }));

test('T-09.2 / CA-03.2: cambiar a INGRESO sin cambiar la categoría de gasto da 400 en categoriaId y no cambia nada', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = insertarMovimiento(db);

    const { status, cuerpo } = await pedir('PUT', `/api/movimientos/${id}`, cuerpoValido(db, { tipo: 'INGRESO' }));
    assert.equal(status, 400);
    assert.equal(cuerpo.error.codigo, 'VALIDACION');
    assert.ok(cuerpo.error.campos.categoriaId);

    const fila = filaDe(db, id);
    assert.equal(fila.monto_centavos, 100000);
    assert.equal(fila.descripcion, 'Original');
  }));

test('T-09.3: cambiar a INGRESO con la categoría "Sueldo" responde 200 y el movimiento pasa a ser un ingreso', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = insertarMovimiento(db);

    const { status, cuerpo } = await pedir(
      'PUT',
      `/api/movimientos/${id}`,
      cuerpoValido(db, { tipo: 'INGRESO', categoriaId: idDe(db, 'Sueldo', 'INGRESO') })
    );
    assert.equal(status, 200);
    assert.equal(cuerpo.tipo, 'INGRESO');
    assert.equal(cuerpo.categoriaNombre, 'Sueldo');
    assert.equal(filaDe(db, id).categoria_id, idDe(db, 'Sueldo', 'INGRESO'));
  }));

test('T-09.4 / CA-03.3, CB-18: con la categoría desactivada, se puede editar manteniéndola', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = insertarMovimiento(db);
    desactivar(db, 'Alimentación');

    const { status, cuerpo } = await pedir('PUT', `/api/movimientos/${id}`, cuerpoValido(db, { montoCentavos: 200000 }));
    assert.equal(status, 200);
    assert.equal(cuerpo.montoCentavos, 200000);
    assert.equal(cuerpo.categoriaNombre, 'Alimentación');
    assert.equal(cuerpo.categoriaActiva, false);
  }));

test('T-09.5 / CB-18: con la categoría desactivada, cambiarla a otra desactivada da 400 y a una activa del mismo tipo da 200', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = insertarMovimiento(db);
    desactivar(db, 'Alimentación');
    desactivar(db, 'Ocio');

    const aInactiva = await pedir('PUT', `/api/movimientos/${id}`, cuerpoValido(db, { categoriaId: idDe(db, 'Ocio') }));
    assert.equal(aInactiva.status, 400);
    assert.ok(aInactiva.cuerpo.error.campos.categoriaId);
    assert.equal(filaDe(db, id).categoria_id, idDe(db, 'Alimentación'));

    const aActiva = await pedir('PUT', `/api/movimientos/${id}`, cuerpoValido(db, { categoriaId: idDe(db, 'Transporte') }));
    assert.equal(aActiva.status, 200);
    assert.equal(aActiva.cuerpo.categoriaNombre, 'Transporte');
    assert.equal(aActiva.cuerpo.categoriaActiva, true);
  }));

test('T-09.6 / CA-03.4: editar o leer un movimiento inexistente responde 404 NO_ENCONTRADO', () =>
  conEntorno(async ({ db, pedir }) => {
    // Precondición: la ruta existe y funciona con un movimiento real.
    const real = await pedir('PUT', `/api/movimientos/${insertarMovimiento(db)}`, cuerpoValido(db));
    assert.equal(real.status, 200);

    const editar = await pedir('PUT', '/api/movimientos/9999', cuerpoValido(db));
    assert.equal(editar.status, 404);
    assert.equal(editar.cuerpo.error.codigo, 'NO_ENCONTRADO');

    const leer = await pedir('GET', '/api/movimientos/9999');
    assert.equal(leer.status, 404);
    assert.equal(leer.cuerpo.error.codigo, 'NO_ENCONTRADO');
  }));

test('T-09.7 / CA-03.5: con monto 0 o fecha futura responde 400 y el movimiento no cambia', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = insertarMovimiento(db);

    const monto = await pedir('PUT', `/api/movimientos/${id}`, cuerpoValido(db, { montoCentavos: 0 }));
    assert.equal(monto.status, 400);
    assert.ok(monto.cuerpo.error.campos.montoCentavos);

    const fecha = await pedir('PUT', `/api/movimientos/${id}`, cuerpoValido(db, { fecha: '2026-10-31' }));
    assert.equal(fecha.status, 400);
    assert.ok(fecha.cuerpo.error.campos.fecha);

    const fila = filaDe(db, id);
    assert.equal(fila.monto_centavos, 100000);
    assert.equal(fila.fecha, '2026-10-15');
    assert.equal(fila.descripcion, 'Original');
  }));

test('T-09.8: un id que no es número responde 404 NO_ENCONTRADO en GET y en PUT', () =>
  conEntorno(async ({ db, pedir }) => {
    const real = await pedir('GET', `/api/movimientos/${insertarMovimiento(db)}`);
    assert.equal(real.status, 200);

    for (const ruta of ['/api/movimientos/abc', '/api/movimientos/1.5', '/api/movimientos/-1']) {
      const leer = await pedir('GET', ruta);
      assert.equal(leer.status, 404, `GET ${ruta}`);
      assert.equal(leer.cuerpo.error.codigo, 'NO_ENCONTRADO', `GET ${ruta}`);

      const editar = await pedir('PUT', ruta, cuerpoValido(db));
      assert.equal(editar.status, 404, `PUT ${ruta}`);
      assert.equal(editar.cuerpo.error.codigo, 'NO_ENCONTRADO', `PUT ${ruta}`);
    }
  }));

// Agregado: GET devuelve el movimiento con todos sus campos.
test('T-09.9: GET /api/movimientos/:id devuelve el movimiento completo', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = insertarMovimiento(db);

    const { status, cuerpo } = await pedir('GET', `/api/movimientos/${id}`);
    assert.equal(status, 200);
    assert.deepEqual(cuerpo, {
      id,
      tipo: 'GASTO',
      montoCentavos: 100000,
      fecha: '2026-10-15',
      categoriaId: idDe(db, 'Alimentación'),
      categoriaNombre: 'Alimentación',
      categoriaActiva: true,
      descripcion: 'Original',
      creadoEn: CREADO_EN,
    });
  }));

// Agregado: se informan todos los errores a la vez, igual que en el alta.
test('T-09.10: con monto 0, fecha futura y descripción de 141 caracteres, el error informa los tres campos', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = insertarMovimiento(db);

    const { status, cuerpo } = await pedir(
      'PUT',
      `/api/movimientos/${id}`,
      cuerpoValido(db, { montoCentavos: 0, fecha: '2026-12-31', descripcion: 'A'.repeat(141) })
    );
    assert.equal(status, 400);
    assert.ok(cuerpo.error.campos.montoCentavos);
    assert.ok(cuerpo.error.campos.fecha);
    assert.ok(cuerpo.error.campos.descripcion);
  }));

// Agregado: primero se busca el movimiento y después se valida el cuerpo.
test('T-09.11: editar un movimiento inexistente con un cuerpo inválido responde 404 (no 400)', () =>
  conEntorno(async ({ db, pedir }) => {
    const real = await pedir('PUT', `/api/movimientos/${insertarMovimiento(db)}`, cuerpoValido(db));
    assert.equal(real.status, 200);

    const { status, cuerpo } = await pedir('PUT', '/api/movimientos/9999', cuerpoValido(db, { montoCentavos: 0 }));
    assert.equal(status, 404);
    assert.equal(cuerpo.error.codigo, 'NO_ENCONTRADO');
  }));

// Agregado: el PUT reemplaza los datos, así que una descripción ausente o vacía la borra.
test('T-09.12 / RN-05: una descripción vacía, de espacios o ausente deja la descripción en null', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = insertarMovimiento(db, { descripcion: 'Original' });

    const vacia = await pedir('PUT', `/api/movimientos/${id}`, cuerpoValido(db, { descripcion: '   ' }));
    assert.equal(vacia.status, 200);
    assert.equal(vacia.cuerpo.descripcion, null);

    await pedir('PUT', `/api/movimientos/${id}`, cuerpoValido(db, { descripcion: 'De nuevo' }));
    const ausente = cuerpoValido(db);
    delete ausente.descripcion;
    const sinCampo = await pedir('PUT', `/api/movimientos/${id}`, ausente);
    assert.equal(sinCampo.status, 200);
    assert.equal(sinCampo.cuerpo.descripcion, null);
  }));

// Agregado: editar uno no toca a los demás.
test('T-09.13: editar un movimiento no modifica a los otros', () =>
  conEntorno(async ({ db, pedir }) => {
    const editado = insertarMovimiento(db);
    const otro = insertarMovimiento(db, { montoCentavos: 777700, descripcion: 'Otro' });

    const { status } = await pedir('PUT', `/api/movimientos/${editado}`, cuerpoValido(db));
    assert.equal(status, 200);

    const fila = filaDe(db, otro);
    assert.equal(fila.monto_centavos, 777700);
    assert.equal(fila.descripcion, 'Otro');
  }));

// Agregado: el PUT exige el cuerpo completo; sin tipo no hay forma de validar la categoría.
test('T-09.14 / RN-01: un PUT sin tipo da 400 en tipo', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = insertarMovimiento(db);
    const sinTipo = cuerpoValido(db);
    delete sinTipo.tipo;

    const { status, cuerpo } = await pedir('PUT', `/api/movimientos/${id}`, sinTipo);
    assert.equal(status, 400);
    assert.ok(cuerpo.error.campos.tipo);
    assert.equal(filaDe(db, id).monto_centavos, 100000);
  }));