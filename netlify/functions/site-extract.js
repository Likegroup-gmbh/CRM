// site-extract.js
// Liest eine Webseite aus und mappt den Inhalt auf die Felder eines
// Erstellungsformulars. Generisch: welche Felder gefuellt werden, steht
// ausschliesslich in _shared/extract-specs.js.
//
// POST { url, entityType } -> { success, source, cached, fields, logo, images, varianten, notes, cost, diagnostics }

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { callClaude, extractJson, MODELS, ClaudeTimeoutError } = require('./_shared/anthropic');
const { calculateCost } = require('./_shared/claude-cost');
const { SPEC_VERSION, getSpec, hasSpec, buildFieldInstructions, buildSeitentypInstruction, getFieldKinds } = require('./_shared/extract-specs');
const { createPageFetcher } = require('./site-extract-utils/page-fetcher');
const { distill, toPromptBlock } = require('./site-extract-utils/html-distill');
const { classifyPage, TYPEN } = require('./site-extract-utils/page-classify');
const { pickLogo } = require('./site-extract-utils/logo');
const { findProductImageCandidates, collectProductImages } = require('./site-extract-utils/product-images');
const { readCache, writeCache } = require('./site-extract-utils/cache');

// Netlify-Timeout ist auf 60s gesetzt; darunter bleiben wir mit Reserve
const TOTAL_BUDGET_MS = 52000;
const SUBPAGE_MIN_REMAINING_MS = 25000;
// Eine Produkt-Unterseite nachladen lohnt nur, wenn danach noch genug fuer
// den Modell-Call bleibt
const PRODUKT_SUBPAGE_MIN_REMAINING_MS = 30000;
const LOGO_MIN_REMAINING_MS = 9000;
// Bilder sind Beigabe: reisst das Budget, gewinnen die Textfelder
const IMAGES_MIN_REMAINING_MS = 12000;
// Der Modell-Call ist der teuerste Schritt und muss ein hartes Timeout haben,
// sonst laeuft die Function in den 504 und der Client sieht keinen Grund.
// Darunter waere das verbleibende Timeout so knapp, dass der Call fast sicher
// abbricht - dann lieber gar nicht bezahlen und sauber melden
const MODELL_MIN_REMAINING_MS = 18000;
const MODELL_RESERVE_MS = 10000;
const MODELL_MAX_MS = 35000;

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

const SYSTEM_RULES = `Du liest Informationen von Webseiten aus und ordnest sie Formularfeldern zu - von Firmenseiten, einzelnen Produktseiten, Sortiments- und Kategorieseiten und Dienstleistungsangeboten.

Grundhaltung:
- "Angebot" ist weit gefasst: ein physisches Produkt, eine Dienstleistung, ein Abo, ein digitales Angebot, aber auch ein Sortiment oder eine Produktlinie.
- Verweigere die Extraktion NICHT, weil die Seite keine klassische Einzelproduktseite ist. Beschreibe stattdessen das, was tatsaechlich angeboten wird, auf der Abstraktionsebene, die die Seite hergibt.
- Ein Ergebnis ohne jedes Feld ist nur dann richtig, wenn die Seite wirklich keinen Inhalt hatte (Fehlerseite, Bot-Schutz, leere Seite).

Regeln:
- Antworte ausschliesslich mit einem JSON-Objekt, ohne erklaerenden Text.
- Fuer jedes Feld ein Objekt { "wert": <String oder null>, "quelle": <kurze Angabe wie "Impressum", "Startseite", "JSON-LD"> }.
- Felder mit der Kennzeichnung BELEGBAR nur fuellen, wenn der Wert tatsaechlich auf der Seite steht. Niemals raten, niemals plausibel ergaenzen.
- Felder mit der Kennzeichnung ABGELEITET darfst du aus dem Inhalt erschliessen, aber nur wenn es eine nachvollziehbare Grundlage gibt.
- Wenn ein Wert nicht bestimmbar ist: "wert": null. Ein leeres Feld ist deutlich besser als ein erfundener Wert.
- Werte sauber formatieren: keine Labels ("Telefon:"), keine Anfuehrungszeichen, keine Bulletpoint-Zeichen.
- Zeilenumbrueche nur dort, wo die Feldbeschreibung ausdruecklich "ein X pro Zeile" verlangt. Alle anderen Werte einzeilig.
- Optional zusaetzlich "_hinweise": Array kurzer deutscher Saetze zu auffaelligen Luecken. Kein Hinweis darauf, dass die Seite keine Einzelproduktseite ist - das ist bekannt und steht in der Einordnung.`;

function buildPrompt(spec, pages, seitentyp) {
  const fieldList = spec.fields.map((f) => `"${f.name}"`).join(', ');
  return [
    `Fuelle diese Felder aus: ${fieldList}.`,
    '',
    // Nur seitentyp-bewusste Specs bekommen die Einordnung: bei Firmendaten
    // aus dem Impressum ist sie irrelevant und wuerde nur ablenken.
    ...(spec.seitentyp ? [buildSeitentypInstruction(seitentyp), ''] : []),
    'Feldbeschreibungen:',
    buildFieldInstructions(spec),
    '',
    'Inhalt der Webseite:',
    '',
    toPromptBlock(pages)
  ].join('\n');
}

/** Selbstauskunft des Modells fuer die Diagnose, nie fuer das Formular. */
function readSelbstauskunft(parsed) {
  const typ = typeof parsed?._seitentyp === 'string' ? parsed._seitentyp.slice(0, 40) : null;
  const roh = Number.parseInt(parsed?._vollstaendigkeit, 10);
  return {
    modellSeitentyp: typ,
    vollstaendigkeit: Number.isFinite(roh) ? Math.min(100, Math.max(0, roh)) : null
  };
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

/** Rolle einer Seite im Prompt - das Modell soll wissen, was es da liest. */
const SEITEN_ROLLEN = {
  [TYPEN.PRODUKTSEITE]: 'Produktseite',
  [TYPEN.SHOP_UEBERSICHT]: 'Sortiments- oder Uebersichtsseite',
  [TYPEN.DIENSTLEISTUNG]: 'Angebotsseite (Dienstleistung)',
  [TYPEN.BLOCKIERT]: 'Seite, nur eingeschraenkt lesbar',
  [TYPEN.UNKLAR]: 'Seite'
};

exports.handler = async (event) => {
  const startedAt = Date.now();
  const remaining = () => TOTAL_BUDGET_MS - (Date.now() - startedAt);

  // Wird durchgaengig mitgefuehrt und auch im Fehlerfall ausgeliefert: ohne
  // diese Diagnose ist im Browser nicht nachvollziehbar, WARUM eine
  // Extraktion leer bleibt oder abbricht.
  const diagnostics = {
    seitentyp: null,
    signale: [],
    seiten: [],
    schritte: {},
    budget: { gesamtMs: TOTAL_BUDGET_MS },
    modell: null,
    abbruch: null
  };

  const messen = async (name, fn) => {
    const t = Date.now();
    try {
      return await fn();
    } finally {
      diagnostics.schritte[name] = Date.now() - t;
    }
  };

  const abschluss = () => {
    diagnostics.budget.verbrauchtMs = Date.now() - startedAt;
    diagnostics.budget.restMs = Math.max(0, remaining());
    return diagnostics;
  };

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
    diagnostics.entityType = entityType;
    diagnostics.url = url;
    console.log(`🔎 site-extract: ${entityType} <- ${url}`);

    // --- Cache -------------------------------------------------------------
    const cached = await messen('cache', () => readCache(supabase, { url, entityType, specVersion: SPEC_VERSION }));
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
      diagnostics.cacheTreffer = true;
      diagnostics.seitentyp = cached.seitentyp || null;
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
          cost,
          diagnostics: abschluss()
        })
      };
    }

    // --- Seiten laden ------------------------------------------------------
    const notes = [];
    fetcher = createPageFetcher();

    const main = await messen('laden', () => fetcher.load(url, { remainingMs: remaining() }));
    notes.push(...main.notes);
    diagnostics.seiten.push({
      url: main.finalUrl,
      rolle: 'Hauptseite',
      quelle: main.source,
      eingeschraenkt: main.degraded,
      zeichenHtml: main.html.length,
      consent: main.consent || null,
      ...main.timings
    });

    const mainDistilled = distill(main.html, main.finalUrl, {
      followLinks: spec.followLinks || [],
      withLogo: Boolean(spec.logo)
    });

    // --- Einordnen ---------------------------------------------------------
    // Reine Heuristik, kein Modell-Call: entscheidet, welche Frage der Prompt
    // stellt und ob eine Produkt-Unterseite nachgeladen wird.
    const klassStart = Date.now();
    const klassifikation = classifyPage({
      html: main.html,
      distilled: mainDistilled,
      url: main.finalUrl,
      degraded: main.degraded
    });
    diagnostics.schritte.einordnen = Date.now() - klassStart;
    diagnostics.seitentyp = klassifikation.typ;
    diagnostics.signale = klassifikation.signale;
    diagnostics.produktLinks = klassifikation.produktLinks.length;
    console.log(`🧭 site-extract: Seitentyp "${klassifikation.typ}" (${klassifikation.signale.join('; ') || 'ohne Signale'})`);

    if (klassifikation.typ === TYPEN.BLOCKIERT) {
      notes.push('Die Seite blockiert automatisierte Zugriffe (Bot-Schutz). Bitte eine andere URL derselben Marke versuchen - oft funktioniert eine direkte Produktseite - oder die Angaben manuell eintragen.');
    }

    // Kandidaten jetzt sammeln, solange das HTML noch im Speicher liegt
    let imageCandidates = spec.images ? findProductImageCandidates(main.html, main.finalUrl) : [];

    const hauptRolle = spec.seitentyp ? SEITEN_ROLLEN[klassifikation.typ] || 'Seite' : 'Startseite';
    const pages = [{ url: main.finalUrl, role: hauptRolle, ...mainDistilled }];

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
        const sub = await fetcher.load(subUrl, { remainingMs: remaining() });
        pages.push({ url: sub.finalUrl, role: kind, ...distill(sub.html, sub.finalUrl) });
        diagnostics.seiten.push({ url: sub.finalUrl, rolle: kind, quelle: sub.source, zeichenHtml: sub.html.length, ...sub.timings });
      } catch (err) {
        notes.push(`${kind}-Seite nicht ladbar: ${err.message}`);
      }
    }

    // --- Produkt-Unterseite bei einer Uebersichtsseite ---------------------
    // Eine Sortimentsseite allein reicht dem Modell nicht fuer Details wie
    // Inhaltsstoffe oder Preise. Genau eine Beispielseite, sonst reisst das
    // Budget vor dem Modell-Call.
    if (spec.seitentyp && klassifikation.typ === TYPEN.SHOP_UEBERSICHT && klassifikation.produktLinks.length) {
      const kandidat = klassifikation.produktLinks[0];
      if (remaining() < PRODUKT_SUBPAGE_MIN_REMAINING_MS) {
        notes.push('Beispiel-Produktseite wegen Zeitlimit uebersprungen');
        diagnostics.unterseiteUebersprungen = 'zeitlimit';
      } else {
        try {
          // Bewusst knappes Budget: der Browser-Fallback bleibt hier aus, eine
          // Produktseite eines erreichbaren Shops laesst sich normal fetchen
          const sub = await messen('unterseite', () => fetcher.load(kandidat.url, { remainingMs: remaining() - MODELL_MIN_REMAINING_MS }));
          pages.push({ url: sub.finalUrl, role: 'Beispiel-Produktseite', ...distill(sub.html, sub.finalUrl) });
          diagnostics.seiten.push({
            url: sub.finalUrl,
            rolle: 'Beispiel-Produktseite',
            quelle: sub.source,
            grund: kandidat.reason,
            zeichenHtml: sub.html.length,
            ...sub.timings
          });
          // Bilder der konkreten Produktseite schlagen die Kacheln der
          // Uebersicht, deshalb nach vorn. Doppelte URLs wuerden sonst einen
          // der wenigen Bild-Slots verbrauchen.
          if (spec.images) {
            const zusammen = [...findProductImageCandidates(sub.html, sub.finalUrl), ...imageCandidates];
            const gesehen = new Set();
            imageCandidates = zusammen.filter((c) => !gesehen.has(c.url) && gesehen.add(c.url));
          }
        } catch (err) {
          notes.push(`Beispiel-Produktseite nicht ladbar: ${err.message}`);
          diagnostics.unterseiteUebersprungen = err.message;
        }
      }
    }

    // Browser darf jetzt schliessen, der Claude-Call braucht ihn nicht mehr
    await fetcher.close();
    fetcher = null;

    // --- Felder bestimmen --------------------------------------------------
    const teilergebnis = (grund, hinweis) => {
      diagnostics.abbruch = grund;
      notes.push(hinweis);
      console.warn(`⏱️ site-extract: Abbruch "${grund}" nach ${Date.now() - startedAt}ms`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          cached: false,
          source: main.source,
          fields: {},
          logo: null,
          images: [],
          varianten: [],
          notes,
          cost: null,
          diagnostics: abschluss()
        })
      };
    };

    if (remaining() < MODELL_MIN_REMAINING_MS) {
      return teilergebnis(
        'zeitlimit-vor-auswertung',
        'Das Laden der Seite hat das Zeitbudget aufgebraucht, die Auswertung konnte nicht mehr starten. Ein zweiter Versuch ist meist schneller, weil die Seite dann im Cache des Anbieters liegt.'
      );
    }

    const modellName = MODELS[spec.model] || MODELS.extract;
    // Restbudget minus Reserve fuer Bilder, Cache-Schreiben und Antwort
    const modellTimeoutMs = Math.min(MODELL_MAX_MS, remaining() - MODELL_RESERVE_MS);
    const userPrompt = buildPrompt(spec, pages, klassifikation.typ);
    diagnostics.modell = { name: modellName, timeoutMs: modellTimeoutMs, promptZeichen: userPrompt.length };

    let completion;
    try {
      completion = await messen('modell', () => callClaude({
        model: modellName,
        systemBlocks: [
          { text: SYSTEM_RULES, cache: true },
          { text: `Feldkatalog fuer "${entityType}":\n${buildFieldInstructions(spec)}`, cache: true }
        ],
        userPrompt,
        maxTokens: spec.maxTokens || 2048,
        timeoutMs: modellTimeoutMs
      }));
    } catch (err) {
      if (!(err instanceof ClaudeTimeoutError)) throw err;
      return teilergebnis(
        'modell-timeout',
        `Die Auswertung wurde nach ${Math.round(modellTimeoutMs / 1000)}s abgebrochen, damit die Funktion nicht in ihr Zeitlimit laeuft. Bei sehr umfangreichen Seiten hilft eine konkretere URL, etwa direkt die Produktseite.`
      );
    }

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
    Object.assign(diagnostics.modell, readSelbstauskunft(parsed), {
      antwortModell: completion.model,
      tokens: cost?.tokens || null
    });
    diagnostics.feldAnzahl = Object.keys(fields).length;
    diagnostics.variantenAnzahl = varianten.length;
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
    // falsch - beim naechsten Versuch klappt der Browser vielleicht. Ebenso ein
    // leeres Ergebnis: sonst liefert dieselbe URL 30 Tage lang nichts, auch
    // nachdem die Extraktion verbessert wurde.
    if (main.degraded) {
      notes.push('Seite war nur eingeschraenkt lesbar, Ergebnis wird nicht zwischengespeichert');
      diagnostics.cacheGeschrieben = false;
    } else if (!Object.keys(fields).length) {
      notes.push('Kein Feld konnte gefuellt werden, das Ergebnis wird nicht zwischengespeichert');
      diagnostics.cacheGeschrieben = false;
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
          seitentyp: klassifikation.typ,
          cost,
          logoSourceUrl: logo?.sourceUrl || null,
          logoSvg: logo?.sourceSvg || null,
          imageSourceUrls: images.map((i) => i.quelle_url).filter(Boolean)
        }
      });
      diagnostics.cacheGeschrieben = true;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, cached: false, source: main.source, fields, logo, images, varianten, notes, cost, diagnostics: abschluss() })
    };
  } catch (error) {
    console.error('❌ site-extract:', error.message);
    diagnostics.abbruch = 'fehler';
    diagnostics.fehler = error.message;
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message, diagnostics: abschluss() }) };
  } finally {
    if (fetcher) await fetcher.close();
  }
};
