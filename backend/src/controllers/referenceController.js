import QRCode from 'qrcode';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { slugify } from '../utils/slug.js';
import { referenceHasReferences } from '../utils/guards.js';

export const listReferences = asyncHandler(async (req, res) => {
  const search = req.query.search?.trim();
  const minMeters = req.query.minMeters === undefined || req.query.minMeters === '' ? undefined : Number(req.query.minMeters);
  const maxMeters = req.query.maxMeters === undefined || req.query.maxMeters === '' ? undefined : Number(req.query.maxMeters);
  const where = {
    ...(search
      ? {
          OR: [
            ...(!isNaN(Number(search)) ? [{ articleCode: { equals: Number(search) } }] : []),
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
            { designs: { some: { name: { contains: search, mode: 'insensitive' } } } },
            { designs: { some: { colors: { some: { code: { contains: search, mode: 'insensitive' } } } } } },
            { designs: { some: { colors: { some: { displayName: { contains: search, mode: 'insensitive' } } } } } },

          ],
        }
      : {}),
    ...(minMeters !== undefined || maxMeters !== undefined
      ? { totalMeters: { ...(minMeters !== undefined ? { gte: minMeters } : {}), ...(maxMeters !== undefined ? { lte: maxMeters } : {}) } }
      : {}),
  };
  const references = await prisma.reference.findMany({
    where,
    include: { designs: { include: { colors: { include: { _count: { select: { rolls: true } } } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    references.map((reference) => {
      const colorCount = reference.designs.reduce((sum, design) => sum + design.colors.length, 0);
      const rollCount = reference.designs.reduce(
        (sum, design) => sum + design.colors.reduce((inner, color) => inner + color._count.rolls, 0),
        0,
      );
      return { ...reference, designCount: reference.designs.length, colorCount, rollCount };
    }),
  );
});

export const createReference = asyncHandler(async (req, res) => {
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ message: 'Veuillez saisir le nom de l\'article' });

  const max = await prisma.reference.aggregate({ _max: { articleCode: true } });
  const nextCode = (max._max.articleCode ?? -1) + 1;

  const baseSlug = slugify(name);
  let slug = baseSlug;
  let i = 2;
  while (await prisma.reference.findUnique({ where: { slug } })) slug = `${baseSlug}-${i++}`;

  const publicUrl = `${process.env.PUBLIC_APP_URL || 'http://localhost:5173'}/reference/${slug}`;
  const qrCodeUrl = await QRCode.toDataURL(publicUrl);
  const reference = await prisma.reference.create({ data: { articleCode: nextCode, name, slug, qrCodeUrl } });
  res.status(201).json(reference);
});

export const updateReference = asyncHandler(async (req, res) => {
  if (await referenceHasReferences(req.params.id)) {
    return res.status(400).json({ message: 'Cet article est lié à un devis, un bon de livraison ou une facture. Traitez ou supprimez d\'abord ces documents.' });
  }

  // articleCode is auto-generated and cannot be edited
  const { articleCode, ...data } = req.body;
  const reference = await prisma.reference.update({
    where: { id: req.params.id },
    data: { name: data.name?.trim() },
  });
  res.json(reference);
});

export const deleteReference = asyncHandler(async (req, res) => {
  if (await referenceHasReferences(req.params.id)) {
    return res.status(400).json({ message: 'Cet article est lié à un devis, un bon de livraison ou une facture. Traitez ou supprimez d\'abord ces documents.' });
  }

  await prisma.reference.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export const publicReference = asyncHandler(async (req, res) => {
  const reference = await prisma.reference.findUnique({
    where: { slug: req.params.slug },
    select: {
      id: true,
      name: true,
      slug: true,
      totalMeters: true,
      updatedAt: true,
      designs: {
        select: {
          id: true,
          name: true,
          totalMeters: true,
          colors: {
            select: { id: true, code: true, displayName: true, totalMeters: true, status: true },
            orderBy: { code: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
  });
  if (!reference) return res.status(404).json({ message: 'Article introuvable' });
  res.json(reference);
});
