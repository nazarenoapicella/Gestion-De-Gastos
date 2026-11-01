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