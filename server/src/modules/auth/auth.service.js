import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

const PUBLIC_USER_COLUMNS = 'id, full_name, email, phone, role, is_active, last_login_at, created_at';

export const toPublicUser = (row) => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  phone: row.phone,
  role: row.role,
  isActive: row.is_active,
  lastLoginAt: row.last_login_at,
  createdAt: row.created_at,
});

export const hashPassword = (plain) => bcrypt.hash(plain, 12);

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, name: user.full_name },
    env.jwtAccessSecret,
    { expiresIn: env.accessTokenTtl },
  );
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function issueRefreshToken(userId, userAgent) {
  const raw = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 86_400_000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, sha256(raw), userAgent ?? null, expiresAt],
  );
  return { raw, expiresAt };
}

export async function login({ email, password, userAgent }) {
  const { rows } = await query(
    `SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  const user = rows[0];

  // Comparaison systematique : evite de reveler l'existence d'un compte par le temps de reponse.
  const fallbackHash = '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const ok = await bcrypt.compare(password, user?.password_hash ?? fallbackHash);

  if (!user || !ok) throw ApiError.unauthorized('Email ou mot de passe incorrect');
  if (!user.is_active) throw ApiError.forbidden('Ce compte est désactivé');

  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

  const refresh = await issueRefreshToken(user.id, userAgent);
  return {
    accessToken: signAccessToken(user),
    refresh,
    user: toPublicUser({ ...user, last_login_at: new Date() }),
  };
}

export async function refresh({ rawToken, userAgent }) {
  if (!rawToken) throw ApiError.unauthorized('Session absente');

  const { rows } = await query(
    `SELECT rt.id            AS token_id,
            rt.expires_at    AS token_expires_at,
            rt.revoked_at    AS token_revoked_at,
            u.id, u.full_name, u.email, u.phone, u.role,
            u.is_active, u.last_login_at, u.created_at
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = $1`,
    [sha256(rawToken)],
  );
  const row = rows[0];
  if (!row || row.token_revoked_at || new Date(row.token_expires_at) < new Date()) {
    throw ApiError.unauthorized('Session expirée, reconnectez-vous');
  }
  if (!row.is_active) throw ApiError.forbidden('Ce compte est désactivé');

  // Rotation : l'ancien jeton est revoque des qu'un nouveau est emis.
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.token_id]);
  const next = await issueRefreshToken(row.id, userAgent);

  return {
    accessToken: signAccessToken(row),
    refresh: next,
    user: toPublicUser(row),
  };
}

export async function logout(rawToken) {
  if (!rawToken) return;
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [
    sha256(rawToken),
  ]);
}

export async function getById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  if (!rows[0]) throw ApiError.notFound('Utilisateur introuvable');
  return toPublicUser(rows[0]);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw ApiError.notFound('Utilisateur introuvable');
  if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    throw ApiError.badRequest('Mot de passe actuel incorrect');
  }
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(newPassword), userId]);
  // Toutes les autres sessions sont invalidees.
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}
