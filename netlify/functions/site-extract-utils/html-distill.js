// html-distill.js
// Dampft rohes HTML auf das ein, was das Modell braucht: Titel, Meta-Daten,
// JSON-LD, sichtbaren Text. Liefert zusaetzlich Logo-Kandidaten und Links auf
// relevante Unterseiten.
//
// Bewusst regexbasiert: cheerio/jsdom sind keine Production-Dependencies, und
// fuer ein reines Auslesen ohne DOM-Manipulation reicht das.

const MAX_TEXT_LENGTH = 20000;

// Blöcke, die nie Nutztext enthalten
const NOISE_BLOCKS = /<(script|style|noscript|template|svg|iframe|canvas|form)\b[^>]*>[\s\S]*?<\/\1>/gi;
const SELF_CLOSING_NOISE = /<(?:link|meta|input|br|hr|img|source)\b[^>]*\/?>/gi;
const BLOCK_TAGS = /<\/?(?:p|div|section|article|header|footer|main|aside|nav|h[1-6]|li|tr|td|th|br|hr|table|ul|ol|dl|dt|dd|blockquote|pre|address|figcaption)\b[^>]*>/gi;

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü',
  szlig: 'ß', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç',
  ndash: '-', mdash: '-', hellip: '...', laquo: '«', raquo: '»',
  bdquo: '"', ldquo: '"', rdquo: '"', sbquo: "'", lsquo: "'", rsquo: "'",
  euro: '€', copy: '©', reg: '®', trade: '™', middot: '·', bull: '·',
  shy: '', zwnj: '', zwj: '', ensp: ' ', emsp: ' ', thinsp: ' '
};

function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => {
      const hit = NAMED_ENTITIES[name] !== undefined ? NAMED_ENTITIES[name] : NAMED_ENTITIES[name.toLowerCase()];
      return hit !== undefined ? hit : match;
    });
}

function safeCodePoint(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** Attribute eines einzelnen Tags in ein Objekt parsen (Keys lowercase). */
function parseAttributes(tagInner) {
  const attrs = {};
  const re = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m;
  while ((m = re.exec(tagInner)) !== null) {
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] || '';
    attrs[m[1].toLowerCase()] = decodeEntities(value).trim();
  }
  return attrs;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? collapse(decodeEntities(stripTags(m[1]))) : '';
}

/** Relevante Meta- und Link-Tags als flaches Objekt. */
function extractMeta(html) {
  const meta = {};
  const metaRe = /<meta\b([^>]*)>/gi;
  let m;
  while ((m = metaRe.exec(html)) !== null) {
    const a = parseAttributes(m[1]);
    const key = a.property || a.name || a.itemprop;
    if (key && a.content) meta[key.toLowerCase()] = a.content;
  }
  return meta;
}

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      blocks.push(...flattenJsonLd(parsed));
    } catch {
      // Kaputtes JSON-LD ist auf Marketing-Seiten haeufig - stillschweigend ueberspringen
    }
  }
  return blocks;
}

/** @graph und Arrays aufloesen, damit der Prompt eine flache Liste sieht. */
function flattenJsonLd(node) {
  if (Array.isArray(node)) return node.flatMap(flattenJsonLd);
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node['@graph'])) return node['@graph'].flatMap(flattenJsonLd);
  return [node];
}

function stripTags(str) {
  return str.replace(/<[^>]*>/g, ' ');
}

function collapse(str) {
  return str.replace(/[ \t\u00a0]+/g, ' ').trim();
}

/** Sichtbaren Text extrahieren, Struktur grob ueber Zeilenumbrueche erhalten. */
function htmlToText(html, maxLength = MAX_TEXT_LENGTH) {
  if (!html) return '';

  let text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, ' ')
    .replace(NOISE_BLOCKS, ' ')
    .replace(SELF_CLOSING_NOISE, ' ')
    .replace(BLOCK_TAGS, '\n')
    .replace(/<[^>]*>/g, ' ');

  text = decodeEntities(text)
    .split('\n')
    .map((line) => collapse(line))
    .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength)}\n[...gekuerzt]` : text;
}

function resolveUrl(href, baseUrl) {
  if (!href) return null;
  try {
    const u = new URL(href, baseUrl);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.href;
  } catch {
    return null;
  }
}

const LINK_PATTERNS = {
  impressum: /impressum|imprint|legal[-_ ]?notice|legal$|rechtliches|anbieterkennzeichnung/i,
  kontakt: /kontakt|contact/i,
  ueber: /ueber-uns|über-uns|about|unternehmen|company|team/i
};

/**
 * Sucht Links auf gewuenschte Unterseiten. Bewertet href und Linktext,
 * bleibt auf derselben Domain.
 */
function findLinks(html, baseUrl, kinds = []) {
  const wanted = kinds.filter((k) => LINK_PATTERNS[k]);
  if (!wanted.length) return {};

  let host;
  try {
    host = new URL(baseUrl).host;
  } catch {
    return {};
  }

  const found = {};
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttributes(m[1]);
    const url = resolveUrl(attrs.href, baseUrl);
    if (!url) continue;

    try {
      if (new URL(url).host !== host) continue;
    } catch {
      continue;
    }

    const label = collapse(decodeEntities(stripTags(m[2])));
    const haystack = `${url} ${label} ${attrs.title || ''}`;

    for (const kind of wanted) {
      if (!found[kind] && LINK_PATTERNS[kind].test(haystack)) {
        found[kind] = url;
      }
    }
  }
  return found;
}

// "logo" muss als eigenes Wort auftauchen. "brand" bewusst NICHT als Signal:
// es steckt in Asset-Namen wie "employer_brand_group_shot" und liefert dann
// Pressefotos statt Logos.
const LOGO_WORD = /(^|[^a-z])(logo|logotype|wordmark|marke?nzeichen)([^a-z]|$)/i;
// Siegel, Zertifikate, Zahlungsarten und Auszeichnungen tragen oft "logo" im
// Namen und stehen mitten in der Seite - genau da, wo kein Firmenlogo hingehoert
const BADGE_WORDS = /trust|siegel|badge|award|zertifi|geprueft|gepr%c3%bcft|payment|bezahl|paypal|klarna|visa|mastercard|versand|shipping|dhl|dpd|hermes|bevh|trustpilot|ekomi|proven|tuv|t%c3%bcv|ecolabel|ecocert|b-?corp|climate|neutral|vegan|bio-?siegel|fairtrade|fsc|iso-?\d|as-?seen|presse|press-?logo|partner|kunde|client|sponsor/i;
const PHOTO_WORDS = /hero|banner|slide|background|cover|team|group[-_]?shot|portrait|mitarbeiter|campus|store|produkt|product/i;
// Kleinste Kantenlaenge, die ein Logo im Markup deklarieren darf
const MIN_DECLARED_EDGE = 40;
// <a href="/"> oder <a href="/de/"> unmittelbar vor dem Bild
const HOME_LINK = /<a\b[^>]*\bhref\s*=\s*["'](?:\/|\.\/|https?:\/\/[^/"']+\/?|\/[a-z]{2}(?:-[a-z]{2})?\/?)["'][^>]*>(?:\s*<[^/][^>]*>\s*)*$/i;

/** Zeichenbereiche der genannten Tags, um die Position eines <img> zu verorten. */
function tagRanges(html, tagPattern) {
  const ranges = [];
  const re = new RegExp(`<(${tagPattern})\\b[^>]*>[\\s\\S]*?<\\/\\1>`, 'gi');
  let m;
  while ((m = re.exec(html)) !== null) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

/**
 * Logo-Kandidaten nach Zuverlaessigkeit sortiert. Der Aufrufer probiert sie
 * der Reihe nach durch, bis einer erfolgreich konvertiert werden kann.
 */
function findLogoCandidates(html, baseUrl) {
  const candidates = [];
  const seen = new Set();

  const add = (href, score, reason, extra = {}) => {
    const url = resolveUrl(href, baseUrl);
    if (!url || seen.has(url)) return;
    // Platzhalter und Tracking-Pixel aussortieren
    if (/^data:/i.test(url) || /(sprite|placeholder|spacer|pixel|1x1)/i.test(url)) return;
    // sharp kann ICO nicht lesen - Kandidat waere nur ein verschenkter Request
    if (/\.ico(\?|#|$)/i.test(url)) return;
    seen.add(url);
    candidates.push({ url, score, reason, ...extra });
  };

  const headerRanges = tagRanges(html, 'header|nav');
  const footerRanges = tagRanges(html, 'footer');
  const inRange = (idx, ranges) => ranges.some(([from, to]) => idx >= from && idx < to);

  // 1. Inline-SVG im Kopfbereich. In modernen Stacks (Next.js, Nuxt, Webflow)
  // ist das Logo oft gar kein <img>, sondern eingebettetes SVG-Markup oder ein
  // <use>-Verweis auf eine externe SVG-Datei.
  for (const found of findInlineSvgLogos(html, headerRanges)) {
    if (found.href) add(found.href, found.score, found.reason, { symbolId: found.symbolId });
    else candidates.push(found);
  }

  // 2. <img> mit Logo-Hinweis im Markup
  const imgRe = /<img\b([^>]*)>/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    const a = parseAttributes(m[1]);
    const src = a.src || a['data-src'] || firstFromSrcset(a.srcset || a['data-srcset']);
    if (!src) continue;

    // Footer-Bilder sind fast immer Partner-, Zahlungsart- oder Siegel-Logos.
    // Lieber kein Logo als das falsche.
    if (inRange(m.index, footerRanges)) continue;

    // Im Markup deklarierte Winzlinge sind Icons (Sterne, Pfeile, Haken)
    const declared = Math.max(parseInt(a.width, 10) || 0, parseInt(a.height, 10) || 0);
    if (declared && declared < MIN_DECLARED_EDGE) continue;

    const signals = `${src} ${a.alt || ''} ${a.class || ''} ${a.id || ''} ${a.title || ''}`;
    // Das Logo-Wort zaehlt nur im Dateinamen oder in kurzen, label-artigen
    // Attributen. In langen alt-Beschreibungen ("... TOM TAILOR Logo.") steht es
    // fuer ein Motiv im Bild, nicht fuer das Logo der Seite.
    const labels = `${src} ${[a.alt, a.class, a.id, a.title].filter((v) => v && v.length <= 40).join(' ')}`;

    const named = LOGO_WORD.test(labels);
    // Ein Bild im Link auf die Startseite ist praktisch immer das Logo - das
    // greift auch dann, wenn im Markup nirgends "logo" steht.
    const linksHome = HOME_LINK.test(html.slice(Math.max(0, m.index - 200), m.index));

    let score = named ? 60 : 0;
    if (linksHome) score += 40;
    // Die Position zaehlt nur als Verstaerker. Ohne Logo-Signal bleibt ein
    // Header-Bild schwach, sonst gewinnt das erste Icon in der Navigation.
    if (inRange(m.index, headerRanges)) score += named ? 30 : 10;
    else if (m.index < 15000) score += named ? 10 : 0;
    else score -= 25;
    if (/\.svg(\?|$)/i.test(src)) score += 15;
    if (BADGE_WORDS.test(signals)) score -= 50;
    if (PHOTO_WORDS.test(signals)) score -= 40;
    if (/icon|favicon/i.test(signals)) score -= 15;
    if (score > 0) add(src, score, 'img');
  }

  // 3. Explizite Icon-Links (verlaesslich vorhanden, aber oft nur Favicon)
  const linkRe = /<link\b([^>]*)>/gi;
  while ((m = linkRe.exec(html)) !== null) {
    const a = parseAttributes(m[1]);
    const rel = (a.rel || '').toLowerCase();
    if (!a.href) continue;

    if (rel.includes('apple-touch-icon')) add(a.href, 45, 'apple-touch-icon');
    else if (rel.includes('mask-icon')) add(a.href, 35, 'mask-icon');
    else if (rel.includes('icon')) {
      const size = parseInt((a.sizes || '').split('x')[0], 10) || 0;
      add(a.href, size >= 96 ? 40 : 20, 'icon');
    }
  }

  // 4. JSON-LD Organization.logo - wenn gepflegt, die verlaesslichste Quelle
  for (const href of jsonLdLogos(extractJsonLd(html))) {
    add(href, 110, 'json-ld');
  }

  // 5. Social-Preview als letzter Ausweg - oft ein Hero-Bild, kein Logo
  const meta = extractMeta(html);
  const social = meta['og:logo'] || meta['og:image'] || meta['twitter:image'];
  if (social) add(social, 15, 'og:image');

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Sammelt `logo`-Angaben aus JSON-LD. schema.org erlaubt dort String,
 * ImageObject oder ein Array davon.
 */
function jsonLdLogos(nodes = []) {
  const out = [];
  const collect = (value) => {
    if (!value) return;
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (typeof value === 'object') collect(value.url || value.contentUrl);
  };
  for (const node of nodes) {
    if (node && typeof node === 'object') collect(node.logo);
  }
  return out;
}

const MAX_INLINE_SVG_BYTES = 20000;
const SVG_SHAPES = /<(path|polygon|polyline|rect|circle|ellipse|line|text|image)\b/i;
// Fenster vor dem <svg>, in dem nach einem Logo-Label am umgebenden Element
// gesucht wird. Frameworks setzen aria-label und Klassen oft am <a> oder <div>.
const SVG_CONTEXT_BEFORE = 300;

/**
 * SVGs im Kopfbereich, die sich selbst als Logo bezeichnen. Liefert entweder
 * das Markup (`svg`, geht direkt an sharp) oder bei einem <use>-Verweis den
 * Pfad zur externen Datei (`href`).
 */
function findInlineSvgLogos(html, headerRanges) {
  if (!headerRanges.length) return [];

  const found = [];
  const re = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!headerRanges.some(([from, to]) => m.index >= from && m.index < to)) continue;
    if (m[0].length > MAX_INLINE_SVG_BYTES) continue;

    const a = parseAttributes(m[1]);
    const inner = m[2];
    const title = (inner.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
    const labels = [a.class, a.id, a['aria-label'], a['data-name'], title]
      .filter((v) => v && v.trim().length <= 40)
      .join(' ');

    let score = 80;
    if (!LOGO_WORD.test(labels)) {
      // Kein Label am <svg> selbst: das umgebende <a>/<div> traegt es oft
      const context = html.slice(Math.max(0, m.index - SVG_CONTEXT_BEFORE), m.index);
      if (!LOGO_WORD.test(labelAttributes(context))) continue;
      score = 70;
    }

    // Sprite-Referenz: die Zeichnung liegt in einer externen Datei
    const useHref = (inner.match(/<use\b[^>]*\b(?:xlink:)?href\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (useHref) {
      const [external, symbolId] = useHref.split('#');
      if (external) found.push({ href: external, symbolId: symbolId || null, score, reason: 'svg-use' });
      continue;
    }

    // Ohne echte Zeichenelemente oder ohne Groessenangabe kann sharp nichts rendern
    if (!SVG_SHAPES.test(inner)) continue;
    if (!a.viewbox && !(a.width && a.height)) continue;

    const markup = a.xmlns ? m[0] : m[0].replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    found.push({ svg: markup, score, reason: 'inline-svg' });
    if (found.length >= 2) break;
  }
  return found.sort((x, y) => y.score - x.score);
}

/**
 * Zieht nur die kurzen, label-artigen Attributwerte aus einem Markup-Fetzen.
 * Lange Werte (Pfaddaten, Prosa) wuerden sonst falsche Treffer liefern.
 */
function labelAttributes(markup) {
  const re = /\b(?:aria-label|class|id|title|data-name)\s*=\s*["']([^"']{1,60})["']/gi;
  const out = [];
  let m;
  while ((m = re.exec(markup)) !== null) out.push(m[1]);
  return out.join(' ');
}

function firstFromSrcset(srcset) {
  if (!srcset) return null;
  const first = srcset.split(',')[0];
  return first ? first.trim().split(/\s+/)[0] : null;
}

/**
 * Alles in einem Durchgang.
 * @param {string} html
 * @param {string} baseUrl - Finale URL nach Redirects, Basis fuer relative Pfade
 * @param {Object} options - { followLinks: string[], withLogo: boolean }
 */
function distill(html, baseUrl, options = {}) {
  const { followLinks = [], withLogo = false } = options;
  return {
    title: extractTitle(html),
    meta: extractMeta(html),
    jsonLd: extractJsonLd(html),
    text: htmlToText(html),
    links: findLinks(html, baseUrl, followLinks),
    logoCandidates: withLogo ? findLogoCandidates(html, baseUrl) : []
  };
}

/** Formt die eingedampften Seiten zu dem Textblock, der an Claude geht. */
function toPromptBlock(pages) {
  return pages
    .map((page) => {
      const parts = [`### Seite: ${page.url}${page.role ? ` (${page.role})` : ''}`];
      if (page.title) parts.push(`Titel: ${page.title}`);

      const metaKeys = ['description', 'og:description', 'og:site_name', 'og:title', 'author', 'keywords'];
      const metaLines = metaKeys
        .filter((k) => page.meta && page.meta[k])
        .map((k) => `${k}: ${page.meta[k]}`);
      if (metaLines.length) parts.push(`Meta:\n${metaLines.join('\n')}`);

      if (page.jsonLd && page.jsonLd.length) {
        const relevant = page.jsonLd.filter((n) => {
          const type = String(n['@type'] || '').toLowerCase();
          return /organization|corporation|localbusiness|store|product|website|person/.test(type);
        });
        const useful = relevant.length ? relevant : page.jsonLd;
        parts.push(`Strukturierte Daten (JSON-LD):\n${JSON.stringify(useful).slice(0, 4000)}`);
      }

      if (page.text) parts.push(`Text:\n${page.text}`);
      return parts.join('\n\n');
    })
    .join('\n\n---\n\n');
}

module.exports = {
  distill,
  toPromptBlock,
  htmlToText,
  extractTitle,
  extractMeta,
  extractJsonLd,
  findLinks,
  findLogoCandidates,
  decodeEntities,
  resolveUrl,
  // Generische Parser-Helfer, damit page-classify sie nicht nachbauen muss
  parseAttributes,
  stripTags,
  collapse,
  MAX_TEXT_LENGTH
};
