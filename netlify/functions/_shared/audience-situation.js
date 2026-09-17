// audience-situation.js
// Gate, Prompt, Validate und Attach fuer Audience Situations (ADR 0016).
// Spiegel der Gate-Funktionen: src/modules/persona/audienceSituationGate.js

const MIN_SITUATIONEN = 2;
const MAX_SITUATIONEN = 4;

function istKiBereit(rows) {
  if (!Array.isArray(rows) || !rows.length) return true;
  return rows.every(r => r.quelle === 'migration');
}

function quelleNachEdit(bestehend, next) {
  if (!bestehend || bestehend.quelle !== 'migration') return 'manual';
  const sameName = String(bestehend.name || '').trim() === String(next.name || '').trim();
  const sameDesc = String(bestehend.beschreibung || '').trim() === String(next.beschreibung || '').trim();
  return sameName && sameDesc ? 'migration' : 'manual';
}

function cap(value, max = 400) {
  const s = String(value || '').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function fmtAudienceSituations(list, max = 400) {
  if (!Array.isArray(list) || !list.length) return null;
  const zeilen = list.map((s) => {
    const name = String(s?.name || '').trim();
    if (!name) return null;
    const desc = String(s?.beschreibung || '').trim();
    return cap(desc ? `${name} — ${desc}` : name, max);
  }).filter(Boolean);
  return zeilen.length ? zeilen.join('; ') : null;
}

async function loadAudienceSituations(supabase, personaIds) {
  const ids = [...new Set((personaIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('audience_situation')
    .select('id, persona_id, name, beschreibung, position, quelle')
    .in('persona_id', ids)
    .order('position');
  if (error) throw error;
  return data || [];
}

async function attachAudienceSituations(supabase, personas) {
  const list = (Array.isArray(personas) ? personas : [personas]).filter(Boolean);
  const rows = await loadAudienceSituations(supabase, list.map(p => p.id));
  const byPersona = new Map();
  for (const row of rows) {
    if (!byPersona.has(row.persona_id)) byPersona.set(row.persona_id, []);
    byPersona.get(row.persona_id).push({
      name: row.name,
      beschreibung: row.beschreibung || null,
      quelle: row.quelle
    });
  }
  for (const p of list) {
    p.audience_situations = byPersona.get(p.id) || [];
  }
  return personas;
}

const SITUATION_TOOL = {
  name: 'audience_situations_abgeben',
  description: 'Gibt Audience Situations fuer eine Persona ab: konkrete Empfangsmomente, nicht Use Cases des Produkts.',
  input_schema: {
    type: 'object',
    properties: {
      situationen: {
        type: 'array',
        description: '2 bis 4 Audience Situations. Kurzer Name plus wann/warum die Persona in diesem Moment empfänglich ist.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Kurzer Titel, z.B. "morgens unter Zeitdruck"' },
            beschreibung: { type: 'string', description: 'Ein bis zwei Saetze: wann und warum sie hier fuer den Nutzen empfänglich ist' }
          },
          required: ['name']
        }
      }
    },
    required: ['situationen']
  }
};

function validateSituationen(json) {
  const raw = Array.isArray(json?.situationen) ? json.situationen : [];
  const situationen = [];
  const verworfen = [];
  const gesehen = new Set();

  for (const s of raw) {
    const name = String(s?.name || '').trim();
    if (!name) {
      verworfen.push({ grund: 'ohne_name' });
      continue;
    }
    const key = name.toLowerCase();
    if (gesehen.has(key)) {
      verworfen.push({ grund: 'duplikat', name });
      continue;
    }
    gesehen.add(key);
    situationen.push({
      name,
      beschreibung: String(s?.beschreibung || '').trim() || null
    });
    if (situationen.length >= MAX_SITUATIONEN) break;
  }

  if (situationen.length < MIN_SITUATIONEN) {
    return { situationen: [], verworfen: [{ grund: 'zu_wenig', anzahl: situationen.length }, ...verworfen] };
  }
  return { situationen, verworfen };
}

function buildPrompt({ persona = {}, produkt = {} } = {}) {
  const stable = 'Du bist Zielgruppen-Stratege fuer Creator-Marketing. '
    + 'Du formulierst Audience Situations: konkrete Momente, in denen eine Persona fuer ein Angebot empfänglich sein kann.\n\n'
    + '# GRUNDREGELN (verbindlich)\n'
    + '1. Audience Situations gehoeren der PERSONA, nicht dem Produkt. Es sind Lebensmomente der Person, keine Einsatzsituationen des Produkts.\n'
    + '2. KEINE Use-Case-Klone. Produkt-Einsatzsituationen nicht 1:1 als Namen uebernehmen.\n'
    + '3. NICHTS ERFINDEN, was den Persona- oder Produktfakten widerspricht. Unsicheres als Hypothese markieren.\n'
    + '4. Namen kurz und konkret ("morgens unter Zeitdruck"), keine Demografie, keine Produktnamen.\n'
    + '5. QUALITAET VOR QUANTITAET. 2 bis 4 Situations, Ziel 3. Distinkt, keine Umformulierungen.\n';

  const personaZeilen = [
    persona.name ? `Name: ${persona.name}` : null,
    persona.oberbegriff ? `Oberbegriff: ${persona.oberbegriff}` : null,
    persona.beruf ? `Beruf: ${persona.beruf}` : null,
    persona.lebenssituation ? `Lebenssituation: ${persona.lebenssituation}` : null,
    persona.pain_points ? `Pain Points: ${cap(persona.pain_points, 400)}` : null,
    persona.beduerfnisse ? `Beduerfnisse: ${cap(persona.beduerfnisse, 300)}` : null,
    persona.kaufmotive ? `Kaufmotive: ${cap(persona.kaufmotive, 250)}` : null,
    persona.beschreibung ? `Beschreibung: ${cap(persona.beschreibung, 300)}` : null
  ].filter(Boolean);

  const produktZeilen = [
    produkt.name ? `Name: ${produkt.name}` : null,
    produkt.kurzbeschreibung ? `Kurzbeschreibung: ${cap(produkt.kurzbeschreibung, 300)}` : null,
    produkt.usp ? `USP: ${cap(produkt.usp, 300)}` : null,
    produkt.pain_points ? `Pain Points: ${cap(produkt.pain_points, 300)}` : null,
    produkt.loesung ? `Loesung: ${cap(produkt.loesung, 300)}` : null
  ].filter(Boolean);

  let task = '# PERSONA\n' + (personaZeilen.join('\n') || '(ohne Profil)') + '\n\n';
  task += '# PRODUKT (nur als Anlass, wann sie empfänglich sein kann — nicht als Use-Case-Vorlage)\n'
    + (produktZeilen.join('\n') || '(ohne Produktfakten)') + '\n\n';
  task += '# AUFTRAG\nGib 2 bis 4 Audience Situations AUSSCHLIESSLICH ueber das Tool "audience_situations_abgeben" ab.';

  return { stable, task };
}

module.exports = {
  istKiBereit,
  quelleNachEdit,
  fmtAudienceSituations,
  loadAudienceSituations,
  attachAudienceSituations,
  SITUATION_TOOL,
  validateSituationen,
  buildPrompt,
  MIN_SITUATIONEN,
  MAX_SITUATIONEN
};
