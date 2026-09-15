// strategie-idee.js
// Prompt, Tool-Schema und Validate fuer Videoidee-Vorschlaege im Konzept
// (ADR 0015). Kein Candidate-Pool: das Modell schreibt neue Ideen als
// strukturierte Bloecke, der Client zeigt sie als flagged strategie_items.

const { fmtCampaignBriefing } = require('./skript-context/briefing-felder');

const ANZAHL = 5;
const PRODUKT_FELDER = 'id, name, kurzbeschreibung, usp, pain_points, loesung';

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
  return teile.length ? `- ${teile.join(' ')}` : null;
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

  let personas = [];
  if (produktIds.length) {
    const { data: vorschlaege } = await supabase.from('produkt_persona_vorschlag')
      .select('persona_id, persona:persona_id(id, name, oberbegriff, pain_points, beduerfnisse)')
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

function validateIdeen(json, { ausschluss = [], anzahl = ANZAHL } = {}) {
  const raw = Array.isArray(json?.ideen) ? json.ideen : [];
  const belegt = new Set((ausschluss || []).map((t) => erstzeile(t).toLowerCase()).filter(Boolean));
  const ideen = [];
  const verworfen = [];

  for (const rawIdee of raw) {
    const titel = String(rawIdee?.titel || '').trim();
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

/** Ideen ohne Link: plattform null, analog addItemPayload. 'idea' knallt gegen strategie_items_plattform_check. */
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
  validateIdeen,
  buildVorschlagInsert
};
