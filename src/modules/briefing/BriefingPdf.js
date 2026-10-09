// BriefingPdf.js
// Anschreiben-PDF aus dem Briefing-Modell — gleicher Stack wie die
// Vertrags-PDFs: jsPDF-Text + PdfTextFlow, kein HTML-Raster.

import { buildBriefingPdfModel } from './BriefingDocView.js';
import { ensureSpace, renderPaginatedText } from '../../core/pdf/PdfTextFlow.js';
import { loadJsPdf } from '../../core/pdf/loadJsPdf.js';
import { loadCustomerLogoPng, toPdfImageDataUrl } from '../../core/pdf/pdfImage.js';
import { drawLockup } from '../../core/pdf/pdfLockup.js';
import {
  loadLikeGroupLogoPng,
  drawLikeGroupFooter,
} from '../../core/pdf/PdfBrand.js';

const MARGIN_X = 14;
const MAX_WIDTH = 182;
const START_Y_FIRST = 40;
const START_Y = 20;
const MAX_CONTENT_Y = 272;

function sanitizeFilename(name) {
  const base = String(name || 'Briefing')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${base || 'Briefing'}.pdf`;
}

function customerLogoUrl(briefing) {
  return briefing?.marke?.logo_url || briefing?.unternehmen?.logo_url || '';
}

function customerDisplayName(briefing) {
  return briefing?.marke?.markenname || briefing?.unternehmen?.firmenname || '';
}

function flowOpts(y, onPageBreak, lineHeight = 5) {
  return {
    x: MARGIN_X,
    y,
    maxWidth: MAX_WIDTH,
    lineHeight,
    maxContentY: MAX_CONTENT_Y,
    onPageBreak,
  };
}

/**
 * Baut das PDF-Blob fuer ein geladenes Briefing-Detail.
 * @param {Object} detail - BriefingDetail-Instanz (briefing, formatValue, escape, formatDate)
 * @returns {Promise<{ blob: Blob, dateiname: string }>}
 */
export async function createBriefingPdf(detail) {
  if (!detail?.briefing) throw new Error('Kein Briefing geladen');

  const jsPDF = await loadJsPdf();
  const [model, logoPng, customerRaw] = await Promise.all([
    Promise.resolve(buildBriefingPdfModel(detail)),
    loadLikeGroupLogoPng(),
    loadCustomerLogoPng(customerLogoUrl(detail.briefing)),
  ]);
  const customerImage = customerRaw ? await toPdfImageDataUrl(customerRaw) : null;
  const doc = new jsPDF();
  doc.setFont('helvetica');
  drawLockup(doc, logoPng, customerImage, {
    customerName: customerDisplayName(detail.briefing),
  });

  let pageNumber = 1;
  const addFooter = () => {
    drawLikeGroupFooter(doc, { page: pageNumber });
    pageNumber += 1;
  };

  const onPageBreak = () => {
    addFooter();
    doc.addPage();
    return START_Y;
  };

  let y = START_Y_FIRST;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  y = renderPaginatedText(doc, model.title, flowOpts(y, onPageBreak, 7));
  y += 2;

  if (model.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    y = renderPaginatedText(doc, model.subtitle, flowOpts(y, onPageBreak, 5.5));
    y += 1;
  }
  if (model.products) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y = renderPaginatedText(doc, model.products, flowOpts(y, onPageBreak));
  }
  if (model.meta) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80);
    y = renderPaginatedText(doc, model.meta, flowOpts(y, onPageBreak, 4.5));
    doc.setTextColor(0);
  }
  y += 4;

  for (const section of model.sections) {
    if (section.title) {
      y = ensureSpace(y + 4, 12, MAX_CONTENT_Y, onPageBreak);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      y = renderPaginatedText(doc, section.title, flowOpts(y, onPageBreak, 6));
      y += 2;
    }
    for (const block of section.blocks) {
      if (block.type === 'spec') {
        y = ensureSpace(y + 1, 10, MAX_CONTENT_Y, onPageBreak);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        y = renderPaginatedText(doc, block.label, flowOpts(y, onPageBreak, 4.5));
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y = renderPaginatedText(doc, block.text, flowOpts(y, onPageBreak));
        y += 2;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y = renderPaginatedText(doc, block.text, flowOpts(y, onPageBreak));
        y += 3;
      }
    }
  }

  addFooter();

  return {
    blob: doc.output('blob'),
    dateiname: sanitizeFilename(model.title),
  };
}

/** PDF im neuen Tab oeffnen (Vorschau vor dem Senden). */
export function openPdfInTab(blob) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return win;
}
