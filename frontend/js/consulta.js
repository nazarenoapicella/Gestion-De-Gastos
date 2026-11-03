// Lógica pura del listado de movimientos (T-18): armado de la consulta, meses, textos y paginación.
// No usa el DOM ni Date: se prueba con node:test y no depende del navegador.

import { formatearFecha, formatearMonto } from './format.js';
import { FECHA_MINIMA } from './validaciones.js';

// Una fecha AAAA-MM-DD con mes entre 01 y 12; el grupo 1 es el mes (AAAA-MM).
const FORMATO_FECHA = /^(\d{4}-(?:0[1-9]|1[0-2]))-\d{2}$/;
const NOMBRES_DE_TIPOS = { GASTO: 'Gasto', INGRESO: 'Ingreso' };
const PARAMETROS_DEL_LISTADO = ['mes', 'tipo', 'categoriaId', 'pagina'];

const estaVacio = (valor) => valor === undefined || valor === null || valor === '';

// Arma el texto de la consulta de GET /api/movimientos (sin el "?"), omitiendo los valores vacíos.
// "mes=2026-10&tipo=GASTO&categoriaId=3&pagina=2". Si no hay nada que enviar, devuelve "".
export function construirQuery(parametros) {
  const origen = parametros ?? {};
  const partes = [];
  for (const nombre of PARAMETROS_DEL_LISTADO) {
    const valor = origen[nombre];
    if (estaVacio(valor)) continue;
    partes.push(`${nombre}=${encodeURIComponent(String(valor))}`);
  }
  return partes.join('&');
}

// "2026-10-30" -> "2026-10".
export function mesDe(fecha) {
  const partes = typeof fecha === 'string' ? FORMATO_FECHA.exec(fecha) : null;
  if (!partes) throw new TypeError('La fecha debe tener el formato AAAA-MM-DD.');
  return partes[1];
}

// Meses que ofrece el selector: desde el de `hoy` hasta enero de 2000 (RN-03), del más nuevo al más viejo.
export function mesesDisponibles(hoy) {
  const mesActual = mesDe(hoy);
  const mesMinimo = mesDe(FECHA_MINIMA);

  let anio = Number(mesActual.slice(0, 4));
  let mes = Number(mesActual.slice(5, 7));
  const meses = [];
  for (;;) {
    const texto = `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
    if (texto < mesMinimo) break;
    meses.push(texto);
    mes -= 1;
    if (mes === 0) {
      mes = 12;
      anio -= 1;
    }
  }
  return meses;
}

// Categorías del filtro: las del tipo elegido o todas si no hay tipo. Incluye las desactivadas,
// porque sus movimientos siguen en el listado (RN-09). Mantiene el orden y no modifica la lista recibida.
export function categoriasParaFiltro(categorias, tipo) {
  return tipo ? categorias.filter((c) => c.tipo === tipo) : [...categorias];
}

export function textoDeTipo(tipo) {
  if (!Object.hasOwn(NOMBRES_DE_TIPOS, tipo)) throw new TypeError('El tipo debe ser GASTO o INGRESO.');
  return NOMBRES_DE_TIPOS[tipo];
}

// "-$ 1.234,56" para un gasto y "+$ 500.000,00" para un ingreso: el tipo no se comunica solo por color.
export function montoConSigno(tipo, centavos) {
  if (tipo !== 'GASTO' && tipo !== 'INGRESO') throw new TypeError('El tipo debe ser GASTO o INGRESO.');
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    throw new TypeError('El monto debe ser un entero de centavos mayor o igual a 0.');
  }
  return `${tipo === 'GASTO' ? '-' : '+'}${formatearMonto(centavos)}`;
}

// RN-09: una categoría desactivada se marca como tal.
export function nombreDeCategoria(movimiento) {
  return movimiento.categoriaActiva ? movimiento.categoriaNombre : `${movimiento.categoriaNombre} (desactivada)`;
}

// Frase que describe un movimiento: sirve para los lectores de pantalla y para la ventana de confirmación.
export function describirMovimiento(movimiento) {
  const monto = formatearMonto(movimiento.montoCentavos);
  const fecha = formatearFecha(movimiento.fecha);
  let texto = `${textoDeTipo(movimiento.tipo)} de ${monto} del ${fecha}, categoría ${nombreDeCategoria(movimiento)}`;
  if (movimiento.descripcion) texto += `, descripción ${movimiento.descripcion}`;
  return texto;
}

// Qué se está viendo: "Mostrando 21–25 de 25 movimientos".
export function describirPagina({ pagina, tamanioPagina, total }) {
  if (total === 0) return '0 movimientos';
  if (total === 1) return '1 movimiento';

  const desde = (pagina - 1) * tamanioPagina + 1;
  if (pagina < 1 || desde > total) return `${total} movimientos`; // página fuera de rango
  const hasta = Math.min(pagina * tamanioPagina, total);
  return `Mostrando ${desde}–${hasta} de ${total} movimientos`;
}

// Mensaje cuando el listado llega vacío (CA-02.4: es un aviso, no un error).
export function mensajeSinResultados({ mes, tipo, categoriaId } = {}) {
  const conFiltros = !estaVacio(tipo) || !estaVacio(categoriaId);
  if (!estaVacio(mes)) {
    return conFiltros ? 'No hay movimientos en este mes con los filtros elegidos.' : 'No hay movimientos en este mes.';
  }
  return conFiltros ? 'No hay movimientos con los filtros elegidos.' : 'Todavía no cargaste ningún movimiento.';
}

// Si la página pedida quedó después de la última (por ejemplo, al eliminar el único movimiento de la
// última página), devuelve la última que existe; sin resultados, la 1.
export function paginaValida({ pagina, totalPaginas }) {
  if (totalPaginas < 1) return 1;
  return Math.min(Math.max(pagina, 1), totalPaginas);
}