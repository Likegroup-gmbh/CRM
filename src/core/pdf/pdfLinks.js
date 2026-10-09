// pdfLinks.js
// Lange URLs gehoeren nicht ins PDF. Jede URL im Text wird durch eine kurze
// Bezeichnung ersetzt ("Link zu shop.de"), die als anklickbarer Link gezeichnet
// wird (unterstrichen, mit Link-Flaeche). Die Bezeichnung enthaelt
// geschuetzte Leerzeichen, damit jsPDF sie beim Umbruch nicht zerreisst.

const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_RE = /[.,;:!?)\]]+$/;
const NBSP = '\u00A0';
const LINK_GRAY = 70;
const UNDERLINE_WIDTH = 0.15;
const MM_PER_PT = 0.3528;

/** "Link zu shop.de" - Host ohne www, ohne Pfad und Query. */
export function linkLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '');
    return host ? ['Link', 'zu', host].join(NBSP) : 'Link';
  } catch {
    return 'Link';
  }
}

/**
 * Ersetzt jede URL im Text durch ihre Bezeichnung.
 * Satzzeichen direkt hinter der URL bleiben im Text.
 * @returns {{ text: string, links: Array<{ label: string, url: string }> }}
 */
export function shortenUrls(value) {
  const links = [];
  const text = String(value ?? '').replace(URL_RE, (match) => {
    const trailing = match.match(TRAILING_RE)?.[0] || '';
    const url = trailing ? match.slice(0, -trailing.length) : match;
    const label = linkLabel(url);
    links.push({ label, url });
    return label + trailing;
  });
  return { text, links };
}

/** Unterstreichung und Link-Flaeche ueber der Bezeichnung. */
function markLink(doc, url, x, y, width) {
  const size = typeof doc.getFontSize === 'function' ? doc.getFontSize() : 10;
  const height = size * MM_PER_PT;
  doc.setDrawColor(LINK_GRAY);
  doc.setLineWidth(UNDERLINE_WIDTH);
  doc.line(x, y + 0.6, x + width, y + 0.6);
  doc.link(x, y - height * 0.8, width, height * 1.1, { url });
}

/**
 * Zeichenfunktion fuer renderPaginatedText. Die Zeile wird in einem Stueck
 * geschrieben (so legt der Viewer die Abstaende selbst fest - Stuecke einzeln
 * zu setzen laeuft ueber lange Zeilen auseinander); die Bezeichnungen darin
 * bekommen Unterstreichung und Link-Flaeche. Jede URL wird einmal vergeben,
 * in Lesereihenfolge.
 */
export function createLinkDrawer(links) {
  const queues = new Map();
  for (const { label, url } of links) {
    if (!queues.has(label)) queues.set(label, []);
    queues.get(label).push(url);
  }

  function nextLabel(line, from) {
    let best = null;
    for (const [label, urls] of queues) {
      if (!urls.length) continue;
      const index = line.indexOf(label, from);
      if (index !== -1 && (!best || index < best.index)) best = { label, index };
    }
    return best;
  }

  return (doc, line, x, y) => {
    doc.text(line, x, y);
    let hit = nextLabel(line, 0);
    while (hit) {
      const start = x + doc.getTextWidth(line.slice(0, hit.index));
      // Geschuetzte Leerzeichen misst jsPDF breiter als es sie zeichnet.
      const width = doc.getTextWidth(hit.label.replaceAll(NBSP, ' '));
      markLink(doc, queues.get(hit.label).shift(), start, y, width);
      hit = nextLabel(line, hit.index + hit.label.length);
    }
  };
}

/**
 * Text fuers PDF vorbereiten: URLs gekuerzt, plus die Zeichenfunktion dazu.
 * drawLine ist undefined, wenn keine URL im Text steht.
 */
export function linkifyForPdf(value) {
  const { text, links } = shortenUrls(value);
  return { text, drawLine: links.length ? createLinkDrawer(links) : undefined };
}
