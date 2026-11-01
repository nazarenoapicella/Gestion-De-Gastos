// Repository: solo SQL. No decide nada (reglas en el Service).

// El tipo del movimiento no se guarda: es el de su categoría (plan §3).
const SELECT_MOVIMIENTO = `
  SELECT m.id,
         c.tipo,
         m.monto_centavos,
         m.fecha,
         m.categoria_id,
         c.nombre  AS categoria_nombre,
         c.activa  AS categoria_activa,
         m.descripcion,
         m.creado_en
    FROM movimientos m
    JOIN categorias c ON c.id = m.categoria_id`;

// La base usa nombres con guion bajo y 0/1; la API usa camelCase y booleanos.
function aMovimiento(fila) {
  return {
    id: fila.id,
    tipo: fila.tipo,
    montoCentavos: fila.monto_centavos,
    fecha: fila.fecha,
    categoriaId: fila.categoria_id,
    categoriaNombre: fila.categoria_nombre,
    categoriaActiva: fila.categoria_activa === 1,
    descripcion: fila.descripcion,
    creadoEn: fila.creado_en,
  };
}

export function buscarPorId(db, id) {
  const fila = db.prepare(`${SELECT_MOVIMIENTO} WHERE m.id = ?`).get(id);
  return fila ? aMovimiento(fila) : null;
}

// Inserta el movimiento y lo devuelve ya con los datos de su categoría.
export function crear(db, { montoCentavos, fecha, categoriaId, descripcion, creadoEn }) {
  const resultado = db
    .prepare(
      `INSERT INTO movimientos (monto_centavos, fecha, categoria_id, descripcion, creado_en)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(montoCentavos, fecha, categoriaId, descripcion, creadoEn);
  return buscarPorId(db, Number(resultado.lastInsertRowid));
}

// Reemplaza los datos editables del movimiento y lo devuelve actualizado.
// creado_en no se toca: la fecha de carga no cambia al editar.
export function actualizar(db, id, { montoCentavos, fecha, categoriaId, descripcion }) {
  db.prepare(
    `UPDATE movimientos
        SET monto_centavos = ?, fecha = ?, categoria_id = ?, descripcion = ?
      WHERE id = ?`
  ).run(montoCentavos, fecha, categoriaId, descripcion, id);
  return buscarPorId(db, id);
}