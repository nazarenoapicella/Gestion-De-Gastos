// Listado de movimientos (HU-02, HU-04): filtros, paginación, edición y eliminación con confirmación.
// Solo arma la pantalla y habla con la API: las reglas las decide el servidor y la lógica pura está en consulta.js.
// El texto que viene de la API (categorías, descripciones) se inserta con textContent, nunca con innerHTML (CB-26).

import { api, ErrorDeApi } from '../api.js';
import { formatearFecha, formatearMes } from '../format.js';
import { hoyEnArgentina } from '../validaciones.js';
import {
  categoriasParaFiltro,
  construirQuery,
  describirMovimiento,
  describirPagina,
  mensajeSinResultados,
  mesDe,
  mesesDisponibles,
  montoConSigno,
  nombreDeCategoria,
  paginaValida,
  textoDeTipo,
} from '../consulta.js';

const MENSAJE_INESPERADO = 'Ocurrió un error inesperado. Intentá de nuevo.';

const COLUMNAS = [
  { etiqueta: 'Fecha' },
  { etiqueta: 'Tipo' },
  { etiqueta: 'Categoría' },
  { etiqueta: 'Descripción' },
  { etiqueta: 'Monto', clase: 'columna-monto' },
  { etiqueta: 'Acciones' },
];

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

function opcionDeCategoria(categoria) {
  return new Option(categoria.activa ? categoria.nombre : `${categoria.nombre} (desactivada)`, String(categoria.id));
}

// `raiz` es el contenedor del listado (con sus filtros, mensajes y la ventana de confirmación).
// alEditar(movimiento): se llama al hacer clic en "Editar" (el formulario se abre con ese movimiento).
// alEliminar(id): se llama después de eliminar un movimiento.
export function iniciarListadoMovimientos(raiz, { alEditar = () => {}, alEliminar = () => {} } = {}) {
  const titulo = raiz.querySelector('[data-titulo-listado]');
  const filtros = raiz.querySelector('[data-filtros]');
  const selectorMes = filtros.elements.mes;
  const selectorTipo = filtros.elements.tipo;
  const selectorCategoria = filtros.elements.categoriaId;
  const mensaje = raiz.querySelector('[data-listado-mensaje]');
  const errorListado = raiz.querySelector('[data-listado-error]');
  const botonReintentar = raiz.querySelector('[data-listado-reintentar]');
  const resumen = raiz.querySelector('[data-listado-estado]');
  const contenedor = raiz.querySelector('[data-listado-contenedor]');
  const vacio = raiz.querySelector('[data-listado-vacio]');
  const paginacion = raiz.querySelector('[data-paginacion]');
  const botonAnterior = raiz.querySelector('[data-pagina-anterior]');
  const botonSiguiente = raiz.querySelector('[data-pagina-siguiente]');
  const textoPagina = raiz.querySelector('[data-pagina-texto]');
  const dialogo = raiz.querySelector('[data-dialogo-eliminar]');
  const detalleDialogo = raiz.querySelector('[data-dialogo-detalle]');
  const errorDialogo = raiz.querySelector('[data-dialogo-error]');
  const botonCancelar = raiz.querySelector('[data-dialogo-cancelar]');
  const botonConfirmar = raiz.querySelector('[data-dialogo-confirmar]');

  // Lo que el listado está mostrando. La interfaz abre con el mes actual (RN-11).
  const estado = { mes: mesDe(hoyEnArgentina()), tipo: '', categoriaId: '', pagina: 1 };

  let categorias = []; // todas, activas o no
  let ultimaRespuesta = null;
  let consultaVigente = 0; // numera los pedidos: solo vale la respuesta del último
  let cargando = false;
  let movimientoAEliminar = null;
  let botonOrigen = null; // botón "Eliminar" que abrió la ventana
  let restaurarFoco = true;
  let eliminando = false;

  // Mensajes

  function mostrarMensaje(texto) {
    mensaje.hidden = false;
    mensaje.textContent = texto;
  }

  function ocultarMensaje() {
    mensaje.hidden = true;
    mensaje.textContent = '';
  }

  function mostrarFallo(texto) {
    errorListado.hidden = false;
    errorListado.textContent = texto;
    botonReintentar.hidden = false;
  }

  function ocultarFallo() {
    errorListado.hidden = true;
    errorListado.textContent = '';
    botonReintentar.hidden = true;
  }

  // Filtros

  // Meses desde el actual hasta enero de 2000, más "Todos los meses" (la API sin mes los incluye a todos, RN-11).
  function llenarMeses() {
    selectorMes.replaceChildren(new Option('Todos los meses', ''));
    for (const mes of mesesDisponibles(hoyEnArgentina())) {
      selectorMes.append(new Option(formatearMes(mes), mes));
    }
    selectorMes.value = estado.mes;
    estado.mes = selectorMes.value;
  }

  // Sin tipo elegido se agrupan en "Gastos" e "Ingresos" (un mismo nombre puede existir en los dos tipos).
  // La categoría elegida se conserva solo si sigue estando entre las ofrecidas.
  function llenarCategorias() {
    const ofrecidas = categoriasParaFiltro(categorias, estado.tipo);
    selectorCategoria.replaceChildren(new Option('Todas', ''));

    if (estado.tipo === '') {
      for (const [tipo, etiqueta] of [
        ['GASTO', 'Gastos'],
        ['INGRESO', 'Ingresos'],
      ]) {
        const delTipo = ofrecidas.filter((c) => c.tipo === tipo);
        if (delTipo.length === 0) continue;
        const grupo = document.createElement('optgroup');
        grupo.label = etiqueta;
        grupo.append(...delTipo.map(opcionDeCategoria));
        selectorCategoria.append(grupo);
      }
    } else {
      selectorCategoria.append(...ofrecidas.map(opcionDeCategoria));
    }

    selectorCategoria.value = ofrecidas.some((c) => String(c.id) === estado.categoriaId) ? estado.categoriaId : '';
    estado.categoriaId = selectorCategoria.value;
  }

  async function cargarCategorias() {
    try {
      categorias = await api.get('/api/categorias');
      llenarCategorias();
      return true;
    } catch (err) {
      mostrarFallo(textoDeError(err));
      return false;
    }
  }

  // Tabla (en el celular, cada fila se muestra como una tarjeta: lo resuelve el CSS)

  function crearFila(movimiento) {
    const fila = crear('tr', { atributos: { role: 'row' } });
    const celda = (etiqueta, texto, clase) =>
      crear('td', { clase, texto, atributos: { role: 'cell', 'data-etiqueta': etiqueta } });

    fila.append(
      celda('Fecha', formatearFecha(movimiento.fecha)),
      celda('Tipo', textoDeTipo(movimiento.tipo)),
      celda('Categoría', nombreDeCategoria(movimiento)),
      celda(
        'Descripción',
        movimiento.descripcion ?? 'Sin descripción',
        movimiento.descripcion ? undefined : 'texto-suave'
      ),
      celda(
        'Monto',
        montoConSigno(movimiento.tipo, movimiento.montoCentavos),
        `columna-monto monto monto--${movimiento.tipo === 'GASTO' ? 'gasto' : 'ingreso'}`
      )
    );

    const frase = describirMovimiento(movimiento);
    const editar = crear('button', {
      clase: 'boton boton--secundario boton--chico',
      texto: 'Editar',
      atributos: { type: 'button', 'aria-label': `Editar: ${frase}` },
    });
    editar.addEventListener('click', () => alEditar(movimiento));

    const eliminar = crear('button', {
      clase: 'boton boton--secundario boton--chico boton--eliminar',
      texto: 'Eliminar',
      atributos: { type: 'button', 'aria-label': `Eliminar: ${frase}` },
    });
    eliminar.addEventListener('click', () => pedirConfirmacion(movimiento, eliminar));

    const acciones = crear('td', { clase: 'celda-acciones', atributos: { role: 'cell' } });
    acciones.append(editar, eliminar);
    fila.append(acciones);
    return fila;
  }

  function crearTabla(items) {
    const tabla = crear('table', { clase: 'tabla-movimientos', atributos: { role: 'table' } });
    tabla.append(crear('caption', { clase: 'solo-lectores', texto: 'Movimientos' }));

    const cabecera = crear('thead', { atributos: { role: 'rowgroup' } });
    const filaCabecera = crear('tr', { atributos: { role: 'row' } });
    for (const columna of COLUMNAS) {
      filaCabecera.append(
        crear('th', {
          clase: columna.clase,
          texto: columna.etiqueta,
          atributos: { scope: 'col', role: 'columnheader' },
        })
      );
    }
    cabecera.append(filaCabecera);

    const cuerpo = crear('tbody', { atributos: { role: 'rowgroup' } });
    for (const movimiento of items) cuerpo.append(crearFila(movimiento));

    tabla.append(cabecera, cuerpo);
    return tabla;
  }

  // Listado

  function actualizarPaginacion() {
    const hayPaginas = ultimaRespuesta !== null && ultimaRespuesta.totalPaginas > 1;
    paginacion.hidden = !hayPaginas;
    if (!hayPaginas) return;

    const conFoco = document.activeElement;
    botonAnterior.disabled = ultimaRespuesta.pagina <= 1;
    botonSiguiente.disabled = ultimaRespuesta.pagina >= ultimaRespuesta.totalPaginas;
    textoPagina.textContent = `Página ${ultimaRespuesta.pagina} de ${ultimaRespuesta.totalPaginas}`;

    // Si el botón que tenía el foco quedó deshabilitado (se llegó a un extremo), el foco pasa al otro.
    if (conFoco === botonAnterior && botonAnterior.disabled) botonSiguiente.focus();
    if (conFoco === botonSiguiente && botonSiguiente.disabled) botonAnterior.focus();
  }

  function mostrarRespuesta(respuesta) {
    ultimaRespuesta = respuesta;
    resumen.textContent = describirPagina(respuesta);
    contenedor.replaceChildren();

    if (respuesta.items.length === 0) {
      vacio.hidden = false;
      vacio.textContent = mensajeSinResultados(estado);
    } else {
      vacio.hidden = true;
      contenedor.append(crearTabla(respuesta.items));
    }
    actualizarPaginacion();
  }

  // Si falla, se vacía el listado: dejar el anterior mostraría datos que no corresponden a los filtros elegidos.
  function vaciarListado() {
    ultimaRespuesta = null;
    resumen.textContent = '';
    contenedor.replaceChildren();
    vacio.hidden = true;
    paginacion.hidden = true;
  }

  function marcarCargando(valor) {
    cargando = valor;
    contenedor.setAttribute('aria-busy', String(valor));
    contenedor.classList.toggle('listado--cargando', valor);
  }

  // Pide la página actual con los filtros actuales. Si mientras tanto se hizo otro pedido, esta respuesta se descarta.
  async function cargar({ reintento = false } = {}) {
    const numero = ++consultaVigente;
    marcarCargando(true);
    ocultarFallo();

    try {
      const respuesta = await api.get(`/api/movimientos?${construirQuery(estado)}`);
      if (numero !== consultaVigente) return;

      // La página pudo quedar fuera de rango (por ejemplo, al eliminar el único movimiento de la última):
      // se vuelve a pedir con la última que existe. El nuevo pedido toma el control de la pantalla.
      const pagina = paginaValida(respuesta);
      if (pagina !== estado.pagina && !reintento) {
        estado.pagina = pagina;
        cargar({ reintento: true });
        return;
      }
      mostrarRespuesta(respuesta);
    } catch (err) {
      if (numero !== consultaVigente) return;
      vaciarListado();
      mostrarFallo(textoDeError(err));
    } finally {
      if (numero === consultaVigente) marcarCargando(false);
    }
  }

  // Se ejecuta cada vez que se muestra la pantalla: las categorías pudieron cambiar en otra.
  // Primero las categorías, para que el filtro sea coherente con lo que se pide.
  async function alMostrar() {
    ocultarFallo();
    llenarMeses();
    await cargarCategorias();
    await cargar();
  }

  function recargar() {
    ocultarMensaje();
    return cargar();
  }

  // Eventos de los filtros y la paginación

  filtros.addEventListener('submit', (evento) => evento.preventDefault());

  filtros.addEventListener('change', (evento) => {
    switch (evento.target.name) {
      case 'mes':
        estado.mes = selectorMes.value;
        break;
      case 'tipo':
        estado.tipo = selectorTipo.value;
        llenarCategorias(); // si la categoría elegida ya no corresponde al tipo, vuelve a "Todas"
        break;
      case 'categoriaId':
        estado.categoriaId = selectorCategoria.value;
        break;
      default:
        return;
    }
    estado.pagina = 1; // cualquier filtro vuelve a la primera página
    ocultarMensaje();
    cargar();
  });

  async function irAPagina(pagina) {
    if (cargando) return;
    estado.pagina = pagina;
    ocultarMensaje();
    await cargar();
    titulo.scrollIntoView({ block: 'start' }); // en el celular, el listado nuevo se ve desde arriba
  }

  botonAnterior.addEventListener('click', () => {
    if (estado.pagina > 1) irAPagina(estado.pagina - 1);
  });

  botonSiguiente.addEventListener('click', () => {
    if (ultimaRespuesta !== null && estado.pagina < ultimaRespuesta.totalPaginas) irAPagina(estado.pagina + 1);
  });

  botonReintentar.addEventListener('click', alMostrar);

  // Eliminación con confirmación (HU-04, RN-10)

  function pedirConfirmacion(movimiento, boton) {
    movimientoAEliminar = movimiento;
    botonOrigen = boton;
    detalleDialogo.textContent = describirMovimiento(movimiento);
    errorDialogo.hidden = true;
    errorDialogo.textContent = '';
    dialogo.showModal();
  }

  // Mientras se elimina, no se puede cancelar ni confirmar de nuevo (doble clic).
  function marcarEliminando(valor) {
    eliminando = valor;
    botonConfirmar.disabled = valor;
    botonCancelar.disabled = valor;
    botonConfirmar.textContent = valor ? 'Eliminando…' : 'Confirmar';
  }

  botonCancelar.addEventListener('click', () => dialogo.close());

  // Esc no cierra la ventana mientras se está eliminando.
  dialogo.addEventListener('cancel', (evento) => {
    if (eliminando) evento.preventDefault();
  });

  // Si la ventana se cerró sin eliminar, el foco vuelve al botón que la abrió.
  dialogo.addEventListener('close', () => {
    const origen = botonOrigen;
    movimientoAEliminar = null;
    botonOrigen = null;
    if (restaurarFoco && origen?.isConnected) origen.focus();
    restaurarFoco = true;
  });

  // Navegar a otra pantalla con "Atrás" no deja la ventana abierta.
  window.addEventListener('hashchange', () => {
    if (dialogo.open && !eliminando) dialogo.close();
  });

  botonConfirmar.addEventListener('click', async () => {
    if (eliminando || movimientoAEliminar === null) return;
    const { id } = movimientoAEliminar;

    marcarEliminando(true);
    let resultado = null;
    try {
      await api.delete(`/api/movimientos/${id}`);
      resultado = 'Movimiento eliminado.';
    } catch (err) {
      if (err instanceof ErrorDeApi && err.status === 404) {
        resultado = 'El movimiento ya no existía.'; // otra pestaña o un doble clic ya lo eliminó: el resultado es el esperado
      } else {
        errorDialogo.hidden = false;
        errorDialogo.textContent = textoDeError(err);
      }
    }
    marcarEliminando(false);
    if (resultado === null) return; // falló: la ventana queda abierta con el error

    restaurarFoco = false; // el botón que la abrió ya no va a existir
    dialogo.close();
    mostrarMensaje(resultado);
    alEliminar(id);
    await cargar();
    titulo.focus();
  });

  return { alMostrar, recargar };
}