import { Router } from 'express';

// Controller: traduce HTTP a llamadas al Service. No tiene reglas de negocio.
export function crearRouterPresupuestos(servicio) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(servicio.estadoDelMes(req.query));
  });

  router.put('/:categoriaId', (req, res) => {
    res.json(servicio.definirLimite(req.params.categoriaId, req.body));
  });

  router.delete('/:categoriaId', (req, res) => {
    servicio.quitarLimite(req.params.categoriaId);
    res.status(204).end();
  });

  return router;
}