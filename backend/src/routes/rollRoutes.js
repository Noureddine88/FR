import { Router } from 'express';
import { createRoll, deleteRoll, findByBarcode, listRolls, updateRoll } from '../controllers/rollController.js';
import { protect } from '../middleware/authMiddleware.js';

export const rollRoutes = Router();
rollRoutes.use(protect);
rollRoutes.get('/', listRolls);
rollRoutes.get('/search', listRolls);
rollRoutes.get('/barcode/:barcode', findByBarcode);
rollRoutes.post('/', createRoll);
rollRoutes.put('/:id', updateRoll);
rollRoutes.delete('/:id', deleteRoll);
