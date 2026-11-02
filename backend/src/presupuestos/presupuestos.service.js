import { ErrorDeNegocio } from '../errores.js';
import { validarMontoCentavos } from '../utils/dinero.js';
import { rangoDeMesRequerido } from '../utils/fecha.js';
import { convertirId } from '../utils/id.js';
import * as repositorioCategorias from '../categorias/categorias.repository.js';
import * as repositorio from './presupuestos.repository.js';

// Service: reglas de negocio de presupuestos (RN-02, RN-09, RN-15, RN-16, RN-17).

const MENSAJE_GENERAL = 'Revisá los datos ingresados.';

function errorNoEncontrado(mensaje) {
  return new ErrorDeNegocio(404, 'NO_ENCONTRADO', mensaje);
}

// RN-02 / RN-15: el límite tiene el mismo rango que un monto. La utilidad de dinero lanza un error;
// acá se convierte en { valor } o { error } para juntarlo con los demás en una sola respuesta.
function revisarLimite(limiteCentavos) {
  try {
    return { valor: validarMontoCentavos(limiteCentavos, 'limiteCentavos') };
  } catch (err) {
    if (err instanceof ErrorDeNegocio && err.campos.limiteCentavos) {
      return { error: err.campos.limiteCentavos };
    }
    throw err;
  }
}

// RN-16: estado según el consumo. Se compara con enteros (centavos), nunca con el porcentaje
// redondeado: 7.999.999 de 10.000.000 se muestra como 80,0 % pero todavía es NORMAL, y
// 10.000.001 de 10.000.000 se muestra como 100,0 % pero ya es EXCEDIDO.
// Se usa BigInt para que los productos nunca pierdan precisión.
function calcularEstado(gastado, limite) {
  const g = BigInt(gastado);
  const l = BigInt(limite);
  if (g > l) return 'EXCEDIDO'; // más del 100 %
  if (g * 100n >= l * 80n) return 'ALERTA'; // del 80 % al 100 %, ambos inclusive
  return 'NORMAL'; // menos del 80 %
}

// RN-16: consumo a un decimal, mitad hacia arriba, solo con enteros (misma fórmula que RN-13).
function calcularPorcentajeConsumo(gastado, limite) {
  const g = BigInt(gastado);
  const l = BigInt(limite);
  return Number((2n * g * 1000n + l) / (2n * l)) / 10;
}

// Orden por consumo exacto descendente: a antes que b si a.gastado / a.limite > b.gastado / b.limite,
// comparado con productos cruzados (sin dividir). Ante empate exacto, `sort` es estable y se
// mantiene el orden por nombre con el que llegan las filas.
function compararPorConsumoDescendente(a, b) {
  const izquierda = BigInt(b.gastado) * BigInt(a.limite);
  const derecha = BigInt(a.gastado) * BigInt(b.limite);
  if (izquierda > derecha) return 1;
  if (izquierda < derecha) return -1;
  return 0;
}

export function crearServicioPresupuestos(db, { reloj = () => new Date() } = {}) {
  // Lee la categoría y luego escribe: va en una transacción para que nada cambie entre medio (plan §6).
  const definirLimite = db.transaction((categoriaId, cuerpo) => {
    const categoria = repositorioCategorias.buscarPorId(db, categoriaId);
    if (!categoria) throw errorNoEncontrado('La categoría no existe.');

    const campos = {};

    // RN-15: solo las categorías de gasto y activas tienen presupuesto (RN-09).
    if (categoria.tipo !== 'GASTO') {
      campos.categoriaId = 'Solo las categorías de gasto pueden tener presupuesto.';
    } else if (!categoria.activa) {
      campos.categoriaId = 'La categoría está desactivada. Activala para definirle un límite.';
    }

    const resultadoLimite = revisarLimite((cuerpo ?? {}).limiteCentavos);
    if (resultadoLimite.error) campos.limiteCentavos = resultadoLimite.error;

    if (Object.keys(campos).length > 0) {
      throw new ErrorDeNegocio(400, 'VALIDACION', MENSAJE_GENERAL, campos);
    }

    return repositorio.guardar(db, {
      categoriaId: categoria.id,
      limiteCentavos: resultadoLimite.valor,
      actualizadoEn: reloj().toISOString(), // UTC, solo informativa
    });
  });

  return {
    // Orden de los chequeos: id inválido (404), categoría inexistente (404), datos inválidos (400).
    // Definir un límite sobre una categoría que ya tiene uno lo reemplaza (RN-15).
    definirLimite(categoriaIdTexto, cuerpo) {
      const categoriaId = convertirId(categoriaIdTexto);
      if (categoriaId === null) throw errorNoEncontrado('La categoría no existe.');
      return definirLimite(categoriaId, cuerpo);
    },

    // Es una sola sentencia: si no borró nada, esa categoría no tenía límite (o no existe).
    quitarLimite(categoriaIdTexto) {
      const categoriaId = convertirId(categoriaIdTexto);
      if (categoriaId === null) throw errorNoEncontrado('La categoría no tiene un límite definido.');
      if (!repositorio.eliminar(db, categoriaId)) {
        throw errorNoEncontrado('La categoría no tiene un límite definido.');
      }
    },

    // RN-16, RN-17: estado de cada presupuesto en el mes. El mes es obligatorio; un mes válido
    // sin límites o sin gastos no es un error. Se evalúa siempre con el límite vigente (RN-15),
    // incluso para meses pasados.
    estadoDelMes(consulta) {
      const { mes, desde, hasta } = rangoDeMesRequerido(consulta?.mes);

      const items = repositorio
        .estadoPorCategoria(db, { desde, hasta })
        .sort(compararPorConsumoDescendente)
        .map((fila) => ({
          categoriaId: fila.categoriaId,
          categoriaNombre: fila.nombre,
          limiteCentavos: fila.limite,
          gastadoCentavos: fila.gastado,
          porcentajeConsumo: calcularPorcentajeConsumo(fila.gastado, fila.limite),
          estado: calcularEstado(fila.gastado, fila.limite),
        }));

      return { mes, items };
    },
  };
}