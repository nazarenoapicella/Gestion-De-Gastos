import { ErrorDeNegocio } from '../errores.js';

// Las fechas del sistema son texto AAAA-MM-DD, sin hora: no hay conversiones de zona horaria.
// Los meses son texto AAAA-MM. Para comparar fechas alcanza con comparar el texto.

export const ZONA_HORARIA_POR_DEFECTO = 'America/Argentina/Buenos_Aires';
export const FECHA_MINIMA = '2000-01-01'; // RN-03

const REGEX_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const REGEX_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

// "Hoy" según la zona horaria de Argentina, no según la fecha UTC del servidor (D-06).
// El reloj se inyecta (una función que devuelve un Date) para poder fijarlo en las pruebas.
export function hoy(reloj = () => new Date(), zonaHoraria = ZONA_HORARIA_POR_DEFECTO) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reloj());
  const valor = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

function esBisiesto(anio) {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

function diasDelMes(anio, mes) {
  const dias = [31, esBisiesto(anio) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dias[mes - 1];
}

function errorDeFecha(mensaje) {
  return new ErrorDeNegocio(400, 'VALIDACION', mensaje, { fecha: mensaje });
}

// RN-03: la fecha debe tener formato AAAA-MM-DD, existir en el calendario
// y estar entre 2000-01-01 y hoy, ambos inclusive.
// `fechaHoy` es el texto que devuelve hoy().
export function validarFechaMovimiento(texto, fechaHoy) {
  const partes = typeof texto === 'string' ? REGEX_FECHA.exec(texto) : null;
  if (!partes) {
    throw errorDeFecha('La fecha debe tener el formato AAAA-MM-DD.');
  }

  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) {
    throw errorDeFecha('La fecha no existe en el calendario.');
  }
  if (texto < FECHA_MINIMA) {
    throw errorDeFecha('La fecha no puede ser anterior al 01/01/2000.');
  }
  if (texto > fechaHoy) {
    throw errorDeFecha('La fecha no puede ser futura.');
  }
  return texto;
}

// RN-17: el mes es AAAA-MM con mes entre 01 y 12.
export function validarMes(texto) {
  if (typeof texto !== 'string' || !REGEX_MES.test(texto)) {
    const mensaje = 'El mes debe tener el formato AAAA-MM, con mes entre 01 y 12.';
    throw new ErrorDeNegocio(400, 'MES_INVALIDO', mensaje, { mes: mensaje });
  }
  return texto;
}

// Primer y último día de un mes calendario. "2026-02" -> { desde: "2026-02-01", hasta: "2026-02-28" }
export function rangoDeMes(mes) {
  validarMes(mes);
  const anio = Number(mes.slice(0, 4));
  const numeroDeMes = Number(mes.slice(5, 7));
  const ultimoDia = String(diasDelMes(anio, numeroDeMes)).padStart(2, '0');
  return { desde: `${mes}-01`, hasta: `${mes}-${ultimoDia}` };
}


// RN-17: en los reportes el mes es obligatorio. Si falta, MES_REQUERIDO; si no tiene el formato
// AAAA-MM, MES_INVALIDO (lo lanza rangoDeMes). Devuelve el mes junto con su primer y último día.
export function rangoDeMesRequerido(mes) {
  if (mes === undefined) {
    const mensaje = 'Indicá el mes en el formato AAAA-MM.';
    throw new ErrorDeNegocio(400, 'MES_REQUERIDO', mensaje, { mes: mensaje });
  }
  return { mes, ...rangoDeMes(mes) };
}