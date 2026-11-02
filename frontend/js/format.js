// Funciones puras de formato y lectura de montos, fechas y meses (RN-14).
// No usan el DOM, Intl ni Date: el resultado no depende del navegador, del idioma ni de la zona horaria.

const NOMBRES_DE_MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

// Monto escrito por una persona: parte entera sin ceros a la izquierda, con o sin puntos de miles
// bien formados (grupos de 3), y coma decimal opcional con 1 o 2 decimales.
const FORMATO_MONTO = /^(0|[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)(?:,(\d{1,2}))?$/;
const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMATO_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

// Centavos enteros -> "$ 1.234,56". Un monto negativo se escribe "-$ 52.000,05".
export function formatearMonto(centavos) {
  if (!Number.isSafeInteger(centavos)) {
    throw new TypeError('El monto debe ser un número entero de centavos.');
  }
  const signo = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  const resto = absoluto % 100;
  const pesos = (absoluto - resto) / 100; // división exacta: sin errores de coma flotante
  const pesosConPuntos = String(pesos).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}$ ${pesosConPuntos},${String(resto).padStart(2, '0')}`;
}

// Texto escrito por la persona -> centavos enteros, o null si no es un monto válido.
// Usa la coma como separador decimal: "1234.56" es ambiguo y se rechaza.
// No controla el rango (RN-02): eso lo hace la validación del formulario.
export function parsearMonto(texto) {
  if (typeof texto !== 'string') return null;
  const partes = FORMATO_MONTO.exec(texto.trim());
  if (!partes) return null;

  const pesos = Number(partes[1].replaceAll('.', ''));
  const centavos = partes[2] === undefined ? 0 : Number(partes[2].padEnd(2, '0'));
  const total = pesos * 100 + centavos;
  return Number.isSafeInteger(total) ? total : null;
}

// "2026-10-30" -> "30/10/2026". Solo reordena el texto: la validez de la fecha la garantiza el servidor.
export function formatearFecha(texto) {
  const partes = typeof texto === 'string' ? FORMATO_FECHA.exec(texto) : null;
  if (!partes) throw new TypeError('La fecha debe tener el formato AAAA-MM-DD.');
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
}

// "2026-10" -> "octubre 2026".
export function formatearMes(texto) {
  const partes = typeof texto === 'string' ? FORMATO_MES.exec(texto) : null;
  if (!partes) throw new TypeError('El mes debe tener el formato AAAA-MM.');
  return `${NOMBRES_DE_MESES[Number(partes[2]) - 1]} ${partes[1]}`;
}