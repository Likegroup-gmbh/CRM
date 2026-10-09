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

// ============================================================
// Layout-Schicht: Abschnitte vermessen statt Höhen schätzen
// ============================================================

const DRAW_METHODS = ['text', 'rect', 'roundedRect', 'line', 'circle', 'addImage', 'addPage'];

/**
 * Seitenumbruch-Steuerung für Vertrags-PDFs (jsPDF bricht nie von selbst um).
 *
 * Statt pro Abschnitt eine Höhe zu schätzen (`ensureSpace(y, 44, ...)`), wird jeder
 * Abschnitt per Trockenlauf vermessen (`section`). Variable Inhalte davor (Zusatz-
 * Bestimmungen, Freitext, lange Namen) können dadurch nichts mehr in die Fußzeile
 * oder über den Seitenrand schieben.
 *
 * Muss NACH `localizeDocText` erzeugt werden (wrappt `doc.text` zusätzlich).
 *
 * @param {object} doc jsPDF-Dokument
 * @param {object} opts
 * @param {number} opts.maxContentY maximale Content-Y-Position (Baseline) pro Seite
 * @param {() => number} opts.onPageBreak schreibt Footer, erzeugt neue Seite, liefert Start-Y
 * @param {number} [opts.startY=20] Start-Y auf Folgeseiten
 * @param {number} [opts.footerY=285] Y der Fußzeile (Text dort zählt nicht als Überlauf)
 * @param {number} [opts.pageLeft=14] linker Rand
 * @param {number} [opts.pageRight=196] rechter Rand
 */
export function createPdfLayout(doc, { maxContentY, onPageBreak, startY = 20, footerY = 285, pageLeft = 14, pageRight = 196 }) {
  let dry = false;
  const overflows = [];

  // --- Zeichenmethoden einmalig wrappen: Trockenlauf = No-op, sonst Überlauf-Check ---
  const checkText = (text, x, y, opts) => {
    if (typeof y !== 'number' || typeof x !== 'number') return;
    const lines = Array.isArray(text) ? text : [text];
    const pageNumber = doc.internal?.getCurrentPageInfo?.().pageNumber ?? null;
    const report = (reason, line, width) => {
      const entry = { reason, page: pageNumber, text: String(line), x, y, width };
      overflows.push(entry);
      console.warn('⚠️ PDF-Layout-Überlauf:', entry);
    };
    if (y > maxContentY && y !== footerY) report('y', lines[0], null);
    if (typeof doc.getTextWidth !== 'function') return;
    const align = opts?.align || 'left';
    lines.forEach((line) => {
      const width = doc.getTextWidth(String(line ?? ''));
      const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
      if (left < pageLeft - 0.01 || left + width > pageRight + 0.01) report('x', line, width);
    });
  };

  DRAW_METHODS.forEach((name) => {
    if (typeof doc[name] !== 'function') return;
    const original = doc[name].bind(doc);
    doc[name] = (...args) => {
      if (dry) return doc;
      if (name === 'text') checkText(...args);
      return original(...args);
    };
  });

  /** Führt drawFn ohne Zeichnen aus; Font-Zustand wird danach wiederhergestellt. */
  const measure = (drawFn, y) => {
    const prevSize = typeof doc.getFontSize === 'function' ? doc.getFontSize() : null;
    const prevFont = typeof doc.getFont === 'function' ? doc.getFont() : null;
    const wasDry = dry;
    dry = true;
    try {
      const end = drawFn(y);
      return Number.isFinite(end) ? end : y;
    } finally {
      dry = wasDry;
      if (prevSize !== null) doc.setFontSize(prevSize);
      if (prevFont) doc.setFont(prevFont.fontName, prevFont.fontStyle);
    }
  };

  // Im Trockenlauf ist die Seite unendlich hoch, damit die Höhe am Stück gemessen wird
  const flow = {
    get maxContentY() { return dry ? Infinity : maxContentY; },
    onPageBreak: () => (dry ? startY : onPageBreak())
  };

  /**
   * Zeichnet einen Abschnitt so, dass er nicht über die Seite läuft.
   * - passt auf die Restseite: zeichnen
   * - passt auf eine leere Seite: erst Umbruch, dann zeichnen (bleibt zusammen)
   * - länger als eine Seite: nur `head` mm absichern, Freitext paginiert zeilenweise
   *
   * @param {number} y aktuelle Y-Position
   * @param {(y: number) => number} drawFn zeichnet ab y und liefert das End-Y
   * @param {object} [opts]
   * @param {number} [opts.gap=0] Abstand vor dem Abschnitt (entfällt nach Seitenumbruch)
   * @param {number} [opts.head=30] Mindestplatz bei überlangen/teilbaren Abschnitten
   * @param {boolean} [opts.splittable=false] Abschnitt darf über Seiten laufen (langer Freitext):
   *   kein Zusammenhalten, nur `head` mm werden abgesichert
   * @returns {number} End-Y des Abschnitts
   */
  const section = (y, drawFn, { gap = 0, head = 30, splittable = false } = {}) => {
    const sectionY = y + gap;
    if (dry) return drawFn(sectionY);
    if (splittable) return drawFn(ensureSpace(sectionY, head, maxContentY, onPageBreak));
    const height = measure(drawFn, sectionY) - sectionY;
    if (sectionY + height <= maxContentY) return drawFn(sectionY);
    if (height <= maxContentY - startY) return drawFn(onPageBreak());
    return drawFn(ensureSpace(sectionY, head, maxContentY, onPageBreak));
  };

  /**
   * Einzeilen-Text mit Umbruch (für Felder mit DB-Inhalt: Namen, Adressen, Labels).
   * Liefert die Baseline der LETZTEN Zeile, damit `y += 5` wie bisher weiterführt.
   */
  const line = (text, x, y, { maxWidth, align = 'left', lineHeight = 5 } = {}) => {
    const width = maxWidth ?? (align === 'center'
      ? 2 * Math.min(x - pageLeft, pageRight - x)
      : pageRight - x);
    const lines = doc.splitTextToSize(String(text ?? ''), width);
    let currentY = y;
    lines.forEach((l, i) => {
      if (i > 0) currentY += lineHeight;
      doc.text(l, x, currentY, align === 'left' ? undefined : { align });
    });
    return currentY;
  };

  /**
   * Checkbox mit umbrechendem Label. Liefert die Baseline der letzten Label-Zeile.
   */
  const checkbox = (x, y, checked, label, { maxWidth, lineHeight = 5 } = {}) => {
    doc.rect(x, y - 2.5, 3, 3);
    if (checked) {
      doc.line(x + 0.5, y - 2, x + 2.5, y);
      doc.line(x + 0.5, y, x + 2.5, y - 2);
    }
    return line(label, x + 5, y, { maxWidth: maxWidth ?? pageRight - (x + 5), lineHeight });
  };

  return {
    doc,
    section,
    line,
    checkbox,
    measure,
    flow,
    overflows,
    pageBreak: () => flow.onPageBreak(),
    /** Freitext zeilenweise paginiert (liefert Y nach der letzten Zeile) */
    paginated: (text, { x = 14, y, maxWidth = 180, lineHeight = 5 }) =>
      renderPaginatedText(doc, text, { x, y, maxWidth, lineHeight, ...flow }),
    /** "Zusätzliche Bestimmung" eines Paragraphen (liefert y unverändert, wenn leer) */
    zusatz: (text, y, { x = 14, maxWidth = 180 } = {}) =>
      renderZusatzBestimmung(doc, text, { x, y, maxWidth, ...flow })
  };
}
