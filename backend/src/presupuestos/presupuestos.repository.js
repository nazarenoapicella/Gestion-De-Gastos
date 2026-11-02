// Repository: solo SQL. No decide nada (reglas en el Service).

// Crea el límite de la categoría o, si ya tenía uno, lo reemplaza (a lo sumo uno por categoría, RN-15).
// Devuelve el límite guardado.
export function guardar(db, { categoriaId, limiteCentavos, actualizadoEn }) {
  db.prepare(
    `INSERT INTO presupuestos (categoria_id, limite_centavos, actualizado_en)
     VALUES (?, ?, ?)
     ON CONFLICT (categoria_id) DO UPDATE
        SET limite_centavos = excluded.limite_centavos,
            actualizado_en  = excluded.actualizado_en`
  ).run(categoriaId, limiteCentavos, actualizadoEn);
  return { categoriaId, limiteCentavos };
}

// Quita el límite de la categoría. Devuelve true si tenía uno y se borró.
export function eliminar(db, categoriaId) {
  const resultado = db.prepare('DELETE FROM presupuestos WHERE categoria_id = ?').run(categoriaId);
  return resultado.changes > 0;
}


// Una fila por cada categoría activa que tiene límite, con lo gastado en el rango (cero si no gastó).
// `desde` y `hasta` son texto AAAA-MM-DD y se comparan como texto, sin conversiones de zona horaria.
// Las inactivas se excluyen (RN-09). Ordenadas por nombre; el orden por consumo lo define el Service.
export function estadoPorCategoria(db, { desde, hasta }) {
  const filas = db
    .prepare(
      `SELECT c.id AS categoria_id,
              c.nombre AS nombre,
              p.limite_centavos AS limite,
              COALESCE(SUM(m.monto_centavos), 0) AS gastado
         FROM presupuestos p
         JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN movimientos m ON m.categoria_id = c.id AND m.fecha BETWEEN ? AND ?
        WHERE c.activa = 1
        GROUP BY c.id, p.limite_centavos
        ORDER BY c.nombre_normalizado`
    )
    .all(desde, hasta);

  return filas.map((fila) => ({
    categoriaId: fila.categoria_id,
    nombre: fila.nombre,
    limite: fila.limite,
    gastado: fila.gastado,
  }));
}