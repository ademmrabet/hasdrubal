import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { suppliersRouter } from './modules/suppliers/suppliers.routes.js';
import { ingredientsRouter } from './modules/ingredients/ingredients.routes.js';
import { stockRouter } from './modules/stock/stock.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { menuRouter } from './modules/menu/menu.routes.js';
import { publicRouter } from './modules/public/public.routes.js';
import { payrollRouter } from './modules/payroll/payroll.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/suppliers', suppliersRouter);
apiRouter.use('/ingredients', ingredientsRouter);
apiRouter.use('/stock', stockRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/menu', menuRouter);
apiRouter.use('/payroll', payrollRouter);
apiRouter.use('/public', publicRouter);   // sans authentification

// Phases suivantes : orders, clients, reservations, finance, forecast.
// touche 1790021509
