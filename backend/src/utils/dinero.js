import { ErrorDeNegocio } from '../errores.js';

// RN-02: el monto es un entero de centavos entre 1 ($ 0,01) y 99.999.999.999 ($ 999.999.999,99).
export const MONTO_MINIMO_CENTAVOS = 1;
export const MONTO_MAXIMO_CENTAVOS = 99999999999;

// Devuelve el valor si es un monto válido; si no, lanza un ErrorDeNegocio 400 VALIDACION.
// `campo` es el nombre del campo de la API al que se asocia el error
// (montoCentavos en movimientos, limiteCentavos en presupuestos).
export function validarMontoCentavos(valor, campo = 'montoCentavos') {
  if (typeof valor !== 'number' || !Number.isSafeInteger(valor)) {
    throw errorDeMonto(campo, 'Ingresá un monto válido, en centavos y sin decimales.');
  }
  if (valor < MONTO_MINIMO_CENTAVOS || valor > MONTO_MAXIMO_CENTAVOS) {
    throw errorDeMonto(campo, 'El monto debe estar entre $ 0,01 y $ 999.999.999,99.');
  }
  return valor;
}

function errorDeMonto(campo, mensaje) {
  return new ErrorDeNegocio(400, 'VALIDACION', mensaje, { [campo]: mensaje });
}