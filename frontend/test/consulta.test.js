import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  categoriasParaFiltro,
  construirQuery,
  describirMovimiento,
  describirPagina,
  mensajeSinResultados,
  mesDe,
  mesesDisponibles,
  montoConSigno,
  nombreDeCategoria,
  paginaValida,
  textoDeTipo,
} from '../js/consulta.js';

test('T-18.1: construirQuery arma mes, tipo, categoriaId y pagina, en ese orden', () => {
  assert.equal(
    construirQuery({ mes: '2026-10', tipo: 'GASTO', categoriaId: 3, pagina: 2 }),
    'mes=2026-10&tipo=GASTO&categoriaId=3&pagina=2'
  );
  // el orden no depende del orden de las claves del objeto
  assert.equal(
    construirQuery({ pagina: 2, categoriaId: 3, tipo: 'GASTO', mes: '2026-10' }),
    'mes=2026-10&tipo=GASTO&categoriaId=3&pagina=2'
  );
});

test('T-18.2 / RN-11: construirQuery omite los valores vacíos (tipo "" y categoriaId null)', () => {
  assert.equal(construirQuery({ mes: '2026-10', tipo: '', categoriaId: null }), 'mes=2026-10');
});

test('T-18.2b: construirQuery sin valores devuelve "", acepta números y textos, conserva pagina 1 e ignora claves desconocidas', () => {
  assert.equal(construirQuery(), '');
  assert.equal(construirQuery(null), '');
  assert.equal(construirQuery({}), '');
  assert.equal(construirQuery({ mes: '', tipo: undefined, categoriaId: '', pagina: null }), '');
  assert.equal(construirQuery({ categoriaId: '3' }), 'categoriaId=3');
  assert.equal(construirQuery({ categoriaId: 3 }), 'categoriaId=3');
  assert.equal(construirQuery({ pagina: 1 }), 'pagina=1');
  assert.equal(construirQuery({ otro: 'x', mes: '2026-10' }), 'mes=2026-10');
});

test('T-18.2c: construirQuery codifica los caracteres especiales', () => {
  assert.equal(construirQuery({ tipo: 'A B&C' }), 'tipo=A%20B%26C');
});

test('T-18.3: mesDe saca el mes (AAAA-MM) de una fecha y rechaza lo que no es una fecha', () => {
  assert.equal(mesDe('2026-10-30'), '2026-10');
  assert.equal(mesDe('2026-01-05'), '2026-01');
  assert.equal(mesDe('2000-12-31'), '2000-12');

  for (const valor of ['2026-13-01', '2026-00-10', '2026-10', '30/10/2026', '', undefined, null, 20261030]) {
    assert.throws(() => mesDe(valor), TypeError, String(valor));
  }
});

test('T-18.4 / RN-11: mesesDisponibles va del mes actual a enero de 2000, del más nuevo al más viejo', () => {
  const meses = mesesDisponibles('2026-10-30');

  assert.equal(meses.length, 322); // 26 años completos (2000 a 2025) y 10 meses de 2026
  assert.equal(meses[0], '2026-10');
  assert.equal(meses[1], '2026-09');
  assert.equal(meses.at(-1), '2000-01');
  assert.equal(meses.indexOf('2026-01'), 9);
  assert.equal(meses[10], '2025-12'); // el cambio de año
  assert.equal(new Set(meses).size, meses.length);
  assert.deepEqual(meses, [...meses].sort().reverse());
  for (const mes of meses) assert.match(mes, /^\d{4}-(0[1-9]|1[0-2])$/);
});

test('T-18.4b: mesesDisponibles en los bordes (enero de 2000, antes de 2000, entrada inválida)', () => {
  assert.deepEqual(mesesDisponibles('2000-01-15'), ['2000-01']);
  assert.deepEqual(mesesDisponibles('2000-02-01'), ['2000-02', '2000-01']);
  assert.deepEqual(mesesDisponibles('1999-12-31'), []);
  assert.throws(() => mesesDisponibles('2026-13-01'), TypeError);
  assert.throws(() => mesesDisponibles(undefined), TypeError);
});

const CATEGORIAS = [
  { id: 1, nombre: 'Alimentación', tipo: 'GASTO', activa: true, protegida: false },
  { id: 2, nombre: 'Ocio', tipo: 'GASTO', activa: false, protegida: false },
  { id: 3, nombre: 'Otros gastos', tipo: 'GASTO', activa: true, protegida: true },
  { id: 4, nombre: 'Otros ingresos', tipo: 'INGRESO', activa: true, protegida: true },
  { id: 5, nombre: 'Sueldo', tipo: 'INGRESO', activa: true, protegida: false },
  { id: 6, nombre: 'Ventas', tipo: 'INGRESO', activa: false, protegida: false },
];

const ids = (lista) => lista.map((c) => c.id);

test('T-18.5 / RN-09: categoriasParaFiltro ofrece las del tipo elegido, desactivadas incluidas, y todas si no hay tipo', () => {
  assert.deepEqual(ids(categoriasParaFiltro(CATEGORIAS, '')), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(ids(categoriasParaFiltro(CATEGORIAS, undefined)), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(ids(categoriasParaFiltro(CATEGORIAS, 'GASTO')), [1, 2, 3]);
  assert.deepEqual(ids(categoriasParaFiltro(CATEGORIAS, 'INGRESO')), [4, 5, 6]);
  assert.deepEqual(categoriasParaFiltro(CATEGORIAS, 'OTRO'), []);
  assert.deepEqual(categoriasParaFiltro([], 'GASTO'), []);
  // devuelve una copia: la lista original no se toca
  assert.notEqual(categoriasParaFiltro(CATEGORIAS, ''), CATEGORIAS);
  assert.equal(CATEGORIAS.length, 6);
});

test('T-18.6: describirPagina escribe qué movimientos se están viendo', () => {
  const casos = [
    [{ pagina: 1, tamanioPagina: 20, total: 25 }, 'Mostrando 1–20 de 25 movimientos'],
    [{ pagina: 2, tamanioPagina: 20, total: 25 }, 'Mostrando 21–25 de 25 movimientos'],
    [{ pagina: 1, tamanioPagina: 20, total: 20 }, 'Mostrando 1–20 de 20 movimientos'],
    [{ pagina: 1, tamanioPagina: 20, total: 2 }, 'Mostrando 1–2 de 2 movimientos'],
    [{ pagina: 1, tamanioPagina: 20, total: 1 }, '1 movimiento'],
    [{ pagina: 1, tamanioPagina: 20, total: 0 }, '0 movimientos'],
    [{ pagina: 99, tamanioPagina: 20, total: 25 }, '25 movimientos'], // página fuera de rango
  ];
  for (const [entrada, esperado] of casos) {
    assert.equal(describirPagina(entrada), esperado, JSON.stringify(entrada));
  }
});

test('T-18.7 / CA-02.4: mensajeSinResultados explica por qué no hay nada, según el mes y los filtros', () => {
  assert.equal(mensajeSinResultados({ mes: '2026-10', tipo: '', categoriaId: '' }), 'No hay movimientos en este mes.');
  assert.equal(mensajeSinResultados({ mes: '2026-10', tipo: null, categoriaId: null }), 'No hay movimientos en este mes.');
  assert.equal(
    mensajeSinResultados({ mes: '2026-10', tipo: 'GASTO', categoriaId: '' }),
    'No hay movimientos en este mes con los filtros elegidos.'
  );
  assert.equal(
    mensajeSinResultados({ mes: '2026-10', tipo: '', categoriaId: '3' }),
    'No hay movimientos en este mes con los filtros elegidos.'
  );
  assert.equal(
    mensajeSinResultados({ mes: '', tipo: '', categoriaId: '' }),
    'Todavía no cargaste ningún movimiento.'
  );
  assert.equal(
    mensajeSinResultados({ mes: '', tipo: 'INGRESO', categoriaId: '' }),
    'No hay movimientos con los filtros elegidos.'
  );
});

test('T-18.8: paginaValida corrige una página que quedó fuera de rango (por ejemplo, tras eliminar)', () => {
  const casos = [
    [{ pagina: 2, totalPaginas: 2 }, 2],
    [{ pagina: 1, totalPaginas: 1 }, 1],
    [{ pagina: 3, totalPaginas: 2 }, 2],
    [{ pagina: 99, totalPaginas: 2 }, 2],
    [{ pagina: 1, totalPaginas: 0 }, 1],
    [{ pagina: 5, totalPaginas: 0 }, 1],
  ];
  for (const [entrada, esperado] of casos) {
    assert.equal(paginaValida(entrada), esperado, JSON.stringify(entrada));
  }
});

test('T-18.9: textoDeTipo escribe el tipo en español y rechaza cualquier otro valor', () => {
  assert.equal(textoDeTipo('GASTO'), 'Gasto');
  assert.equal(textoDeTipo('INGRESO'), 'Ingreso');
  for (const valor of ['OTRO', 'gasto', '', undefined, null, 'constructor']) {
    assert.throws(() => textoDeTipo(valor), TypeError, String(valor));
  }
});

test('T-18.10 / CA-02.1: montoConSigno marca el gasto con "-" y el ingreso con "+"', () => {
  assert.equal(montoConSigno('GASTO', 123456), '-$ 1.234,56');
  assert.equal(montoConSigno('INGRESO', 50000000), '+$ 500.000,00');
  assert.equal(montoConSigno('GASTO', 1), '-$ 0,01');
  assert.equal(montoConSigno('INGRESO', 99999999999), '+$ 999.999.999,99');

  assert.throws(() => montoConSigno('OTRO', 100), TypeError);
  assert.throws(() => montoConSigno('GASTO', 12.5), TypeError);
  assert.throws(() => montoConSigno('GASTO', '100'), TypeError);
  assert.throws(() => montoConSigno('GASTO', -100), TypeError);
});

test('T-18.11 / RN-09: nombreDeCategoria agrega "(desactivada)" cuando corresponde', () => {
  assert.equal(nombreDeCategoria({ categoriaNombre: 'Alimentación', categoriaActiva: true }), 'Alimentación');
  assert.equal(nombreDeCategoria({ categoriaNombre: 'Ocio', categoriaActiva: false }), 'Ocio (desactivada)');
});

test('T-18.12: describirMovimiento resume un movimiento en una frase', () => {
  const gasto = {
    id: 1,
    tipo: 'GASTO',
    montoCentavos: 123456,
    fecha: '2026-10-29',
    categoriaId: 1,
    categoriaNombre: 'Alimentación',
    categoriaActiva: true,
    descripcion: 'Supermercado',
    creadoEn: '2026-10-30T15:00:00.000Z',
  };
  assert.equal(
    describirMovimiento(gasto),
    'Gasto de $ 1.234,56 del 29/10/2026, categoría Alimentación, descripción Supermercado'
  );

  assert.equal(
    describirMovimiento({
      ...gasto,
      tipo: 'INGRESO',
      montoCentavos: 50000000,
      fecha: '2026-10-05',
      categoriaNombre: 'Sueldo',
      descripcion: null,
    }),
    'Ingreso de $ 500.000,00 del 05/10/2026, categoría Sueldo'
  );

  assert.equal(
    describirMovimiento({ ...gasto, categoriaNombre: 'Ocio', categoriaActiva: false, descripcion: null }),
    'Gasto de $ 1.234,56 del 29/10/2026, categoría Ocio (desactivada)'
  );
});