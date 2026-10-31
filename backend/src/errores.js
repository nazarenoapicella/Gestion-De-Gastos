// Error que el Service lanza cuando una regla de negocio no se cumple.
export class ErrorDeNegocio extends Error {
  constructor(status, codigo, mensaje, campos = {}) {
    super(mensaje);
    this.name = 'ErrorDeNegocio';
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

// Se ejecuta cuando ninguna ruta ni archivo estático atendió la petición.
export function manejadorNoEncontrado(req, res, next) {
  next(new ErrorDeNegocio(404, 'NO_ENCONTRADO', 'Recurso no encontrado.'));
}

// Manejador central de errores. Formato de respuesta según D-19.
// Express lo reconoce como manejador de errores por sus 4 parámetros.
// eslint-disable-next-line no-unused-vars
export function manejadorDeErrores(err, req, res, next) {
  if (err instanceof ErrorDeNegocio) {
    return res.status(err.status).json({
      error: { codigo: err.codigo, mensaje: err.message, campos: err.campos },
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: {
        codigo: 'JSON_INVALIDO',
        mensaje: 'El cuerpo de la petición no es un JSON válido.',
        campos: {},
      },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: {
      codigo: 'ERROR_INTERNO',
      mensaje: 'Ocurrió un error inesperado. Intentá de nuevo más tarde.',
      campos: {},
    },
  });
}