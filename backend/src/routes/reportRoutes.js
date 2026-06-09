import { Router } from 'express';
import { dashboard, exportPdf, exportXlsx, getReport } from '../controllers/reportController.js';
import { protect } from '../middleware/authMiddleware.js';

export const reportRoutes = Router();
reportRoutes.use(protect);
reportRoutes.get('/dashboard', dashboard);
reportRoutes.get('/:type', getReport);
reportRoutes.get('/:type/xlsx', exportXlsx);
reportRoutes.get('/:type/pdf', exportPdf);
