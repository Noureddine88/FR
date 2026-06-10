import QRCode from 'qrcode';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const appUrl = () => process.env.PUBLIC_APP_URL || 'fouratilog.netlify.app';

export const listQrCodes = asyncHandler(async (req, res) => {
  let [references, designs] = await Promise.all([
    prisma.reference.findMany({
      select: { id: true, name: true, slug: true, qrCodeUrl: true, totalMeters: true },
      orderBy: { name: 'asc' },
    }),
    prisma.design.findMany({
      select: {
        id: true,
        name: true,
        qrCodeUrl: true,
        totalMeters: true,
        reference: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  await Promise.all([
    ...references
      .filter((reference) => !reference.qrCodeUrl)
      .map(async (reference) => {
        reference.qrCodeUrl = await QRCode.toDataURL(`${appUrl()}/reference/${reference.slug}`);
        await prisma.reference.update({ where: { id: reference.id }, data: { qrCodeUrl: reference.qrCodeUrl } });
      }),
    ...designs
      .filter((design) => !design.qrCodeUrl)
      .map(async (design) => {
        design.qrCodeUrl = await QRCode.toDataURL(`${appUrl()}/design/${design.id}`);
        await prisma.design.update({ where: { id: design.id }, data: { qrCodeUrl: design.qrCodeUrl } });
      }),
  ]);

  res.json({
    references: references.map((reference) => ({
      ...reference,
      type: 'reference',
      publicPath: `/reference/${reference.slug}`,
    })),
    designs: designs.map((design) => ({
      ...design,
      type: 'design',
      publicPath: `/design/${design.id}`,
    })),
  });
});

export const regenerateQrCode = asyncHandler(async (req, res) => {
  const reference = await prisma.reference.findUnique({ where: { id: req.params.id } });
  if (!reference) return res.status(404).json({ message: 'Article introuvable' });

  const publicUrl = `${appUrl()}/reference/${reference.slug}`;
  const qrCodeUrl = await QRCode.toDataURL(publicUrl);
  const updated = await prisma.reference.update({ where: { id: reference.id }, data: { qrCodeUrl } });
  res.json(updated);
});

export const regenerateDesignQrCode = asyncHandler(async (req, res) => {
  const design = await prisma.design.findUnique({ where: { id: req.params.id } });
  if (!design) return res.status(404).json({ message: 'Design introuvable' });

  const publicUrl = `${appUrl()}/design/${design.id}`;
  const qrCodeUrl = await QRCode.toDataURL(publicUrl);
  const updated = await prisma.design.update({ where: { id: design.id }, data: { qrCodeUrl } });
  res.json(updated);
});
