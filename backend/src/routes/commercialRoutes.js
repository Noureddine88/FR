import { Router } from 'express';
import {
  createDeliveryFromQuotation,
  createInvoiceFromDelivery,
  createQuotation,
  acceptDeliveryNote,
  deleteDeliveryNote,
  deleteInvoice,
  deleteQuotation,
  downloadDeliveryPdf,
  downloadInvoicePdf,
  downloadQuotationPdf,
  listDeliveryNotes,
  listInvoices,
  listQuotations,
  updateInvoicePayment,
  updateQuotationStatus,
} from '../controllers/commercialController.js';
import { protect } from '../middleware/authMiddleware.js';

export const commercialRoutes = Router();

commercialRoutes.use(protect);

commercialRoutes.get('/quotations', listQuotations);
commercialRoutes.post('/quotations', createQuotation);
commercialRoutes.patch('/quotations/:id/status', updateQuotationStatus);
commercialRoutes.get('/quotations/:id/pdf', downloadQuotationPdf);
commercialRoutes.post('/quotations/:id/delivery-note', createDeliveryFromQuotation);
commercialRoutes.delete('/quotations/:id', deleteQuotation);

commercialRoutes.get('/delivery-notes', listDeliveryNotes);
commercialRoutes.post('/delivery-notes/:id/accept', acceptDeliveryNote);
commercialRoutes.get('/delivery-notes/:id/pdf', downloadDeliveryPdf);
commercialRoutes.post('/delivery-notes/:id/invoice', createInvoiceFromDelivery);
commercialRoutes.delete('/delivery-notes/:id', deleteDeliveryNote);

commercialRoutes.get('/invoices', listInvoices);
commercialRoutes.patch('/invoices/:id/payment', updateInvoicePayment);
commercialRoutes.get('/invoices/:id/pdf', downloadInvoicePdf);
commercialRoutes.delete('/invoices/:id', deleteInvoice);