import { query } from '../config/db.js';

/** Trace une action metier. N'echoue jamais la requete appelante. */
export async function audit({ userId, action, entity, entityId, payload }) {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId ?? null, action, entity, entityId ? String(entityId) : null, payload ?? null],
    );
  } catch (err) {
    console.error('[audit] échec de journalisation', err.message);
  }
}
