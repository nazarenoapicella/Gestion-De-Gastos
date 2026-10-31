import express from 'express';
import { config } from './config.js';
import { manejadorDeErrores, manejadorNoEncontrado } from './errores.js';

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

  app.use(express.static(config.frontendDir));
  app.use(manejadorNoEncontrado);
  app.use(manejadorDeErrores);

  return app;
}