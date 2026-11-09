// Aviso de presupuestos (HU-09, CA-09.5): una franja visible en todas las pantallas cuando hay presupuestos
// en alerta o excedidos en el mes actual. Siempre es del mes actual (en Buenos Aires), aunque la persona
// esté mirando otro mes en la pantalla de presupuestos.
// El texto que viene de la API (nombres de categorías) se inserta con textContent, nunca con innerHTML (CB-26).

import { api, cambios } from './api.js';
import { mesDe } from './consulta.js';
import { avisoDeAlertas } from './presupuestos.js';
import { hoyEnArgentina } from './validaciones.js';

// `raiz` es la franja del aviso. Se pone al día al navegar (app.js llama a `actualizar`) y cada vez que
// el servidor acepta una escritura (evento "cambio" de api.js).
export function iniciarAvisoAlertas(raiz) {
  const titulo = raiz.querySelector('[data-aviso-titulo]');
  const lista = raiz.querySelector('[data-aviso-lista]');

  let consultaVigente = 0; // numera los pedidos: solo vale la respuesta del último
  let firmaMostrada = null; // lo que se está mostrando; null si el aviso está oculto

  function ocultar() {
    raiz.hidden = true;
    titulo.textContent = '';
    lista.replaceChildren();
    firmaMostrada = null;
  }

  function mostrar(aviso) {
    const firma = JSON.stringify(aviso);
    // Si no cambió nada, no se vuelve a escribir: un lector de pantalla no lo repite en cada navegación.
    if (firma === firmaMostrada) return;

    titulo.textContent = aviso.titulo;
    lista.replaceChildren(
      ...aviso.lineas.map((linea) => {
        const item = document.createElement('li');
        item.className = `aviso-alertas__item aviso-alertas__item--${linea.estado.toLowerCase()}`;
        item.textContent = linea.texto;
        return item;
      })
    );
    raiz.hidden = false;
    firmaMostrada = firma;
  }

  async function actualizar() {
    const numero = ++consultaVigente;
    try {
      const mes = mesDe(hoyEnArgentina()); // se calcula cada vez: el mes puede cambiar con la pantalla abierta
      const respuesta = await api.get(`/api/presupuestos?mes=${encodeURIComponent(mes)}`);
      if (numero !== consultaVigente) return;

      const aviso = avisoDeAlertas(respuesta.items);
      if (aviso === null) ocultar();
      else mostrar(aviso);
    } catch {
      if (numero !== consultaVigente) return;
      ocultar(); // sin información no se muestra nada: cada pantalla informa sus propios errores de conexión
    }
  }

  cambios.addEventListener('cambio', actualizar);

  return { actualizar };
}