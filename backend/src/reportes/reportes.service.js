import { ErrorDeNegocio } from '../errores.js';
import { rangoDeMes } from '../utils/fecha.js';
import * as repositorio from './reportes.repository.js';

// Service: reglas de los reportes (RN-12, RN-17).

export function crearServicioReportes(db) {
  return {
    // RN-17: el mes es obligatorio y tiene el formato AAAA-MM. Un mes válido sin movimientos
    // no es un error: devuelve ceros.
    resumen(consulta) {
      const mes = consulta?.mes;
      if (mes === undefined) {
        const mensaje = 'Indicá el mes en el formato AAAA-MM.';
        throw new ErrorDeNegocio(400, 'MES_REQUERIDO', mensaje, { mes: mensaje });
      }
      const { desde, hasta } = rangoDeMes(mes); // lanza MES_INVALIDO si el formato no es válido

      // RN-12. Balance del mes: ingresos - gastos con fecha dentro del mes (puede ser negativo).
      const delMes = repositorio.totalesPorTipo(db, { desde, hasta });
      // Balance acumulado: todo lo anterior o igual al último día del mes consultado.
      // En un mes futuro, el mes queda en 0 pero el acumulado conserva lo anterior.
      const hastaElMes = repositorio.totalesPorTipo(db, { hasta });

      return {
        mes,
        ingresosCentavos: delMes.INGRESO,
        gastosCentavos: delMes.GASTO,
        balanceMesCentavos: delMes.INGRESO - delMes.GASTO,
        balanceAcumuladoCentavos: hastaElMes.INGRESO - hastaElMes.GASTO,
        // El resumen por categoría (RN-13) llega en T-13.
        porCategoria: { GASTO: [], INGRESO: [] },
      };
    },
  };
}