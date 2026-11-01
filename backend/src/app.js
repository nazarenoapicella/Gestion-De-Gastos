import express from 'express';
import { config } from './config.js';
import { manejadorDeErrores, manejadorNoEncontrado } from './errores.js';
import { crearRouterCategorias } from './categorias/categorias.controller.js';
import { crearServicioCategorias } from './categorias/categorias.service.js';
import { crearRouterMovimientos } from './movimientos/movimientos.controller.js';
import { crearServicioMovimientos } from './movimientos/movimientos.service.js';
import { crearRouterReportes } from './reportes/reportes.controller.js';
import { crearServicioReportes } from './reportes/reportes.service.js';

// db y reloj se inyectan para poder fijarlos en las pruebas (plan §6).
export function createApp({ db = null, reloj = () => new Date() } = {}) {
  const app = express();
  app.locals.db = db;
  app.locals.reloj = reloj;

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ estado: 'ok' });
  });

  // Las rutas de cada módulo se montan acá a medida que avanzan las tareas.
  if (db) {
    app.use('/api/categorias', crearRouterCategorias(crearServicioCategorias(db)));
    app.use(
      '/api/movimientos',
      crearRouterMovimientos(crearServicioMovimientos(db, { reloj, zonaHoraria: config.timezone }))
    );
    app.use('/api/resumen', crearRouterReportes(crearServicioReportes(db)));
  }

  app.use(express.static(config.frontendDir));
  app.use(manejadorNoEncontrado);
  app.use(manejadorDeErrores);

  return app;
}