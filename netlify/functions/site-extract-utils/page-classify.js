// page-classify.js
// Bestimmt, WAS die eingegebene Seite eigentlich ist, bevor das Modell sie
// liest. Reine Heuristik auf HTML, JSON-LD und URL - kostet keinen Claude-Call
// und keine messbare Zeit.
//
// Hintergrund: Ohne diese Einordnung bekommt das Modell eine Shop-Startseite
// mit einem Prompt, der eine Einzelproduktseite beschreibt, und antwortet
// korrekt aber nutzlos mit "das ist keine Produktseite" und null Feldern.
// Mit dem Seitentyp kann der Prompt die passende Frage stellen und der
// Aufrufer bei einer Uebersichtsseite eine Produkt-Unterseite nachladen.

const { parseAttributes, stripTags, collapse, resolveUrl, decodeEntities } = require('./html-distill');

const TYPEN = {
  PRODUKTSEITE: 'produktseite',
  SHOP_UEBERSICHT: 'shop_uebersicht',
  DIENSTLEISTUNG: 'dienstleistung',
  BLOCKIERT: 'blockiert',
  UNKLAR: 'unklar'
};

// Pfadmuster verbreiteter Shopsysteme. `dwvar_` ist Salesforce Commerce Cloud,
// wo die Variante als Query-Parameter haengt.
const PRODUKT_URL_MUSTER = [
  { re: /\/products?\//i, name: '/products/-Pfad' },
  { re: /\/produkt(e)?\//i, name: '/produkt/-Pfad' },
  { re: /\/(p|dp|itm|item|artikel|article)\/[^/]+/i, name: 'Artikel-Pfad' },
  { re: /[?&]dwvar_/i, name: 'Salesforce-Variantenparameter' },
  { re: /[?&](variant|sku|pid|productid)=/i, name: 'Produkt-Query-Parameter' },
  { re: /-p-?\d{3,}/i, name: 'Artikelnummer im Pfad' }
];

const UEBERSICHT_URL_MUSTER = [
  { re: /\/collections?\//i, name: '/collections/-Pfad' },
  { re: /\/(kategorie|category|categories|sortiment|shop|store|katalog|catalog)(\/|$)/i, name: 'Kategorie-Pfad' }
];

// Vokabular, das ein Angebot als Dienstleistung oder Abo kennzeichnet
const DIENSTLEISTUNG_WOERTER = /\b(dienstleistung|beratung|beratungstermin|termin vereinbaren|kostenloses erstgespraech|abonnement|abo|monatlich kuendbar|pro monat|monatsbeitrag|tarif|mitgliedschaft|behandlung|therapie|rezept|verschreibung|telemedizin|arztgespraech|online-?arzt|versicherung|kredit|makler|vermittlung|inserat|anzeige aufgeben|jetzt buchen|kurs|coaching|seminar)\b/i;

// Marker, die auf eine Challenge- oder Schutzseite hindeuten und die das
// Qualitaetsgate im page-fetcher durchlaesst, weil genug Text da ist
const SCHUTZSEITE_WOERTER = /\b(bot[- ]?schutz|bot detection|are you a human|sind sie ein mensch|ungewoehnliche aktivitaet|unusual traffic|zugriff verweigert|access to this page has been denied|sicherheitsabfrage|captcha|cloudflare|imperva|perimeterx|datadome)\b/i;

const WARENKORB_WOERTER = /\b(in den warenkorb|zum warenkorb|add to (cart|bag|basket)|jetzt kaufen|buy now|in den einkaufswagen)\b/i;
const PREIS_MUSTER = /(\d{1,3}(?:[.\s]\d{3})*|\d+)[,.]\d{2}\s*(?:€|eur\b)|(?:€|eur)\s*\d/i;

const STOPWOERTER = /^(und|oder|the|and|for|mit|von|aus|der|die|das|dein|deine|shop|store|online|kaufen|jetzt|neu|beste|guenstig|versand|offizieller|official)$/;

/** Umlaute wie in URL-Slugs schreiben, damit "Huellen" und "huelle" matchen. */
function normalisiere(text) {
  return String(text)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

/**
 * Aussagekraeftige Wortstaemme aus einem Text. Auf vier Zeichen gekuerzt, damit
 * Singular und Plural zusammenfallen ("huelle" / "huellen" -> "huel").
 */
function stammworte(text) {
  const stämme = new Set();
  for (const wort of normalisiere(text).split(/[^a-z0-9]+/)) {
    if (wort.length < 4 || STOPWOERTER.test(wort)) continue;
    stämme.add(wort.slice(0, 4));
  }
  return stämme;
}

/** JSON-LD @type eines Knotens als Kleinbuchstaben-String (auch bei Arrays). */
function typeOf(node) {
  const raw = node?.['@type'];
  if (Array.isArray(raw)) return raw.map((t) => String(t).toLowerCase()).join(' ');
  return String(raw || '').toLowerCase();
}

function hasJsonLdType(jsonLd, pattern) {
  return (jsonLd || []).some((node) => pattern.test(typeOf(node)));
}

/**
 * Produktlinks der Seite, absteigend nach Verlaesslichkeit. Wird gebraucht,
 * wenn die eingegebene URL eine Uebersichtsseite ist und der Aufrufer eine
 * echte Produktseite nachladen will.
 *
 * Entscheidend fuer die Reihenfolge ist die Ueberlappung mit dem Seitentitel:
 * Shops verlinken ihr Kernsortiment oft als Bildkachel ohne Linktext, waehrend
 * Zubehoer beschriftete Links bekommt. Ein Titel wie "iPhone Huellen & Covers"
 * zeigt zuverlaessiger auf das Kernprodukt als die Position im DOM.
 *
 * @param {string} html
 * @param {string} baseUrl
 * @param {Object} [kontext]
 * @param {Array} [kontext.jsonLd]
 * @param {string} [kontext.titel] - Seitentitel, liefert die Leitbegriffe
 * @returns {Array<{url: string, label: string, score: number, reason: string}>}
 */
function findProductLinks(html, baseUrl, kontext = {}) {
  const { jsonLd = [], titel = '' } = kontext;
  let host;
  try {
    host = new URL(baseUrl).host;
  } catch {
    return [];
  }

  const leitworte = stammworte(titel);

  const byUrl = new Map();
  const add = (rawUrl, label, score, reason) => {
    const url = resolveUrl(rawUrl, baseUrl);
    if (!url) return;
    try {
      if (new URL(url).host !== host) return;
    } catch {
      return;
    }
    // Die Uebersichtsseite selbst ist kein Kandidat
    if (url.replace(/#.*$/, '') === baseUrl.replace(/#.*$/, '')) return;

    const vorhanden = byUrl.get(url);
    if (vorhanden && vorhanden.score >= score) return;
    byUrl.set(url, { url, label: label || vorhanden?.label || '', score, reason });
  };

  // 1. JSON-LD ItemList: die Seite sagt selbst, welche Produkte sie listet
  for (const node of jsonLd) {
    if (!/itemlist/.test(typeOf(node))) continue;
    for (const element of node.itemListElement || []) {
      const ziel = element?.item || element;
      const url = typeof ziel === 'string' ? ziel : ziel?.url || ziel?.['@id'];
      const label = typeof ziel === 'object' ? ziel?.name : '';
      if (url) add(url, label, 100, 'JSON-LD ItemList');
    }
  }

  // 2. Links, deren Adresse einem Produktmuster folgt
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = parseAttributes(m[1]);
    if (!attrs.href) continue;

    const treffer = PRODUKT_URL_MUSTER.find((muster) => muster.re.test(attrs.href));
    if (!treffer) continue;

    const label = collapse(decodeEntities(stripTags(m[2]))).slice(0, 120);
    const eigene = stammworte(`${attrs.href} ${label}`);
    const gemeinsam = [...leitworte].filter((wort) => eigene.has(wort)).length;
    const themenBonus = Math.min(30, gemeinsam * 15);

    const gruende = [`Produktmuster (${treffer.name})`];
    if (gemeinsam) gruende.push(`${gemeinsam} Titel-Begriffe`);

    add(attrs.href, label, 50 + (label ? 10 : 0) + themenBonus, gruende.join(', '));
  }

  return [...byUrl.values()].sort((a, b) => b.score - a.score).slice(0, 12);
}

/**
 * Ordnet die Seite einem Typ zu.
 * @param {Object} params
 * @param {string} params.html - Roh-HTML, fuer die Linksuche
 * @param {Object} params.distilled - Ergebnis von distill()
 * @param {string} params.url - finale URL der Seite
 * @param {boolean} [params.degraded] - page-fetcher konnte die Seite nur
 *   eingeschraenkt laden (Bot-Wall durchgereicht)
 * @returns {{ typ: string, signale: string[], produktLinks: Array }}
 */
function classifyPage({ html, distilled, url, degraded = false }) {
  const { jsonLd = [], meta = {}, text = '', title = '' } = distilled || {};
  const signale = [];
  const textProbe = text.slice(0, 20000);

  // --- Blockiert: alles andere waere Rauschen ---
  if (degraded) signale.push('Seite nur eingeschraenkt geladen');
  const schutzTreffer = textProbe.match(SCHUTZSEITE_WOERTER);
  if (schutzTreffer) signale.push(`Schutzseiten-Vokabular ("${schutzTreffer[0]}")`);
  // Eine echte Seite mit Cloudflare-Hinweis im Footer ist kein Blocker -
  // deshalb nur zusammen mit wenig Text oder degraded
  const wirklichBlockiert = degraded || (schutzTreffer && textProbe.length < 1200);
  if (wirklichBlockiert) {
    return { typ: TYPEN.BLOCKIERT, signale, produktLinks: [] };
  }

  // --- Produktseite ---
  let produktPunkte = 0;
  if (hasJsonLdType(jsonLd, /product/)) {
    produktPunkte += 3;
    signale.push('JSON-LD Product');
  }
  if (/^product/i.test(meta['og:type'] || '')) {
    produktPunkte += 2;
    signale.push(`og:type=${meta['og:type']}`);
  }
  if (meta['product:price:amount'] || meta['og:price:amount']) {
    produktPunkte += 2;
    signale.push('Preis-Meta-Tag');
  }
  const urlTreffer = PRODUKT_URL_MUSTER.find((muster) => muster.re.test(url));
  if (urlTreffer) {
    produktPunkte += 2;
    signale.push(`URL-Muster: ${urlTreffer.name}`);
  }
  if (WARENKORB_WOERTER.test(textProbe) && PREIS_MUSTER.test(textProbe)) {
    produktPunkte += 1;
    signale.push('Warenkorb-Button und Preis im Text');
  }

  // --- Uebersichtsseite ---
  let uebersichtPunkte = 0;
  if (hasJsonLdType(jsonLd, /itemlist|collectionpage|offercatalog|searchresultspage/)) {
    uebersichtPunkte += 2;
    signale.push('JSON-LD ItemList/CollectionPage');
  }
  const uebersichtTreffer = UEBERSICHT_URL_MUSTER.find((muster) => muster.re.test(url));
  if (uebersichtTreffer) {
    uebersichtPunkte += 2;
    signale.push(`URL-Muster: ${uebersichtTreffer.name}`);
  }

  // og:title als Ergaenzung: manche Shops halten dort die Kategorie praeziser
  const produktLinks = findProductLinks(html, url, {
    jsonLd,
    titel: `${title} ${meta['og:title'] || ''} ${meta['og:site_name'] || ''}`
  });
  if (produktLinks.length >= 4) {
    uebersichtPunkte += 2;
    signale.push(`${produktLinks.length} Produktlinks auf der Seite`);
  }

  let istStartseite = false;
  try {
    istStartseite = new URL(url).pathname.replace(/\/$/, '') === '';
  } catch {
    // ignorieren, dann eben keine Startseite
  }
  if (istStartseite) {
    uebersichtPunkte += 1;
    signale.push('Startseite (Pfad leer)');
  }

  // Ein einzelner Product-Knoten wiegt schwerer als die Startseiten-Indizien:
  // Shops legen ihr Hauptprodukt gern auf die Startseite
  if (produktPunkte >= 3 && produktPunkte >= uebersichtPunkte) {
    return { typ: TYPEN.PRODUKTSEITE, signale, produktLinks };
  }

  // Vor der Dienstleistung geprueft: ein Shop, der irgendwo "Abo" schreibt,
  // ist trotzdem eine Uebersichtsseite
  if (uebersichtPunkte >= 2) {
    return { typ: TYPEN.SHOP_UEBERSICHT, signale, produktLinks };
  }

  // --- Dienstleistung ---
  const dienstTreffer = textProbe.match(DIENSTLEISTUNG_WOERTER);
  if (produktPunkte === 0 && dienstTreffer) {
    signale.push(`Dienstleistungs-Vokabular ("${dienstTreffer[0]}")`);
    if (hasJsonLdType(jsonLd, /service|medicalbusiness|financialservice/)) {
      signale.push('JSON-LD Service');
    }
    return { typ: TYPEN.DIENSTLEISTUNG, signale, produktLinks };
  }

  if (produktPunkte >= 2) {
    return { typ: TYPEN.PRODUKTSEITE, signale, produktLinks };
  }

  signale.push('Keine eindeutigen Signale');
  return { typ: TYPEN.UNKLAR, signale, produktLinks };
}

module.exports = { classifyPage, findProductLinks, TYPEN };
