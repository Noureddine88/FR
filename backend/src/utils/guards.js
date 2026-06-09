import { prisma } from '../config/prisma.js';

const ACTIVE_QUOTATION_STATUSES = ['DRAFT', 'SENT'];

export const rollHasReferences = async (rollId) => {
  const [activeQuotations, activeDeliveries] = await Promise.all([
    prisma.quotationItem.count({
      where: { rollId, quotation: { status: { in: ACTIVE_QUOTATION_STATUSES } } },
    }),
    prisma.deliveryNoteItem.count({
      where: { rollId, deliveryNote: { status: 'DRAFT' } },
    }),
  ]);
  return activeQuotations + activeDeliveries > 0;
};

export const colorHasReferences = async (colorId) => {
  const rolls = await prisma.roll.findMany({ where: { colorId }, select: { id: true } });
  for (const roll of rolls) {
    if (await rollHasReferences(roll.id)) return true;
  }
  return false;
};

export const designHasReferences = async (designId) => {
  const colors = await prisma.color.findMany({ where: { designId }, select: { id: true } });
  for (const color of colors) {
    if (await colorHasReferences(color.id)) return true;
  }
  return false;
};

export const referenceHasReferences = async (referenceId) => {
  const designs = await prisma.design.findMany({ where: { referenceId }, select: { id: true } });
  for (const design of designs) {
    if (await designHasReferences(design.id)) return true;
  }
  return false;
};
