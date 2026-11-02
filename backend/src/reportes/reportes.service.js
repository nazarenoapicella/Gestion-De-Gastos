import { rangoDeMesRequerido } from '../utils/fecha.js';
import * as repositorio from './reportes.repository.js';

// Service: reglas de los reportes (RN-12, RN-13, RN-17).

// RN-13: porcentaje redondeado a un decimal, mitad hacia arriba, calculado solo con enteros.
// (total / totalDelTipo * 100, a un decimal) = round(total * 1000 / totalDelTipo) / 10
// y round(a / b) con mitad hacia arriba = floor((2a + b) / (2b)). Así no hay errores de coma flotante.
function calcularPorcentaje(totalCentavos, totalDelTipo) {
  return Math.floor((2 * totalCentavos * 1000 + totalDelTipo) / (2 * totalDelTipo)) / 10;
}

export function crearServicioReportes(db) {
  return {
    // RN-17: el mes es obligatorio y tiene el formato AAAA-MM. Un mes válido sin movimientos
    // no es un error: devuelve ceros y listas vacías.
    resumen(consulta) {
            const { mes, desde, hasta } = rangoDeMesRequerido(consulta?.mes);

      // RN-12. Balance del mes: ingresos - gastos con fecha dentro del mes (puede ser negativo).
      const delMes = repositorio.totalesPorTipo(db, { desde, hasta });
      // Balance acumulado: todo lo anterior o igual al último día del mes consultado.
      // En un mes futuro, el mes queda en 0 pero el acumulado conserva lo anterior.
      const hastaElMes = repositorio.totalesPorTipo(db, { hasta });

      // RN-13: cada categoría con movimientos en el mes, con su porcentaje sobre el total de su tipo.
      // Las filas ya llegan ordenadas por tipo, total descendente y nombre.
      const porCategoria = { GASTO: [], INGRESO: [] };
      for (const fila of repositorio.totalesPorCategoria(db, { desde, hasta })) {
        porCategoria[fila.tipo].push({
          categoriaId: fila.categoriaId,
          nombre: fila.nombre,
          totalCentavos: fila.total,
          porcentaje: calcularPorcentaje(fila.total, delMes[fila.tipo]),
        });
      }

      return {
        mes,
        ingresosCentavos: delMes.INGRESO,
        gastosCentavos: delMes.GASTO,
        balanceMesCentavos: delMes.INGRESO - delMes.GASTO,
        balanceAcumuladoCentavos: hastaElMes.INGRESO - hastaElMes.GASTO,
        porCategoria,
      };
    },
  };
}