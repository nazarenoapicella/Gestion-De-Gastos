import { Router } from 'express';

// Controller: traduce HTTP a llamadas al Service. No tiene reglas de negocio.
export function crearRouterMovimientos(servicio) {
  const router = Router();

  router.post('/', (req, res) => {
    res.status(201).json(servicio.crear(req.body));
  });

  return router;
}