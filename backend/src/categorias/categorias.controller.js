import { Router } from 'express';

// Controller: traduce HTTP a llamadas al Service. No tiene reglas de negocio.
export function crearRouterCategorias(servicio) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(servicio.listar(req.query));
  });

  router.post('/', (req, res) => {
    res.status(201).json(servicio.crear(req.body));
  });

  router.patch('/:id', (req, res) => {
    res.json(servicio.modificar(req.params.id, req.body));
  });

  return router;
}