// site-extract.js
// Liest eine Webseite aus und mappt den Inhalt auf die Felder eines
// Erstellungsformulars. Generisch: welche Felder gefuellt werden, steht
// ausschliesslich in _shared/extract-specs.js.
//
// POST { url, entityType } -> { success, source, cached, fields, logo, images, varianten, notes, cost }

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { callClaude, extractJson, MODELS } = require('./_shared/anthropic');
const { calculateCost } = require('./_shared/claude-cost');
const { SPEC_VERSION, getSpec, hasSpec, buildFieldInstructions, getFieldKinds } = require('./_shared/extract-specs');
const { createPageFetcher } = require('./site-extract-utils/page-fetcher');
const { distill, toPromptBlock } = require('./site-extract-utils/html-distill');
const { pickLogo } = require('./site-extract-utils/logo');
const { findProductImageCandidates, collectProductImages } = require('./site-extract-utils/product-images');
const { readCache, writeCache } = require('./site-extract-utils/cache');

// Netlify-Timeout ist auf 60s gesetzt; darunter bleiben wir mit Reserve
const TOTAL_BUDGET_MS = 50000;
const SUBPAGE_MIN_REMAINING_MS = 25000;
const LOGO_MIN_REMAINING_MS = 9000;
// Bilder sind Beigabe: reisst das Budget, gewinnen die Textfelder
const IMAGES_MIN_REMAINING_MS = 12000;

function getAllowedOrigin(requestOrigin) {
  const siteUrl = process.env.URL || '';
  const deployPrimeUrl = process.env.DEPLOY_PRIME_URL || '';
  const allowed = [siteUrl, deployPrimeUrl].filter(Boolean);
  if (allowed.includes(requestOrigin)) return requestOrigin;
  if (requestOrigin && /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/.test(requestOrigin)) return requestOrigin;
  return siteUrl || 'null';
}

async function verifyAuth(event) {
  const authHeader = (event.headers || {}).authorization || (event.headers || {}).Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

const SYSTEM_RULES = `Du liest Informationen von Firmen- und Produktseiten aus und ordnest sie Formularfeldern zu.

Regeln:
- Antworte ausschliesslich mit einem JSON-Objekt, ohne erklaerenden Text.
- Fuer jedes Feld ein Objekt { "wert": <String oder null>, "quelle": <kurze Angabe wie "Impressum", "Startseite", "JSON-LD"> }.
- Felder mit der Kennzeichnung BELEGBAR nur fuellen, wenn der Wert tatsaechlich auf der Seite steht. Niemals raten, niemals plausibel ergaenzen.
- Felder mit der Kennzeichnung ABGELEITET darfst du aus dem Inhalt erschliessen, aber nur wenn es eine nachvollziehbare Grundlage gibt.
- Wenn ein Wert nicht bestimmbar ist: "wert": null. Ein leeres Feld ist deutlich besser als ein erfundener Wert.
- Werte sauber formatieren: keine Labels ("Telefon:"), keine Anfuehrungszeichen, keine Bulletpoint-Zeichen.
- Zeilenumbrueche nur dort, wo die Feldbeschreibung ausdruecklich "ein X pro Zeile" verlangt. Alle anderen Werte einzeilig.
- Optional zusaetzlich "_hinweise": Array kurzer deutscher Saetze zu auffaelligen Luecken.`;

function buildPrompt(spec, pages) {
  const fieldList = spec.fields.map((f) => `"${f.name}"`).join(', ');
  return [
    `Fuelle diese Felder aus: ${fieldList}.`,
    '',
    'Feldbeschreibungen:',
    buildFieldInstructions(spec),
    '',
    'Inhalt der Webseite:',
    '',
    toPromptBlock(pages)
  ].join('\n');
}

/** Modell-Antwort auf die Spec eindampfen: unbekannte Felder und Muell fliegen raus. */
function normalizeFields(raw, spec) {
  const kinds = getFieldKinds(spec);
  const fields = {};

  for (const field of spec.fields) {
    const entry = raw?.[field.name];
    if (!entry) continue;

    const rawValue = typeof entry === 'object' ? entry.wert : entry;
    if (rawValue === null || rawValue === undefined) continue;

    // Mehrzeilige Felder (USP, Claims) behalten ihre Zeilenstruktur,
    // einzeilige werden auf eine Zeile eingedampft
    const collapsed = String(rawValue).replace(/[ \t]+/g, ' ');
    let value = field.type === 'number'
      ? collapsed.replace(/\s+/g, ' ').trim()
      : collapsed.split('\n').map((l) => l.trim()).filter(Boolean).join('\n').trim();
    if (!value || /^(null|n\/a|unbekannt|keine angabe|nicht angegeben)$/i.test(value)) continue;

    if (field.name === 'webseite') {
      value = normalizeWebsite(value);
      if (!value) continue;
    }
    if (field.name === 'invoice_email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) continue;
    if (field.type === 'number') {
      value = normalizeNumber(value);
      if (!value) continue;
    }

    fields[field.name] = {
      value,
      kind: kinds[field.name] || 'guess',
      from: typeof entry === 'object' && entry.quelle ? String(entry.quelle).slice(0, 60) : null
    };
  }

  return fields;
}

function normalizeWebsite(value) {
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

/**
 * "29,90 €" oder "ab 1.299,00 EUR" zu "29.90" bzw. "1299.00". Das number-Input
 * im Formular akzeptiert nur Punkt als Dezimaltrenner.
 */
function normalizeNumber(value) {
  const match = String(value).match(/-?\d[\d.,\s]*/);
  if (!match) return '';

  let raw = match[0].replace(/\s/g, '');
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');

  if (lastComma > lastDot) {
    // Deutsches Format: Punkte sind Tausendertrenner
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (lastComma !== -1) {
    // Englisches Format: Kommas sind Tausendertrenner
    raw = raw.replace(/,/g, '');
  }

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return '';
  return String(Math.round(parsed * 100) / 100);
}

/** Varianten-Vorschlaege des Modells saeubern. */
function normalizeVarianten(raw, spec) {
  if (!spec.varianten || !Array.isArray(raw)) return [];

  const text = (value) => {
    if (value === null || value === undefined) return null;
    const str = String(value).replace(/\s+/g, ' ').trim();
    if (!str || /^(null|n\/a|keine angabe)$/i.test(str)) return null;
    return str.slice(0, 120);
  };

  const seen = new Set();
  const out = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const name = text(entry.name);
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      name,
      farbe: text(entry.farbe),
      modell_kompatibilitaet: text(entry.modell_kompatibilitaet || entry.modell),
      preis: normalizeNumber(entry.preis ?? '') || null,
      merkmal: text(entry.merkmal)
    });
    if (out.length >= 10) break;
  }

  return out;
}

exports.handler = async (event) => {
  const startedAt = Date.now();
  const remaining = () => TOTAL_BUDGET_MS - (Date.now() - startedAt);

  const requestOrigin = (event.headers || {}).origin || '';
  const origin = getAllowedOrigin(requestOrigin);
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  const user = await verifyAuth(event);
  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let fetcher;

  try {
    const { url, entityType } = JSON.parse(event.body || '{}');
    if (!url) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL fehlt' }) };
    }
    if (!entityType || !hasSpec(entityType)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: `Kein Extraktions-Profil fuer "${entityType}"` }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error('Supabase-Konfiguration fehlt');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const spec = getSpec(entityType);
    console.log(`🔎 site-extract: ${entityType} <- ${url}`);

    // --- Cache -------------------------------------------------------------
    const cached = await readCache(supabase, { url, entityType, specVersion: SPEC_VERSION });
    if (cached) {
      // Das Logo-Bild selbst liegt nicht im Cache, nur seine Quelle - bei einer
      // URL wird neu geladen, bei Inline-SVG steht das Markup direkt im Cache.
      const logoSource = cached.logoSvg
        ? { svg: cached.logoSvg, score: 100, reason: 'cache (inline-svg)' }
        : cached.logoSourceUrl && { url: cached.logoSourceUrl, score: 100, reason: 'cache' };
      const logo = logoSource ? await pickLogo([logoSource]) : null;

      // Temp-Bilder sind nach 24h weg, deshalb liegen im Cache nur die
      // Quell-URLs. Sie neu zu holen kostet Zeit, aber kein Geld.
      let images = [];
      if (spec.images && Array.isArray(cached.imageSourceUrls) && cached.imageSourceUrls.length) {
        images = await collectProductImages(
          cached.imageSourceUrls.map((u) => ({ url: u, score: 100, reason: 'cache' })),
          { supabase, extractId: crypto.randomUUID(), limit: spec.images, remaining, minRemainingMs: IMAGES_MIN_REMAINING_MS }
        );
      }

      // Ein Cache-Treffer kostet nichts. Was er gespart hat, zeigen wir an.
      const cost = { usd: 0, eur: 0, cached: true, saved: cached.cost || null };
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          cached: true,
          source: cached.source || 'cache',
          fields: cached.fields || {},
          logo,
          images,
          varianten: cached.varianten || [],
          notes: cached.notes || [],
          cost
        })
      };
    }

    // --- Seiten laden ------------------------------------------------------
    const notes = [];
    fetcher = createPageFetcher();

    const main = await fetcher.load(url);
    notes.push(...main.notes);

    const mainDistilled = distill(main.html, main.finalUrl, {
      followLinks: spec.followLinks || [],
      withLogo: Boolean(spec.logo)
    });

    // Kandidaten jetzt sammeln, solange das HTML noch im Speicher liegt
    const imageCandidates = spec.images ? findProductImageCandidates(main.html, main.finalUrl) : [];

    const pages = [{ url: main.finalUrl, role: 'Startseite', ...mainDistilled }];

    for (const kind of spec.followLinks || []) {
      const subUrl = mainDistilled.links[kind];
      if (!subUrl) {
        notes.push(`Keine ${kind}-Seite verlinkt gefunden`);
        continue;
      }
      if (subUrl === main.finalUrl) continue;
      if (remaining() < SUBPAGE_MIN_REMAINING_MS) {
        notes.push(`${kind}-Seite wegen Zeitlimit uebersprungen`);
        continue;
      }
      try {
        const sub = await fetcher.load(subUrl);
        pages.push({ url: sub.finalUrl, role: kind, ...distill(sub.html, sub.finalUrl) });
      } catch (err) {
        notes.push(`${kind}-Seite nicht ladbar: ${err.message}`);
      }
    }

    // Browser darf jetzt schliessen, der Claude-Call braucht ihn nicht mehr
    await fetcher.close();
    fetcher = null;

    // --- Felder bestimmen --------------------------------------------------
    const completion = await callClaude({
      model: MODELS[spec.model] || MODELS.extract,
      systemBlocks: [
        { text: SYSTEM_RULES, cache: true },
        { text: `Feldkatalog fuer "${entityType}":\n${buildFieldInstructions(spec)}`, cache: true }
      ],
      userPrompt: buildPrompt(spec, pages),
      maxTokens: spec.maxTokens || 2048
    });

    let parsed;
    try {
      parsed = extractJson(completion.text);
    } catch (err) {
      throw new Error(`Antwort des Modells nicht lesbar: ${err.message}`);
    }

    const fields = normalizeFields(parsed, spec);
    const varianten = normalizeVarianten(parsed._varianten, spec);
    if (Array.isArray(parsed._hinweise)) {
      notes.push(...parsed._hinweise.filter((n) => typeof n === 'string').slice(0, 5));
    }

    const cost = calculateCost(completion.model, completion.usage);
    console.log(`✅ site-extract: ${Object.keys(fields).length} Felder, ${cost ? `${cost.tokens.total} Tokens, ${(cost.eur * 100).toFixed(3)} ct` : 'Kosten unbekannt'}`);

    // --- Logo --------------------------------------------------------------
    let logo = null;
    if (spec.logo && mainDistilled.logoCandidates.length && remaining() > LOGO_MIN_REMAINING_MS) {
      logo = await pickLogo(mainDistilled.logoCandidates);
      if (!logo) notes.push('Kein verwertbares Logo gefunden');
    } else if (spec.logo) {
      notes.push('Kein Logo gefunden');
    }

    // --- Produktbilder -----------------------------------------------------
    let images = [];
    if (spec.images) {
      if (!imageCandidates.length) {
        notes.push('Keine Produktbilder auf der Seite gefunden');
      } else if (remaining() < IMAGES_MIN_REMAINING_MS) {
        notes.push('Produktbilder wegen Zeitlimit uebersprungen');
      } else {
        images = await collectProductImages(imageCandidates, {
          supabase,
          extractId: crypto.randomUUID(),
          limit: spec.images,
          remaining,
          minRemainingMs: IMAGES_MIN_REMAINING_MS
        });
        if (!images.length) notes.push('Kein verwertbares Produktbild gefunden');
      }
    }

    // Ein degradiertes Ergebnis (durchgereichte Bot-Wall) waere 30 Tage lang
    // falsch - beim naechsten Versuch klappt der Browser vielleicht.
    if (main.degraded) {
      notes.push('Seite war nur eingeschraenkt lesbar');
    } else {
      await writeCache(supabase, {
        url,
        entityType,
        specVersion: SPEC_VERSION,
        source: main.source,
        // Absichtlich ohne Bild-Bytes: nur die Quellen, die Bilder werden bei
        // einem Cache-Treffer neu geladen. Haelt die jsonb-Spalte klein.
        result: {
          fields,
          varianten,
          notes,
          source: main.source,
          cost,
          logoSourceUrl: logo?.sourceUrl || null,
          logoSvg: logo?.sourceSvg || null,
          imageSourceUrls: images.map((i) => i.quelle_url).filter(Boolean)
        }
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, cached: false, source: main.source, fields, logo, images, varianten, notes, cost })
    };
  } catch (error) {
    console.error('❌ site-extract:', error.message);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
  } finally {
    if (fetcher) await fetcher.close();
  }
};
