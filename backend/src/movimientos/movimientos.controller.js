import { Router } from 'express';

// Controller: traduce HTTP a llamadas al Service. No tiene reglas de negocio.
export function crearRouterMovimientos(servicio) {
  const router = Router();

  router.post('/', (req, res) => {
    res.status(201).json(servicio.crear(req.body));
  });

  router.get('/:id', (req, res) => {
    res.json(servicio.obtener(req.params.id));
  });

  router.put('/:id', (req, res) => {
    res.json(servicio.editar(req.params.id, req.body));
  });


  router.delete('/:id', (req, res) => {
    servicio.eliminar(req.params.id);
    res.status(204).end();
  });

  return router;
}