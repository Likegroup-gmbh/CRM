// ProduktPdf.js
// Produktblatt als echtes PDF: jsPDF-Text (markier- und durchsuchbar) plus
// eingebettete JPEGs fuer Logo und Bilder. Kein HTML-Raster, kein Screenshot.
// Der Inhalt kommt fertig aus ProduktPdfModel.js, Tabellen zeichnet
// ProduktPdfTable.js. URLs im Text werden zu kurzen, anklickbaren Bezeichnungen.

import { ensureSpace, renderPaginatedText } from '../../core/pdf/PdfTextFlow.js';
import { loadJsPdf } from '../../core/pdf/loadJsPdf.js';
import { loadCustomerLogoPng, toPdfImageDataUrl } from '../../core/pdf/pdfImage.js';
import { drawLockup } from '../../core/pdf/pdfLockup.js';
import { linkifyForPdf } from '../../core/pdf/pdfLinks.js';
import { stripNonWinAnsi } from '../../core/pdf/pdfWinAnsi.js';
import { loadLikeGroupLogoPng, drawLikeGroupFooter } from '../../core/pdf/PdfBrand.js';
import { drawTable, tableImageUrls } from './ProduktPdfTable.js';

const MARGIN_X = 14;
const MAX_WIDTH = 182;
const START_Y_FIRST = 40;
const START_Y = 20;
const MAX_CONTENT_Y = 272;
const BILD_MAX_EDGE = 600;
const BULLET_INDENT = 3;

/**
 * Schreibcursor ueber dem jsPDF-Dokument: haelt y und Seitenzahl, bricht um
 * und setzt vor dem Umbruch die Fusszeile.
 */
function createWriter(doc) {
  let y = START_Y_FIRST;
  let page = 1;

  const onPageBreak = () => {
    drawLikeGroupFooter(doc, { page });
    doc.addPage();
    page += 1;
    return START_Y;
  };

  return {
    get y() { return y; },

    gap(mm) { y += mm; },

    /** Mindestplatz sichern, damit Ueberschriften nicht allein am Seitenende stehen. */
    ensure(needed) { y = ensureSpace(y, needed, MAX_CONTENT_Y, onPageBreak); },

    write(text, { size = 10, style = 'normal', lineHeight = 5, indent = 0, gray = 0, after = 0 } = {}) {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(gray);
      const { text: kurz, drawLine } = linkifyForPdf(text);
      y = renderPaginatedText(doc, stripNonWinAnsi(kurz), {
        x: MARGIN_X + indent,
        y,
        maxWidth: MAX_WIDTH - indent,
        lineHeight,
        maxContentY: MAX_CONTENT_Y,
        onPageBreak,
        drawLine,
      });
      doc.setTextColor(0);
      y += after;
    },

    finish() { drawLikeGroupFooter(doc, { page }); },
  };
}

/** URL -> JPEG-Daten; Bilder, die sich nicht laden lassen, fehlen in der Map. */
async function loadImages(urls) {
  const entries = await Promise.all(urls.map(async (url) => {
    const raw = await loadCustomerLogoPng(url);
    const image = raw ? await toPdfImageDataUrl(raw, { maxEdge: BILD_MAX_EDGE }) : null;
    return image ? [url, image] : null;
  }));
  return new Map(entries.filter(Boolean));
}

function drawBlock(doc, writer, block, images) {
  switch (block.type) {
    case 'spec':
      writer.ensure(block.text ? 10 : 6);
      writer.write(block.label, { size: block.text ? 9 : 10, style: 'bold', lineHeight: 4.5 });
      if (block.text) writer.write(block.text, { after: 2 });
      else writer.gap(1);
      break;
    case 'list':
      writer.ensure(10);
      writer.write(block.label, { size: 9, style: 'bold', lineHeight: 4.5 });
      block.items.forEach((item) => writer.write(`• ${item}`, { indent: BULLET_INDENT }));
      writer.gap(2);
      break;
    case 'table':
      drawTable(doc, writer, block, images);
      break;
    default:
      writer.write(block.text, { after: 3 });
  }
}

function drawHeader(writer, model) {
  writer.write(model.title, { size: 16, style: 'bold', lineHeight: 7, after: 2 });
  if (model.subtitle) writer.write(model.subtitle, { size: 11, lineHeight: 5.5, after: 1 });
  if (model.meta) writer.write(model.meta, { size: 9, lineHeight: 4.5, gray: 80 });
  writer.gap(4);
}

/**
 * Baut das PDF fuer ein Produkt-Modell.
 * @param {ReturnType<import('./ProduktPdfModel.js').buildProduktPdfModel>} model
 * @returns {Promise<{ blob: Blob, dateiname: string }>}
 */
export async function createProduktPdf(model) {
  if (!model?.title) throw new Error('Kein Produkt zum Exportieren');

  const jsPDF = await loadJsPdf();
  const [logoPng, customerRaw, images] = await Promise.all([
    loadLikeGroupLogoPng(),
    loadCustomerLogoPng(model.customerLogoUrl),
    loadImages(tableImageUrls(model)),
  ]);
  const customerImage = customerRaw ? await toPdfImageDataUrl(customerRaw) : null;

  const doc = new jsPDF();
  doc.setFont('helvetica');
  drawLockup(doc, logoPng, customerImage, { customerName: stripNonWinAnsi(model.customerName) });

  const writer = createWriter(doc);
  drawHeader(writer, model);

  for (const section of model.sections) {
    writer.gap(2);
    // Tabellen brauchen Platz fuer Kopf und erste Zeile, sonst steht die Ueberschrift allein.
    writer.ensure(section.blocks[0]?.type === 'table' ? 50 : 14);
    writer.write(section.title, { size: 12, style: 'bold', lineHeight: 6, after: 2 });
    section.blocks.forEach((block) => drawBlock(doc, writer, block, images));
  }

  writer.finish();
  return { blob: doc.output('blob'), dateiname: model.dateiname };
}
