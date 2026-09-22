// Nur Pfade unter produkt-pdfs/{derselbe User}/datei.pdf.
function parseProduktPdfPath(url, userId) {
  const match = String(url || '').match(/^pdf:(produkt-pdfs\/([0-9a-f-]{36})\/[^/]+\.pdf)$/i);
  if (!match) return null;
  if (match[2].toLowerCase() !== String(userId || '').toLowerCase()) return null;
  return match[1];
}

module.exports = { parseProduktPdfPath };
