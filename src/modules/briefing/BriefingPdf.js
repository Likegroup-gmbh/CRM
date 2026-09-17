// BriefingPdf.js
// Anschreiben-PDF aus dem Briefing-Modell — gleicher Stack wie die
// Vertrags-PDFs: jsPDF-Text + PdfTextFlow, kein HTML-Raster.

import { buildBriefingPdfModel } from './BriefingDocView.js';
import { ensureSpace, renderPaginatedText } from '../vertrag/create/pdf/PdfTextFlow.js';
import {
  loadLikeGroupLogoPng,
  drawLikeGroupLogo,
  drawLikeGroupFooter,
  PDF_BRAND,
} from '../../core/pdf/PdfBrand.js';

export const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

const MARGIN_X = 14;
const MAX_WIDTH = 182;
const START_Y_FIRST = 40;
const START_Y = 20;
const MAX_CONTENT_Y = 272;

let jsPdfPromise = null;

function loadCdnScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('PDF-Bibliothek konnte nicht geladen werden'));
    document.head.appendChild(script);
  });
}

function ensureJsPdf() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!jsPdfPromise) {
    jsPdfPromise = loadCdnScript(JSPDF_URL).then(() => {
      const ctor = window.jspdf?.jsPDF;
      if (!ctor) throw new Error('jsPDF ohne jsPDF-Export geladen');
      return ctor;
    }).catch((err) => {
      jsPdfPromise = null;
      throw err;
    });
  }
  return jsPdfPromise;
}

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

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Logo konnte nicht gelesen werden'));
    reader.readAsDataURL(blob);
  });
}

/** PNG/JPEG-Data-URL des Kundenlogos oder null (kein URL, CORS, Tests). */
export async function loadCustomerLogoPng(url) {
  if (!url || typeof fetch !== 'function') return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const type = blob.type || '';
    if (type.includes('svg') || type === 'image/svg+xml') return null;
    const dataUrl = await blobToDataUrl(blob);
    return typeof dataUrl === 'string' && dataUrl.startsWith('data:image/') ? dataUrl : null;
  } catch {
    return null;
  }
}

function imageFormat(dataUrl) {
  if (String(dataUrl).startsWith('data:image/jpeg')) return 'JPEG';
  if (String(dataUrl).startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
}

export function drawBriefingLockup(doc, likeGroupPng, customerPng, { customerName = '' } = {}) {
  drawLikeGroupLogo(doc, likeGroupPng, { align: 'left' });
  const { x, y, w, h } = PDF_BRAND.logoLeft;
  const markX = x + w + 3;
  const baseline = y + h * 0.72;
  if (typeof doc.setFont === 'function') doc.setFont('helvetica', 'normal');
  if (typeof doc.setFontSize === 'function') doc.setFontSize(11);
  if (typeof doc.setTextColor === 'function') doc.setTextColor(120);
  doc.text('×', markX, baseline);
  if (typeof doc.setTextColor === 'function') doc.setTextColor(0);
  const customerX = markX + 5;
  if (customerPng && doc.addImage) {
    doc.addImage(customerPng, imageFormat(customerPng), customerX, y, w, h);
    return;
  }
  if (customerName) {
    if (typeof doc.setFontSize === 'function') doc.setFontSize(9);
    doc.text(customerName, customerX, baseline);
  }
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

  const jsPDF = await ensureJsPdf();
  const [model, logoPng, customerPng] = await Promise.all([
    Promise.resolve(buildBriefingPdfModel(detail)),
    loadLikeGroupLogoPng(),
    loadCustomerLogoPng(customerLogoUrl(detail.briefing)),
  ]);
  const doc = new jsPDF();
  doc.setFont('helvetica');
  drawBriefingLockup(doc, logoPng, customerPng, {
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
