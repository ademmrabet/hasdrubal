import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/** Exige un access token valide et pose req.user = { id, role, email, fullName }. */
export function requireAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized());

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret);
    req.user = { id: payload.sub, role: payload.role, email: payload.email, fullName: payload.name };
    next();
  } catch (err) {
    next(ApiError.unauthorized(err.name === 'TokenExpiredError' ? 'Session expirée' : 'Jeton invalide'));
  }
}

/** requireRole('owner', 'manager') — a chainer apres requireAuth. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden("Votre rôle ne permet pas d'accéder à cette ressource"));
    }
    next();
  };
}

/** Raccourcis lisibles dans les fichiers de routes. */
export const requireAdmin = requireRole('owner', 'manager');
export const requireOwner = requireRole('owner');
