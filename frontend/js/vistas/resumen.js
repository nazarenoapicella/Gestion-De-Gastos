// Pantalla de resumen (HU-05, HU-06): balance del mes y acumulado, y totales por categoría.
// Solo arma la pantalla y habla con la API: los números los calcula el servidor y los textos salen de resumen.js.
// El texto que viene de la API (nombres de categorías) se inserta con textContent, nunca con innerHTML (CB-26).

import { api, ErrorDeApi } from '../api.js';
import { formatearMes } from '../format.js';
import { hoyEnArgentina } from '../validaciones.js';
import { mesDe, mesesDisponibles } from '../consulta.js';
import { TEXTO_SIN_MOVIMIENTOS, filasDeCategorias, tarjetasDelResumen } from '../resumen.js';

const MENSAJE_INESPERADO = 'Ocurrió un error inesperado. Intentá de nuevo.';
const TIPOS = ['GASTO', 'INGRESO'];
const TITULOS_DE_TABLAS = { GASTO: 'Gastos por categoría', INGRESO: 'Ingresos por categoría' };

function textoDeError(err) {
  return err instanceof ErrorDeApi ? err.message : MENSAJE_INESPERADO;
}

function crear(etiqueta, { clase, texto, atributos = {} } = {}) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  for (const [nombre, valor] of Object.entries(atributos)) elemento.setAttribute(nombre, valor);
  return elemento;
}

// `raiz` es el contenedor de toda la pantalla (con su selector de mes, tarjetas y tablas).
export function iniciarResumen(raiz) {
  const filtros = raiz.querySelector('[data-resumen-filtros]');
  const selectorMes = filtros.elements.mes;
  const fallo = raiz.querySelector('[data-resumen-fallo]');
  const botonReintentar = raiz.querySelector('[data-resumen-reintentar]');
  const estado = raiz.querySelector('[data-resumen-estado]');
  const contenido = raiz.querySelector('[data-resumen-contenido]');
  const tarjetas = raiz.querySelector('[data-resumen-tarjetas]');
  const tablas = {
    GASTO: raiz.querySelector('[data-resumen-tabla="GASTO"]'),
    INGRESO: raiz.querySelector('[data-resumen-tabla="INGRESO"]'),
  };

  let mes = mesDe(hoyEnArgentina()); // la pantalla abre con el mes actual
  let consultaVigente = 0; // numera los pedidos: solo vale la respuesta del último

  function mostrarFallo(texto) {
    fallo.hidden = false;
    fallo.textContent = texto;
    botonReintentar.hidden = false;
  }

  function ocultarFallo() {
    fallo.hidden = true;
    fallo.textContent = '';
    botonReintentar.hidden = true;
  }

  // Meses desde el actual hasta enero de 2000. Sin "Todos los meses": en el resumen el mes es obligatorio (RN-17).
  // Conserva el mes elegido si sigue estando disponible.
  function llenarMeses() {
    const meses = mesesDisponibles(hoyEnArgentina());
    selectorMes.replaceChildren(...meses.map((m) => new Option(formatearMes(m), m)));
    selectorMes.value = meses.includes(mes) ? mes : meses[0];
    mes = selectorMes.value;
  }

  // Tarjetas

  // Los dos balances llevan una etiqueta de texto (Superávit, Déficit, Equilibrio): el estado nunca depende solo del color.
  function crearTarjeta(tarjeta) {
    const dato = crear('div', { clase: tarjeta.estado ? `dato dato--${tarjeta.estado}` : 'dato' });
    dato.append(crear('dt', { clase: 'dato__titulo', texto: tarjeta.titulo }));

    const valor = crear('dd', { clase: 'dato__valor' });
    valor.append(crear('span', { clase: 'dato__monto', texto: tarjeta.texto }));
    if (tarjeta.etiqueta) {
      valor.append(crear('span', { clase: `etiqueta etiqueta--${tarjeta.estado}`, texto: tarjeta.etiqueta }));
    }
    dato.append(valor);
    return dato;
  }

  // Tablas por categoría

  function crearTabla(tipo, items) {
    const filas = filasDeCategorias(items);
    if (filas.length === 0) return crear('p', { clase: 'vista-pendiente', texto: TEXTO_SIN_MOVIMIENTOS });

    const tabla = crear('table', { clase: 'tabla-categorias' });
    tabla.append(crear('caption', { clase: 'solo-lectores', texto: TITULOS_DE_TABLAS[tipo] }));

    const cabecera = crear('thead');
    const filaCabecera = crear('tr');
    filaCabecera.append(
      crear('th', { texto: 'Categoría', atributos: { scope: 'col' } }),
      crear('th', { clase: 'columna-numero', texto: 'Total', atributos: { scope: 'col' } }),
      crear('th', { clase: 'columna-numero', texto: '% del total', atributos: { scope: 'col' } })
    );
    cabecera.append(filaCabecera);

    const cuerpo = crear('tbody');
    for (const fila of filas) {
      const tr = crear('tr');
      tr.append(
        crear('th', { texto: fila.nombre, atributos: { scope: 'row' } }),
        crear('td', { clase: 'columna-numero', texto: fila.total }),
        crear('td', { clase: 'columna-numero', texto: fila.porcentaje })
      );
      cuerpo.append(tr);
    }

    tabla.append(cabecera, cuerpo);
    return tabla;
  }

  // Si el servidor responde algo con otra forma, mostrar() falla con un TypeError y cargar() lo trata como un error.
  function mostrar(resumen) {
    tarjetas.replaceChildren(...tarjetasDelResumen(resumen).map(crearTarjeta));
    for (const tipo of TIPOS) {
      tablas[tipo].replaceChildren(crearTabla(tipo, resumen.porCategoria[tipo]));
    }
    estado.textContent = `Resumen de ${formatearMes(resumen.mes)}.`;
    contenido.hidden = false;
  }

  // Pide el resumen del mes elegido. Si mientras tanto se hizo otro pedido, esta respuesta se descarta.
  async function cargar() {
    const numero = ++consultaVigente;
    contenido.setAttribute('aria-busy', 'true');
    contenido.classList.add('listado--cargando');
    estado.hidden = false;
    estado.textContent = `Cargando resumen de ${formatearMes(mes)}…`;
    ocultarFallo();

    try {
      const resumen = await api.get(`/api/resumen?mes=${encodeURIComponent(mes)}`);
      if (numero !== consultaVigente) return;
      mostrar(resumen);
    } catch (err) {
      if (numero !== consultaVigente) return;
      // Si falla, no se deja a la vista el resumen de otro mes: sería mostrar números que no corresponden.
      contenido.hidden = true;
      estado.hidden = true;
      estado.textContent = '';
      mostrarFallo(textoDeError(err));
    } finally {
      if (numero === consultaVigente) {
        contenido.setAttribute('aria-busy', 'false');
        contenido.classList.remove('listado--cargando');
      }
    }
  }

  // Se ejecuta cada vez que se muestra la pantalla: los movimientos pudieron cambiar en otra.
  function alMostrar() {
    llenarMeses();
    return cargar();
  }

  filtros.addEventListener('submit', (evento) => evento.preventDefault());

  filtros.addEventListener('change', (evento) => {
    if (evento.target.name !== 'mes') return;
    mes = selectorMes.value;
    cargar();
  });

  botonReintentar.addEventListener('click', alMostrar);

  return { alMostrar };
}