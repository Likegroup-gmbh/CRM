// strategie-idee.js
// Prompt, Tool-Schema und Validate fuer Videoidee-Vorschlaege im Konzept
// (ADR 0015). Kein Candidate-Pool: das Modell schreibt neue Ideen als
// strukturierte Bloecke, der Client zeigt sie als flagged strategie_items.

const { fmtCampaignBriefing } = require('./skript-context/briefing-felder');
const { attachAudienceSituations, fmtAudienceSituations } = require('./audience-situation');

const ANZAHL = 5;
const PRODUKT_FELDER = 'id, name, kurzbeschreibung, usp, pain_points, loesung';
const PERSONA_FELDER = 'id, name, oberbegriff, pain_points, beduerfnisse';

const KONZEPT_TOOL = {
  name: 'videoideen_abgeben',
  description: 'Gibt Videoideen fuer ein Konzept ab. Jede Idee ist ein eigener Creative Angle.',
  input_schema: {
    type: 'object',
    properties: {
      ideen: {
        type: 'array',
        description: `Genau ${ANZAHL} distinkte Videoideen, nicht Varianten derselben Idee.`,
        items: {
          type: 'object',
          properties: {
            titel: {
              type: 'string',
              description: 'Kurzer merkbare Titel, gleichzeitig der Hook in einem Satz. Keine Anfuehrungszeichen.'
            },
            pain_point: { type: 'string', description: 'Welchen Pain die Idee angreift, ein bis zwei Saetze.' },
            hook: { type: 'string', description: 'Gesprochener oder sichtbarer Aufmacher der ersten Sekunden.' },
            kernbotschaft: { type: 'string', description: 'Was haengen bleiben soll, ein Satz.' },
            ablauf: { type: 'string', description: 'Grober Ablauf in zwei bis vier Schritten, keine Shotliste.' }
          },
          required: ['titel', 'pain_point', 'hook', 'kernbotschaft', 'ablauf']
        }
      }
    },
    required: ['ideen']
  }
};

function cap(value, max = 400) {
  const s = String(value || '').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function erstzeile(text) {
  const s = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!s) return '';
  return s.split('\n')[0].trim();
}

function formatBeschreibung({ titel, pain_point, hook, kernbotschaft, ablauf } = {}) {
  const kopf = String(titel || '').trim();
  const zeilen = [
    kopf,
    '',
    pain_point ? `Pain Point: ${String(pain_point).trim()}` : null,
    hook ? `Hook: ${String(hook).trim()}` : null,
    kernbotschaft ? `Kernbotschaft: ${String(kernbotschaft).trim()}` : null,
    ablauf ? `Ablauf: ${String(ablauf).trim()}` : null
  ].filter((z) => z !== null);
  return zeilen.join('\n').trim();
}

function fmtProdukt(p) {
  const teile = [
    p.name ? `Name: ${cap(p.name, 120)}` : null,
    p.kurzbeschreibung ? `Kurzbeschreibung: ${cap(p.kurzbeschreibung)}` : null,
    p.usp ? `USP: ${cap(p.usp)}` : null,
    p.pain_points ? `Pain Points: ${cap(p.pain_points)}` : null,
    p.loesung ? `Loesung: ${cap(p.loesung)}` : null
  ].filter(Boolean);
  return teile.length ? `- ${teile.join(' | ')}` : null;
}

function fmtPersona(p) {
  const teile = [
    p.name || null,
    p.oberbegriff ? `(${cap(p.oberbegriff, 80)})` : null,
    p.pain_points ? `Pain: ${cap(p.pain_points, 200)}` : null,
    p.beduerfnisse ? `Beduerfnis: ${cap(p.beduerfnisse, 200)}` : null
  ].filter(Boolean);
  const as = fmtAudienceSituations(p.audience_situations, 200);
  const kopf = teile.length ? `- ${teile.join(' ')}` : null;
  if (!kopf && !as) return null;
  return as ? `${kopf || '- Persona'}\n  Audience Situations: ${as}` : kopf;
}

async function loadIdeeInput(supabase, strategieId) {
  const { data: strategie, error: sErr } = await supabase.from('strategie')
    .select('id, name, briefing_id, marke_id, unternehmen_id')
    .eq('id', strategieId)
    .single();
  if (sErr || !strategie) throw new Error('Konzept nicht gefunden');
  if (!strategie.briefing_id) throw new Error('Konzept ohne Briefing: ohne Briefing kein Lauf');

  const { data: briefing, error: bErr } = await supabase.from('campaign_briefings')
    .select('*')
    .eq('id', strategie.briefing_id)
    .maybeSingle();
  if (bErr || !briefing) throw new Error('Briefing nicht gefunden');

  const { data: links } = await supabase.from('campaign_briefing_produkt')
    .select('produkt_id')
    .eq('briefing_id', briefing.id);
  const produktIds = [...new Set((links || []).map((l) => l.produkt_id).filter(Boolean))];

  let produkte = [];
  if (produktIds.length) {
    const { data } = await supabase.from('produkt')
      .select(PRODUKT_FELDER)
      .in('id', produktIds);
    produkte = data || [];
  }

  const personas = await loadPersonas(supabase, briefing, produktIds);

  const { data: items } = await supabase.from('strategie_items')
    .select('id, beschreibung')
    .eq('strategie_id', strategieId)
    .order('sortierung');

  const ausschluss = (items || [])
    .map((i) => erstzeile(i.beschreibung))
    .filter(Boolean);

  return { strategie, briefing, produkte, personas, ausschluss, vorhandeneAnzahl: (items || []).length };
}

function buildPrompt({ briefing, produkte, personas, ausschluss } = {}) {
  const briefingText = fmtCampaignBriefing(briefing) || '(Briefing ohne auswertbare Felder)';
  const produktText = (produkte || []).map(fmtProdukt).filter(Boolean).join('\n') || '(keine Produkte am Briefing)';
  const personaText = (personas || []).map(fmtPersona).filter(Boolean).join('\n') || '(keine akzeptierten Personas)';
  const ausschlussText = (ausschluss || []).length
    ? (ausschluss || []).map((t) => `- ${t}`).join('\n')
    : '(noch keine Ideen im Konzept)';

  const stable = `Du schreibst Videoideen fuer ein Kampagnen-Konzept einer Creator-Agentur.
Jede Idee ist ein eigener Creative Angle auf das Produkt: distinkter Blickwinkel, nicht eine Umformulierung.

Regeln:
- Deutsch, Du-Form in Hook und Ablauf nur wenn es zur Marke passt, sonst neutral.
- Keine erfundenen Produktfeatures, Preise, Claims. Nur was im Briefing oder Produkt steht.
- Donts im Briefing sind Verbote. Eine Idee, die ein Dont bricht, wird nicht abgegeben.
- Dos nur, wo der Fakt im Briefing oder Produkt steht.
- Titel = merkbare Kurzform des Hooks, eine Zeile, keine Anfuehrungszeichen.
- Pain Point, Hook, Kernbotschaft, grober Ablauf: konkret, keine Agenturlyrik.
- Ablauf: 2–4 Schritte, was passiert, keine Kameraanweisung.
- Genau ${ANZAHL} Ideen, quer ueber die Produkte (nicht ${ANZAHL} pro Produkt). Ohne Produkt nur aus dem Briefing.
- Keine Idee, deren Titel einer ausgeschlossenen Erstzeile entspricht (Gross/Klein egal).`;

  const task = `Briefing:
${briefingText}

Produkte:
${produktText}

Personas:
${personaText}

Bereits vorhandene Ideen (nicht wiederholen):
${ausschlussText}

Gib ${ANZAHL} neue Videoideen ueber das Tool ab.`;

  return { stable, task };
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  const s = value.trim();
  if (!s) return value;
  try {
    return JSON.parse(s);
  } catch (_) {
    return value;
  }
}

function pickIdeenArray(obj) {
  const parsed = parseMaybeJson(obj);
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  for (const key of ['ideen', 'videoideen', 'ideas']) {
    const val = parseMaybeJson(parsed[key]);
    if (Array.isArray(val)) return val;
  }
  if (parsed.videoideen_abgeben != null) return pickIdeenArray(parsed.videoideen_abgeben);
  return [];
}

/** Tool-Input auf ein Ideen-Array ziehen: String, Wrapper, Aliase. */
function normalizeIdeenJson(json) {
  return pickIdeenArray(json);
}

function ideeTitel(raw) {
  return String(raw?.titel || raw?.title || raw?.Titel || '').trim();
}

function jsonKeys(json) {
  if (json == null) return [];
  if (Array.isArray(json)) return ['<array>'];
  if (typeof json === 'object') return Object.keys(json).slice(0, 20);
  return [typeof json];
}

function ideenDiagnose(json, geprueft, result) {
  return {
    json_keys: jsonKeys(json),
    verworfen: (geprueft?.verworfen || []).slice(0, 20),
    stop_reason: result?.stop_reason || null
  };
}

function leerGrund(geprueft) {
  const gruende = (geprueft?.verworfen || []).map((v) => v.grund);
  if (!gruende.length) return 'leeres Array';
  const unique = [...new Set(gruende)];
  if (unique.length === 1 && unique[0] === 'ohne_titel') return 'ohne Titel';
  if (unique.length === 1 && unique[0] === 'ausschluss') return 'alles Ausschluss';
  if (unique.length === 1 && unique[0] === 'leer') return 'leere Felder';
  return unique.join(', ');
}

function leerFehler(geprueft) {
  return `Die KI konnte keine tragfähigen Videoideen liefern (${leerGrund(geprueft)})`;
}

async function loadPersonas(supabase, briefing, produktIds) {
  const personaIds = Array.isArray(briefing?.persona_ids)
    ? briefing.persona_ids.filter(Boolean)
    : [];
  let personas = [];

  if (personaIds.length) {
    const { data: rows } = await supabase.from('personas')
      .select(PERSONA_FELDER)
      .in('id', personaIds);
    const byId = new Map((rows || []).map((p) => [p.id, p]));
    personas = personaIds.map((id) => byId.get(id)).filter(Boolean);
  } else if (produktIds.length) {
    const { data: vorschlaege } = await supabase.from('produkt_persona_vorschlag')
      .select(`persona_id, persona:persona_id(${PERSONA_FELDER})`)
      .in('produkt_id', produktIds)
      .eq('status', 'accepted');
    const gesehen = new Set();
    for (const v of (vorschlaege || [])) {
      const p = v.persona;
      if (p?.id && !gesehen.has(p.id)) {
        gesehen.add(p.id);
        personas.push(p);
      }
    }
  }

  if (personas.length) await attachAudienceSituations(supabase, personas);
  return personas;
}

function validateIdeen(json, { ausschluss = [], anzahl = ANZAHL } = {}) {
  const raw = normalizeIdeenJson(json);
  const belegt = new Set((ausschluss || []).map((t) => erstzeile(t).toLowerCase()).filter(Boolean));
  const ideen = [];
  const verworfen = [];

  for (const rawIdee of raw) {
    const titel = ideeTitel(rawIdee);
    if (!titel) {
      verworfen.push({ grund: 'ohne_titel' });
      continue;
    }
    const key = titel.toLowerCase();
    if (belegt.has(key)) {
      verworfen.push({ grund: 'ausschluss', titel });
      continue;
    }
    const pain_point = String(rawIdee?.pain_point || '').trim();
    const hook = String(rawIdee?.hook || '').trim();
    const kernbotschaft = String(rawIdee?.kernbotschaft || '').trim();
    const ablauf = String(rawIdee?.ablauf || '').trim();
    if (!pain_point && !hook && !kernbotschaft && !ablauf) {
      verworfen.push({ grund: 'leer', titel });
      continue;
    }
    belegt.add(key);
    ideen.push({
      titel,
      pain_point,
      hook,
      kernbotschaft,
      ablauf,
      beschreibung: formatBeschreibung({ titel, pain_point, hook, kernbotschaft, ablauf })
    });
    if (ideen.length >= anzahl) break;
  }

  return { ideen, verworfen };
}

/** Ideen ohne Link: plattform null, analog addItemPayload. 'idea' knallt gegen strategie_items_plattform_check.
 *  createdBy ist benutzer.id (FK), nicht auth.users.id. */
function buildVorschlagInsert({ strategieId, idee, sortierung, createdBy }) {
  return {
    strategie_id: strategieId,
    video_link: null,
    plattform: null,
    sortierung,
    teilbereich: null,
    beschreibung: idee.beschreibung,
    beschreibung_quelle: 'ki',
    ist_vorschlag: true,
    created_by: createdBy
  };
}

module.exports = {
  ANZAHL,
  KONZEPT_TOOL,
  erstzeile,
  formatBeschreibung,
  loadIdeeInput,
  buildPrompt,
  normalizeIdeenJson,
  validateIdeen,
  leerFehler,
  ideenDiagnose,
  buildVorschlagInsert
};
