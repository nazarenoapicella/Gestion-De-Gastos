import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoriasOfrecidas, hoyEnArgentina, validarMovimiento } from '../js/validaciones.js';

const HOY = '2026-10-30';

// Lo que lee el formulario: todo son textos, tal como los entregan los campos del navegador.
const valores = (cambios = {}) => ({
  tipo: 'GASTO',
  monto: '1.234,56',
  fecha: '2026-10-29',
  categoriaId: '3',
  descripcion: 'Supermercado',
  ...cambios,
});

// El resultado falla y el único campo con error es `campo`.
function assertSoloError(resultado, campo) {
  assert.equal(resultado.ok, false, `debía fallar: ${JSON.stringify(resultado)}`);
  assert.deepEqual(Object.keys(resultado.errores), [campo]);
  assert.equal(typeof resultado.errores[campo], 'string');
  assert.ok(resultado.errores[campo].length > 0);
}

// El resultado es válido; devuelve el payload para seguir comprobando.
function assertValido(resultado) {
  assert.equal(resultado.ok, true, `debía ser válido: ${JSON.stringify(resultado)}`);
  return resultado.payload;
}

test('T-17.1 / CA-01.3, CB-05: monto "0" y "12,345" dan error en monto; "1.234,56" es válido y da 123456 centavos', () => {
  assertSoloError(validarMovimiento(valores({ monto: '0' }), HOY), 'monto');
  assertSoloError(validarMovimiento(valores({ monto: '12,345' }), HOY), 'monto');

  const payload = assertValido(validarMovimiento(valores({ monto: '1.234,56' }), HOY));
  assert.equal(payload.montoCentavos, 123456);
});

// Agregado (RN-02): los bordes del monto, igual que en el servidor.
test('T-17.1b / RN-02: bordes del monto (mínimo $ 0,01 y máximo $ 999.999.999,99)', () => {
  const invalidos = ['', '   ', '-5', 'abc', '1234.56', '0,00', '1.000.000.000,00', '100000000000'];
  for (const monto of invalidos) {
    assertSoloError(validarMovimiento(valores({ monto }), HOY), 'monto');
  }

  const validos = [
    ['0,01', 1],
    ['999.999.999,99', 99999999999],
    ['1234', 123400],
    [' 12,5 ', 1250],
  ];
  for (const [monto, esperado] of validos) {
    const payload = assertValido(validarMovimiento(valores({ monto }), HOY));
    assert.equal(payload.montoCentavos, esperado, monto);
  }
});

test('T-17.2 / CA-01.4, CB-06, CB-07: con hoy 2026-10-30, mañana da error, hoy es válida y vacía da error', () => {
  assertSoloError(validarMovimiento(valores({ fecha: '2026-10-31' }), HOY), 'fecha');
  assert.equal(assertValido(validarMovimiento(valores({ fecha: '2026-10-30' }), HOY)).fecha, '2026-10-30');
  assertSoloError(validarMovimiento(valores({ fecha: '' }), HOY), 'fecha');
});

// Agregado (RN-03): calendario y rango, igual que en el servidor.
test('T-17.2b / CB-08, CB-09, CB-10: la fecha respeta el calendario y el rango desde 2000-01-01', () => {
  const invalidas = ['2026-02-29', '1999-12-31', '2026-13-01', '2026-04-31', '2026-10-00', 'abc', '30/10/2026'];
  for (const fecha of invalidas) {
    assertSoloError(validarMovimiento(valores({ fecha }), HOY), 'fecha');
  }
  assertSoloError(validarMovimiento(valores({ fecha: undefined }), HOY), 'fecha');

  for (const fecha of ['2024-02-29', '2000-01-01']) {
    assert.equal(assertValido(validarMovimiento(valores({ fecha }), HOY)).fecha, fecha);
  }
});

test('T-17.3 / CA-01.5: sin categoría elegida da error en categoriaId', () => {
  for (const categoriaId of ['', undefined, null]) {
    assertSoloError(validarMovimiento(valores({ categoriaId }), HOY), 'categoriaId');
  }
});

// Agregado: el selector entrega texto; el payload lleva el número que espera la API.
test('T-17.3b: la categoría se envía como número y un valor que no es un entero da error', () => {
  assert.equal(assertValido(validarMovimiento(valores({ categoriaId: '12' }), HOY)).categoriaId, 12);
  assert.equal(assertValido(validarMovimiento(valores({ categoriaId: 3 }), HOY)).categoriaId, 3);

  for (const categoriaId of ['abc', '1.5', '-1', '0x10']) {
    assertSoloError(validarMovimiento(valores({ categoriaId }), HOY), 'categoriaId');
  }
});

test('T-17.4 / CA-01.7, CB-13: una descripción de 141 caracteres da error y una de 140 es válida', () => {
  assertSoloError(validarMovimiento(valores({ descripcion: 'A'.repeat(141) }), HOY), 'descripcion');
  assertValido(validarMovimiento(valores({ descripcion: 'A'.repeat(140) }), HOY));
});

test('T-17.5 / CA-01.2, RN-05: una descripción vacía, de espacios o ausente da payload.descripcion = null', () => {
  for (const descripcion of ['', '   ', undefined, null]) {
    const payload = assertValido(validarMovimiento(valores({ descripcion }), HOY));
    assert.equal(payload.descripcion, null, JSON.stringify(descripcion));
  }
});

test('T-17.5b: el payload tiene exactamente los campos de la API y recorta solo los extremos de la descripción', () => {
  const payload = assertValido(validarMovimiento(valores({ descripcion: '  Pan   lactal ' }), HOY));
  assert.deepEqual(payload, {
    tipo: 'GASTO',
    montoCentavos: 123456,
    fecha: '2026-10-29',
    categoriaId: 3,
    descripcion: 'Pan   lactal',
  });
});

test('T-17.6 / RN-01: el tipo debe ser GASTO o INGRESO', () => {
  for (const tipo of ['OTRO', 'gasto', '', undefined]) {
    assertSoloError(validarMovimiento(valores({ tipo }), HOY), 'tipo');
  }
  assert.equal(assertValido(validarMovimiento(valores({ tipo: 'INGRESO' }), HOY)).tipo, 'INGRESO');
});

test('T-17.7: con varios campos inválidos a la vez, se informan todos juntos', () => {
  const resultado = validarMovimiento(
    { tipo: 'OTRO', monto: '0', fecha: '2026-12-31', categoriaId: '', descripcion: 'A'.repeat(141) },
    HOY
  );
  assert.equal(resultado.ok, false);
  assert.deepEqual(Object.keys(resultado.errores).sort(), ['categoriaId', 'descripcion', 'fecha', 'monto', 'tipo']);
});

test('T-17.8: si falta "hoy" o no es una fecha AAAA-MM-DD, falla con TypeError (es un error de programación)', () => {
  for (const hoy of [undefined, null, '', '30/10/2026', 20261030]) {
    assert.throws(() => validarMovimiento(valores(), hoy), TypeError, String(hoy));
  }
});

test('T-17.9: un formulario vacío o ausente no rompe: informa los campos obligatorios', () => {
  for (const entrada of [{}, undefined, null]) {
    const resultado = validarMovimiento(entrada, HOY);
    assert.equal(resultado.ok, false);
    // la descripción es opcional, así que no aparece
    assert.deepEqual(Object.keys(resultado.errores).sort(), ['categoriaId', 'fecha', 'monto', 'tipo']);
  }
});

// Agregado (RN-05): el largo se cuenta en caracteres, igual que en el servidor.
test('T-17.10: 140 emojis cuentan como 140 caracteres (válido) y 141 dan error', () => {
  assertValido(validarMovimiento(valores({ descripcion: '😀'.repeat(140) }), HOY));
  assertSoloError(validarMovimiento(valores({ descripcion: '😀'.repeat(141) }), HOY), 'descripcion');
});

// Agregado (D-06): "hoy" es el día de Buenos Aires aunque el reloj esté en UTC.
test('T-17.11 / CB-11, D-06: hoyEnArgentina cambia de día a las 03:00 UTC (00:00 en Buenos Aires)', () => {
  const casos = [
    ['2026-10-31T01:30:00Z', '2026-10-30'],
    ['2026-10-30T02:59:59Z', '2026-10-29'],
    ['2026-10-30T03:00:00Z', '2026-10-30'],
    ['2026-12-31T23:59:59Z', '2026-12-31'],
    ['2027-01-01T02:59:59Z', '2026-12-31'],
    ['2027-01-01T03:00:00Z', '2027-01-01'],
  ];
  for (const [instante, esperado] of casos) {
    assert.equal(hoyEnArgentina(new Date(instante)), esperado, instante);
  }
  assert.match(hoyEnArgentina(), /^\d{4}-\d{2}-\d{2}$/);
});

const CATEGORIAS = [
  { id: 1, nombre: 'Alimentación', tipo: 'GASTO', activa: true, protegida: false },
  { id: 2, nombre: 'Ocio', tipo: 'GASTO', activa: false, protegida: false },
  { id: 3, nombre: 'Otros gastos', tipo: 'GASTO', activa: true, protegida: true },
  { id: 4, nombre: 'Otros ingresos', tipo: 'INGRESO', activa: true, protegida: true },
  { id: 5, nombre: 'Sueldo', tipo: 'INGRESO', activa: true, protegida: false },
  { id: 6, nombre: 'Ventas', tipo: 'INGRESO', activa: false, protegida: false },
];

const nombres = (lista) => lista.map((c) => c.nombre);

test('T-17.12 / RN-04, RN-09: el selector ofrece solo las categorías activas del tipo elegido', () => {
  assert.deepEqual(nombres(categoriasOfrecidas(CATEGORIAS, 'GASTO')), ['Alimentación', 'Otros gastos']);
  assert.deepEqual(nombres(categoriasOfrecidas(CATEGORIAS, 'INGRESO')), ['Otros ingresos', 'Sueldo']);
  assert.deepEqual(categoriasOfrecidas(CATEGORIAS, 'OTRO'), []);
  assert.deepEqual(categoriasOfrecidas([], 'GASTO'), []);
});

test('T-17.13 / RN-09, CB-18: al editar se ofrece además la categoría actual aunque esté desactivada, si es del tipo elegido', () => {
  // la actual (Ocio, desactivada) se ofrece manteniendo el orden de la lista
  assert.deepEqual(nombres(categoriasOfrecidas(CATEGORIAS, 'GASTO', 2)), ['Alimentación', 'Ocio', 'Otros gastos']);
  // si se cambió el tipo, la actual (de gasto) ya no corresponde
  assert.deepEqual(nombres(categoriasOfrecidas(CATEGORIAS, 'INGRESO', 2)), ['Otros ingresos', 'Sueldo']);
  // una actual que ya está activa aparece una sola vez
  assert.deepEqual(nombres(categoriasOfrecidas(CATEGORIAS, 'GASTO', 1)), ['Alimentación', 'Otros gastos']);
  // otra actual desactivada del otro tipo
  assert.deepEqual(nombres(categoriasOfrecidas(CATEGORIAS, 'INGRESO', 6)), ['Otros ingresos', 'Sueldo', 'Ventas']);
  // la lista original no se modifica
  assert.equal(CATEGORIAS.length, 6);
});