import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await prisma.supplier.findMany({ include: { rolls: true }, orderBy: { createdAt: 'desc' } });
  res.json(
    suppliers.map((supplier) => ({
      ...supplier,
      deliveredRolls: supplier.rolls.length,
      purchasedMeters: supplier.rolls.reduce((sum, roll) => sum + roll.meters, 0),
      purchaseValue: supplier.rolls.reduce((sum, roll) => sum + roll.meters * roll.purchasePrice, 0),
    })),
  );
});

export const createSupplier = asyncHandler(async (req, res) => {
  const { companyName, contactPerson, phone, email, address, notes } = req.body;
  if (!companyName || !phone) return res.status(400).json({ message: 'Veuillez saisir le nom de la société et le téléphone' });
  const supplier = await prisma.supplier.create({ data: { companyName, contactPerson, phone, email, address, notes } });
  res.status(201).json(supplier);
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: req.body });
  res.json(supplier);
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  await prisma.supplier.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
