import { createApp } from '../src/app.js';
import { pool } from '../src/config/db.js';
const server = createApp().listen(4102);
const BASE = 'http://localhost:4102/api';
let pass = 0, fail = 0;
const check = (n, c, e = '') => { c ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + ' ' + e)); };
try {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'manager@hasdrubal.tn', password: 'Hasdrubal2026!' }) });
  const cookie = r.headers.getSetCookie()[0].split(';')[0];
  check('cookie de refresh httpOnly', /HttpOnly/i.test(r.headers.getSetCookie()[0]));

  const r2 = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { cookie } });
  const b2 = await r2.json();
  check('refresh renvoie un nouvel access token', r2.status === 200 && !!b2.accessToken && b2.user.role === 'manager');
  const cookie2 = r2.headers.getSetCookie()[0].split(';')[0];
  check('rotation du refresh token', cookie2 !== cookie);

  const r3 = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { cookie } });
  check('ancien refresh token revoque', r3.status === 401, `recu ${r3.status}`);

  const r4 = await fetch(`${BASE}/auth/logout`, { method: 'POST', headers: { cookie: cookie2 } });
  check('logout 204', r4.status === 204);
  const r5 = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { cookie: cookie2 } });
  check('refresh impossible apres logout', r5.status === 401);

  const r6 = await fetch(`${BASE}/auth/refresh`, { method: 'POST' });
  check('refresh sans cookie refuse', r6.status === 401);
  console.log(`\n=== ${pass} reussis, ${fail} echecs ===`);
} finally { server.close(); await pool.end(); process.exit(fail ? 1 : 0); }
