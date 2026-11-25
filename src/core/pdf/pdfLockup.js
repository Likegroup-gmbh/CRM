// pdfLockup.js
// Kopf der Anschreiben-PDFs: LikeGroup-Logo, "x", Kundenlogo (oder Name).

import { drawLikeGroupLogo, containInBox, PDF_BRAND } from './PdfBrand.js';
import { imageFormat } from './pdfImage.js';

export function drawLockup(doc, likeGroupPng, customerPng, { customerName = '' } = {}) {
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
