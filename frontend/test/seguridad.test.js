import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CB-26 y rules/frontend.md: el texto que ingresa la persona o que viene de la API nunca se inserta como
// HTML. La forma de garantizarlo es no usar nunca las funciones que interpretan HTML.

const carpetaJs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'js');
const PELIGROSOS = /\b(innerHTML|outerHTML|insertAdjacentHTML)\b|document\.write\s*\(/;

// Los comentarios del código mencionan "innerHTML" para explicar la regla; no cuentan como uso.
function sinComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

test('T-22.6 / CB-26: ningún archivo de frontend/js usa innerHTML, outerHTML, insertAdjacentHTML ni document.write', () => {
  const archivos = fs.readdirSync(carpetaJs, { recursive: true }).filter((nombre) => nombre.endsWith('.js'));
  assert.ok(archivos.length >= 10, `se esperaban al menos 10 archivos de código y se encontraron ${archivos.length}`);

  const usos = [];
  for (const archivo of archivos) {
    const codigo = sinComentarios(fs.readFileSync(path.join(carpetaJs, archivo), 'utf8'));
    codigo.split('\n').forEach((linea, i) => {
      if (PELIGROSOS.test(linea)) usos.push(`${archivo}:${i + 1}: ${linea.trim()}`);
    });
  }
  assert.deepEqual(usos, [], `Se inserta HTML sin escapar en:\n${usos.join('\n')}`);
});