// Pantalla de presupuestos (HU-08, HU-09): definir, reemplazar y quitar límites, y ver cómo viene cada categoría.
// Solo arma la pantalla y habla con la API: el estado de cada límite lo calcula el servidor y los textos
// salen de presupuestos.js.
// El texto que viene de la API (nombres de categorías) se inserta con textContent, value o new Option(),
// nunca con innerHTML (CB-26).

import { api, ErrorDeApi } from '../api.js';
import { formatearMes, formatearMonto } from '../format.js';
import { hoyEnArgentina } from '../validaciones.js';
import { mesDe, mesesDisponibles } from '../consulta.js';
import { categoriasParaLimite, etiquetaDeOpcion, filaDePresupuesto, validarLimite } from '../presupuestos.js';

const MENSAJE_INESPERADO = 'Ocurrió un error inesperado. Intentá de nuevo.';
// Orden en que se recorren los campos (para enfocar el primero con error).
const CAMPOS = ['categoriaId', 'limite'];
// La API llama limiteCentavos al campo que el formulario llama limite.
const CAMPO_DE_LA_API = { categoriaId: 'categoriaId', limiteCentavos: 'limite' };

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

// `raiz` es el contenedor de toda la pantalla (con su formulario, selector de mes y lista).
export function iniciarPresupuestos(raiz) {
  const titulo = raiz.closest('[data-vista]').querySelector('h2');

  const mensaje = raiz.querySelector('[data-presupuestos-mensaje]');
  const aviso = raiz.querySelector('[data-presupuestos-aviso]');
  const fallo = raiz.querySelector('[data-presupuestos-fallo]');
  const botonReintentar = raiz.querySelector('[data-presupuestos-reintentar]');
  const estadoCarga = raiz.querySelector('[data-presupuestos-estado]');
  const contenido = raiz.querySelector('[data-presupuestos-contenido]');

  const formulario = raiz.querySelector('[data-formulario-limite]');
  const selectorCategoria = formulario.elements.categoriaId;
  const campoLimite = formulario.elements.limite;
  const botonGuardar = formulario.querySelector('[data-boton-guardar-limite]');
  const parrafosDeError = {
    categoriaId: formulario.querySelector('[data-error="categoriaId"]'),
    limite: formulario.querySelector('[data-error="limite"]'),
  };
  const controles = { categoriaId: selectorCategoria, limite: campoLimite };

  const filtros = raiz.querySelector('[data-presupuestos-filtros]');
  const selectorMes = filtros.elements.mes;
  const resumen = raiz.querySelector('[data-presupuestos-resumen]');
  const lista = raiz.querySelector('[data-presupuestos-lista]');
  const vacio = raiz.querySelector('[data-presupuestos-vacio]');

  let mes = mesDe(hoyEnArgentina()); // la pantalla abre con el mes actual
  let categorias = []; // las de gasto activas
  let items = []; // presupuestos del mes elegido (los de categorías activas con límite)
  let consultaVigente = 0; // numera los pedidos: solo vale la respuesta del último
  let enviando = false;
  let operando = false; // hay un "quitar límite" en curso

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

  // Errores del formulario

  function mostrarError(campo, texto) {
    const parrafo = parrafosDeError[campo];
    if (!parrafo) return false;
    parrafo.hidden = false;
    parrafo.textContent = texto;
    controles[campo].setAttribute('aria-invalid', 'true');
    return true;
  }

  function limpiarError(campo) {
    parrafosDeError[campo].hidden = true;
    parrafosDeError[campo].textContent = '';
    controles[campo].removeAttribute('aria-invalid');
  }

  function limpiarErrores() {
    for (const campo of CAMPOS) limpiarError(campo);
  }

  function enfocarPrimerError() {
    for (const campo of CAMPOS) {
      if (!parrafosDeError[campo].hidden) {
        controles[campo].focus();
        return;
      }
    }
  }

  // Selectores

  // Meses desde el actual hasta enero de 2000. Sin "Todos los meses": en esta pantalla el mes es obligatorio (RN-17).
  function llenarMeses() {
    const meses = mesesDisponibles(hoyEnArgentina());
    selectorMes.replaceChildren(...meses.map((m) => new Option(formatearMes(m), m)));
    selectorMes.value = meses.includes(mes) ? mes : meses[0];
    mes = selectorMes.value;
  }

  // Categorías de gasto activas, con el límite actual a la vista (guardar sobre una que ya tiene límite lo reemplaza).
  // Conserva la categoría elegida solo si sigue estando entre las ofrecidas.
  function llenarSelectorCategorias() {
    const elegida = selectorCategoria.value;
    const opciones = categoriasParaLimite(categorias, items);
    selectorCategoria.replaceChildren(
      new Option('Elegí una categoría', ''),
      ...opciones.map((c) => new Option(etiquetaDeOpcion(c), String(c.id)))
    );
    selectorCategoria.value = opciones.some((c) => String(c.id) === elegida) ? elegida : '';
  }

  // Lista de presupuestos

  function crearBoton(texto, { etiqueta, accion, id, alHacerClic }) {
    const boton = crear('button', {
      clase: 'boton boton--secundario boton--chico',
      texto,
      atributos: { type: 'button', 'aria-label': etiqueta, 'data-accion': accion, 'data-id': String(id) },
    });
    boton.addEventListener('click', () => alHacerClic(boton));
    return boton;
  }

  function crearItem(fila) {
    const estado = fila.estado.toLowerCase();
    const item = crear('li', { clase: `presupuesto presupuesto--${estado}` });

    // El estado se dice con texto (etiqueta y porcentaje), no solo con el color de la barra.
    const cabecera = crear('div', { clase: 'presupuesto__cabecera' });
    cabecera.append(
      crear('span', { clase: 'presupuesto__nombre', texto: fila.nombre }),
      crear('span', { clase: `etiqueta etiqueta--${estado}`, texto: fila.etiqueta })
    );

    // La barra es solo visual (aria-hidden): lo mismo ya está escrito debajo. Nunca pasa del 100 %.
    const barra = crear('div', { clase: 'barra', atributos: { 'aria-hidden': 'true' } });
    const relleno = crear('div', { clase: `barra__relleno barra__relleno--${estado}` });
    relleno.style.width = `${fila.ancho}%`;
    barra.append(relleno);

    const detalle = crear('p', {
      clase: 'presupuesto__detalle',
      texto: `${fila.gastado} gastados de ${fila.limite} · ${fila.porcentaje}`,
    });

    const acciones = crear('div', { clase: 'presupuesto__acciones' });
    acciones.append(
      crearBoton('Cambiar límite', {
        etiqueta: `Cambiar límite: ${fila.descripcion}`,
        accion: 'cambiar',
        id: fila.id,
        alHacerClic: () => cargarEnFormulario(fila),
      }),
      crearBoton('Quitar límite', {
        etiqueta: `Quitar límite: ${fila.descripcion}`,
        accion: 'quitar',
        id: fila.id,
        alHacerClic: () => quitar(fila),
      })
    );

    item.append(cabecera, barra, detalle, acciones);
    return item;
  }

  function mostrarLista() {
    const filas = items.map(filaDePresupuesto);
    lista.replaceChildren(...filas.map(crearItem));
    vacio.hidden = filas.length > 0;
    resumen.hidden = filas.length === 0;
    resumen.textContent = `${filas.length} ${filas.length === 1 ? 'límite definido' : 'límites definidos'} · ${formatearMes(mes)}`;
  }

  // Al terminar un cambio, el foco vuelve al botón de esa categoría (la lista se vuelve a dibujar);
  // si ya no existe, pasa al título.
  function enfocarAccion(id, accion) {
    const boton = lista.querySelector(`button[data-id="${id}"][data-accion="${accion}"]`);
    (boton ?? titulo).focus();
  }

  // Carga

  // Pide las categorías de gasto activas y los presupuestos del mes elegido.
  // Si mientras tanto se hizo otro pedido, esta respuesta se descarta.
  async function cargar() {
    const numero = ++consultaVigente;
    contenido.setAttribute('aria-busy', 'true');
    ocultarFallo();

    try {
      const [listaCategorias, respuesta] = await Promise.all([
        api.get('/api/categorias?tipo=GASTO&activa=true'),
        api.get(`/api/presupuestos?mes=${encodeURIComponent(mes)}`),
      ]);
      if (numero !== consultaVigente) return;

      categorias = listaCategorias;
      items = respuesta.items;
      mostrarLista();
      llenarSelectorCategorias();
      contenido.hidden = false;
    } catch (err) {
      if (numero !== consultaVigente) return;
      // Si falla, no se deja a la vista el estado de otro momento: mostraría números que no corresponden.
      contenido.hidden = true;
      mostrarFallo(textoDeError(err));
    } finally {
      if (numero === consultaVigente) {
        contenido.setAttribute('aria-busy', 'false');
        estadoCarga.hidden = true;
      }
    }
  }

  // Se ejecuta cada vez que se muestra la pantalla: los gastos y las categorías pudieron cambiar en otra.
  function alMostrar() {
    ocultarMensajes();
    llenarMeses();
    return cargar();
  }

  botonReintentar.addEventListener('click', alMostrar);

  filtros.addEventListener('submit', (evento) => evento.preventDefault());

  filtros.addEventListener('change', (evento) => {
    if (evento.target.name !== 'mes') return;
    mes = selectorMes.value;
    ocultarMensajes();
    cargar();
  });

  // Definir, reemplazar y cambiar un límite (HU-08)

  // "Cambiar límite": deja la categoría y el monto actual en el formulario, listos para editar.
  function cargarEnFormulario(fila) {
    limpiarErrores();
    selectorCategoria.value = String(fila.id);
    campoLimite.value = formatearMonto(fila.limiteCentavos).replace('$ ', '');
    formulario.scrollIntoView({ block: 'start' });
    campoLimite.focus();
    campoLimite.select();
  }

  // Mientras se envía, el botón queda deshabilitado (doble clic).
  function marcarEnvio(valor) {
    enviando = valor;
    botonGuardar.disabled = valor;
    botonGuardar.textContent = valor ? 'Guardando…' : 'Guardar límite';
    formulario.setAttribute('aria-busy', String(valor));
  }

  // Al corregir un campo se borra su error.
  formulario.addEventListener('input', (evento) => {
    if (Object.hasOwn(controles, evento.target.name)) limpiarError(evento.target.name);
  });

  // Muestra un error de la API: los de validación, junto a su campo; el resto, como aviso general.
  function mostrarErrorDeLaApi(err) {
    if (!(err instanceof ErrorDeApi) || err.codigo !== 'VALIDACION' || Object.keys(err.campos).length === 0) {
      mostrarAviso(textoDeError(err));
      return;
    }
    const sinLugar = [];
    for (const [campoApi, texto] of Object.entries(err.campos)) {
      const campo = CAMPO_DE_LA_API[campoApi];
      if (!campo || !mostrarError(campo, texto)) sinLugar.push(texto);
    }
    if (sinLugar.length > 0) mostrarAviso(sinLugar.join(' '));
    enfocarPrimerError();
    // Si la categoría ya no se puede usar (por ejemplo, la desactivaron en otra pestaña), la lista se pone al día.
    if (err.campos.categoriaId) cargar();
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    limpiarErrores();
    ocultarMensajes();

    const categoriaId = selectorCategoria.value;
    const resultado = validarLimite(campoLimite.value);
    if (categoriaId === '') mostrarError('categoriaId', 'Elegí una categoría.');
    if (!resultado.ok) mostrarError('limite', resultado.error);
    if (categoriaId === '' || !resultado.ok) {
      enfocarPrimerError();
      return;
    }

    const nombre = categorias.find((c) => String(c.id) === categoriaId)?.nombre ?? 'la categoría';
    const habiaLimite = items.some((i) => String(i.categoriaId) === categoriaId);

    marcarEnvio(true);
    try {
      const guardado = await api.put(`/api/presupuestos/${categoriaId}`, { limiteCentavos: resultado.valor });
      campoLimite.value = '';
      selectorCategoria.value = '';
      mostrarMensaje(
        `Límite ${habiaLimite ? 'actualizado' : 'definido'} para ${nombre}: ${formatearMonto(guardado.limiteCentavos)}.`
      );
      selectorCategoria.focus();
      await cargar();
    } catch (err) {
      if (esNoEncontrada(err)) {
        mostrarAviso('La categoría ya no existe.');
        await cargar();
      } else {
        mostrarErrorDeLaApi(err);
      }
    } finally {
      marcarEnvio(false);
    }
  });

  // Quitar un límite (HU-08): inmediato y sin confirmación, porque se puede volver a definir.
  // El mensaje incluye el monto que tenía, para poder restaurarlo.
  async function quitar(fila) {
    if (operando) return;
    operando = true;
    ocultarMensajes();
    for (const boton of lista.querySelectorAll('button')) boton.disabled = true;

    try {
      await api.delete(`/api/presupuestos/${fila.id}`);
      mostrarMensaje(`Límite quitado de ${fila.nombre} (era ${fila.limite}).`);
    } catch (err) {
      mostrarAviso(esNoEncontrada(err) ? `${fila.nombre} ya no tenía un límite definido.` : textoDeError(err));
    }

    await cargar(); // también deja la lista al día si el límite ya no existía
    operando = false;
    enfocarAccion(fila.id, 'quitar');
  }

  return { alMostrar };
}