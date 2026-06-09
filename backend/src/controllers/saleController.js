import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { nextInvoiceNumber, recalculateColorTotals } from '../utils/stock.js';

export const listSales = asyncHandler(async (req, res) => {
  const sales = await prisma.sale.findMany({
    include: { customer: true, roll: { include: { color: { include: { design: { include: { reference: true } } } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(sales);
});

export const createSale = asyncHandler(async (req, res) => {
  const { customerId, customerName, rollId, metersSold, pricePerMeter } = req.body;
  const sold = Number(metersSold);
  const price = Number(pricePerMeter);
  if (!rollId || isNaN(sold) || sold <= 0 || isNaN(price) || price < 0) return res.status(400).json({ message: 'Veuillez sélectionner un rouleau, saisir le métrage vendu et le prix unitaire' });

  const sale = await prisma.$transaction(async (tx) => {
    const roll = await tx.roll.findUnique({ where: { id: rollId } });
    if (!roll) throw Object.assign(new Error('Le rouleau sélectionné n\'existe plus'), { statusCode: 404 });
    if (roll.remainingMeters < sold) throw Object.assign(new Error('Stock insuffisant : le rouleau ne contient que ' + roll.remainingMeters + ' mètres'), { statusCode: 400 });

    const created = await tx.sale.create({
      data: {
        invoiceNumber: await nextInvoiceNumber(tx),
        customerId: customerId || null,
        customerName: customerName || null,
        rollId,
        metersSold: sold,
        pricePerMeter: price,
        totalAmount: sold * price,
      },
    });
    await tx.roll.update({ where: { id: rollId }, data: { remainingMeters: { decrement: sold } } });
    await tx.stockMovement.create({ data: { type: 'SALE', quantity: sold, reason: `Facture ${created.invoiceNumber}`, rollId } });
    await recalculateColorTotals(roll.colorId, tx);
    return created;
  });

  res.status(201).json(sale);
});
