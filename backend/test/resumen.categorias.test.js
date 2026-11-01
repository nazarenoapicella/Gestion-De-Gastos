import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEntorno } from './helpers.js';
import { normalizarNombre } from '../src/utils/texto.js';

const CREADO_EN = '2026-10-01T10:00:00.000Z';

function idDe(db, nombre, tipo = 'GASTO') {
  return db.prepare('SELECT id FROM categorias WHERE nombre = ? AND tipo = ?').get(nombre, tipo).id;
}

// Inserta directo en la base: permite cualquier fecha y no depende de las rutas de alta.
function insertarMovimiento(db, { fecha = '2026-10-10', categoria, tipo = 'GASTO', montoCentavos }) {
  db.prepare(
    `INSERT INTO movimientos (monto_centavos, fecha, categoria_id, descripcion, creado_en)
     VALUES (?, ?, ?, NULL, ?)`
  ).run(montoCentavos, fecha, idDe(db, categoria, tipo), CREADO_EN);
}

function crearCategoria(db, nombre, tipo = 'GASTO') {
  db.prepare('INSERT INTO categorias (nombre, nombre_normalizado, tipo) VALUES (?, ?, ?)').run(
    nombre,
    normalizarNombre(nombre),
    tipo
  );
}

const nombresDe = (lista) => lista.map((item) => item.nombre);
const sumar = (lista) => lista.reduce((suma, item) => suma + item.totalCentavos, 0);

test('T-13.1 / CA-06.1: Alimentación $ 30.000,00 y Transporte $ 10.000,00 dan 75,0 % y 25,0 %, en ese orden', () =>
  conEntorno(async ({ db, pedir }) => {
    insertarMovimiento(db, { categoria: 'Transporte', montoCentavos: 1000000 }); // se carga primero a propósito
    insertarMovimiento(db, { categoria: 'Alimentación', montoCentavos: 3000000 });

    const { status, cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.equal(status, 200);
    assert.deepEqual(cuerpo.porCategoria.GASTO, [
      { categoriaId: idDe(db, 'Alimentación'), nombre: 'Alimentación', totalCentavos: 3000000, porcentaje: 75.0 },
      { categoriaId: idDe(db, 'Transporte'), nombre: 'Transporte', totalCentavos: 1000000, porcentaje: 25.0 },
    ]);
    assert.deepEqual(cuerpo.porCategoria.INGRESO, []);
  }));

test('T-13.2 / CA-06.2: tres categorías con $ 100,00 cada una muestran 33,3 % cada una', () =>
  conEntorno(async ({ db, pedir }) => {
    for (const categoria of ['Alimentación', 'Transporte', 'Salud']) {
      insertarMovimiento(db, { categoria, montoCentavos: 10000 });
    }

    const { cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.equal(cuerpo.porCategoria.GASTO.length, 3);
    for (const item of cuerpo.porCategoria.GASTO) {
      assert.equal(item.totalCentavos, 10000);
      assert.equal(item.porcentaje, 33.3);
    }
  }));

test('T-13.3 / CA-06.3: con el mismo total se ordenan alfabéticamente por nombre', () =>
  conEntorno(async ({ db, pedir }) => {
    insertarMovimiento(db, { categoria: 'Vivienda', montoCentavos: 20000 }); // el mayor va primero
    insertarMovimiento(db, { categoria: 'Transporte', montoCentavos: 5000 });
    insertarMovimiento(db, { categoria: 'Transporte', montoCentavos: 5000 }); // 10000 en dos movimientos
    insertarMovimiento(db, { categoria: 'Alimentación', montoCentavos: 10000 }); // empata con Transporte

    const { cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.deepEqual(nombresDe(cuerpo.porCategoria.GASTO), ['Vivienda', 'Alimentación', 'Transporte']);
  }));

test('T-13.4 / CA-06.4, CB-21: un mes sin ingresos tiene INGRESO vacío; un mes sin movimientos, ambas listas vacías', () =>
  conEntorno(async ({ db, pedir }) => {
    insertarMovimiento(db, { categoria: 'Alimentación', montoCentavos: 10000 });

    const conGastos = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.equal(conGastos.cuerpo.porCategoria.GASTO.length, 1);
    assert.deepEqual(conGastos.cuerpo.porCategoria.INGRESO, []);

    const vacio = await pedir('GET', '/api/resumen?mes=2026-11');
    assert.equal(vacio.status, 200);
    assert.deepEqual(vacio.cuerpo.porCategoria, { GASTO: [], INGRESO: [] });
  }));

test('T-13.5 / CA-06.5, RN-09: una categoría desactivada con movimientos en el mes aparece igual', () =>
  conEntorno(async ({ db, pedir }) => {
    insertarMovimiento(db, { categoria: 'Alimentación', montoCentavos: 30000 });
    insertarMovimiento(db, { categoria: 'Ocio', montoCentavos: 10000 });
    db.prepare('UPDATE categorias SET activa = 0 WHERE id = ?').run(idDe(db, 'Ocio'));

    const { cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.deepEqual(nombresDe(cuerpo.porCategoria.GASTO), ['Alimentación', 'Ocio']);
    assert.equal(cuerpo.porCategoria.GASTO[1].porcentaje, 25.0);
  }));

test('T-13.6 / RN-13: una categoría sin movimientos en el mes no aparece, aunque los tenga en otros meses', () =>
  conEntorno(async ({ db, pedir }) => {
    insertarMovimiento(db, { fecha: '2026-10-10', categoria: 'Alimentación', montoCentavos: 10000 });
    insertarMovimiento(db, { fecha: '2026-09-10', categoria: 'Salud', montoCentavos: 99000 });
    insertarMovimiento(db, { fecha: '2026-11-01', categoria: 'Transporte', montoCentavos: 99000 });

    const { cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.deepEqual(nombresDe(cuerpo.porCategoria.GASTO), ['Alimentación']);
    assert.equal(cuerpo.porCategoria.GASTO[0].porcentaje, 100.0);

    const septiembre = await pedir('GET', '/api/resumen?mes=2026-09');
    assert.deepEqual(nombresDe(septiembre.cuerpo.porCategoria.GASTO), ['Salud']);
  }));

test('T-13.7 / RN-13: totales de 1 y 2 centavos dan 33,3 % y 66,7 %', () =>
  conEntorno(async ({ db, pedir }) => {
    insertarMovimiento(db, { categoria: 'Alimentación', montoCentavos: 1 });
    insertarMovimiento(db, { categoria: 'Transporte', montoCentavos: 2 });

    const { cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.deepEqual(
      cuerpo.porCategoria.GASTO.map((i) => [i.nombre, i.totalCentavos, i.porcentaje]),
      [
        ['Transporte', 2, 66.7],
        ['Alimentación', 1, 33.3],
      ]
    );
  }));

test('T-13.8: los totales por categoría suman exactamente gastosCentavos e ingresosCentavos del mes', () =>
  conEntorno(async ({ db, pedir }) => {
    insertarMovimiento(db, { categoria: 'Alimentación', montoCentavos: 123456 });
    insertarMovimiento(db, { categoria: 'Alimentación', montoCentavos: 7 });
    insertarMovimiento(db, { categoria: 'Transporte', montoCentavos: 98765 });
    insertarMovimiento(db, { categoria: 'Otros gastos', montoCentavos: 1 });
    insertarMovimiento(db, { categoria: 'Sueldo', tipo: 'INGRESO', montoCentavos: 50000000 });
    insertarMovimiento(db, { categoria: 'Ventas', tipo: 'INGRESO', montoCentavos: 333 });

    const { cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.equal(cuerpo.porCategoria.GASTO.length, 3);
    assert.equal(cuerpo.porCategoria.INGRESO.length, 2);
    assert.equal(sumar(cuerpo.porCategoria.GASTO), cuerpo.gastosCentavos);
    assert.equal(sumar(cuerpo.porCategoria.INGRESO), cuerpo.ingresosCentavos);
  }));

// Agregado (RN-13): el redondeo a un decimal es "mitad hacia arriba" y se hace con enteros.
test('T-13.9 / RN-13: 1 de 2000 (0,05 %) sube a 0,1 y 1999 de 2000 (99,95 %) sube a 100,0', () =>
  conEntorno(async ({ db, pedir }) => {
    insertarMovimiento(db, { categoria: 'Alimentación', montoCentavos: 1999 });
    insertarMovimiento(db, { categoria: 'Transporte', montoCentavos: 1 });

    const { cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.deepEqual(
      cuerpo.porCategoria.GASTO.map((i) => [i.nombre, i.porcentaje]),
      [
        ['Alimentación', 100.0],
        ['Transporte', 0.1],
      ]
    );
  }));

// Agregado (RN-13): gastos e ingresos se calculan por separado, cada uno sobre el total de su tipo.
test('T-13.10 / RN-13: el porcentaje de cada categoría es sobre el total de su propio tipo', () =>
  conEntorno(async ({ db, pedir }) => {
    insertarMovimiento(db, { categoria: 'Sueldo', tipo: 'INGRESO', montoCentavos: 5000000 });
    insertarMovimiento(db, { categoria: 'Ventas', tipo: 'INGRESO', montoCentavos: 5000000 });
    insertarMovimiento(db, { categoria: 'Alimentación', montoCentavos: 1000 });

    const { cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.deepEqual(
      cuerpo.porCategoria.INGRESO.map((i) => [i.nombre, i.porcentaje]),
      [
        ['Sueldo', 50.0],
        ['Ventas', 50.0],
      ]
    );
    assert.deepEqual(
      cuerpo.porCategoria.GASTO.map((i) => [i.nombre, i.porcentaje]),
      [['Alimentación', 100.0]]
    );
  }));

// Agregado (RN-13): el desempate por nombre ignora tildes y mayúsculas, como la lista de categorías.
test('T-13.11 / RN-13: en un empate, "Ágil" va antes que "Zapatos" (el orden ignora tildes)', () =>
  conEntorno(async ({ db, pedir }) => {
    crearCategoria(db, 'Zapatos');
    crearCategoria(db, 'Ágil');
    insertarMovimiento(db, { categoria: 'Zapatos', montoCentavos: 5000 });
    insertarMovimiento(db, { categoria: 'Ágil', montoCentavos: 5000 });

    const { cuerpo } = await pedir('GET', '/api/resumen?mes=2026-10');
    assert.deepEqual(nombresDe(cuerpo.porCategoria.GASTO), ['Ágil', 'Zapatos']);
  }));