import jsPDF from 'jspdf';
import 'jspdf-autotable';

const COMPANY = {
  name: 'Kenza Pro',
  tagline: 'Commerce produits textils',
  address: '0.42.Av Farhat Hached Sfax',
  phone: '+216 71 000 000',
  email: 'contact@curtain-erp.tn',
  rib: '47/002/0000000036342/94',
  mf: '1446836 W/B/M/000',
  bank: 'Wifak bank sfax majida boulila',
};

const ACCENT = '#0f3460';
const ACCENT_SOFT = '#eef2f8';
const RULE = '#cdd5df';
const INK = '#1a2230';
const MUTED = '#6b7785';

const money = (value) =>
  Number(value || 0)
    .toFixed(3)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const date = (value) => new Date(value || Date.now()).toLocaleDateString('fr-FR');

const formatArticleCode = (code) => {
  const digits = String(code ?? '').replace(/\D/g, '');
  if (!digits) return String(code ?? '');
  return String(Number(digits)).padStart(4, '0');
};

const unitPriceTtc = (unitPriceHt, tvaRate) =>
  Number(unitPriceHt || 0) * (1 + Number(tvaRate || 0) / 100);

const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

const underHundred = (n) => {
  if (n < 17) return units[n];
  if (n < 20) return `dix-${units[n - 10]}`;
  if (n < 70) return `${tens[Math.floor(n / 10)]}${n % 10 ? `-${units[n % 10]}` : ''}`;
  if (n < 80) return `soixante-${underHundred(n - 60)}`;
  return `quatre-vingt${n === 80 ? 's' : `-${underHundred(n - 80)}`}`;
};

const numberToWords = (n) => {
  if (n === 0) return 'zéro';
  if (n < 100) return underHundred(n);
  if (n < 1000)
    return `${n >= 200 ? `${units[Math.floor(n / 100)]} ` : ''}cent${n % 100 ? ` ${numberToWords(n % 100)}` : ''}`;
  if (n < 1000000)
    return `${Math.floor(n / 1000) === 1 ? 'mille' : `${numberToWords(Math.floor(n / 1000))} mille`}${
      n % 1000 ? ` ${numberToWords(n % 1000)}` : ''
    }`;
  return String(n);
};

const amountInFrench = (amount) => {
  const dinars = Math.floor(Number(amount || 0));
  const millimes = Math.round((Number(amount || 0) - dinars) * 1000);
  return `${numberToWords(dinars)} dinars${millimes ? ` et ${numberToWords(millimes)} millimes` : ''}`;
};

const drawHeader = (doc, { title, number, dateStr }) => {
  const pageW = doc.internal.pageSize.getWidth();
  const m = 20;

  doc.setFillColor(ACCENT);
  doc.rect(0, 0, pageW, 5, 'F');

  doc.setTextColor(ACCENT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(COMPANY.name, m, 20);

  doc.setTextColor(MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(COMPANY.tagline, m, 28);
  doc.text(COMPANY.address, m, 33);
  doc.text(`Tél : ${COMPANY.phone}   |   Email : ${COMPANY.email}`, m, 38);
  doc.text(`MF : ${COMPANY.mf}   |   BANK : ${COMPANY.bank}`, m, 43);

  const boxW = 90;
  const boxX = pageW - m - boxW;
  doc.setFillColor(ACCENT);
  doc.roundedRect(boxX, 12, boxW, 36, 2, 2, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, boxX + boxW / 2, 22, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`N° ${number}`, boxX + boxW / 2, 32, { align: 'center' });
  doc.text(`Date : ${dateStr}`, boxX + boxW / 2, 40, { align: 'center' });

  doc.setDrawColor(RULE);
  doc.setLineWidth(0.5);
  doc.line(m, 50, pageW - m, 50);

  return 56;
};

const drawCustomerBlock = (doc, document, yStart) => {
  const pageW = doc.internal.pageSize.getWidth();
  const m = 20;
  const colW = (pageW - 2 * m - 8) / 2;
  const innerX = m + 5;

  const fullName = document.customer?.fullName || document.customerName || 'Client de passage';
  const customerCode = document.customer?.customerCode ?? document.customerCode;
  const matricule = document.customer?.matriculeFiscale ?? document.matriculeFiscale;
  const phone = document.customer?.phone || document.customerPhone;
  const addr = document.customer?.address || document.customerAddress || document.deliveryAddress;

  const lines = [];
  if (customerCode != null) lines.push(`Code Client : ${String(customerCode).padStart(4, '0')}`);
  if (matricule) lines.push(`Matricule Fiscale : ${matricule}`);
  if (phone) lines.push(`Tél : ${phone}`);
  if (addr) lines.push(String(addr));

  const lineH = 5;
  const cardH = Math.max(40, 16 + lines.length * lineH + 6);

  doc.setFillColor(ACCENT_SOFT);
  doc.setDrawColor(RULE);
  doc.roundedRect(m, yStart, colW, cardH, 2, 2, 'FD');
  doc.setTextColor(ACCENT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CLIENT', innerX, yStart + 6);
  doc.setTextColor(INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(fullName, innerX, yStart + 14);
  doc.setTextColor(MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  lines.forEach((t, i) => doc.text(t, innerX, yStart + 22 + i * lineH));

  const x2 = m + colW + 8;
  doc.setFillColor('#ffffff');
  doc.setDrawColor(RULE);
  doc.roundedRect(x2, yStart, colW, cardH, 2, 2, 'FD');
  doc.setTextColor(ACCENT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('INFORMATIONS', x2 + 5, yStart + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const info = [
    ['Mode de règlement', 'Espèces / Virement'],
    ['Conditions', '30 jours'],
    ['Devise', 'Dinar Tunisien (TND)'],
  ];
  info.forEach(([k, v], i) => {
    const iy = yStart + 16 + i * 10;
    doc.setTextColor(MUTED);
    doc.text(k, x2 + 5, iy);
    doc.setTextColor(INK);
    doc.text(v, x2 + 65, iy);
  });

  return yStart + cardH + 8;
};

const drawTotalsBox = (doc, lines, y) => {
  const pageW = doc.internal.pageSize.getWidth();
  const m = 20;
  const boxW = 110;
  const boxX = pageW - m - boxW;
  const rowH = 8;
  const h = lines.length * rowH + 4;

  doc.setDrawColor(RULE);
  doc.setFillColor('#ffffff');
  doc.roundedRect(boxX, y, boxW, h, 2, 2, 'FD');

  lines.forEach((line, idx) => {
    const ly = y + 3 + idx * rowH;
    const isLast = idx === lines.length - 1;
    if (isLast) {
      doc.setFillColor(ACCENT);
      doc.rect(boxX, ly - 1, boxW, rowH, 'F');
      doc.setTextColor('#ffffff');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
    } else {
      doc.setTextColor(INK);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }
    doc.text(line[0], boxX + 5, ly + 3);
    doc.text(line[1], boxX + boxW - 5, ly + 3, { align: 'right' });
  });

  return y + h + 6;
};

const drawFooter = (doc, { signatures = ['Signature client', 'Signature & cachet société'] } = {}) => {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const m = 20;
  const fy = pageH - 55;

  const segW = (pageW - 2 * m) / signatures.length;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  signatures.forEach((label, i) => {
    doc.setTextColor(MUTED);
    doc.text(label, m + i * segW + segW / 2, fy, { align: 'center' });
    doc.setDrawColor(RULE);
    doc.setLineWidth(0.4);
    doc.line(m + i * segW + 10, fy + 22, m + i * segW + segW - 10, fy + 22);
  });

  doc.setDrawColor(RULE);
  doc.setLineWidth(0.3);
  doc.line(m, pageH - 16, pageW - m, pageH - 16);
  doc.setTextColor(MUTED);
  doc.setFontSize(7);
  doc.text(
    `${COMPANY.name}  •  ${COMPANY.address}  •  MF : ${COMPANY.mf}  •  RIB : ${COMPANY.rib}`,
    pageW / 2, pageH - 12, { align: 'center' },
  );
};

const flexWidths = (avail, flexFactors) => {
  const totalFlex = flexFactors.reduce((s, v) => s + v, 0);
  return flexFactors.map((f) => Math.round((f / totalFlex) * avail));
};

const autoTableStyles = {
  theme: 'grid',
  headStyles: { fillColor: ACCENT, textColor: '#ffffff', fontStyle: 'bold', fontSize: 7 },
  bodyStyles: { fontSize: 7, textColor: INK },
  alternateRowStyles: { fillColor: ACCENT_SOFT },
  margin: { left: 20, right: 20 },
  tableLineColor: RULE,
  tableLineWidth: 0.3,
  styles: { cellPadding: 2, overflow: 'linebreak', fontSize: 7 },
};

export const generateQuotationPdf = (quotation) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const y0 = drawHeader(doc, {
    title: 'DEVIS',
    number: quotation.quotationNumber,
    dateStr: date(quotation.createdAt),
  });
  let y = drawCustomerBlock(doc, quotation, y0 + 4);

  const columns = [
    { header: 'Code', dataKey: 'code' },
    { header: 'Désignation', dataKey: 'designation' },
    { header: 'Qté', dataKey: 'qty' },
    { header: 'UN', dataKey: 'unit' },
    { header: 'P.U HT', dataKey: 'puHt' },
    { header: 'TVA', dataKey: 'tva' },
    { header: 'P.U TTC', dataKey: 'puTtc' },
    { header: 'Mt HT', dataKey: 'totalHt' },
  ];

  const rows = (quotation.items || []).map((item) => ({
    code: formatArticleCode(item.articleCode),
    designation: item.designation,
    qty: Number(item.quantity).toLocaleString('fr-FR'),
    unit: item.unit,
    puHt: money(item.unitPriceHt),
    tva: `${Number(item.tvaRate).toFixed(0)}%`,
    puTtc: money(unitPriceTtc(item.unitPriceHt, item.tvaRate)),
    totalHt: money(item.totalHt),
  }));

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const availW = pageW - 2 * margin;
  const qColW = flexWidths(availW, [0.9, 3.4, 0.7, 0.6, 1.1, 0.7, 1.1, 1.2]);

  doc.autoTable({
    columns,
    body: rows,
    startY: y + 4,
    ...autoTableStyles,
    tableWidth: availW,
    columnStyles: {
      code: { cellWidth: qColW[0] },
      designation: { cellWidth: qColW[1] },
      qty: { cellWidth: qColW[2], halign: 'right' },
      unit: { cellWidth: qColW[3], halign: 'center' },
      puHt: { cellWidth: qColW[4], halign: 'right' },
      tva: { cellWidth: qColW[5], halign: 'right' },
      puTtc: { cellWidth: qColW[6], halign: 'right' },
      totalHt: { cellWidth: qColW[7], halign: 'right' },
    },
  });

  y = doc.lastAutoTable.finalY + 8;

  const totalRemise = (quotation.items || []).reduce(
    (s, i) => s + (Number(i.unitPriceHt) * Number(i.quantity) * (Number(i.remiseRate || 0) / 100)),
    0,
  );

  y = drawTotalsBox(doc, [
    ['Total brut HT', `${money(Number(quotation.totalHt) + totalRemise)} TND`],
    ['Total remise', `- ${money(totalRemise)} TND`],
    ['Total HT', `${money(quotation.totalHt)} TND`],
    ['Total TVA', `${money(quotation.totalTva)} TND`],
    ['Timbre fiscal', `${money(quotation.stampDuty)} TND`],
    ['Net à payer', `${money(quotation.netToPay)} TND`],
  ], y);

  const pageH = doc.internal.pageSize.getHeight();
  const footerStart = pageH - 75;

  if (y > footerStart) doc.addPage();

  doc.setTextColor(INK);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text(`Arrêté le présent devis à la somme de : ${amountInFrench(quotation.netToPay)}.`, margin, y + 4);

  if (quotation.notes) {
    doc.setTextColor(MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Notes : ${quotation.notes}`, margin, y + 14);
  }

  doc.setTextColor(MUTED);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.text("Devis valable 30 jours à compter de sa date d'émission.", margin, doc.internal.pageSize.getHeight() - 62);

  drawFooter(doc, { signatures: ['Bon pour accord (client)', 'Signature & cachet société'] });

  return doc;
};

export const generateDeliveryPdf = (delivery) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const y0 = drawHeader(doc, {
    title: 'BON DE LIVRAISON',
    number: delivery.deliveryNumber,
    dateStr: date(delivery.createdAt),
  });
  let y = drawCustomerBlock(doc, delivery, y0 + 4);

  const columns = [
    { header: 'Code', dataKey: 'code' },
    { header: 'Désignation', dataKey: 'designation' },
    { header: 'Qté', dataKey: 'qty' },
    { header: 'UN', dataKey: 'unit' },
  ];

  const rows = (delivery.items || []).map((item) => ({
    code: formatArticleCode(item.articleCode),
    designation: item.designation,
    qty: Number(item.quantity).toLocaleString('fr-FR'),
    unit: item.unit,
  }));

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const availW = pageW - 2 * margin;
  const dColW = flexWidths(availW, [1.0, 4.5, 0.8, 0.7]);

  doc.autoTable({
    columns,
    body: rows,
    startY: y + 4,
    ...autoTableStyles,
    tableWidth: availW,
    columnStyles: {
      code: { cellWidth: dColW[0] },
      designation: { cellWidth: dColW[1] },
      qty: { cellWidth: dColW[2], halign: 'right' },
      unit: { cellWidth: dColW[3], halign: 'center' },
    },
  });

  y = doc.lastAutoTable.finalY + 8;

  const quotationItems = delivery.quotation?.items || [];
  const enrichedItems = (delivery.items || []).map((dItem) => {
    const qItem = quotationItems.find((q) => q.articleCode === dItem.articleCode) || {};
    return {
      unitPriceHt: Number(qItem.unitPriceHt || 0),
      remiseRate: Number(qItem.remiseRate || 0),
      tvaRate: Number(qItem.tvaRate ?? 19),
      quantity: dItem.quantity,
      totalHt: Number(qItem.unitPriceHt || 0) * dItem.quantity * (1 - Number(qItem.remiseRate || 0) / 100),
    };
  });

  const totalHt = enrichedItems.reduce((s, i) => s + i.totalHt, 0);
  const totalTva = enrichedItems.reduce((s, i) => s + i.totalHt * (i.tvaRate / 100), 0);
  const totalRemise = enrichedItems.reduce(
    (s, i) => s + i.unitPriceHt * i.quantity * (i.remiseRate / 100),
    0,
  );
  const stampDuty = Number(delivery.quotation?.stampDuty ?? 1);
  const netToPay = totalHt + totalTva + stampDuty;

  y = drawTotalsBox(doc, [
    ['Total brut HT', `${money(totalHt + totalRemise)} TND`],
    ['Total remise', `- ${money(totalRemise)} TND`],
    ['Total HT', `${money(totalHt)} TND`],
    ['Total TVA', `${money(totalTva)} TND`],
    ['Timbre fiscal', `${money(stampDuty)} TND`],
    ['Net à payer', `${money(netToPay)} TND`],
  ], y);

  doc.setTextColor(INK);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text(`Arrêté le présent bon à la somme de : ${amountInFrench(netToPay)}.`, 20, y + 4);

  if (delivery.notes) {
    doc.setTextColor(MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Notes : ${delivery.notes}`, 20, y + 14);
  }

  drawFooter(doc);
  return doc;
};

export const generateInvoicePdf = (invoice) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const y0 = drawHeader(doc, {
    title: 'FACTURE',
    number: invoice.invoiceNumber,
    dateStr: date(invoice.createdAt),
  });
  let y = drawCustomerBlock(doc, invoice, y0 + 4);

  const columns = [
    { header: 'Code', dataKey: 'code' },
    { header: 'Désignation', dataKey: 'designation' },
    { header: 'Qté', dataKey: 'qty' },
    { header: 'UN', dataKey: 'unit' },
    { header: 'P.U HT', dataKey: 'puHt' },
    { header: 'TVA', dataKey: 'tva' },
    { header: 'P.U TTC', dataKey: 'puTtc' },
    { header: 'Mt HT', dataKey: 'totalHt' },
  ];

  const rows = (invoice.items || []).map((item) => ({
    code: formatArticleCode(item.articleCode),
    designation: item.designation,
    qty: Number(item.quantity).toLocaleString('fr-FR'),
    unit: item.unit,
    puHt: money(item.unitPriceHt),
    tva: `${Number(item.tvaRate ?? 19).toFixed(0)}%`,
    puTtc: money(item.unitPriceTtc || unitPriceTtc(item.unitPriceHt, item.tvaRate)),
    totalHt: money(item.totalHt),
  }));

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const availW = pageW - 2 * margin;
  const iColW = flexWidths(availW, [0.9, 3.4, 0.7, 0.6, 1.1, 0.7, 1.1, 1.2]);

  doc.autoTable({
    columns,
    body: rows,
    startY: y + 4,
    ...autoTableStyles,
    tableWidth: availW,
    columnStyles: {
      code: { cellWidth: iColW[0] },
      designation: { cellWidth: iColW[1] },
      qty: { cellWidth: iColW[2], halign: 'right' },
      unit: { cellWidth: iColW[3], halign: 'center' },
      puHt: { cellWidth: iColW[4], halign: 'right' },
      tva: { cellWidth: iColW[5], halign: 'right' },
      puTtc: { cellWidth: iColW[6], halign: 'right' },
      totalHt: { cellWidth: iColW[7], halign: 'right' },
    },
  });

  y = doc.lastAutoTable.finalY + 8;

  const totalRemise = (invoice.items || []).reduce(
    (s, i) => s + Number(i.unitPriceHt) * Number(i.quantity) * (Number(i.remiseRate || 0) / 100),
    0,
  );

  y = drawTotalsBox(doc, [
    ['Total brut HT', `${money(Number(invoice.totalHt) + totalRemise)} TND`],
    ['Total remise', `- ${money(totalRemise)} TND`],
    ['Total HT', `${money(invoice.totalHt)} TND`],
    ['Total TVA', `${money(invoice.totalTva)} TND`],
    ['Timbre fiscal', `${money(invoice.stampDuty)} TND`],
    ['NET À PAYER', `${money(invoice.netToPay)} TND`],
  ], y);

  const pageH = doc.internal.pageSize.getHeight();
  const footerStart = pageH - 75;

  if (y > footerStart) doc.addPage();

  doc.setTextColor(INK);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text(`Arrêtée la présente facture à la somme de : ${amountInFrench(invoice.netToPay)}.`, margin, y + 4);

  if (invoice.notes) {
    doc.setTextColor(MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Notes : ${invoice.notes}`, margin, y + 14);
  }
  if (invoice.mfNumber) {
    doc.setTextColor(MUTED);
    doc.setFontSize(7);
    doc.text(`MF client : ${invoice.mfNumber}`, margin, y + 22);
  }

  drawFooter(doc);
  return doc;
};
