// Repository: solo SQL. No decide nada (reglas en el Service).

const COLUMNAS = 'id, nombre, tipo, activa, protegida';

// La base guarda 0/1; la API habla en booleanos.
function aCategoria(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    activa: fila.activa === 1,
    protegida: fila.protegida === 1,
  };
}

// Lista por tipo y nombre. Los filtros son opcionales; `activa` es un booleano.
// El texto del WHERE se arma solo con fragmentos fijos: los valores van siempre como parámetros.
export function listar(db, { tipo, activa } = {}) {
  const condiciones = [];
  const parametros = [];
  if (tipo !== undefined) {
    condiciones.push('tipo = ?');
    parametros.push(tipo);
  }
  if (activa !== undefined) {
    condiciones.push('activa = ?');
    parametros.push(activa ? 1 : 0);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = db
    .prepare(`SELECT ${COLUMNAS} FROM categorias ${where} ORDER BY tipo, nombre_normalizado`)
    .all(...parametros);
  return filas.map(aCategoria);
}

export function buscarPorId(db, id) {
  const fila = db.prepare(`SELECT ${COLUMNAS} FROM categorias WHERE id = ?`).get(id);
  return fila ? aCategoria(fila) : null;
}

// Inserta una categoría nueva (activa y no protegida) y la devuelve.
// Si el nombre normalizado ya existe para ese tipo, SQLite lanza SQLITE_CONSTRAINT_UNIQUE.
export function crear(db, { nombre, nombreNormalizado, tipo }) {
  const resultado = db
    .prepare('INSERT INTO categorias (nombre, nombre_normalizado, tipo) VALUES (?, ?, ?)')
    .run(nombre, nombreNormalizado, tipo);
  return buscarPorId(db, Number(resultado.lastInsertRowid));
}

// Cambia solo los campos que vengan definidos y devuelve la categoría actualizada.
// Si el nuevo nombre choca con otra categoría del mismo tipo, SQLite lanza SQLITE_CONSTRAINT_UNIQUE.
export function actualizar(db, id, { nombre, nombreNormalizado, activa } = {}) {
  const asignaciones = [];
  const parametros = [];
  if (nombre !== undefined) {
    asignaciones.push('nombre = ?', 'nombre_normalizado = ?');
    parametros.push(nombre, nombreNormalizado);
  }
  if (activa !== undefined) {
    asignaciones.push('activa = ?');
    parametros.push(activa ? 1 : 0);
  }
  if (asignaciones.length > 0) {
    db.prepare(`UPDATE categorias SET ${asignaciones.join(', ')} WHERE id = ?`).run(...parametros, id);
  }
  return buscarPorId(db, id);
}

// Cantidad de movimientos que usan la categoría (activa o no).
export function contarMovimientos(db, id) {
  return db.prepare('SELECT COUNT(*) AS n FROM movimientos WHERE categoria_id = ?').get(id).n;
}

// Borra la categoría. Su presupuesto, si lo tiene, se elimina solo por el
// ON DELETE CASCADE del esquema (requiere foreign_keys = ON, que abrirBase activa).
export function eliminar(db, id) {
  db.prepare('DELETE FROM categorias WHERE id = ?').run(id);
}