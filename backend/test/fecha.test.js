import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoy, validarFechaMovimiento, validarMes, rangoDeMes } from '../src/utils/fecha.js';
import { ErrorDeNegocio } from '../src/errores.js';

const HOY = '2026-10-30';

// Reloj fijo: devuelve siempre el instante indicado (en UTC).
const relojEn = (iso) => () => new Date(iso);

function assertRechazaFecha(valor, fechaHoy = HOY) {
  assert.throws(
    () => validarFechaMovimiento(valor, fechaHoy),
    (err) => {
      assert.ok(err instanceof ErrorDeNegocio, 'debe ser un ErrorDeNegocio');
      assert.equal(err.status, 400);
      assert.equal(err.codigo, 'VALIDACION');
      assert.ok(err.campos.fecha, 'debe informar el campo fecha');
      return true;
    }
  );
}

function assertRechazaMes(valor) {
  assert.throws(
    () => validarMes(valor),
    (err) => {
      assert.ok(err instanceof ErrorDeNegocio, 'debe ser un ErrorDeNegocio');
      assert.equal(err.status, 400);
      assert.equal(err.codigo, 'MES_INVALIDO');
      return true;
    }
  );
}

test('T-04.1 / CB-11: a las 22:30 del 30/10 en Argentina (01:30 UTC del 31/10), hoy es 2026-10-30', () => {
  assert.equal(hoy(relojEn('2026-10-31T01:30:00Z')), '2026-10-30');
});

test('T-04.2: con el reloj en 2026-10-30T15:00:00Z, hoy es 2026-10-30', () => {
  assert.equal(hoy(relojEn('2026-10-30T15:00:00Z')), '2026-10-30');
});

// Agregado: el cambio de día ocurre justo a las 03:00 UTC (00:00 en Buenos Aires).
test('T-04.2b: el día cambia a las 00:00 de Buenos Aires (03:00 UTC)', () => {
  assert.equal(hoy(relojEn('2026-10-30T02:59:59Z')), '2026-10-29');
  assert.equal(hoy(relojEn('2026-10-30T03:00:00Z')), '2026-10-30');
});

test('T-04.3 / RN-03: acepta de 2000-01-01 a hoy inclusive; rechaza mañana y antes de 2000', () => {
  assert.equal(validarFechaMovimiento('2026-10-30', HOY), '2026-10-30');
  assert.equal(validarFechaMovimiento('2000-01-01', HOY), '2000-01-01');
  assertRechazaFecha('2026-10-31'); // futura
  assertRechazaFecha('1999-12-31'); // anterior al mínimo
});

test('T-04.4 / CB-08, CB-09: respeta el calendario (bisiestos y días inexistentes)', () => {
  assertRechazaFecha('2026-02-29'); // 2026 no es bisiesto
  assert.equal(validarFechaMovimiento('2024-02-29', HOY), '2024-02-29');
  assertRechazaFecha('2026-04-31'); // abril tiene 30 días
  assertRechazaFecha('2026-13-01'); // mes inexistente
  assertRechazaFecha('2026-00-10'); // mes cero
  assertRechazaFecha('2026-10-00'); // día cero
});

test('T-04.5: rechaza formatos inválidos y valores que no son texto', () => {
  assertRechazaFecha('abc');
  assertRechazaFecha('');
  assertRechazaFecha('2026-1-5');
  assertRechazaFecha('30/10/2026');
  assertRechazaFecha(undefined);
  assertRechazaFecha(null);
  assertRechazaFecha(20261030);
});

test('T-04.6: rangoDeMes devuelve el primer y el último día del mes', () => {
  assert.deepEqual(rangoDeMes('2026-10'), { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(rangoDeMes('2024-02'), { desde: '2024-02-01', hasta: '2024-02-29' });
  assert.deepEqual(rangoDeMes('2026-02'), { desde: '2026-02-01', hasta: '2026-02-28' });
  assert.deepEqual(rangoDeMes('2026-04'), { desde: '2026-04-01', hasta: '2026-04-30' });
});

test('T-04.7 / CB-22: validarMes rechaza meses mal formados con MES_INVALIDO', () => {
  assert.equal(validarMes('2026-10'), '2026-10');
  assertRechazaMes('2026-13');
  assertRechazaMes('2026-00');
  assertRechazaMes('2026-1');
  assertRechazaMes('26-10');
  assertRechazaMes('');
  assertRechazaMes(undefined);
  assert.throws(() => rangoDeMes('2026-13'), (err) => err.codigo === 'MES_INVALIDO');
});