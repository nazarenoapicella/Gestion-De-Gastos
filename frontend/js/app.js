// Punto de entrada del frontend: navegación entre vistas sin recargar la página.
// La vista activa se guarda en el hash de la URL (#resumen), así funcionan "Atrás" y los favoritos.
// Un enlace como #movimientos/editar/12 abre el formulario de movimientos para editar el movimiento 12.

import { iniciarFormularioMovimiento } from './vistas/movimiento-form.js';

const VISTA_INICIAL = 'movimientos';

const vistas = Array.from(document.querySelectorAll('[data-vista]'));
const enlaces = Array.from(document.querySelectorAll('[data-enlace-vista]'));
const nombresDeVistas = vistas.map((vista) => vista.dataset.vista);

const formularioMovimiento = iniciarFormularioMovimiento(
  document.querySelector('[data-formulario-movimiento]'),
  {
    // Si la edición se abrió con un enlace, al terminarla se vuelve a la dirección simple.
    alTerminarEdicion: () => {
      if (location.hash !== '#movimientos') history.replaceState(null, '', '#movimientos');
    },
  }
);

// Decide qué hacer con el formulario cada vez que se muestra la vista de movimientos.
function prepararFormulario(subruta) {
  const [accion, id] = subruta;
  if (accion === 'editar' && /^\d+$/.test(id ?? '')) {
    formularioMovimiento.abrirEdicionPorId(Number(id));
  } else if (formularioMovimiento.modo === 'edicion') {
    formularioMovimiento.abrirAlta(); // salir de la pantalla de edición la cancela
  } else {
    formularioMovimiento.alMostrar(); // pone al día las categorías sin perder lo que se escribió
  }
}

function mostrarVista({ moverFoco = false } = {}) {
  const [pedida, ...subruta] = location.hash.slice(1).split('/');
  const nombre = nombresDeVistas.includes(pedida) ? pedida : VISTA_INICIAL; // un hash desconocido abre la inicial

  for (const vista of vistas) {
    vista.hidden = vista.dataset.vista !== nombre;
  }
  for (const enlace of enlaces) {
    if (enlace.dataset.enlaceVista === nombre) enlace.setAttribute('aria-current', 'page');
    else enlace.removeAttribute('aria-current');
  }

  const activa = vistas.find((vista) => vista.dataset.vista === nombre);
  document.title = `${activa.dataset.titulo} · Gestión de Gastos`;

  // Al navegar, el foco pasa al título de la vista para que los lectores de pantalla anuncien el cambio.
  if (moverFoco) activa.querySelector('h2').focus();

  if (nombre === 'movimientos') prepararFormulario(pedida === 'movimientos' ? subruta : []);
}

window.addEventListener('hashchange', () => mostrarVista({ moverFoco: true }));
mostrarVista();