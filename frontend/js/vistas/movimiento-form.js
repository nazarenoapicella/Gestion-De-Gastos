// Formulario de alta y edición de movimientos (HU-01, HU-03).
// Solo arma la pantalla y habla con la API: las reglas de validación están en validaciones.js
// y la decisión final la toma siempre el servidor.
// El texto que viene de la API (nombres de categorías, descripciones) se inserta con
// textContent, value o new Option(), nunca con innerHTML (CB-26).

import { api, ErrorDeApi } from '../api.js';
import { formatearMonto } from '../format.js';
import { categoriasOfrecidas, hoyEnArgentina, validarMovimiento } from '../validaciones.js';

// Orden en que se recorren los campos (para enfocar el primero con error).
const CAMPOS = ['tipo', 'monto', 'fecha', 'categoriaId', 'descripcion'];
// La API llama montoCentavos al campo que el formulario llama monto.
const CAMPO_DE_LA_API = { montoCentavos: 'monto' };

const MENSAJE_INESPERADO = 'Ocurrió un error inesperado. Intentá de nuevo.';

function textoDeError(err) {
  return err instanceof ErrorDeApi ? err.message : MENSAJE_INESPERADO;
}

// `raiz` es el contenedor del formulario (con su título y mensajes).
// alGuardar: se llama después de guardar un alta o una edición (T-18 lo usa para refrescar el listado).
// alTerminarEdicion: se llama al guardar o cancelar una edición.
export function iniciarFormularioMovimiento(raiz, { alGuardar = () => {}, alTerminarEdicion = () => {} } = {}) {
  const formulario = raiz.querySelector('[data-formulario]');
  const titulo = raiz.querySelector('[data-titulo-formulario]');
  const mensaje = raiz.querySelector('[data-mensaje]');
  const errorGeneral = raiz.querySelector('[data-error-general]');
  const botonGuardar = raiz.querySelector('[data-boton-guardar]');
  const botonCancelar = raiz.querySelector('[data-boton-cancelar]');
  const selectorCategoria = formulario.elements.categoriaId;
  const campoFecha = formulario.elements.fecha;

  let modo = 'alta'; // 'alta' o 'edicion'
  let idEnEdicion = null;
  let categoriaActualId = null; // categoría que el movimiento ya tiene (solo en edición)
  let categorias = []; // todas, activas o no
  let enviando = false;

  const campoDe = (nombre) => formulario.querySelector(`[name="${nombre}"]`);
  const parrafoDeError = (campo) => raiz.querySelector(`[data-error="${campo}"]`);
  const etiquetaDeGuardar = () => (modo === 'edicion' ? 'Guardar cambios' : 'Guardar movimiento');

  // Mensajes

  function mostrarMensaje(texto) {
    mensaje.hidden = false;
    mensaje.textContent = texto;
  }

  function ocultarMensaje() {
    mensaje.hidden = true;
    mensaje.textContent = '';
  }

  function mostrarErrorGeneral(texto) {
    errorGeneral.hidden = false;
    errorGeneral.textContent = texto;
  }

  function mostrarError(campo, texto) {
    const parrafo = parrafoDeError(campo);
    if (!parrafo) return false;
    parrafo.hidden = false;
    parrafo.textContent = texto;
    if (campo !== 'tipo') campoDe(campo)?.setAttribute('aria-invalid', 'true');
    return true;
  }

  function limpiarError(campo) {
    const parrafo = parrafoDeError(campo);
    if (!parrafo) return;
    parrafo.hidden = true;
    parrafo.textContent = '';
    campoDe(campo)?.removeAttribute('aria-invalid');
  }

  function limpiarErrores() {
    for (const campo of CAMPOS) limpiarError(campo);
    errorGeneral.hidden = true;
    errorGeneral.textContent = '';
  }

  function enfocarPrimerError() {
    for (const campo of CAMPOS) {
      const parrafo = parrafoDeError(campo);
      if (parrafo && !parrafo.hidden) {
        campoDe(campo)?.focus();
        return;
      }
    }
  }

  // Categorías

  // Trae todas las categorías (también las desactivadas, hacen falta al editar).
  // Si falla, conserva la lista anterior y avisa.
  async function cargarCategorias() {
    try {
      categorias = await api.get('/api/categorias');
      return true;
    } catch (err) {
      mostrarErrorGeneral(textoDeError(err));
      return false;
    }
  }

  // Arma las opciones del selector según el tipo elegido (RN-04, RN-09).
  // Conserva la categoría `elegida` solo si sigue estando entre las ofrecidas.
  function llenarSelector(elegida = '') {
    const ofrecidas = categoriasOfrecidas(categorias, formulario.elements.tipo.value, categoriaActualId);
    selectorCategoria.replaceChildren(new Option('Elegí una categoría', ''));
    for (const categoria of ofrecidas) {
      const texto = categoria.activa ? categoria.nombre : `${categoria.nombre} (desactivada)`;
      selectorCategoria.append(new Option(texto, String(categoria.id)));
    }
    selectorCategoria.value = ofrecidas.some((c) => String(c.id) === elegida) ? elegida : '';
  }

  // Vuelve a pedir las categorías (pudieron cambiar en otra pantalla) y conserva la elegida.
  async function actualizarCategorias() {
    if (await cargarCategorias()) llenarSelector(selectorCategoria.value);
  }

  // Modos

  // Deja el formulario listo para un alta. Después de guardar un alta se conservan el tipo y la fecha.
  function prepararAlta(tipo = 'GASTO', fecha = hoyEnArgentina()) {
    modo = 'alta';
    idEnEdicion = null;
    categoriaActualId = null;
    formulario.reset();
    formulario.elements.tipo.value = tipo;
    campoFecha.max = hoyEnArgentina();
    campoFecha.value = fecha;
    titulo.textContent = 'Nuevo movimiento';
    botonGuardar.textContent = etiquetaDeGuardar();
    botonCancelar.hidden = true;
    limpiarErrores();
    llenarSelector();
  }

  async function abrirAlta() {
    prepararAlta();
    ocultarMensaje();
    await actualizarCategorias();
  }

  // Abre el formulario con los datos de un movimiento (el objeto que devuelve la API).
  async function abrirEdicion(movimiento) {
    limpiarErrores();
    ocultarMensaje();
    await cargarCategorias();

    modo = 'edicion';
    idEnEdicion = movimiento.id;
    categoriaActualId = movimiento.categoriaId;
    formulario.elements.tipo.value = movimiento.tipo;
    formulario.elements.monto.value = formatearMonto(movimiento.montoCentavos).replace('$ ', '');
    campoFecha.max = hoyEnArgentina();
    campoFecha.value = movimiento.fecha;
    formulario.elements.descripcion.value = movimiento.descripcion ?? '';
    llenarSelector(String(movimiento.categoriaId));
    titulo.textContent = 'Editar movimiento';
    botonGuardar.textContent = etiquetaDeGuardar();
    botonCancelar.hidden = false;
    campoDe('monto').focus();
  }

  async function abrirEdicionPorId(id) {
    try {
      await abrirEdicion(await api.get(`/api/movimientos/${id}`));
    } catch (err) {
      prepararAlta();
      mostrarErrorGeneral(textoDeError(err));
      alTerminarEdicion();
      await actualizarCategorias();
    }
  }

  // Envío

  function leerValores() {
    return {
      tipo: formulario.elements.tipo.value,
      monto: formulario.elements.monto.value,
      fecha: campoFecha.value,
      categoriaId: selectorCategoria.value,
      descripcion: formulario.elements.descripcion.value,
    };
  }

  // Mientras se envía, el botón queda deshabilitado (CB-25).
  function marcarEnvio(valor) {
    enviando = valor;
    botonGuardar.disabled = valor;
    botonCancelar.disabled = valor;
    botonGuardar.textContent = valor ? 'Guardando…' : etiquetaDeGuardar();
    formulario.setAttribute('aria-busy', String(valor));
  }

  // Muestra un error de la API: los de validación, junto a su campo; el resto, como aviso general.
  function mostrarErrorDeLaApi(err) {
    if (!(err instanceof ErrorDeApi) || err.codigo !== 'VALIDACION' || Object.keys(err.campos).length === 0) {
      mostrarErrorGeneral(textoDeError(err));
      return;
    }
    const sinLugar = [];
    for (const [campoApi, texto] of Object.entries(err.campos)) {
      const campo = CAMPO_DE_LA_API[campoApi] ?? campoApi;
      if (!mostrarError(campo, texto)) sinLugar.push(texto);
    }
    if (sinLugar.length > 0) mostrarErrorGeneral(sinLugar.join(' '));
    enfocarPrimerError();
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    limpiarErrores();
    ocultarMensaje();

    const valores = leerValores();
    const resultado = validarMovimiento(valores, hoyEnArgentina());
    if (!resultado.ok) {
      for (const [campo, texto] of Object.entries(resultado.errores)) mostrarError(campo, texto);
      enfocarPrimerError();
      return;
    }

    marcarEnvio(true);
    try {
      if (modo === 'edicion') {
        await api.put(`/api/movimientos/${idEnEdicion}`, resultado.payload);
        prepararAlta();
        mostrarMensaje('Cambios guardados.');
        alTerminarEdicion();
      } else {
        await api.post('/api/movimientos', resultado.payload);
        prepararAlta(valores.tipo, valores.fecha);
        mostrarMensaje('Movimiento guardado.');
        campoDe('monto').focus();
      }
      alGuardar();
    } catch (err) {
      mostrarErrorDeLaApi(err);
    } finally {
      marcarEnvio(false);
    }
  });

  // Al corregir un campo se borra su error; al cambiar el tipo, la categoría elegida deja de valer (RN-04).
  formulario.addEventListener('input', (evento) => {
    if (evento.target.name) limpiarError(evento.target.name);
  });

  formulario.addEventListener('change', (evento) => {
    if (evento.target.name === 'tipo') {
      limpiarError('categoriaId');
      llenarSelector('');
    }
  });

  botonCancelar.addEventListener('click', () => {
    prepararAlta();
    ocultarMensaje();
    alTerminarEdicion();
  });

  prepararAlta();

    return {
    get modo() {
      return modo;
    },
    get idEnEdicion() {
      return idEnEdicion;
    },
    abrirAlta,
    abrirEdicion,
    abrirEdicionPorId,
    alMostrar: actualizarCategorias,
  };
}