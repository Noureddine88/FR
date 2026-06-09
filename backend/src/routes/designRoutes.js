import { Router } from 'express';
import { createDesign, deleteDesign, listDesigns, publicDesign, updateDesign } from '../controllers/designController.js';
import { protect } from '../middleware/authMiddleware.js';

export const designRoutes = Router();
export const publicDesignRoutes = Router();

designRoutes.use(protect);
designRoutes.get('/', listDesigns);
designRoutes.post('/', createDesign);
designRoutes.put('/:id', updateDesign);
designRoutes.delete('/:id', deleteDesign);

publicDesignRoutes.get('/:id', publicDesign);
