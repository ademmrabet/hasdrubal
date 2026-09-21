import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './config/db.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedNames() {
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  return new Set(rows.map((r) => r.name));
}

async function listFiles() {
  const files = await readdir(migrationsDir);
  return files.filter((f) => f.endsWith('.sql')).sort();
}

async function up() {
  await ensureTable();
  const done = await appliedNames();
  const files = await listFiles();
  const pending = files.filter((f) => !done.has(f));

  if (pending.length === 0) {
    console.log('Aucune migration en attente. Schéma à jour.');
    return;
  }

  for (const file of pending) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  applique  ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ECHEC     ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }
  console.log(`${pending.length} migration(s) appliquee(s).`);
}

async function status() {
  await ensureTable();
  const done = await appliedNames();
  for (const file of await listFiles()) {
    console.log(`${done.has(file) ? '[x]' : '[ ]'} ${file}`);
  }
}

const command = process.argv[2] ?? 'up';
try {
  if (command === 'up') await up();
  else if (command === 'status') await status();
  else throw new Error(`Commande inconnue : ${command}. Utilisez "up" ou "status".`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
