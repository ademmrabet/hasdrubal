import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { ApiError, asyncHandler } from '../../utils/ApiError.js';
import { requireAuth, requireOwner } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { hashPassword, toPublicUser } from '../auth/auth.service.js';
import { audit } from '../../utils/audit.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireOwner);

const COLUMNS = 'id, full_name, email, phone, role, is_active, last_login_at, created_at';

const createSchema = z.object({
  fullName: z.string().trim().min(2, 'Nom trop court'),
  email: z.string().trim().toLowerCase().email('Adresse email invalide'),
  phone: z.string().trim().optional().nullable(),
  password: z.string().min(10, 'Le mot de passe doit faire au moins 10 caractères'),
  role: z.enum(['owner', 'manager', 'staff']),
});

const updateSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  phone: z.string().trim().nullable().optional(),
  role: z.enum(['owner', 'manager', 'staff']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(10).optional(),
});

const idParam = z.object({ id: z.string().uuid('Identifiant invalide') });

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(`SELECT ${COLUMNS} FROM users ORDER BY role, full_name`);
    res.json({ data: rows.map(toPublicUser) });
  }),
);

usersRouter.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const { fullName, email, phone, password, role } = req.body;
    const { rows } = await query(
      `INSERT INTO users (full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
      [fullName, email, phone ?? null, await hashPassword(password), role],
    );
    await audit({ userId: req.user.id, action: 'create', entity: 'user', entityId: rows[0].id, payload: { role } });
    res.status(201).json({ data: toPublicUser(rows[0]) });
  }),
);

usersRouter.patch(
  '/:id',
  validate({ params: idParam, body: updateSchema }),
  asyncHandler(async (req, res) => {
    const { fullName, phone, role, isActive, password } = req.body;

    // Garde-fou : ne jamais se retrouver sans owner actif.
    if (req.params.id === req.user.id && (role !== undefined && role !== 'owner' || isActive === false)) {
      throw ApiError.badRequest('Vous ne pouvez pas retirer votre propre accès owner');
    }

    const { rows } = await query(
      `UPDATE users SET
         full_name     = COALESCE($2, full_name),
         phone         = COALESCE($3, phone),
         role          = COALESCE($4, role),
         is_active     = COALESCE($5, is_active),
         password_hash = COALESCE($6, password_hash)
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [
        req.params.id,
        fullName ?? null,
        phone === undefined ? null : phone,
        role ?? null,
        isActive ?? null,
        password ? await hashPassword(password) : null,
      ],
    );
    if (!rows[0]) throw ApiError.notFound('Utilisateur introuvable');

    if (password || isActive === false) {
      await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
        req.params.id,
      ]);
    }
    await audit({ userId: req.user.id, action: 'update', entity: 'user', entityId: req.params.id });
    res.json({ data: toPublicUser(rows[0]) });
  }),
);
