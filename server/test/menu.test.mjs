import { createApp } from '../src/app.js';
import { pool } from '../src/config/db.js';
const server = createApp().listen(4104);
const ROOT = 'http://localhost:4104';
const B = `${ROOT}/api`;
let pass = 0, fail = 0;
const check = (n, c, e = '') => { c ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + ' ' + e)); };
const login = async (email) => (await (await fetch(`${B}/auth/login`, { method: 'POST',
  headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Hasdrubal2026!' }) })).json()).accessToken;
const call = (t, p, o = {}) => fetch(B + p, { ...o, headers: { ...(o.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...(t ? { Authorization: `Bearer ${t}` } : {}), ...o.headers } })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

// PNG 1x1 valide
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

try {
  const owner = await login('owner@hasdrubal.tn');
  const staff = await login('staff@hasdrubal.tn');

  console.log('\n--- Lecture ---');
  const cats = await call(owner, '/menu/categories');
  check('4 categories', cats.status === 200 && cats.body.data.length === 4);
  const items = await call(owner, '/menu/items');
  check('14 plats', items.status === 200 && items.body.data.length === 14);
  const couscous = items.body.data.find((i) => i.name === "Couscous à l'agneau");
  check('cout matiere calcule', couscous.foodCostMillimes > 0 && couscous.marginMillimes > 0);
  check('prix HT deduit de la TVA',
    couscous.priceHtMillimes === Math.round(couscous.priceMillimes / (1 + couscous.vatRate / 100)),
    `${couscous.priceHtMillimes}`);
  check('ratio matiere coherent',
    Math.abs(couscous.foodCostPct - couscous.foodCostMillimes * 100 / couscous.priceHtMillimes) < 0.1);
  check('portions possibles', couscous.portionsPossible > 0);

  const staffItems = await call(staff, '/menu/items');
  check('staff voit la carte', staffItems.status === 200 && staffItems.body.data.length === 14);
  check('staff ne voit pas les couts', staffItems.body.data.every((i) => !('foodCostMillimes' in i) && !('marginMillimes' in i)));
  const staffDetail = await call(staff, `/menu/items/${couscous.id}`);
  check('staff bloque sur la fiche technique', staffDetail.status === 403);

  const detail = await call(owner, `/menu/items/${couscous.id}`);
  check('fiche technique detaillee', detail.status === 200 && detail.body.data.recipe.length === 7);
  const sumLines = detail.body.data.recipe.reduce((s, l) => s + l.lineCostMillimes, 0);
  check('somme des lignes = cout du plat', Math.abs(sumLines - detail.body.data.foodCostMillimes) <= 7, `${sumLines} vs ${detail.body.data.foodCostMillimes}`);

  console.log('\n--- Ecriture ---');
  const ingredients = (await call(owner, '/ingredients')).body.data;
  const ing = (n) => ingredients.find((i) => i.name === n).id;
  const entrees = cats.body.data.find((c) => c.name === 'Entrées');

  const created = await call(owner, '/menu/items', { method: 'POST', body: JSON.stringify({
    categoryId: entrees.id, name: 'Chorba frik', description: 'Soupe traditionnelle', priceMillimes: 12000, vatRate: 7,
    allergens: ['gluten'], tags: ['classique'],
    recipe: [{ ingredientId: ing('Agneau épaule'), quantity: 0.06 }, { ingredientId: ing('Tomates'), quantity: 0.05 }],
  }) });
  check('creation plat + fiche', created.status === 201 && created.body.data.recipe.length === 2, JSON.stringify(created.body).slice(0, 200));
  const expectedCost = Math.round(0.06 * ingredients.find((i) => i.name === 'Agneau épaule').avgCostMillimes
    + 0.05 * ingredients.find((i) => i.name === 'Tomates').avgCostMillimes);
  check('cout du nouveau plat exact', Math.abs(created.body.data.foodCostMillimes - expectedCost) <= 1,
    `${created.body.data.foodCostMillimes} vs ${expectedCost}`);
  check('HT a 7 %', created.body.data.priceHtMillimes === Math.round(12000 / 1.07));

  const newId = created.body.data.id;
  const recipeUpd = await call(owner, `/menu/items/${newId}/recipe`, { method: 'PUT', body: JSON.stringify({
    lines: [{ ingredientId: ing('Agneau épaule'), quantity: 0.1 }] }) });
  check('remplacement de la fiche', recipeUpd.status === 200 && recipeUpd.body.data.recipe.length === 1);

  const dupLine = await call(owner, `/menu/items/${newId}/recipe`, { method: 'PUT', body: JSON.stringify({
    lines: [{ ingredientId: ing('Tomates'), quantity: 0.1 }, { ingredientId: ing('Tomates'), quantity: 0.2 }] }) });
  check('ingredient en double refuse', dupLine.status === 400);
  const afterDup = await call(owner, `/menu/items/${newId}`);
  check('fiche intacte apres refus', afterDup.body.data.recipe.length === 1);

  const badVat = await call(owner, '/menu/items', { method: 'POST', body: JSON.stringify({
    categoryId: entrees.id, name: 'TVA fausse', priceMillimes: 1000, vatRate: 10 }) });
  check('taux de TVA invalide refuse', badVat.status === 400);
  const badAllergen = await call(owner, '/menu/items', { method: 'POST', body: JSON.stringify({
    categoryId: entrees.id, name: 'Allergene faux', priceMillimes: 1000, vatRate: 19, allergens: ['plutonium'] }) });
  check('allergene inconnu refuse', badAllergen.status === 400);
  const dupName = await call(owner, '/menu/items', { method: 'POST', body: JSON.stringify({
    categoryId: entrees.id, name: 'chorba FRIK', priceMillimes: 1000, vatRate: 19 }) });
  check('nom en double refuse (casse ignoree)', dupName.status === 409);

  const orphan = await call(owner, '/menu/items', { method: 'POST', body: JSON.stringify({
    categoryId: entrees.id, name: 'Plat orphelin', priceMillimes: 1000, vatRate: 19,
    recipe: [{ ingredientId: '00000000-0000-4000-8000-000000000000', quantity: 1 }] }) });
  const orphanList = (await call(owner, '/menu/items?includeInactive=true')).body.data;
  check('pas de plat orphelin si la fiche est invalide', orphan.status === 409 && !orphanList.some((i) => i.name === 'Plat orphelin'),
    `${orphan.status}`);

  const staffCreate = await call(staff, '/menu/items', { method: 'POST', body: JSON.stringify({
    categoryId: entrees.id, name: 'Interdit', priceMillimes: 1000, vatRate: 19 }) });
  check('staff ne cree pas de plat', staffCreate.status === 403);

  console.log('\n--- Disponibilite en service ---');
  const off = await call(staff, `/menu/items/${couscous.id}/availability`, { method: 'PATCH', body: JSON.stringify({ isAvailable: false }) });
  check('staff coupe un plat', off.status === 200 && off.body.data.isAvailable === false);

  console.log('\n--- Menu public ---');
  const pub = await call(null, '/public/menu');
  check('accessible sans connexion', pub.status === 200);
  const allPub = pub.body.data.categories.flatMap((c) => c.items);
  check('infos restaurant publiques', pub.body.data.restaurant.fullName === 'Hasdrubal de Carthage' && pub.body.data.restaurant.phone);
  check('pas de donnee interne', !JSON.stringify(pub.body).match(/foodCost|margin|avgCost|taxId|portions/i));
  check('categories ordonnees', pub.body.data.categories.map((c) => c.name).join(',') === 'Entrées,Plats,Desserts,Boissons',
    pub.body.data.categories.map((c) => c.name).join(','));
  check('plat coupe marque indisponible', allPub.find((i) => i.id === couscous.id)?.isAvailable === false);
  check('horaires publies', pub.body.data.openingHours?.sunday === null);

  await call(staff, `/menu/items/${couscous.id}/availability`, { method: 'PATCH', body: JSON.stringify({ isAvailable: true }) });
  const del = await call(owner, `/menu/items/${newId}`, { method: 'DELETE' });
  check('retrait de la carte', del.status === 204);
  const pub2 = await call(null, '/public/menu');
  check('plat retire absent du menu public', !pub2.body.data.categories.flatMap((c) => c.items).some((i) => i.id === newId));

  console.log('\n--- Categories ---');
  const delCat = await call(owner, `/menu/categories/${entrees.id}`, { method: 'DELETE' });
  check('categorie non vide protegee (409)', delCat.status === 409, `recu ${delCat.status}`);
  const newCat = await call(owner, '/menu/categories', { method: 'POST', body: JSON.stringify({ name: 'Suggestions du chef', sortOrder: 5 }) });
  check('creation categorie', newCat.status === 201 && newCat.body.data.itemCount === 0);
  const delEmpty = await call(owner, `/menu/categories/${newCat.body.data.id}`, { method: 'DELETE' });
  check('suppression categorie vide', delEmpty.status === 204);

  console.log('\n--- Photos ---');
  const fd = new FormData();
  fd.append('image', new Blob([PNG], { type: 'image/png' }), 'plat.png');
  const up = await call(owner, `/menu/items/${couscous.id}/image`, { method: 'POST', body: fd });
  check('televersement photo', up.status === 200 && up.body.data.imagePath.startsWith('/uploads/menu/'), JSON.stringify(up.body));
  const img = await fetch(ROOT + up.body.data.imagePath);
  check('photo servie', img.status === 200 && img.headers.get('content-type') === 'image/png');

  const fd2 = new FormData();
  fd2.append('image', new Blob([PNG], { type: 'image/png' }), 'plat2.png');
  const up2 = await call(owner, `/menu/items/${couscous.id}/image`, { method: 'POST', body: fd2 });
  const oldGone = await fetch(ROOT + up.body.data.imagePath);
  check('ancienne photo supprimee au remplacement', up2.status === 200 && oldGone.status === 404, `${oldGone.status}`);

  const fd3 = new FormData();
  fd3.append('image', new Blob(['pas une image'], { type: 'text/plain' }), 'x.txt');
  const bad = await call(owner, `/menu/items/${couscous.id}/image`, { method: 'POST', body: fd3 });
  check('format refuse', bad.status === 400, JSON.stringify(bad.body));

  const traversal = await fetch(ROOT + '/uploads/../package.json');
  check('pas de traversee de repertoire', traversal.status !== 200 || !(await traversal.text()).includes('"name"'));

  const rmImg = await call(owner, `/menu/items/${couscous.id}/image`, { method: 'DELETE' });
  const gone = await fetch(ROOT + up2.body.data.imagePath);
  check('suppression photo', rmImg.status === 204 && gone.status === 404);

  console.log('\n--- Tableau de bord inchange ---');
  const dash = await call(owner, '/dashboard/summary');
  check('resume toujours OK', dash.status === 200);

  console.log(`\n=== ${pass} reussis, ${fail} echecs ===`);
} catch (e) { console.error('ERREUR', e); fail++; }
finally { server.close(); await pool.end(); process.exit(fail ? 1 : 0); }
