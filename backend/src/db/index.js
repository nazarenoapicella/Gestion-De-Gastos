import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { sembrarCategorias } from './seed.js';

const rutaEsquema = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');

// Abre la base (archivo o ':memory:') con las claves foráneas activadas.
export function abrirBase(ruta = ':memory:') {
  if (ruta !== ':memory:') {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
  }
  const db = new Database(ruta);
  db.pragma('foreign_keys = ON');
  return db;
}

// Crea las tablas que falten. Se puede ejecutar más de una vez sin problema.
export function inicializarEsquema(db) {
  db.exec(fs.readFileSync(rutaEsquema, 'utf8'));
}

// Abre la base, crea el esquema y carga los datos iniciales.
export function inicializarBase(ruta = ':memory:') {
  const db = abrirBase(ruta);
  inicializarEsquema(db);
  sembrarCategorias(db);
  return db;
}