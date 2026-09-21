import { createApp } from './app.js';
import { env } from './config/env.js';
import { describeDatabase, pool } from './config/db.js';

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`API ${env.restaurantName} sur http://localhost:${env.port} (${env.nodeEnv})`);
  // Dit tout de suite quelle base est visee et si elle repond, au lieu d'attendre la premiere requete.
  pool.query('SELECT 1')
    .then(() => console.log(`Base de données : ${describeDatabase()} - connexion OK`))
    .catch((err) => console.error(`Base de données : ${describeDatabase()} - INJOIGNABLE (${err.code ?? err.name} : ${err.message})`));
});

async function shutdown(signal) {
  console.log(`\n${signal} reçu, arrêt en cours...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
