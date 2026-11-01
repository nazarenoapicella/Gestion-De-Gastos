import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEntorno } from './helpers.js';

const CREADO_EN = '2026-10-01T10:00:00.000Z';

function idDe(db, nombre, tipo = 'GASTO') {
  return db.prepare('SELECT id FROM categorias WHERE nombre = ? AND tipo = ?').get(nombre, tipo).id;
}

// Inserta directo en la base: permite cualquier fecha y no depende de las rutas de alta.
function insertarMovimiento(db, { fecha, categoria, tipo = 'GASTO', montoCentavos }) {
  const resultado = db
    .prepare(
      `INSERT INTO movimientos (monto_centavos, fecha, categoria_id, descripcion, creado_en)
       VALUES (?, ?, ?, NULL, ?)`
    )
    .run(montoCentavos, fecha, idDe(db, categoria, tipo), CREADO_EN);
  return Number(resultado.lastInsertRowid);
}

// Datos de la spec (CA-05.1 y CA-05.3):
//  2026-09: ingreso de $ 100.000,00                    (10000000)
//  2026-10: ingreso de $ 500.000,00                    (50000000)
//           gastos por $ 120.000,50 en total           (7000000 + 5000050)
function cargarDatosBase(db) {
  insertarMovimiento(db, { fecha: '2026-09-05', categoria: 'Sueldo', tipo: 'INGRESO', montoCentavos: 10000000 });
  insertarMovimiento(db, { fecha: '2026-10-05', categoria: 'Sueldo', tipo: 'INGRESO', montoCentavos: 50000000 });
  const gastoAlimentacion = insertarMovimiento(db, {
    fecha: '2026-10-10',
    categoria: 'Alimentación',
    montoCentavos: 7000000,
  });
  insertarMovimiento(db, { fecha: '2026-10-12', categoria: 'Transporte', montoCentavos: 5000050 });
  return { gastoAlimentacion };
}

test('T-12.1 / CA-05.1: en 2026-10 los ingresos son 50000000, los gastos 12000050 y el balance del mes 37999950', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);

    const { status, cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.equal(status, 200);
    assert.equal(cuerpo.mes, '2026-10');
    assert.equal(cuerpo.ingresosCentavos, 50000000);
    assert.equal(cuerpo.gastosCentavos, 12000050);
    assert.equal(cuerpo.balanceMesCentavos, 37999950);

    // porCategoria existe (lo completa T-13); no se compara el contenido para no atar esta tarea a la siguiente
    assert.ok(Array.isArray(cuerpo.porCategoria.GASTO));
    assert.ok(Array.isArray(cuerpo.porCategoria.INGRESO));
  }));

test('T-12.2 / CA-05.3: el balance acumulado de 2026-10 es 47999950 (incluye septiembre)', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);

    const { status, cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.equal(status, 200);
    assert.equal(cuerpo.balanceAcumuladoCentavos, 47999950);
  }));

test('T-12.3 / CA-05.2: con un gasto de 90000000 más, el balance del mes es -52000050 y el acumulado -42000050', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);
    insertarMovimiento(db, { fecha: '2026-10-20', categoria: 'Vivienda', montoCentavos: 90000000 });

    const { status, cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.equal(status, 200);
    assert.equal(cuerpo.gastosCentavos, 102000050);
    assert.equal(cuerpo.balanceMesCentavos, -52000050);
    assert.equal(cuerpo.balanceAcumuladoCentavos, -42000050);
  }));

test('T-12.4 / CA-05.4, CB-21: un mes sin movimientos y sin nada anterior (2026-08) devuelve todo en 0', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db); // todo es de septiembre o posterior

    const { status, cuerpo } = await pedir('GET', '/api/resumen?mes=2026-08');
    assert.equal(status, 200);
    assert.equal(cuerpo.mes, '2026-08');
    assert.equal(cuerpo.ingresosCentavos, 0);
    assert.equal(cuerpo.gastosCentavos, 0);
    assert.equal(cuerpo.balanceMesCentavos, 0);
    assert.equal(cuerpo.balanceAcumuladoCentavos, 0);
  }));

test('T-12.5 / CB-23: un mes futuro (2026-12) tiene el mes en 0 pero conserva el acumulado anterior', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);

    const { status, cuerpo } = await pedir('GET', '/api/resumen?mes=2026-12');
    assert.equal(status, 200);
    assert.equal(cuerpo.ingresosCentavos, 0);
    assert.equal(cuerpo.gastosCentavos, 0);
    assert.equal(cuerpo.balanceMesCentavos, 0);
    assert.equal(cuerpo.balanceAcumuladoCentavos, 47999950);
  }));

test('T-12.6 / CB-12: un gasto del 2026-10-31 cuenta en octubre y no en noviembre; uno del 2026-11-01 al revés', () =>
  conEntorno(async ({ db, pedir }) => {
    insertarMovimiento(db, { fecha: '2026-10-31', categoria: 'Alimentación', montoCentavos: 5000 });
    insertarMovimiento(db, { fecha: '2026-11-01', categoria: 'Alimentación', montoCentavos: 7000 });

    const octubre = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.equal(octubre.cuerpo.gastosCentavos, 5000);
    assert.equal(octubre.cuerpo.balanceAcumuladoCentavos, -5000);

    const noviembre = await pedir('GET', '/api/resumen?mes=2026-11');
    assert.equal(noviembre.cuerpo.gastosCentavos, 7000);
    assert.equal(noviembre.cuerpo.balanceAcumuladoCentavos, -12000);

    const septiembre = await pedir('GET', '/api/resumen?mes=2026-09');
    assert.equal(septiembre.cuerpo.gastosCentavos, 0);
    assert.equal(septiembre.cuerpo.balanceAcumuladoCentavos, 0);
  }));

test('T-12.7 / CA-05.5, CB-22: un mes mal formado da 400 MES_INVALIDO y sin mes da 400 MES_REQUERIDO', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);

    // Precondición: la ruta existe y funciona con un mes válido.
    const valido = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.equal(valido.status, 200);

    for (const mes of ['2026-13', '2026-00', '2026-1', '26-10', '']) {
      const { status, cuerpo } = await pedir('GET', `/api/resumen?mes=${mes}`);
      assert.equal(status, 400, `mes="${mes}"`);
      assert.equal(cuerpo.error.codigo, 'MES_INVALIDO', `mes="${mes}"`);
    }

    const sinMes = await pedir('GET', '/api/resumen');
    assert.equal(sinMes.status, 400);
    assert.equal(sinMes.cuerpo.error.codigo, 'MES_REQUERIDO');
    assert.ok(sinMes.cuerpo.error.campos.mes);
  }));

test('T-12.8 / RN-09: los movimientos de categorías desactivadas cuentan en los totales', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);
    db.prepare('UPDATE categorias SET activa = 0 WHERE id IN (?, ?)').run(
      idDe(db, 'Alimentación'),
      idDe(db, 'Sueldo', 'INGRESO')
    );

    const { status, cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.equal(status, 200);
    assert.equal(cuerpo.ingresosCentavos, 50000000);
    assert.equal(cuerpo.gastosCentavos, 12000050);
    assert.equal(cuerpo.balanceMesCentavos, 37999950);
    assert.equal(cuerpo.balanceAcumuladoCentavos, 47999950);
  }));

// Agregado: septiembre solo tiene su ingreso, y el acumulado no mira hacia adelante.
test('T-12.9: en 2026-09 el balance del mes y el acumulado coinciden (10000000) y no incluyen octubre', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);

    const { status, cuerpo } = await pedir('GET', '/api/resumen?mes=2026-09');
    assert.equal(status, 200);
    assert.equal(cuerpo.ingresosCentavos, 10000000);
    assert.equal(cuerpo.gastosCentavos, 0);
    assert.equal(cuerpo.balanceMesCentavos, 10000000);
    assert.equal(cuerpo.balanceAcumuladoCentavos, 10000000);
  }));

// Agregado: un parámetro repetido llega como lista y no es un mes válido.
test('T-12.10: un mes repetido (?mes=...&mes=...) da 400 MES_INVALIDO', () =>
  conEntorno(async ({ pedir }) => {
    const { status, cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10&mes=2026-09');
    assert.equal(status, 400);
    assert.equal(cuerpo.error.codigo, 'MES_INVALIDO');
  }));

// Agregado (CA-04.1 / T-10): un movimiento eliminado deja de contarse en los totales.
test('T-12.11 / CA-04.1: al eliminar un movimiento, los totales y balances dejan de contarlo', () =>
  conEntorno(async ({ db, pedir }) => {
    const { gastoAlimentacion } = cargarDatosBase(db);

    const eliminado = await pedir('DELETE', `/api/movimientos/${gastoAlimentacion}`);
    assert.equal(eliminado.status, 204);

    const { cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.equal(cuerpo.gastosCentavos, 5000050);
    assert.equal(cuerpo.balanceMesCentavos, 44999950);
    assert.equal(cuerpo.balanceAcumuladoCentavos, 54999950);
  }));