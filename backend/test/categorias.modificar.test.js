import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEntorno } from './helpers.js';

function idDe(db, nombre, tipo = 'GASTO') {
  return db.prepare('SELECT id FROM categorias WHERE nombre = ? AND tipo = ?').get(nombre, tipo).id;
}

function filaDe(db, id) {
  return db.prepare('SELECT nombre, tipo, activa FROM categorias WHERE id = ?').get(id);
}

test('T-06.1 / CA-07.5: renombrar "Ocio" a "Entretenimiento" responde 200 y la lista lo refleja', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Ocio');
    const { status, cuerpo } = await pedir('PATCH', `/api/categorias/${id}`, { nombre: 'Entretenimiento' });
    assert.equal(status, 200);
    assert.equal(cuerpo.id, id);
    assert.equal(cuerpo.nombre, 'Entretenimiento');

    const lista = await pedir('GET', '/api/categorias?tipo=GASTO');
    const nombres = lista.cuerpo.map((c) => c.nombre);
    assert.ok(nombres.includes('Entretenimiento'));
    assert.ok(!nombres.includes('Ocio'));
  }));

test('T-06.2: renombrar "Ocio" a "Transporte" (ya existe) responde 409 NOMBRE_DUPLICADO y no cambia nada', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Ocio');
    const { status, cuerpo } = await pedir('PATCH', `/api/categorias/${id}`, { nombre: 'Transporte' });
    assert.equal(status, 409);
    assert.equal(cuerpo.error.codigo, 'NOMBRE_DUPLICADO');
    assert.ok(cuerpo.error.campos.nombre);
    assert.equal(filaDe(db, id).nombre, 'Ocio');
  }));

test('T-06.3: renombrar "Ocio" a "OCIO" responde 200 (es la misma categoría, no un duplicado)', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Ocio');
    const { status, cuerpo } = await pedir('PATCH', `/api/categorias/${id}`, { nombre: 'OCIO' });
    assert.equal(status, 200);
    assert.equal(cuerpo.nombre, 'OCIO');
  }));

test('T-06.4 / CA-07.6: desactivar "Ocio" responde 200 y reactivarla la deja activa de nuevo', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Ocio');

    const desactivada = await pedir('PATCH', `/api/categorias/${id}`, { activa: false });
    assert.equal(desactivada.status, 200);
    assert.equal(desactivada.cuerpo.activa, false);
    assert.equal(filaDe(db, id).activa, 0);

    const reactivada = await pedir('PATCH', `/api/categorias/${id}`, { activa: true });
    assert.equal(reactivada.status, 200);
    assert.equal(reactivada.cuerpo.activa, true);
    assert.equal(filaDe(db, id).activa, 1);
  }));

test('T-06.5 / CA-07.7: "Otros gastos" no se puede renombrar ni desactivar (409 CATEGORIA_PROTEGIDA)', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Otros gastos');

    const renombrar = await pedir('PATCH', `/api/categorias/${id}`, { nombre: 'Varios' });
    assert.equal(renombrar.status, 409);
    assert.equal(renombrar.cuerpo.error.codigo, 'CATEGORIA_PROTEGIDA');

    const desactivar = await pedir('PATCH', `/api/categorias/${id}`, { activa: false });
    assert.equal(desactivar.status, 409);
    assert.equal(desactivar.cuerpo.error.codigo, 'CATEGORIA_PROTEGIDA');

    const fila = filaDe(db, id);
    assert.equal(fila.nombre, 'Otros gastos');
    assert.equal(fila.activa, 1);
  }));

test('T-06.6 / CA-07.7: "Otros ingresos" no se puede desactivar (409 CATEGORIA_PROTEGIDA)', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Otros ingresos', 'INGRESO');
    const { status, cuerpo } = await pedir('PATCH', `/api/categorias/${id}`, { activa: false });
    assert.equal(status, 409);
    assert.equal(cuerpo.error.codigo, 'CATEGORIA_PROTEGIDA');
    assert.equal(filaDe(db, id).activa, 1);
  }));

test('T-06.7: una categoría inexistente o un id que no es número responde 404 NO_ENCONTRADO', () =>
  conEntorno(async ({ db, pedir }) => {
    // Precondición: la ruta existe y funciona con una categoría real.
    const real = await pedir('PATCH', `/api/categorias/${idDe(db, 'Salud')}`, { nombre: 'Salud y bienestar' });
    assert.equal(real.status, 200);

    const inexistente = await pedir('PATCH', '/api/categorias/9999', { nombre: 'Fantasma' });
    assert.equal(inexistente.status, 404);
    assert.equal(inexistente.cuerpo.error.codigo, 'NO_ENCONTRADO');

    const noNumerico = await pedir('PATCH', '/api/categorias/abc', { nombre: 'Fantasma' });
    assert.equal(noNumerico.status, 404);
    assert.equal(noNumerico.cuerpo.error.codigo, 'NO_ENCONTRADO');
  }));

test('T-06.8: un cuerpo vacío o con el tipo da 400 (el tipo no se modifica)', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Ocio');

    const vacio = await pedir('PATCH', `/api/categorias/${id}`, {});
    assert.equal(vacio.status, 400);
    assert.equal(vacio.cuerpo.error.codigo, 'VALIDACION');

    const conTipo = await pedir('PATCH', `/api/categorias/${id}`, { tipo: 'INGRESO' });
    assert.equal(conTipo.status, 400);
    assert.equal(conTipo.cuerpo.error.codigo, 'VALIDACION');
    assert.ok(conTipo.cuerpo.error.campos.tipo);

    assert.equal(filaDe(db, id).tipo, 'GASTO');
  }));

test('T-06.9: un nombre vacío o de 31 caracteres, o un activa que no es booleano, da 400 con el campo', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Ocio');

    const vacio = await pedir('PATCH', `/api/categorias/${id}`, { nombre: '' });
    assert.equal(vacio.status, 400);
    assert.ok(vacio.cuerpo.error.campos.nombre);

    const largo = await pedir('PATCH', `/api/categorias/${id}`, { nombre: 'A'.repeat(31) });
    assert.equal(largo.status, 400);
    assert.ok(largo.cuerpo.error.campos.nombre);

    const activa = await pedir('PATCH', `/api/categorias/${id}`, { activa: 'si' });
    assert.equal(activa.status, 400);
    assert.ok(activa.cuerpo.error.campos.activa);

    assert.equal(filaDe(db, id).nombre, 'Ocio');
  }));

// Agregado: nombre y activa pueden llegar juntos; se aplican los dos y se limpian los espacios.
test('T-06.10: se puede renombrar y desactivar a la vez, y el nombre se guarda sin espacios sobrantes', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Ocio');
    const { status, cuerpo } = await pedir('PATCH', `/api/categorias/${id}`, {
      nombre: '  Cine   y  teatro ',
      activa: false,
    });
    assert.equal(status, 200);
    assert.equal(cuerpo.nombre, 'Cine y teatro');
    assert.equal(cuerpo.activa, false);
  }));

// Agregado (RN-06 / CB-15): la unicidad es por tipo, también al renombrar.
test('T-06.11: renombrar a un nombre que existe solo en el otro tipo está permitido', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Ocio'); // GASTO; "Sueldo" existe solo como INGRESO
    const { status, cuerpo } = await pedir('PATCH', `/api/categorias/${id}`, { nombre: 'Sueldo' });
    assert.equal(status, 200);
    assert.equal(cuerpo.nombre, 'Sueldo');
    assert.equal(cuerpo.tipo, 'GASTO');
  }));

// Agregado: las protegidas ya están activas, así que "activarlas" no cambia nada y no es un error.
test('T-06.12: mandar activa:true a una categoría protegida responde 200 sin cambios', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Otros gastos');
    const { status, cuerpo } = await pedir('PATCH', `/api/categorias/${id}`, { activa: true });
    assert.equal(status, 200);
    assert.equal(cuerpo.nombre, 'Otros gastos');
    assert.equal(cuerpo.activa, true);
    assert.equal(cuerpo.protegida, true);
  }));