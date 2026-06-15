import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateDeliveryPdf, generateInvoicePdf, generateQuotationPdf } from '../utils/commercialPdf.js';
import { nextCommercialInvoiceNumber, nextDeliveryNumber, nextQuotationNumber, recalculateColorTotals } from '../utils/stock.js';

const includeQuotation = { customer: true, items: { include: { roll: { include: { color: { include: { design: { include: { reference: true } } } } } } } }, deliveryNote: true };
const includeDelivery = { customer: true, quotation: { include: { items: true } }, items: { include: { roll: true } }, invoice: true };
const includeInvoice = { customer: true, deliveryNote: true, items: { include: { roll: true } } };

const number = (value) => Number(value || 0);
const clean = (value) => (value === undefined || value === null ? undefined : String(value).trim());

const calcTotals = (items = [], stampDuty = 1) => {
  const normalized = items.map((item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const unitPriceHt = parseFloat(item.unitPriceHt) || 0;

    const remiseRate =
      item.remiseRate !== undefined && item.remiseRate !== null
        ? parseFloat(item.remiseRate) || 0
        : parseFloat(item.remise) || 0;

    const tvaRate =
      item.tvaRate === undefined || item.tvaRate === null ? 19 : parseFloat(item.tvaRate) || 0;

    const grossAmount = quantity * unitPriceHt;
    const discountAmount = grossAmount * (remiseRate / 100);
    const netAmountHt = grossAmount - discountAmount;
    const tvaAmount = grossAmount * (tvaRate / 100);

    return {
      ...item,
      quantity,
      unitPriceHt,
      remiseRate,
      tvaRate,
      discountAmount,
      totalHt: netAmountHt,
      tvaAmount,
      totalTtc: netAmountHt + tvaAmount,
    };
  });

  const totalHt = normalized.reduce((sum, i) => sum + i.totalHt, 0);
  const totalTva = normalized.reduce((sum, i) => sum + i.tvaAmount, 0);
  const finalStampDuty = parseFloat(stampDuty) || 1;

  return {
    items: normalized,
    totalHt,
    totalTva,
    stampDuty: finalStampDuty,
    netToPay: totalHt + totalTva + finalStampDuty,
  };
};


const searchable = (search) =>
  search
    ? {
        OR: [
          { customerName: { contains: search, mode: 'insensitive' } },
          { customer: { fullName: { contains: search, mode: 'insensitive' } } },
          ...(isNaN(Number(search)) ? [] : [{ customer: { customerCode: { equals: Number(search) } } }]),
          { customer: { matriculeFiscale: { contains: search, mode: 'insensitive' } } },
          { customer: { email: { contains: search, mode: 'insensitive' } } },
          { customer: { phone: { contains: search, mode: 'insensitive' } } },
        ],
      }
    : {};


const storageRoot = path.resolve('storage', 'commercial');

const isSafePdfPath = (pdfPath) => {
  if (!pdfPath) return false;
  const resolved = path.resolve(pdfPath);
  return resolved.startsWith(storageRoot + path.sep) || resolved === storageRoot;
};

const sendStoredPdf = (res, filePath) => {
  if (!filePath || !fs.existsSync(filePath) || !isSafePdfPath(filePath)) {
    return res.status(404).json({ message: 'Le fichier PDF est introuvable' });
  }
  return res.download(filePath);
};

export const listQuotations = asyncHandler(async (req, res) => {
  const search = req.query.search?.trim();
  const status = req.query.status?.trim();
  const quotations = await prisma.quotation.findMany({
    where: { ...searchable(search), ...(status ? { status } : {}) },
    include: includeQuotation,
    orderBy: { createdAt: 'desc' },
  });
  res.json(quotations);
});

export const createQuotation = asyncHandler(async (req, res) => {
  const { items, stampDuty, customerId, customerName, customerPhone, customerAddress, notes } = req.body;
  if (!items?.length) return res.status(400).json({ message: 'Veuillez ajouter au moins un article au devis' });
  const totals = calcTotals(items, stampDuty);
  if (totals.items.some((item) => item.quantity <= 0)) return res.status(400).json({ message: 'Les quantités doivent être supérieures à zéro' });

  const quotation = await prisma.$transaction(async (tx) => {
    return tx.quotation.create({
      data: {
        quotationNumber: await nextQuotationNumber(tx),
        customerId: customerId || null,
        customerName: clean(customerName) || null,
        customerPhone: clean(customerPhone) || null,
        customerAddress: clean(customerAddress) || null,
        notes: clean(notes) || null,
        createdById: req.admin?.id || null,
        totalHt: totals.totalHt,
        totalTva: totals.totalTva,
        stampDuty: totals.stampDuty,
        netToPay: totals.netToPay,
        items: {
          create: totals.items.map((item) => ({
            rollId: item.rollId || null,
            articleCode: item.articleCode,
            designation: item.designation,
            quantity: item.quantity,
            unit: item.unit ?? 'm',
            unitPriceHt: item.unitPriceHt,
            tvaRate: item.tvaRate,
            remiseRate: item.remiseRate ?? 0,
            totalHt: item.totalHt,
          })),
        },
      },
      include: includeQuotation,
    });
  });

  const pdfPath = await generateQuotationPdf(quotation);
  const updated = await prisma.quotation.update({ where: { id: quotation.id }, data: { pdfPath }, include: includeQuotation });
  res.status(201).json(updated);
});


export const updateQuotationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Le statut du devis est invalide' });
  const quotation = await prisma.quotation.update({ where: { id: req.params.id }, data: { status }, include: includeQuotation });
  res.json(quotation);
});

export const downloadQuotationPdf = asyncHandler(async (req, res) => {
  const quotation = await prisma.quotation.findUnique({ where: { id: req.params.id } });
  return sendStoredPdf(res, quotation?.pdfPath);
});

export const createDeliveryFromQuotation = asyncHandler(async (req, res) => {
  const delivery = await prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findUnique({ where: { id: req.params.id }, include: { customer: true, items: true, deliveryNote: true } });
    if (!quotation) throw Object.assign(new Error('Devis introuvable'), { statusCode: 404 });
    if (quotation.deliveryNote) throw Object.assign(new Error('Ce devis a déjà un bon de livraison'), { statusCode: 409 });

    const created = await tx.deliveryNote.create({
      data: {
        deliveryNumber: await nextDeliveryNumber(tx),
        quotationId: quotation.id,
        customerId: quotation.customerId,
        customerName: quotation.customer?.fullName || quotation.customerName,
        deliveryAddress: clean(req.body.deliveryAddress) || quotation.customer?.address || quotation.customerAddress,
        driver: clean(req.body.driver) || null,
        notes: clean(req.body.notes) || quotation.notes,
        createdById: req.admin?.id || null,
        totalQuantity: quotation.items.reduce((sum, item) => sum + item.quantity, 0),
        items: {
          create: quotation.items.map((item) => ({
            rollId: item.rollId || null,
            articleCode: item.articleCode,
            designation: item.designation,
            quantity: item.quantity,
            unit: item.unit,
          })),
        },
      },
      include: includeDelivery,
    });
    await tx.quotation.update({ where: { id: quotation.id }, data: { status: 'ACCEPTED' } });
    return created;
  });

  const pdfPath = await generateDeliveryPdf(delivery);
  const updated = await prisma.deliveryNote.update({ where: { id: delivery.id }, data: { pdfPath }, include: includeDelivery });
  res.status(201).json(updated);
});

export const acceptDeliveryNote = asyncHandler(async (req, res) => {
  const delivery = await prisma.$transaction(async (tx) => {
    const current = await tx.deliveryNote.findUnique({
      where: { id: req.params.id },
      include: { items: true, quotation: true },
    });
    if (!current) throw Object.assign(new Error('Bon de livraison introuvable'), { statusCode: 404 });
    if (current.status === 'ACCEPTED')
      throw Object.assign(new Error('Ce bon de livraison est déjà accepté'), { statusCode: 409 });

    for (const item of current.items) {
      if (!item.rollId) continue;
      const roll = await tx.roll.findUnique({ where: { id: item.rollId } });
      if (!roll) throw Object.assign(new Error(`Rouleau introuvable pour l'article ${item.articleCode}`), { statusCode: 404 });
      if (roll.remainingMeters < item.quantity)
        throw Object.assign(new Error(`Stock insuffisant pour l'article ${item.articleCode} : il ne reste que ${roll.remainingMeters} mètres`), { statusCode: 400 });

      await tx.roll.update({ where: { id: roll.id }, data: { remainingMeters: { decrement: item.quantity } } });
      await tx.stockMovement.create({
        data: { type: 'EXIT', quantity: item.quantity, reason: `Bon de livraison ${current.deliveryNumber}`, rollId: roll.id },
      });
    }

    return tx.deliveryNote.update({
      where: { id: current.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
      include: includeDelivery,
    });
  });

  // Recalculate stock totals AFTER the transaction to avoid interactive transaction timeouts.
  // We need to update derived totals (roll->color->design->reference).
  if (delivery?.items?.length) {
    const uniqueColorIds = new Set();
    for (const dItem of delivery.items) {
      if (!dItem.rollId) continue;
      // We only need colorId; load roll outside transaction.
      const roll = await prisma.roll.findUnique({ where: { id: dItem.rollId }, select: { colorId: true } });
      if (roll?.colorId) uniqueColorIds.add(roll.colorId);
    }
    for (const colorId of uniqueColorIds) {
      await recalculateColorTotals(colorId, prisma);
    }
  }

  const pdfPath = await generateDeliveryPdf(delivery);
  const updated = await prisma.deliveryNote.update({ where: { id: delivery.id }, data: { pdfPath }, include: includeDelivery });
  res.json(updated);
});

export const listDeliveryNotes = asyncHandler(async (req, res) => {
  const search = req.query.search?.trim();
  const deliveryNotes = await prisma.deliveryNote.findMany({
    where: search
      ? {
          OR: [
            { deliveryNumber: { contains: search, mode: 'insensitive' } },
            { customerName: { contains: search, mode: 'insensitive' } },
            { customer: { fullName: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : undefined,
    include: includeDelivery,
    orderBy: { createdAt: 'desc' },
  });
  res.json(deliveryNotes);
});

export const downloadDeliveryPdf = asyncHandler(async (req, res) => {
  const delivery = await prisma.deliveryNote.findUnique({ where: { id: req.params.id } });
  return sendStoredPdf(res, delivery?.pdfPath);
});

export const createInvoiceFromDelivery = asyncHandler(async (req, res) => {
  const invoice = await prisma.$transaction(async (tx) => {
    const delivery = await tx.deliveryNote.findUnique({
      where: { id: req.params.id },
      include: { customer: true, quotation: { include: { items: true } }, items: true, invoice: true },
    });
    if (!delivery) throw Object.assign(new Error('Bon de livraison introuvable'), { statusCode: 404 });
    if (delivery.invoice) throw Object.assign(new Error('Ce bon de livraison a déjà une facture'), { statusCode: 409 });
    if (delivery.status !== 'ACCEPTED') throw Object.assign(new Error('Le bon de livraison doit être accepté avant de créer une facture'), { statusCode: 400 });

    const totals = calcTotals(
      delivery.quotation.items.map((item) => ({
        ...item,
        quantity: delivery.items.find((d) => d.articleCode === item.articleCode)?.quantity || item.quantity,
        remiseRate: item.remiseRate ?? 0,
      })),
      req.body.stampDuty ?? delivery.quotation.stampDuty
    );

    return tx.invoice.create({
      data: {
        invoiceNumber: await nextCommercialInvoiceNumber(tx),
        deliveryNoteId: delivery.id,
        customerId: delivery.customerId,
        customerName: delivery.customer?.fullName || delivery.customerName,
        mfNumber: clean(req.body.mfNumber) || null,
        notes: clean(req.body.notes) || delivery.notes,
        paymentStatus: req.body.paymentStatus || 'UNPAID',
        createdById: req.admin?.id || null,
        totalHt: totals.totalHt,
        totalTva: totals.totalTva,
        stampDuty: totals.stampDuty,
        netToPay: totals.netToPay,
        items: {
          create: totals.items.map((item) => ({
            rollId: item.rollId ?? null,
            articleCode: item.articleCode,
            designation: item.designation,
            quantity: item.quantity,
            unit: item.unit ?? 'm',
            unitPriceHt: item.unitPriceHt,
            tvaRate: item.tvaRate,
            remiseRate: item.remiseRate ?? 0,
            unitPriceTtc: item.unitPriceHt * (1 + item.tvaRate / 100),
            totalHt: item.totalHt,
          })),
        },
      },
      include: includeInvoice,
    });
  });

  const pdfPath = await generateInvoicePdf(invoice);
  return res.status(201).json(await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfPath }, include: includeInvoice }));
});

export const listInvoices = asyncHandler(async (req, res) => {
  const search = req.query.search?.trim();
  const paymentStatus = req.query.paymentStatus?.trim();
  const invoices = await prisma.invoice.findMany({
    where: {
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { customerName: { contains: search, mode: 'insensitive' } },
              { customer: { fullName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: includeInvoice,
    orderBy: { createdAt: 'desc' },
  });
  res.json(invoices);
});

export const updateInvoicePayment = asyncHandler(async (req, res) => {
  const allowed = ['PAID', 'PARTIALLY_PAID', 'UNPAID'];
  if (!allowed.includes(req.body.paymentStatus)) return res.status(400).json({ message: 'Le statut de paiement est invalide' });
  const invoice = await prisma.invoice.update({ where: { id: req.params.id }, data: { paymentStatus: req.body.paymentStatus }, include: includeInvoice });
  res.json(invoice);
});

export const downloadInvoicePdf = asyncHandler(async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  return sendStoredPdf(res, invoice?.pdfPath);
});


export const deleteQuotation = asyncHandler(async (req, res) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: req.params.id },
    include: { deliveryNote: { include: { invoice: true } } },
  });
  if (!quotation) return res.status(404).json({ message: 'Devis introuvable' });
  if (quotation.deliveryNote?.status === 'ACCEPTED')
    return res.status(400).json({ message: 'Impossible de supprimer : un bon de livraison accepté est lié à ce devis' });

  // Delete in strict FK order: InvoiceItems → Invoice → DeliveryNoteItems → DeliveryNote → QuotationItems → Quotation
  await prisma.$transaction([
    // Invoice layer
    ...(quotation.deliveryNote?.invoice
      ? [
          prisma.invoiceItem.deleteMany({ where: { invoiceId: quotation.deliveryNote.invoice.id } }),
          prisma.invoice.delete({ where: { id: quotation.deliveryNote.invoice.id } }),
        ]
      : []),
    // Delivery note layer
    ...(quotation.deliveryNote
      ? [
          prisma.deliveryNoteItem.deleteMany({ where: { deliveryNoteId: quotation.deliveryNote.id } }),
          prisma.deliveryNote.delete({ where: { id: quotation.deliveryNote.id } }),
        ]
      : []),
    // Quotation layer
    prisma.quotationItem.deleteMany({ where: { quotationId: req.params.id } }),
    prisma.quotation.delete({ where: { id: req.params.id } }),
  ]);

  res.status(204).send();
});

export const deleteDeliveryNote = asyncHandler(async (req, res) => {
  const note = await prisma.deliveryNote.findUnique({
    where: { id: req.params.id },
    include: { invoice: true },
  });
  if (!note) return res.status(404).json({ message: 'Bon de livraison introuvable' });
  if (note.status === 'ACCEPTED')
    return res.status(400).json({ message: 'Impossible de supprimer : ce bon de livraison est déjà accepté' });

  // Delete in strict FK order: InvoiceItems → Invoice → DeliveryNoteItems → DeliveryNote
  await prisma.$transaction([
    ...(note.invoice
      ? [
          prisma.invoiceItem.deleteMany({ where: { invoiceId: note.invoice.id } }),
          prisma.invoice.delete({ where: { id: note.invoice.id } }),
        ]
      : []),
    prisma.deliveryNoteItem.deleteMany({ where: { deliveryNoteId: req.params.id } }),
    prisma.deliveryNote.delete({ where: { id: req.params.id } }),
  ]);

  res.status(204).send();
});

export const deleteInvoice = asyncHandler(async (req, res) => {
  await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoiceId: req.params.id } }),
    prisma.invoice.delete({ where: { id: req.params.id } }),
  ]);
  res.status(204).send();
});