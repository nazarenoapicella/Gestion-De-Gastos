import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Trazabilidad (T-22): cada regla de negocio y cada caso borde de la spec tiene que estar nombrado en al
// menos un test o ítem manual. "Nombrado" no significa "bien cubierto": qué prueba cubre qué lo dice
// docs/trazabilidad.md. Esta prueba solo asegura que ninguna regla ni caso borde quede sin ningún nombre.

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const leer = (...partes) => fs.readFileSync(path.join(raiz, ...partes), 'utf8');

// Los archivos de pruebas de una carpeta (menos este mismo, para que no se cuente a sí mismo).
function textosDeTests(...carpeta) {
  const ruta = path.join(raiz, ...carpeta);
  return fs
    .readdirSync(ruta)
    .filter((nombre) => nombre.endsWith('.js') && nombre !== 'trazabilidad.test.js')
    .map((nombre) => fs.readFileSync(path.join(ruta, nombre), 'utf8'));
}

test('T-22.7: cada RN y cada CB de la spec está nombrado en algún test o ítem manual', () => {
  const spec = leer('docs', 'spec.md');
  const reglas = [...spec.matchAll(/\*\*(RN-\d{2})\*\*/g)].map((m) => m[1]);
  const casosBorde = [...spec.matchAll(/\|\s*(CB-\d{2})\s*\|/g)].map((m) => m[1]);

  // Sin esto, un cambio en el formato de la spec haría que no se encuentre nada y la prueba pasaría vacía.
  assert.equal(reglas.length, 17, 'se esperaban 17 reglas de negocio en la spec');
  assert.equal(casosBorde.length, 26, 'se esperaban 26 casos borde en la spec');

  const corpus = [
    ...textosDeTests('backend', 'test'),
    ...textosDeTests('frontend', 'test'),
    leer('docs', 'pruebas-manuales.md'),
  ].join('\n');

  const sinNombrar = [...reglas, ...casosBorde].filter((id) => !new RegExp(`\\b${id}\\b`).test(corpus));
  assert.deepEqual(sinNombrar, [], `Sin nombrar en ningún test ni ítem manual: ${sinNombrar.join(', ')}`);
});