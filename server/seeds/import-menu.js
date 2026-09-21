/**
 * Importe la carte de Hasdrubal SANS RIEN EFFACER (contrairement a seed.js).
 * Utilisable en production.
 *
 *   npm run import:menu                       cree les categories et plats manquants
 *   npm run import:menu -- --dry-run          montre ce qui serait fait, n'ecrit rien
 *   npm run import:menu -- --sync             realigne aussi categorie, prix, description,
 *                                             allergenes et ordre des plats existants
 *
 * Dans Docker :  docker compose exec server node seeds/import-menu.js
 *
 * Les plats existants ne sont jamais touches sans --sync ; fiches techniques,
 * photos, TVA et disponibilite ne sont jamais modifies.
 */
import { pool, withTransaction } from '../src/config/db.js';
import { importCarte } from './lib/carte.js';
import { CARTE_HASDRUBAL, A_VERIFIER } from './data/carte-hasdrubal.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const sync = args.has('--sync');
const unknown = [...args].filter((a) => !['--dry-run', '--sync'].includes(a));
if (unknown.length) {
  console.error(`Option inconnue : ${unknown.join(' ')}  (options : --dry-run, --sync)`);
  process.exit(2);
}

const ROLLBACK = Symbol('dry-run');

async function main() {
  let stats;
  try {
    await withTransaction(async (db) => {
      stats = await importCarte(db, CARTE_HASDRUBAL, { sync });
      if (dryRun) throw ROLLBACK;
    });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }

  console.log(dryRun ? 'Simulation (rien n’est écrit) :' : 'Import terminé :');
  console.log(`  catégories créées : ${stats.categoriesCreated}`);
  console.log(`  plats créés       : ${stats.itemsCreated}`);
  if (sync) console.log(`  plats réalignés   : ${stats.itemsUpdated}`);
  else console.log(`  plats déjà présents, laissés tels quels : ${stats.itemsKept}`);
  if (stats.withoutPrice.length) {
    console.log(`\nSans prix, créés inactifs (à saisir dans l’application) :\n  - ${stats.withoutPrice.join('\n  - ')}`);
  }
  console.log('\nÀ vérifier avec le restaurant :');
  for (const line of A_VERIFIER) console.log(`  - ${line}`);
}

main()
  .catch((err) => {
    console.error('Échec de l’import :', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
