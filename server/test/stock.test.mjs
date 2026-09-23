import { createApp } from '../src/app.js';
import { pool } from '../src/config/db.js';

const app = createApp();
const server = app.listen(4101);
const BASE = 'http://localhost:4101/api';
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

async function login(email) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Hasdrubal2026!' }),
  });
  const body = await res.json();
  return { token: body.accessToken, cookie: res.headers.getSetCookie?.()[0], user: body.user, status: res.status };
}

const call = (token, path, opts = {}) => fetch(`${BASE}${path}`, {
  ...opts,
  headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

try {
  console.log('\n--- Authentification ---');
  const owner = await login('owner@hasdrubal.tn');
  check('login owner', owner.status === 200 && owner.user.role === 'owner');
  const staff = await login('staff@hasdrubal.tn');
  check('login staff', staff.status === 200 && staff.user.role === 'staff');
  const manager = await login('manager@hasdrubal.tn');
  check('login manager', manager.status === 200 && manager.user.role === 'manager');
  const bad = await login('owner@hasdrubal.tn').then(() => fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@hasdrubal.tn', password: 'mauvais' }),
  }));
  check('mot de passe errone refuse', bad.status === 401);

  const me = await call(owner.token, '/auth/me');
  check('GET /auth/me', me.status === 200 && me.body.user.email === 'owner@hasdrubal.tn');

  console.log('\n--- RBAC ---');
  const staffUsers = await call(staff.token, '/users');
  check('staff bloque sur /users', staffUsers.status === 403, `recu ${staffUsers.status}`);
  const ownerUsers = await call(owner.token, '/users');
  check('owner liste les utilisateurs', ownerUsers.status === 200 && ownerUsers.body.data.length === 3);
  const staffInv = await call(staff.token, '/stock/inventory', {
    method: 'POST', body: JSON.stringify({ ingredientId: '00000000-0000-0000-0000-000000000000', countedQty: 1 }),
  });
  check('staff bloque sur inventaire', staffInv.status === 403, `recu ${staffInv.status}`);

  console.log('\n--- Lectures stock ---');
  const list = await call(owner.token, '/ingredients');
  check('GET /ingredients', list.status === 200 && list.body.data.length === 29);
  const target = list.body.data.find((i) => i.name === 'Tomates');
  check('vue stock calcule une quantite', target && target.currentQty > 0, JSON.stringify(target?.currentQty));
  check('cout moyen renseigne', target.avgCostMillimes > 0);

  const detail = await call(owner.token, `/ingredients/${target.id}`);
  check('GET /ingredients/:id renvoie les lots', detail.status === 200 && Array.isArray(detail.body.data.batches));

  const filtered = await call(owner.token, '/ingredients?status=ok');
  check('filtre par statut', filtered.status === 200 && filtered.body.data.every((i) => i.stockStatus === 'ok'));

  console.log('\n--- Mouvements ---');
  const before = target.currentQty;
  const recv = await call(staff.token, '/stock/receive', {
    method: 'POST',
    body: JSON.stringify({ ingredientId: target.id, quantity: 10, unitCostMillimes: 3000, batchCode: 'TEST-1' }),
  });
  check('staff peut receptionner', recv.status === 201, JSON.stringify(recv.body));
  check('quantite apres reception', Math.abs(recv.body.data.quantityAfter - (before + 10)) < 0.01,
    `${recv.body?.data?.quantityAfter} vs ${before + 10}`);

  const avgBefore = target.avgCostMillimes;
  check('cout moyen recalcule entre les deux prix',
    recv.body.data.avgCostMillimes !== avgBefore &&
    recv.body.data.avgCostMillimes >= Math.min(avgBefore, 3000) &&
    recv.body.data.avgCostMillimes <= Math.max(avgBefore, 3000),
    `avant ${avgBefore}, apres ${recv.body.data.avgCostMillimes}`);

  const cons = await call(staff.token, '/stock/consume', {
    method: 'POST', body: JSON.stringify({ ingredientId: target.id, quantity: 4, type: 'sortie', reason: 'Test' }),
  });
  check('sortie acceptee', cons.status === 200 && Math.abs(cons.body.data.quantityAfter - (before + 6)) < 0.01,
    JSON.stringify(cons.body));
  check('sortie valorisee', cons.body.data.costMillimes > 0);

  const tooMuch = await call(staff.token, '/stock/consume', {
    method: 'POST', body: JSON.stringify({ ingredientId: target.id, quantity: 99999, type: 'sortie' }),
  });
  check('stock insuffisant refuse', tooMuch.status === 400 && /insuffisant/i.test(tooMuch.body.error),
    JSON.stringify(tooMuch.body));

  console.log('\n--- Inventaire ---');
  const inv = await call(owner.token, '/stock/inventory', {
    method: 'POST', body: JSON.stringify({ ingredientId: target.id, countedQty: 5, reason: 'Comptage test' }),
  });
  check('inventaire enregistre un ecart', inv.status === 200 && inv.body.data.quantityAfter === 5,
    JSON.stringify(inv.body));
  const after = await call(owner.token, `/ingredients/${target.id}`);
  check('stock aligne sur le comptage', Math.abs(after.body.data.currentQty - 5) < 0.001,
    `${after.body?.data?.currentQty}`);

  const invUp = await call(owner.token, '/stock/inventory', {
    method: 'POST', body: JSON.stringify({ ingredientId: target.id, countedQty: 12 }),
  });
  check('ecart positif gere', invUp.status === 200 && Math.abs(invUp.body.data.delta - 7) < 0.001,
    JSON.stringify(invUp.body));

  console.log('\n--- FEFO ---');
  const perishable = list.body.data.find((i) => i.name === 'Poulet fermier');
  const batchesBefore = await call(owner.token, `/ingredients/${perishable.id}`);
  const oldest = batchesBefore.body.data.batches[0];
  await call(staff.token, '/stock/consume', {
    method: 'POST', body: JSON.stringify({ ingredientId: perishable.id, quantity: 0.5, type: 'sortie' }),
  });
  const batchesAfter = await call(owner.token, `/ingredients/${perishable.id}`);
  const sameBatch = batchesAfter.body.data.batches.find((b) => b.id === oldest.id);
  check('le lot expirant en premier est entame',
    !sameBatch || sameBatch.quantityRemaining < oldest.quantityRemaining,
    `${oldest.quantityRemaining} -> ${sameBatch?.quantityRemaining}`);

  console.log('\n--- Journal et alertes ---');
  const mv = await call(owner.token, `/stock/movements?ingredientId=${target.id}&limit=10`);
  check('journal filtre par ingredient', mv.status === 200 && mv.body.data.length > 0 &&
    mv.body.data.every((m) => m.ingredientId === target.id));
  check('ajustement present dans le journal', mv.body.data.some((m) => m.type === 'ajustement'));
  check('auteur du mouvement trace', mv.body.data.every((m) => m.createdByName));

  const mvType = await call(owner.token, '/stock/movements?type=perte&limit=5');
  check('filtre par type', mvType.status === 200 && mvType.body.data.every((m) => m.type === 'perte'));

  const alerts = await call(owner.token, '/stock/alerts');
  check('alertes structurees', alerts.status === 200 &&
    Array.isArray(alerts.body.data.lowStock) && Array.isArray(alerts.body.data.expiring));

  console.log('\n--- Tableaux de bord ---');
  const dash = await call(owner.token, '/dashboard/summary');
  check('resume admin', dash.status === 200 && dash.body.data.movementTrend.length === 14 &&
    dash.body.data.stockValueMillimes > 0, JSON.stringify(dash.body).slice(0, 200));
  const dashStaff = await call(staff.token, '/dashboard/summary');
  check('staff bloque sur le resume admin', dashStaff.status === 403);
  const today = await call(staff.token, '/dashboard/staff-today');
  check('vue du jour staff', today.status === 200 && Array.isArray(today.body.data.recentMovements));

  console.log('\n--- Validation ---');
  const badBody = await call(owner.token, '/ingredients', {
    method: 'POST', body: JSON.stringify({ name: 'X', unit: 'tonne' }),
  });
  check('donnees invalides rejetees', badBody.status === 400 && Array.isArray(badBody.body.details),
    JSON.stringify(badBody.body));
  const perishableNoShelf = await call(owner.token, '/ingredients', {
    method: 'POST', body: JSON.stringify({ name: 'Test perissable', unit: 'kg', isPerishable: true }),
  });
  check('perissable sans duree rejete', perishableNoShelf.status === 400);

  const created = await call(owner.token, '/ingredients', {
    method: 'POST',
    body: JSON.stringify({ name: 'Zaatar test', unit: 'kg', minThreshold: 2, targetStock: 10 }),
  });
  check('creation ingredient', created.status === 201 && created.body.data.stockStatus === 'rupture',
    JSON.stringify(created.body).slice(0, 150));
  const dup = await call(owner.token, '/ingredients', {
    method: 'POST', body: JSON.stringify({ name: 'Zaatar test', unit: 'kg' }),
  });
  check('doublon refuse (409)', dup.status === 409, `recu ${dup.status}`);

  console.log('\n--- Suppression groupee ---');
  const bulkA = await call(owner.token, '/ingredients', {
    method: 'POST', body: JSON.stringify({ name: 'Suppression groupee A', unit: 'kg' }),
  });
  const bulkB = await call(owner.token, '/ingredients', {
    method: 'POST', body: JSON.stringify({ name: 'Suppression groupee B', unit: 'kg' }),
  });
  check('deux ingredients crees pour le test', bulkA.status === 201 && bulkB.status === 201);

  const emptyIds = await call(owner.token, '/ingredients', { method: 'DELETE', body: JSON.stringify({ ids: [] }) });
  check('liste vide refusee', emptyIds.status === 400);

  const staffBulk = await call(staff.token, '/ingredients', {
    method: 'DELETE', body: JSON.stringify({ ids: [bulkA.body.data.id] }),
  });
  check('staff ne supprime pas en masse', staffBulk.status === 403);

  const bulkDel = await call(owner.token, '/ingredients', {
    method: 'DELETE', body: JSON.stringify({ ids: [bulkA.body.data.id, bulkB.body.data.id, target.id] }),
  });
  check('suppression groupee reussie', bulkDel.status === 200 && bulkDel.body.data.deactivatedCount === 3,
    JSON.stringify(bulkDel.body));

  const listAfterBulk = await call(owner.token, '/ingredients');
  check('ingredients supprimes absents de la liste active',
    !listAfterBulk.body.data.some((i) => [bulkA.body.data.id, bulkB.body.data.id, target.id].includes(i.id)),
    `${listAfterBulk.body.data.length} restants`);

  const targetAfterBulk = await call(owner.token, `/ingredients/${target.id}`);
  check('ingredient supprime reste consultable (historique conserve)',
    targetAfterBulk.status === 200 && targetAfterBulk.body.data.isActive === false);

  const rebulk = await call(owner.token, '/ingredients', {
    method: 'DELETE', body: JSON.stringify({ ids: [target.id] }),
  });
  check('deja inactif : aucune double desactivation comptee', rebulk.status === 200 && rebulk.body.data.deactivatedCount === 0,
    JSON.stringify(rebulk.body));

  const unknownId = await call(owner.token, '/ingredients', {
    method: 'DELETE', body: JSON.stringify({ ids: ['00000000-0000-4000-8000-000000000000'] }),
  });
  check('identifiant inconnu : reponse normale, rien de desactive', unknownId.status === 200 && unknownId.body.data.deactivatedCount === 0);

  console.log('\n--- Correction manuelle du cout moyen ---');
  const costTarget = list.body.data.find((i) => i.id !== target.id && i.avgCostMillimes > 0) ?? list.body.data[0];
  const staffCost = await call(staff.token, `/ingredients/${costTarget.id}/cost`, {
    method: 'PATCH', body: JSON.stringify({ avgCostMillimes: 9999 }),
  });
  check('staff bloque sur la correction de cout', staffCost.status === 403, `recu ${staffCost.status}`);

  const negativeCost = await call(owner.token, `/ingredients/${costTarget.id}/cost`, {
    method: 'PATCH', body: JSON.stringify({ avgCostMillimes: -100 }),
  });
  check('cout negatif refuse', negativeCost.status === 400, JSON.stringify(negativeCost.body));

  const beforeCostFix = await call(owner.token, `/ingredients/${costTarget.id}`);
  const managerCost = await call(manager.token, `/ingredients/${costTarget.id}/cost`, {
    method: 'PATCH', body: JSON.stringify({ avgCostMillimes: 4200, reason: 'Nouveau tarif fournisseur' }),
  });
  check('manager corrige le cout moyen', managerCost.status === 200 && managerCost.body.data.avgCostMillimes === 4200,
    JSON.stringify(managerCost.body).slice(0, 200));

  const afterCostFix = await call(owner.token, `/ingredients/${costTarget.id}`);
  check('cout persiste a la relecture', afterCostFix.body.data.avgCostMillimes === 4200);
  check('valeur de stock inchangee (basee sur les lots reels, pas le cout de reference)',
    afterCostFix.body.data.stockValueMillimes === beforeCostFix.body.data.stockValueMillimes,
    `${beforeCostFix.body.data.stockValueMillimes} vs ${afterCostFix.body.data.stockValueMillimes}`);
  check('lots existants non modifies',
    JSON.stringify(afterCostFix.body.data.batches.map((b) => b.unitCostMillimes)) ===
    JSON.stringify(beforeCostFix.body.data.batches.map((b) => b.unitCostMillimes)));

  const unknownCost = await call(owner.token, '/ingredients/00000000-0000-4000-8000-000000000000/cost', {
    method: 'PATCH', body: JSON.stringify({ avgCostMillimes: 1000 }),
  });
  check('ingredient inconnu : 404', unknownCost.status === 404);

  console.log('\n--- Fournisseurs ---');
  const sup = await call(owner.token, '/suppliers');
  check('liste fournisseurs', sup.status === 200 && sup.body.data.length === 4);
  const supCreate = await call(staff.token, '/suppliers', {
    method: 'POST', body: JSON.stringify({ name: 'Interdit' }),
  });
  check('staff ne cree pas de fournisseur', supCreate.status === 403);

  console.log(`\n=== ${pass} reussis, ${fail} echecs ===`);
} catch (err) {
  console.error('ERREUR DE TEST', err);
  fail++;
} finally {
  server.close();
  await pool.end();
  process.exit(fail ? 1 : 0);
}
