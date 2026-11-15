import express from 'express';
import { config } from './config.js';
import { manejadorDeErrores, manejadorNoEncontrado } from './errores.js';
import { crearRouterCategorias } from './categorias/categorias.controller.js';
import { crearServicioCategorias } from './categorias/categorias.service.js';
import { crearRouterMovimientos } from './movimientos/movimientos.controller.js';
import { crearServicioMovimientos } from './movimientos/movimientos.service.js';
import { crearRouterReportes } from './reportes/reportes.controller.js';
import { crearServicioReportes } from './reportes/reportes.service.js';
import { crearRouterPresupuestos } from './presupuestos/presupuestos.controller.js';
import { crearServicioPresupuestos } from './presupuestos/presupuestos.service.js';

// db y reloj se inyectan para poder fijarlos en las pruebas (plan §6).
export function createApp({ db = null, reloj = () => new Date() } = {}) {
  const app = express();
  app.locals.db = db;
  app.locals.reloj = reloj;

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));

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
    app.use('/api/presupuestos', crearRouterPresupuestos(crearServicioPresupuestos(db, { reloj })));
  }

  app.use((req, res, next) => {
    if (req.path === '/test' || req.path.startsWith('/test/')) {
      return res.status(404).json({
        error: { codigo: 'NO_ENCONTRADO', mensaje: 'Recurso no encontrado.', campos: {} },
      });
    }
    return next();
  });
  app.use(express.static(config.frontendDir));
  app.use(manejadorNoEncontrado);
  app.use(manejadorDeErrores);

  return app;
}