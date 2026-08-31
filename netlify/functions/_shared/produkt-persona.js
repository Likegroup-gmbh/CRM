// produkt-persona.js
// Prompt-Bau, Tool-Schema und Pool-Logik fuer die Persona-Generierung aus
// dem Produkt (produkt-persona-background).
//
// Qualitaetsanalogon zum Skriptsystem: CRM-Fakten statt Halluzination,
// erzwungenes Tool-Schema statt Freitext, Review-Gate im Client. Zwei
// zusaetzliche Mechanismen gegen generische Personas:
//   - House-Style: bestehende Personas der Marke gehen als Stil-Referenz
//     in den Prompt (Tiefe, Naming, Pain-Formulierung)
//   - Covered-Set: bereits liegende/akzeptierte Personas werden als
//     "nicht klonen"-Liste mitgegeben
//
// Feldmarkierungen im Input: fact (belegbar von der Produktseite),
// guess (KI-Extrakt, unsicher), manual (vom Team eingetragen).

const POOL_FELDER = 'id, name, oberbegriff, alter_von, alter_bis, geschlecht, wohnort_region, beruf, budgetrahmen, bildungsstand, lebenssituation, kontext, pain_points, interessen, beduerfnisse, kaufmotive, einwaende, tonalitaet, plattformen, content_praeferenzen, beschreibung';

const MAX_POOL_IM_PROMPT = 12;
const MAX_VORSCHLAEGE = 6;

/** Text kuerzen, damit der Pool den Prompt nicht aufblaedert. */
function cap(value, max = 400) {
  const s = String(value || '').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Match-Pool: erst die Personas der Produkt-Marken, leer -> Fallback auf
 * das Unternehmen. Globale DNA-Personas (unternehmen_id IS NULL) sind
 * bewusst nie Teil des Pools.
 */
async function loadPoolPersonas(supabase, { markeIds = [], unternehmenId = null } = {}) {
  const ids = [...new Set((markeIds || []).filter(Boolean))];

  if (ids.length) {
    const { data: links, error: linkError } = await supabase
      .from('persona_marke')
      .select('persona_id')
      .in('marke_id', ids);
    if (linkError) throw linkError;

    const personaIds = [...new Set((links || []).map(l => l.persona_id).filter(Boolean))];
    if (personaIds.length) {
      const { data, error } = await supabase
        .from('personas')
        .select(POOL_FELDER)
        .in('id', personaIds);
      if (error) throw error;
      return { pool: data || [], quelle: 'marke' };
    }
  }

  if (unternehmenId) {
    const { data, error } = await supabase
      .from('personas')
      .select(POOL_FELDER)
      .eq('unternehmen_id', unternehmenId);
    if (error) throw error;
    return { pool: data || [], quelle: 'unternehmen' };
  }

  return { pool: [], quelle: 'leer' };
}

// Erzwungener Tool-Call: die API serialisiert das JSON selbst.
// use_case_indices zeigen auf die gemeinsame Liste: erst die bestehenden
// Use Cases (Reihenfolge wie im Input), dann die neu generierten.
const PERSONA_TOOL = {
  name: 'persona_vorschlaege_abgeben',
  description: 'Gibt Einsatzsituationen und Persona-Vorschlaege fuer ein Produkt ab.',
  input_schema: {
    type: 'object',
    properties: {
      use_cases: {
        type: 'array',
        description: 'Neu generierte Einsatzsituationen. Leer, wenn bestehende im Auftrag standen - dann nur mappen.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Kurzer benannter Titel, z.B. "Morgens vor der Arbeit"' },
            beschreibung: { type: 'string', description: 'Ein bis zwei Saetze: wer nutzt das Produkt hier wann und warum' }
          },
          required: ['name']
        }
      },
      vorschlaege: {
        type: 'array',
        description: 'Persona-Karten: Mix aus Matches auf bestehende Personas und neuen Entwuerfen.',
        items: {
          type: 'object',
          properties: {
            typ: { type: 'string', enum: ['match', 'neu'] },
            persona_id: { type: ['string', 'null'], description: 'Bei match: die ID aus dem Pool. Bei neu: null.' },
            fit_grund: { type: 'string', description: 'Konkret: welche Pain Points/Beduerfnisse der Persona treffen auf welche Produktfakten. Zwei bis drei Saetze.' },
            use_case_indices: { type: 'array', items: { type: 'integer' }, description: 'Positionen in der gemeinsamen Use-Case-Liste (bestehende zuerst, dann generierte), 0-basiert. Mindestens einer.' },
            luecken_begruendung: { type: ['string', 'null'], description: 'Nur bei neu: warum keine bestehende Persona diese Luecke abdeckt. Ein Satz.' },
            persona: {
              type: ['object', 'null'],
              description: 'Nur bei neu: das volle Persona-Profil. Bei match: null.',
              properties: {
                name: { type: 'string', description: 'Deutscher Vorname, passend zum Naming der bestehenden Personas' },
                oberbegriff: { type: 'string', description: 'Kategorie im Stil der bestehenden Personas, z.B. "Die effiziente Berufseinsteigerin"' },
                alter_von: { type: ['integer', 'null'] },
                alter_bis: { type: ['integer', 'null'] },
                geschlecht: { type: ['string', 'null'], description: 'Weiblich, Maennlich, Divers oder Gemischt' },
                wohnort_region: { type: ['string', 'null'] },
                beruf: { type: ['string', 'null'] },
                budgetrahmen: { type: ['string', 'null'], enum: ['niedrig', 'mittel', 'hoch'], description: 'niedrig, mittel oder hoch – genau einer der drei Werte, keine Ranges' },
                bildungsstand: { type: ['string', 'null'] },
                lebenssituation: { type: ['string', 'null'], description: 'Single, Familie, Paar ohne Kinder, Alleinerziehend, Student/in, Rentner/in, Mensch mit Behinderung, WG / Wohngemeinschaft' },
                kontext: { type: ['string', 'null'], description: 'Situation/Alltag: Mediennutzung, Werte, was die Person beschaeftigt' },
                pain_points: { type: ['string', 'null'], description: 'Konkrete Probleme im Alltag, produktrelevant zuerst' },
                interessen: { type: ['string', 'null'] },
                beduerfnisse: { type: ['string', 'null'] },
                kaufmotive: { type: ['string', 'null'] },
                einwaende: { type: ['string', 'null'] },
                tonalitaet: { type: ['string', 'null'], description: 'Wie die Person angesprochen werden will' },
                plattformen: { type: ['string', 'null'] },
                content_praeferenzen: { type: ['string', 'null'] },
                produkt_loesung: { type: ['string', 'null'], description: 'Was das Produkt fuer diesen Menschentyp loest - allgemein formuliert, keine SKU-Details wie Preise oder Modellnamen' },
                produktvorteile: { type: ['string', 'null'], description: 'Welche Vorteile fuer diesen Typ zaehlen - typbezogen, nicht SKU-scharf' },
                beschreibung: { type: ['string', 'null'], description: 'Freie Zusammenfassung: wer ist das, zwei bis vier Saetze' }
              },
              required: ['name']
            }
          },
          required: ['typ', 'fit_grund', 'use_case_indices']
        }
      }
    },
    required: ['vorschlaege']
  }
};

const KIND_LABELS = {
  fact: 'BELEGBAR (von der Produktseite uebernommen)',
  guess: 'ABGELEITET (KI-Extrakt, unsicher - nicht als gesicherte Wahrheit behandeln)',
  manual: 'MANUELL (vom Team eingetragen, hoechste Verlaesslichkeit)'
};

function fmtProduktFeld(name, eintrag) {
  const wert = typeof eintrag === 'object' && eintrag !== null ? eintrag.value : eintrag;
  const kind = (typeof eintrag === 'object' && eintrag !== null ? eintrag.kind : null) || 'manual';
  if (!wert || !String(wert).trim()) return null;
  return `- ${name} [${KIND_LABELS[kind] || KIND_LABELS.manual}]: ${cap(wert, 600)}`;
}

function fmtPoolPersona(p) {
  const alter = [p.alter_von, p.alter_bis].filter(v => v != null).join('-');
  const teile = [
    `ID: ${p.id}`,
    `Name: ${p.name}${p.oberbegriff ? ` (${p.oberbegriff})` : ''}`,
    alter ? `Alter: ${alter}` : null,
    p.geschlecht ? `Geschlecht: ${p.geschlecht}` : null,
    p.beruf ? `Beruf: ${p.beruf}` : null,
    p.wohnort_region ? `Region: ${p.wohnort_region}` : null,
    p.pain_points ? `Pain Points: ${cap(p.pain_points, 300)}` : null,
    p.beduerfnisse ? `Beduerfnisse: ${cap(p.beduerfnisse, 250)}` : null,
    p.kaufmotive ? `Kaufmotive: ${cap(p.kaufmotive, 250)}` : null,
    p.einwaende ? `Einwaende: ${cap(p.einwaende, 250)}` : null,
    p.interessen ? `Interessen: ${cap(p.interessen, 200)}` : null,
    p.tonalitaet ? `Tonalitaet: ${p.tonalitaet}` : null,
    p.plattformen ? `Plattformen: ${cap(p.plattformen, 150)}` : null,
    p.beschreibung ? `Beschreibung: ${cap(p.beschreibung, 300)}` : null
  ].filter(Boolean);
  return teile.join('\n  ');
}

/**
 * Baut den Prompt. Rueckgabe { stable, task } - der stable Block ist
 * cachebar, der Task traegt die variablen Produktdaten.
 *
 * input: {
 *   felder: { name: {value, kind} | string, ... },
 *   markeNamen: string[], unternehmenName: string|null,
 *   bestehendeUseCases: [{ name, beschreibung }],
 *   modus: 'initial' | 'alle' | 'karte',
 *   anzahlZiel: number,
 *   behalten: [{ typ, name }],        // akzeptierte Karten (freeze)
 *   ersetzteKarte: { typ } | null     // karte-Modus
 * }
 */
function buildPrompt(input, { pool = [], poolQuelle = 'leer' } = {}) {
  let stable = 'Du bist ein erfahrener Zielgruppen-Stratege fuer Creator-Marketing. '
    + 'Du entwirfst Personas, die spaeter in Kampagnen, Briefings und Video-Skripten '
    + 'als Zielgruppe dienen. Deine Vorschlaege prueft ein Mensch, bevor sie gespeichert werden.\n\n';

  stable += '# GRUNDREGELN (verbindlich)\n'
    + '1. NICHTS ERFINDEN. Jede Persona und jeder Use Case leitet sich aus den Produkt- und Marken-Fakten ab. '
    + 'Was nicht fundierbar ist, bleibt leer oder wird als begruendete Hypothese formuliert ("vermutlich ..., weil ...").\n'
    + '2. KEINE KLISCHEES. Demografie ist nie die Identitaet. "Studentin, 22, mag Instagram" ist kein Ergebnis. '
    + 'Pain Points, Kaufmotive und Einwaende sind konkret und produktbezogen, keine Allgemeinplaetze.\n'
    + '3. FELDMARKIERUNGEN beachten: BELEGBAR ist Fakt, ABGELEITET ist unsicher (nicht als Wahrheit verkaufen), '
    + 'MANUELL hat hoechste Verlaesslichkeit.\n'
    + '4. QUALITAET VOR QUANTITAET. Lieber drei tragfaehige Karten als sechs aufgeblaehte. '
    + 'Keine schwachen Matches aufpumpen, keine neuen Personas ohne echte Luecke.\n'
    + '5. Neue Personas sind MENSCHEN, keine Produkt-Fact-Sheets. produkt_loesung und produktvorteile '
    + 'beschreiben den Typ Mensch allgemein - keine Preise, Modellnamen oder SKU-Details.\n';

  if (pool.length) {
    stable += '\n# HOUSE-STYLE (verbindlich fuer neue Personas)\n'
      + 'Die Marke pflegt ihre Personas in einem bestimmten Stil. Neue Entwuerfe muessen sich daran messen: '
      + 'gleiche Tiefe, gleiche Art der Pain-Formulierung, gleiches Naming (Name + Oberbegriff). '
      + 'Die Beispiele unten sind die Stil-Referenz - schreibe neue Personas so, als gehoerten sie in dieselbe Liste.\n';
  }

  // --- Task ---
  let task = '# PRODUKT\n';
  const feldZeilen = Object.entries(input.felder || {})
    .map(([name, eintrag]) => fmtProduktFeld(name, eintrag))
    .filter(Boolean);
  task += feldZeilen.length ? feldZeilen.join('\n') + '\n' : '(keine Produktdaten)\n';

  if (input.markeNamen?.length || input.unternehmenName) {
    task += '\n# MARKE / UNTERNEHMEN\n';
    if (input.markeNamen?.length) task += `Marke: ${input.markeNamen.join(', ')}\n`;
    if (input.unternehmenName) task += `Unternehmen: ${input.unternehmenName}\n`;
  }

  const bestehende = Array.isArray(input.bestehendeUseCases) ? input.bestehendeUseCases : [];
  if (bestehende.length) {
    task += '\n# BESTEHENDE EINSATZSITUATIONEN (fix, nicht neu erfinden - nur mappen)\n';
    bestehende.forEach((uc, i) => {
      task += `${i}. ${uc.name}${uc.beschreibung ? `: ${cap(uc.beschreibung, 200)}` : ''}\n`;
    });
  } else {
    task += '\n# EINSATZSITUATIONEN\nEs gibt noch keine. Generiere ZUERST 3 bis 6 benannte Einsatzsituationen '
      + '(Use Cases) aus den Produktfakten: konkrete Situationen, in denen das Produkt genutzt wird '
      + '(z.B. "Morgens vor der Arbeit", "Unterwegs im Zug"). Keine Zielgruppen-Demografie als Use Case. '
      + 'Jede Persona-Karte mappt danach auf mindestens eine davon.\n';
  }

  if (pool.length) {
    const quelleLabel = poolQuelle === 'marke' ? 'der Produkt-Marken' : 'des Unternehmens (Fallback, Marke hat keine eigenen)';
    task += `\n# BESTEHENDE PERSONAS ${quelleLabel} (Match-Pool UND Stil-Referenz)\n`;
    pool.slice(0, MAX_POOL_IM_PROMPT).forEach((p) => {
      task += `\n---\n${fmtPoolPersona(p)}\n`;
    });
    if (pool.length > MAX_POOL_IM_PROMPT) {
      task += `\n(weitere ${pool.length - MAX_POOL_IM_PROMPT} Pool-Personas nicht gezeigt)\n`;
    }
  } else {
    task += '\n# BESTEHENDE PERSONAS\nKeine vorhanden - alle Karten sind neue Entwuerfe.\n';
  }

  const behalten = Array.isArray(input.behalten) ? input.behalten : [];
  if (behalten.length) {
    task += '\n# BEREITS AKZEPTIERT (freeze - nicht duplizieren, nicht noch einmal vorschlagen)\n';
    behalten.forEach((b) => { task += `- ${b.name}${b.typ === 'match' ? ' (bestehende Persona)' : ' (neuer Entwurf)'}\n`; });
  }

  task += '\n# AUFTRAG\n';
  if (input.modus === 'karte') {
    task += 'Ersetze GENAU EINE verworfene Karte. ';
    if (input.ersetzteKarte?.typ === 'match') {
      task += 'Die verworfene Karte war ein Match: schlage bevorzugt eine ANDERE bestehende Persona aus dem Pool vor, '
        + 'die wirklich passt und noch auf keiner Karte liegt. Gibt es keine solche, entwirf eine neue Luecken-Persona. ';
    } else {
      task += 'Entwirf eine neue Persona fuer eine echte Luecke - oder ein Match, wenn eine Pool-Persona deutlich besser passt. ';
    }
    task += 'Gib genau EINEN Eintrag in "vorschlaege" ab.\n';
  } else {
    const ziel = Math.min(Math.max(input.anzahlZiel || MAX_VORSCHLAEGE, 1), MAX_VORSCHLAEGE);
    task += `Erstelle bis zu ${ziel} Persona-Karten als Mix:\n`
      + '- MATCHES auf bestehende Personas, aber NUR bei echtem Fit (Ziel: 2-3, wenn so viele wirklich passen). '
      + 'fit_grund nennt konkret, welche Pain Points/Beduerfnisse der Persona auf welche Produktfakten treffen.\n'
      + '- NEUE Personas nur fuer echte Luecken, die keine Pool-Persona abdeckt. '
      + 'luecken_begruendung sagt in einem Satz, warum keine Bestehende passt.\n'
      + '- Keine Quote um jeden Preis: passt weniger, liefere weniger. '
      + 'Gematchte Personas nie als "neu" nachbauen (Covered-Set).\n';
  }

  task += '\n# AUSGABEFORMAT\nGib das Ergebnis AUSSCHLIESSLICH ueber das Tool "persona_vorschlaege_abgeben" ab. '
    + 'use_case_indices sind 0-basiert auf die gemeinsame Liste (bestehende zuerst, dann deine generierten). '
    + 'Jede Karte braucht mindestens einen Use-Case-Bezug. '
    + 'Bei "neu" das volle Profil fuellen, aber nur soweit fundierbar - leere Felder sind erlaubt, Klischees nicht.';

  return { stable, task };
}

/**
 * Validiert und beschneidet die Modell-Antwort.
 * - match ohne bekannte Pool-ID -> verworfen (kein Halluzinations-Link)
 * - neu ohne persona.name -> verworfen
 * - use_case_indices ausserhalb der Liste -> gefiltert; Karte ohne gueltigen
 *   Bezug fliegt raus
 */
function validateVorschlaege(json, { poolIds = [], useCaseCount = 0, maxVorschlaege = MAX_VORSCHLAEGE } = {}) {
  const poolSet = new Set(poolIds);
  const roh = Array.isArray(json?.vorschlaege) ? json.vorschlaege : [];
  const sauber = [];
  const verworfen = [];

  for (const v of roh) {
    const indices = [...new Set((Array.isArray(v.use_case_indices) ? v.use_case_indices : [])
      .filter(i => Number.isInteger(i) && i >= 0 && i < useCaseCount))];

    if (!indices.length) {
      verworfen.push({ grund: 'kein gueltiger Use-Case-Bezug', vorschlag: v?.persona?.name || v?.persona_id || null });
      continue;
    }

    if (v.typ === 'match') {
      if (!v.persona_id || !poolSet.has(v.persona_id)) {
        verworfen.push({ grund: 'match mit unbekannter Pool-ID', vorschlag: v?.persona_id || null });
        continue;
      }
      sauber.push({
        typ: 'match',
        persona_id: v.persona_id,
        fit_grund: String(v.fit_grund || '').trim(),
        use_case_indices: indices,
        persona: null,
        luecken_begruendung: null
      });
      continue;
    }

    const persona = v.persona && typeof v.persona === 'object' ? v.persona : null;
    if (!persona?.name || !String(persona.name).trim()) {
      verworfen.push({ grund: 'neu ohne Persona-Namen', vorschlag: null });
      continue;
    }

    sauber.push({
      typ: 'neu',
      persona_id: null,
      fit_grund: String(v.fit_grund || '').trim(),
      use_case_indices: indices,
      luecken_begruendung: v.luecken_begruendung ? String(v.luecken_begruendung).trim() : null,
      persona: sanitizePersonaPayload(persona)
    });
  }

  return {
    use_cases: (Array.isArray(json?.use_cases) ? json.use_cases : [])
      .map(uc => ({ name: String(uc?.name || '').trim(), beschreibung: uc?.beschreibung ? String(uc.beschreibung).trim() : null }))
      .filter(uc => uc.name),
    vorschlaege: sauber.slice(0, maxVorschlaege),
    verworfen
  };
}

const BUDGETRAHMEN = ['niedrig', 'mittel', 'hoch'];

/**
 * Postgres: CHECK (budgetrahmen IN ('niedrig','mittel','hoch')), NULL ok.
 * Exakt (case-insensitive), sonst genau ein erlaubtes Wort im String.
 * Ranges wie "mittel bis hoch" → null.
 */
function clampBudgetrahmen(value) {
  if (value === null || value === undefined) return null;
  const n = String(value).trim().toLowerCase();
  if (!n) return null;
  if (BUDGETRAHMEN.includes(n)) return n;
  const hits = BUDGETRAHMEN.filter(v => n.includes(v));
  return hits.length === 1 ? hits[0] : null;
}

/** Nur bekannte Persona-Felder durchlassen, Strings trimmen, Leeres zu null. */
function sanitizePersonaPayload(persona) {
  const STRING_FELDER = [
    'name', 'oberbegriff', 'geschlecht', 'wohnort_region', 'beruf', 'budgetrahmen',
    'bildungsstand', 'lebenssituation', 'kontext', 'pain_points', 'interessen',
    'beduerfnisse', 'kaufmotive', 'einwaende', 'tonalitaet', 'plattformen',
    'content_praeferenzen', 'produkt_loesung', 'produktvorteile', 'beschreibung'
  ];
  const out = {};
  for (const feld of STRING_FELDER) {
    const wert = persona[feld];
    out[feld] = (wert === null || wert === undefined || !String(wert).trim()) ? null : String(wert).trim();
  }
  out.budgetrahmen = clampBudgetrahmen(out.budgetrahmen);
  for (const feld of ['alter_von', 'alter_bis']) {
    const zahl = Number(persona[feld]);
    out[feld] = Number.isInteger(zahl) && zahl >= 0 && zahl <= 120 ? zahl : null;
  }
  return out;
}

module.exports = {
  PERSONA_TOOL,
  buildPrompt,
  loadPoolPersonas,
  validateVorschlaege,
  sanitizePersonaPayload,
  MAX_VORSCHLAEGE
};
