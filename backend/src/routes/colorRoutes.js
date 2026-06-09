import { Router } from 'express';
import { createColor, deleteColor, listColors, updateColor } from '../controllers/colorController.js';
import { protect } from '../middleware/authMiddleware.js';

export const colorRoutes = Router();
colorRoutes.use(protect);
colorRoutes.get('/', listColors);
colorRoutes.post('/', createColor);
colorRoutes.put('/:id', updateColor);
colorRoutes.delete('/:id', deleteColor);
