import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  formatArticleCode,
  internalRollId,
  nextArticleCode,
  recalculateColorTotals,
} from '../utils/stock.js';
import { rollHasReferences } from '../utils/guards.js';

const rollInclude = {
  supplier: true,
  color: { include: { design: { include: { reference: true } } } },
};

const enrichRoll = (roll) => {
  const color = roll.color;
  const design = color?.design;
  const colorLabel = color?.displayName || color?.code || '';
  const articleCodeFormatted = formatArticleCode(roll.articleCode);

  return {
    ...roll,
    articleCodeFormatted,
    articleCodeComputed: articleCodeFormatted,
    suggestionLabel: `${articleCodeFormatted} - ${design?.name || ''} - ${colorLabel}`.replace(/\s+-\s+$/, ''),
  };
};

export const listRolls = asyncHandler(async (req, res) => {
  const search = (req.query.search ?? req.query.q)?.trim();
  const colorId = req.query.colorId?.trim();
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;

  const where = {};
  if (colorId) {
    where.colorId = colorId;
  } else if (search) {
    where.OR = [
      ...(!isNaN(Number(search)) ? [{ articleCode: { equals: Number(search) } }] : []),
      { color: { displayName: { contains: search, mode: 'insensitive' } } },
      { color: { code: { contains: search, mode: 'insensitive' } } },
      { color: { design: { name: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const rolls = await prisma.roll.findMany({
    where: Object.keys(where).length ? where : undefined,
    include: rollInclude,
    orderBy: colorId ? { articleCode: 'asc' } : search ? { articleCode: 'asc' } : { createdAt: 'desc' },
    take: limit ?? (search ? 50 : undefined),
  });

  res.json(rolls.map(enrichRoll));
});

export const createRoll = asyncHandler(async (req, res) => {
  const { colorId, supplierId, meters, remainingMeters, purchasePrice, sellingPrice, notes } = req.body;
  const metersNum = Number(meters);
  if (!colorId || !meters || isNaN(metersNum) || metersNum <= 0) return res.status(400).json({ message: 'Veuillez choisir une couleur et saisir un métrage valide' });

  const remainingNum = remainingMeters !== undefined && remainingMeters !== null && remainingMeters !== '' ? Number(remainingMeters) : metersNum;
  const purchaseNum = Number(purchasePrice || 0);
  const sellingNum = Number(sellingPrice || 0);

  const roll = await prisma.$transaction(async (tx) => {
    const articleCode = await nextArticleCode(tx);
    const internalId = internalRollId(articleCode);

    return tx.roll.create({
      data: {
        articleCode,
        colorId,
        supplierId: supplierId || null,
        rollNumber: internalId,
        barcode: internalId,
        meters: metersNum,
        remainingMeters: remainingNum,
        purchasePrice: isNaN(purchaseNum) ? 0 : purchaseNum,
        sellingPrice: isNaN(sellingNum) ? 0 : sellingNum,
        notes: notes?.trim() || null,
        movements: { create: { type: 'ENTRY', quantity: metersNum, reason: 'Entrée initiale du rouleau' } },
      },
      include: rollInclude,
    });
  });

  await recalculateColorTotals(colorId);
  res.status(201).json(enrichRoll(roll));
});

export const updateRoll = asyncHandler(async (req, res) => {
  const existing = await prisma.roll.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Rouleau introuvable' });

  if (await rollHasReferences(existing.id)) {
    return res.status(400).json({ message: 'Ce rouleau est lié à un devis, un bon de livraison ou une facture. Traitez ou supprimez d\'abord ces documents.' });
  }

  const toNumberOr = (val) => (val === undefined || val === null || val === '' ? undefined : Number(val));

  const roll = await prisma.roll.update({
    where: { id: req.params.id },
    data: {
      meters: toNumberOr(req.body.meters),
      remainingMeters: toNumberOr(req.body.remainingMeters),
      purchasePrice: toNumberOr(req.body.purchasePrice),
      sellingPrice: toNumberOr(req.body.sellingPrice),
      supplierId: req.body.supplierId === undefined ? undefined : req.body.supplierId || null,
      colorId: req.body.colorId === undefined ? undefined : req.body.colorId,
      notes: req.body.notes === undefined ? undefined : req.body.notes?.trim() || null,
    },
    include: rollInclude,
  });
  await recalculateColorTotals(existing.colorId);
  if (roll.colorId !== existing.colorId) await recalculateColorTotals(roll.colorId);
  res.json(enrichRoll(roll));
});

export const deleteRoll = asyncHandler(async (req, res) => {
  const roll = await prisma.roll.findUnique({ where: { id: req.params.id } });
  if (!roll) return res.status(404).json({ message: 'Rouleau introuvable' });

  if (await rollHasReferences(roll.id)) {
    return res.status(400).json({ message: 'Ce rouleau est lié à un devis, un bon de livraison ou une facture. Traitez ou supprimez d\'abord ces documents.' });
  }

  await prisma.roll.delete({ where: { id: roll.id } });
  await recalculateColorTotals(roll.colorId);
  res.status(204).end();
});

export const findByBarcode = asyncHandler(async (req, res) => {
  const query = req.params.barcode.trim();
  const numericCode = Number(query);
  const roll = await prisma.roll.findFirst({
    where: !isNaN(numericCode) && /^\d+$/.test(query)
      ? { articleCode: numericCode }
      : { OR: [{ barcode: query }, { rollNumber: query }] },
    include: rollInclude,
  });
  if (!roll) return res.status(404).json({ message: 'Aucun article trouvé avec ce code ou ce code-barres' });
  res.json(enrichRoll(roll));
});
