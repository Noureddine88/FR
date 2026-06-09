import { Router } from 'express';
import { createSupplier, deleteSupplier, listSuppliers, updateSupplier } from '../controllers/supplierController.js';
import { protect } from '../middleware/authMiddleware.js';

export const supplierRoutes = Router();
supplierRoutes.use(protect);
supplierRoutes.get('/', listSuppliers);
supplierRoutes.post('/', createSupplier);
supplierRoutes.put('/:id', updateSupplier);
supplierRoutes.delete('/:id', deleteSupplier);
