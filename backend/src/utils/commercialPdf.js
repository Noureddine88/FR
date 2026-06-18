import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const storageRoot = path.resolve('storage', 'commercial');

// ─── Brand / company info ────────────────────────────────────────────────────
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

const ACCENT      = '#0f3460';
const ACCENT_SOFT = '#eef2f8';
const RULE        = '#cdd5df';
const INK         = '#1a2230';
const MUTED       = '#6b7785';

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

// ─── Number → French words ───────────────────────────────────────────────────
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

export const amountInFrench = (amount) => {
  const dinars   = Math.floor(Number(amount || 0));
  const millimes = Math.round((Number(amount || 0) - dinars) * 1000);
  return `${numberToWords(dinars)} dinars${millimes ? ` et ${numberToWords(millimes)} millimes` : ''}`;
};

// ─── Storage helpers ─────────────────────────────────────────────────────────
const ensureStorage = async () => {
  await fs.promises.mkdir(storageRoot, { recursive: true });
};

const writePdf = async (folder, filename, draw) => {
  await ensureStorage();
  const dir      = path.join(storageRoot, folder);
  await fs.promises.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: { Title: filename, Producer: COMPANY.name },
    });
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
    const stream = fs.createWriteStream(filePath);
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.pipe(stream);
    draw(doc);
    doc.end();
  });
  return filePath;
};

// ─── Layout constants ────────────────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M      = 40;          // horizontal margin

// ─── HEADER ──────────────────────────────────────────────────────────────────
// FIX: company left column width is now capped so it never bleeds into the
//      right title box.  Title box is 190 px wide; gap between columns is 12 px.
const TITLE_BOX_W  = 190;
const TITLE_BOX_X  = PAGE_W - M - TITLE_BOX_W;   // ≈ 365
const COMPANY_COL_W = TITLE_BOX_X - M - 12;       // usable left width ≈ 313

const drawHeader = (doc, { title, number, dateStr, statusText, statusColor, extraMeta = [] }) => {
  // Top accent bar
  doc.save();
  doc.rect(0, 0, PAGE_W, 6).fill(ACCENT);
  doc.restore();

  // ── Company block (left) – constrained to COMPANY_COL_W ──
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(18)
    .text(COMPANY.name, M, 22, { width: COMPANY_COL_W, lineBreak: false });

  doc.fillColor(MUTED).font('Helvetica').fontSize(8);
  doc.text(COMPANY.tagline, M, 44,  { width: COMPANY_COL_W, lineBreak: false });
  doc.text(COMPANY.address, M, 55,  { width: COMPANY_COL_W, lineBreak: false });
  // Split phone + email onto one line and MF + bank onto the next
  // so neither line exceeds the column width.
  doc.text(`Tél : ${COMPANY.phone}   |   Email : ${COMPANY.email}`,
           M, 66, { width: COMPANY_COL_W, lineBreak: false });
  doc.text(`MF : ${COMPANY.mf}   |   BANK : ${COMPANY.bank}`,
           M, 77, { width: COMPANY_COL_W, lineBreak: false });

  // ── Document title box (right) ──
  doc.save();
  doc.roundedRect(TITLE_BOX_X, 18, TITLE_BOX_W, 84, 4).fill(ACCENT);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20)
    .text(title, TITLE_BOX_X, 28, { width: TITLE_BOX_W, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(9)
    .text(`N° ${number}`, TITLE_BOX_X, 56, { width: TITLE_BOX_W, align: 'center', lineBreak: false })
    .text(`Date : ${dateStr}`, TITLE_BOX_X, 70, { width: TITLE_BOX_W, align: 'center', lineBreak: false });
  if (statusText) {
    doc.font('Helvetica-Bold').fontSize(8.5)
      .text(statusText, TITLE_BOX_X, 84, { width: TITLE_BOX_W, align: 'center', lineBreak: false });
  }
  doc.restore();

  // Separator
  doc.moveTo(M, 112).lineTo(PAGE_W - M, 112).strokeColor(RULE).lineWidth(0.6).stroke();

  if (statusColor && statusText) {
    doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(9).text(statusText, M, 118);
  }
  extraMeta.forEach((line, i) => {
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5)
      .text(line, M, 118 + (statusColor ? 14 : 0) + i * 12);
  });
};

// ─── CUSTOMER BLOCK ───────────────────────────────────────────────────────────
// FIX: the INFORMATIONS card now has proper column widths for key / value so
//      text never bleeds out of its card.
const drawCustomerBlock = (doc, document, yStart = 140) => {
  const colW   = (PAGE_W - 2 * M - 12) / 2;
  const innerX = M + 10;
  const textW  = colW - 20;

  const customerCode = document.customer?.customerCode ?? document.customerCode;
  const matricule    = document.customer?.matriculeFiscale ?? document.matriculeFiscale;
  const email        = document.customer?.email ?? document.email;
  const phone        = document.customer?.phone || document.customerPhone;
  const addr         = document.customer?.address || document.customerAddress || document.deliveryAddress;
  const fullName     = document.customer?.fullName || document.customerName || 'Client de passage';

  const lines = [];
  if (customerCode !== undefined && customerCode !== null)
    lines.push(`Code Client : ${String(customerCode).padStart(4, '0')}`);
  if (matricule) lines.push(`Matricule Fiscale : ${matricule}`);
  if (phone)     lines.push(`Tél : ${phone}`);
  if (email)     lines.push(`Email : ${email}`);
  if (addr)      lines.push(String(addr));

  // Measure heights
  doc.save();
  doc.font('Helvetica').fontSize(9).fillColor(MUTED);
  const nameHeight  = doc.heightOfString(fullName, { width: textW });
  const lineHeights = lines.map((t) => doc.heightOfString(t, { width: textW }));
  doc.restore();

  const linesHeight    = lineHeights.reduce((s, h) => s + h + 1, 0);
  const computedCardH  = Math.max(78, 40 + (nameHeight || 0) + 6 + linesHeight + 8);

  // ── CLIENT card ──
  doc.save();
  doc.roundedRect(M, yStart, colW, computedCardH, 3).fillAndStroke(ACCENT_SOFT, RULE);
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(9).text('CLIENT', innerX, yStart + 8);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11)
    .text(fullName, innerX, yStart + 22, { width: textW });

  doc.fillColor(MUTED).font('Helvetica').fontSize(9);
  let cy = yStart + 40;
  lines.forEach((t) => {
    doc.text(t, innerX, cy, { width: textW });
    cy += doc.heightOfString(t, { width: textW }) + 1;
  });
  doc.restore();

  // ── INFORMATIONS card ──
  // FIX: split card interior into a fixed label column (100 px) and a value
  //      column that fills the rest, both clipped to the card width.
  const x2      = M + colW + 12;
  const cardInnerW = colW - 20;          // usable interior width
  const labelW  = 100;                   // fixed label column
  const valueW  = cardInnerW - labelW;   // remaining width for value

  doc.save();
  doc.roundedRect(x2, yStart, colW, computedCardH, 3).fillAndStroke('#ffffff', RULE);
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(9)
    .text('INFORMATIONS', x2 + 10, yStart + 8);

  let iy = yStart + 22;
  const info = [
    ['Mode de règlement', document.paymentMethod || 'Espèces / Virement'],
    ['Conditions',        document.paymentTerms  || '30 jours'],
    ['Devise',            'Dinar Tunisien (TND)'],
  ];
  info.forEach(([k, v]) => {
    doc.fillColor(MUTED).font('Helvetica').fontSize(9)
      .text(k, x2 + 10, iy, { width: labelW, lineBreak: false });
    doc.fillColor(INK).font('Helvetica').fontSize(9)
      .text(v, x2 + 10 + labelW, iy, { width: valueW, lineBreak: false });
    iy += 14;
  });
  doc.restore();

  return yStart + computedCardH + 14;
};

// ─── ITEMS TABLE ──────────────────────────────────────────────────────────────
const drawItemsTable = (doc, columns, rows, yStart) => {
  const tableX      = M;
  const tableW      = PAGE_W - 2 * M;
  const totalFlex   = columns.reduce((s, c) => s + c.flex, 0);
  const colW        = columns.map((c) => (c.flex / totalFlex) * tableW);
  const padX        = 6;
  const padY        = 5;
  const minRowH     = 20;
  const footerReserve = 180;

  const drawTableHeader = (y) => {
    doc.save();
    doc.rect(tableX, y, tableW, 24).fill(ACCENT);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
    let x = tableX;
    columns.forEach((c, i) => {
      doc.text(c.label, x + padX, y + 8,
        { width: colW[i] - padX * 2, align: c.align || 'left', lineBreak: false });
      x += colW[i];
    });
    doc.restore();
    return y + 24;
  };

  let y = drawTableHeader(yStart);
  doc.font('Helvetica').fontSize(8.5).fillColor(INK);

  rows.forEach((row, ri) => {
    let maxCellH = minRowH;
    columns.forEach((c, i) => {
      const text   = String(row[i] ?? '');
      const cellH  = doc.heightOfString(text, { width: colW[i] - padX * 2 });
      maxCellH     = Math.max(maxCellH, cellH + padY * 2);
    });

    if (y + maxCellH > PAGE_H - footerReserve) {
      doc.addPage();
      y = drawTableHeader(M);
      doc.font('Helvetica').fontSize(8.5).fillColor(INK);
    }

    if (ri % 2 === 0) {
      doc.save().rect(tableX, y, tableW, maxCellH).fill(ACCENT_SOFT).restore();
    }

    let cx = tableX;
    columns.forEach((c, i) => {
      doc.fillColor(INK).text(String(row[i] ?? ''), cx + padX, y + padY, {
        width: colW[i] - padX * 2,
        align: c.align || 'left',
        lineGap: 1,
      });
      cx += colW[i];
    });

    doc.moveTo(tableX, y + maxCellH).lineTo(tableX + tableW, y + maxCellH)
       .strokeColor(RULE).lineWidth(0.3).stroke();
    y += maxCellH;
  });

  doc.rect(tableX, yStart, tableW, y - yStart).strokeColor(RULE).lineWidth(0.6).stroke();
  return y + 10;
};

// ─── TOTALS BOX ───────────────────────────────────────────────────────────────
// FIX: box is now 260 px wide (was 240) and the label/value split uses dynamic
//      column widths so neither side gets clipped.
const drawTotalsBox = (doc, lines, y) => {
  const boxW  = 265;                        // wider — prevents label clipping
  const boxX  = PAGE_W - M - boxW;
  const rowH  = 20;
  const h     = lines.length * rowH + 10;
  const labelW = 145;                       // fixed label column inside box
  const valueW = boxW - labelW - 20;        // remaining for value

  doc.save();
  doc.roundedRect(boxX, y, boxW, h, 3).fillAndStroke('#ffffff', RULE);

  let ly = y + 6;
  lines.forEach((line, idx) => {
    const isLast = idx === lines.length - 1;
    if (isLast) {
      doc.save().rect(boxX, ly - 2, boxW, rowH + 2).fill(ACCENT).restore();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10.5);
    } else {
      doc.fillColor(INK).font('Helvetica').fontSize(9.5);
    }
    // Label – left aligned inside box
    doc.text(line[0], boxX + 10, ly + 2, { width: labelW, lineBreak: false });
    // Value – right aligned
    doc.text(line[1], boxX + 10 + labelW, ly + 2, { width: valueW, align: 'right', lineBreak: false });
    ly += rowH;
  });
  doc.restore();
  return y + h + 10;
};

// ─── FOOTER ──────────────────────────────────────────────────────────────────
const drawFooter = (doc, { signatures = ['Signature client', 'Signature & cachet société'] } = {}) => {
  const fy   = PAGE_H - 90;
  const segW = (PAGE_W - 2 * M) / signatures.length;
  signatures.forEach((label, i) => {
    const sx = M + i * segW;
    doc.fillColor(MUTED).font('Helvetica').fontSize(9)
      .text(label, sx, fy, { width: segW, align: 'center', lineBreak: false });
    doc.moveTo(sx + 20, fy + 40).lineTo(sx + segW - 20, fy + 40)
       .strokeColor(RULE).lineWidth(0.5).stroke();
  });
  doc.moveTo(M, PAGE_H - 34).lineTo(PAGE_W - M, PAGE_H - 34)
     .strokeColor(RULE).lineWidth(0.4).stroke();
  doc.fillColor(MUTED).font('Helvetica').fontSize(7.5)
    .text(
      `${COMPANY.name}  •  ${COMPANY.address}  •  MF : ${COMPANY.mf}  •  RIB : ${COMPANY.rib}`,
      M, PAGE_H - 28, { width: PAGE_W - 2 * M, align: 'center', lineBreak: false },
    );
};

// ─── DEVIS ───────────────────────────────────────────────────────────────────
export const generateQuotationPdf = (quotation) =>
  writePdf('devis', `${quotation.quotationNumber}.pdf`, (doc) => {
    drawHeader(doc, {
      title:   'DEVIS',
      number:  quotation.quotationNumber,
      dateStr: date(quotation.createdAt),
    });
    const y0 = drawCustomerBlock(doc, quotation, 130);

    const columns = [
      { label: 'Code',       flex: 0.9 },
      { label: 'Désignation', flex: 3.4 },
      { label: 'Qté',        flex: 0.7, align: 'right' },
      { label: 'UN',         flex: 0.6, align: 'center' },
      { label: 'P.U HT',    flex: 1.1, align: 'right' },
      { label: 'TVA',        flex: 0.7, align: 'right' },
      { label: 'P.U TTC',   flex: 1.1, align: 'right' },
      { label: 'Montant HT', flex: 1.2, align: 'right' },
    ];
    const rows = quotation.items.map((item) => [
      formatArticleCode(item.articleCode),
      item.designation,
      Number(item.quantity).toLocaleString('fr-FR'),
      item.unit,
      money(item.unitPriceHt),
      `${Number(item.tvaRate).toFixed(0)}%`,
      money(unitPriceTtc(item.unitPriceHt, item.tvaRate)),
      money(item.totalHt),
    ]);
    let y = drawItemsTable(doc, columns, rows, y0);

    const totalRemise = (quotation.items || []).reduce(
      (s, i) => s + Number(i.unitPriceHt) * Number(i.quantity) * (Number(i.remiseRate || 0) / 100),
      0,
    );

    y = drawTotalsBox(doc, [
      ['Total brut HT', `${money(Number(quotation.totalHt) + totalRemise)} TND`],
      ['Total remise',  `- ${money(totalRemise)} TND`],
      ['Total HT',      `${money(quotation.totalHt)} TND`],
      ['Total TVA',     `${money(quotation.totalTva)} TND`],
      ['Timbre fiscal', `${money(quotation.stampDuty)} TND`],
      ['Net à payer',   `${money(quotation.netToPay)} TND`],
    ], y);

    doc.fillColor(INK).font('Helvetica-Oblique').fontSize(9)
      .text(`Arrêté le présent devis à la somme de : ${amountInFrench(quotation.netToPay)}.`,
            M, y, { width: PAGE_W - 2 * M });
    if (quotation.notes) {
      doc.moveDown(0.6);
      doc.fillColor(MUTED).font('Helvetica').fontSize(9)
        .text(`Notes : ${quotation.notes}`, { width: PAGE_W - 2 * M });
    }
    doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(8)
      .text("Devis valable 30 jours à compter de sa date d'émission.",
            M, PAGE_H - 130, { width: PAGE_W - 2 * M });

    drawFooter(doc, { signatures: ['Bon pour accord (client)', 'Signature & cachet société'] });
  });

// ─── BON DE LIVRAISON AVEC PRIX ──────────────────────────────────────────────
export const generateDeliveryPdf = (delivery) =>
  writePdf('bons-livraison', `${delivery.deliveryNumber}.pdf`, (doc) => {
    drawHeader(doc, {
      title:   'BON DE LIVRAISON',
      number:  delivery.deliveryNumber,
      dateStr: date(delivery.createdAt),
    });

    let y = drawCustomerBlock(doc, delivery, 130);

    const quotationItems = delivery.quotation?.items || [];
    const enrichedItems  = (delivery.items || []).map((dItem) => {
      const qItem = quotationItems.find((q) => q.articleCode === dItem.articleCode) || {};
      return {
        unitPriceHt: Number(qItem.unitPriceHt || 0),
        remiseRate:  Number(qItem.remiseRate   || 0),
        tvaRate:     Number(qItem.tvaRate      ?? 19),
        quantity:    dItem.quantity,
        totalHt:     Number(qItem.unitPriceHt || 0) * dItem.quantity * (1 - Number(qItem.remiseRate || 0) / 100),
      };
    });

    const columns = [
      { label: 'Code',        flex: 1.0 },
      { label: 'Désignation', flex: 4.5 },
      { label: 'Qté',         flex: 0.8, align: 'right' },
      { label: 'UN',          flex: 0.7, align: 'center' },
    ];
    const rows = (delivery.items || []).map((item) => [
      formatArticleCode(item.articleCode),
      item.designation,
      Number(item.quantity).toLocaleString('fr-FR'),
      item.unit,
    ]);
    y = drawItemsTable(doc, columns, rows, y);

    const totalHt     = enrichedItems.reduce((s, i) => s + i.totalHt, 0);
    const totalTva    = enrichedItems.reduce((s, i) => s + i.totalHt * (i.tvaRate / 100), 0);
    const totalRemise = enrichedItems.reduce((s, i) => s + i.unitPriceHt * i.quantity * (i.remiseRate / 100), 0);
    const stampDuty   = Number(delivery.quotation?.stampDuty ?? 1);
    const netToPay    = totalHt + totalTva + stampDuty;

    y = drawTotalsBox(doc, [
      ['Total brut HT', `${money(totalHt + totalRemise)} TND`],
      ['Total remise',  `- ${money(totalRemise)} TND`],
      ['Total HT',      `${money(totalHt)} TND`],
      ['Total TVA',     `${money(totalTva)} TND`],
      ['Timbre fiscal', `${money(stampDuty)} TND`],
      ['Net à payer',   `${money(netToPay)} TND`],
    ], y);

    doc.fillColor(INK).font('Helvetica-Oblique').fontSize(9)
      .text(`Arrêté le présent bon à la somme de : ${amountInFrench(netToPay)}.`,
            M, y, { width: PAGE_W - 2 * M });
    if (delivery.notes) {
      doc.moveDown(0.6);
      doc.fillColor(MUTED).font('Helvetica').fontSize(9)
        .text(`Notes : ${delivery.notes}`, { width: PAGE_W - 2 * M });
    }

    drawFooter(doc);
  });

// ─── FACTURE ─────────────────────────────────────────────────────────────────
export const generateInvoicePdf = (invoice) =>
  writePdf('factures', `${invoice.invoiceNumber}.pdf`, (doc) => {
    drawHeader(doc, {
      title:   'FACTURE',
      number:  invoice.invoiceNumber,
      dateStr: date(invoice.createdAt),
    });

    const y0 = drawCustomerBlock(doc, invoice, 130);

    const columns = [
      { label: 'Code',        flex: 0.9 },
      { label: 'Désignation', flex: 3.4 },
      { label: 'Qté',         flex: 0.7, align: 'right' },
      { label: 'UN',          flex: 0.6, align: 'center' },
      { label: 'P.U HT',     flex: 1.1, align: 'right' },
      { label: 'TVA',         flex: 0.7, align: 'right' },
      { label: 'P.U TTC',    flex: 1.1, align: 'right' },
      { label: 'Montant HT', flex: 1.2, align: 'right' },
    ];

    const rows = invoice.items.map((item) => [
      formatArticleCode(item.articleCode),
      item.designation,
      Number(item.quantity).toLocaleString('fr-FR'),
      item.unit,
      money(item.unitPriceHt),
      `${Number(item.tvaRate ?? 19).toFixed(0)}%`,
      money(item.unitPriceTtc || unitPriceTtc(item.unitPriceHt, item.tvaRate)),
      money(item.totalHt),
    ]);

    let y = drawItemsTable(doc, columns, rows, y0);

    const totalRemise = (invoice.items || []).reduce(
      (s, i) => s + Number(i.unitPriceHt) * Number(i.quantity) * (Number(i.remiseRate || 0) / 100),
      0,
    );

    y = drawTotalsBox(doc, [
      ['Total brut HT', `${money(Number(invoice.totalHt) + totalRemise)} TND`],
      ['Total remise',  `- ${money(totalRemise)} TND`],
      ['Total HT',      `${money(invoice.totalHt)} TND`],
      ['Total TVA',     `${money(invoice.totalTva)} TND`],
      ['Timbre fiscal', `${money(invoice.stampDuty)} TND`],
      ['NET À PAYER',   `${money(invoice.netToPay)} TND`],
    ], y);

    doc.fillColor(INK).font('Helvetica-Oblique').fontSize(9)
      .text(`Arrêtée la présente facture à la somme de : ${amountInFrench(invoice.netToPay)}.`,
            M, y, { width: PAGE_W - 2 * M });
    if (invoice.notes) {
      doc.moveDown(0.6);
      doc.fillColor(MUTED).font('Helvetica').fontSize(9)
        .text(`Notes : ${invoice.notes}`, { width: PAGE_W - 2 * M });
    }
    if (invoice.mfNumber) {
      doc.moveDown(0.4);
      doc.fillColor(MUTED).font('Helvetica').fontSize(9)
        .text(`MF client : ${invoice.mfNumber}`, { width: PAGE_W - 2 * M });
    }

    drawFooter(doc);
  });