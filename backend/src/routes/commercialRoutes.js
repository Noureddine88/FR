import { Router } from 'express';
import {
  createDeliveryFromQuotation,
  createInvoiceFromDelivery,
  createQuotation,
  acceptDeliveryNote,
  deleteDeliveryNote,
  deleteInvoice,
  deleteQuotation,
  listDeliveryNotes,
  listInvoices,
  listQuotations,
  updateInvoicePayment,
  updateQuotation,
  updateQuotationStatus,
} from '../controllers/commercialController.js';
import { protect } from '../middleware/authMiddleware.js';

export const commercialRoutes = Router();

commercialRoutes.use(protect);

commercialRoutes.get('/quotations', listQuotations);
commercialRoutes.post('/quotations', createQuotation);
commercialRoutes.put('/quotations/:id', updateQuotation);
commercialRoutes.patch('/quotations/:id/status', updateQuotationStatus);
commercialRoutes.post('/quotations/:id/delivery-note', createDeliveryFromQuotation);
commercialRoutes.delete('/quotations/:id', deleteQuotation);

commercialRoutes.get('/delivery-notes', listDeliveryNotes);
commercialRoutes.post('/delivery-notes/:id/accept', acceptDeliveryNote);
commercialRoutes.post('/delivery-notes/:id/invoice', createInvoiceFromDelivery);
commercialRoutes.delete('/delivery-notes/:id', deleteDeliveryNote);

commercialRoutes.get('/invoices', listInvoices);
commercialRoutes.patch('/invoices/:id/payment', updateInvoicePayment);
commercialRoutes.delete('/invoices/:id', deleteInvoice);
