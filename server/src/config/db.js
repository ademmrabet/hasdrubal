import pg from 'pg';
import { env } from './env.js';

// Les colonnes numeric reviennent en string par defaut (precision arbitraire).
// Pour ce domaine metier les quantites tiennent largement dans un double.
pg.types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));
// bigint -> Number : les montants en millimes restent tres en dessous de 2^53.
pg.types.setTypeParser(20, (value) => (value === null ? null : Number(value)));
// date (sans heure) : pg les convertit par defaut en objet Date a minuit HEURE
// LOCALE du serveur, qui redevient un jour precedent une fois serialise en
// JSON (toISOString bascule en UTC). Le serveur tourne en Africa/Tunis
// (UTC+1) : une echeance ou une date d'embauche du 1er janvier reviendrait
// "2025-12-31T23:00:00.000Z" a l'API. On garde la chaine "AAAA-MM-JJ" brute
// telle qu'envoyee par Postgres, sans passer par un objet Date.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  console.error('[db] erreur inattendue sur un client inactif', err);
});

export function query(text, params) {
  return pool.query(text, params);
}

/** Execute une suite de requetes dans une transaction. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** "hote:port/base" sans identifiants, pour les journaux. */
export function describeDatabase() {
  try {
    const u = new URL(env.databaseUrl);
    return `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}${env.databaseSsl ? ' (SSL)' : ''}`;
  } catch {
    return '(DATABASE_URL illisible)';
  }
}
