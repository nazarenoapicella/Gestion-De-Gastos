import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEXTO_SIN_MOVIMIENTOS,
  describirBalance,
  filasDeCategorias,
  formatearPorcentaje,
  tarjetasDelResumen,
} from '../js/resumen.js';

test('T-20.1 / RN-13: formatearPorcentaje escribe siempre un decimal, con coma y un espacio antes del %', () => {
  const casos = [
    [75, '75,0 %'],
    [25, '25,0 %'],
    [33.3, '33,3 %'],
    [66.7, '66,7 %'],
    [58.3, '58,3 %'],
    [41.7, '41,7 %'],
    [100, '100,0 %'],
    [0.1, '0,1 %'],
    [0, '0,0 %'],
    [133.3, '133,3 %'],
  ];
  for (const [valor, esperado] of casos) {
    assert.equal(formatearPorcentaje(valor), esperado, String(valor));
  }
});

test('T-20.1b: formatearPorcentaje rechaza lo que no es un número finito mayor o igual a 0 con TypeError', () => {
  for (const valor of [NaN, Infinity, -Infinity, -1, '75', null, undefined, {}]) {
    assert.throws(() => formatearPorcentaje(valor), TypeError, String(valor));
  }
});

test('T-20.2 / CA-05.2: describirBalance da el monto con signo y una etiqueta de texto, no solo un color', () => {
  assert.deepEqual(describirBalance(37999950), { texto: '$ 379.999,50', estado: 'superavit', etiqueta: 'Superávit' });
  assert.deepEqual(describirBalance(0), { texto: '$ 0,00', estado: 'equilibrio', etiqueta: 'Equilibrio' });
  assert.deepEqual(describirBalance(-52000050), { texto: '-$ 520.000,50', estado: 'deficit', etiqueta: 'Déficit' });

  // los bordes: un centavo a favor y un centavo en contra
  assert.deepEqual(describirBalance(1), { texto: '$ 0,01', estado: 'superavit', etiqueta: 'Superávit' });
  assert.deepEqual(describirBalance(-1), { texto: '-$ 0,01', estado: 'deficit', etiqueta: 'Déficit' });
});

test('T-20.2b: describirBalance rechaza lo que no es un entero de centavos con TypeError', () => {
  for (const valor of [12.5, '100', null, undefined, NaN, Infinity]) {
    assert.throws(() => describirBalance(valor), TypeError, String(valor));
  }
});

test('T-20.3 / CA-06.1: filasDeCategorias da nombre, total y porcentaje ya escritos, en el mismo orden que la API', () => {
  const filas = filasDeCategorias([
    { categoriaId: 1, nombre: 'Alimentación', totalCentavos: 3000000, porcentaje: 75 },
    { categoriaId: 3, nombre: 'Transporte', totalCentavos: 1000000, porcentaje: 25 },
  ]);
  assert.deepEqual(filas, [
    { id: 1, nombre: 'Alimentación', total: '$ 30.000,00', porcentaje: '75,0 %' },
    { id: 3, nombre: 'Transporte', total: '$ 10.000,00', porcentaje: '25,0 %' },
  ]);
});

test('T-20.3b: filasDeCategorias con la lista vacía da [], no modifica lo recibido y deja el texto tal cual (CB-26)', () => {
  assert.deepEqual(filasDeCategorias([]), []);

  const entrada = Object.freeze([
    Object.freeze({ categoriaId: 9, nombre: '<b>x</b>', totalCentavos: 100, porcentaje: 100 }),
  ]);
  const filas = filasDeCategorias(entrada);
  assert.equal(filas[0].nombre, '<b>x</b>'); // el módulo no escapa nada: la vista usa textContent
  assert.equal(entrada.length, 1);
});

test('T-20.4 / CA-05.1, CA-05.3: octubre muestra ingresos $ 500.000,00, gastos $ 120.000,50, balance $ 379.999,50 y acumulado $ 479.999,50', () => {
  const tarjetas = tarjetasDelResumen({
    mes: '2026-10',
    ingresosCentavos: 50000000,
    gastosCentavos: 12000050,
    balanceMesCentavos: 37999950,
    balanceAcumuladoCentavos: 47999950,
    porCategoria: { GASTO: [], INGRESO: [] },
  });

  assert.deepEqual(tarjetas, [
    { clave: 'ingresos', titulo: 'Ingresos', texto: '$ 500.000,00' },
    { clave: 'gastos', titulo: 'Gastos', texto: '$ 120.000,50' },
    {
      clave: 'balanceMes',
      titulo: 'Balance del mes',
      texto: '$ 379.999,50',
      estado: 'superavit',
      etiqueta: 'Superávit',
    },
    {
      clave: 'balanceAcumulado',
      titulo: 'Balance acumulado',
      texto: '$ 479.999,50',
      estado: 'superavit',
      etiqueta: 'Superávit',
    },
  ]);
});

test('T-20.5 / CA-05.2: un mes con más gastos que ingresos muestra el balance con signo menos y la etiqueta "Déficit"', () => {
  const tarjetas = tarjetasDelResumen({
    ingresosCentavos: 50000000,
    gastosCentavos: 102000050,
    balanceMesCentavos: -52000050,
    balanceAcumuladoCentavos: -42000050,
  });

  const balanceMes = tarjetas.find((t) => t.clave === 'balanceMes');
  assert.equal(balanceMes.texto, '-$ 520.000,50');
  assert.equal(balanceMes.etiqueta, 'Déficit');
  assert.equal(balanceMes.estado, 'deficit');

  const acumulado = tarjetas.find((t) => t.clave === 'balanceAcumulado');
  assert.equal(acumulado.texto, '-$ 420.000,50');
  assert.equal(acumulado.etiqueta, 'Déficit');
});

test('T-20.6 / CA-05.4, CB-21, CB-23: un mes sin movimientos muestra $ 0,00 y el acumulado conserva lo anterior', () => {
  const tarjetas = tarjetasDelResumen({
    mes: '2026-12',
    ingresosCentavos: 0,
    gastosCentavos: 0,
    balanceMesCentavos: 0,
    balanceAcumuladoCentavos: 47999950,
    porCategoria: { GASTO: [], INGRESO: [] },
  });

  assert.equal(tarjetas.find((t) => t.clave === 'ingresos').texto, '$ 0,00');
  assert.equal(tarjetas.find((t) => t.clave === 'gastos').texto, '$ 0,00');

  const balanceMes = tarjetas.find((t) => t.clave === 'balanceMes');
  assert.equal(balanceMes.texto, '$ 0,00');
  assert.equal(balanceMes.etiqueta, 'Equilibrio');

  const acumulado = tarjetas.find((t) => t.clave === 'balanceAcumulado');
  assert.equal(acumulado.texto, '$ 479.999,50');
  assert.equal(acumulado.etiqueta, 'Superávit');
});

test('T-20.6b: tarjetasDelResumen falla con TypeError si falta un dato o no es un entero de centavos', () => {
  const completo = {
    ingresosCentavos: 0,
    gastosCentavos: 0,
    balanceMesCentavos: 0,
    balanceAcumuladoCentavos: 0,
  };
  assert.doesNotThrow(() => tarjetasDelResumen(completo));

  for (const entrada of [{}, undefined, null, { ...completo, ingresosCentavos: '1' }, { ...completo, gastosCentavos: 1.5 }]) {
    assert.throws(() => tarjetasDelResumen(entrada), TypeError, JSON.stringify(entrada));
  }
  const sinAcumulado = { ...completo };
  delete sinAcumulado.balanceAcumuladoCentavos;
  assert.throws(() => tarjetasDelResumen(sinAcumulado), TypeError);
});

test('T-20.7 / CA-06.4: el texto de las tablas sin movimientos es "Sin movimientos"', () => {
  assert.equal(TEXTO_SIN_MOVIMIENTOS, 'Sin movimientos');
});