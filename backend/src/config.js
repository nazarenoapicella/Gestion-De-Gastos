import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raizBackend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Carga backend/.env si existe; si no, se usan los valores por defecto.
try {
  process.loadEnvFile(path.join(raizBackend, '.env'));
} catch {
  // sin .env
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  dbPath: path.resolve(raizBackend, process.env.DB_PATH || './data/gastos.db'),
  timezone: process.env.APP_TIMEZONE || 'America/Argentina/Buenos_Aires',
  frontendDir: path.resolve(raizBackend, '..', 'frontend'),
};