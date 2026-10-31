import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBase, inicializarEsquema } from '../src/db/index.js';
import { sembrarCategorias } from '../src/db/seed.js';

function baseVacia() {
  const db = abrirBase(':memory:');
  inicializarEsquema(db);
  return db;
}

function baseConSeed() {
  const db = baseVacia();
  sembrarCategorias(db);
  return db;
}

function idDe(db, nombre, tipo = 'GASTO') {
  return db.prepare('SELECT id FROM categorias WHERE nombre = ? AND tipo = ?').get(nombre, tipo).id;
}

function insertarMovimiento(db, montoCentavos, categoriaId) {
  return db
    .prepare(
      `INSERT INTO movimientos (monto_centavos, fecha, categoria_id, descripcion, creado_en)
       VALUES (?, '2026-10-30', ?, NULL, '2026-10-30T15:00:00.000Z')`
    )
    .run(montoCentavos, categoriaId);
}

test('T-02.1: la base inicializada tiene las tablas categorias, movimientos y presupuestos', () => {
  const db = baseVacia();
  const tablas = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((fila) => fila.name)
    .sort();
  assert.deepEqual(tablas, ['categorias', 'movimientos', 'presupuestos']);
});

test('T-02.2 / RN-07: el seed crea 11 categorías por defecto, todas activas', () => {
  const db = baseConSeed();

  const gastos = db
    .prepare("SELECT nombre FROM categorias WHERE tipo = 'GASTO'")
    .all()
    .map((f) => f.nombre)
    .sort();
  const ingresos = db
    .prepare("SELECT nombre FROM categorias WHERE tipo = 'INGRESO'")
    .all()
    .map((f) => f.nombre)
    .sort();

  assert.deepEqual(
    gastos,
    ['Alimentación', 'Transporte', 'Vivienda', 'Servicios', 'Salud', 'Ocio', 'Educación', 'Otros gastos'].sort()
  );
  assert.deepEqual(ingresos, ['Sueldo', 'Ventas', 'Otros ingresos'].sort());

  const inactivas = db.prepare('SELECT COUNT(*) AS n FROM categorias WHERE activa = 0').get().n;
  assert.equal(inactivas, 0);
});

test('T-02.3 / RN-07: solo "Otros gastos" y "Otros ingresos" son protegidas', () => {
  const db = baseConSeed();
  const protegidas = db
    .prepare('SELECT nombre FROM categorias WHERE protegida = 1')
    .all()
    .map((f) => f.nombre)
    .sort();
  assert.deepEqual(protegidas, ['Otros gastos', 'Otros ingresos']);
});

test('T-02.4: ejecutar el seed dos veces sigue dejando 11 categorías', () => {
  const db = baseVacia();
  sembrarCategorias(db);
  sembrarCategorias(db);
  const total = db.prepare('SELECT COUNT(*) AS n FROM categorias').get().n;
  assert.equal(total, 11);
});

test('T-02.5 / RN-06: no se puede repetir el nombre normalizado dentro del mismo tipo', () => {
  const db = baseConSeed();
  assert.throws(
    () =>
      db
        .prepare(
          "INSERT INTO categorias (nombre, nombre_normalizado, tipo) VALUES ('alimentacion', 'alimentacion', 'GASTO')"
        )
        .run(),
    /UNIQUE/
  );
});

test('T-02.6 / RN-02: el monto debe estar entre 1 y 99999999999 centavos', () => {
  const db = baseConSeed();
  const categoriaId = idDe(db, 'Alimentación');

  assert.throws(() => insertarMovimiento(db, 0, categoriaId), /CHECK/);
  assert.throws(() => insertarMovimiento(db, 100000000000, categoriaId), /CHECK/);
  assert.doesNotThrow(() => insertarMovimiento(db, 1, categoriaId));
});

test('T-02.7: no se puede insertar un movimiento con una categoría inexistente', () => {
  const db = baseConSeed();
  assert.throws(() => insertarMovimiento(db, 100, 9999), /FOREIGN KEY/);
});