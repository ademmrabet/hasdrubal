import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { apiRouter } from './routes.js';
import { errorHandler, notFound } from './middleware/error.js';
import { pool } from './config/db.js';
import { UPLOAD_ROOT } from './middleware/upload.js';

// Deploiement combine (image Render, cf. Dockerfile a la racine) : le client
// compile est place a cote de "server" par la construction Docker, et ce
// meme serveur Express le sert en plus de l'API. En deploiement a deux
// conteneurs (docker-compose, nginx sert le client), ce dossier n'existe
// simplement pas et cette section ne fait rien - aucune des deux cibles ne
// casse l'autre.
const CLIENT_DIST_PATH = process.env.CLIENT_DIST_PATH
  ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'client-dist');
const SERVE_CLIENT = existsSync(join(CLIENT_DIST_PATH, 'index.html'));

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  // Les images du menu sont affichees par le front (autre port en developpement).
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', database: 'connectee', restaurant: env.restaurantName });
    } catch {
      res.status(503).json({ status: 'degrade', database: 'injoignable' });
    }
  });

  app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d', fallthrough: false }));
  app.use('/api', apiRouter);

  if (SERVE_CLIENT) {
    // Fichiers compiles par Vite : les empreintes dans /assets peuvent etre
    // mises en cache longtemps, tout le reste (index.html, manifest, service
    // worker) doit toujours etre revalide pour qu'une mise a jour soit vue.
    app.use(express.static(CLIENT_DIST_PATH, {
      index: false,
      maxAge: '1y',
      setHeaders(res, filePath) {
        // Seuls les fichiers sous /assets/ portent une empreinte dans leur nom
        // (Vite) : eux seuls peuvent etre mis en cache longtemps sans risque.
        const isFingerprinted = filePath.split(/[\\/]/).includes('assets');
        if (!isFingerprinted) res.setHeader('Cache-Control', 'no-cache');
      },
    }));

    // Application monopage : toute route GET non consommee par /api ou
    // /uploads ci-dessus (/admin, /service, /menu...) renvoie index.html.
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.sendFile(
        join(CLIENT_DIST_PATH, 'index.html'),
        { headers: { 'Cache-Control': 'no-cache' } },
        (err) => { if (err) next(err); },
      );
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
