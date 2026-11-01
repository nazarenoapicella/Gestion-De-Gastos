import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEntorno } from './helpers.js';

function idDe(db, nombre, tipo = 'GASTO') {
  return db.prepare('SELECT id FROM categorias WHERE nombre = ? AND tipo = ?').get(nombre, tipo).id;
}

function contarMovimientos(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM movimientos').get().n;
}

// Cuerpo válido de base; cada prueba pisa solo lo que quiere probar.
function cuerpoValido(db, cambios = {}) {
  return {
    tipo: 'GASTO',
    montoCentavos: 123456,
    fecha: '2026-10-29',
    categoriaId: idDe(db, 'Alimentación'),
    descripcion: 'Supermercado',
    ...cambios,
  };
}

test('T-08.1 / CA-01.1: crea un GASTO de $ 1.234,56 y responde 201 con el movimiento completo', () =>
  conEntorno(async ({ db, pedir }) => {
    const categoriaId = idDe(db, 'Alimentación');
    const { status, cuerpo } = await pedir('POST', '/api/movimientos', cuerpoValido(db));

    assert.equal(status, 201);
    assert.ok(Number.isInteger(cuerpo.id));
    assert.equal(cuerpo.tipo, 'GASTO');
    assert.equal(cuerpo.montoCentavos, 123456);
    assert.equal(cuerpo.fecha, '2026-10-29');
    assert.equal(cuerpo.categoriaId, categoriaId);
    assert.equal(cuerpo.categoriaNombre, 'Alimentación');
    assert.equal(cuerpo.categoriaActiva, true);
    assert.equal(cuerpo.descripcion, 'Supermercado');
    assert.equal(cuerpo.creadoEn, '2026-10-30T15:00:00.000Z'); // reloj fijo, en UTC

    const fila = db.prepare('SELECT * FROM movimientos WHERE id = ?').get(cuerpo.id);
    assert.equal(fila.monto_centavos, 123456);
    assert.equal(fila.fecha, '2026-10-29');
    assert.equal(fila.categoria_id, categoriaId);
    assert.equal(fila.descripcion, 'Supermercado');
    assert.equal(fila.creado_en, '2026-10-30T15:00:00.000Z');
  }));

test('T-08.2 / CA-01.2, RN-05: la descripción ausente, vacía o con espacios se guarda sin espacios sobrantes', () =>
  conEntorno(async ({ db, pedir }) => {
    const sinDescripcion = cuerpoValido(db);
    delete sinDescripcion.descripcion;

    const casos = [
      [sinDescripcion, null],
      [cuerpoValido(db, { descripcion: null }), null],
      [cuerpoValido(db, { descripcion: '' }), null],
      [cuerpoValido(db, { descripcion: '   ' }), null],
      [cuerpoValido(db, { descripcion: '  Café  ' }), 'Café'],
      // solo se recortan los extremos: los espacios del medio se conservan
      [cuerpoValido(db, { descripcion: '  Pan   lactal ' }), 'Pan   lactal'],
    ];

    for (const [enviado, esperada] of casos) {
      const { status, cuerpo } = await pedir('POST', '/api/movimientos', enviado);
      assert.equal(status, 201, JSON.stringify(enviado));
      assert.equal(cuerpo.descripcion, esperada, JSON.stringify(enviado));
    }
  }));

test('T-08.3 / CA-01.3, CB-01: un monto 0, negativo, con decimales o de texto da 400 y no crea nada', () =>
  conEntorno(async ({ db, pedir }) => {
    for (const monto of [0, -100, 12.5, '500']) {
      const { status, cuerpo } = await pedir(
        'POST',
        '/api/movimientos',
        cuerpoValido(db, { montoCentavos: monto })
      );
      assert.equal(status, 400, `monto ${JSON.stringify(monto)}`);
      assert.equal(cuerpo.error.codigo, 'VALIDACION');
      assert.ok(cuerpo.error.campos.montoCentavos, `monto ${JSON.stringify(monto)}`);
    }
    assert.equal(contarMovimientos(db), 0);
  }));

test('T-08.4 / CB-02, CB-03, CB-04: 1 y 99999999999 se aceptan; 100000000000 se rechaza', () =>
  conEntorno(async ({ db, pedir }) => {
    const minimo = await pedir('POST', '/api/movimientos', cuerpoValido(db, { montoCentavos: 1 }));
    assert.equal(minimo.status, 201);

    const maximo = await pedir('POST', '/api/movimientos', cuerpoValido(db, { montoCentavos: 99999999999 }));
    assert.equal(maximo.status, 201);

    const pasado = await pedir('POST', '/api/movimientos', cuerpoValido(db, { montoCentavos: 100000000000 }));
    assert.equal(pasado.status, 400);
    assert.ok(pasado.cuerpo.error.campos.montoCentavos);

    assert.equal(contarMovimientos(db), 2);
  }));

test('T-08.5 / CB-06, CB-07, CA-01.4: la fecha de hoy se acepta y la de mañana se rechaza', () =>
  conEntorno(async ({ db, pedir }) => {
    const hoy = await pedir('POST', '/api/movimientos', cuerpoValido(db, { fecha: '2026-10-30' }));
    assert.equal(hoy.status, 201);

    const manana = await pedir('POST', '/api/movimientos', cuerpoValido(db, { fecha: '2026-10-31' }));
    assert.equal(manana.status, 400);
    assert.equal(manana.cuerpo.error.codigo, 'VALIDACION');
    assert.ok(manana.cuerpo.error.campos.fecha);
  }));

test('T-08.6 / CB-08, CB-09, CB-10: respeta bisiestos y el rango desde 2000-01-01', () =>
  conEntorno(async ({ db, pedir }) => {
    const casos = [
      ['2026-02-29', 400], // 2026 no es bisiesto
      ['2024-02-29', 201],
      ['1999-12-31', 400], // anterior al mínimo
      ['2000-01-01', 201],
    ];
    for (const [fecha, esperado] of casos) {
      const { status, cuerpo } = await pedir('POST', '/api/movimientos', cuerpoValido(db, { fecha }));
      assert.equal(status, esperado, fecha);
      if (esperado === 400) assert.ok(cuerpo.error.campos.fecha, fecha);
    }
  }));

test('T-08.7 / CB-11: a las 22:30 del 30/10 en Argentina (01:30 UTC del 31/10) "hoy" sigue siendo el 30', () =>
  conEntorno(
    async ({ db, pedir }) => {
      const del31 = await pedir('POST', '/api/movimientos', cuerpoValido(db, { fecha: '2026-10-31' }));
      assert.equal(del31.status, 400);
      assert.ok(del31.cuerpo.error.campos.fecha);

      const del30 = await pedir('POST', '/api/movimientos', cuerpoValido(db, { fecha: '2026-10-30' }));
      assert.equal(del30.status, 201);
      // creadoEn queda en UTC: ahí sí es el 31
      assert.equal(del30.cuerpo.creadoEn, '2026-10-31T01:30:00.000Z');
    },
    { reloj: () => new Date('2026-10-31T01:30:00Z') }
  ));

test('T-08.8 / CA-01.5: un GASTO con la categoría "Sueldo" (INGRESO) da 400 en categoriaId', () =>
  conEntorno(async ({ db, pedir }) => {
    const { status, cuerpo } = await pedir(
      'POST',
      '/api/movimientos',
      cuerpoValido(db, { tipo: 'GASTO', categoriaId: idDe(db, 'Sueldo', 'INGRESO') })
    );
    assert.equal(status, 400);
    assert.equal(cuerpo.error.codigo, 'VALIDACION');
    assert.ok(cuerpo.error.campos.categoriaId);
    assert.equal(contarMovimientos(db), 0);
  }));

test('T-08.9 / CA-01.6: una categoría desactivada o inexistente da 400 en categoriaId', () =>
  conEntorno(async ({ db, pedir }) => {
    const ocio = idDe(db, 'Ocio');
    db.prepare('UPDATE categorias SET activa = 0 WHERE id = ?').run(ocio);

    const desactivada = await pedir('POST', '/api/movimientos', cuerpoValido(db, { categoriaId: ocio }));
    assert.equal(desactivada.status, 400);
    assert.ok(desactivada.cuerpo.error.campos.categoriaId);

    const inexistente = await pedir('POST', '/api/movimientos', cuerpoValido(db, { categoriaId: 9999 }));
    assert.equal(inexistente.status, 400);
    assert.ok(inexistente.cuerpo.error.campos.categoriaId);

    assert.equal(contarMovimientos(db), 0);
  }));

test('T-08.10 / CB-13, CA-01.7: una descripción de 140 caracteres se acepta y una de 141 se rechaza', () =>
  conEntorno(async ({ db, pedir }) => {
    const justa = await pedir('POST', '/api/movimientos', cuerpoValido(db, { descripcion: 'A'.repeat(140) }));
    assert.equal(justa.status, 201);

    const larga = await pedir('POST', '/api/movimientos', cuerpoValido(db, { descripcion: 'A'.repeat(141) }));
    assert.equal(larga.status, 400);
    assert.ok(larga.cuerpo.error.campos.descripcion);
  }));

test('T-08.11 / RN-01: un tipo inválido, en minúsculas o ausente da 400 en tipo', () =>
  conEntorno(async ({ db, pedir }) => {
    const sinTipo = cuerpoValido(db);
    delete sinTipo.tipo;

    for (const enviado of [cuerpoValido(db, { tipo: 'OTRO' }), cuerpoValido(db, { tipo: 'gasto' }), sinTipo]) {
      const { status, cuerpo } = await pedir('POST', '/api/movimientos', enviado);
      assert.equal(status, 400, JSON.stringify(enviado));
      assert.equal(cuerpo.error.codigo, 'VALIDACION');
      assert.ok(cuerpo.error.campos.tipo, JSON.stringify(enviado));
    }
  }));

test('T-08.12: con monto 0 y fecha futura a la vez, el error informa ambos campos', () =>
  conEntorno(async ({ db, pedir }) => {
    const { status, cuerpo } = await pedir(
      'POST',
      '/api/movimientos',
      cuerpoValido(db, { montoCentavos: 0, fecha: '2026-12-31' })
    );
    assert.equal(status, 400);
    assert.ok(cuerpo.error.campos.montoCentavos);
    assert.ok(cuerpo.error.campos.fecha);
    assert.equal(contarMovimientos(db), 0);
  }));

// Agregado (RN-01): el otro tipo también se puede registrar.
test('T-08.13: un INGRESO con la categoría "Sueldo" responde 201', () =>
  conEntorno(async ({ db, pedir }) => {
    const { status, cuerpo } = await pedir(
      'POST',
      '/api/movimientos',
      cuerpoValido(db, {
        tipo: 'INGRESO',
        montoCentavos: 50000000,
        fecha: '2026-10-05',
        categoriaId: idDe(db, 'Sueldo', 'INGRESO'),
        descripcion: 'Sueldo de octubre',
      })
    );
    assert.equal(status, 201);
    assert.equal(cuerpo.tipo, 'INGRESO');
    assert.equal(cuerpo.categoriaNombre, 'Sueldo');
    assert.equal(cuerpo.montoCentavos, 50000000);
  }));

// Agregado: el id de la categoría tiene que ser un número entero.
test('T-08.14: una categoriaId ausente, nula, de texto o con decimales da 400 en categoriaId', () =>
  conEntorno(async ({ db, pedir }) => {
    const sinCategoria = cuerpoValido(db);
    delete sinCategoria.categoriaId;

    const casos = [
      sinCategoria,
      cuerpoValido(db, { categoriaId: null }),
      cuerpoValido(db, { categoriaId: String(idDe(db, 'Alimentación')) }),
      cuerpoValido(db, { categoriaId: 1.5 }),
    ];
    for (const enviado of casos) {
      const { status, cuerpo } = await pedir('POST', '/api/movimientos', enviado);
      assert.equal(status, 400, JSON.stringify(enviado));
      assert.ok(cuerpo.error.campos.categoriaId, JSON.stringify(enviado));
    }
    assert.equal(contarMovimientos(db), 0);
  }));

// Agregado: la descripción, si viene, tiene que ser texto.
test('T-08.15: una descripción que no es texto (número, objeto) da 400 en descripcion', () =>
  conEntorno(async ({ db, pedir }) => {
    for (const descripcion of [123, { a: 1 }, true]) {
      const { status, cuerpo } = await pedir('POST', '/api/movimientos', cuerpoValido(db, { descripcion }));
      assert.equal(status, 400, JSON.stringify(descripcion));
      assert.ok(cuerpo.error.campos.descripcion, JSON.stringify(descripcion));
    }
  }));

// Agregado: el largo se cuenta en caracteres (igual que el CHECK de SQLite), no en unidades UTF-16.
test('T-08.16: una descripción de 140 emojis se acepta (cuentan como 140 caracteres)', () =>
  conEntorno(async ({ db, pedir }) => {
    const { status, cuerpo } = await pedir(
      'POST',
      '/api/movimientos',
      cuerpoValido(db, { descripcion: '😀'.repeat(140) })
    );
    assert.equal(status, 201);
    assert.equal(Array.from(cuerpo.descripcion).length, 140);
  }));