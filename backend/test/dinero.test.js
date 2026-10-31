import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarMontoCentavos } from '../src/utils/dinero.js';
import { ErrorDeNegocio } from '../src/errores.js';

// Verifica que se lance un error de validación 400 asociado al campo indicado.
function assertRechaza(valor, campo = 'montoCentavos') {
  assert.throws(
    () => validarMontoCentavos(valor),
    (err) => {
      assert.ok(err instanceof ErrorDeNegocio, 'debe ser un ErrorDeNegocio');
      assert.equal(err.status, 400);
      assert.equal(err.codigo, 'VALIDACION');
      assert.ok(err.campos[campo], `debe informar el campo ${campo}`);
      return true;
    }
  );
}

test('T-03.1 / RN-02: 123456 es un monto válido y se devuelve tal cual', () => {
  assert.equal(validarMontoCentavos(123456), 123456);
});

test('T-03.2 / CB-02, CB-03: 1 y 99999999999 son los límites válidos', () => {
  assert.equal(validarMontoCentavos(1), 1);
  assert.equal(validarMontoCentavos(99999999999), 99999999999);
});

test('T-03.3 / CB-01, CB-04: 0, negativos y más del máximo se rechazan', () => {
  assertRechaza(0);
  assertRechaza(-5);
  assertRechaza(100000000000);
});

test('T-03.4: un número con decimales (12.5) se rechaza', () => {
  assertRechaza(12.5);
});

test('T-03.5: un texto ("100") y null se rechazan', () => {
  assertRechaza('100');
  assertRechaza(null);
});

test('T-03.6: NaN e Infinity se rechazan', () => {
  assertRechaza(NaN);
  assertRechaza(Infinity);
});

// Se desprende de "se reutiliza para movimientos y presupuestos" (T-03, "Qué hace"):
// el presupuesto informa el error en el campo limiteCentavos.
test('T-03.7: el nombre del campo del error se puede indicar', () => {
  assert.throws(
    () => validarMontoCentavos(0, 'limiteCentavos'),
    (err) => {
      assert.ok(err.campos.limiteCentavos);
      assert.equal(err.campos.montoCentavos, undefined);
      return true;
    }
  );
});