import { spawnSync } from 'node:child_process';
import { createApp } from '../src/app.js';
import { pool } from '../src/config/db.js';
import { CARTE_HASDRUBAL } from '../seeds/data/carte-hasdrubal.js';

const server = createApp().listen(4105);
const B = 'http://localhost:4105/api';
let pass = 0, fail = 0;
const check = (n, c, e = '') => { c ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + ' ' + e)); };
const login = async (email) => (await (await fetch(`${B}/auth/login`, { method: 'POST',
  headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Hasdrubal2026!' }) })).json()).accessToken;
const call = (t, p, o = {}) => fetch(B + p, { ...o, headers: { 'content-type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) } })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const runImport = (...args) => spawnSync(process.execPath, ['seeds/import-menu.js', ...args],
  { cwd: new URL('..', import.meta.url).pathname, env: process.env, encoding: 'utf8' });

const allItems = CARTE_HASDRUBAL.flatMap((c) => c.items);

try {
  console.log('\n--- Donnees de la carte ---');
  const names = allItems.map((i) => i.name.toLowerCase());
  check('60 plats sur 10 categories', allItems.length === 60 && CARTE_HASDRUBAL.length === 10, `${allItems.length}`);
  check('noms uniques (casse ignoree)', new Set(names).size === names.length);
  check('prix entiers en DT ou absents', allItems.every((i) => i.price === null || (Number.isInteger(i.price) && i.price > 0)));
  check('exactement 2 plats sans prix', allItems.filter((i) => i.price === null).length === 2);

  const owner = await login('owner@hasdrubal.tn');
  const reference = (await call(owner, '/menu/reference')).body.data;
  check('allergenes tous reconnus par l API',
    allItems.every((i) => (i.allergens ?? []).every((a) => reference.allergens.includes(a))),
    allItems.flatMap((i) => i.allergens ?? []).filter((a) => !reference.allergens.includes(a)).join(','));
  check('taux de TVA par defaut valide', reference.vatRates.includes(19));

  const before = (await call(owner, '/menu/items?includeInactive=true')).body.data;
  const beforeCats = (await call(owner, '/menu/categories')).body.data;

  console.log('\n--- Simulation ---');
  const dry = runImport('--dry-run');
  check('simulation reussie', dry.status === 0, dry.stderr);
  const afterDry = (await call(owner, '/menu/items?includeInactive=true')).body.data;
  check('la simulation n ecrit rien', afterDry.length === before.length);
  check('option inconnue refusee', runImport('--efface-tout').status === 2);

  console.log('\n--- Import ---');
  const first = runImport();
  check('import reussi', first.status === 0, first.stderr);
  check('les 2 plats sans prix sont signales', /Toast poulpe avocat/.test(first.stdout) && /Filet de Saint Pierre/.test(first.stdout));
  const items = (await call(owner, '/menu/items?includeInactive=true')).body.data;
  const cats = (await call(owner, '/menu/categories')).body.data;
  check('60 plats ajoutes a la demo', items.length === before.length + 60, `${items.length} vs ${before.length}`);
  check('categories creees sans doublon (Desserts et Boissons reutilisees)',
    cats.length === beforeCats.length + 8, `${cats.length} vs ${beforeCats.length}`);
  check('plats de demo intacts', items.find((i) => i.name === "Couscous à l'agneau")?.priceMillimes === 48000);

  const filet = items.find((i) => i.name === 'Le filet Hasdrubal');
  check('prix converti en millimes', filet.priceMillimes === 85000);
  check('tag signature => mis en avant', filet.isFeatured === true && filet.tags.includes('signature'));
  check('TVA du restaurant appliquee', filet.vatRate === 19);
  check('accents conserves', !!items.find((i) => i.name === 'Émincée de bœuf beurre et sauge'));

  const noPrice = items.filter((i) => ['Toast poulpe avocat', 'Filet de Saint Pierre'].includes(i.name));
  check('plats sans prix : inactifs, prix 0', noPrice.length === 2 && noPrice.every((i) => !i.isActive && i.priceMillimes === 0));

  const pub = (await call(null, '/public/menu')).body.data;
  const pubNames = pub.categories.flatMap((c) => c.items.map((i) => i.name));
  check('plats sans prix absents du menu public', !pubNames.includes('Toast poulpe avocat') && !pubNames.includes('Filet de Saint Pierre'));
  check('plats reels visibles au public', pubNames.includes('Mozzarella in carrozza') && pubNames.includes('Mojito'));
  check('aucun prix a 0 au public', pub.categories.every((c) => c.items.every((i) => i.priceMillimes > 0)));

  console.log('\n--- Idempotence et donnees saisies ---');
  const patch = await call(owner, `/menu/items/${filet.id}`, { method: 'PUT', body: JSON.stringify({
    categoryId: filet.categoryId, name: filet.name, description: 'Version du chef', priceMillimes: 99000, vatRate: 7,
    allergens: [], tags: ['signature'], isActive: true, isAvailable: false, isFeatured: true, sortOrder: 0 }) });
  check('modification manuelle', patch.status === 200, JSON.stringify(patch.body).slice(0, 150));

  const second = runImport();
  const items2 = (await call(owner, '/menu/items?includeInactive=true')).body.data;
  check('2e import : rien de cree', second.status === 0 && items2.length === items.length && /plats créés\s+: 0/.test(second.stdout), second.stdout);
  const filet2 = items2.find((i) => i.id === filet.id);
  check('2e import : prix modifie preserve', filet2.priceMillimes === 99000 && filet2.description === 'Version du chef');

  const sync = runImport('--sync');
  const items3 = (await call(owner, '/menu/items?includeInactive=true')).body.data;
  const filet3 = items3.find((i) => i.id === filet.id);
  check('--sync : prix et description realignes', sync.status === 0 && filet3.priceMillimes === 85000 && /Filet de bœuf grillé/.test(filet3.description), `${filet3.priceMillimes}`);
  check('--sync : TVA et disponibilite preservees', filet3.vatRate === 7 && filet3.isAvailable === false);
  check('--sync : n ajoute aucun doublon', items3.length === items.length);
  check('--sync : plats sans prix restent a 0', items3.filter((i) => ['Toast poulpe avocat', 'Filet de Saint Pierre'].includes(i.name)).every((i) => i.priceMillimes === 0));

  console.log('\n--- Fiches techniques du seed reel ---');
  // Le seed des tests est la carte inventee ; on verifie ici que les fiches indicatives
  // ne contiennent que des ingredients connus du seed.
  const { FICHES_DEMO } = await import('../seeds/data/fiches-demo.js');
  const ingredientNames = new Set((await call(owner, '/ingredients')).body.data.map((i) => i.name));
  const unknown = Object.values(FICHES_DEMO).flat().map(([n]) => n).filter((n) => !ingredientNames.has(n));
  check('fiches indicatives : ingredients connus', unknown.length === 0, unknown.join(','));
  check('fiches indicatives : plats existants dans la carte', Object.keys(FICHES_DEMO).every((n) => names.includes(n.toLowerCase())),
    Object.keys(FICHES_DEMO).filter((n) => !names.includes(n.toLowerCase())).join(','));

  console.log(`\n=== ${pass} reussis, ${fail} echecs ===`);
} catch (e) { console.error('ERREUR', e); fail++; }
finally { server.close(); await pool.end(); process.exit(fail ? 1 : 0); }
