// agentur-resolver.js
// Findet zu einem Management (Talent-Agentur) die Homepage. Erster Schritt von
// Management-Connect: die Webseiten-Extraktion (site-extract) braucht eine URL,
// die Datensaetze haben aber keine.
//
// Die Suche macht Claude mit dem eingebauten web_search-Tool. Entscheidend ist,
// dass das Modell nur VORSCHLAEGT: Eine URL zaehlt erst, wenn sie
//   1. wirklich in den Suchergebnissen stand (pruefeHomepage), und
//   2. die geladene Seite spaeter zum Stammdatennamen passt (namenTreffer).
// Beides sind reine Funktionen und unabhaengig vom Suchanbieter - ein Wechsel
// (z.B. auf Gemini mit Google-Suche) ersetzt nur findAgenturHomepage.

const { callClaude, extractJson, MODELS } = require('./anthropic');
const { calculateCost } = require('./claude-cost');

// Keine eigene Agentur-Homepage: Social, Netzwerke, Verzeichnisse, Register.
// Dient als blocked_domains der Suche UND als hartes Gate (das Modell koennte
// trotzdem so eine URL nennen). Subdomains zaehlen mit.
const BLOCKED_DOMAINS = [
  'instagram.com', 'tiktok.com', 'facebook.com', 'youtube.com', 'x.com', 'twitter.com',
  'linkedin.com', 'xing.com', 'pinterest.com', 'linktr.ee',
  'wikipedia.org', 'northdata.de', 'kununu.com', 'crunchbase.com',
  'handelsregister.de', 'unternehmensregister.de', 'bundesanzeiger.de',
  'gelbeseiten.de', 'wlw.de', 'firmenwissen.de', 'dnb.com', 'yelp.com'
];

const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 3,
  blocked_domains: BLOCKED_DOMAINS,
  user_location: { type: 'approximate', country: 'DE' }
};

const SUCH_TIMEOUT_MS = 60000;

const SYSTEM_PROMPT = `Du findest die offizielle Webseite einer Talent- bzw. Influencer-Management-Agentur.

Regeln:
- Suche im Netz und nenne die Startseite der Agentur SELBST - nicht eine Creator-Seite, kein Social-Profil, kein Verzeichnis, kein Presseartikel.
- Pruefe, ob der Name der Seite zum gesuchten Namen passt. Wenn bekannte Creator genannt sind, nutze sie, um gleichnamige Firmen auseinanderzuhalten.
- Nenne nur URLs, die in deinen Suchergebnissen vorkamen. Rate niemals eine Domain.
- Bist du nicht sicher, dass es die richtige Agentur ist: homepage null.
- Antworte am Ende ausschliesslich mit einem JSON-Objekt, ohne Text danach: {"homepage": "https://..." oder null, "begruendung": "ein kurzer Satz"}`;

// Rechtsformen und Fuellwoerter, die in fast jedem Agenturnamen stehen und
// deshalb nichts darueber sagen, ob zwei Namen dieselbe Firma meinen
const RECHTSFORMEN = new Set([
  'gmbh', 'mbh', 'ug', 'ag', 'kg', 'ohg', 'gbr', 'ek', 'ltd', 'inc', 'llc', 'se', 'co', 'und'
]);
const ALLGEMEINE_WOERTER = new Set([
  'talent', 'talents', 'management', 'manager', 'agentur', 'agency', 'media', 'group',
  'gruppe', 'entertainment', 'models', 'model', 'creator', 'creators', 'influencer',
  'marketing', 'network', 'studios', 'studio', 'the', 'der', 'die', 'das'
]);
const MIN_TOKEN_LAENGE = 4;

/** Kleinschreibung, Umlaute und Akzente aufgeloest ("Müller" -> "muller", "ß" -> "ss"). */
function normalisiere(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Namen in unterscheidungskraeftige Woerter zerlegen. */
function nameTokens(name) {
  const alle = normalisiere(name)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((t) => !RECHTSFORMEN.has(t));

  const lang = alle.filter((t) => t.length >= MIN_TOKEN_LAENGE);
  const eigen = lang.filter((t) => !ALLGEMEINE_WOERTER.has(t));
  if (eigen.length) return eigen;
  // Nur Fuellwoerter oder sehr kurze Namen ("UTA", "Talents GmbH"): lieber
  // damit abgleichen als gar nicht
  if (lang.length) return lang;
  return alle.filter((t) => t.length >= 2);
}

function hostOhneWww(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Passt der Name auf der gefundenen Seite zum Stammdatennamen?
 * Mindestens ein unterscheidungskraeftiges Wort des Stammdatennamens muss im
 * extrahierten Namen oder in der Domain stecken.
 * @returns {{ passt: boolean, stammTokens: string[], treffer: string[] }}
 */
function namenTreffer(stammdatenName, extrahierterName, url) {
  const stammTokens = nameTokens(stammdatenName);
  const heu = normalisiere(extrahierterName);
  // Domain ohne Trenner, damit "muster-talents.de" auch "mustertalents" trifft
  const domain = normalisiere(hostOhneWww(url)).replace(/[^a-z0-9]/g, '');
  const treffer = stammTokens.filter((t) => heu.includes(t) || domain.includes(t));
  return { passt: treffer.length > 0, stammTokens, treffer };
}

function istBlockiert(host) {
  return BLOCKED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Eingabe auf Origin ("https://host") kuerzen, sonst null. */
function normalizeHomepage(value) {
  if (!value) return null;
  const raw = String(value).trim();
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!u.hostname.includes('.')) return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/**
 * URL-Gate: Die vom Modell genannte Homepage gilt nur, wenn ihr Host in den
 * Suchergebnissen vorkam und kein Social-/Portal-Host ist.
 * @param {string|null} modellUrl
 * @param {Array<{url: string}>} sources
 * @returns {{ ok: boolean, url: string|null, grund: string|null }}
 */
function pruefeHomepage(modellUrl, sources = []) {
  if (!modellUrl) return { ok: false, url: null, grund: 'keine Homepage genannt' };

  const url = normalizeHomepage(modellUrl);
  if (!url) return { ok: false, url: null, grund: 'ungueltige URL' };

  const host = hostOhneWww(url);
  if (istBlockiert(host)) return { ok: false, url, grund: 'Social-/Portal-Host' };

  const inSuche = sources.some((s) => hostOhneWww(s.url) === host);
  if (!inSuche) return { ok: false, url, grund: 'nicht in Suchergebnissen' };

  return { ok: true, url, grund: null };
}

function buildSuchPrompt({ firmenname, creatorNamen }) {
  const creator = creatorNamen.length
    ? `\nBekannte Creator dieser Agentur: ${creatorNamen.join(', ')}.`
    : '';
  return `Gesucht: die offizielle Webseite der Management-Agentur "${firmenname}".${creator}`;
}

/**
 * Sucht die Homepage zu einem Management.
 * @param {Object} params
 * @param {string} params.firmenname
 * @param {string[]} [params.creatorNamen] - bis zu zwei, zur Disambiguierung
 * @param {string|null} [params.bekannteUrl] - schon gepflegte Webseite: keine Suche
 * @returns {Promise<{ url: string|null, grund: string|null, suche: Object, cost: Object|null }>}
 *   `suche` ist die Diagnose fuer die Console (Queries, Quellen, Begruendung)
 */
async function findAgenturHomepage({ firmenname, creatorNamen = [], bekannteUrl = null }) {
  const bekannt = normalizeHomepage(bekannteUrl);
  if (bekannt) {
    return {
      url: bekannt,
      grund: null,
      suche: { uebersprungen: 'webseite schon vorhanden, Suche uebersprungen', gewaehlt: bekannt },
      cost: null
    };
  }

  const suche = { queries: [], quellen: [], begruendung: null, modellUrl: null, gewaehlt: null };

  const result = await callClaude({
    model: MODELS.resolve,
    systemBlocks: [{ text: SYSTEM_PROMPT }],
    userPrompt: buildSuchPrompt({ firmenname, creatorNamen }),
    maxTokens: 1500,
    tool: WEB_SEARCH_TOOL,
    toolForced: false,
    timeoutMs: SUCH_TIMEOUT_MS
  });

  const cost = calculateCost(result.model, result.usage);
  suche.queries = result.searchQueries || [];
  suche.quellen = (result.sources || []).map((s) => ({ host: hostOhneWww(s.url), url: s.url, titel: s.title }));

  if (result.stop_reason === 'pause_turn') {
    return { url: null, grund: 'Suche unvollstaendig (pause_turn)', suche, cost };
  }

  let antwort = null;
  try {
    antwort = extractJson(result.text || '');
  } catch (_) {
    return { url: null, grund: 'Antwort des Modells nicht lesbar', suche, cost };
  }

  suche.modellUrl = typeof antwort?.homepage === 'string' ? antwort.homepage : null;
  suche.begruendung = typeof antwort?.begruendung === 'string' ? antwort.begruendung : null;

  const gate = pruefeHomepage(suche.modellUrl, result.sources || []);
  suche.gewaehlt = gate.ok ? gate.url : null;
  return { url: gate.ok ? gate.url : null, grund: gate.grund, suche, cost };
}

module.exports = {
  findAgenturHomepage,
  namenTreffer,
  pruefeHomepage,
  normalizeHomepage,
  nameTokens,
  BLOCKED_DOMAINS
};
