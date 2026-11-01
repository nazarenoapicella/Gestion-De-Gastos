import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEntorno } from './helpers.js';

const CREADO_EN = '2026-10-01T10:00:00.000Z';

function idDe(db, nombre, tipo = 'GASTO') {
  return db.prepare('SELECT id FROM categorias WHERE nombre = ? AND tipo = ?').get(nombre, tipo).id;
}

// Inserta directo en la base: permite fechas futuras y no depende de las rutas de alta.
function insertarMovimiento(
  db,
  { fecha, categoria = 'Alimentación', tipo = 'GASTO', montoCentavos = 100000, descripcion = null }
) {
  const resultado = db
    .prepare(
      `INSERT INTO movimientos (monto_centavos, fecha, categoria_id, descripcion, creado_en)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(montoCentavos, fecha, idDe(db, categoria, tipo), descripcion, CREADO_EN);
  return Number(resultado.lastInsertRowid);
}

const dos = (n) => String(n).padStart(2, '0');
const fechasDe = (cuerpo) => cuerpo.items.map((item) => item.fecha);

// 25 gastos en octubre 2026 (días 1 a 25; los impares en Alimentación y los pares en Transporte)
// y 2 ingresos en septiembre 2026. Se insertan en orden de fecha, así que el id crece con el día.
function cargarDatosBase(db) {
  for (let i = 1; i <= 25; i++) {
    insertarMovimiento(db, {
      fecha: `2026-10-${dos(i)}`,
      categoria: i % 2 === 1 ? 'Alimentación' : 'Transporte',
      montoCentavos: i * 1000,
      descripcion: `Gasto ${i}`,
    });
  }
  insertarMovimiento(db, {
    fecha: '2026-09-05',
    categoria: 'Sueldo',
    tipo: 'INGRESO',
    montoCentavos: 10000000,
    descripcion: 'Sueldo de septiembre',
  });
  insertarMovimiento(db, {
    fecha: '2026-09-20',
    categoria: 'Ventas',
    tipo: 'INGRESO',
    montoCentavos: 500000,
    descripcion: 'Venta',
  });
}

test('T-11.1 / CA-02.3: 25 movimientos en el mes se muestran en 2 páginas de 20 y 5, de la más nueva a la más vieja', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);

    const p1 = await pedir('GET', '/api/movimientos?mes=2026-10');
    assert.equal(p1.status, 200);
    assert.equal(p1.cuerpo.total, 25);
    assert.equal(p1.cuerpo.tamanioPagina, 20);
    assert.equal(p1.cuerpo.totalPaginas, 2);
    assert.equal(p1.cuerpo.pagina, 1);
    assert.equal(p1.cuerpo.items.length, 20);
    assert.equal(fechasDe(p1.cuerpo)[0], '2026-10-25');
    assert.equal(fechasDe(p1.cuerpo)[19], '2026-10-06');

    // forma completa de un elemento del listado
    const idDelUltimo = db.prepare("SELECT id FROM movimientos WHERE descripcion = 'Gasto 25'").get().id;
    assert.deepEqual(p1.cuerpo.items[0], {
      id: idDelUltimo,
      tipo: 'GASTO',
      montoCentavos: 25000,
      fecha: '2026-10-25',
      categoriaId: idDe(db, 'Alimentación'),
      categoriaNombre: 'Alimentación',
      categoriaActiva: true,
      descripcion: 'Gasto 25',
      creadoEn: CREADO_EN,
    });

    const p2 = await pedir('GET', '/api/movimientos?mes=2026-10&pagina=2');
    assert.equal(p2.status, 200);
    assert.equal(p2.cuerpo.pagina, 2);
    assert.equal(p2.cuerpo.total, 25);
    assert.equal(p2.cuerpo.items.length, 5);
    assert.equal(fechasDe(p2.cuerpo)[0], '2026-10-05');
    assert.equal(fechasDe(p2.cuerpo)[4], '2026-10-01');

    // entre las dos páginas están los 25, sin repetir y en orden descendente
    const todos = [...p1.cuerpo.items, ...p2.cuerpo.items];
    assert.equal(new Set(todos.map((m) => m.id)).size, 25);
    const fechas = todos.map((m) => m.fecha);
    assert.deepEqual(fechas, [...fechas].sort().reverse());
  }));

test('T-11.2 / CA-02.1, CB-24: con la misma fecha aparece primero el de mayor id (el último cargado)', () =>
  conEntorno(async ({ db, pedir }) => {
    const a = insertarMovimiento(db, { fecha: '2026-10-15', descripcion: 'Primero' });
    const b = insertarMovimiento(db, { fecha: '2026-10-15', descripcion: 'Segundo' });
    const c = insertarMovimiento(db, { fecha: '2026-10-20', descripcion: 'Fecha más nueva' });
    const d = insertarMovimiento(db, { fecha: '2026-10-01', descripcion: 'Fecha más vieja' });

    const { status, cuerpo } = await pedir('GET', '/api/movimientos?mes=2026-10');
    assert.equal(status, 200);
    assert.deepEqual(
      cuerpo.items.map((m) => m.id),
      [c, b, a, d]
    );
  }));

test('T-11.3 / CA-02.2: el filtro tipo separa gastos de ingresos', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);

    const ingresosDeOctubre = await pedir('GET', '/api/movimientos?mes=2026-10&tipo=INGRESO');
    assert.equal(ingresosDeOctubre.status, 200);
    assert.deepEqual(ingresosDeOctubre.cuerpo.items, []);
    assert.equal(ingresosDeOctubre.cuerpo.total, 0);

    const ingresosDeSeptiembre = await pedir('GET', '/api/movimientos?mes=2026-09&tipo=INGRESO');
    assert.equal(ingresosDeSeptiembre.cuerpo.total, 2);
    assert.ok(ingresosDeSeptiembre.cuerpo.items.every((m) => m.tipo === 'INGRESO'));

    const gastosDeOctubre = await pedir('GET', '/api/movimientos?mes=2026-10&tipo=GASTO');
    assert.equal(gastosDeOctubre.cuerpo.total, 25);
  }));

test('T-11.4 / CA-02.2: mes, tipo y categoría se combinan (deben cumplirse los tres)', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);
    const transporte = idDe(db, 'Transporte');
    const alimentacion = idDe(db, 'Alimentación');

    const soloTransporte = await pedir(
      'GET',
      `/api/movimientos?mes=2026-10&tipo=GASTO&categoriaId=${transporte}`
    );
    assert.equal(soloTransporte.status, 200);
    assert.equal(soloTransporte.cuerpo.total, 12);
    assert.equal(soloTransporte.cuerpo.items.length, 12);
    assert.equal(soloTransporte.cuerpo.totalPaginas, 1);
    assert.ok(soloTransporte.cuerpo.items.every((m) => m.categoriaNombre === 'Transporte'));

    // una categoría de gasto con el tipo INGRESO no encuentra nada
    const tipoContrario = await pedir(
      'GET',
      `/api/movimientos?mes=2026-10&tipo=INGRESO&categoriaId=${alimentacion}`
    );
    assert.equal(tipoContrario.cuerpo.total, 0);

    // la misma categoría en otro mes tampoco
    const otroMes = await pedir('GET', `/api/movimientos?mes=2026-09&categoriaId=${alimentacion}`);
    assert.equal(otroMes.cuerpo.total, 0);
  }));

test('T-11.5 / CA-02.4, CB-21: un mes sin movimientos responde 200 con la lista vacía, no un error', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);

    const septiembre = await pedir('GET', '/api/movimientos?mes=2026-09');
    assert.equal(septiembre.status, 200);
    assert.equal(septiembre.cuerpo.total, 2);
    assert.equal(septiembre.cuerpo.items.length, 2);

    for (const mes of ['2026-11', '2026-08']) {
      const { status, cuerpo } = await pedir('GET', `/api/movimientos?mes=${mes}`);
      assert.equal(status, 200, mes);
      assert.deepEqual(cuerpo.items, [], mes);
      assert.equal(cuerpo.total, 0, mes);
    }
  }));

test('T-11.6 / RN-11: sin mes se incluyen todos los meses', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);

    const { status, cuerpo } = await pedir('GET', '/api/movimientos');
    assert.equal(status, 200);
    assert.equal(cuerpo.total, 27);
    assert.equal(cuerpo.totalPaginas, 2);
    assert.equal(cuerpo.items.length, 20);
    assert.equal(cuerpo.items[0].fecha, '2026-10-25');
  }));

test('T-11.7 / CA-02.5: una página posterior a la última llega vacía, con el total correcto', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);

    const { status, cuerpo } = await pedir('GET', '/api/movimientos?mes=2026-10&pagina=99');
    assert.equal(status, 200);
    assert.deepEqual(cuerpo.items, []);
    assert.equal(cuerpo.total, 25);
    assert.equal(cuerpo.pagina, 99);
    assert.equal(cuerpo.totalPaginas, 2);
  }));

test('T-11.8 / CB-22: un mes mal formado da 400 MES_INVALIDO y una página inválida da 400 VALIDACION', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);

    for (const mes of ['2026-13', '2026-1', '2026-00']) {
      const { status, cuerpo } = await pedir('GET', `/api/movimientos?mes=${mes}`);
      assert.equal(status, 400, mes);
      assert.equal(cuerpo.error.codigo, 'MES_INVALIDO', mes);
    }

    for (const pagina of ['0', 'abc']) {
      const { status, cuerpo } = await pedir('GET', `/api/movimientos?pagina=${pagina}`);
      assert.equal(status, 400, pagina);
      assert.equal(cuerpo.error.codigo, 'VALIDACION', pagina);
      assert.ok(cuerpo.error.campos.pagina, pagina);
    }
  }));

test('T-11.9 / RN-09: un movimiento de una categoría desactivada aparece con categoriaActiva en false', () =>
  conEntorno(async ({ db, pedir }) => {
    insertarMovimiento(db, { fecha: '2026-10-10', categoria: 'Ocio', descripcion: 'Cine' });
    insertarMovimiento(db, { fecha: '2026-10-11', categoria: 'Alimentación', descripcion: 'Pan' });
    db.prepare('UPDATE categorias SET activa = 0 WHERE id = ?').run(idDe(db, 'Ocio'));

    const { status, cuerpo } = await pedir('GET', '/api/movimientos?mes=2026-10');
    assert.equal(status, 200);
    assert.equal(cuerpo.total, 2);

    const cine = cuerpo.items.find((m) => m.descripcion === 'Cine');
    assert.equal(cine.categoriaNombre, 'Ocio');
    assert.equal(cine.categoriaActiva, false);

    const pan = cuerpo.items.find((m) => m.descripcion === 'Pan');
    assert.equal(pan.categoriaActiva, true);
  }));

test('T-11.10 / CB-12: el último día del mes cuenta en ese mes y no en el siguiente', () =>
  conEntorno(async ({ db, pedir }) => {
    for (const fecha of ['2026-09-30', '2026-10-01', '2026-10-31', '2026-11-01']) {
      insertarMovimiento(db, { fecha });
    }

    const octubre = await pedir('GET', '/api/movimientos?mes=2026-10');
    assert.deepEqual(fechasDe(octubre.cuerpo), ['2026-10-31', '2026-10-01']);

    const noviembre = await pedir('GET', '/api/movimientos?mes=2026-11');
    assert.deepEqual(fechasDe(noviembre.cuerpo), ['2026-11-01']);

    const septiembre = await pedir('GET', '/api/movimientos?mes=2026-09');
    assert.deepEqual(fechasDe(septiembre.cuerpo), ['2026-09-30']);
  }));

// Agregado: los filtros mal escritos se rechazan en vez de ignorarse.
test('T-11.11: un tipo o una categoriaId inválidos dan 400 con el campo', () =>
  conEntorno(async ({ db, pedir }) => {
    for (const tipo of ['OTRO', 'gasto']) {
      const { status, cuerpo } = await pedir('GET', `/api/movimientos?tipo=${tipo}`);
      assert.equal(status, 400, tipo);
      assert.equal(cuerpo.error.codigo, 'VALIDACION', tipo);
      assert.ok(cuerpo.error.campos.tipo, tipo);
    }

    for (const categoriaId of ['abc', '1.5', '-1', '']) {
      const { status, cuerpo } = await pedir('GET', `/api/movimientos?categoriaId=${categoriaId}`);
      assert.equal(status, 400, `categoriaId="${categoriaId}"`);
      assert.ok(cuerpo.error.campos.categoriaId, `categoriaId="${categoriaId}"`);
    }
  }));

// Agregado: la categoría es un filtro, no un recurso que se busca: una que no existe no encuentra nada.
test('T-11.12: una categoriaId que no existe responde 200 con la lista vacía', () =>
  conEntorno(async ({ db, pedir }) => {
    cargarDatosBase(db);

    const { status, cuerpo } = await pedir('GET', '/api/movimientos?categoriaId=9999');
    assert.equal(status, 200);
    assert.deepEqual(cuerpo.items, []);
    assert.equal(cuerpo.total, 0);
  }));

// Agregado: se informan todos los errores a la vez, igual que en el alta.
test('T-11.13: con tipo, categoriaId y página inválidos a la vez, el error informa los tres campos', () =>
  conEntorno(async ({ pedir }) => {
    const { status, cuerpo } = await pedir('GET', '/api/movimientos?tipo=OTRO&categoriaId=abc&pagina=0');
    assert.equal(status, 400);
    assert.equal(cuerpo.error.codigo, 'VALIDACION');
    assert.ok(cuerpo.error.campos.tipo);
    assert.ok(cuerpo.error.campos.categoriaId);
    assert.ok(cuerpo.error.campos.pagina);
  }));

// Agregado: los bordes de la paginación (0, 20 y 21 resultados).
test('T-11.14: totalPaginas es 0 sin resultados, 1 con 20 y 2 con 21', () =>
  conEntorno(async ({ db, pedir }) => {
    const vacio = await pedir('GET', '/api/movimientos?mes=2026-10');
    assert.equal(vacio.cuerpo.total, 0);
    assert.equal(vacio.cuerpo.totalPaginas, 0);
    assert.deepEqual(vacio.cuerpo.items, []);

    for (let i = 1; i <= 20; i++) insertarMovimiento(db, { fecha: `2026-10-${dos(i)}` });
    const justo = await pedir('GET', '/api/movimientos?mes=2026-10');
    assert.equal(justo.cuerpo.total, 20);
    assert.equal(justo.cuerpo.totalPaginas, 1);
    assert.equal(justo.cuerpo.items.length, 20);

    const sobra = await pedir('GET', '/api/movimientos?mes=2026-10&pagina=2');
    assert.deepEqual(sobra.cuerpo.items, []);

    insertarMovimiento(db, { fecha: '2026-10-21' });
    const veintiuno = await pedir('GET', '/api/movimientos?mes=2026-10&pagina=2');
    assert.equal(veintiuno.cuerpo.total, 21);
    assert.equal(veintiuno.cuerpo.totalPaginas, 2);
    assert.equal(veintiuno.cuerpo.items.length, 1);
  }));

// Agregado: un parámetro repetido llega como lista y no es un valor válido.
test('T-11.15: un parámetro repetido (mes o tipo dos veces) da 400', () =>
  conEntorno(async ({ pedir }) => {
    const mes = await pedir('GET', '/api/movimientos?mes=2026-10&mes=2026-09');
    assert.equal(mes.status, 400);
    assert.equal(mes.cuerpo.error.codigo, 'MES_INVALIDO');

    const tipo = await pedir('GET', '/api/movimientos?tipo=GASTO&tipo=INGRESO');
    assert.equal(tipo.status, 400);
    assert.ok(tipo.cuerpo.error.campos.tipo);
  }));