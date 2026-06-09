import { Router } from 'express';
import { listQrCodes, regenerateDesignQrCode, regenerateQrCode } from '../controllers/qrController.js';
import { protect } from '../middleware/authMiddleware.js';

export const qrRoutes = Router();
qrRoutes.use(protect);
qrRoutes.get('/', listQrCodes);
qrRoutes.post('/references/:id/regenerate', regenerateQrCode);
qrRoutes.post('/designs/:id/regenerate', regenerateDesignQrCode);
