import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ─── COMPANY CONFIG ───────────────────────────────────────────────────────────
const COMPANY = {
  name:    'Kenza Pro',
  tagline: 'Commerce produits textils',
  address: '0.42.Av Farhat Hached Sfax',
  phone:   '+216 71 000 000',
  email:   'contact@curtain-erp.tn',
  rib:     '47/002/0000000036342/94',
  mf:      '1446836 W/B/M/000',
  bank:    'Wifak bank sfax majida boulila',
};

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const COLOR = {
  accent:      '#0f3460',
  accentSoft:  '#eef2f8',
  accentLight: '#dce6f5',
  rule:        '#cdd5df',
  ink:         '#1a2230',
  muted:       '#6b7785',
  white:       '#ffffff',
};

// ─── LAYOUT CONSTANTS ─────────────────────────────────────────────────────────
const PAGE_W      = 595.28;
const PAGE_H      = 841.89;
const MARGIN      = 20;
const CONTENT_W   = PAGE_W - 2 * MARGIN;
const FOOTER_H    = 58;   // reserved at bottom of every page
const HEADER_H    = 57;   // header block height on page 1
const CONT_HEAD_H = 28;   // slim continuation banner on page 2+
const MIN_ROW_H   = 14;   // minimum space to keep together

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const money = (v) =>
  Number(v || 0)
    .toFixed(3)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const fmt = {
  date: (v) => new Date(v || Date.now()).toLocaleDateString('fr-FR'),
  code: (c) => {
    const d = String(c ?? '').replace(/\D/g, '');
    return d ? String(Number(d)).padStart(4, '0') : String(c ?? '');
  },
  pct:  (r) => `${Number(r ?? 0).toFixed(0)}%`,
  qty:  (q) => Number(q).toLocaleString('fr-FR'),
};

const unitPriceTtc = (ht, tva) => Number(ht || 0) * (1 + Number(tva || 0) / 100);

// ─── AMOUNT IN FRENCH WORDS ───────────────────────────────────────────────────
const UNITS = ['','un','deux','trois','quatre','cinq','six','sept','huit','neuf',
               'dix','onze','douze','treize','quatorze','quinze','seize'];
const TENS  = ['','','vingt','trente','quarante','cinquante','soixante'];

const sub100 = (n) => {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${UNITS[n % 10]}` : ''}`;
  if (n < 80) return `soixante-${sub100(n - 60)}`;
  return `quatre-vingt${n === 80 ? 's' : `-${sub100(n - 80)}`}`;
};

const toWords = (n) => {
  if (n === 0) return 'zéro';
  if (n < 100) return sub100(n);
  if (n < 1000) return `${n >= 200 ? `${UNITS[Math.floor(n / 100)]} ` : ''}cent${n % 100 ? ` ${toWords(n % 100)}` : ''}`;
  if (n < 1_000_000)
    return `${Math.floor(n / 1000) === 1 ? 'mille' : `${toWords(Math.floor(n / 1000))} mille`}${n % 1000 ? ` ${toWords(n % 1000)}` : ''}`;
  return String(n);
};

const amountWords = (amount) => {
  const d = Math.floor(Number(amount || 0));
  const m = Math.round((Number(amount || 0) - d) * 1000);
  return `${toWords(d)} dinars${m ? ` et ${toWords(m)} millimes` : ''}`;
};

// ─── FLEX COLUMN WIDTHS ───────────────────────────────────────────────────────
const flexWidths = (total, factors) => {
  const sum = factors.reduce((a, b) => a + b, 0);
  return factors.map((f) => Math.round((f / sum) * total));
};

// ─── FONT HELPERS ─────────────────────────────────────────────────────────────
const setFont = (doc, size, style = 'normal', color = COLOR.ink) => {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(color);
};

// ─── PAGE MANAGER ─────────────────────────────────────────────────────────────
/**
 * Tracks current Y position, handles multi-page documents.
 * drawContinuationHeader is called at top of each new page.
 */
class PageManager {
  constructor(doc, docTitle, docNumber) {
    this.doc      = doc;
    this.title    = docTitle;
    this.number   = docNumber;
    this.y        = HEADER_H;
    this.pageNum  = 1;
  }

  /** Available vertical space on current page */
  available() {
    return PAGE_H - FOOTER_H - this.y;
  }

  /** Ensure `needed` pt of vertical space; adds page if not enough */
  need(needed) {
    if (this.available() >= needed) return;
    this.addPage();
  }

  addPage() {
    this.doc.addPage();
    this.pageNum++;
    this._drawContinuationBanner();
    this.y = CONT_HEAD_H + 6;
  }

  _drawContinuationBanner() {
    const doc = this.doc;
    // Slim top bar
    doc.setFillColor(COLOR.accent);
    doc.rect(0, 0, PAGE_W, 3, 'F');
    // Company name left
    setFont(doc, 9, 'bold', COLOR.accent);
    doc.text(COMPANY.name, MARGIN, 15);
    // Doc badge right
    const badge = `${this.title}  •  N° ${this.number}  •  suite`;
    setFont(doc, 7.5, 'normal', COLOR.muted);
    doc.text(badge, PAGE_W - MARGIN, 15, { align: 'right' });
    // Rule
    doc.setDrawColor(COLOR.rule);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, CONT_HEAD_H - 2, PAGE_W - MARGIN, CONT_HEAD_H - 2);
  }
}

// ─── HEADER (page 1) ─────────────────────────────────────────────────────────
const drawHeader = (doc, { title, number, dateStr }) => {
  const badgeW = 160;
  const badgeX = PAGE_W - MARGIN - badgeW;
  const infoW  = badgeX - MARGIN - 8;

  // Top accent bar
  doc.setFillColor(COLOR.accent);
  doc.rect(0, 0, PAGE_W, 4, 'F');

  // Company block
  setFont(doc, 15, 'bold', COLOR.accent);
  doc.text(COMPANY.name, MARGIN, 18, { maxWidth: infoW });

  setFont(doc, 7.5, 'normal', COLOR.muted);
  const companyLines = [
    COMPANY.tagline,
    COMPANY.address,
    `Tél : ${COMPANY.phone}   |   Email : ${COMPANY.email}`,
    `MF : ${COMPANY.mf}`,
    `BANK : ${COMPANY.bank}`,
  ];
  let cy = 26;
  companyLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, infoW);
    doc.text(wrapped, MARGIN, cy, { maxWidth: infoW });
    cy += wrapped.length * 8.5;
  });

  // Document badge
  doc.setFillColor(COLOR.accent);
  doc.roundedRect(badgeX, 8, badgeW, 40, 2, 2, 'F');

  setFont(doc, 14, 'bold', COLOR.white);
  doc.text(title, badgeX + badgeW / 2, 21, { align: 'center', maxWidth: badgeW - 8 });

  setFont(doc, 8, 'normal', COLOR.white);
  doc.text(`N° ${number}`,      badgeX + badgeW / 2, 31, { align: 'center', maxWidth: badgeW - 8 });
  doc.text(`Date : ${dateStr}`, badgeX + badgeW / 2, 40, { align: 'center', maxWidth: badgeW - 8 });

  // Divider
  doc.setDrawColor(COLOR.rule);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 52, PAGE_W - MARGIN, 52);
};

// ─── CUSTOMER BLOCK ───────────────────────────────────────────────────────────
/**
 * Fully dynamic height: wraps long addresses, handles missing fields gracefully.
 * Returns new Y after the block.
 */
const drawCustomerBlock = (pm, document) => {
  const doc    = pm.doc;
  const gap    = 8;
  const colW   = (CONTENT_W - gap) / 2;
  const inner  = colW - 10;
  const x1     = MARGIN;
  const x2     = MARGIN + colW + gap;

  // Collect customer data
  const fullName = document.customer?.fullName || document.customerName || 'Client de passage';
  const custCode = document.customer?.customerCode ?? document.customerCode;
  const mf       = document.customer?.matriculeFiscale ?? document.matriculeFiscale;
  const phone    = document.customer?.phone || document.customerPhone;
  const addr     = document.customer?.address || document.customerAddress || document.deliveryAddress;

  const detailLines = [
    custCode != null ? `Code Client : ${String(custCode).padStart(4, '0')}` : null,
    mf       ? `Matricule Fiscale : ${mf}` : null,
    phone    ? `Tél : ${phone}` : null,
    addr     ? String(addr) : null,
  ].filter(Boolean);

  // Measure heights
  setFont(doc, 10, 'bold');
  const nameWrapped = doc.splitTextToSize(fullName, inner);
  const nameH       = nameWrapped.length * 13;

  setFont(doc, 8, 'normal');
  const LINE_GAP = 10;
  const detailH  = detailLines.reduce((sum, line) => {
    return sum + doc.splitTextToSize(line, inner).length * LINE_GAP + 1;
  }, 0);

  const cardH = Math.max(52, 20 + nameH + 6 + detailH + 8);

  // Info panel rows
  const infoRows = [
    ['Mode de règlement', document.paymentMethod || 'Espèces / Virement'],
    ['Conditions',        document.paymentTerms  || '30 jours'],
    ['Devise',            'Dinar Tunisien (TND)'],
  ];
  if (document.mfNumber)   infoRows.push(['MF Client', document.mfNumber]);
  if (document.reference)  infoRows.push(['Référence', document.reference]);

  const infoRowH = 12;
  const infoCardH = Math.max(cardH, 20 + infoRows.length * infoRowH + 8);
  const finalCardH = Math.max(cardH, infoCardH);

  pm.need(finalCardH + 12);
  const y = pm.y;

  // ── Left card (client) ──
  doc.setFillColor(COLOR.accentSoft);
  doc.setDrawColor(COLOR.rule);
  doc.setLineWidth(0.3);
  doc.roundedRect(x1, y, colW, finalCardH, 2, 2, 'FD');

  setFont(doc, 7.5, 'bold', COLOR.accent);
  doc.text('CLIENT', x1 + 5, y + 8);

  setFont(doc, 10, 'bold', COLOR.ink);
  doc.text(nameWrapped, x1 + 5, y + 18, { maxWidth: inner });

  setFont(doc, 7.5, 'normal', COLOR.muted);
  let ky = y + 18 + nameH + 4;
  detailLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, inner);
    doc.text(wrapped, x1 + 5, ky, { maxWidth: inner });
    ky += wrapped.length * LINE_GAP + 1;
  });

  // ── Right card (info) ──
  const labelW = 70;
  const valueW = inner - labelW - 4;

  doc.setFillColor(COLOR.white);
  doc.setDrawColor(COLOR.rule);
  doc.roundedRect(x2, y, colW, finalCardH, 2, 2, 'FD');

  setFont(doc, 7.5, 'bold', COLOR.accent);
  doc.text('INFORMATIONS', x2 + 5, y + 8);

  infoRows.forEach(([label, value], i) => {
    const iy = y + 18 + i * infoRowH;
    // Alternating subtle stripe
    if (i % 2 === 1) {
      doc.setFillColor(COLOR.accentSoft);
      doc.rect(x2 + 1, iy - 3, colW - 2, infoRowH, 'F');
    }
    setFont(doc, 7.5, 'normal', COLOR.muted);
    doc.text(label, x2 + 5, iy + 5, { maxWidth: labelW });
    setFont(doc, 7.5, 'normal', COLOR.ink);
    const valWrapped = doc.splitTextToSize(value, valueW);
    doc.text(valWrapped, x2 + 5 + labelW + 4, iy + 5, { maxWidth: valueW });
  });

  pm.y = y + finalCardH + 10;
};

// ─── ITEMS TABLE ──────────────────────────────────────────────────────────────
const drawTable = (pm, columns, flexFactors, rows) => {
  const doc   = pm.doc;
  const colW  = flexWidths(CONTENT_W, flexFactors);
  const colStyles = {};
  columns.forEach((c, i) => {
    colStyles[c.dataKey] = { cellWidth: colW[i], ...(c.align ? { halign: c.align } : {}) };
  });

  doc.autoTable({
    columns,
    body: rows,
    startY: pm.y,
    theme: 'grid',
    headStyles: {
      fillColor:  COLOR.accent,
      textColor:  COLOR.white,
      fontStyle:  'bold',
      fontSize:   7,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize:    7,
      textColor:   COLOR.ink,
      cellPadding: 2.5,
      lineColor:   COLOR.rule,
      lineWidth:   0.25,
    },
    alternateRowStyles: { fillColor: COLOR.accentSoft },
    margin:           { left: MARGIN, right: MARGIN },
    tableLineColor:   COLOR.rule,
    tableLineWidth:   0.3,
    tableWidth:       CONTENT_W,
    columnStyles:     colStyles,
    styles:           { overflow: 'linebreak', fontSize: 7 },
    // Keep heading on each page
    showHead: 'everyPage',
    // autoTable handles its own page breaks — sync pm.y after
    didAddPage: () => {
      pm.pageNum++;
      pm._drawContinuationBanner?.();
    },
  });

  pm.y = doc.lastAutoTable.finalY + 8;
};

// ─── TOTALS BOX ───────────────────────────────────────────────────────────────
const drawTotalsBox = (pm, rows) => {
  const doc    = pm.doc;
  const boxW   = 175;
  const boxX   = PAGE_W - MARGIN - boxW;
  const rowH   = 11;
  const padTop = 4;
  const h      = padTop + rows.length * rowH + 4;
  const labelW = 95;
  const valueW = boxW - labelW - 10;

  pm.need(h + 8);
  const y = pm.y;

  doc.setFillColor(COLOR.white);
  doc.setDrawColor(COLOR.rule);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, y, boxW, h, 2, 2, 'FD');

  rows.forEach((row, idx) => {
    const ly     = y + padTop + idx * rowH;
    const isLast = idx === rows.length - 1;

    if (isLast) {
      doc.setFillColor(COLOR.accent);
      doc.rect(boxX, ly, boxW, rowH + 2, 'F');
      setFont(doc, 9, 'bold', COLOR.white);
    } else {
      // Alternating tint on non-last rows
      if (idx % 2 === 0) {
        doc.setFillColor(COLOR.accentSoft);
        doc.rect(boxX + 0.5, ly, boxW - 1, rowH, 'F');
      }
      setFont(doc, 7.5, 'normal', COLOR.ink);
    }

    doc.text(row[0], boxX + 5,      ly + 7.5, { maxWidth: labelW });
    doc.text(row[1], boxX + boxW - 5, ly + 7.5, { align: 'right', maxWidth: valueW });
  });

  pm.y = y + h + 8;
};

// ─── AMOUNT IN WORDS ─────────────────────────────────────────────────────────
const drawAmountWords = (pm, amount, prefix) => {
  const doc  = pm.doc;
  const text = `${prefix} ${amountWords(amount)}.`;
  setFont(doc, 8, 'italic', COLOR.ink);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  pm.need(lines.length * 10 + 6);
  doc.text(lines, MARGIN, pm.y + 4, { maxWidth: CONTENT_W });
  pm.y += lines.length * 10 + 6;
};

// ─── NOTES ───────────────────────────────────────────────────────────────────
const drawNotes = (pm, notes) => {
  if (!notes) return;
  const doc   = pm.doc;
  const label = 'Notes :';
  setFont(doc, 7.5, 'bold', COLOR.muted);
  const body    = doc.splitTextToSize(notes, CONTENT_W - 30);
  const blockH  = body.length * 9.5 + 16;
  pm.need(blockH + 4);

  doc.setFillColor(COLOR.accentSoft);
  doc.setDrawColor(COLOR.rule);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, pm.y, CONTENT_W, blockH - 4, 2, 2, 'FD');

  doc.text(label, MARGIN + 5, pm.y + 9);
  setFont(doc, 7.5, 'normal', COLOR.ink);
  doc.text(body, MARGIN + 5, pm.y + 18, { maxWidth: CONTENT_W - 10 });

  pm.y += blockH + 4;
};

// ─── VALIDITY LINE ────────────────────────────────────────────────────────────
const drawValidity = (pm, text) => {
  const doc  = pm.doc;
  setFont(doc, 6.5, 'italic', COLOR.muted);
  pm.need(12);
  doc.text(text, MARGIN, pm.y + 4, { maxWidth: CONTENT_W });
  pm.y += 12;
};

// ─── FOOTER (all pages) ───────────────────────────────────────────────────────
const drawFooter = (doc, opts = {}) => {
  const sigs = opts.signatures || ['Signature client', 'Signature & cachet société'];
  const pageCount = doc.internal.getNumberOfPages();

  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const fy  = PAGE_H - 52;
    const segW = CONTENT_W / sigs.length;

    sigs.forEach((label, i) => {
      setFont(doc, 7.5, 'normal', COLOR.muted);
      const cx = MARGIN + i * segW + segW / 2;
      doc.text(label, cx, fy, { align: 'center' });
      doc.setDrawColor(COLOR.rule);
      doc.setLineWidth(0.4);
      doc.line(MARGIN + i * segW + 12, fy + 20, MARGIN + (i + 1) * segW - 12, fy + 20);
    });

    // Page numbers (only multi-page)
    if (pageCount > 1) {
      setFont(doc, 6.5, 'normal', COLOR.muted);
      doc.text(`${p} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 18, { align: 'right' });
    }

    // Bottom rule + footer text
    doc.setDrawColor(COLOR.rule);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
    setFont(doc, 6.5, 'normal', COLOR.muted);
    doc.text(
      `${COMPANY.name}  •  ${COMPANY.address}  •  MF : ${COMPANY.mf}  •  RIB : ${COMPANY.rib}`,
      PAGE_W / 2, PAGE_H - 10, { align: 'center' },
    );
  }
};

// ─── AUTOTABLE PAGE SYNC HELPER ───────────────────────────────────────────────
/**
 * autoTable manages its own page breaks internally; after it runs we must
 * make sure the PageManager's page count matches the PDF's real page count.
 */
const syncPages = (pm) => {
  const realPages = pm.doc.internal.getNumberOfPages();
  if (realPages > pm.pageNum) {
    pm.pageNum = realPages;
    pm.doc.setPage(pm.pageNum);
  }
};

// ─── DEVIS ───────────────────────────────────────────────────────────────────
export const generateQuotationPdf = (quotation) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  drawHeader(doc, {
    title:   'DEVIS',
    number:  quotation.quotationNumber,
    dateStr: fmt.date(quotation.createdAt),
  });

  const pm = new PageManager(doc, 'DEVIS', quotation.quotationNumber);
  pm.y += 4;
  drawCustomerBlock(pm, quotation);

  const columns = [
    { header: 'Code',        dataKey: 'code' },
    { header: 'Désignation', dataKey: 'designation' },
    { header: 'Qté',         dataKey: 'qty',     align: 'right' },
    { header: 'UN',          dataKey: 'unit',    align: 'center' },
    { header: 'P.U HT',     dataKey: 'puHt',    align: 'right' },
    { header: 'Remise',      dataKey: 'remise',  align: 'right' },
    { header: 'TVA',         dataKey: 'tva',     align: 'right' },
    { header: 'P.U TTC',    dataKey: 'puTtc',   align: 'right' },
    { header: 'Mt HT',       dataKey: 'totalHt', align: 'right' },
  ];

  // Only show remise column if any item has a discount
  const hasRemise = (quotation.items || []).some((i) => Number(i.remiseRate || 0) > 0);
  const usedCols  = hasRemise ? columns : columns.filter((c) => c.dataKey !== 'remise');
  const flexBase  = hasRemise
    ? [0.9, 3.2, 0.65, 0.55, 1.0, 0.75, 0.65, 1.0, 1.1]
    : [0.9, 3.7, 0.7, 0.6, 1.1, 0.7, 1.1, 1.2];

  drawTable(pm, usedCols, flexBase,
    (quotation.items || []).map((item) => ({
      code:        fmt.code(item.articleCode),
      designation: item.designation,
      qty:         fmt.qty(item.quantity),
      unit:        item.unit,
      puHt:        money(item.unitPriceHt),
      remise:      hasRemise ? fmt.pct(item.remiseRate) : undefined,
      tva:         fmt.pct(item.tvaRate),
      puTtc:       money(unitPriceTtc(item.unitPriceHt, item.tvaRate)),
      totalHt:     money(item.totalHt),
    })),
  );
  syncPages(pm);

  const totalRemise = (quotation.items || []).reduce(
    (s, i) => s + Number(i.unitPriceHt) * Number(i.quantity) * (Number(i.remiseRate || 0) / 100), 0);

  const totalRows = [
    ['Total brut HT', `${money(Number(quotation.totalHt) + totalRemise)} TND`],
    ...(totalRemise ? [['Total remise', `- ${money(totalRemise)} TND`]] : []),
    ['Total HT',      `${money(quotation.totalHt)} TND`],
    ['Total TVA',     `${money(quotation.totalTva)} TND`],
    ['Timbre fiscal', `${money(quotation.stampDuty)} TND`],
    ['Net à payer',   `${money(quotation.netToPay)} TND`],
  ];
  drawTotalsBox(pm, totalRows);
  drawAmountWords(pm, quotation.netToPay, 'Arrêté le présent devis à la somme de :');
  drawNotes(pm, quotation.notes);
  drawValidity(pm, "Devis valable 30 jours à compter de sa date d'émission.");

  drawFooter(doc);
  return doc;
};

// ─── BON DE LIVRAISON ────────────────────────────────────────────────────────
export const generateDeliveryPdf = (delivery) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  drawHeader(doc, {
    title:   'BON DE LIVRAISON',
    number:  delivery.deliveryNumber,
    dateStr: fmt.date(delivery.createdAt),
  });

  const pm = new PageManager(doc, 'BON DE LIVRAISON', delivery.deliveryNumber);
  pm.y += 4;
  drawCustomerBlock(pm, delivery);

  const columns = [
    { header: 'Code',        dataKey: 'code' },
    { header: 'Désignation', dataKey: 'designation' },
    { header: 'Qté',         dataKey: 'qty',  align: 'right' },
    { header: 'UN',          dataKey: 'unit', align: 'center' },
  ];

  drawTable(pm, columns, [1.0, 4.8, 0.8, 0.65],
    (delivery.items || []).map((item) => ({
      code:        fmt.code(item.articleCode),
      designation: item.designation,
      qty:         fmt.qty(item.quantity),
      unit:        item.unit,
    })),
  );
  syncPages(pm);

  // Compute totals from linked quotation items
  const qItems = delivery.quotation?.items || [];
  const enriched = (delivery.items || []).map((dItem) => {
    const q = qItems.find((qi) => qi.articleCode === dItem.articleCode) || {};
    const ht = Number(q.unitPriceHt || 0) * dItem.quantity * (1 - Number(q.remiseRate || 0) / 100);
    return {
      unitPriceHt: Number(q.unitPriceHt || 0),
      remiseRate:  Number(q.remiseRate   || 0),
      tvaRate:     Number(q.tvaRate      ?? 19),
      quantity:    dItem.quantity,
      totalHt:     ht,
    };
  });

  const totalHt     = enriched.reduce((s, i) => s + i.totalHt, 0);
  const totalTva    = enriched.reduce((s, i) => s + i.totalHt * (i.tvaRate / 100), 0);
  const totalRemise = enriched.reduce((s, i) => s + i.unitPriceHt * i.quantity * (i.remiseRate / 100), 0);
  const stampDuty   = Number(delivery.quotation?.stampDuty ?? 1);
  const netToPay    = totalHt + totalTva + stampDuty;

  const totalRows = [
    ['Total brut HT', `${money(totalHt + totalRemise)} TND`],
    ...(totalRemise ? [['Total remise', `- ${money(totalRemise)} TND`]] : []),
    ['Total HT',      `${money(totalHt)} TND`],
    ['Total TVA',     `${money(totalTva)} TND`],
    ['Timbre fiscal', `${money(stampDuty)} TND`],
    ['Net à payer',   `${money(netToPay)} TND`],
  ];
  drawTotalsBox(pm, totalRows);
  drawAmountWords(pm, netToPay, 'Arrêté le présent bon à la somme de :');
  drawNotes(pm, delivery.notes);

  drawFooter(doc);
  return doc;
};

// ─── FACTURE ─────────────────────────────────────────────────────────────────
export const generateInvoicePdf = (invoice) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  drawHeader(doc, {
    title:   'FACTURE',
    number:  invoice.invoiceNumber,
    dateStr: fmt.date(invoice.createdAt),
  });

  const pm = new PageManager(doc, 'FACTURE', invoice.invoiceNumber);
  pm.y += 4;
  drawCustomerBlock(pm, invoice);

  const hasRemise = (invoice.items || []).some((i) => Number(i.remiseRate || 0) > 0);
  const columns   = [
    { header: 'Code',        dataKey: 'code' },
    { header: 'Désignation', dataKey: 'designation' },
    { header: 'Qté',         dataKey: 'qty',     align: 'right' },
    { header: 'UN',          dataKey: 'unit',    align: 'center' },
    { header: 'P.U HT',     dataKey: 'puHt',    align: 'right' },
    { header: 'Remise',      dataKey: 'remise',  align: 'right' },
    { header: 'TVA',         dataKey: 'tva',     align: 'right' },
    { header: 'P.U TTC',    dataKey: 'puTtc',   align: 'right' },
    { header: 'Mt HT',       dataKey: 'totalHt', align: 'right' },
  ];
  const usedCols = hasRemise ? columns : columns.filter((c) => c.dataKey !== 'remise');
  const flexBase = hasRemise
    ? [0.9, 3.2, 0.65, 0.55, 1.0, 0.75, 0.65, 1.0, 1.1]
    : [0.9, 3.7, 0.7, 0.6, 1.1, 0.7, 1.1, 1.2];

  drawTable(pm, usedCols, flexBase,
    (invoice.items || []).map((item) => ({
      code:        fmt.code(item.articleCode),
      designation: item.designation,
      qty:         fmt.qty(item.quantity),
      unit:        item.unit,
      puHt:        money(item.unitPriceHt),
      remise:      hasRemise ? fmt.pct(item.remiseRate) : undefined,
      tva:         fmt.pct(item.tvaRate ?? 19),
      puTtc:       money(item.unitPriceTtc || unitPriceTtc(item.unitPriceHt, item.tvaRate)),
      totalHt:     money(item.totalHt),
    })),
  );
  syncPages(pm);

  const totalRemise = (invoice.items || []).reduce(
    (s, i) => s + Number(i.unitPriceHt) * Number(i.quantity) * (Number(i.remiseRate || 0) / 100), 0);

  const totalRows = [
    ['Total brut HT', `${money(Number(invoice.totalHt) + totalRemise)} TND`],
    ...(totalRemise ? [['Total remise', `- ${money(totalRemise)} TND`]] : []),
    ['Total HT',      `${money(invoice.totalHt)} TND`],
    ['Total TVA',     `${money(invoice.totalTva)} TND`],
    ['Timbre fiscal', `${money(invoice.stampDuty)} TND`],
    ['NET À PAYER',   `${money(invoice.netToPay)} TND`],
  ];
  drawTotalsBox(pm, totalRows);
  drawAmountWords(pm, invoice.netToPay, 'Arrêtée la présente facture à la somme de :');
  drawNotes(pm, invoice.notes);

  drawFooter(doc);
  return doc;
};