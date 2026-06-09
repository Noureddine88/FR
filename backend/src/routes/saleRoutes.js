import { Router } from 'express';
import { createSale, listSales } from '../controllers/saleController.js';
import { protect } from '../middleware/authMiddleware.js';

export const saleRoutes = Router();
saleRoutes.use(protect);
saleRoutes.get('/', listSales);
saleRoutes.post('/', createSale);
