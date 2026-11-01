// Repository: solo SQL. No decide nada (reglas en el Service).

// Suma los movimientos agrupados por el tipo de su categoría (el movimiento no guarda su tipo).
// Sin `desde`, suma todo lo anterior o igual a `hasta` (es lo que necesita el balance acumulado).
// `desde` y `hasta` son texto AAAA-MM-DD y se comparan como texto, sin conversiones de zona horaria.
// Devuelve siempre las dos claves, en centavos enteros: { INGRESO, GASTO }.
export function totalesPorTipo(db, { desde, hasta }) {
  const condiciones = ['m.fecha <= ?'];
  const parametros = [hasta];
  if (desde !== undefined) {
    condiciones.unshift('m.fecha >= ?');
    parametros.unshift(desde);
  }

  const filas = db
    .prepare(
      `SELECT c.tipo AS tipo, SUM(m.monto_centavos) AS total
         FROM movimientos m
         JOIN categorias c ON c.id = m.categoria_id
        WHERE ${condiciones.join(' AND ')}
        GROUP BY c.tipo`
    )
    .all(...parametros);

  const totales = { INGRESO: 0, GASTO: 0 };
  for (const fila of filas) totales[fila.tipo] = fila.total;
  return totales;
}