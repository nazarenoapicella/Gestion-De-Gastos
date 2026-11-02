import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatearMonto, parsearMonto, formatearFecha, formatearMes } from '../js/format.js';

test('T-16.1 / RN-14: formatearMonto da el formato argentino $ 1.234,56', () => {
  assert.equal(formatearMonto(123456), '$ 1.234,56');
  assert.equal(formatearMonto(1), '$ 0,01');
  assert.equal(formatearMonto(0), '$ 0,00');
  assert.equal(formatearMonto(-5200005), '-$ 52.000,05');
});

// Agregado: bordes del formato (miles, centavos sueltos, máximo del sistema, signo).
test('T-16.1b: formatearMonto en los bordes', () => {
  const casos = [
    [99, '$ 0,99'],
    [100, '$ 1,00'],
    [100000, '$ 1.000,00'],
    [12345678, '$ 123.456,78'],
    [99999999999, '$ 999.999.999,99'],
    [-1, '-$ 0,01'],
  ];
  for (const [centavos, esperado] of casos) {
    assert.equal(formatearMonto(centavos), esperado, String(centavos));
  }
});

// Agregado: la API siempre manda enteros; cualquier otra cosa es un error de programación.
test('T-16.1c: formatearMonto rechaza lo que no es un entero de centavos con TypeError', () => {
  for (const valor of [12.5, '100', null, undefined, NaN, Infinity]) {
    assert.throws(() => formatearMonto(valor), TypeError, String(valor));
  }
});

test('T-16.2 / RN-14: parsearMonto lee montos con coma decimal y puntos de miles', () => {
  assert.equal(parsearMonto('1.234,56'), 123456);
  assert.equal(parsearMonto('1234,56'), 123456);
  assert.equal(parsearMonto('1234'), 123400);
  assert.equal(parsearMonto('0,01'), 1);
  assert.equal(parsearMonto('12,5'), 1250);
  assert.equal(parsearMonto('1.234.567,89'), 123456789);
});

// Agregado: más formatos válidos, incluido el máximo del sistema y los espacios de los extremos.
test('T-16.2b: parsearMonto acepta otros formatos válidos', () => {
  const casos = [
    ['999.999.999,99', 99999999999],
    ['1.000', 100000],
    ['1.000,5', 100050],
    ['0,5', 50],
    ['0,05', 5],
    ['0', 0],
    ['0,00', 0],
    [' 1.234,56 ', 123456],
  ];
  for (const [texto, esperado] of casos) {
    assert.equal(parsearMonto(texto), esperado, `"${texto}"`);
  }
});

test('T-16.3 / CB-05: parsearMonto devuelve null para "12,345", "-5", "abc", "", "1.23,4" y "1234.56"', () => {
  for (const texto of ['12,345', '-5', 'abc', '', '1.23,4', '1234.56']) {
    assert.equal(parsearMonto(texto), null, `"${texto}"`);
  }
});

// Agregado: formatos ambiguos o mal formados que también se rechazan.
test('T-16.3b: parsearMonto rechaza otros formatos inválidos', () => {
  const casos = [
    '$ 100',
    '1,2,3',
    '1.234,5,6',
    '1.234,567',
    '12,',
    ',50',
    '.5',
    '0.001',
    '007',
    '1 234,56',
    '1.234.56',
    '+5',
    '   ',
    '99999999999999999999', // más grande que el mayor entero seguro
  ];
  for (const texto of casos) {
    assert.equal(parsearMonto(texto), null, `"${texto}"`);
  }
});

test('T-16.3c: parsearMonto devuelve null si no recibe un texto', () => {
  for (const valor of [null, undefined, 123456, {}, true]) {
    assert.equal(parsearMonto(valor), null, String(valor));
  }
});

// Agregado: lo que se muestra se puede volver a leer.
test('T-16.3d: leer lo que formatearMonto escribe devuelve el mismo valor', () => {
  for (const centavos of [0, 1, 5, 99, 100, 123456, 5200005, 99999999999]) {
    const texto = formatearMonto(centavos).replace('$ ', '');
    assert.equal(parsearMonto(texto), centavos, texto);
  }
});

test('T-16.4 / RN-14: formatearFecha pasa de AAAA-MM-DD a DD/MM/AAAA', () => {
  assert.equal(formatearFecha('2026-10-30'), '30/10/2026');
  assert.equal(formatearFecha('2026-01-05'), '05/01/2026');
});

test('T-16.4b: formatearFecha rechaza textos con otro formato con TypeError', () => {
  for (const valor of ['2026-1-5', '30/10/2026', '', 'abc', undefined, null, 20261030]) {
    assert.throws(() => formatearFecha(valor), TypeError, String(valor));
  }
});

// Si formatearFecha usara new Date("AAAA-MM-DD"), en una zona al oeste de UTC mostraría el día anterior
// (plan §6). Esta prueba es efectiva donde Node permite cambiar TZ en caliente.
test('T-16.4c: formatearFecha y formatearMes no dependen de la zona horaria', (t) => {
  const original = process.env.TZ;
  t.after(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  for (const zona of ['America/Los_Angeles', 'Pacific/Auckland', 'UTC', 'America/Argentina/Buenos_Aires']) {
    process.env.TZ = zona;
    assert.equal(formatearFecha('2026-10-01'), '01/10/2026', zona);
    assert.equal(formatearMes('2026-10'), 'octubre 2026', zona);
  }
});

test('T-16.5 / RN-14: formatearMes escribe el mes en español', () => {
  assert.equal(formatearMes('2026-10'), 'octubre 2026');
});

// Agregado: los doce meses.
test('T-16.5b: formatearMes cubre los doce meses', () => {
  const nombres = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  nombres.forEach((nombre, i) => {
    const mes = String(i + 1).padStart(2, '0');
    assert.equal(formatearMes(`2026-${mes}`), `${nombre} 2026`, mes);
  });
});

test('T-16.5c: formatearMes rechaza meses mal formados con TypeError', () => {
  for (const valor of ['2026-13', '2026-00', '2026-1', '26-10', '', undefined, null, 202610]) {
    assert.throws(() => formatearMes(valor), TypeError, String(valor));
  }
});