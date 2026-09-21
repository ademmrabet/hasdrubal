import { env } from '../../config/env.js';
import * as service from './auth.service.js';
import { audit } from '../../utils/audit.js';

const COOKIE_NAME = 'hasdrubal_rt';

const cookieOptions = (expiresAt) => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.isProd ? 'strict' : 'lax',
  path: '/api/auth',
  expires: expiresAt,
});

export async function login(req, res) {
  const result = await service.login({ ...req.body, userAgent: req.headers['user-agent'] });
  res.cookie(COOKIE_NAME, result.refresh.raw, cookieOptions(result.refresh.expiresAt));
  await audit({ userId: result.user.id, action: 'login', entity: 'user', entityId: result.user.id });
  res.json({ accessToken: result.accessToken, user: result.user });
}

export async function refresh(req, res) {
  const result = await service.refresh({
    rawToken: req.cookies?.[COOKIE_NAME],
    userAgent: req.headers['user-agent'],
  });
  res.cookie(COOKIE_NAME, result.refresh.raw, cookieOptions(result.refresh.expiresAt));
  res.json({ accessToken: result.accessToken, user: result.user });
}

export async function logout(req, res) {
  await service.logout(req.cookies?.[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
  res.status(204).end();
}

export async function me(req, res) {
  res.json({ user: await service.getById(req.user.id) });
}

export async function changePassword(req, res) {
  await service.changePassword(req.user.id, req.body);
  await audit({ userId: req.user.id, action: 'change_password', entity: 'user', entityId: req.user.id });
  res.json({ message: 'Mot de passe mis à jour. Reconnectez-vous sur vos autres appareils.' });
}
