import { Router } from 'express';

// Controller: traduce HTTP a llamadas al Service. No tiene reglas de negocio.
export function crearRouterReportes(servicio) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(servicio.resumen(req.query));
  });

  return router;
}