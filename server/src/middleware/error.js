import { env } from '../config/env.js';
import { describeDatabase } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route inconnue : ${req.method} ${req.originalUrl}`));
}

// Codes d'erreur Postgres traduits en reponses utiles
const PG_MESSAGES = {
  '23505': [409, 'Cet enregistrement existe déjà'],
  '23503': [409, "Opération impossible : l'élément est référencé ailleurs"],
  '23514': [400, 'Une contrainte de validité n’est pas respectée'],
  '22P02': [400, 'Format de donnée invalide'],
};

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image trop lourde (5 Mo maximum)' : 'Téléversement invalide';
    return res.status(400).json({ error: message });
  }

  // Fichier statique absent (/uploads)
  if (err.status === 404 || err.statusCode === 404) {
    return res.status(404).json({ error: 'Fichier introuvable' });
  }

  const pg = PG_MESSAGES[err.code];
  if (pg) {
    return res.status(pg[0]).json({ error: pg[1], details: env.isProd ? undefined : err.detail });
  }

  // Reseau : la base ne repond pas (arretee, mauvaise adresse, pare-feu, DNS).
  if (['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET'].includes(err.code) || /timeout expired/i.test(err.message)) {
    console.error(`[api] base de données injoignable : ${describeDatabase()} - ${err.code ?? ''} ${err.message}`);
    return res.status(503).json({
      error: 'Base de données injoignable. Vérifiez que PostgreSQL est démarré et que DATABASE_URL est correcte.',
      details: env.isProd ? undefined : `${describeDatabase()} - ${err.code ?? err.message}`,
    });
  }
  // Identifiants refuses par Postgres (28P01) ou base inexistante (3D000).
  if (err.code === '28P01' || err.code === '28000' || err.code === '3D000') {
    console.error(`[api] connexion refusée : ${describeDatabase()} - ${err.message}`);
    return res.status(503).json({
      error: 'Connexion à la base refusée : identifiants ou nom de base incorrects dans DATABASE_URL.',
      details: env.isProd ? undefined : err.message,
    });
  }

  console.error('[api]', err);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    details: env.isProd ? undefined : err.message,
  });
}
