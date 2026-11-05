// Lógica pura de la pantalla de resumen (T-20): textos de las tarjetas, etiquetas del balance y filas
// de las tablas por categoría. No usa el DOM: se prueba con node:test.
// El resumen lo calcula siempre el servidor (RN-12, RN-13); acá solo se escribe lo que devuelve.

import { formatearMonto } from './format.js';

export const TEXTO_SIN_MOVIMIENTOS = 'Sin movimientos';

// 75 -> "75,0 %". La API manda a lo sumo un decimal y la interfaz lo muestra siempre (RN-13).
// Acepta valores mayores a 100 porque el consumo de un presupuesto puede superarlo (RN-16).
export function formatearPorcentaje(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
    throw new TypeError('El porcentaje debe ser un número finito mayor o igual a 0.');
  }
  return `${valor.toFixed(1).replace('.', ',')} %`;
}

// Un balance se comunica con el monto (el signo menos viene de formatearMonto) y con una etiqueta de
// texto, para que un balance negativo no dependa solo del color rojo.
// estado: 'superavit' | 'deficit' | 'equilibrio'.
export function describirBalance(centavos) {
  const texto = formatearMonto(centavos); // lanza TypeError si no es un entero de centavos
  if (centavos > 0) return { texto, estado: 'superavit', etiqueta: 'Superávit' };
  if (centavos < 0) return { texto, estado: 'deficit', etiqueta: 'Déficit' };
  return { texto, estado: 'equilibrio', etiqueta: 'Equilibrio' };
}

// Las cuatro tarjetas de la pantalla, en orden (HU-05). Los dos balances llevan estado y etiqueta.
// `resumen` es la respuesta de GET /api/resumen.
export function tarjetasDelResumen(resumen) {
  const datos = resumen ?? {};
  return [
    { clave: 'ingresos', titulo: 'Ingresos', texto: formatearMonto(datos.ingresosCentavos) },
    { clave: 'gastos', titulo: 'Gastos', texto: formatearMonto(datos.gastosCentavos) },
    { clave: 'balanceMes', titulo: 'Balance del mes', ...describirBalance(datos.balanceMesCentavos) },
    { clave: 'balanceAcumulado', titulo: 'Balance acumulado', ...describirBalance(datos.balanceAcumuladoCentavos) },
  ];
}

// Filas de una tabla por categoría (HU-06), en el mismo orden en que llegan: la API ya las ordena por
// total descendente y, ante empate, por nombre (RN-13).
export function filasDeCategorias(items) {
  return items.map((item) => ({
    id: item.categoriaId,
    nombre: item.nombre,
    total: formatearMonto(item.totalCentavos),
    porcentaje: formatearPorcentaje(item.porcentaje),
  }));
}