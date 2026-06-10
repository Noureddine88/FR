import QRCode from 'qrcode';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { designHasReferences } from '../utils/guards.js';

export const listDesigns = asyncHandler(async (req, res) => {
  const search = req.query.search?.trim();
  const { referenceId, status } = req.query;
  const minMeters = req.query.minMeters === undefined || req.query.minMeters === '' ? undefined : Number(req.query.minMeters);
  const maxMeters = req.query.maxMeters === undefined || req.query.maxMeters === '' ? undefined : Number(req.query.maxMeters);
  const where = {
    ...(referenceId ? { referenceId } : {}),
    ...(minMeters !== undefined || maxMeters !== undefined
      ? { totalMeters: { ...(minMeters !== undefined ? { gte: minMeters } : {}), ...(maxMeters !== undefined ? { lte: maxMeters } : {}) } }
      : {}),
    ...(status ? { colors: { some: { status } } } : {}),
    ...(search
      ? {
          OR: [
            ...(!isNaN(Number(search)) ? [{ designCode: { equals: Number(search) } }] : []),
            { name: { contains: search, mode: 'insensitive' } },
            { reference: { name: { contains: search, mode: 'insensitive' } } },
            { colors: { some: { code: { contains: search, mode: 'insensitive' } } } },
            { colors: { some: { displayName: { contains: search, mode: 'insensitive' } } } },
          ].filter(Boolean),
        }
      : {}),
  };
  const designs = await prisma.design.findMany({
    where,
    include: { reference: true, colors: { include: { _count: { select: { rolls: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    designs.map((design) => ({
      ...design,
      colorCount: design.colors.length,
      rollCount: design.colors.reduce((sum, color) => sum + color._count.rolls, 0),
    })),
  );
});

export const createDesign = asyncHandler(async (req, res) => {
  const { name, referenceId } = req.body;
  if (!name || !referenceId) return res.status(400).json({ message: 'Veuillez saisir le nom du design et choisir un article' });

  const max = await prisma.design.aggregate({ _max: { designCode: true } });
  const nextCode = (max._max.designCode ?? -1) + 1;

  const design = await prisma.design.create({ data: { designCode: nextCode, name: name.trim(), referenceId } });
  const publicUrl = `${process.env.PUBLIC_APP_URL || 'https://fouratilog.netlify.app'}/design/${design.id}`;
  const qrCodeUrl = await QRCode.toDataURL(publicUrl);
  const updated = await prisma.design.update({ where: { id: design.id }, data: { qrCodeUrl } });
  res.status(201).json(updated);
});

export const updateDesign = asyncHandler(async (req, res) => {
  if (await designHasReferences(req.params.id)) {
    return res.status(400).json({ message: 'Ce design est lié à un devis, un bon de livraison ou une facture. Traitez ou supprimez d\'abord ces documents.' });
  }

  // designCode is auto-generated and cannot be edited
  const { designCode, ...rest } = req.body;
  const data = {};
  if (rest.name !== undefined) data.name = rest.name.trim();
  if (rest.referenceId !== undefined) data.referenceId = rest.referenceId;

  const design = await prisma.design.update({
    where: { id: req.params.id },
    data,
  });
  res.json(design);
});

export const deleteDesign = asyncHandler(async (req, res) => {
  if (await designHasReferences(req.params.id)) {
    return res.status(400).json({ message: 'Ce design est lié à un devis, un bon de livraison ou une facture. Traitez ou supprimez d\'abord ces documents.' });
  }

  await prisma.design.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export const publicDesign = asyncHandler(async (req, res) => {
  const design = await prisma.design.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      totalMeters: true,
      updatedAt: true,
      reference: { select: { id: true, name: true, slug: true } },
      colors: {
        select: { id: true, code: true, displayName: true, totalMeters: true, status: true },
        orderBy: { code: 'asc' },
      },
    },
  });
  if (!design) return res.status(404).json({ message: 'Design introuvable' });
  res.json(design);
});
