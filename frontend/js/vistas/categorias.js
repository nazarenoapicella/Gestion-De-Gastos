// Pantalla de categorías (HU-07): alta, renombrar, activar/desactivar y eliminar.
// Solo arma la pantalla y habla con la API: las reglas las decide el servidor y la lógica pura está en categorias.js.
// El texto que viene de la API (nombres de categorías) se inserta con textContent, nunca con innerHTML (CB-26).

import { api, ErrorDeApi } from '../api.js';
import { accionesDe, agruparPorTipo, describirCategoria, validarNombre } from '../categorias.js';

const MENSAJE_INESPERADO = 'Ocurrió un error inesperado. Intentá de nuevo.';
const TIPOS = ['GASTO', 'INGRESO'];

function textoDeError(err) {
  return err instanceof ErrorDeApi ? err.message : MENSAJE_INESPERADO;
}

const esNoEncontrada = (err) => err instanceof ErrorDeApi && err.status === 404;

function crear(etiqueta, { clase, texto, atributos = {} } = {}) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  for (const [nombre, valor] of Object.entries(atributos)) elemento.setAttribute(nombre, valor);
  return elemento;
}

// `raiz` es el contenedor de toda la pantalla (con su formulario, listas y ventanas).
export function iniciarCategorias(raiz) {
  const titulo = raiz.closest('[data-vista]').querySelector('h2');

  const mensaje = raiz.querySelector('[data-categorias-mensaje]');
  const aviso = raiz.querySelector('[data-categorias-aviso]');
  const fallo = raiz.querySelector('[data-categorias-fallo]');
  const botonReintentar = raiz.querySelector('[data-categorias-reintentar]');
  const estadoCarga = raiz.querySelector('[data-categorias-estado]');
  const contenedor = raiz.querySelector('[data-categorias-contenedor]');
  const listas = {
    GASTO: raiz.querySelector('[data-lista="GASTO"]'),
    INGRESO: raiz.querySelector('[data-lista="INGRESO"]'),
  };

  // Alta
  const formulario = raiz.querySelector('[data-formulario-categoria]');
  const campoNombre = formulario.elements.nombre;
  const botonCrear = formulario.querySelector('[data-boton-crear]');
  const errorNombre = formulario.querySelector('[data-error="nombre"]');
  const errorTipo = formulario.querySelector('[data-error="tipo"]');

  // Ventana de renombrar
  const dialogoRenombrar = raiz.querySelector('[data-dialogo-renombrar]');
  const formularioRenombrar = raiz.querySelector('[data-formulario-renombrar]');
  const textoActual = raiz.querySelector('[data-renombrar-actual]');
  const campoNuevoNombre = formularioRenombrar.elements.nombre;
  const errorNuevoNombre = raiz.querySelector('[data-renombrar-error-nombre]');
  const errorRenombrar = raiz.querySelector('[data-renombrar-error]');
  const botonCancelarNombre = raiz.querySelector('[data-renombrar-cancelar]');
  const botonGuardarNombre = raiz.querySelector('[data-renombrar-guardar]');

  // Ventana de eliminar
  const dialogoEliminar = raiz.querySelector('[data-dialogo-eliminar]');
  const detalleEliminar = raiz.querySelector('[data-eliminar-detalle]');
  const errorEliminar = raiz.querySelector('[data-eliminar-error]');
  const botonCancelarEliminar = raiz.querySelector('[data-eliminar-cancelar]');
  const botonConfirmarEliminar = raiz.querySelector('[data-eliminar-confirmar]');

  let categorias = []; // todas, activas o no
  let consultaVigente = 0; // numera los pedidos: solo vale la respuesta del último
  let operando = false; // hay un activar/desactivar en curso
  let enviandoAlta = false;
  let renombrando = null; // { categoria, boton } mientras la ventana de renombrar está abierta
  let guardandoNombre = false;
  let restaurarFocoRenombrar = true;
  let aEliminar = null; // { categoria, boton } mientras la ventana de eliminar está abierta
  let eliminando = false;
  let restaurarFocoEliminar = true;

  // Mensajes de la pantalla

  function mostrarMensaje(texto) {
    mensaje.hidden = false;
    mensaje.textContent = texto;
  }

  function mostrarAviso(texto) {
    aviso.hidden = false;
    aviso.textContent = texto;
  }

  function ocultarMensajes() {
    mensaje.hidden = true;
    mensaje.textContent = '';
    aviso.hidden = true;
    aviso.textContent = '';
  }

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

  // Listas

  function crearBoton(texto, { etiqueta, accion, id, clase = 'boton boton--secundario boton--chico', alHacerClic }) {
    const boton = crear('button', {
      clase,
      texto,
      atributos: { type: 'button', 'aria-label': etiqueta, 'data-accion': accion, 'data-id': String(id) },
    });
    boton.addEventListener('click', () => alHacerClic(boton));
    return boton;
  }

  function crearItem(categoria) {
    const frase = describirCategoria(categoria);
    const item = crear('li', { clase: categoria.activa ? 'categoria' : 'categoria categoria--inactiva' });

    // El estado se dice con texto (etiquetas), no solo con el estilo.
    const datos = crear('div', { clase: 'categoria__datos' });
    datos.append(crear('span', { clase: 'categoria__nombre', texto: categoria.nombre }));
    if (categoria.protegida) datos.append(crear('span', { clase: 'etiqueta', texto: 'Protegida' }));
    if (!categoria.activa) datos.append(crear('span', { clase: 'etiqueta etiqueta--inactiva', texto: 'Desactivada' }));
    item.append(datos);

    const acciones = crear('div', { clase: 'categoria__acciones' });
    for (const accion of accionesDe(categoria)) {
      if (accion === 'renombrar') {
        acciones.append(
          crearBoton('Renombrar', {
            etiqueta: `Renombrar: ${frase}`,
            accion: 'renombrar',
            id: categoria.id,
            alHacerClic: (boton) => abrirRenombrar(categoria, boton),
          })
        );
      } else if (accion === 'eliminar') {
        acciones.append(
          crearBoton('Eliminar', {
            etiqueta: `Eliminar: ${frase}`,
            accion: 'eliminar',
            id: categoria.id,
            clase: 'boton boton--secundario boton--chico boton--eliminar',
            alHacerClic: (boton) => pedirEliminar(categoria, boton),
          })
        );
      } else {
        const texto = accion === 'activar' ? 'Activar' : 'Desactivar';
        acciones.append(
          crearBoton(texto, {
            etiqueta: `${texto}: ${frase}`,
            accion: 'alternar',
            id: categoria.id,
            alHacerClic: (boton) => alternar(categoria, boton),
          })
        );
      }
    }
    if (acciones.children.length > 0) item.append(acciones);
    return item;
  }

  function mostrar() {
    const grupos = agruparPorTipo(categorias);
    for (const tipo of TIPOS) {
      const items = grupos[tipo].map(crearItem);
      listas[tipo].replaceChildren(
        ...(items.length > 0 ? items : [crear('li', { clase: 'texto-suave', texto: 'No hay categorías.' })])
      );
    }
  }

  // Si falla la carga, se vacían las listas: mostrar las anteriores sería mostrar un estado que ya no es seguro.
  function vaciar() {
    for (const tipo of TIPOS) listas[tipo].replaceChildren();
  }

  // Al terminar un cambio, el foco vuelve al botón de esa categoría (la lista se vuelve a dibujar);
  // si ya no existe, pasa al título.
  function enfocarAccion(id, accion) {
    const boton = contenedor.querySelector(`button[data-id="${id}"][data-accion="${accion}"]`);
    (boton ?? titulo).focus();
  }

  // Pide las categorías (también las desactivadas). Si mientras tanto se hizo otro pedido, esta respuesta se descarta.
  async function cargar() {
    const numero = ++consultaVigente;
    contenedor.setAttribute('aria-busy', 'true');
    ocultarFallo();

    try {
      const lista = await api.get('/api/categorias');
      if (numero !== consultaVigente) return;
      categorias = lista;
      mostrar();
    } catch (err) {
      if (numero !== consultaVigente) return;
      categorias = [];
      vaciar();
      mostrarFallo(textoDeError(err));
    } finally {
      if (numero === consultaVigente) {
        contenedor.setAttribute('aria-busy', 'false');
        estadoCarga.hidden = true;
      }
    }
  }

  // Se ejecuta cada vez que se muestra la pantalla: las categorías pudieron cambiar en otra.
  function alMostrar() {
    ocultarMensajes();
    return cargar();
  }

  botonReintentar.addEventListener('click', alMostrar);

  // Alta (HU-07)

  function mostrarErrorAlta(campo, texto) {
    if (campo === 'nombre') {
      errorNombre.hidden = false;
      errorNombre.textContent = texto;
      campoNombre.setAttribute('aria-invalid', 'true');
    } else {
      errorTipo.hidden = false;
      errorTipo.textContent = texto;
    }
  }

  function limpiarErroresAlta() {
    errorNombre.hidden = true;
    errorNombre.textContent = '';
    campoNombre.removeAttribute('aria-invalid');
    errorTipo.hidden = true;
    errorTipo.textContent = '';
  }

  function marcarEnvioAlta(valor) {
    enviandoAlta = valor;
    botonCrear.disabled = valor;
    botonCrear.textContent = valor ? 'Creando…' : 'Crear categoría';
    formulario.setAttribute('aria-busy', String(valor));
  }

  formulario.addEventListener('input', (evento) => {
    if (evento.target === campoNombre) {
      errorNombre.hidden = true;
      errorNombre.textContent = '';
      campoNombre.removeAttribute('aria-invalid');
    }
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviandoAlta) return;
    limpiarErroresAlta();
    ocultarMensajes();

    const resultado = validarNombre(campoNombre.value);
    if (!resultado.ok) {
      mostrarErrorAlta('nombre', resultado.error);
      campoNombre.focus();
      return;
    }

    marcarEnvioAlta(true);
    try {
      const creada = await api.post('/api/categorias', { nombre: resultado.valor, tipo: formulario.elements.tipo.value });
      campoNombre.value = '';
      mostrarMensaje(`Categoría creada: ${creada.nombre}.`);
      campoNombre.focus();
      await cargar();
    } catch (err) {
      if (err instanceof ErrorDeApi && (err.campos.nombre || err.campos.tipo)) {
        if (err.campos.nombre) mostrarErrorAlta('nombre', err.campos.nombre);
        if (err.campos.tipo) mostrarErrorAlta('tipo', err.campos.tipo);
        if (err.campos.nombre) campoNombre.focus();
      } else {
        mostrarAviso(textoDeError(err));
      }
    } finally {
      marcarEnvioAlta(false);
    }
  });

  // Activar / desactivar: inmediato, sin confirmación (es reversible)

  async function alternar(categoria, boton) {
    if (operando) return;
    operando = true;
    boton.disabled = true;
    ocultarMensajes();

    try {
      const actualizada = await api.patch(`/api/categorias/${categoria.id}`, { activa: !categoria.activa });
      mostrarMensaje(
        actualizada.activa ? `Categoría activada: ${actualizada.nombre}.` : `Categoría desactivada: ${actualizada.nombre}.`
      );
    } catch (err) {
      mostrarAviso(esNoEncontrada(err) ? 'La categoría ya no existe.' : textoDeError(err));
    }

    await cargar(); // también deja la lista al día si la categoría ya no existía
    operando = false;
    enfocarAccion(categoria.id, 'alternar');
  }

  // Renombrar (ventana)

  function limpiarErroresRenombrar() {
    errorNuevoNombre.hidden = true;
    errorNuevoNombre.textContent = '';
    campoNuevoNombre.removeAttribute('aria-invalid');
    errorRenombrar.hidden = true;
    errorRenombrar.textContent = '';
  }

  function mostrarErrorNuevoNombre(texto) {
    errorNuevoNombre.hidden = false;
    errorNuevoNombre.textContent = texto;
    campoNuevoNombre.setAttribute('aria-invalid', 'true');
    campoNuevoNombre.focus();
  }

  function marcarGuardandoNombre(valor) {
    guardandoNombre = valor;
    botonGuardarNombre.disabled = valor;
    botonCancelarNombre.disabled = valor;
    botonGuardarNombre.textContent = valor ? 'Guardando…' : 'Guardar';
  }

  function abrirRenombrar(categoria, boton) {
    renombrando = { categoria, boton };
    textoActual.textContent = `Categoría actual: ${describirCategoria(categoria)}.`;
    campoNuevoNombre.value = categoria.nombre;
    limpiarErroresRenombrar();
    dialogoRenombrar.showModal();
    campoNuevoNombre.select();
  }

  campoNuevoNombre.addEventListener('input', () => {
    errorNuevoNombre.hidden = true;
    errorNuevoNombre.textContent = '';
    campoNuevoNombre.removeAttribute('aria-invalid');
  });

  botonCancelarNombre.addEventListener('click', () => dialogoRenombrar.close());

  // Esc no cierra la ventana mientras se está guardando.
  dialogoRenombrar.addEventListener('cancel', (evento) => {
    if (guardandoNombre) evento.preventDefault();
  });

  // Si la ventana se cerró sin guardar, el foco vuelve al botón que la abrió.
  dialogoRenombrar.addEventListener('close', () => {
    const origen = renombrando?.boton;
    renombrando = null;
    if (restaurarFocoRenombrar && origen?.isConnected) origen.focus();
    restaurarFocoRenombrar = true;
  });

  formularioRenombrar.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (guardandoNombre || renombrando === null) return;
    limpiarErroresRenombrar();

    const { categoria } = renombrando;
    const resultado = validarNombre(campoNuevoNombre.value);
    if (!resultado.ok) {
      mostrarErrorNuevoNombre(resultado.error);
      return;
    }
    if (resultado.valor === categoria.nombre) {
      dialogoRenombrar.close(); // sin cambios: no hay nada que enviar
      return;
    }

    marcarGuardandoNombre(true);
    try {
      const actualizada = await api.patch(`/api/categorias/${categoria.id}`, { nombre: resultado.valor });
      restaurarFocoRenombrar = false; // el botón que la abrió se va a volver a dibujar
      dialogoRenombrar.close();
      ocultarMensajes();
      mostrarMensaje(`Categoría renombrada: ${actualizada.nombre}.`);
      await cargar();
      enfocarAccion(categoria.id, 'renombrar');
    } catch (err) {
      if (esNoEncontrada(err)) {
        restaurarFocoRenombrar = false;
        dialogoRenombrar.close();
        ocultarMensajes();
        mostrarAviso('La categoría ya no existe.');
        await cargar();
        titulo.focus();
      } else if (err instanceof ErrorDeApi && err.campos.nombre) {
        mostrarErrorNuevoNombre(err.campos.nombre);
      } else {
        errorRenombrar.hidden = false;
        errorRenombrar.textContent = textoDeError(err);
      }
    } finally {
      marcarGuardandoNombre(false);
    }
  });

  // Eliminar (ventana de confirmación, RN-08)

  function marcarEliminando(valor) {
    eliminando = valor;
    botonConfirmarEliminar.disabled = valor;
    botonCancelarEliminar.disabled = valor;
    botonConfirmarEliminar.textContent = valor ? 'Eliminando…' : 'Confirmar';
  }

  function pedirEliminar(categoria, boton) {
    aEliminar = { categoria, boton };
    detalleEliminar.textContent = describirCategoria(categoria);
    errorEliminar.hidden = true;
    errorEliminar.textContent = '';
    dialogoEliminar.showModal();
  }

  botonCancelarEliminar.addEventListener('click', () => dialogoEliminar.close());

  // Esc no cierra la ventana mientras se está eliminando.
  dialogoEliminar.addEventListener('cancel', (evento) => {
    if (eliminando) evento.preventDefault();
  });

  // Si la ventana se cerró sin eliminar, el foco vuelve al botón que la abrió.
  dialogoEliminar.addEventListener('close', () => {
    const origen = aEliminar?.boton;
    aEliminar = null;
    if (restaurarFocoEliminar && origen?.isConnected) origen.focus();
    restaurarFocoEliminar = true;
  });

  botonConfirmarEliminar.addEventListener('click', async () => {
    if (eliminando || aEliminar === null) return;
    const { categoria } = aEliminar;

    marcarEliminando(true);
    let resultado = null;
    try {
      await api.delete(`/api/categorias/${categoria.id}`);
      resultado = `Categoría eliminada: ${categoria.nombre}.`;
    } catch (err) {
      if (esNoEncontrada(err)) {
        resultado = 'La categoría ya no existía.'; // otra pestaña o un doble clic ya la eliminó: el resultado es el esperado
      } else {
        // Por ejemplo, tiene movimientos: el servidor explica el motivo y sugiere desactivarla.
        errorEliminar.hidden = false;
        errorEliminar.textContent = textoDeError(err);
      }
    }
    marcarEliminando(false);
    if (resultado === null) return; // falló: la ventana queda abierta con el motivo

    restaurarFocoEliminar = false; // el botón que la abrió ya no va a existir
    dialogoEliminar.close();
    ocultarMensajes();
    mostrarMensaje(resultado);
    await cargar();
    titulo.focus();
  });

  // Navegar a otra pantalla con "Atrás" no deja una ventana abierta.
  window.addEventListener('hashchange', () => {
    if (dialogoRenombrar.open && !guardandoNombre) dialogoRenombrar.close();
    if (dialogoEliminar.open && !eliminando) dialogoEliminar.close();
  });

  return { alMostrar };
}