import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listCustomers = asyncHandler(async (req, res) => {
  const search = req.query.search?.trim();

  const customers = await prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { matriculeFiscale: { contains: search, mode: 'insensitive' } },
            { customerCode: isNaN(Number(search)) ? undefined : { equals: Number(search) } },
          ].filter(Boolean),
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
  });

  res.json(customers);
});


export const createCustomer = asyncHandler(async (req, res) => {
  const { fullName, phone, email, address, matriculeFiscale, notes } = req.body;
  if (!fullName || !phone) return res.status(400).json({ message: 'Veuillez saisir le nom complet et le téléphone du client' });

  const max = await prisma.customer.aggregate({ _max: { customerCode: true } });
  const nextCode = (max._max.customerCode ?? -1) + 1;

  const customer = await prisma.customer.create({
    data: {
      customerCode: nextCode,
      fullName,
      phone,
      email,
      address,
      matriculeFiscale,
      notes,
    },
  });

  res.status(201).json(customer);
});

export const updateCustomer = asyncHandler(async (req, res) => {
  // customerCode is auto-generated and cannot be edited
  const { customerCode, ...data } = req.body;
  const customer = await prisma.customer.update({ where: { id: req.params.id }, data });
  res.json(customer);
});

export const searchCustomers = asyncHandler(async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.json([]);

  const results = await prisma.customer.findMany({
    where: {
      OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { customerCode: isNaN(Number(q)) ? undefined : { equals: Number(q) } },
      ].filter(Boolean),
    },
    orderBy: { customerCode: 'asc' },
    take: 12,
  });

  res.json(
    results.map((c) => ({
      id: c.id,
      customerId: c.id,
      customerCode: c.customerCode,
      fullName: c.fullName,
      phone: c.phone,
      email: c.email,
      address: c.address,
      matriculeFiscale: c.matriculeFiscale,
    })),
  );
});


export const deleteCustomer = asyncHandler(async (req, res) => {
  await prisma.customer.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
