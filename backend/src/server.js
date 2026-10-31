import { createApp } from './app.js';
import { config } from './config.js';
import { inicializarBase } from './db/index.js';

const db = inicializarBase(config.dbPath);
const app = createApp({ db });

app.listen(config.port, () => {
  console.log(`Servidor escuchando en http://localhost:${config.port}`);
});