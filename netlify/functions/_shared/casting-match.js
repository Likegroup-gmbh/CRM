// casting-match.js
// Deterministischer Kern der Casting-Creator-Vorschlaege (ADR 0013/0014/0020):
// Bedarf bauen, Gates, drei Scores (Fit/Track/Fresh), finaler Matching-Score,
// Quote 6 pro Briefing-Persona (greedy, exklusiv), Validate.
// Das LLM schreibt nur fit_grund/risiken auf der Shortlist - es rankt nie.

const config = require('./casting-match-config');
const { attachAudienceSituations, fmtAudienceSituations } = require('./audience-situation');
const { leitplankenAusBriefing } = require('./skript-context/briefing-felder');

const {
  MATCHING_WEIGHTS,
  BEREICH_PREFIX,
  BEREICH_TYP,
  GROESSEN_BAENDER,
  NISCHE_TOKENS,
  NISCHE_NACHBARN,
  VORAUSSETZUNG_FELDER,
  GESCHLECHT_SONDER,
  PROFILES,
  SCHWELLEN,
  ANZAHL,
  MAX_SHORTLIST_IM_PROMPT
} = config;

// ---------------------------------------------------------------------------
// Normierung
// ---------------------------------------------------------------------------

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function normListe(value) {
  if (Array.isArray(value)) return value.map(norm).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(s => norm(s)).filter(Boolean);
  return [];
}

function tokens(text) {
  return norm(text).split(/[^a-zäöüß0-9]+/i).filter(t => t.length > 2);
}

/** "25-34" / "25 bis 34" / 25 -> [von, bis] oder null */
function parseAlterSpanne(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return [value, value];
  const m = String(value).match(/(\d{1,3})\s*(?:-|bis)\s*(\d{1,3})/);
  if (m) return [Number(m[1]), Number(m[2])];
  const einzeln = String(value).match(/(\d{1,3})/);
  return einzeln ? [Number(einzeln[1]), Number(einzeln[1])] : null;
}

function spannenSchneiden(a, b) {
  if (!a || !b) return false;
  return a[0] <= b[1] && b[0] <= a[1];
}

// ---------------------------------------------------------------------------
// Bedarf aus Briefing + Produkte + akzeptierte Personas
// ---------------------------------------------------------------------------

function bedarfFingerprint(bedarf) {
  const alter = bedarf.alter
    ? `${Math.floor(bedarf.alter[0] / 10) * 10}-${Math.floor(bedarf.alter[1] / 10) * 10}`
    : 'offen';
  const personaKey = [...(bedarf.personas || []).map(p => p.id).filter(Boolean)].sort().join('+') || 'offen';
  return [
    bedarf.bereich || 'offen',
    [...(bedarf.nischen || [])].sort().join('+') || 'offen',
    [...(bedarf.groessen || [])].sort().join('+') || 'offen',
    [...(bedarf.geschlechter || [])].sort().join('+') || 'offen',
    alter,
    [...(bedarf.maerkte || [])].sort().join('+') || 'offen',
    personaKey,
    norm(bedarf.donts).slice(0, 80) || 'offen'
  ].join('|');
}

/**
 * Baut den Bedarf aus einer campaign_briefings-Zeile. Liest nur den aktiven
 * bereich (im_/pa_/os_), dazu Markt/Sprache/Ansatz/Learnings.
 */
function buildBedarf(briefing = {}, { produktIds = [], personas = [] } = {}) {
  const bereich = briefing.bereich || null;
  const prefix = BEREICH_PREFIX[bereich] || null;
  const g = (feld) => (prefix ? briefing[`${prefix}_${feld}`] : null);

  const nischen = normListe(g('nischen')).filter(n => n !== 'keine_vorgabe' && n !== 'sonstiges');
  const groessen = normListe(g('creator_groessen')).filter(x => x !== 'keine_vorgabe');
  const voraussetzungen = normListe(g('voraussetzungen'));
  const merkmale = g('creator_merkmale') && typeof g('creator_merkmale') === 'object' ? g('creator_merkmale') : {};

  const alter = parseAlterSpanne(merkmale.alter);
  const geschlechter = normListe(merkmale.geschlecht);
  const standort = String(merkmale.standort || '').trim() || null;
  const expertise = String(merkmale.expertise || '').trim() || null;

  const umsetzung = String(g('umsetzung') || '').trim() || null;
  const situationen = String(g('situationen') || '').trim() || null;

  // Learnings nur aus dem aktiven Bereich
  const learningsText = [g('learnings_text')].filter(Boolean).join('\n').trim() || null;

  const bedarf = {
    bereich,
    typ: BEREICH_TYP[bereich] || null,
    nischen,
    groessen,
    voraussetzungen,
    alter,
    geschlechter,
    standort,
    expertise,
    umsetzung,
    situationen,
    learningsText,
    maerkte: normListe(briefing.maerkte),
    sprachen: normListe([...(briefing.sprachen || []), ...(briefing.weitere_sprachen || [])]),
    kanaele: kanaeleAusBriefing(briefing, prefix),
    ansatz: briefing.ansatz || null,
    alwaysOnBestehend: briefing.always_on_bestehend || null,
    kampagnentypen: normListe(briefing.kampagnentypen),
    produktIds: [...new Set((produktIds || []).filter(Boolean))],
    personas: (personas || []).map(mapPersona),
    dos: leitplankenAusBriefing(briefing).dos || null,
    donts: leitplankenAusBriefing(briefing).donts || null,
    hauttyp: String(briefing.hauttyp || '').trim() || null,
    haartyp: String(briefing.haartyp || '').trim() || null
  };
  bedarf.fingerprint = bedarfFingerprint(bedarf);
  return bedarf;
}

function mapPersona(p = {}) {
  const brancheName = p.branche_name || p.branche?.name || p.branchen?.name || null;
  return {
    id: p.id || null,
    name: p.name || null,
    oberbegriff: p.oberbegriff || null,
    alter: Array.isArray(p.alter)
      ? p.alter
      : ((p.alter_von != null || p.alter_bis != null)
        ? [p.alter_von ?? 0, p.alter_bis ?? 99]
        : null),
    geschlecht: norm(p.geschlecht),
    wohnort_region: String(p.wohnort_region || '').trim() || null,
    beruf: String(p.beruf || '').trim() || null,
    budgetrahmen: p.budgetrahmen || null,
    bildungsstand: String(p.bildungsstand || '').trim() || null,
    lebenssituation: norm(p.lebenssituation),
    branche_id: p.branche_id || null,
    branche_name: brancheName,
    pain_points: p.pain_points || null,
    interessen: p.interessen || null,
    beduerfnisse: p.beduerfnisse || null,
    kaufmotive: p.kaufmotive || null,
    einwaende: p.einwaende || null,
    produkt_loesung: p.produkt_loesung || null,
    produktvorteile: p.produktvorteile || null,
    tonalitaet: p.tonalitaet || null,
    plattformen: p.plattformen || null,
    content_praeferenzen: p.content_praeferenzen || null,
    beschreibung: p.beschreibung || null,
    audience_situations: Array.isArray(p.audience_situations) ? p.audience_situations : [],
    produktFits: Array.isArray(p.produktFits) ? p.produktFits : []
  };
}

function personaFreitext(p) {
  if (!p) return '';
  const as = fmtAudienceSituations(p.audience_situations, 400);
  const fits = (p.produktFits || [])
    .map(f => [f.fit_grund, ...(f.use_case_namen || [])].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(' ');
  return [
    p.oberbegriff, p.beruf, p.bildungsstand, p.budgetrahmen,
    p.pain_points, p.interessen, p.beduerfnisse,
    p.kaufmotive, p.einwaende, p.produkt_loesung, p.produktvorteile,
    p.tonalitaet, p.plattformen, p.content_praeferenzen, p.beschreibung,
    as, fits
  ].filter(Boolean).join(' ');
}

/** Briefing-Bedarf plus genau eine Persona-Karte (Score + Explain). */
function bedarfFuerPersona(bedarf, persona) {
  const p = mapPersona(persona);
  return {
    ...bedarf,
    persona: p,
    personas: [p],
    personaText: personaFreitext(p)
  };
}

/** Kanaele aus im_channels/os_channels (instagram/tiktok) bzw. pa_channels (meta/tiktok). */
function kanaeleAusBriefing(briefing, prefix) {
  const out = new Set();
  if (prefix === 'pa') {
    const ch = briefing.pa_channels;
    if (ch && typeof ch === 'object') {
      if (ch.tiktok) out.add('tiktok');
      if (Array.isArray(ch.meta) && ch.meta.length) out.add('instagram');
      if (Array.isArray(ch.youtube) && ch.youtube.length) out.add('youtube');
    } else {
      out.add('instagram'); out.add('tiktok');
    }
    return [...out];
  }
  const ch = prefix ? briefing[`${prefix}_channels`] : null;
  if (ch && typeof ch === 'object') {
    if (Array.isArray(ch.instagram) && ch.instagram.length) out.add('instagram');
    if (ch.tiktok) out.add('tiktok');
    if (Array.isArray(ch.youtube) && ch.youtube.length) out.add('youtube');
  } else {
    out.add('instagram'); out.add('tiktok');
  }
  return [...out];
}

function quoteProPersona() {
  return ANZAHL.proPersona;
}

// ---------------------------------------------------------------------------
// Kandidaten-Normierung (eine Creator-Zeile + Junctions)
// ---------------------------------------------------------------------------

function normiereKandidat(c = {}) {
  const typen = Array.isArray(c.creator_creator_type)
    ? c.creator_creator_type.map(j => j?.creator_type_id?.name).filter(Boolean)
    : (c.creator_types || []);
  const branchen = Array.isArray(c.creator_branchen)
    ? c.creator_branchen.map(j => j?.branche_id?.name).filter(Boolean)
    : (c.branchen || []);
  const sprachen = Array.isArray(c.creator_sprachen)
    ? c.creator_sprachen.map(j => j?.sprachen?.name).filter(Boolean)
    : (c.sprachen || []);
  const mentions = Array.isArray(c.ig_brand_mentions) ? c.ig_brand_mentions : [];
  return {
    id: c.id,
    vorname: c.vorname || '',
    nachname: c.nachname || '',
    geschlecht: norm(c.geschlecht),
    alter: (c.alter_min != null || c.alter_max != null)
      ? [c.alter_min ?? c.alter_jahre ?? 0, c.alter_max ?? c.alter_jahre ?? 99]
      : (c.alter_jahre != null ? [c.alter_jahre, c.alter_jahre] : null),
    alterBekannt: c.alter_min != null || c.alter_max != null || c.alter_jahre != null,
    typen,
    branchen,
    branchenTokens: new Set(normListe(branchen).flatMap(b => [b, ...tokens(b)])),
    sprachen: normListe(sprachen),
    land: norm(c.lieferadresse_land),
    stadt: norm(c.lieferadresse_stadt),
    plz: String(c.lieferadresse_plz || '').trim(),
    instagram: String(c.instagram || '').trim(),
    tiktok: String(c.tiktok || '').trim(),
    follower: Math.max(Number(c.instagram_follower) || 0, Number(c.tiktok_follower) || 0),
    mail: String(c.mail || '').trim(),
    telefon: String(c.telefonnummer || '').trim(),
    hatHaustier: c.hat_haustier ?? null,
    hatKinder: c.hat_kinder ?? null,
    spieltInstrument: c.spielt_instrument ?? null,
    budget: c.budget_letzte_buchung ?? null,
    bio: String(c.ig_biography || '').trim(),
    notiz: String(c.notiz || '').trim(),
    captions: captionsAusPosts(c.ig_recent_posts),
    mentions: mentions.map(m => (typeof m === 'string' ? m : (m?.username || m?.name || ''))).filter(Boolean),
    er: c.ig_engagement_rate_clean ?? c.ig_engagement_rate ?? null,
    followerFenster: followerFensterAus(c)
  };
}

function captionsAusPosts(posts) {
  if (!Array.isArray(posts)) return [];
  return posts.map(p => (typeof p === 'string' ? p : p?.caption)).map(s => String(s || '').trim()).filter(Boolean);
}

/** Zahl, "10000-25000" oder "1000000+" -> [von, bis]. Leer, wenn nichts Brauchbares da ist. */
function followerFensterVonWert(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return [raw, raw];
  const s = String(raw).trim().replace(/\./g, '');
  if (!s) return null;
  if (s.endsWith('+')) {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? [n, Infinity] : null;
  }
  const parts = s.split('-').map(p => parseInt(p, 10)).filter(n => Number.isFinite(n));
  if (parts.length >= 2) return [parts[0], parts[1]];
  if (parts.length === 1 && parts[0] > 0) return [parts[0], parts[0]];
  return null;
}

function followerFensterAus(c) {
  const fenster = [followerFensterVonWert(c.instagram_follower), followerFensterVonWert(c.tiktok_follower)].filter(Boolean);
  if (!fenster.length) return null;
  return [Math.min(...fenster.map(f => f[0])), Math.max(...fenster.map(f => f[1]))];
}

function gefragteGeschlechter(liste) {
  return normListe(liste).filter(g => g && g !== 'keine vorgabe' && g !== 'gemischt');
}

function geschlechtTrifft(gefragt, kandidatGeschlecht) {
  const liste = gefragteGeschlechter(gefragt);
  if (!liste.length) return true;
  const g = norm(kandidatGeschlecht);
  if (!g) return false;
  if (GESCHLECHT_SONDER.includes(g)) return true;
  return liste.some(q => g.includes(q) || q.includes(g));
}

function standortTrifft(k, standort) {
  const s = norm(standort);
  if (!s) return true;
  const trifft = (wert) => !!wert && (wert.includes(s) || s.includes(wert));
  return trifft(k.stadt) || trifft(k.land) || (k.plz && s.includes(k.plz));
}

function plattformTrifft(k, kanaele) {
  if (!kanaele?.length) return true;
  const bekannt = kanaele.filter(ch => ch === 'instagram' || ch === 'tiktok');
  if (!bekannt.length) return true;
  return bekannt.some(ch => (ch === 'instagram' && k.instagram) || (ch === 'tiktok' && k.tiktok));
}

function fensterTrifftGroesse(fenster, groessen) {
  if (!groessen?.length) return true;
  if (!fenster) return false;
  return groessen.some(g => {
    const band = GROESSEN_BAENDER[g];
    if (!band) return false;
    return fenster[0] < band[1] && fenster[1] >= band[0];
  });
}

function groessenBand(fenster) {
  if (!fenster) return null;
  const punkt = fenster[0];
  for (const [name, band] of Object.entries(GROESSEN_BAENDER)) {
    if (punkt >= band[0] && punkt < band[1]) return name;
  }
  return null;
}

function profiltext(k) {
  return norm([k.bio, k.notiz, ...(k.captions || []), ...(k.mentions || [])].join(' \n '));
}

function suchbegriffTrifft(k, begriffe) {
  const text = profiltext(k);
  if (!text) return false;
  return (begriffe || []).some(b => text.includes(norm(b)));
}

function leerLesung() {
  return { suchbegriffe: [], satz: [], ausschluss: {} };
}

/** Dont-Lesung darf Checkboxen nicht umschreiben. Satzverbote sind kein Gate. */
function sanitizeLesung(raw, bedarf = {}) {
  const out = leerLesung();
  const begriffe = Array.isArray(raw?.suchbegriffe) ? raw.suchbegriffe : [];
  out.suchbegriffe = [...new Set(begriffe.map(b => norm(b)).filter(b => b.length >= 3))].slice(0, 12);
  const satz = Array.isArray(raw?.satz) ? raw.satz : [];
  out.satz = satz.map(s => String(s || '').trim()).filter(Boolean).slice(0, 12);
  const a = raw?.ausschluss && typeof raw.ausschluss === 'object' ? raw.ausschluss : {};
  if (!gefragteGeschlechter(bedarf.geschlechter).length) {
    const g = normListe(a.geschlecht).filter(x => x && x !== 'keine vorgabe' && x !== 'gemischt');
    if (g.length) out.ausschluss.geschlecht = g;
  }
  if (!bedarf.groessen?.length) {
    const g = normListe(a.groesse).filter(x => GROESSEN_BAENDER[x]);
    if (g.length) out.ausschluss.groesse = g;
  }
  if (!bedarf.nischen?.length) {
    const n = normListe(a.nische);
    if (n.length) out.ausschluss.nische = n;
  }
  const vor = new Set(normListe(bedarf.voraussetzungen));
  for (const [key, feld] of [['haustier', 'haustier'], ['kinder', 'kind_familie'], ['instrument', 'instrument']]) {
    if (vor.has(feld)) continue;
    const wert = norm(a[key]);
    if (wert === 'ja' || wert === 'nein') out.ausschluss[key] = wert;
  }
  return out;
}

function personaProfilPasst(k, persona) {
  if (!persona) return true;
  const alter = Array.isArray(persona.alter) && persona.alter.length === 2 ? persona.alter : null;
  if (alter && (!k.alter || !spannenSchneiden(alter, k.alter))) return false;
  if (!geschlechtTrifft([persona.geschlecht], k.geschlecht)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Gates (raus oder drin - kein 0.7)
// ---------------------------------------------------------------------------

/**
 * buchungsbild: {
 *   aufDieserListe: Set(creator_id), parallelLive: Set(creator_id)
 * }
 * Abgefragtes Profilfeld: leer oder daneben ist raus.
 * Profiltext (Lesung.suchbegriffe): nur ein Beleg wirft raus.
 * Satz-Donts sind kein Gate. Marken-Ablehnung und fehlende Mail gaten nicht.
 */
function applyGates(kandidaten, bedarf, buchungsbild = {}, lesung = null) {
  const aufListe = buchungsbild.aufDieserListe || new Set();
  const parallel = buchungsbild.parallelLive || new Set();
  const lese = lesung || leerLesung();

  const pass = [];
  const raus = [];

  for (const k of kandidaten) {
    const drop = (grund) => raus.push({ id: k.id, grund });

    if (aufListe.has(k.id)) { drop('bereits_auf_dieser_liste'); continue; }
    if (parallel.has(k.id)) { drop('auf_paralleler_live_liste'); continue; }

    if (bedarf.sprachen?.length) {
      if (!k.sprachen.length) { drop('sprache_fehlt'); continue; }
      const hit = bedarf.sprachen.some(s => k.sprachen.some(ks => ks.includes(s) || s.includes(ks)));
      if (!hit) { drop('sprache_fehlt'); continue; }
    }

    if (bedarf.maerkte?.length) {
      if (!k.land) { drop('land_fehlt'); continue; }
      const hit = bedarf.maerkte.some(m => k.land.includes(m) || m.includes(k.land));
      if (!hit) { drop('land_fehlt'); continue; }
    }

    if (bedarf.typ) {
      if (!k.typen.length) { drop('typ_passt_nicht'); continue; }
      const ziel = bedarf.typ === 'UGC Paid' || bedarf.typ === 'UGC Organic' ? 'ugc' : norm(bedarf.typ);
      const hit = k.typen.some(t => {
        const nt = norm(t);
        return nt.includes(ziel) || ziel.includes(nt);
      });
      if (!hit) { drop('typ_passt_nicht'); continue; }
    }

    let voraussetzungOk = true;
    for (const v of (bedarf.voraussetzungen || [])) {
      const feld = VORAUSSETZUNG_FELDER[v];
      if (!feld) continue;
      const kandidatWert = feld === 'hat_haustier' ? k.hatHaustier
        : feld === 'hat_kinder' ? k.hatKinder
        : k.spieltInstrument;
      if (kandidatWert !== true) { voraussetzungOk = false; break; }
    }
    if (!voraussetzungOk) { drop('voraussetzung_fehlt'); continue; }

    if (bedarf.alter && (!k.alter || !spannenSchneiden(bedarf.alter, k.alter))) {
      drop('alter_ausserhalb'); continue;
    }

    if (bedarf.nischen?.length && !nischenTreffer(k.branchenTokens, bedarf.nischen).primaer) {
      drop('nische_fehlt'); continue;
    }

    if (bedarf.groessen?.length && !fensterTrifftGroesse(k.followerFenster, bedarf.groessen)) {
      drop('groesse_fehlt'); continue;
    }

    if (!geschlechtTrifft(bedarf.geschlechter, k.geschlecht)) {
      drop('geschlecht_fehlt'); continue;
    }

    if (bedarf.standort && !standortTrifft(k, bedarf.standort)) {
      drop('standort_fehlt'); continue;
    }

    if (!plattformTrifft(k, bedarf.kanaele)) {
      drop('plattform_fehlt'); continue;
    }

    if (lese.ausschluss?.geschlecht?.length && !geschlechtTrifft(
      gefragteGeschlechter(bedarf.geschlechter).length ? [] : invertGeschlecht(lese.ausschluss.geschlecht),
      k.geschlecht
    ) && !GESCHLECHT_SONDER.includes(k.geschlecht)) {
      drop('geschlecht_fehlt'); continue;
    }

    if (lese.ausschluss?.groesse?.length) {
      const band = groessenBand(k.followerFenster);
      if (!band || lese.ausschluss.groesse.includes(band)) { drop('groesse_fehlt'); continue; }
    }

    if (lese.ausschluss?.nische?.length && (
      !k.branchen.length || nischenTreffer(k.branchenTokens, lese.ausschluss.nische).primaer
    )) {
      drop('nische_fehlt'); continue;
    }

    if (boolAusschluss(lese.ausschluss?.haustier, k.hatHaustier)) { drop('voraussetzung_fehlt'); continue; }
    if (boolAusschluss(lese.ausschluss?.kinder, k.hatKinder)) { drop('voraussetzung_fehlt'); continue; }
    if (boolAusschluss(lese.ausschluss?.instrument, k.spieltInstrument)) { drop('voraussetzung_fehlt'); continue; }

    if (suchbegriffTrifft(k, lese.suchbegriffe)) { drop('profiltext'); continue; }

    pass.push(k);
  }

  return { pass, raus };
}

/** Ausschluss-Liste "keine Maenner" -> erlaubt ist alles andere. Leer bleibt raus. */
function invertGeschlecht(verboten) {
  const alle = ['männlich', 'weiblich', 'divers'];
  const weg = new Set(normListe(verboten));
  return alle.filter(g => !weg.has(g));
}

/** 'ja' wirft Belegte und Leere. 'nein' wirft Nein und Leere. */
function boolAusschluss(pol, wert) {
  if (pol !== 'ja' && pol !== 'nein') return false;
  if (wert == null) return true;
  return pol === 'ja' ? wert === true : wert === false;
}

// ---------------------------------------------------------------------------
// Scores (0-100 je Achse, nicht verrechnet)
// ---------------------------------------------------------------------------

function nischenTreffer(kandidatTokens, nischen) {
  let primaer = false;
  let nachbar = false;
  for (const n of (nischen || [])) {
    const toks = NISCHE_TOKENS[n] || [n];
    if (toks.some(t => kandidatTokens.has(t))) primaer = true;
    for (const nb of (NISCHE_NACHBARN[n] || [])) {
      const nbToks = NISCHE_TOKENS[nb] || [nb];
      if (nbToks.some(t => kandidatTokens.has(t))) nachbar = true;
    }
  }
  return { primaer, nachbar };
}

function personaLebenslageTrifft(lage, k) {
  if (!lage) return false;
  if (/familie|alleinerziehend|eltern/.test(lage)) return k.hatKinder === true;
  if (lage.includes('ohne kinder') || lage === 'single') return k.hatKinder === false;
  const profil = new Set([...tokens(k.bio), ...tokens(k.notiz), ...(k.branchen || []).flatMap(tokens)]);
  if (lage.includes('student')) return ['student', 'studium', 'uni'].some(t => profil.has(t));
  if (lage.includes('rentner')) return ['rentner', 'pension', 'ruhestand'].some(t => profil.has(t));
  if (lage.includes('wg')) return profil.has('wg') || profil.has('wohngemeinschaft');
  if (lage.includes('behinderung')) return ['behinderung', 'disability', 'rollstuhl'].some(t => profil.has(t));
  return tokens(lage).some(t => profil.has(t));
}

function scoreFit(k, bedarf, gewichte) {
  const coverage = {};
  let punkte = 0;

  // Nische vs. Branchen
  const treffer = nischenTreffer(k.branchenTokens, bedarf.nischen);
  if (!bedarf.nischen?.length) { coverage.nische = 'offen'; }
  else if (treffer.primaer) { punkte += gewichte.nische; coverage.nische = 'treffer'; }
  else { coverage.nische = 'kein_treffer'; }

  // Persona: genau eine Karte (bedarf.persona bzw. einzige personas[0])
  const personaKarte = bedarf.persona
    || ((bedarf.personas || []).length === 1 ? bedarf.personas[0] : null);
  const persona = personaKarte ? mapPersona(personaKarte) : null;
  if (!persona || !(persona.alter || persona.geschlecht || persona.lebenssituation
    || persona.branche_name || persona.wohnort_region)) {
    coverage.persona = 'offen';
  } else {
    let s = 0;
    const dim = [];
    let belegt = false;
    if (persona.alter && k.alter) {
      dim.push(1);
      if (spannenSchneiden(persona.alter, k.alter)) { s += 0.3; belegt = true; }
    }
    if (persona.geschlecht && !GESCHLECHT_SONDER.includes(k.geschlecht)) {
      dim.push(1);
      const pg = persona.geschlecht;
      if ((pg === 'gemischt') || k.geschlecht.includes(pg) || pg.includes(k.geschlecht)) {
        s += 0.25; belegt = true;
      }
    }
    if (persona.lebenssituation) {
      dim.push(1);
      if (personaLebenslageTrifft(persona.lebenssituation, k)) { s += 0.2; belegt = true; }
    }
    if (persona.branche_name) {
      dim.push(1);
      const toks = tokens(persona.branche_name);
      if (toks.some(t => k.branchenTokens.has(t))) { s += 0.15; belegt = true; }
    }
    if (persona.wohnort_region) {
      dim.push(1);
      const sOrt = norm(persona.wohnort_region);
      const trifft = (wert) => !!wert && (wert.includes(sOrt) || sOrt.includes(wert));
      if (trifft(k.stadt) || trifft(k.land) || (k.plz && sOrt.includes(k.plz))) {
        s += 0.1; belegt = true;
      }
    }
    if (dim.length) {
      punkte += (s / dim.length) * gewichte.persona;
    }
    coverage.persona = belegt ? 'treffer' : (s > 0 ? 'teil' : 'kein_treffer');
  }

  // Groesse im Band (weicher Abfall ausserhalb)
  if (!bedarf.groessen?.length) { coverage.groesse = 'offen'; }
  else if (!k.follower) { coverage.groesse = 'unbekannt'; punkte += gewichte.groesse * 0.3; }
  else {
    const drin = bedarf.groessen.some(g => {
      const band = GROESSEN_BAENDER[g];
      return band && k.follower >= band[0] && k.follower < band[1];
    });
    if (drin) { punkte += gewichte.groesse; coverage.groesse = 'treffer'; }
    else { punkte += gewichte.groesse * 0.3; coverage.groesse = 'ausserhalb'; }
  }

  // Plattform vorhanden
  if (!bedarf.kanaele?.length) { coverage.plattform = 'offen'; }
  else {
    const hit = (bedarf.kanaele.includes('instagram') && k.instagram)
      || (bedarf.kanaele.includes('tiktok') && k.tiktok);
    if (hit) { punkte += gewichte.plattform; coverage.plattform = 'treffer'; }
    else coverage.plattform = 'kein_treffer';
  }

  // Brand-Mentions / Bio gegen Produktnische
  if (!bedarf.nischen?.length) { coverage.mentions = 'offen'; }
  else {
    const text = norm([...k.mentions, k.bio].join(' '));
    const hit = bedarf.nischen.some(n => (NISCHE_TOKENS[n] || [n]).some(t => text.includes(t)));
    if (hit) { punkte += gewichte.mentions; coverage.mentions = 'treffer'; }
    else coverage.mentions = 'kein_treffer';
  }

  // Standort nur wenn gesetzt. Stadt, PLZ und Land pruefen - ein
  // Laender-Bedarf ("Deutschland") muss gegen k.land matchen, sonst
  // verliert jeder Inlands-Kandidat die Punkte (Bug, ADR 0014).
  if (!bedarf.standort) { coverage.standort = 'offen'; }
  else {
    const s = norm(bedarf.standort);
    const trifft = (wert) => !!wert && (wert.includes(s) || s.includes(wert));
    if (trifft(k.stadt) || trifft(k.land) || (k.plz && s.includes(k.plz))) {
      punkte += gewichte.standort; coverage.standort = 'treffer';
    } else coverage.standort = 'kein_treffer';
  }

  // Strukturierte Voraussetzungen: bekannt-erfuellt voll, unbekannt halb + Flag
  const rel = (bedarf.voraussetzungen || []).filter(v => VORAUSSETZUNG_FELDER[v]);
  if (!rel.length || !gewichte.voraussetzung) { coverage.voraussetzung = 'offen'; }
  else {
    let voll = 0;
    let unbekannt = 0;
    for (const v of rel) {
      const feld = VORAUSSETZUNG_FELDER[v];
      const w = feld === 'hat_haustier' ? k.hatHaustier : feld === 'hat_kinder' ? k.hatKinder : k.spieltInstrument;
      if (w === true) voll++;
      else if (w === null || w === undefined) unbekannt++;
    }
    punkte += (voll / rel.length) * gewichte.voraussetzung
      + (unbekannt / rel.length) * gewichte.voraussetzung * 0.5;
    coverage.voraussetzung = unbekannt ? 'unverified' : 'treffer';
  }

  // Text-Naehe: Token-Schnitt Umsetzung/Situationen vs. Bio/Notiz (ein Signal)
  const bedarfText = tokens([
    bedarf.umsetzung, bedarf.situationen, bedarf.expertise, bedarf.personaText
  ].filter(Boolean).join(' '));
  if (!bedarfText.length || !gewichte.text) { coverage.text = 'offen'; }
  else {
    const profil = new Set([...tokens(k.bio), ...tokens(k.notiz)]);
    const schnitt = bedarfText.filter(t => profil.has(t)).length;
    const quote = schnitt / Math.max(1, Math.min(bedarfText.length, 20));
    punkte += Math.min(1, quote * 3) * gewichte.text;
    coverage.text = schnitt ? 'treffer' : 'kein_treffer';
  }

  // Preis-Transparenz (nur Influencer-Profil): bekanntes Budget ist buchbar
  if (gewichte.preis) {
    if (k.budget != null) { punkte += gewichte.preis; coverage.preis = 'bekannt'; }
    else { punkte += gewichte.preis * 0.4; coverage.preis = 'unbekannt'; }
  } else coverage.preis = 'offen';

  return { wert: Math.round(Math.min(100, punkte)), coverage };
}

/** Wilson-Lower-Bound: 1/1 ist keine 100 %. */
function wilson(erfolge, n) {
  if (!n) return 0;
  const z = 1.2816; // 80 %
  const p = erfolge / n;
  const nenner = 1 + (z * z) / n;
  const mitte = p + (z * z) / (2 * n);
  const streu = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return Math.max(0, (mitte - streu) / nenner);
}

/**
 * hist: { castings, prio1, angefragt, gebucht, absagen, videos,
 *         er (0-100 Skala Prozent), hatMail, hatTelefonOderManagement }
 */
function scoreTrack(k, hist = {}, gewichte) {
  let punkte = 0;
  const n = hist.castings || 0;

  if (n >= SCHWELLEN.wilsonMinN) {
    punkte += wilson(hist.prio1 || 0, n) * gewichte.prio;
    const anfragen = hist.angefragt || 0;
    punkte += (anfragen ? (hist.gebucht || 0) / anfragen : 0) * gewichte.buchung;
  } else if (n > 0) {
    punkte += ((hist.prio1 || 0) / n) * gewichte.prio * 0.5;
    punkte += ((hist.gebucht || 0) / Math.max(1, hist.angefragt || 0)) * gewichte.buchung * 0.5;
  }
  if (hist.videos > 0) punkte += gewichte.videos;
  if (hist.er != null && Number.isFinite(Number(hist.er))) {
    punkte += Math.min(1, Number(hist.er) / 5) * gewichte.er;
  }
  if (hist.hatMail && (hist.hatTelefonOderManagement)) punkte += gewichte.kontakt;
  else if (hist.hatMail) punkte += gewichte.kontakt * 0.6;

  // Absagequote: Verfügbarkeit, nicht Qualität - nur Abzug
  const aq = n ? (hist.absagen || 0) / n : 0;
  punkte -= Math.min(1, aq * 2) * 10;

  return Math.round(Math.max(0, Math.min(100, punkte)));
}

/**
 * freshFlags: { markeBuchungen90d (Zaehler), fingerprintDabei,
 *               vorgeschlagen3, vorschlaege30d, alwaysOnFortfuehren }
 * Marken-Wiederholung staffelt sich: die erste Buchung in 90 Tagen ist
 * frei, danach progressiver Abzug (marke_90d_stufen, Index = Anzahl).
 */
function scoreFresh(flags = {}, gewichte) {
  if (flags.alwaysOnFortfuehren) return 100;
  let wert = 100;
  const stufen = gewichte.marke_90d_stufen || [0, 0, 10, 25, 40];
  const buchungen = Math.max(0, Number(flags.markeBuchungen90d) || 0);
  wert -= stufen[Math.min(buchungen, stufen.length - 1)];
  if (flags.fingerprintDabei) wert -= gewichte.fingerprint;
  if (flags.vorgeschlagen3) wert -= gewichte.vorgeschlagen3;
  if (flags.vorschlaege30d) {
    wert -= gewichte.global * Math.min(1, flags.vorschlaege30d / SCHWELLEN.globalVorschlaegeNorm);
  }
  return Math.round(Math.max(0, wert));
}

/**
 * Finaler Score (ADR 0014): 0.80 Fit + 0.15 Track + 0.05 Fresh.
 * Cold-Start ohne Casting-Historie: das Track-Gewicht wird auf Fit
 * umverteilt, statt mit ~0 einzugehen - kein Neuling-Malus.
 */
function matchingScore({ fit, track, fresh, castings } = {}) {
  const f = Math.max(0, Math.min(100, Number(fit) || 0));
  const fr = Math.max(0, Math.min(100, Number(fresh) || 0));
  if (!castings) {
    const summe = MATCHING_WEIGHTS.fit + MATCHING_WEIGHTS.fresh;
    return Math.round(Math.min(100, (MATCHING_WEIGHTS.fit * f + MATCHING_WEIGHTS.fresh * fr) / summe));
  }
  const t = Math.max(0, Math.min(100, Number(track) || 0));
  return Math.round(Math.min(100,
    MATCHING_WEIGHTS.fit * f + MATCHING_WEIGHTS.track * t + MATCHING_WEIGHTS.fresh * fr));
}

/** Profil je Kandidat: mix nimmt das Profil seines typ. */
function profilFuer(k, listeTyp) {
  const t = normListe(k.typen).join(' ');
  if (listeTyp === 'ugc') return PROFILES.ugc;
  if (listeTyp === 'influencer') return PROFILES.influencer;
  return t.includes('influencer') ? PROFILES.influencer : PROFILES.ugc;
}

// ---------------------------------------------------------------------------
// Ranking: Top-N (Legacy) und Quote 6 pro Briefing-Persona (ADR 0020)
// ---------------------------------------------------------------------------

/**
 * scored: [{ k, fit, track, fresh, matching, hist, profileName }]
 * Sortiert streng nach Matching absteigend; Tiebreak Fit, dann Fresh.
 */
function topNNachMatching(scored, { anzahl } = {}) {
  const n = Math.max(1, anzahl || quoteProPersona());
  return [...scored]
    .sort((a, b) => (b.matching - a.matching) || (b.fit - a.fit) || (b.fresh - a.fresh))
    .slice(0, n);
}

function erstePersonaId(personaIds, allowedIds = []) {
  const ids = Array.isArray(personaIds) ? personaIds.filter(Boolean) : [];
  if (!ids.length) return null;
  const allowed = (allowedIds || []).filter(Boolean);
  if (!allowed.length) return ids[0];
  const allowedSet = new Set(allowed);
  return ids.find(id => allowedSet.has(id)) || null;
}

function splitPendingNachPersona(rows, briefingPersonaIds = []) {
  const frozenByPersona = {};
  for (const id of briefingPersonaIds) frozenByPersona[id] = [];
  const ohne = [];
  for (const row of rows || []) {
    const pid = erstePersonaId(row.persona_ids, briefingPersonaIds);
    if (pid && frozenByPersona[pid]) frozenByPersona[pid].push(row);
    else ohne.push(row);
  }
  return { frozenByPersona, ohne };
}

function lueckenJePersona(personaIds, frozenByPersona = {}, quote = ANZAHL.proPersona) {
  const gap = {};
  for (const id of personaIds || []) {
    const frozen = frozenByPersona[id];
    const n = Array.isArray(frozen) ? frozen.length : Number(frozen) || 0;
    gap[id] = Math.max(0, quote - n);
  }
  return gap;
}

/**
 * Greedy: hoechstes Matching(Creator, Persona) zuerst, Unique creator_id.
 * scoredPairs: [{ k, personaId, matching, fit, fresh, ... }]
 */
function fuellePersonaQuoten(scoredPairs, { gapByPersona = {}, takenIds = new Set(), onlyCreatorIds = null } = {}) {
  const remaining = { ...gapByPersona };
  const taken = new Set(takenIds);
  const assigned = [];
  const only = onlyCreatorIds ? new Set(onlyCreatorIds) : null;

  const sorted = [...(scoredPairs || [])].sort((a, b) =>
    (b.matching - a.matching) || (b.fit - a.fit) || (b.fresh - a.fresh));

  for (const pair of sorted) {
    const pid = pair.personaId;
    if (!pid || !(remaining[pid] > 0)) continue;
    const cid = pair.k?.id || pair.creatorId;
    if (!cid || taken.has(cid)) continue;
    if (only && !only.has(cid)) continue;
    taken.add(cid);
    remaining[pid] -= 1;
    assigned.push(pair);
  }
  return { assigned, remaining, taken };
}

function fitGrundDeterministisch(s, persona) {
  const name = persona?.name || 'Persona';
  const c = s?.coverage || {};
  const bits = [];
  if (c.nische === 'treffer') bits.push('Nische');
  if (c.persona === 'treffer') bits.push('Persona-Demografie');
  if (c.groesse === 'treffer') bits.push('Groesse');
  if (c.plattform === 'treffer') bits.push('Plattform');
  if (c.mentions === 'treffer') bits.push('Mentions');
  if (c.standort === 'treffer') bits.push('Standort');
  if (c.text === 'treffer') bits.push('Profiltext');
  if (!bits.length) return `Matching fuer ${name}.`;
  return `${name}: ${bits.join(', ')}.`;
}

// ---------------------------------------------------------------------------
// Validate (Modell-Antwort gegen die Shortlist)
// ---------------------------------------------------------------------------

function validateVorschlaege(json, { shortlistIds = [], personaIds = [], assignedPersonaByCreator = {} } = {}) {
  const pool = new Set(shortlistIds);
  const personaSet = new Set(personaIds);
  const assignedMap = assignedPersonaByCreator && typeof assignedPersonaByCreator === 'object'
    ? assignedPersonaByCreator
    : {};
  const hasAssigned = Object.keys(assignedMap).length > 0;
  const roh = Array.isArray(json?.vorschlaege) ? json.vorschlaege : [];
  const sauber = [];
  const verworfen = [];
  const gesehen = new Set();

  for (const v of roh) {
    const id = v?.creator_id || null;
    if (!id || !pool.has(id)) {
      verworfen.push({ grund: 'creator_id nicht auf der Shortlist', vorschlag: id });
      continue;
    }
    if (gesehen.has(id)) {
      verworfen.push({ grund: 'doppelter Vorschlag', vorschlag: id });
      continue;
    }
    const fitGrund = String(v?.fit_grund || '').trim();
    if (!fitGrund) {
      verworfen.push({ grund: 'fit_grund ohne belegbares Feld', vorschlag: id });
      continue;
    }
    const rawPid = v?.persona_id
      || (Array.isArray(v?.persona_ids) ? v.persona_ids.find(Boolean) : null)
      || null;
    let pIds;
    if (hasAssigned) {
      const assigned = assignedMap[id];
      if (!assigned) {
        verworfen.push({ grund: 'keine Persona-Zuweisung', vorschlag: id });
        continue;
      }
      if (rawPid && rawPid !== assigned) {
        verworfen.push({ grund: 'persona_id weicht von der Zuweisung ab', vorschlag: id });
        continue;
      }
      pIds = [assigned];
    } else {
      pIds = [...new Set((Array.isArray(v?.persona_ids) ? v.persona_ids : []).filter(p => personaSet.has(p)))];
    }
    gesehen.add(id);
    sauber.push({
      creator_id: id,
      fit_grund: fitGrund,
      risiken: v?.risiken ? String(v.risiken).trim() : null,
      persona_ids: pIds
    });
  }

  return { vorschlaege: sauber, verworfen };
}

// ---------------------------------------------------------------------------
// Donts einmal lesen: Profilfeld-Ausschluss oder Suchbegriffe. Satz bleibt Text.
// ---------------------------------------------------------------------------

const DONT_LESUNG_TOOL = {
  name: 'donts_lesen',
  description: 'Zerlegt Donts in Personen-Ausschluesse, Profiltext-Begriffe und Satzverbote.',
  input_schema: {
    type: 'object',
    properties: {
      suchbegriffe: {
        type: 'array',
        items: { type: 'string' },
        description: 'Woerter, deren Vorkommen in Bio, Caption oder Mention den Creator ausschliesst. Keine Wuensche.'
      },
      satz: {
        type: 'array',
        items: { type: 'string' },
        description: 'Formulierungsverbote. Werfen niemanden aus dem Pool.'
      },
      ausschluss: {
        type: 'object',
        properties: {
          geschlecht: { type: 'array', items: { type: 'string' } },
          groesse: { type: 'array', items: { type: 'string' }, description: 'nano, micro, mid_tier, macro, hero' },
          nische: { type: 'array', items: { type: 'string' } },
          haustier: { type: 'string', enum: ['ja', 'nein'] },
          kinder: { type: 'string', enum: ['ja', 'nein'] },
          instrument: { type: 'string', enum: ['ja', 'nein'] }
        }
      }
    },
    required: ['suchbegriffe', 'satz']
  }
};

function buildDontLesungPrompt(bedarf = {}) {
  const stable = 'Du liest Donts eines Kampagnen-Briefings. Du suchst keine Creator und erfindest keine Regeln. '
    + 'suchbegriffe nur fuer das, was im Profiltext einen Verstoss belegt (Tattoo, Konkurrenzmarke). '
    + 'Hauttyp und Haartyp sind Wuensche und keine suchbegriffe, ausser sie sind als Verbot formuliert. '
    + 'satz sind Verbote der Formulierung, zum Beispiel ein Claim, der nicht gesagt werden darf. '
    + 'ausschluss nur fuer Profilfelder: geschlecht, groesse, nische, haustier, kinder, instrument. '
    + 'haustier "ja" heisst: Creator mit Haustier raus. Ist eine Checkbox schon gesetzt, widersprich ihr nicht.';
  let task = '';
  if (bedarf.donts) task += `# DONTS\n${bedarf.donts}\n`;
  if (bedarf.hauttyp) task += `Hauttyp (Wunsch): ${bedarf.hauttyp}\n`;
  if (bedarf.haartyp) task += `Haartyp (Wunsch): ${bedarf.haartyp}\n`;
  if (bedarf.groessen?.length) task += `Groesse ist gesetzt: ${bedarf.groessen.join(', ')}\n`;
  if (bedarf.nischen?.length) task += `Nische ist gesetzt: ${bedarf.nischen.join(', ')}\n`;
  const geschlecht = gefragteGeschlechter(bedarf.geschlechter);
  if (geschlecht.length) task += `Geschlecht ist gesetzt: ${geschlecht.join(', ')}\n`;
  task += 'Gib das Ergebnis nur ueber das Tool ab.';
  return { stable, task };
}

// ---------------------------------------------------------------------------
// Prompt (Modell schreibt nur fit_grund + Risiken auf der Shortlist)
// ---------------------------------------------------------------------------

const CASTING_TOOL = {
  name: 'casting_vorschlaege_abgeben',
  description: 'Begruendet eine vorgelegte Creator-Shortlist fuer ein Casting.',
  input_schema: {
    type: 'object',
    properties: {
      vorschlaege: {
        type: 'array',
        description: 'Genau ein Eintrag je uebernommener Shortlist-ID.',
        items: {
          type: 'object',
          properties: {
            creator_id: { type: 'string', description: 'ID aus der Shortlist, keine anderen.' },
            fit_grund: { type: 'string', description: 'Zwei bis drei Saetze, nur belegbare Felder (Branche, Alter, Typ, Mentions, Historie). Keine Lyrik, keine Score-Zahlen.' },
            risiken: { type: ['string', 'null'], description: 'Offene Punkte, z.B. unverified Voraussetzung.' },
            persona_id: { type: 'string', description: 'Genau die Persona-ID, die am Shortlist-Eintrag steht.' }
          },
          required: ['creator_id', 'fit_grund']
        }
      }
    },
    required: ['vorschlaege']
  }
};

function cap(value, max = 300) {
  const s = String(value || '').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function fmtKandidat(s) {
  const k = s.k;
  const name = `${k.vorname} ${k.nachname}`.trim() || 'Unbekannt';
  const alter = k.alter ? `${k.alter[0]}-${k.alter[1]}` : 'unbekannt';
  const personaZeile = s.personaId
    ? `Persona: ${s.persona?.name || '?'} (${s.personaId})`
    : null;
  return [
    `ID: ${k.id} | Matching ${s.matching}`,
    personaZeile,
    `Name: ${name}, Geschlecht: ${k.geschlecht || 'unbekannt'}, Alter: ${alter}`,
    `Typen: ${(k.typen || []).join(', ') || 'unbekannt'} | Branchen: ${(k.branchen || []).join(', ') || 'unbekannt'}`,
    `Follower: ${k.follower || 'unbekannt'} | IG: ${k.instagram || '-'} | TT: ${k.tiktok || '-'}`,
    k.mentions?.length ? `Mentions: ${k.mentions.slice(0, 5).join(', ')}` : null,
    k.bio ? `Bio: ${cap(k.bio, 200)}` : null,
    s.hist ? `Historie: ${s.hist.castings || 0}x im Casting, ${s.hist.prio1 || 0}x Prio, ${s.hist.gebucht || 0}x gebucht` : null
  ].filter(Boolean).join('\n  ');
}

function fmtPersonaKarte(p) {
  const persona = mapPersona(p);
  const lines = [
    `- ${persona.name || '?'}${persona.oberbegriff ? ` (${persona.oberbegriff})` : ''}`
      + (persona.id ? ` [${persona.id}]` : '')
  ];
  if (persona.alter) lines.push(`  Alter: ${persona.alter[0]}-${persona.alter[1]}`);
  if (persona.geschlecht) lines.push(`  Geschlecht: ${persona.geschlecht}`);
  if (persona.wohnort_region) lines.push(`  Wohnort: ${cap(persona.wohnort_region, 120)}`);
  if (persona.beruf) lines.push(`  Beruf: ${cap(persona.beruf, 120)}`);
  if (persona.bildungsstand) lines.push(`  Bildung: ${cap(persona.bildungsstand, 80)}`);
  if (persona.budgetrahmen) lines.push(`  Budgetrahmen: ${persona.budgetrahmen}`);
  if (persona.lebenssituation) lines.push(`  Lebenssituation: ${persona.lebenssituation}`);
  if (persona.branche_name) lines.push(`  Branche: ${persona.branche_name}`);
  if (persona.pain_points) lines.push(`  Pain-Points: ${cap(persona.pain_points, 280)}`);
  if (persona.interessen) lines.push(`  Interessen: ${cap(persona.interessen, 200)}`);
  if (persona.beduerfnisse) lines.push(`  Beduerfnisse: ${cap(persona.beduerfnisse, 200)}`);
  if (persona.kaufmotive) lines.push(`  Kaufmotive: ${cap(persona.kaufmotive, 200)}`);
  if (persona.einwaende) lines.push(`  Einwaende: ${cap(persona.einwaende, 200)}`);
  if (persona.produkt_loesung) lines.push(`  Produktloesung: ${cap(persona.produkt_loesung, 240)}`);
  if (persona.produktvorteile) lines.push(`  Produktvorteile: ${cap(persona.produktvorteile, 200)}`);
  if (persona.tonalitaet) lines.push(`  Tonalitaet: ${cap(persona.tonalitaet, 120)}`);
  if (persona.plattformen) lines.push(`  Plattformen: ${cap(persona.plattformen, 160)}`);
  if (persona.content_praeferenzen) lines.push(`  Content: ${cap(persona.content_praeferenzen, 200)}`);
  if (persona.beschreibung) lines.push(`  Beschreibung: ${cap(persona.beschreibung, 280)}`);
  const as = fmtAudienceSituations(persona.audience_situations, 240);
  if (as) lines.push(`  Audience Situations: ${as}`);
  for (const fit of (persona.produktFits || [])) {
    if (fit.fit_grund) lines.push(`  Produkt-Fit: ${cap(fit.fit_grund, 240)}`);
    if (fit.use_case_namen?.length) lines.push(`  Use Cases: ${fit.use_case_namen.join(', ')}`);
  }
  return lines.join('\n');
}

function buildPrompt(bedarf, { shortlist = [] } = {}) {
  const stable = 'Du bist Casting-Unterstuetzung einer Creator-Agentur. '
    + 'Du bekommst eine deterministisch erstellte Shortlist aus der eigenen Creator-Datenbank. '
    + 'Du waehlst NICHT aus und erfindest KEINE Creator - jede creator_id muss aus der Shortlist stammen.\n\n'
    + '# GRUNDREGELN (verbindlich)\n'
    + '1. NICHTS ERFINDEN. fit_grund nennt nur Felder aus der Shortlist (Branche, Alter, Typ, Mentions, Historie).\n'
    + '2. KEINE LYRIK. "Wirkt authentisch" oder "gute Energy" ist ein Ausschlussgrund - nenne Fakten.\n'
    + '3. Unbelegte Voraussetzungen (unverified) gehoeren in risiken, nicht in fit_grund.\n'
    + '4. Weniger ist mehr: uebernimm nur Kandidaten mit tragfaehigem Fit, keine Quote um jeden Preis.\n'
    + '5. KEINE SCORE-ZAHLEN im fit_grund: weder Matching noch Fit/Track/Fresh nennen - der Text erklaert die Passung in Worten.\n'
    + '6. persona_id am Eintrag ist vorgegeben - nicht aendern, nicht umhaengen.\n'
    + '7. DONTS und DOS sind kein Streichgrund. Personen, die sie nicht erfuellen, sind schon raus.\n';

  let task = '# BEDARF\n';
  task += `Bereich: ${bedarf.bereich || 'offen'} | Typ: ${bedarf.typ || 'offen'}\n`;
  if (bedarf.nischen?.length) task += `Nischen: ${bedarf.nischen.join(', ')}\n`;
  if (bedarf.groessen?.length) task += `Groessen: ${bedarf.groessen.join(', ')}\n`;
  if (bedarf.alter) task += `Alter: ${bedarf.alter[0]}-${bedarf.alter[1]}\n`;
  if (bedarf.geschlechter?.length) task += `Geschlecht: ${bedarf.geschlechter.join(', ')}\n`;
  if (bedarf.voraussetzungen?.length) task += `Voraussetzungen: ${bedarf.voraussetzungen.join(', ')}\n`;
  if (bedarf.umsetzung) task += `Umsetzung: ${cap(bedarf.umsetzung, 500)}\n`;
  if (bedarf.learningsText) task += `Learnings: ${cap(bedarf.learningsText, 400)}\n`;
  if (bedarf.donts) task += `\n# DONTS (Kontext, kein Streichgrund)\n${cap(bedarf.donts, 1500)}\n`;
  if (bedarf.dos) task += `\n# DOS (Kontext, kein Streichgrund)\n${cap(bedarf.dos, 800)}\n`;
  if (bedarf.personas?.length) {
    task += '\n# PERSONAS (Briefing)\n';
    bedarf.personas.forEach(p => { task += `${fmtPersonaKarte(p)}\n`; });
  }

  task += `\n# SHORTLIST (${shortlist.length} Kandidaten, IDs und Persona-Zuweisung sind verbindlich)\n`;
  shortlist.slice(0, MAX_SHORTLIST_IM_PROMPT).forEach(s => { task += `\n---\n${fmtKandidat(s)}\n`; });

  task += '\n# AUFTRAG\nGib das Ergebnis AUSSCHLIESSLICH ueber das Tool '
    + '"casting_vorschlaege_abgeben" ab: ein Eintrag je uebernommener Shortlist-ID, '
    + 'persona_id wie am Eintrag, fit_grund mit belegbaren Feldern, risiken bei offenen Punkten. '
    + 'Streichen ist erlaubt; nicht genannte IDs gelten als verworfen.';

  return { stable, task };
}

// ---------------------------------------------------------------------------
// DB-Lader (Service Role in der Background Function)
// ---------------------------------------------------------------------------

const KANDIDAT_SELECT = `id,vorname,nachname,mail,telefonnummer,geschlecht,alter_jahre,alter_min,alter_max,
instagram,instagram_follower,tiktok,tiktok_follower,ig_biography,ig_engagement_rate,ig_engagement_rate_clean,
ig_brand_mentions,ig_recent_posts,lieferadresse_stadt,lieferadresse_land,lieferadresse_plz,notiz,
hat_haustier,hat_kinder,spielt_instrument,budget_letzte_buchung,
creator_creator_type(creator_type_id(id,name)),
creator_branchen(branche_id(id,name)),
creator_sprachen(sprachen!sprache_id(id,name))`;

/** Nahtstelle Pool: v1 nur creator, spaeter Union mit sourcing_creator. */
async function loadCandidates(supabase, bedarf, { limit = 2000 } = {}) {
  const { data, error } = await supabase.from('creator').select(KANDIDAT_SELECT).limit(limit);
  if (error) throw error;
  return (data || []).map(normiereKandidat);
}

/**
 * Buchungsbild dieser Marke: Repeat-Signale aus frueheren Castings plus
 * Kooperationen. Doppelte IDs kommen in Sets, Kennzahlen je Creator in
 * histJeCreator.
 */
async function loadBuchungsbild(supabase, { markeId, unternehmenId, castingId, fingerprint }) {
  const bild = {
    aufDieserListe: new Set(),
    parallelLive: new Set(),
    managementIds: new Set(),
    histJeCreator: new Map(),
    vorgeschlageneFingerprints: new Map()
  };

  // Items dieses Castings (Gate + Kategorie-Landung lesen woanders)
  const { data: eigene } = await supabase.from('creator_auswahl_items')
    .select('creator_id').eq('creator_auswahl_id', castingId);
  (eigene || []).forEach(r => { if (r.creator_id) bild.aufDieserListe.add(r.creator_id); });

  // Fruehere Castings derselben Marke (Fallback Unternehmen)
  let listenQuery = supabase.from('creator_auswahl').select('id').neq('id', castingId);
  if (markeId) listenQuery = listenQuery.eq('marke_id', markeId);
  else if (unternehmenId) listenQuery = listenQuery.eq('unternehmen_id', unternehmenId);
  const { data: listen } = await listenQuery;
  const listenIds = (listen || []).map(l => l.id).filter(Boolean);
  if (!listenIds.length) return bild;

  const vor90d = new Date();
  vor90d.setDate(vor90d.getDate() - SCHWELLEN.repeatTage);
  const vor90dIso = vor90d.toISOString();
  const vor30d = new Date();
  vor30d.setDate(vor30d.getDate() - 30);
  const vor30dIso = vor30d.toISOString();

  const { data: items } = await supabase.from('creator_auswahl_items')
    .select('creator_id, prio_1, prio_2, gebucht, angefragt, absage, zusage, created_at, kategorie')
    .in('creator_auswahl_id', listenIds);
  for (const it of (items || [])) {
    if (!it.creator_id) continue;
    let h = bild.histJeCreator.get(it.creator_id);
    if (!h) {
      h = { castings: 0, prio1: 0, angefragt: 0, gebucht: 0, absagen: 0, markeGebucht: false, markeBuchungen90d: 0, prioQuote: 0 };
      bild.histJeCreator.set(it.creator_id, h);
    }
    h.castings++;
    if (it.prio_1) h.prio1++;
    if (it.angefragt || it.zusage || it.gebucht) h.angefragt++;
    if (it.gebucht) {
      h.gebucht++;
      h.markeGebucht = true;
      if ((it.created_at || '') >= vor90dIso) h.markeBuchungen90d++;
    }
    if (it.absage) h.absagen++;
    // Kuerzlich auf einer anderen Live-Liste derselben Marke: nicht doppelt
    if ((it.created_at || '') >= vor30dIso) bild.parallelLive.add(it.creator_id);
  }
  for (const [, h] of bild.histJeCreator) {
    h.prioQuote = h.castings ? h.prio1 / h.castings : 0;
  }

  // Videos je Creator (Kooperationen dieser Firma)
  if (unternehmenId) {
    const { data: koops } = await supabase.from('kooperationen')
      .select('id, creator_id').eq('unternehmen_id', unternehmenId);
    const koopIds = (koops || []).map(k => k.id).filter(Boolean);
    const creatorJeKoop = new Map((koops || []).filter(k => k.creator_id).map(k => [k.id, k.creator_id]));
    if (koopIds.length) {
      const { data: videos } = await supabase.from('kooperation_videos')
        .select('kooperation_id').in('kooperation_id', koopIds);
      const videosJeCreator = new Map();
      for (const v of (videos || [])) {
        const cid = creatorJeKoop.get(v.kooperation_id);
        if (cid) videosJeCreator.set(cid, (videosJeCreator.get(cid) || 0) + 1);
      }
      for (const [cid, n] of videosJeCreator) {
        const h = bild.histJeCreator.get(cid) || { castings: 0, prio1: 0, angefragt: 0, gebucht: 0, absagen: 0, markeGebucht: false, markeBuchungen90d: 0, prioQuote: 0 };
        h.videos = n;
        bild.histJeCreator.set(cid, h);
      }
    }
  }

  return bild;
}

function orderPersonasByIds(rows, ids) {
  const byId = new Map((rows || []).map(p => [p.id, p]));
  return (ids || []).map(id => byId.get(id)).filter(Boolean);
}

/** Bedarf-Daten: Briefing, Produkte, Briefing-Personas. */
async function loadBedarfData(supabase, casting) {
  const { data: briefing } = await supabase.from('campaign_briefings')
    .select('*').eq('id', casting.briefing_id).maybeSingle();
  if (!briefing) throw new Error('Casting ohne Briefing: ohne Bedarf kein Lauf');

  const { data: links } = await supabase.from('campaign_briefing_produkt')
    .select('produkt_id').eq('briefing_id', briefing.id);
  const produktIds = (links || []).map(l => l.produkt_id).filter(Boolean);

  const personaIds = Array.isArray(briefing.persona_ids)
    ? briefing.persona_ids.filter(Boolean)
    : [];
  let personas = [];
  if (personaIds.length) {
    const { data: rows } = await supabase.from('personas')
      .select('id, name, oberbegriff, alter_von, alter_bis, geschlecht, wohnort_region, beruf, budgetrahmen, bildungsstand, lebenssituation, branche_id, pain_points, interessen, beduerfnisse, kaufmotive, einwaende, produkt_loesung, produktvorteile, tonalitaet, plattformen, content_praeferenzen, beschreibung')
      .in('id', personaIds);
    personas = orderPersonasByIds(rows, personaIds);
    await attachAudienceSituations(supabase, personas);
    await attachBrancheNamen(supabase, personas);
    await attachProduktFits(supabase, personas, produktIds);
  }

  return { briefing, produktIds, personas };
}

async function attachBrancheNamen(supabase, personas) {
  const ids = [...new Set((personas || []).map(p => p.branche_id).filter(Boolean))];
  if (!ids.length) return personas;
  const { data } = await supabase.from('branchen').select('id, name').in('id', ids);
  const byId = new Map((data || []).map(r => [r.id, r.name]));
  for (const p of personas || []) {
    p.branche_name = byId.get(p.branche_id) || null;
  }
  return personas;
}

async function attachProduktFits(supabase, personas, produktIds) {
  const personaIds = (personas || []).map(p => p.id).filter(Boolean);
  const pids = (produktIds || []).filter(Boolean);
  if (!personaIds.length || !pids.length) {
    for (const p of personas || []) p.produktFits = p.produktFits || [];
    return personas;
  }
  const { data: fits } = await supabase.from('produkt_persona_vorschlag')
    .select('persona_id, produkt_id, fit_grund, use_case_ids')
    .eq('status', 'accepted')
    .in('persona_id', personaIds)
    .in('produkt_id', pids);
  const rows = fits || [];
  const ucIds = [...new Set(rows.flatMap(r => r.use_case_ids || []).filter(Boolean))];
  let ucById = new Map();
  if (ucIds.length) {
    const { data: ucs } = await supabase.from('produkt_use_case')
      .select('id, name').in('id', ucIds);
    ucById = new Map((ucs || []).map(u => [u.id, u.name]));
  }
  const byPersona = new Map();
  for (const row of rows) {
    if (!byPersona.has(row.persona_id)) byPersona.set(row.persona_id, []);
    byPersona.get(row.persona_id).push({
      produkt_id: row.produkt_id,
      fit_grund: row.fit_grund || null,
      use_case_namen: (row.use_case_ids || []).map(id => ucById.get(id)).filter(Boolean)
    });
  }
  for (const p of personas || []) {
    p.produktFits = byPersona.get(p.id) || [];
  }
  return personas;
}

module.exports = {
  ...config,
  norm,
  normListe,
  tokens,
  parseAlterSpanne,
  spannenSchneiden,
  bedarfFingerprint,
  buildBedarf,
  kanaeleAusBriefing,
  quoteProPersona,
  mapPersona,
  personaFreitext,
  bedarfFuerPersona,
  personaLebenslageTrifft,
  erstePersonaId,
  splitPendingNachPersona,
  lueckenJePersona,
  fuellePersonaQuoten,
  fitGrundDeterministisch,
  normiereKandidat,
  nischenTreffer,
  applyGates,
  scoreFit,
  wilson,
  scoreTrack,
  scoreFresh,
  matchingScore,
  profilFuer,
  topNNachMatching,
  orderPersonasByIds,
  validateVorschlaege,
  CASTING_TOOL,
  buildPrompt,
  sanitizeLesung,
  leerLesung,
  personaProfilPasst,
  DONT_LESUNG_TOOL,
  buildDontLesungPrompt,
  loadCandidates,
  loadBuchungsbild,
  loadBedarfData
};
