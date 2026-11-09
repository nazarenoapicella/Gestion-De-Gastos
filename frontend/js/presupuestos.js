// Lógica pura de la pantalla de presupuestos y del aviso de alertas (T-21): textos, barra, validación del
// límite y armado del aviso. No usa el DOM: se prueba con node:test.
// El estado de cada presupuesto lo decide siempre el servidor (RN-16); acá solo se lo escribe.

import { formatearMonto, parsearMonto } from './format.js';
import { formatearPorcentaje } from './resumen.js';
import { MONTO_MAXIMO_CENTAVOS, MONTO_MINIMO_CENTAVOS } from './validaciones.js';

const TEXTOS_DE_ESTADOS = { NORMAL: 'Normal', ALERTA: 'Alerta', EXCEDIDO: 'Excedido' };

// "ALERTA" -> "Alerta". El estado siempre se escribe: nunca se comunica solo con un color (RN-16).
export function textoDeEstado(estado) {
  if (!Object.hasOwn(TEXTOS_DE_ESTADOS, estado)) {
    throw new TypeError('El estado debe ser NORMAL, ALERTA o EXCEDIDO.');
  }
  return TEXTOS_DE_ESTADOS[estado];
}

// Ancho de la barra de progreso, de 0 a 100: nunca pasa del 100 % aunque el consumo lo supere.
export function anchoDeBarra(porcentaje) {
  if (typeof porcentaje !== 'number' || !Number.isFinite(porcentaje) || porcentaje < 0) {
    throw new TypeError('El porcentaje debe ser un número finito mayor o igual a 0.');
  }
  return Math.min(porcentaje, 100);
}

// Todo lo que muestra una fila de la lista, ya escrito. `item` es un elemento de GET /api/presupuestos.
export function filaDePresupuesto(item) {
  const etiqueta = textoDeEstado(item.estado);
  const limite = formatearMonto(item.limiteCentavos);
  const gastado = formatearMonto(item.gastadoCentavos);
  const porcentaje = formatearPorcentaje(item.porcentajeConsumo);
  return {
    id: item.categoriaId,
    nombre: item.categoriaNombre,
    estado: item.estado,
    etiqueta,
    limiteCentavos: item.limiteCentavos,
    limite,
    gastado,
    porcentaje,
    ancho: anchoDeBarra(item.porcentajeConsumo),
    descripcion: `${item.categoriaNombre}: ${etiqueta}, ${gastado} gastados de un límite de ${limite} (${porcentaje})`,
  };
}

// RN-15, RN-09: categorías que se ofrecen para definir un límite: solo las de gasto y activas.
// `limiteCentavos` es el límite que ya tienen, o null. `items` es la lista de GET /api/presupuestos
// (incluye todas las categorías activas con límite, sin importar el mes).
export function categoriasParaLimite(categorias, items) {
  const limites = new Map(items.map((i) => [i.categoriaId, i.limiteCentavos]));
  return categorias
    .filter((c) => c.tipo === 'GASTO' && c.activa)
    .map((c) => ({ id: c.id, nombre: c.nombre, limiteCentavos: limites.get(c.id) ?? null }));
}

// Texto de cada opción del selector: avisa si la categoría ya tiene un límite (guardar lo reemplaza, RN-15).
export function etiquetaDeOpcion({ nombre, limiteCentavos }) {
  return limiteCentavos === null ? nombre : `${nombre} (límite actual: ${formatearMonto(limiteCentavos)})`;
}

// RN-15, RN-02: el límite tiene el mismo rango que un monto, entre $ 0,01 y $ 999.999.999,99.
// Devuelve { ok: true, valor } con los centavos, o { ok: false, error }.
export function validarLimite(texto) {
  if (typeof texto !== 'string' || texto.trim() === '') {
    return { ok: false, error: 'Ingresá el límite mensual.' };
  }

  const centavos = parsearMonto(texto);
  if (centavos === null) {
    return {
      ok: false,
      error: 'Ingresá un monto válido: usá coma para los centavos (hasta 2 decimales), por ejemplo 100.000,50.',
    };
  }
  if (centavos < MONTO_MINIMO_CENTAVOS) return { ok: false, error: 'El límite debe ser de al menos $ 0,01.' };
  if (centavos > MONTO_MAXIMO_CENTAVOS) return { ok: false, error: 'El límite no puede superar $ 999.999.999,99.' };
  return { ok: true, valor: centavos };
}

// CA-09.5: el aviso que se ve en todas las pantallas. Nombra cada presupuesto en alerta o excedido,
// con su estado escrito y su porcentaje, en el orden en que llegan (la API los ordena por consumo).
// Si no hay ninguno, devuelve null. `items` es la lista de GET /api/presupuestos del mes actual.
export function avisoDeAlertas(items) {
  const lineas = items
    .filter((i) => i.estado === 'ALERTA' || i.estado === 'EXCEDIDO')
    .map((i) => ({
      id: i.categoriaId,
      estado: i.estado,
      texto: `${i.categoriaNombre}: ${textoDeEstado(i.estado)}, ${formatearPorcentaje(i.porcentajeConsumo)} del límite de ${formatearMonto(i.limiteCentavos)}`,
    }));
  if (lineas.length === 0) return null;

  const titulo =
    lineas.length === 1
      ? 'Atención: 1 presupuesto está en alerta o excedido este mes.'
      : `Atención: ${lineas.length} presupuestos están en alerta o excedidos este mes.`;
  return { titulo, lineas };
}