import { Router } from 'express';
import { createReference, deleteReference, listReferences, publicReference, updateReference } from '../controllers/referenceController.js';
import { protect } from '../middleware/authMiddleware.js';

export const referenceRoutes = Router();
export const publicReferenceRoutes = Router();

referenceRoutes.use(protect);
referenceRoutes.get('/', listReferences);
referenceRoutes.post('/', createReference);
referenceRoutes.put('/:id', updateReference);
referenceRoutes.delete('/:id', deleteReference);

publicReferenceRoutes.get('/:slug', publicReference);
