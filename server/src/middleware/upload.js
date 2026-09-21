import { mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

export const UPLOAD_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

/** Televersement d'images dans uploads/<dossier>/, nom aleatoire, 5 Mo max. */
export function imageUpload(folder) {
  const dest = join(UPLOAD_ROOT, folder);
  mkdirSync(dest, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: dest,
      filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${ALLOWED.get(file.mimetype)}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED.has(file.mimetype)) {
        return cb(ApiError.badRequest('Format accepté : JPEG, PNG ou WebP'));
      }
      cb(null, true);
    },
  }).single('image');
}

/** Supprime un fichier televerse a partir de son chemin public (/uploads/...). */
export async function removeUpload(publicPath) {
  if (!publicPath?.startsWith('/uploads/')) return;
  const target = resolve(UPLOAD_ROOT, publicPath.slice('/uploads/'.length));
  if (!target.startsWith(UPLOAD_ROOT)) return;   // garde-fou contre ../
  await unlink(target).catch(() => {});
}

export const extOf = (name) => extname(name).toLowerCase();
