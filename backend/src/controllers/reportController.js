import PDFDocument from 'pdfkit';
import XLSX from 'xlsx';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const dashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [references, designs, colors, rolls, stock, salesAggregate, salesCount, recentSales, movements, lowColors, quotations, acceptedQuotations, deliveryNotes, deliveryNotesDraft, deliveryNotesAccepted, invoices, invoiceRevenue] =
    await Promise.all([
      prisma.reference.count(),
      prisma.design.count(),
      prisma.color.count(),
      prisma.roll.count(),
      prisma.roll.aggregate({ _sum: { remainingMeters: true } }),
      prisma.sale.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { totalAmount: true, metersSold: true } }),
      prisma.sale.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.sale.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { customer: true, roll: true } }),
      prisma.stockMovement.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { roll: true } }),
      prisma.color.findMany({
        where: { totalMeters: { lt: 50 } },
        take: 10,
        orderBy: { totalMeters: 'asc' },
        include: { design: { include: { reference: true } } },
      }),
      prisma.quotation.count(),
      prisma.quotation.count({ where: { status: 'ACCEPTED' } }),
      prisma.deliveryNote.count(),
      prisma.deliveryNote.count({ where: { status: 'DRAFT' } }),
      prisma.deliveryNote.count({ where: { status: 'ACCEPTED' } }),
      prisma.invoice.count(),
      prisma.invoice.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { netToPay: true } }),
    ]);

  res.json({
    totals: {
      references,
      designs,
      colors,
      rolls,
      inventoryStock: stock._sum.remainingMeters || 0,
      monthlyRevenue: salesAggregate._sum.totalAmount || 0,
      monthlyMetersSold: salesAggregate._sum.metersSold || 0,
      monthlySales: salesCount,
      quotations,
      acceptedQuotations,
      deliveryNotes,
      deliveryNotesDraft,
      deliveryNotesAccepted,
      invoices,
      commercialRevenue: invoiceRevenue._sum.netToPay || 0,
    },
    alerts: lowColors,
    recentSales,
    recentStockMovements: movements,
  });
});

const reportQueries = {
  inventory: () =>
    prisma.reference.findMany({
      include: { designs: { include: { colors: { include: { rolls: { include: { supplier: true } } } } } } },
    }),
  sales: () => prisma.sale.findMany({ include: { customer: true, roll: true }, orderBy: { createdAt: 'desc' } }),
  revenue: () => prisma.sale.findMany({ include: { customer: true, roll: true }, orderBy: { createdAt: 'desc' } }),
  customers: () => prisma.customer.findMany({ include: { sales: true } }),
  suppliers: () => prisma.supplier.findMany({ include: { rolls: true } }),
  lowStock: () => prisma.color.findMany({ where: { totalMeters: { lt: 50 } }, include: { design: { include: { reference: true } } } }),
  deliveryNotes: () => prisma.deliveryNote.findMany({ include: { customer: true, quotation: true, items: true, invoice: true }, orderBy: { createdAt: 'desc' } }),
  quotations: () => prisma.quotation.findMany({ include: { customer: true, items: true, deliveryNote: true }, orderBy: { createdAt: 'desc' } }),
  invoices: () => prisma.invoice.findMany({ include: { customer: true, deliveryNote: true, items: true }, orderBy: { createdAt: 'desc' } }),
};

const reportTitles = {
  inventory: 'Inventaire',
  sales: 'Ventes',
  revenue: "Chiffre d'affaires",
  customers: 'Clients',
  suppliers: 'Fournisseurs',
  lowStock: 'Stock limité',
  deliveryNotes: 'Bons de livraison',
  quotations: 'Devis',
  invoices: 'Factures',
};

const formatDate = (date) => (date ? new Date(date).toLocaleString('fr-FR') : '');
const number = (value) => Number(value || 0);

const quotationStatusLabel = (status) => {
  const labels = { DRAFT: 'Brouillon', SENT: 'Envoyé', ACCEPTED: 'Accepté', REJECTED: 'Rejeté', EXPIRED: 'Expiré' };
  return labels[status] || status;
};

const paymentStatusLabel = (status) => {
  const labels = { PAID: 'Payée', PARTIALLY_PAID: 'Partiellement payée', UNPAID: 'Non payée' };
  return labels[status] || status;
};

const reportFormatters = {
  inventory: (references) =>
    references.flatMap((reference) =>
      reference.designs.flatMap((design) =>
        design.colors.flatMap((color) => {
          if (color.rolls.length === 0) {
            return [
              {
                Référence: reference.name,
                Design: design.name,
                Couleur: color.displayName || color.code,
                Statut: color.status,
                'Code article': '',
                'Mètres initiaux': '',
                'Mètres restants': number(color.totalMeters),
                'Prix achat': '',
                'Prix vente': '',
                Fournisseur: '',
              },
            ];
          }
          return color.rolls.map((roll) => ({
            Référence: reference.name,
            Design: design.name,
            Couleur: color.displayName || color.code,
            Statut: color.status,
            'Code article': String(roll.articleCode ?? '').padStart(4, '0'),
            'Mètres initiaux': number(roll.meters),
            'Mètres restants': number(roll.remainingMeters),
            'Prix achat': number(roll.purchasePrice),
            'Prix vente': number(roll.sellingPrice),
            Fournisseur: roll.supplier?.companyName || '',
          }));
        }),
      ),
    ),
  sales: (sales) =>
    sales.map((sale) => ({
      Facture: sale.invoiceNumber,
      Date: formatDate(sale.createdAt),
      Client: sale.customer?.fullName || sale.customerName || 'Client de passage',
      Article: sale.roll?.articleCode ? String(sale.roll.articleCode).padStart(4, '0') : '',
      'Mètres vendus': number(sale.metersSold),
      'Prix par mètre': number(sale.pricePerMeter),
      Total: number(sale.totalAmount),
    })),
  revenue: (sales) =>
    sales.map((sale) => ({
      Date: formatDate(sale.createdAt),
      Facture: sale.invoiceNumber,
      Client: sale.customer?.fullName || sale.customerName || 'Client de passage',
      'Mètres vendus': number(sale.metersSold),
      Recette: number(sale.totalAmount),
    })),
  customers: (customers) =>
    customers.map((customer) => ({
      Client: customer.fullName,
      Téléphone: customer.phone,
      Email: customer.email || '',
      Adresse: customer.address || '',
      Factures: customer.sales.length,
      'Total dépensé': customer.sales.reduce((sum, sale) => sum + number(sale.totalAmount), 0),
    })),
  suppliers: (suppliers) =>
    suppliers.map((supplier) => ({
      Fournisseur: supplier.companyName,
      Contact: supplier.contactPerson || '',
      Téléphone: supplier.phone,
      Email: supplier.email || '',
      Rouleaux: supplier.rolls.length,
      'Mètres achetés': supplier.rolls.reduce((sum, roll) => sum + number(roll.meters), 0),
      'Valeur achat': supplier.rolls.reduce((sum, roll) => sum + number(roll.meters) * number(roll.purchasePrice), 0),
    })),
  lowStock: (colors) =>
    colors.map((color) => ({
      Référence: color.design?.reference?.name || '',
      Design: color.design?.name || '',
      Couleur: color.displayName || color.code,
      'Mètres restants': number(color.totalMeters),
      Statut: color.status,
    })),
  deliveryNotes: (notes) =>
    notes.map((note) => ({
      'N° BL': note.deliveryNumber,
      Client: note.customer?.fullName || note.customerName || 'Client de passage',
      Statut: note.status === 'ACCEPTED' ? 'Accepté' : 'Brouillon',
      'Date création': formatDate(note.createdAt),
      'Date acceptation': note.acceptedAt ? formatDate(note.acceptedAt) : '',
      'Quantité totale': number(note.totalQuantity),
      'N° Devis': note.quotation?.quotationNumber || '',
      'N° Facture': note.invoice?.invoiceNumber || '',
    })),
  quotations: (quotations) =>
    quotations.map((q) => ({
      'N° Devis': q.quotationNumber,
      Client: q.customer?.fullName || q.customerName || 'Client de passage',
      Statut: quotationStatusLabel(q.status),
      'Total HT': number(q.totalHt),
      'Net à payer': number(q.netToPay),
      'Date': formatDate(q.createdAt),
      'BL généré': q.deliveryNote ? q.deliveryNote.deliveryNumber : '',
    })),
  invoices: (invoices) =>
    invoices.map((inv) => ({
      'N° Facture': inv.invoiceNumber,
      Client: inv.customer?.fullName || inv.customerName || 'Client de passage',
      Paiement: paymentStatusLabel(inv.paymentStatus),
      'Total HT': number(inv.totalHt),
      'Net à payer': number(inv.netToPay),
      'Date': formatDate(inv.createdAt),
      'N° BL': inv.deliveryNote?.deliveryNumber || '',
    })),
};

const buildReport = async (type) => {
  const loader = reportQueries[type];
  if (!loader) return null;
  const rows = reportFormatters[type](await loader());
  return {
    type,
    title: reportTitles[type],
    columns: rows.length ? Object.keys(rows[0]) : [],
    rows,
  };
};

export const getReport = asyncHandler(async (req, res) => {
  const report = await buildReport(req.params.type || 'inventory');
  if (!report) return res.status(404).json({ message: 'Type de rapport inconnu. Veuillez sélectionner un rapport valide.' });
  res.json(report);
});

export const exportXlsx = asyncHandler(async (req, res) => {
  const report = await buildReport(req.params.type);
  if (!report) return res.status(404).json({ message: 'Type de rapport inconnu. Veuillez sélectionner un rapport valide.' });

  const rows = report.rows.length ? report.rows : [{ Message: 'Aucun enregistrement' }];
  const sheet = XLSX.utils.json_to_sheet(rows);
  const widths = Object.keys(rows[0]).map((key) => ({
    wch: Math.max(key.length, ...rows.map((row) => String(row[key] ?? '').length), 12),
  }));
  sheet['!cols'] = widths;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, report.title.slice(0, 31));
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}_rapport.xlsx"`);
  res.send(buffer);
});

export const exportPdf = asyncHandler(async (req, res) => {
  const report = await buildReport(req.params.type);
  if (!report) return res.status(404).json({ message: 'Type de rapport inconnu. Veuillez sélectionner un rapport valide.' });

  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: report.columns.length > 6 ? 'landscape' : 'portrait' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}_rapport.pdf"`);
  doc.pipe(res);
  doc.fontSize(18).text(`Rapport ${report.title}`);
  doc.fontSize(9).fillColor('#555').text(`Généré le ${formatDate(new Date())}`);
  doc.moveDown(1.2);

  const columns = report.columns.slice(0, 8);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = pageWidth / Math.max(columns.length, 1);
  const padX = 4;
  const padY = 3;
  const minRowH = 18;

  const drawRow = (row, y, isHeader = false) => {
    const rowH = isHeader ? minRowH : Math.max(minRowH, ...columns.map((column, index) => {
      const text = isHeader ? column : String(row[column] ?? '');
      return doc.heightOfString(text, { width: colWidth - padX * 2 }) + padY * 2;
    }));
    columns.forEach((column, index) => {
      const x = doc.page.margins.left + index * colWidth;
      doc
        .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(isHeader ? 7 : 6.5)
        .fillColor(isHeader ? '#172026' : '#263238')
        .text(isHeader ? column : String(row[column] ?? ''), x + padX, y + padY, { width: colWidth - padX * 2, align: typeof report.rows[0]?.[column] === 'number' ? 'right' : 'left' });
    });
    return rowH;
  };

  let y = doc.y;
  y += drawRow(Object.fromEntries(columns.map((column) => [column, column])), y, true);
  report.rows.slice(0, 120).forEach((row) => {
    const rowH = drawRow(row, y);
    if (y + rowH > doc.page.height - doc.page.margins.bottom - minRowH) {
      doc.addPage();
      y = doc.page.margins.top;
      y += drawRow(Object.fromEntries(columns.map((column) => [column, column])), y, true);
      const rowH2 = drawRow(row, y);
      y += rowH2;
    } else {
      y += rowH;
    }
  });
  if (report.rows.length > 120) {
    doc.moveDown().fontSize(8).text(`Rapport limité aux 120 premières lignes sur ${report.rows.length}.`);
  }
  doc.end();
});
