import { createApp } from '../src/app.js';
import { pool } from '../src/config/db.js';
const server = createApp().listen(4103);
const B = 'http://localhost:4103/api';
let pass = 0, fail = 0;
const check = (n, c, e = '') => { c ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + ' ' + e)); };
const login = async (email) => (await (await fetch(`${B}/auth/login`, { method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'Hasdrubal2026!' }) })).json()).accessToken;
const call = (t, p, o = {}) => fetch(B + p, { ...o, headers: { 'content-type': 'application/json', Authorization: `Bearer ${t}`, ...o.headers } })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
try {
  const owner = await login('owner@hasdrubal.tn');
  const staff = await login('staff@hasdrubal.tn');

  const all = await call(owner, '/settings');
  check('GET /settings', all.status === 200 && all.body.data.restaurant && all.body.data.opening_hours);

  const r = await call(owner, '/settings/restaurant');
  check('fiche restaurant renseignee',
    r.body.data.fullName === 'Hasdrubal de Carthage' &&
    r.body.data.phone === '+216 90 177 773' &&
    r.body.data.address === 'V75X+6X Carthage', JSON.stringify(r.body.data));
  check('devise et locale conservees de la migration 001',
    r.body.data.currency === 'TND' && r.body.data.locale === 'fr-TN');

  const h = await call(owner, '/settings/opening_hours');
  check('dimanche ferme', h.body.data.sunday === null && h.body.data.monday.open === '12:00');

  const brand = await call(owner, '/settings/branding');
  check('palette de marque en base', brand.body.data.copper === '#a8683a' && brand.body.data.sand === '#e9cf9e');

  const staffWrite = await call(staff, '/settings/restaurant', { method: 'PUT', body: JSON.stringify({ phone: 'pirate' }) });
  check('staff ne modifie pas les parametres', staffWrite.status === 403);

  const upd = await call(owner, '/settings/restaurant', { method: 'PUT', body: JSON.stringify({ taxId: '1234567/A/M/000' }) });
  check('owner met a jour par fusion',
    upd.status === 200 && upd.body.data.taxId === '1234567/A/M/000' && upd.body.data.phone === '+216 90 177 773',
    JSON.stringify(upd.body.data));

  const missing = await call(owner, '/settings/inexistant');
  check('cle inconnue -> 404', missing.status === 404);
  const anon = await fetch(`${B}/settings`);
  check('parametres proteges', anon.status === 401);

  console.log(`\n=== ${pass} reussis, ${fail} echecs ===`);
} finally { server.close(); await pool.end(); process.exit(fail ? 1 : 0); }
