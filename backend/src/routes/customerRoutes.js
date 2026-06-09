import { Router } from 'express';
import { createCustomer, deleteCustomer, listCustomers, searchCustomers, updateCustomer } from '../controllers/customerController.js';

import { protect } from '../middleware/authMiddleware.js';

export const customerRoutes = Router();
customerRoutes.use(protect);
customerRoutes.get('/', listCustomers);
customerRoutes.get('/search', searchCustomers);
customerRoutes.post('/', createCustomer);

customerRoutes.put('/:id', updateCustomer);
customerRoutes.delete('/:id', deleteCustomer);
