import { Router } from 'express';
import { bootstrapAdmin, login, me } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

export const authRoutes = Router();

authRoutes.post('/login', login);
authRoutes.post('/bootstrap', bootstrapAdmin);
authRoutes.get('/me', protect, me);
