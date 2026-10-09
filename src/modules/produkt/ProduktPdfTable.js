// ProduktPdfTable.js
// Tabellen im Produktblatt (Bilder, Varianten): Kopfzeile, Zeilen mit Bild-
// und Textzellen, Trennlinien. Eine Zeile bricht nie in der Mitte um; auf der
// neuen Seite steht die Kopfzeile wieder. Links in Zellen werden gekuerzt.

import { containInBox } from '../../core/pdf/PdfBrand.js';
import { imageFormat } from '../../core/pdf/pdfImage.js';
import { linkifyForPdf } from '../../core/pdf/pdfLinks.js';
import { stripNonWinAnsi } from '../../core/pdf/pdfWinAnsi.js';

const MARGIN_X = 14;
const TABLE_W = 182;
const PAD = 2;
const LINE = 4.2;
const TEXT_SIZE = 9;
const HEADER_H = 7;
const MIN_ROW_H = 10;
const RULE = [227, 224, 230];
const HEADER_FILL = [246, 244, 247];
const HEADER_TEXT = [92, 87, 98];

/** Zelle vermessen: Textzeilen (umgebrochen) und eingepasstes Bild. */
function measureCell(doc, cell, width, images) {
  const inner = width - PAD * 2;
  const image = cell.image ? images.get(cell.image.url) : null;
  const fit = image ? containInBox(image.width, image.height, inner, cell.image.maxH) : null;

  const lines = [];
  for (const line of cell.lines || []) {
    doc.setFont('helvetica', line.bold ? 'bold' : 'normal');
    doc.setFontSize(TEXT_SIZE);
    const { text, drawLine } = linkifyForPdf(line.text);
    for (const part of doc.splitTextToSize(stripNonWinAnsi(text), inner)) {
      lines.push({ text: part, bold: !!line.bold, drawLine });
    }
  }

  const height = Math.max(fit ? fit.h : 0, lines.length * LINE);
  return { image, fit, lines, height };
}

function measureRow(doc, row, widths, images) {
  const cells = row.map((cell, i) => measureCell(doc, cell, widths[i], images));
  const height = Math.max(MIN_ROW_H, Math.max(...cells.map(c => c.height)) + PAD * 2);
  return { cells, height };
}

function drawHeader(doc, writer, columns) {
  const y = writer.y;
  doc.setFillColor(...HEADER_FILL);
  doc.rect(MARGIN_X, y, TABLE_W, HEADER_H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...HEADER_TEXT);
  let x = MARGIN_X;
  for (const col of columns) {
    doc.text(stripNonWinAnsi(col.label).toUpperCase(), x + PAD, y + 4.7);
    x += col.w;
  }
  doc.setTextColor(0);
  writer.gap(HEADER_H);
}

function drawRow(doc, writer, row, widths) {
  const y = writer.y;
  let x = MARGIN_X;
  row.cells.forEach((cell, i) => {
    if (cell.fit) {
      const offsetY = (row.height - cell.fit.h) / 2;
      doc.addImage(cell.image.dataUrl, imageFormat(cell.image.dataUrl), x + PAD, y + offsetY, cell.fit.w, cell.fit.h, undefined, 'FAST');
    }
    cell.lines.forEach((line, n) => {
      doc.setFont('helvetica', line.bold ? 'bold' : 'normal');
      doc.setFontSize(TEXT_SIZE);
      doc.setTextColor(0);
      const baseline = y + PAD + LINE * 0.8 + n * LINE;
      if (line.drawLine) line.drawLine(doc, line.text, x + PAD, baseline);
      else doc.text(line.text, x + PAD, baseline);
    });
    x += widths[i];
  });
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, y + row.height, MARGIN_X + TABLE_W, y + row.height);
  writer.gap(row.height);
}

/**
 * @param {Object} doc - jsPDF
 * @param {{ ensure(mm: number): void, gap(mm: number): void, y: number }} writer
 * @param {{ columns: Array<{label: string, w: number}>, rows: Array<Array<Object>> }} table
 * @param {Map<string, {dataUrl: string, width: number, height: number}>} images
 */
export function drawTable(doc, writer, { columns, rows }, images) {
  const widths = columns.map(c => c.w);
  const measured = rows.map(row => measureRow(doc, row, widths, images));

  writer.ensure(HEADER_H + (measured[0]?.height || 0));
  drawHeader(doc, writer, columns);
  for (const row of measured) {
    const before = writer.y;
    writer.ensure(row.height);
    if (writer.y < before) drawHeader(doc, writer, columns);
    drawRow(doc, writer, row, widths);
  }
  writer.gap(5);
}

/** Alle Bild-URLs aus den Tabellen eines Modells, ohne Doppelte. */
export function tableImageUrls(model) {
  const urls = new Set();
  for (const section of model.sections) {
    for (const block of section.blocks) {
      if (block.type !== 'table') continue;
      for (const row of block.rows) {
        for (const cell of row) if (cell.image?.url) urls.add(cell.image.url);
      }
    }
  }
  return [...urls];
}
