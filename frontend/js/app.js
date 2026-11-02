// Punto de entrada del frontend: navegación entre vistas sin recargar la página.
// La vista activa se guarda en el hash de la URL (#resumen), así funcionan "Atrás" y los favoritos.

const VISTA_INICIAL = 'movimientos';

const vistas = Array.from(document.querySelectorAll('[data-vista]'));
const enlaces = Array.from(document.querySelectorAll('[data-enlace-vista]'));
const nombresDeVistas = vistas.map((vista) => vista.dataset.vista);

function mostrarVista({ moverFoco = false } = {}) {
  const pedida = location.hash.slice(1);
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
}

window.addEventListener('hashchange', () => mostrarVista({ moverFoco: true }));
mostrarVista();