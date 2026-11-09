import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { inicializarBase } from '../src/db/index.js';
import { RELOJ_FIJO } from './helpers.js';

// Escenario de punta a punta (T-22). Arranca el sistema como lo hace server.js: abre la base (en memoria o
// en un archivo), crea el esquema, carga las categorías por defecto y levanta la app con el reloj fijo en
// 2026-10-30. Devuelve un cliente HTTP mínimo y cómo apagarlo.
async function arrancar(rutaDeBase = ':memory:') {
  const db = inicializarBase(rutaDeBase);
  const servidor = await new Promise((resolver) => {
    const s = createApp({ db, reloj: RELOJ_FIJO }).listen(0, () => resolver(s));
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;

  // Devuelve { status, cuerpo }; cuerpo es null si la respuesta no trae contenido (204).
  async function pedir(metodo, ruta, cuerpo) {
    const opciones = { method: metodo, headers: {} };
    if (cuerpo !== undefined) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }
    const res = await fetch(`${base}${ruta}`, opciones);
    const texto = await res.text();
    return { status: res.status, cuerpo: texto ? JSON.parse(texto) : null };
  }

  async function apagar() {
    servidor.closeAllConnections?.();
    await new Promise((fin) => servidor.close(fin));
    db.close();
  }

  return { pedir, apagar };
}

const idDe = async (pedir, nombre, tipo = 'GASTO') => {
  const { cuerpo } = await pedir('GET', '/api/categorias');
  return cuerpo.find((c) => c.nombre === nombre && c.tipo === tipo).id;
};

test('T-22.1 / RN-10, RN-12, RN-15, RN-16: sueldo, gasto, límite, pasarse por un centavo, eliminar y desactivar', async () => {
  const { pedir, apagar } = await arrancar();
  try {
    const presupuestos = async () => (await pedir('GET', '/api/presupuestos?mes=2026-10')).cuerpo.items;
    const resumen = async () => (await pedir('GET', '/api/resumen?mes=2026-10')).cuerpo;
    // Lo que el aviso de la interfaz muestra: presupuestos en alerta o excedidos del mes actual.
    const hayAviso = (items) => items.some((i) => i.estado === 'ALERTA' || i.estado === 'EXCEDIDO');

    // 1. Base nueva: categoría "Mascotas", ingreso de $ 500.000,00 y gasto de $ 80.000,00
    const mascotas = await pedir('POST', '/api/categorias', { nombre: 'Mascotas', tipo: 'GASTO' });
    assert.equal(mascotas.status, 201);
    const ofrecidas = await pedir('GET', '/api/categorias?tipo=GASTO&activa=true');
    assert.ok(ofrecidas.cuerpo.some((c) => c.nombre === 'Mascotas'));

    const alimentacion = await idDe(pedir, 'Alimentación');
    const sueldo = await pedir('POST', '/api/movimientos', {
      tipo: 'INGRESO',
      montoCentavos: 50000000,
      fecha: '2026-10-05',
      categoriaId: await idDe(pedir, 'Sueldo', 'INGRESO'),
      descripcion: 'Sueldo de octubre',
    });
    assert.equal(sueldo.status, 201);

    const gasto = await pedir('POST', '/api/movimientos', {
      tipo: 'GASTO',
      montoCentavos: 8000000,
      fecha: '2026-10-10',
      categoriaId: alimentacion,
      descripcion: 'Supermercado',
    });
    assert.equal(gasto.status, 201);

    const octubre = await resumen();
    assert.equal(octubre.ingresosCentavos, 50000000);
    assert.equal(octubre.gastosCentavos, 8000000);
    assert.equal(octubre.balanceMesCentavos, 42000000); // $ 420.000,00
    assert.equal(octubre.balanceAcumuladoCentavos, 42000000);

    // 2. Límite de $ 100.000,00 en Alimentación: con $ 80.000,00 gastados está en ALERTA (80,0 %) y hay aviso
    const limite = await pedir('PUT', `/api/presupuestos/${alimentacion}`, { limiteCentavos: 10000000 });
    assert.equal(limite.status, 200);

    const enAlerta = await presupuestos();
    assert.equal(enAlerta.length, 1);
    assert.equal(enAlerta[0].categoriaNombre, 'Alimentación');
    assert.equal(enAlerta[0].gastadoCentavos, 8000000);
    assert.equal(enAlerta[0].porcentajeConsumo, 80);
    assert.equal(enAlerta[0].estado, 'ALERTA');
    assert.equal(hayAviso(enAlerta), true);

    // 3. Editar el gasto a $ 100.000,01: pasa a EXCEDIDO (se muestra 100,0 %, pero el estado sale de los centavos)
    const editado = await pedir('PUT', `/api/movimientos/${gasto.cuerpo.id}`, {
      tipo: 'GASTO',
      montoCentavos: 10000001,
      fecha: '2026-10-10',
      categoriaId: alimentacion,
      descripcion: 'Supermercado',
    });
    assert.equal(editado.status, 200);

    const excedido = await presupuestos();
    assert.equal(excedido[0].gastadoCentavos, 10000001);
    assert.equal(excedido[0].porcentajeConsumo, 100);
    assert.equal(excedido[0].estado, 'EXCEDIDO');
    assert.equal(hayAviso(excedido), true);
    assert.equal((await resumen()).balanceMesCentavos, 39999999);

    // 4. Eliminar el gasto: el aviso desaparece y el balance vuelve a $ 500.000,00
    const eliminado = await pedir('DELETE', `/api/movimientos/${gasto.cuerpo.id}`);
    assert.equal(eliminado.status, 204);

    const sinGastos = await presupuestos();
    assert.equal(sinGastos[0].gastadoCentavos, 0);
    assert.equal(sinGastos[0].estado, 'NORMAL');
    assert.equal(hayAviso(sinGastos), false);

    const despues = await resumen();
    assert.equal(despues.gastosCentavos, 0);
    assert.equal(despues.balanceMesCentavos, 50000000);
    assert.equal(despues.balanceAcumuladoCentavos, 50000000);

    // 5. Desactivar "Alimentación" después de cargarle un movimiento
    const verduleria = await pedir('POST', '/api/movimientos', {
      tipo: 'GASTO',
      montoCentavos: 1000000,
      fecha: '2026-10-12',
      categoriaId: alimentacion,
      descripcion: 'Verdulería',
    });
    assert.equal(verduleria.status, 201);

    const desactivada = await pedir('PATCH', `/api/categorias/${alimentacion}`, { activa: false });
    assert.equal(desactivada.status, 200);

    // ya no se ofrece para movimientos nuevos
    const rechazado = await pedir('POST', '/api/movimientos', {
      tipo: 'GASTO',
      montoCentavos: 1000,
      fecha: '2026-10-12',
      categoriaId: alimentacion,
      descripcion: null,
    });
    assert.equal(rechazado.status, 400);
    assert.ok(rechazado.cuerpo.error.campos.categoriaId);

    const activas = await pedir('GET', '/api/categorias?tipo=GASTO&activa=true');
    assert.ok(!activas.cuerpo.some((c) => c.nombre === 'Alimentación'));

    // el movimiento sigue en el listado (marcado como de una categoría desactivada) y en el resumen
    const lista = await pedir('GET', '/api/movimientos?mes=2026-10');
    const guardado = lista.cuerpo.items.find((m) => m.id === verduleria.cuerpo.id);
    assert.equal(guardado.categoriaNombre, 'Alimentación');
    assert.equal(guardado.categoriaActiva, false);

    const conInactiva = await resumen();
    assert.equal(conInactiva.gastosCentavos, 1000000);
    assert.deepEqual(
      conInactiva.porCategoria.GASTO.map((c) => c.nombre),
      ['Alimentación']
    );

    // su límite se conserva pero no se muestra mientras está desactivada; al reactivarla, vuelve
    assert.deepEqual(await presupuestos(), []);
    const reactivada = await pedir('PATCH', `/api/categorias/${alimentacion}`, { activa: true });
    assert.equal(reactivada.status, 200);

    const conservado = await presupuestos();
    assert.equal(conservado.length, 1);
    assert.equal(conservado[0].limiteCentavos, 10000000);
    assert.equal(conservado[0].gastadoCentavos, 1000000);
    assert.equal(conservado[0].porcentajeConsumo, 10);
    assert.equal(conservado[0].estado, 'NORMAL');
  } finally {
    await apagar();
  }
});

test('T-22.2: al reiniciar el servidor, todos los datos siguen y el seed no duplica las categorías', async (t) => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'gestion-de-gastos-'));
  t.after(() => fs.rmSync(carpeta, { recursive: true, force: true }));
  const rutaDeBase = path.join(carpeta, 'gastos.db');

  let idDelMovimiento;
  const primera = await arrancar(rutaDeBase);
  try {
    const { pedir } = primera;
    const categoria = await pedir('POST', '/api/categorias', { nombre: 'Mascotas', tipo: 'GASTO' });
    assert.equal(categoria.status, 201);

    const movimiento = await pedir('POST', '/api/movimientos', {
      tipo: 'GASTO',
      montoCentavos: 250000,
      fecha: '2026-10-20',
      categoriaId: categoria.cuerpo.id,
      descripcion: 'Veterinario',
    });
    assert.equal(movimiento.status, 201);
    idDelMovimiento = movimiento.cuerpo.id;

    const limite = await pedir('PUT', `/api/presupuestos/${categoria.cuerpo.id}`, { limiteCentavos: 500000 });
    assert.equal(limite.status, 200);
  } finally {
    await primera.apagar();
  }

  // Reinicio: se vuelve a abrir el mismo archivo, con el mismo arranque que usa server.js.
  const segunda = await arrancar(rutaDeBase);
  try {
    const { pedir } = segunda;

    const categorias = await pedir('GET', '/api/categorias');
    assert.equal(categorias.cuerpo.length, 12); // las 11 por defecto y "Mascotas": el seed no se repitió
    assert.equal(categorias.cuerpo.filter((c) => c.nombre === 'Mascotas').length, 1);

    const movimiento = await pedir('GET', `/api/movimientos/${idDelMovimiento}`);
    assert.equal(movimiento.status, 200);
    assert.equal(movimiento.cuerpo.montoCentavos, 250000);
    assert.equal(movimiento.cuerpo.descripcion, 'Veterinario');
    assert.equal(movimiento.cuerpo.categoriaNombre, 'Mascotas');

    const estado = await pedir('GET', '/api/presupuestos?mes=2026-10');
    assert.equal(estado.cuerpo.items.length, 1);
    assert.equal(estado.cuerpo.items[0].limiteCentavos, 500000);
    assert.equal(estado.cuerpo.items[0].gastadoCentavos, 250000);
    assert.equal(estado.cuerpo.items[0].porcentajeConsumo, 50);
  } finally {
    await segunda.apagar();
  }
});

// D-20: el sistema no detecta duplicados. La interfaz deshabilita el botón mientras envía; si dos pedidos
// iguales llegan igual, se crean dos movimientos. Es una limitación conocida y documentada.
test('T-22.3 / CB-25, D-20: dos pedidos iguales que llegan a la vez crean dos movimientos', async () => {
  const { pedir, apagar } = await arrancar();
  try {
    const cuerpo = {
      tipo: 'GASTO',
      montoCentavos: 123456,
      fecha: '2026-10-29',
      categoriaId: await idDe(pedir, 'Alimentación'),
      descripcion: 'Supermercado',
    };
    const [uno, dos] = await Promise.all([
      pedir('POST', '/api/movimientos', cuerpo),
      pedir('POST', '/api/movimientos', cuerpo),
    ]);
    assert.equal(uno.status, 201);
    assert.equal(dos.status, 201);
    assert.notEqual(uno.cuerpo.id, dos.cuerpo.id);

    const lista = await pedir('GET', '/api/movimientos?mes=2026-10');
    assert.equal(lista.cuerpo.total, 2);
  } finally {
    await apagar();
  }
});

// CB-26: el servidor guarda y devuelve el texto tal cual. Que nunca se interprete como código lo garantiza
// la interfaz (textContent); el guardia T-22.6 verifica que no se use innerHTML.
test('T-22.4 / CB-26: una descripción y un nombre con caracteres especiales se guardan y devuelven literales', async () => {
  const { pedir, apagar } = await arrancar();
  try {
    const descripcion = `<script>alert("x")</script> & 'y' <b>z</b>`;
    const creado = await pedir('POST', '/api/movimientos', {
      tipo: 'GASTO',
      montoCentavos: 100,
      fecha: '2026-10-29',
      categoriaId: await idDe(pedir, 'Alimentación'),
      descripcion,
    });
    assert.equal(creado.status, 201);
    assert.equal(creado.cuerpo.descripcion, descripcion);

    const leido = await pedir('GET', `/api/movimientos/${creado.cuerpo.id}`);
    assert.equal(leido.cuerpo.descripcion, descripcion);

    const categoria = await pedir('POST', '/api/categorias', { nombre: '<b>x</b>', tipo: 'GASTO' });
    assert.equal(categoria.status, 201);
    assert.equal(categoria.cuerpo.nombre, '<b>x</b>');

    const lista = await pedir('GET', '/api/categorias');
    assert.ok(lista.cuerpo.some((c) => c.nombre === '<b>x</b>'));
  } finally {
    await apagar();
  }
});

// RN-17 está en tres módulos (movimientos, resumen y presupuestos) que comparten el chequeo del mes.
// Esta prueba verifica que los tres traten igual un mes inválido.
test('T-22.5 / RN-17, CB-21, CB-22: los tres endpoints por mes tratan igual un mes inválido, faltante o sin movimientos', async () => {
  const { pedir, apagar } = await arrancar();
  try {
    for (const ruta of ['/api/movimientos', '/api/resumen', '/api/presupuestos']) {
      for (const mes of ['2026-13', '2026-00', '2026-1', '26-10']) {
        const { status, cuerpo } = await pedir('GET', `${ruta}?mes=${mes}`);
        assert.equal(status, 400, `${ruta}?mes=${mes}`);
        assert.equal(cuerpo.error.codigo, 'MES_INVALIDO', `${ruta}?mes=${mes}`);
      }

      // un mes válido sin movimientos no es un error
      const vacio = await pedir('GET', `${ruta}?mes=2026-08`);
      assert.equal(vacio.status, 200, `${ruta}?mes=2026-08`);
    }

    // sin mes: obligatorio en los reportes; opcional en el listado (sin mes, todos los meses)
    for (const ruta of ['/api/resumen', '/api/presupuestos']) {
      const { status, cuerpo } = await pedir('GET', ruta);
      assert.equal(status, 400, ruta);
      assert.equal(cuerpo.error.codigo, 'MES_REQUERIDO', ruta);
    }
    const todos = await pedir('GET', '/api/movimientos');
    assert.equal(todos.status, 200);
  } finally {
    await apagar();
  }
});