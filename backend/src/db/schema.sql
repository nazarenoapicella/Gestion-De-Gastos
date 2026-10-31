-- Esquema de Gestion-De-Gastos (docs/plan.md §3).
-- El dinero se guarda en centavos enteros (D-03). Las fechas, como texto AAAA-MM-DD.

CREATE TABLE IF NOT EXISTS categorias (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre             TEXT    NOT NULL CHECK (length(nombre) BETWEEN 1 AND 30),
  nombre_normalizado TEXT    NOT NULL,
  tipo               TEXT    NOT NULL CHECK (tipo IN ('INGRESO', 'GASTO')),
  activa             INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  protegida          INTEGER NOT NULL DEFAULT 0 CHECK (protegida IN (0, 1)),
  UNIQUE (tipo, nombre_normalizado)
);

-- El tipo del movimiento no se guarda: es el de su categoría.
CREATE TABLE IF NOT EXISTS movimientos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  monto_centavos INTEGER NOT NULL CHECK (monto_centavos BETWEEN 1 AND 99999999999),
  fecha          TEXT    NOT NULL,
  categoria_id   INTEGER NOT NULL REFERENCES categorias (id),
  descripcion    TEXT    CHECK (descripcion IS NULL OR length(descripcion) <= 140),
  creado_en      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movimientos_fecha     ON movimientos (fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_categoria ON movimientos (categoria_id);

CREATE TABLE IF NOT EXISTS presupuestos (
  categoria_id    INTEGER PRIMARY KEY REFERENCES categorias (id) ON DELETE CASCADE,
  limite_centavos INTEGER NOT NULL CHECK (limite_centavos BETWEEN 1 AND 99999999999),
  actualizado_en  TEXT    NOT NULL
);