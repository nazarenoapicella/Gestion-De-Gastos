import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  anchoDeBarra,
  avisoDeAlertas,
  categoriasParaLimite,
  etiquetaDeOpcion,
  filaDePresupuesto,
  textoDeEstado,
  validarLimite,
} from '../js/presupuestos.js';

// Un elemento de GET /api/presupuestos. Por defecto: límite de $ 100.000,00 con $ 79.999,99 gastados.
const item = (cambios = {}) => ({
  categoriaId: 1,
  categoriaNombre: 'Alimentación',
  limiteCentavos: 10000000,
  gastadoCentavos: 7999999,
  porcentajeConsumo: 80,
  estado: 'NORMAL',
  ...cambios,
});

test('T-21.1 / RN-16: textoDeEstado escribe el estado en español', () => {
  assert.equal(textoDeEstado('NORMAL'), 'Normal');
  assert.equal(textoDeEstado('ALERTA'), 'Alerta');
  assert.equal(textoDeEstado('EXCEDIDO'), 'Excedido');
});

test('T-21.1b: textoDeEstado rechaza cualquier otro valor con TypeError', () => {
  for (const valor of ['normal', 'OTRO', '', undefined, null, 'constructor', 80]) {
    assert.throws(() => textoDeEstado(valor), TypeError, String(valor));
  }
});

test('T-21.2: anchoDeBarra nunca pasa de 100, aunque el consumo lo supere', () => {
  const casos = [
    [0, 0],
    [0.1, 0.1],
    [30, 30],
    [80, 80],
    [100, 100],
    [100.1, 100],
    [133.3, 100],
    [1000, 100],
  ];
  for (const [porcentaje, esperado] of casos) {
    assert.equal(anchoDeBarra(porcentaje), esperado, String(porcentaje));
  }
});

test('T-21.2b: anchoDeBarra rechaza lo que no es un número finito mayor o igual a 0 con TypeError', () => {
  for (const valor of [NaN, Infinity, -1, '50', null, undefined]) {
    assert.throws(() => anchoDeBarra(valor), TypeError, String(valor));
  }
});

test('T-21.3 / CA-09.1: con $ 79.999,99 gastados la fila dice "Normal" y 80,0 % (el estado no sale del porcentaje redondeado)', () => {
  assert.deepEqual(filaDePresupuesto(item()), {
    id: 1,
    nombre: 'Alimentación',
    estado: 'NORMAL',
    etiqueta: 'Normal',
    limiteCentavos: 10000000,
    limite: '$ 100.000,00',
    gastado: '$ 79.999,99',
    porcentaje: '80,0 %',
    ancho: 80,
    descripcion: 'Alimentación: Normal, $ 79.999,99 gastados de un límite de $ 100.000,00 (80,0 %)',
  });
});

test('T-21.3b / CA-09.1, CB-20: con $ 100.000,01 gastados la fila dice "Excedido" y 100,0 %, con la barra llena', () => {
  const fila = filaDePresupuesto(item({ gastadoCentavos: 10000001, porcentajeConsumo: 100, estado: 'EXCEDIDO' }));
  assert.equal(fila.etiqueta, 'Excedido');
  assert.equal(fila.estado, 'EXCEDIDO');
  assert.equal(fila.gastado, '$ 100.000,01');
  assert.equal(fila.porcentaje, '100,0 %');
  assert.equal(fila.ancho, 100);
});

test('T-21.3c: con más del 100 % la barra se queda en 100 y sin gastos queda en 0', () => {
  const pasado = filaDePresupuesto(item({ gastadoCentavos: 12000000, porcentajeConsumo: 120, estado: 'EXCEDIDO' }));
  assert.equal(pasado.porcentaje, '120,0 %');
  assert.equal(pasado.ancho, 100);

  const sinGastos = filaDePresupuesto(item({ gastadoCentavos: 0, porcentajeConsumo: 0 }));
  assert.equal(sinGastos.gastado, '$ 0,00');
  assert.equal(sinGastos.porcentaje, '0,0 %');
  assert.equal(sinGastos.ancho, 0);
});

const CATEGORIAS = [
  { id: 1, nombre: 'Alimentación', tipo: 'GASTO', activa: true, protegida: false },
  { id: 2, nombre: 'Ocio', tipo: 'GASTO', activa: false, protegida: false },
  { id: 3, nombre: 'Otros gastos', tipo: 'GASTO', activa: true, protegida: true },
  { id: 4, nombre: 'Sueldo', tipo: 'INGRESO', activa: true, protegida: false },
];

test('T-21.4 / RN-15, RN-09: categoriasParaLimite ofrece solo las de gasto activas y marca las que ya tienen límite', () => {
  assert.deepEqual(categoriasParaLimite(CATEGORIAS, [item()]), [
    { id: 1, nombre: 'Alimentación', limiteCentavos: 10000000 },
    { id: 3, nombre: 'Otros gastos', limiteCentavos: null },
  ]);

  // sin límites definidos, ninguna lo tiene
  assert.deepEqual(
    categoriasParaLimite(CATEGORIAS, []).map((c) => c.limiteCentavos),
    [null, null]
  );
  assert.deepEqual(categoriasParaLimite([], []), []);

  // no modifica lo recibido
  const congeladas = Object.freeze(CATEGORIAS.map((c) => Object.freeze({ ...c })));
  assert.equal(categoriasParaLimite(congeladas, Object.freeze([Object.freeze(item())])).length, 2);
  assert.equal(CATEGORIAS.length, 4);
});

test('T-21.4b: etiquetaDeOpcion agrega el límite actual solo si la categoría ya tiene uno', () => {
  assert.equal(
    etiquetaDeOpcion({ nombre: 'Alimentación', limiteCentavos: 10000000 }),
    'Alimentación (límite actual: $ 100.000,00)'
  );
  assert.equal(etiquetaDeOpcion({ nombre: 'Otros gastos', limiteCentavos: null }), 'Otros gastos');
});

test('T-21.5 / CA-08.1, RN-15: validarLimite acepta montos válidos y devuelve centavos', () => {
  const casos = [
    ['100.000', 10000000],
    ['100.000,50', 10000050],
    ['0,01', 1],
    ['999.999.999,99', 99999999999],
    [' 500 ', 50000],
    ['1234,5', 123450],
  ];
  for (const [texto, esperado] of casos) {
    assert.deepEqual(validarLimite(texto), { ok: true, valor: esperado }, `"${texto}"`);
  }
});

test('T-21.5b / CA-08.4: validarLimite rechaza 0, "12,345", vacíos, negativos, ambiguos y los mayores al máximo', () => {
  const invalidos = [
    '',
    '   ',
    '0',
    '0,00',
    '12,345',
    '-5',
    'abc',
    '1234.56',
    '1.000.000.000,00',
    '100000000000',
    undefined,
    null,
    100,
  ];
  for (const entrada of invalidos) {
    const resultado = validarLimite(entrada);
    assert.equal(resultado.ok, false, JSON.stringify(entrada));
    assert.equal(typeof resultado.error, 'string', JSON.stringify(entrada));
    assert.ok(resultado.error.length > 0, JSON.stringify(entrada));
    assert.equal(resultado.valor, undefined, JSON.stringify(entrada));
  }
});

test('T-21.6 / CA-09.1: sin presupuestos en alerta o excedidos no hay aviso', () => {
  assert.equal(avisoDeAlertas([]), null);
  assert.equal(avisoDeAlertas([item()]), null); // $ 79.999,99 sobre $ 100.000,00: normal
  assert.equal(avisoDeAlertas([item({ categoriaId: 2, categoriaNombre: 'Salud', gastadoCentavos: 0, porcentajeConsumo: 0 })]), null);
});

test('T-21.6b / CA-09.5: con un presupuesto en alerta el aviso lo nombra, con su estado y su porcentaje', () => {
  const aviso = avisoDeAlertas([item({ gastadoCentavos: 8000000, porcentajeConsumo: 80, estado: 'ALERTA' })]);
  assert.deepEqual(aviso, {
    titulo: 'Atención: 1 presupuesto está en alerta o excedido este mes.',
    lineas: [{ id: 1, estado: 'ALERTA', texto: 'Alimentación: Alerta, 80,0 % del límite de $ 100.000,00' }],
  });
});

test('T-21.6c / CA-09.5: con dos presupuestos el aviso los nombra en el orden recibido y deja afuera los normales', () => {
  const aviso = avisoDeAlertas([
    item({
      categoriaId: 5,
      categoriaNombre: 'Ocio',
      limiteCentavos: 100000,
      gastadoCentavos: 150000,
      porcentajeConsumo: 150,
      estado: 'EXCEDIDO',
    }),
    item({
      categoriaId: 2,
      categoriaNombre: 'Transporte',
      limiteCentavos: 1000000,
      gastadoCentavos: 900000,
      porcentajeConsumo: 90,
      estado: 'ALERTA',
    }),
    item(), // normal: no aparece
  ]);
  assert.equal(aviso.titulo, 'Atención: 2 presupuestos están en alerta o excedidos este mes.');
  assert.deepEqual(aviso.lineas, [
    { id: 5, estado: 'EXCEDIDO', texto: 'Ocio: Excedido, 150,0 % del límite de $ 1.000,00' },
    { id: 2, estado: 'ALERTA', texto: 'Transporte: Alerta, 90,0 % del límite de $ 10.000,00' },
  ]);
});

test('T-21.6d / CB-20: con $ 100.000,01 el aviso dice "Excedido, 100,0 %" y no modifica lo recibido', () => {
  const entrada = Object.freeze([
    Object.freeze(item({ gastadoCentavos: 10000001, porcentajeConsumo: 100, estado: 'EXCEDIDO' })),
  ]);
  const aviso = avisoDeAlertas(entrada);
  assert.equal(aviso.lineas[0].texto, 'Alimentación: Excedido, 100,0 % del límite de $ 100.000,00');
  assert.equal(aviso.lineas[0].estado, 'EXCEDIDO');
  assert.equal(entrada.length, 1);
});