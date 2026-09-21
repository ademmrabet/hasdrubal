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
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
