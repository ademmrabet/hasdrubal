import { ApiError } from '../utils/ApiError.js';

/**
 * validate({ body, query, params }) — schemas zod optionnels.
 * Remplace req.<part> par la valeur validee et typee.
 */
export const validate = (schemas) => (req, _res, next) => {
  for (const part of ['body', 'query', 'params']) {
    const schema = schemas[part];
    if (!schema) continue;
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        champ: i.path.join('.') || part,
        message: i.message,
      }));
      return next(ApiError.badRequest('Données invalides', details));
    }
    if (part === 'query') Object.assign(req.query, result.data);
    else req[part] = result.data;
  }
  next();
};
