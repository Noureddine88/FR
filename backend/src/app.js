import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { authRoutes } from './routes/authRoutes.js';
import { colorRoutes } from './routes/colorRoutes.js';
import { commercialRoutes } from './routes/commercialRoutes.js';
import { customerRoutes } from './routes/customerRoutes.js';
import { designRoutes, publicDesignRoutes } from './routes/designRoutes.js';
import { publicReferenceRoutes, referenceRoutes } from './routes/referenceRoutes.js';

// Public alias: /api/article/:slug -> existing /api/reference/:slug (UI wording change only)

import { reportRoutes } from './routes/reportRoutes.js';
import { rollRoutes } from './routes/rollRoutes.js';
import { qrRoutes } from './routes/qrRoutes.js';
import { saleRoutes } from './routes/saleRoutes.js';
import { supplierRoutes } from './routes/supplierRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';
import { rateLimit, securityHeaders } from './middleware/securityMiddleware.js';

dotenv.config();

export const app = express();

app.use(securityHeaders);
app.use(rateLimit());

const frontendOrigin = process.env.FRONTEND_URL;
app.use(
  cors({
    origin: frontendOrigin ? frontendOrigin : false,
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/references', referenceRoutes);
app.use('/api/designs', designRoutes);
app.use('/api/colors', colorRoutes);
app.use('/api/commercial', commercialRoutes);
app.use('/api/rolls', rollRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/qr', qrRoutes);
// UI wording change: keep internal “Reference” model, but expose “Article” alias.
app.use('/api/reference', publicReferenceRoutes);
app.use('/api/article', publicReferenceRoutes);

app.use('/api/design', publicDesignRoutes);


app.use(notFound);
app.use(errorHandler);
