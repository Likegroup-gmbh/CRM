// BriefingPdf.js
// Anschreiben-PDF aus dem Briefing-Modell — gleicher Stack wie die
// Vertrags-PDFs: jsPDF-Text + PdfTextFlow, kein HTML-Raster.

import { buildBriefingPdfModel } from './BriefingDocView.js';
import { ensureSpace, renderPaginatedText } from '../vertrag/create/pdf/PdfTextFlow.js';
import {
  loadLikeGroupLogoPng,
  drawLikeGroupLogo,
  drawLikeGroupFooter,
  containInBox,
  PDF_BRAND,
} from '../../core/pdf/PdfBrand.js';

export const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

const MARGIN_X = 14;
const MAX_WIDTH = 182;
const START_Y_FIRST = 40;
const START_Y = 20;
const MAX_CONTENT_Y = 272;
const PDF_IMAGE_MAX_EDGE = 256;
const PDF_IMAGE_JPEG_QUALITY = 0.85;

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

/**
 * Bild als JPEG, längste Kante max. 256px, plus Pixelmasse fürs Seitenverhältnis.
 * jsPDF legt PNG unkomprimiert in voller Pixelzahl ab; AVIF kann es gar nicht.
 * PNG geht mit durchs Canvas, sonst bleibt ein großes Logo unangetastet.
 * Ohne Canvas wird das Bild ausgelassen.
 */
export function toPdfImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return Promise.resolve(null);
  const canRaster = typeof OffscreenCanvas !== 'undefined'
    && typeof Image !== 'undefined'
    && typeof document !== 'undefined';
  if (!canRaster) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        if (!srcW || !srcH) {
          resolve(null);
          return;
        }
        const scale = Math.min(1, PDF_IMAGE_MAX_EDGE / Math.max(srcW, srcH));
        const width = Math.max(1, Math.round(srcW * scale));
        const height = Math.max(1, Math.round(srcH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const jpeg = canvas.toDataURL('image/jpeg', PDF_IMAGE_JPEG_QUALITY);
        if (typeof jpeg !== 'string' || !jpeg.startsWith('data:image/jpeg')) {
          resolve(null);
          return;
        }
        resolve({ dataUrl: jpeg, width, height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
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
  const customerSrc = customerPng?.dataUrl || (typeof customerPng === 'string' ? customerPng : '');
  if (customerSrc && doc.addImage) {
    const fitted = containInBox(customerPng?.width, customerPng?.height, w, h);
    const imageY = y + (h - fitted.h) / 2;
    doc.addImage(customerSrc, imageFormat(customerSrc), customerX, imageY, fitted.w, fitted.h, undefined, 'FAST');
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
  const [model, logoPng, customerRaw] = await Promise.all([
    Promise.resolve(buildBriefingPdfModel(detail)),
    loadLikeGroupLogoPng(),
    loadCustomerLogoPng(customerLogoUrl(detail.briefing)),
  ]);
  const customerImage = customerRaw ? await toPdfImageDataUrl(customerRaw) : null;
  const doc = new jsPDF();
  doc.setFont('helvetica');
  drawBriefingLockup(doc, logoPng, customerImage, {
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
