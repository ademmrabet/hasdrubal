/**
 * Lance les tests d'integration de l'API contre une base de TEST.
 *
 *   npm test                 (depuis la racine ou depuis server/)
 *
 * Base utilisee : TEST_DATABASE_URL, sinon la base Postgres de docker-compose.dev.yml
 * (localhost:5433). La base est creee si elle n'existe pas. Chaque suite repart de
 * donnees de demonstration fraiches : la base est donc EFFACEE a chaque passage.
 * Garde-fou : le nom de la base doit contenir "test".
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, '..');

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://hasdrubal:hasdrubal@localhost:5433/hasdrubal_test';
const dbName = new URL(url).pathname.slice(1);

if (!/test/i.test(dbName)) {
  console.error(`Refus : la base "${dbName}" ne contient pas "test" dans son nom. Les tests l'effaceraient.`);
  process.exit(2);
}

// --- Creation de la base de test si besoin -------------------------------
const admin = new URL(url);
admin.pathname = '/postgres';
const client = new pg.Client({ connectionString: admin.toString() });
try {
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!rowCount) {
    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
    console.log(`Base ${dbName} creee.`);
  }
} catch (err) {
  console.error(`Postgres injoignable (${admin.host}) : ${err.message}`);
  console.error('Demarrez-le avec :  docker compose -f docker-compose.dev.yml up -d db');
  process.exit(2);
} finally {
  await client.end().catch(() => {});
}

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: url,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-0123456789abcdef',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-0123456789abcdef',
};
const run = (args, extra = {}) => spawnSync(process.execPath, args, { cwd: serverDir, env: { ...env, ...extra }, encoding: 'utf8' });

const migrate = run(['src/migrate.js', 'up']);
if (migrate.status !== 0) {
  console.error(migrate.stdout, migrate.stderr);
  process.exit(1);
}

// --- Suites ------------------------------------------------------------
const only = process.argv[2];
const suites = readdirSync(here).filter((f) => f.endsWith('.test.mjs') && (!only || f.includes(only))).sort();
let failed = 0;

for (const suite of suites) {
  // Les suites s'appuient sur la carte inventee, pas sur les donnees reelles du restaurant.
  const seed = run(['seeds/seed.js'], { SEED_MENU: 'demo' });
  if (seed.status !== 0) {
    console.error(`Seed impossible avant ${suite} :\n${seed.stderr || seed.stdout}`);
    process.exit(1);
  }
  const started = Date.now();
  const result = run([join('test', suite)]);
  const lines = (result.stdout ?? '').split('\n');
  const failures = lines.filter((l) => l.includes('FAIL') || l.includes('ERREUR'));
  const summary = lines.find((l) => l.startsWith('===')) ?? '(pas de resume)';
  const ok = result.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'ECHEC'} ${suite.padEnd(20)} ${summary.replace(/=/g, '').trim()}  (${Date.now() - started} ms)`);
  failures.forEach((l) => console.log(`       ${l.trim()}`));
  if (!ok && result.stderr) console.log(result.stderr.split('\n').slice(0, 15).join('\n'));
}

console.log(failed ? `\n${failed} suite(s) en echec.` : `\nToutes les suites passent (${suites.length}).`);
process.exit(failed ? 1 : 0);
