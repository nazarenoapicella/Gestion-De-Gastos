import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LARGO_MAXIMO_NOMBRE,
  accionesDe,
  agruparPorTipo,
  describirCategoria,
  limpiarNombre,
  validarNombre,
} from '../js/categorias.js';

test('T-19.1 / RN-06: limpiarNombre quita espacios de los extremos y reduce los repetidos a uno', () => {
  assert.equal(limpiarNombre('  Cine   y  teatro '), 'Cine y teatro');
  assert.equal(limpiarNombre('\tHola\n mundo'), 'Hola mundo');
  assert.equal(limpiarNombre('Mascotas'), 'Mascotas');
  assert.equal(limpiarNombre('   '), '');
});

test('T-19.2 / CA-07.1, CB-16: validarNombre acepta nombres de 1 a 30 caracteres y devuelve el nombre limpio', () => {
  const casos = [
    ['Mascotas', 'Mascotas'],
    ['  Mascotas ', 'Mascotas'],
    ['Cine   y  teatro', 'Cine y teatro'],
    ['A', 'A'],
    ['A'.repeat(30), 'A'.repeat(30)],
    ['Ñandú', 'Ñandú'],
  ];
  for (const [entrada, esperado] of casos) {
    assert.deepEqual(validarNombre(entrada), { ok: true, valor: esperado }, JSON.stringify(entrada));
  }
  assert.equal(LARGO_MAXIMO_NOMBRE, 30);
});

test('T-19.3 / CA-07.4, CB-16: validarNombre rechaza el nombre vacío, de espacios, de 31 caracteres o que no es texto', () => {
  const invalidos = ['', '   ', 'A'.repeat(31), undefined, null, 123, {}];
  for (const entrada of invalidos) {
    const resultado = validarNombre(entrada);
    assert.equal(resultado.ok, false, JSON.stringify(entrada));
    assert.equal(typeof resultado.error, 'string', JSON.stringify(entrada));
    assert.ok(resultado.error.length > 0, JSON.stringify(entrada));
    assert.equal(resultado.valor, undefined, JSON.stringify(entrada));
  }
});

// El largo se mide sobre el nombre ya limpio, como hace el servidor.
test('T-19.4 / RN-06: el largo se cuenta después de reducir los espacios', () => {
  // 14 + 5 espacios + 15 = 34 caracteres escritos; limpio son 14 + 1 + 15 = 30
  const justo = 'A'.repeat(14) + '     ' + 'B'.repeat(15);
  assert.deepEqual(validarNombre(justo), { ok: true, valor: 'A'.repeat(14) + ' ' + 'B'.repeat(15) });

  // 15 + 5 espacios + 15 = 35 escritos; limpio son 31
  const pasado = 'A'.repeat(15) + '     ' + 'B'.repeat(15);
  assert.equal(validarNombre(pasado).ok, false);

  // los espacios de los extremos no cuentan
  assert.equal(validarNombre('  ' + 'A'.repeat(30) + '  ').ok, true);
});

// Igual que el servidor, el largo se mide con .length: un emoji ocupa 2 unidades.
test('T-19.5: el largo se mide como en el servidor (un emoji cuenta como 2)', () => {
  assert.equal(validarNombre('😀'.repeat(15)).ok, true); // 30 unidades
  assert.equal(validarNombre('😀'.repeat(16)).ok, false); // 32 unidades
});

test('T-19.6: agruparPorTipo separa gastos e ingresos, conserva el orden y no modifica la lista', () => {
  const categorias = [
    { id: 1, nombre: 'Alimentación', tipo: 'GASTO', activa: true, protegida: false },
    { id: 4, nombre: 'Otros ingresos', tipo: 'INGRESO', activa: true, protegida: true },
    { id: 2, nombre: 'Ocio', tipo: 'GASTO', activa: false, protegida: false },
    { id: 5, nombre: 'Sueldo', tipo: 'INGRESO', activa: true, protegida: false },
  ];
  const grupos = agruparPorTipo(categorias);

  assert.deepEqual(
    grupos.GASTO.map((c) => c.id),
    [1, 2]
  );
  assert.deepEqual(
    grupos.INGRESO.map((c) => c.id),
    [4, 5]
  );
  assert.equal(categorias.length, 4);
  assert.deepEqual(agruparPorTipo([]), { GASTO: [], INGRESO: [] });
});

test('T-19.7 / RN-07, RN-09: las protegidas no tienen acciones; las demás, según estén activas o no', () => {
  const protegida = { id: 3, nombre: 'Otros gastos', tipo: 'GASTO', activa: true, protegida: true };
  const activa = { id: 1, nombre: 'Alimentación', tipo: 'GASTO', activa: true, protegida: false };
  const inactiva = { id: 2, nombre: 'Ocio', tipo: 'GASTO', activa: false, protegida: false };

  assert.deepEqual(accionesDe(protegida), []);
  assert.deepEqual(accionesDe(activa), ['renombrar', 'desactivar', 'eliminar']);
  assert.deepEqual(accionesDe(inactiva), ['renombrar', 'activar', 'eliminar']);
  // la protección manda aunque los datos estén en un estado raro
  assert.deepEqual(accionesDe({ ...protegida, activa: false }), []);
});

test('T-19.8: describirCategoria resume la categoría en una frase y rechaza un tipo desconocido', () => {
  assert.equal(
    describirCategoria({ nombre: 'Alimentación', tipo: 'GASTO', activa: true }),
    'Alimentación, categoría de gastos'
  );
  assert.equal(describirCategoria({ nombre: 'Sueldo', tipo: 'INGRESO', activa: true }), 'Sueldo, categoría de ingresos');
  assert.equal(
    describirCategoria({ nombre: 'Ocio', tipo: 'GASTO', activa: false }),
    'Ocio, categoría de gastos, desactivada'
  );
  assert.throws(() => describirCategoria({ nombre: 'X', tipo: 'OTRO', activa: true }), TypeError);
});