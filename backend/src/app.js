import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendDist = resolve(__dirname, '../../frontend/dist');
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

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://fouratilog.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.options('*', cors());

app.use(express.json({ limit: '1mb' }));

// Serve frontend static files from sibling directory
app.use(express.static(frontendDist));

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


// SPA fallback: serve index.html for any non-API route (client-side routing)
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(resolve(frontendDist, 'index.html'));
});

app.use(notFound);
app.use(errorHandler);
