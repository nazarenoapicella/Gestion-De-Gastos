import { normalizarNombre } from '../utils/texto.js';

// Categorías por defecto (RN-07). "Otros gastos" y "Otros ingresos" son protegidas.
export const CATEGORIAS_POR_DEFECTO = [
  { nombre: 'Alimentación', tipo: 'GASTO', protegida: 0 },
  { nombre: 'Transporte', tipo: 'GASTO', protegida: 0 },
  { nombre: 'Vivienda', tipo: 'GASTO', protegida: 0 },
  { nombre: 'Servicios', tipo: 'GASTO', protegida: 0 },
  { nombre: 'Salud', tipo: 'GASTO', protegida: 0 },
  { nombre: 'Ocio', tipo: 'GASTO', protegida: 0 },
  { nombre: 'Educación', tipo: 'GASTO', protegida: 0 },
  { nombre: 'Otros gastos', tipo: 'GASTO', protegida: 1 },
  { nombre: 'Sueldo', tipo: 'INGRESO', protegida: 0 },
  { nombre: 'Ventas', tipo: 'INGRESO', protegida: 0 },
  { nombre: 'Otros ingresos', tipo: 'INGRESO', protegida: 1 },
];

// Carga las categorías por defecto solo si la tabla está vacía (instalación nueva).
// Así, volver a ejecutarla no recrea categorías que la persona renombró o eliminó.
export function sembrarCategorias(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM categorias').get();
  if (n > 0) return 0;

  const insertar = db.prepare(
    `INSERT INTO categorias (nombre, nombre_normalizado, tipo, activa, protegida)
     VALUES (?, ?, ?, 1, ?)`
  );

  const sembrar = db.transaction(() => {
    for (const c of CATEGORIAS_POR_DEFECTO) {
      insertar.run(c.nombre, normalizarNombre(c.nombre), c.tipo, c.protegida);
    }
  });
  sembrar();

  return CATEGORIAS_POR_DEFECTO.length;
}