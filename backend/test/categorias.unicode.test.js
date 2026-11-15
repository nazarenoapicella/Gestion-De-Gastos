import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revisarNombre } from '../src/categorias/categorias.service.js';

test('RN-06: los nombres cuentan puntos de código Unicode', () => {
  assert.deepEqual(revisarNombre('😀'.repeat(30)), { valor: '😀'.repeat(30) });
  assert.equal(revisarNombre('😀'.repeat(31)).error, 'El nombre no puede superar los 30 caracteres.');
  assert.deepEqual(revisarNombre('  A   😀  '), { valor: 'A 😀' });
});
