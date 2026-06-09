import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { colorHasReferences } from '../utils/guards.js';

export const listColors = asyncHandler(async (req, res) => {
  const search = req.query.search?.trim();
  const { designId, referenceId, status } = req.query;
  const minMeters = req.query.minMeters === undefined || req.query.minMeters === '' ? undefined : Number(req.query.minMeters);
  const maxMeters = req.query.maxMeters === undefined || req.query.maxMeters === '' ? undefined : Number(req.query.maxMeters);
  const where = {
    ...(designId ? { designId } : {}),
    ...(referenceId ? { design: { referenceId } } : {}),
    ...(status ? { status } : {}),
    ...(minMeters !== undefined || maxMeters !== undefined
      ? { totalMeters: { ...(minMeters !== undefined ? { gte: minMeters } : {}), ...(maxMeters !== undefined ? { lte: maxMeters } : {}) } }
      : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
            { design: { name: { contains: search, mode: 'insensitive' } } },
            { design: { reference: { name: { contains: search, mode: 'insensitive' } } } },

          ],
        }
      : {}),
  };
  const colors = await prisma.color.findMany({
    where,
    include: { design: { include: { reference: true } }, _count: { select: { rolls: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(colors.map((color) => ({ ...color, rollCount: color._count.rolls })));
});

export const createColor = asyncHandler(async (req, res) => {
  const { code, displayName, designId } = req.body;
  if (!code || !designId) return res.status(400).json({ message: 'Veuillez saisir le code couleur et choisir un design' });
  const color = await prisma.color.create({
    data: { code: code.trim(), displayName: displayName?.trim() || null, designId },
  });
  res.status(201).json(color);
});

export const updateColor = asyncHandler(async (req, res) => {
  if (await colorHasReferences(req.params.id)) {
    return res.status(400).json({ message: 'Cette couleur est liée à un devis, un bon de livraison ou une facture. Traitez ou supprimez d\'abord ces documents.' });
  }

  const data = {};
  if (req.body.code !== undefined) data.code = req.body.code.trim();
  if (req.body.displayName !== undefined) data.displayName = req.body.displayName?.trim() || null;
  if (req.body.designId !== undefined) data.designId = req.body.designId;

  const color = await prisma.color.update({
    where: { id: req.params.id },
    data,
  });
  res.json(color);
});

export const deleteColor = asyncHandler(async (req, res) => {
  if (await colorHasReferences(req.params.id)) {
    return res.status(400).json({ message: 'Cette couleur est liée à un devis, un bon de livraison ou une facture. Traitez ou supprimez d\'abord ces documents.' });
  }

  await prisma.color.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
