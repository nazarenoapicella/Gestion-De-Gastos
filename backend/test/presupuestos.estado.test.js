import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEntorno } from './helpers.js';

const CREADO_EN = '2026-10-01T10:00:00.000Z';

function idDe(db, nombre, tipo = 'GASTO') {
  return db.prepare('SELECT id FROM categorias WHERE nombre = ? AND tipo = ?').get(nombre, tipo).id;
}

// Inserta directo en la base: permite cualquier fecha y no depende de las rutas de alta.
function gasto(db, categoria, montoCentavos, fecha = '2026-10-10') {
  db.prepare(
    `INSERT INTO movimientos (monto_centavos, fecha, categoria_id, descripcion, creado_en)
     VALUES (?, ?, ?, NULL, ?)`
  ).run(montoCentavos, fecha, idDe(db, categoria), CREADO_EN);
}

function ponerLimite(db, categoria, limiteCentavos) {
  db.prepare('INSERT INTO presupuestos (categoria_id, limite_centavos, actualizado_en) VALUES (?, ?, ?)').run(
    idDe(db, categoria),
    limiteCentavos,
    CREADO_EN
  );
}

const consultar = (pedir, mes = '2026-10') => pedir('GET', `/api/presupuestos?mes=${mes}`);

// Datos de la spec (CA-09.1): el límite de "Alimentación" es $ 100.000,00 = 10000000 centavos.
const LIMITE = 10000000;

test('T-15.1 / CA-09.1: con $ 79.999,99 gastados el estado es NORMAL (aunque el porcentaje mostrado sea 80,0)', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Alimentación', LIMITE);
    gasto(db, 'Alimentación', 7999999);

    const { status, cuerpo } = await consultar(pedir);
    assert.equal(status, 200);
    assert.deepEqual(cuerpo, {
      mes: '2026-10',
      items: [
        {
          categoriaId: idDe(db, 'Alimentación'),
          categoriaNombre: 'Alimentación',
          limiteCentavos: LIMITE,
          gastadoCentavos: 7999999,
          porcentajeConsumo: 80.0,
          estado: 'NORMAL',
        },
      ],
    });
  }));

test('T-15.2 / CA-09.1, CB-19: con $ 80.000,00 gastados (80 %) el estado es ALERTA', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Alimentación', LIMITE);
    gasto(db, 'Alimentación', 8000000);

    const { cuerpo } = await consultar(pedir);
    assert.equal(cuerpo.items.length, 1);
    assert.equal(cuerpo.items[0].gastadoCentavos, 8000000);
    assert.equal(cuerpo.items[0].porcentajeConsumo, 80.0);
    assert.equal(cuerpo.items[0].estado, 'ALERTA');
  }));

test('T-15.3 / CA-09.1, CB-19: con $ 100.000,00 gastados (100 %) el estado sigue siendo ALERTA', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Alimentación', LIMITE);
    gasto(db, 'Alimentación', 10000000);

    const { cuerpo } = await consultar(pedir);
    assert.equal(cuerpo.items[0].porcentajeConsumo, 100.0);
    assert.equal(cuerpo.items[0].estado, 'ALERTA');
  }));

test('T-15.4 / CA-09.1, CB-20: con $ 100.000,01 gastados el estado es EXCEDIDO (aunque el porcentaje mostrado sea 100,0)', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Alimentación', LIMITE);
    gasto(db, 'Alimentación', 10000001);

    const { cuerpo } = await consultar(pedir);
    assert.equal(cuerpo.items[0].gastadoCentavos, 10000001);
    assert.equal(cuerpo.items[0].porcentajeConsumo, 100.0);
    assert.equal(cuerpo.items[0].estado, 'EXCEDIDO');
  }));

test('T-15.5: con un límite y sin gastos en el mes, el consumo es 0,0 y el estado NORMAL', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Alimentación', LIMITE);

    const { status, cuerpo } = await consultar(pedir);
    assert.equal(status, 200);
    assert.equal(cuerpo.items.length, 1);
    assert.equal(cuerpo.items[0].gastadoCentavos, 0);
    assert.equal(cuerpo.items[0].porcentajeConsumo, 0.0);
    assert.equal(cuerpo.items[0].estado, 'NORMAL');
  }));

test('T-15.6 / CA-09.2: los gastos de otros meses no suman al mes consultado', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Alimentación', LIMITE);
    gasto(db, 'Alimentación', 9000000, '2026-09-15');
    gasto(db, 'Alimentación', 3000000, '2026-10-10');
    gasto(db, 'Alimentación', 8000000, '2026-11-01');

    const { cuerpo } = await consultar(pedir, '2026-10');
    assert.equal(cuerpo.items[0].gastadoCentavos, 3000000);
    assert.equal(cuerpo.items[0].porcentajeConsumo, 30.0);
    assert.equal(cuerpo.items[0].estado, 'NORMAL');
  }));

test('T-15.7 / CA-09.3: una categoría desactivada con límite no aparece; al reactivarla vuelve a aparecer', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Ocio', 2000000);
    gasto(db, 'Ocio', 1000000);
    const id = idDe(db, 'Ocio');

    const activa = await consultar(pedir);
    assert.equal(activa.cuerpo.items.length, 1);

    const desactivada = await pedir('PATCH', `/api/categorias/${id}`, { activa: false });
    assert.equal(desactivada.status, 200);
    const sinOcio = await consultar(pedir);
    assert.deepEqual(sinOcio.cuerpo.items, []);

    const reactivada = await pedir('PATCH', `/api/categorias/${id}`, { activa: true });
    assert.equal(reactivada.status, 200);
    const conOcio = await consultar(pedir);
    assert.equal(conOcio.cuerpo.items.length, 1);
    assert.equal(conOcio.cuerpo.items[0].categoriaNombre, 'Ocio');
    assert.equal(conOcio.cuerpo.items[0].gastadoCentavos, 1000000);
  }));

test('T-15.8 / CA-09.4: una categoría sin presupuesto no aparece, aunque tenga gastos', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Alimentación', LIMITE);
    gasto(db, 'Alimentación', 1000000);
    gasto(db, 'Transporte', 5000000); // sin límite

    const { cuerpo } = await consultar(pedir);
    assert.deepEqual(
      cuerpo.items.map((i) => i.categoriaNombre),
      ['Alimentación']
    );
  }));

test('T-15.9 / CA-09.6: al bajar el límite de 10000000 a 5000000 con 6000000 gastados, el estado pasa de NORMAL a EXCEDIDO', () =>
  conEntorno(async ({ db, pedir }) => {
    const id = idDe(db, 'Alimentación');
    gasto(db, 'Alimentación', 6000000);

    const alta = await pedir('PUT', `/api/presupuestos/${id}`, { limiteCentavos: 10000000 });
    assert.equal(alta.status, 200);
    const antes = await consultar(pedir);
    assert.equal(antes.cuerpo.items[0].estado, 'NORMAL');
    assert.equal(antes.cuerpo.items[0].porcentajeConsumo, 60.0);

    const baja = await pedir('PUT', `/api/presupuestos/${id}`, { limiteCentavos: 5000000 });
    assert.equal(baja.status, 200);
    const despues = await consultar(pedir);
    assert.equal(despues.cuerpo.items[0].limiteCentavos, 5000000);
    assert.equal(despues.cuerpo.items[0].porcentajeConsumo, 120.0);
    assert.equal(despues.cuerpo.items[0].estado, 'EXCEDIDO');
  }));

test('T-15.10: con dos presupuestos o más, el listado viene ordenado por consumo descendente y, ante empate, por nombre', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Alimentación', 10000000);
    gasto(db, 'Alimentación', 5000000); // 50 %
    ponerLimite(db, 'Transporte', 1000000);
    gasto(db, 'Transporte', 900000); // 90 %
    ponerLimite(db, 'Salud', 200000);
    gasto(db, 'Salud', 100000); // 50 %, empata con Alimentación
    ponerLimite(db, 'Ocio', 100000);
    gasto(db, 'Ocio', 150000); // 150 %

    const { cuerpo } = await consultar(pedir);
    assert.deepEqual(
      cuerpo.items.map((i) => [i.categoriaNombre, i.porcentajeConsumo, i.estado]),
      [
        ['Ocio', 150.0, 'EXCEDIDO'],
        ['Transporte', 90.0, 'ALERTA'],
        ['Alimentación', 50.0, 'NORMAL'],
        ['Salud', 50.0, 'NORMAL'],
      ]
    );
  }));

test('T-15.11 / CB-22, CB-23: un mes mal formado da 400 MES_INVALIDO, sin mes da 400 MES_REQUERIDO y un mes futuro responde 200', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Alimentación', LIMITE);
    gasto(db, 'Alimentación', 5000000);

    // Precondición: la ruta existe y funciona con un mes válido.
    const valido = await consultar(pedir);
    assert.equal(valido.status, 200);

    for (const mes of ['2026-13', '2026-00', '2026-1', '26-10', '']) {
      const { status, cuerpo } = await consultar(pedir, mes);
      assert.equal(status, 400, `mes="${mes}"`);
      assert.equal(cuerpo.error.codigo, 'MES_INVALIDO', `mes="${mes}"`);
    }

    const sinMes = await pedir('GET', '/api/presupuestos');
    assert.equal(sinMes.status, 400);
    assert.equal(sinMes.cuerpo.error.codigo, 'MES_REQUERIDO');
    assert.ok(sinMes.cuerpo.error.campos.mes);

    const futuro = await consultar(pedir, '2027-01');
    assert.equal(futuro.status, 200);
    assert.equal(futuro.cuerpo.items[0].gastadoCentavos, 0);
    assert.equal(futuro.cuerpo.items[0].estado, 'NORMAL');
  }));

// Agregado: el gastado es la suma de todos los gastos de esa categoría, y solo de esa.
test('T-15.12: el gastado suma todos los movimientos de la categoría y no los de otras', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Alimentación', LIMITE);
    gasto(db, 'Alimentación', 1000000, '2026-10-02');
    gasto(db, 'Alimentación', 2500000, '2026-10-15');
    gasto(db, 'Alimentación', 500000, '2026-10-30');
    gasto(db, 'Transporte', 9000000, '2026-10-15');

    const { cuerpo } = await consultar(pedir);
    assert.equal(cuerpo.items.length, 1);
    assert.equal(cuerpo.items[0].gastadoCentavos, 4000000);
    assert.equal(cuerpo.items[0].porcentajeConsumo, 40.0);
  }));

// Agregado (CB-12): el último día del mes cuenta en ese mes y no en el siguiente.
test('T-15.13 / CB-12: un gasto del 2026-10-31 cuenta en octubre y uno del 2026-11-01 en noviembre', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Alimentación', 10000);
    gasto(db, 'Alimentación', 3000, '2026-10-31');
    gasto(db, 'Alimentación', 7000, '2026-11-01');

    const octubre = await consultar(pedir, '2026-10');
    assert.equal(octubre.cuerpo.items[0].gastadoCentavos, 3000);
    assert.equal(octubre.cuerpo.items[0].porcentajeConsumo, 30.0);

    const noviembre = await consultar(pedir, '2026-11');
    assert.equal(noviembre.cuerpo.items[0].gastadoCentavos, 7000);
    assert.equal(noviembre.cuerpo.items[0].porcentajeConsumo, 70.0);
  }));

// Agregado: sin límites definidos no es un error, es una lista vacía.
test('T-15.14: sin presupuestos definidos responde 200 con la lista vacía', () =>
  conEntorno(async ({ db, pedir }) => {
    gasto(db, 'Alimentación', 5000000);

    const { status, cuerpo } = await consultar(pedir);
    assert.equal(status, 200);
    assert.deepEqual(cuerpo, { mes: '2026-10', items: [] });
  }));

// Agregado (RN-16): el porcentaje se redondea a un decimal, mitad hacia arriba, con enteros.
test('T-15.15 / RN-16: 1 de 2000 centavos (0,05 %) sube a 0,1 y 4 de 3 centavos (133,33 %) da 133,3', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Alimentación', 2000);
    gasto(db, 'Alimentación', 1);
    ponerLimite(db, 'Transporte', 3);
    gasto(db, 'Transporte', 4);

    const { cuerpo } = await consultar(pedir);
    const porNombre = Object.fromEntries(cuerpo.items.map((i) => [i.categoriaNombre, i]));
    assert.equal(porNombre['Alimentación'].porcentajeConsumo, 0.1);
    assert.equal(porNombre['Alimentación'].estado, 'NORMAL');
    assert.equal(porNombre['Transporte'].porcentajeConsumo, 133.3);
    assert.equal(porNombre['Transporte'].estado, 'EXCEDIDO');
  }));

// Agregado: un parámetro repetido llega como lista y no es un mes válido.
test('T-15.16: un mes repetido (?mes=...&mes=...) da 400 MES_INVALIDO', () =>
  conEntorno(async ({ pedir }) => {
    const { status, cuerpo } = await pedir('GET', '/api/presupuestos?mes=2026-10&mes=2026-09');
    assert.equal(status, 400);
    assert.equal(cuerpo.error.codigo, 'MES_INVALIDO');
  }));

// Agregado (RN-15): el límite vigente se aplica también a los meses pasados.
test('T-15.17 / RN-15: un mes pasado se evalúa con el límite vigente de hoy', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Alimentación', 5000000);
    gasto(db, 'Alimentación', 6000000, '2026-09-10');

    const { cuerpo } = await consultar(pedir, '2026-09');
    assert.equal(cuerpo.items[0].limiteCentavos, 5000000);
    assert.equal(cuerpo.items[0].porcentajeConsumo, 120.0);
    assert.equal(cuerpo.items[0].estado, 'EXCEDIDO');
  }));

// Agregado: el orden usa el consumo exacto, no el porcentaje redondeado.
test('T-15.18: dos consumos que se muestran iguales (80,0 %) se ordenan por el consumo exacto, no por nombre', () =>
  conEntorno(async ({ db, pedir }) => {
    ponerLimite(db, 'Ocio', 10000000);
    gasto(db, 'Ocio', 7999999); // 79,99999 %, se muestra 80,0
    ponerLimite(db, 'Salud', 10000000);
    gasto(db, 'Salud', 8000000); // 80,0 % exacto

    const { cuerpo } = await consultar(pedir);
    assert.deepEqual(
      cuerpo.items.map((i) => [i.categoriaNombre, i.porcentajeConsumo, i.estado]),
      [
        ['Salud', 80.0, 'ALERTA'],
        ['Ocio', 80.0, 'NORMAL'],
      ]
    );
  }));