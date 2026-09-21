export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
  static badRequest(msg = 'Requête invalide', details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Authentification requise') { return new ApiError(401, msg); }
  static forbidden(msg = 'Accès refusé') { return new ApiError(403, msg); }
  static notFound(msg = 'Ressource introuvable') { return new ApiError(404, msg); }
  static conflict(msg = 'Conflit') { return new ApiError(409, msg); }
}

/** Enveloppe un handler async pour router les rejets vers next(). */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
