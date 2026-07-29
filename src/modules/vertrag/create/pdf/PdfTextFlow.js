// pdf/PdfTextFlow.js
// Sichere Pagination für Freitext in Vertrags-PDFs (jsPDF).
// jsPDF bricht nie automatisch um – diese Helper paginieren zeilenweise
// gegen MAX_CONTENT_Y und garantieren Mindestplatz für Blöcke (z.B. Unterschriften).

/**
 * Garantiert, dass ab `y` noch `needed` mm Platz bis `maxContentY` verfügbar sind.
 * Falls nicht, wird `onPageBreak` aufgerufen (Footer + neue Seite) und dessen
 * Start-Y zurückgegeben.
 *
 * @param {number} y aktuelle Y-Position
 * @param {number} needed benötigter Platz in mm
 * @param {number} maxContentY maximale Content-Y-Position der Seite
 * @param {() => number} onPageBreak schreibt Footer, erzeugt neue Seite, liefert Start-Y
 * @returns {number} neue Y-Position
 */
export function ensureSpace(y, needed, maxContentY, onPageBreak) {
  if (y + needed > maxContentY) {
    return onPageBreak();
  }
  return y;
}

/**
 * Rendert (langen) Freitext zeilenweise mit Seitenumbrüchen.
 * Vor jeder Zeile wird gegen `maxContentY` geprüft, damit weder die Fußzeile
 * überschrieben wird noch Text unsichtbar unter den Seitenrand läuft.
 *
 * @param {object} doc jsPDF-Dokument
 * @param {string} text Freitext (kann Zeilenumbrüche enthalten)
 * @param {object} opts
 * @param {number} [opts.x=14] linke X-Position
 * @param {number} opts.y Start-Y-Position
 * @param {number} [opts.maxWidth=180] maximale Zeilenbreite in mm
 * @param {number} [opts.lineHeight=5] Zeilenhöhe in mm
 * @param {number} opts.maxContentY maximale Content-Y-Position der Seite
 * @param {() => number} opts.onPageBreak schreibt Footer, erzeugt neue Seite, liefert Start-Y
 * @returns {number} Y-Position nach der letzten Zeile
 */
export function renderPaginatedText(doc, text, { x = 14, y, maxWidth = 180, lineHeight = 5, maxContentY, onPageBreak }) {
  const lines = doc.splitTextToSize(String(text), maxWidth);
  let currentY = y;
  lines.forEach((line) => {
    if (currentY > maxContentY) {
      // Font-Zustand über den Umbruch retten: onPageBreak (Footer) darf die
      // Größe/den Stil des laufenden Freitexts nicht verändern.
      const prevSize = typeof doc.getFontSize === 'function' ? doc.getFontSize() : null;
      const prevFont = typeof doc.getFont === 'function' ? doc.getFont() : null;
      currentY = onPageBreak();
      if (prevSize !== null) doc.setFontSize(prevSize);
      if (prevFont) doc.setFont(prevFont.fontName, prevFont.fontStyle);
    }
    doc.text(line, x, currentY);
    currentY += lineHeight;
  });
  return currentY;
}

/**
 * Rendert eine optionale "Zusätzliche Bestimmung" am Ende eines Paragraphen.
 * Label + erste Zeile werden zusammengehalten, der Freitext paginiert zeilenweise.
 * Das Label wird über den doc.text-Wrapper (localizeDocText) automatisch übersetzt.
 *
 * @param {object} doc jsPDF-Dokument
 * @param {string|undefined} text Zusatztext des Paragraphen (kann leer sein)
 * @param {object} opts wie bei renderPaginatedText (x, y, maxWidth, maxContentY, onPageBreak)
 * @returns {number} Y-Position nach dem Block (unverändert, wenn kein Text)
 */
export function renderZusatzBestimmung(doc, text, { x = 14, y, maxWidth = 180, maxContentY, onPageBreak }) {
  if (!text) return y;
  // 8mm Abstand zum Paragraphen (wie Sub-Headings) + mind. Label (6mm) und zwei Textzeilen (10mm)
  let currentY = ensureSpace(y + 8, 16, maxContentY, onPageBreak);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bolditalic');
  doc.text('Zusätzliche Bestimmung:', x, currentY);
  doc.setFont('helvetica', 'normal');
  currentY += 6;
  currentY = renderPaginatedText(doc, text, { x, y: currentY, maxWidth, lineHeight: 5, maxContentY, onPageBreak });
  return currentY;
}
