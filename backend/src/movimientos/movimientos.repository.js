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


// Borra el movimiento (borrado definitivo, RN-10). Devuelve true si existía y se borró.
export function eliminar(db, id) {
  const resultado = db.prepare('DELETE FROM movimientos WHERE id = ?').run(id);
  return resultado.changes > 0;
}


// Arma el WHERE del listado y del conteo. Los fragmentos son fijos: los valores van como parámetros.
// `desde` y `hasta` son los límites del mes (texto AAAA-MM-DD, se comparan como texto).
function armarFiltro({ desde, hasta, tipo, categoriaId } = {}) {
  const condiciones = [];
  const parametros = [];
  if (desde !== undefined) {
    condiciones.push('m.fecha BETWEEN ? AND ?');
    parametros.push(desde, hasta);
  }
  if (tipo !== undefined) {
    condiciones.push('c.tipo = ?');
    parametros.push(tipo);
  }
  if (categoriaId !== undefined) {
    condiciones.push('m.categoria_id = ?');
    parametros.push(categoriaId);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  return { where, parametros };
}

// Cantidad de movimientos que cumplen el filtro.
export function contar(db, filtro) {
  const { where, parametros } = armarFiltro(filtro);
  return db
    .prepare(`SELECT COUNT(*) AS n FROM movimientos m JOIN categorias c ON c.id = m.categoria_id ${where}`)
    .get(...parametros).n;
}

// Una página de movimientos: fecha descendente y, a igual fecha, id descendente (RN-11).
export function listar(db, filtro, { limite, desplazamiento }) {
  const { where, parametros } = armarFiltro(filtro);
  const filas = db
    .prepare(`${SELECT_MOVIMIENTO} ${where} ORDER BY m.fecha DESC, m.id DESC LIMIT ? OFFSET ?`)
    .all(...parametros, limite, desplazamiento);
  return filas.map(aMovimiento);
}