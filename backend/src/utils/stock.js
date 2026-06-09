import { prisma } from '../config/prisma.js';

export const statusForMeters = (meters) => {
  if (meters <= 0) return 'INDISPONIBLE';
  if (meters <= 50) return 'STOCK_LIMITED';
  return 'DISPONIBLE';
};

export const recalculateReferenceTotals = async (referenceId, tx = prisma) => {
  const aggregate = await tx.design.aggregate({
    where: { referenceId },
    _sum: { totalMeters: true },
  });
  return tx.reference.update({
    where: { id: referenceId },
    data: { totalMeters: aggregate._sum.totalMeters || 0 },
  });
};

export const recalculateDesignTotals = async (designId, tx = prisma) => {
  const aggregate = await tx.color.aggregate({
    where: { designId },
    _sum: { totalMeters: true },
  });
  const design = await tx.design.update({
    where: { id: designId },
    data: { totalMeters: aggregate._sum.totalMeters || 0 },
  });
  await recalculateReferenceTotals(design.referenceId, tx);
  return design;
};

export const recalculateColorTotals = async (colorId, tx = prisma) => {
  const aggregate = await tx.roll.aggregate({
    where: { colorId },
    _sum: { remainingMeters: true },
  });
  const totalMeters = aggregate._sum.remainingMeters || 0;
  const color = await tx.color.update({
    where: { id: colorId },
    data: { totalMeters, status: statusForMeters(totalMeters) },
  });
  await recalculateDesignTotals(color.designId, tx);
  return color;
};

export const formatArticleCode = (code) => String(code ?? '').padStart(4, '0');

export const internalRollId = (articleCode) => `ROLL-${String(articleCode).padStart(6, '0')}`;

export const nextArticleCode = async (tx = prisma) => {
  const max = await tx.roll.aggregate({ _max: { articleCode: true } });
  return (max._max.articleCode ?? -1) + 1;
};

export const nextRollNumber = async (articleCode) => internalRollId(articleCode ?? (await nextArticleCode()));

export const nextInvoiceNumber = async (tx = prisma) => {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = await tx.sale.count({ where: { invoiceNumber: { startsWith: prefix } } });
  return `${prefix}-${String(count + 1).padStart(5, '0')}`;
};

const nextYearlyNumber = async (model, field, prefix, tx = prisma) => {
  const year = new Date().getFullYear();
  const start = `${prefix}-${year}-`;
  const count = await tx[model].count({ where: { [field]: { startsWith: start } } });
  return `${start}${String(count + 1).padStart(6, '0')}`;
};

export const nextQuotationNumber = (tx = prisma) => nextYearlyNumber('quotation', 'quotationNumber', 'DEV', tx);
export const nextDeliveryNumber = (tx = prisma) => nextYearlyNumber('deliveryNote', 'deliveryNumber', 'BL', tx);
export const nextCommercialInvoiceNumber = (tx = prisma) => nextYearlyNumber('invoice', 'invoiceNumber', 'FAC', tx);
