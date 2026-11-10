// produkt-persona.js
// Prompt-Bau, Tool-Schema und Pool-Logik fuer die Persona-Generierung aus
// dem Produkt (produkt-persona-background).
//
// Qualitaetsanalogon zum Skriptsystem: CRM-Fakten statt Halluzination,
// Tool-Schema statt Freitext, Review-Gate im Client. Mechanismen gegen
// generische oder zu spitze Personas:
//   - Kaeufergruppen-Analyse (breiter Lauf: initial und Ersatz der einzigen
//     Karte): erst 2-4 Kaeufergruppen des Gesamtprodukts, die Persona ist
//     ihr gemeinsamer Nenner. Identitaet ist nie Nutzungskontext oder Beruf.
//   - Kein House-Style im breiten Lauf: Profile bestehender Personas
//     kopierten Enge von Produkt zu Produkt. Dort zaehlen nur ihre Namen
//     (Dubletten-Schutz). In weitere/karte steht der Pool als
//     "nicht klonen"-Liste (Name + Oberbegriff).
//   - Covered-Set: bereits liegende/akzeptierte Personas werden als
//     "nicht klonen"-Liste mitgegeben
//
// Feldmarkierungen im Input: fact (belegbar von der Produktseite),
// guess (KI-Extrakt, unsicher), manual (vom Team eingetragen).

const {
  UNISEX_VORNMEN,
  REGISTER_LABELS,
  nameIstUnisex,
  kanonischerUnisexName,
  passtNameZu,
  gefilterteUnisexNamen,
  fmtNamenListe
} = require('./unisex-vornamen');

// Der Pool liefert nur Namen (Dubletten-Schutz) und Oberbegriffe (nicht klonen).
// Keine Profile: sie wuerden als Vorlage dienen und Enge weitervererben.
const POOL_FELDER = 'id, name, oberbegriff';

const MAX_POOL_IM_PROMPT = 12;
const MAX_VORSCHLAEGE = 6;

/** Text kuerzen, damit der Pool den Prompt nicht aufblaedert. */
function cap(value, max = 400) {
  const s = String(value || '').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Pool: erst die Personas der Produkt-Marken, leer -> Fallback auf das
 * Unternehmen. Globale DNA-Personas (unternehmen_id IS NULL) sind bewusst nie
 * Teil des Pools. Der Pool ist kein Match und keine Stil-Vorlage, nur
 * Namens- und Abgrenzungsliste.
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
      // Analyse zuerst (breiter Lauf): die Reihenfolge der Properties ist die
      // Denkreihenfolge. Diese Felder werden nicht gespeichert, sie steuern nur
      // die Identitaet der Persona. In weitere/karte-mit-Karten entfernt
      // personaTool({ breit: false }) sie.
      produkt_kern: {
        type: 'string',
        description: 'Ein Satz: was das Produkt als Ganzes ist und wofuer es gekauft wird. Nicht ein einzelner USP.'
      },
      kaeufergruppen: {
        type: 'array',
        description: '2 bis 4 realistische Kaeufergruppen des GESAMTEN Produkts. Sie unterscheiden sich im Kaufmotiv, nicht im Nutzungskontext oder Beruf.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Kurzer Name der Gruppe' },
            kaufmotiv: { type: 'string', description: 'Warum diese Gruppe kauft, ein Satz' }
          },
          required: ['name', 'kaufmotiv']
        }
      },
      gemeinsamer_nenner: {
        type: 'string',
        description: 'Ein Satz: was die Kaeufergruppen verbindet. Die Persona ist genau dieser Nenner, kein Nutzungskontext und kein Beruf.'
      },
      berufsgebunden: {
        type: 'boolean',
        description: 'true nur, wenn das Produkt ausschliesslich im Beruf Sinn ergibt (z.B. B2B-Software, Fachwerkzeug, Dienstleistung fuer Marketingteams). Sonst false.'
      },
      use_cases: {
        type: 'array',
        description: 'Neu generierte Einsatzsituationen. Leer, wenn bestehende im Auftrag standen - dann nur mappen.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Kurzer benannter Titel, z.B. "Abends auf dem Sofa"' },
            beschreibung: { type: 'string', description: 'Ein bis zwei Saetze: wer nutzt das Produkt hier wann und warum' }
          },
          required: ['name']
        }
      },
      vorschlaege: {
        type: 'array',
        description: 'Genau eine neue Persona (typ immer neu). Kein Match auf bestehende.',
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
                // Reihenfolge ist Absicht: Alter und Namensregister stehen vor dem Namen,
                // damit der Vorname zu beiden passt.
                alter_von: { type: ['integer', 'null'] },
                alter_bis: { type: ['integer', 'null'] },
                namensregister: { type: 'string', enum: REGISTER_LABELS, description: 'Stilrichtung des Vornamens, abgeleitet aus Briefing, sonst Produkt und Marke. Wird nicht gespeichert.' },
                name: { type: 'string', description: 'Deutscher Vorname, passend zu Namensregister und Alter' },
                oberbegriff: { type: 'string', description: 'Kategorie des Typs Mensch, z.B. "Die preisbewusste Qualitaetskaeuferin". Weder Beruf noch Nutzungskontext (Arbeit, Sport, Reisen, Pendeln) als Identitaet, ausser das Produkt ist berufsgebunden.' },
                geschlecht: { type: ['string', 'null'], description: 'Weiblich, Maennlich, Divers oder Gemischt' },
                wohnort_region: { type: ['string', 'null'] },
                beruf: { type: ['string', 'null'], description: 'Nur wenn das Produkt berufsgebunden ist, sonst null. Kein "Berufstaetig in Vollzeit".' },
                budgetrahmen: { type: ['string', 'null'], enum: ['niedrig', 'mittel', 'hoch'], description: 'niedrig, mittel oder hoch – genau einer der drei Werte, keine Ranges' },
                bildungsstand: { type: ['string', 'null'] },
                lebenssituation: { type: ['string', 'null'], description: 'Single, Familie, Paar ohne Kinder, Alleinerziehend, Student/in, Rentner/in, Mensch mit Behinderung, WG / Wohngemeinschaft' },
                branche_id: { type: ['string', 'null'], description: 'UUID einer Branche, nur wenn sie im Auftrag steht. Keine erfundenen IDs.' },
                pain_points: { type: ['string', 'null'], description: 'Konkrete Alltagsprobleme dieser Person. Ein Punkt pro Zeile, maximal fuenf. Keine Produktvorteile, keine Kampagnenideen.' },
                interessen: { type: ['string', 'null'] },
                beduerfnisse: { type: ['string', 'null'] },
                kaufmotive: { type: ['string', 'null'] },
                einwaende: { type: ['string', 'null'] },
                tonalitaet: { type: ['string', 'null'], description: 'Wie die Person angesprochen werden will' },
                plattformen: { type: ['string', 'null'] },
                content_praeferenzen: { type: ['string', 'null'] },
                produkt_loesung: { type: ['string', 'null'], description: 'Was Angebote dieses Typs fuer DIESE Person loesen - allgemein, keine SKU, keine Kampagne' },
                produktvorteile: { type: ['string', 'null'], description: 'Welche Vorteile fuer diesen Typ zaehlen - typbezogen, nicht SKU-scharf' },
                beschreibung: { type: ['string', 'null'], description: 'Zwei bis vier sachliche Saetze, wer diese Person ist. Kein Storytelling, keine Werbesprache.' },
                _audience_situations: {
                  type: 'array',
                  description: '2 bis 4 Empfangsmomente der Person: Alltag, wann sie empfänglich ist. Keine Produkt-Use-Cases, keine Content- oder Kampagnenideen.',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Kurzer Titel, z.B. "morgens unter Zeitdruck"' },
                      beschreibung: { type: ['string', 'null'], description: 'Ein bis zwei Saetze: wann und warum sie in diesem Moment empfänglich ist' }
                    },
                    required: ['name']
                  }
                }
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

function modusBrauchtUnisexName(modus) {
  const wert = modus || 'initial';
  return wert === 'initial' || wert === 'karte';
}

/**
 * Breiter Lauf: Startrun (initial) und Ersatz der einzigen Karte. Nur dort
 * gilt die Kaeufergruppen-Analyse. weitere und Ersatz neben anderen Karten
 * suchen bewusst einen anderen, ggf. engeren Typ.
 */
function istBreiterLauf(input) {
  const modus = input?.modus || 'initial';
  if (modus === 'initial') return true;
  return modus === 'karte' && !(Array.isArray(input?.behalten) && input.behalten.length);
}

const ANALYSE_FELDER = ['produkt_kern', 'kaeufergruppen', 'gemeinsamer_nenner', 'berufsgebunden'];

/**
 * Kopie des Tool-Schemas. Bei Unisex ist der Vorname eine feste Liste.
 * Ohne breit (weitere, Ersatz neben anderen Karten) entfallen die Analysefelder.
 */
function personaTool({ unisexNamen = false, namen = [], breit = true } = {}) {
  const tool = JSON.parse(JSON.stringify(PERSONA_TOOL));
  if (breit) {
    tool.input_schema.required = [...ANALYSE_FELDER, 'vorschlaege'];
  } else {
    for (const feld of ANALYSE_FELDER) delete tool.input_schema.properties[feld];
  }
  if (!unisexNamen) return tool;
  const props = tool.input_schema.properties.vorschlaege.items.properties.persona.properties;
  const liste = namen.length ? namen : [...UNISEX_VORNMEN];
  props.name.enum = liste;
  props.name.description = 'Genau einer dieser Vornamen, passend zu namensregister und Alter. Kein anderer Name.';
  const persona = tool.input_schema.properties.vorschlaege.items.properties.persona;
  persona.required = ['namensregister', 'name'];
  props.geschlecht.enum = ['Gemischt'];
  props.geschlecht.description = 'Immer Gemischt.';
  props.oberbegriff.description = 'Geschlechtsneutrale Kategorie des Typs Mensch, z.B. "Alltagsnutzende mit Wunsch nach Verlaesslichkeit". Weder Beruf noch Nutzungskontext (Arbeit, Sport, Reisen, Pendeln) als Identitaet, ausser das Produkt ist berufsgebunden.';
  return tool;
}

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

/** Pool-Eintrag: nur Name und Oberbegriff. Keine Profil-Felder, kein Beruf, keine Pain Points. */
function fmtPoolPersona(p) {
  return `- ${p.name}${p.oberbegriff ? ` (${p.oberbegriff})` : ''}`;
}

// Verfahren statt Adjektiv: "breit" heisst, die Identitaet der Persona kommt
// aus dem gemeinsamen Nenner mehrerer Kaeufergruppen. Der Nutzungskontext
// (Arbeit, Sport, Reisen) und der Beruf gehoeren in Audience Situations und
// Use Cases, nicht in die Identitaet.
const BREIT_AUFTRAG = '\n# ANALYSE ZUERST (Breite der Persona)\n'
  + 'Fuelle zuerst produkt_kern, kaeufergruppen, gemeinsamer_nenner und berufsgebunden, dann Use Cases, dann die Persona.\n'
  + '- kaeufergruppen: 2 bis 4 realistische Kaeufergruppen des GESAMTEN Produkts, je mit dem Kaufmotiv, das sie antreibt. '
  + 'Die Gruppen unterscheiden sich im Kaufmotiv, nicht in Ort oder Anlass der Nutzung. '
  + 'Beispiel Kopfhoerer: "Pendler, die abschalten wollen", "Sportliche mit Fokus auf Halt", "Preisbewusste mit Markenwunsch" - nicht drei Orte, an denen man sie traegt.\n'
  + '- gemeinsamer_nenner: ein Satz, was diese Gruppen verbindet. Die Persona ist genau dieser Nenner.\n'
  + '- berufsgebunden: true nur, wenn das Produkt ausschliesslich im Beruf Sinn ergibt (B2B-Software, Fachwerkzeug, Dienstleistung fuer Marketingteams). Sonst false.\n'
  + '# IDENTITAET DER PERSONA\n'
  + 'oberbegriff und beschreibung leiten sich aus dem gemeinsamen Nenner ab. '
  + 'Weder ein Nutzungskontext (Arbeit, Sport, Reisen, Pendeln) noch ein Beruf ist die Identitaet, ausser berufsgebunden ist true. '
  + 'Ist berufsgebunden false, bleibt beruf leer. '
  + 'Pain Points, Loesung und Einsatzsituation des Produkts zeigen, wofuer das Produkt gebaut ist: sie sind Hinweise auf Kaeufergruppen, '
  + 'nicht die Pain Points der Persona. Die Pain Points der Persona gelten fuer den ganzen Typ, nicht fuer ein einzelnes Feature. '
  + 'Die Audience Situations decken mindestens zwei Kaeufergruppen ab.\n';

/**
 * Baut den Prompt. Rueckgabe { stable, task } - der stable Block ist
 * cachebar, der Task traegt die variablen Produktdaten.
 *
 * input: {
 *   felder: { name: {value, kind} | string, ... },
 *   markeNamen: string[], unternehmenName: string|null,
 *   bestehendeUseCases: [{ name, beschreibung }],
 *   modus: 'initial' | 'weitere' | 'karte',
 *   anzahlZiel: number,
 *   behalten: [{ typ, name }],        // aktive Karten (freeze)
 *   ersetzteKarte: { typ, name } | null     // karte-Modus, name = verworfener Vorname
 * }
 */
function buildPrompt(input, { pool = [], poolQuelle = 'leer' } = {}) {
  let stable = 'Du beschreibst TYPEN MENSCH, die zum Produkt passen. Keine Zielgruppe, keine Kampagnenstrategie, keine Content-Ideen. '
    + 'Eine Persona ist ein Typ Mensch auf Unternehmensebene. Der produkt-spezifische Fit gehoert in fit_grund und Use Cases, nicht in die Persona-Felder. '
    + 'Deine Vorschlaege prueft ein Mensch, bevor sie uebernommen werden.\n\n';

  stable += '# GRUNDREGELN (verbindlich)\n'
    + '1. NICHTS ERFINDEN. Jede Persona und jeder Use Case leitet sich aus den Produkt- und Marken-Fakten ab. '
    + 'Was nicht fundierbar ist, bleibt leer oder wird als begruendete Hypothese formuliert ("vermutlich ..., weil ...").\n'
    + '2. KEINE KLISCHEES. Demografie ist nie die Identitaet. "Studentin, 22, mag Instagram" ist kein Ergebnis. '
    + 'Pain Points, Kaufmotive und Einwaende sind konkret und alltagsnah, keine Allgemeinplaetze.\n'
    + '3. FELDMARKIERUNGEN beachten: BELEGBAR ist Fakt, ABGELEITET ist unsicher (nicht als Wahrheit verkaufen), '
    + 'MANUELL hat hoechste Verlaesslichkeit.\n'
    + '4. QUALITAET VOR QUANTITAET. Genau eine Persona: der breiteste tragfaehige Typ, der zum Produkt passt. '
    + 'Kein Szenen-Schnitt, keine Nische um der Nische willen. Trotzdem konkret: Pain Points und Kaufmotive sitzen, keine Demografie-Huelsen.\n'
    + '5. Neue Personas sind MENSCHEN, keine Produkt-Fact-Sheets. Persona-Felder: kurz, sachlich, abgeleitet. '
    + 'Keine Fantasie-Biografie, kein Storytelling, keine Kampagnenrichtung. '
    + 'produkt_loesung und produktvorteile beschreiben den Typ Mensch allgemein - keine Preise, Modellnamen oder SKU-Details.\n'
    + '6. Audience Situations im Persona-Profil: 2 bis 4 konkrete Alltag-/Empfangsmomente der Person. '
    + 'Keine Einsatzsituation des Produkts, keine Videoidee, keine Kampagnenrichtung.\n'
    + '7. fit_grund und Use Cases duerfen den Produkt-Fit nennen. Diese Ideen nicht in beschreibung, pain_points, '
    + 'kaufmotive oder Audience Situations kopieren.\n';

  // Breiter Lauf (initial, Ersatz der einzigen Karte): Profile bestehender
  // Personas kopierten Enge von Produkt zu Produkt. Dort nur Namen (unten).
  const breit = istBreiterLauf(input);

  if (!breit && pool.length) {
    stable += '\n# ABGRENZUNG ZU BESTEHENDEN PERSONAS (verbindlich)\n'
      + 'Bestehende Personas des Unternehmens sind keine Vorlage fuer Inhalt, Enge oder Berufsbild. '
      + 'Die neue Persona ist ein anderer Typ, nicht eine Variante davon.\n';
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

  // Der Client (Job-Input) sendet snake_case; die Indizes in der Antwort und
  // validateVorschlaege zaehlen diese Liste mit (bestehende zuerst).
  const bestehendeRoh = input.bestehendeUseCases || input.bestehende_use_cases;
  const bestehende = Array.isArray(bestehendeRoh) ? bestehendeRoh : [];
  if (bestehende.length) {
    task += '\n# BESTEHENDE EINSATZSITUATIONEN (fix, nicht neu erfinden - nur mappen)\n';
    bestehende.forEach((uc, i) => {
      task += `${i}. ${uc.name}${uc.beschreibung ? `: ${cap(uc.beschreibung, 200)}` : ''}\n`;
    });
  } else {
    task += '\n# EINSATZSITUATIONEN\nEs gibt noch keine. Generiere ZUERST 3 bis 6 benannte Einsatzsituationen '
      + '(Use Cases) aus den Produktfakten: konkrete Situationen, in denen das Produkt genutzt wird '
      + '(z.B. "Abends auf dem Sofa", "Am Wochenende unterwegs"). Keine Zielgruppen-Demografie als Use Case. '
      + (breit ? 'Sie decken das Gesamtprodukt und mehrere Kaeufergruppen ab, nicht nur den auffaelligsten USP. ' : '')
      + 'Jede Persona-Karte mappt danach auf mindestens eine davon.\n';
  }

  if (breit) {
    // bewusst kein Pool-Abschnitt: nur die Namen fliessen unten in die Namensliste
  } else if (pool.length) {
    const quelleLabel = poolQuelle === 'marke' ? 'der Produkt-Marken' : 'des Unternehmens (Fallback, Marke hat keine eigenen)';
    task += `\n# BESTEHENDE PERSONAS ${quelleLabel} (nicht klonen, keine Muster uebernehmen)\n`;
    pool.slice(0, MAX_POOL_IM_PROMPT).forEach((p) => {
      task += `${fmtPoolPersona(p)}\n`;
    });
    if (pool.length > MAX_POOL_IM_PROMPT) {
      task += `(weitere ${pool.length - MAX_POOL_IM_PROMPT} Pool-Personas nicht gezeigt)\n`;
    }
  } else {
    task += '\n# BESTEHENDE PERSONAS\nKeine vorhanden - entwirf eine neue Persona.\n';
  }

  const behalten = Array.isArray(input.behalten) ? input.behalten : [];
  if (behalten.length) {
    task += '\n# BEREITS AUF KARTEN (freeze - nicht duplizieren, nicht noch einmal vorschlagen)\n';
    behalten.forEach((b) => { task += `- ${b.name}${b.typ === 'match' ? ' (bestehende Persona)' : ' (neuer Entwurf)'}\n`; });
  }

  const unisex = modusBrauchtUnisexName(input.modus);
  const namenListe = gefilterteUnisexNamen({
    poolNamen: (pool || []).map((p) => p?.name),
    belegteNamen: behalten.map((b) => b?.name),
    verworfenerName: input.ersetzteKarte?.name
  });

  const briefingText = String(input.briefingText || '').trim();
  if (briefingText) {
    task += '\n# BRIEFING DER LINIE (nur fuer die Namenswahl)\n'
      + 'Das Briefing bestimmt das Namensregister des Vornamens: Ton, Zielwelt, Plattform, Sprache, Setting. '
      + 'Es steuert AUSSCHLIESSLICH den Vornamen. Alle anderen Persona-Felder (Alter, Beruf, Pain Points, Kaufmotive, '
      + `Oberbegriff, Beschreibung usw.) leitest du nur aus Produkt und Marke${breit ? '' : ' und bestehenden Personas'} ab, `
      + 'nie aus dem Briefing. Die Persona bleibt ein wiederverwendbarer Typ Mensch auf Unternehmensebene.\n'
      + `${briefingText}\n`;
  }

  task += '\n# AUFTRAG\n';
  if (input.modus === 'karte') {
    task += 'Ersetze GENAU EINE verworfene Karte durch eine neue Persona. ';
    task += 'Dieselbe Rolle wie die verworfene Karte. Weiterhin der breiteste Typ, nicht enger schneiden, nicht auf ein Geschlecht ziehen. ';
    const alt = String(input.ersetzteKarte?.name || '').trim();
    if (alt) task += `Diesen Vornamen nicht wiederverwenden: ${alt}. `;
  } else if (input.modus === 'weitere') {
    task += 'Lege GENAU EINE weitere neue Persona dazu. Anderer Typ als das Covered-Set, weiterhin der naechst-breiteste tragfaehige Typ – keine Nische. ';
  } else {
    task += 'Erstelle GENAU EINE neue Persona. Der breiteste tragfaehige Typ Mensch, der zum Produkt passt. ';
  }
  task += 'typ immer "neu". Kein Szenen-Schnitt, keine Nische, keine Quote, kein Match auf bestehende Personas – Wiederverwenden macht der Mensch manuell. '
    + (breit
      ? 'fit_grund nennt die Kaeufergruppen und welche Produktfakten sie ansprechen, nicht einen einzelnen USP. '
      : 'fit_grund nennt konkret, welche Pain Points/Beduerfnisse auf welche Produktfakten treffen. ')
    + 'Gib genau EINEN Eintrag in "vorschlaege" ab.\n';

  if (breit) task += BREIT_AUFTRAG;

  const quelleRegister = briefingText ? 'dem Briefing der Linie' : 'Produkt und Marke';
  const namenKopf = `Namensregister: ${REGISTER_LABELS.join(' | ')}. Namen mit den Jahrgaengen, zu denen sie passen (jung bis 30, mittel 31-50, aelter ab 51):\n`
    + `${fmtNamenListe(namenListe)}\n`;
  if (unisex) {
    task += 'Reihenfolge: erst alter_von und alter_bis, dann namensregister aus '
      + `${quelleRegister}, dann der Vorname. `
      + 'Der Vorname kommt aus dieser Liste, exakt eine Schreibweise, und passt zum gewaehlten Register UND zum Alter. '
      + 'Bestehende Personas sind fuer den Vornamen keine Vorlage. '
      + 'geschlecht ist "Gemischt". '
      + 'oberbegriff, beruf und beschreibung ohne -in/-er und ohne sie/er.\n'
      + namenKopf;
  } else {
    task += 'Vorname: waehle namensregister aus '
      + `${quelleRegister}, der Jahrgang des Namens passt zum Alter. `
      + 'Die Liste ist nur Orientierung fuer Register und Jahrgang. Der Name darf frei gewaehlt werden, auch geschlechtlich.\n'
      + namenKopf;
  }

  task += '\n# AUSGABEFORMAT\nGib das Ergebnis AUSSCHLIESSLICH ueber das Tool "persona_vorschlaege_abgeben" ab. '
    + 'use_case_indices sind 0-basiert auf die gemeinsame Liste (bestehende zuerst, dann deine generierten). '
    + 'Jede Karte braucht mindestens einen Use-Case-Bezug. '
    + 'Bei "neu" das volle Profil fuellen, aber nur soweit fundierbar - leere Felder sind erlaubt, Klischees nicht. '
    + '_audience_situations: 2 bis 4 Empfangsmomente der Person, keine Produkt-Use-Cases.';

  return { stable, task };
}

/**
 * Validiert und beschneidet die Modell-Antwort.
 * - match -> verworfen (KI matcht nicht, Wiederverwenden ist manuell)
 * - neu ohne persona.name -> verworfen
 * - use_case_indices ausserhalb der Liste -> gefiltert; Karte ohne gueltigen
 *   Bezug fliegt raus
 * - unisexNamen: Vorname muss aus der Unisex-Liste kommen, geschlecht wird Gemischt
 */
function validateVorschlaege(json, { useCaseCount = 0, maxVorschlaege = 1, unisexNamen = false, breit = false } = {}) {
  const roh = Array.isArray(json?.vorschlaege) ? json.vorschlaege : [];
  const sauber = [];
  const verworfen = [];
  const analyse = sanitizeAnalyse(json);

  for (const v of roh) {
    const indices = [...new Set((Array.isArray(v.use_case_indices) ? v.use_case_indices : [])
      .filter(i => Number.isInteger(i) && i >= 0 && i < useCaseCount))];

    if (!indices.length) {
      verworfen.push({ grund: 'kein gueltiger Use-Case-Bezug', vorschlag: v?.persona?.name || v?.persona_id || null });
      continue;
    }

    if (v.typ === 'match') {
      verworfen.push({ grund: 'KI-Match nicht erlaubt', vorschlag: v?.persona_id || null });
      continue;
    }

    const persona = v.persona && typeof v.persona === 'object' ? v.persona : null;
    if (!persona?.name || !String(persona.name).trim()) {
      verworfen.push({ grund: 'neu ohne Persona-Namen', vorschlag: null });
      continue;
    }

    if (unisexNamen && !nameIstUnisex(persona.name)) {
      verworfen.push({ grund: 'kein Unisex-Vorname', vorschlag: String(persona.name).trim() });
      continue;
    }

    if (unisexNamen) {
      const register = String(persona.namensregister || '').trim() || null;
      const passt = passtNameZu(persona.name, {
        register,
        alterVon: persona.alter_von,
        alterBis: persona.alter_bis
      });
      if (!passt.ok) {
        verworfen.push({
          grund: passt.grund,
          vorschlag: String(persona.name).trim(),
          register,
          alter_von: persona.alter_von ?? null,
          alter_bis: persona.alter_bis ?? null
        });
        continue;
      }
    }

    const payload = sanitizePersonaPayload(persona);
    if (unisexNamen) {
      payload.name = kanonischerUnisexName(persona.name);
      payload.geschlecht = 'Gemischt';
    }
    // Breiter Lauf: ein Beruf gehoert nur zu berufsgebundenen Produkten.
    // Deterministisch, weil das Modell "Berufstaetig in Vollzeit" sonst
    // fast immer einsetzt und die Persona daran aufhaengt.
    if (breit && !analyse.berufsgebunden) payload.beruf = null;

    sauber.push({
      typ: 'neu',
      persona_id: null,
      fit_grund: String(v.fit_grund || '').trim(),
      use_case_indices: indices,
      luecken_begruendung: v.luecken_begruendung ? String(v.luecken_begruendung).trim() : null,
      persona: payload
    });
  }

  // Breiter Lauf: ohne mindestens zwei Kaeufergruppen steht die Persona auf
  // einem Einzelkontext. Der Aufrufer faehrt dann einen Korrektur-Retry.
  const breiteOk = !breit || analyse.kaeufergruppen.length >= MIN_KAEUFERGRUPPEN;
  if (!breiteOk) {
    for (const v of sauber) {
      verworfen.push({ grund: GRUND_ZU_WENIG_GRUPPEN, vorschlag: v.persona?.name || null });
    }
    sauber.length = 0;
  }

  return {
    use_cases: (Array.isArray(json?.use_cases) ? json.use_cases : [])
      .map(uc => ({ name: String(uc?.name || '').trim(), beschreibung: uc?.beschreibung ? String(uc.beschreibung).trim() : null }))
      .filter(uc => uc.name),
    vorschlaege: sauber.slice(0, maxVorschlaege),
    verworfen,
    analyse,
    breiteOk
  };
}

const MIN_KAEUFERGRUPPEN = 2;
const MAX_KAEUFERGRUPPEN = 4;
const GRUND_ZU_WENIG_GRUPPEN = 'zu wenige Kaeufergruppen';

/**
 * Analysefelder des breiten Laufs bereinigen. Sie werden nicht an der Persona
 * gespeichert, nur fuer die Breiten-Pruefung und die Diagnose im Job-Result.
 */
function sanitizeAnalyse(json) {
  const gesehen = new Set();
  const kaeufergruppen = [];
  for (const g of Array.isArray(json?.kaeufergruppen) ? json.kaeufergruppen : []) {
    const name = String(g?.name || '').trim();
    if (!name || gesehen.has(name.toLowerCase())) continue;
    gesehen.add(name.toLowerCase());
    kaeufergruppen.push({ name, kaufmotiv: String(g?.kaufmotiv || '').trim() || null });
    if (kaeufergruppen.length >= MAX_KAEUFERGRUPPEN) break;
  }
  return {
    produkt_kern: String(json?.produkt_kern || '').trim() || null,
    kaeufergruppen,
    gemeinsamer_nenner: String(json?.gemeinsamer_nenner || '').trim() || null,
    berufsgebunden: json?.berufsgebunden === true || json?.berufsgebunden === 'true'
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeAudienceSituations(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const gesehen = new Set();
  const out = [];
  for (const s of list) {
    const name = String(s?.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    out.push({
      name,
      beschreibung: s?.beschreibung ? String(s.beschreibung).trim() || null : null
    });
    if (out.length >= 4) break;
  }
  return out;
}

/** Nur bekannte Persona-Felder durchlassen, Strings trimmen, Leeres zu null. */
function sanitizePersonaPayload(persona) {
  const STRING_FELDER = [
    'name', 'oberbegriff', 'geschlecht', 'wohnort_region', 'beruf', 'budgetrahmen',
    'bildungsstand', 'lebenssituation', 'pain_points', 'interessen',
    'beduerfnisse', 'kaufmotive', 'einwaende', 'tonalitaet', 'plattformen',
    'content_praeferenzen', 'produkt_loesung', 'produktvorteile', 'beschreibung'
  ];
  const out = {};
  for (const feld of STRING_FELDER) {
    const wert = persona[feld];
    out[feld] = (wert === null || wert === undefined || !String(wert).trim()) ? null : String(wert).trim();
  }
  out.budgetrahmen = clampBudgetrahmen(out.budgetrahmen);
  const branche = String(persona.branche_id || '').trim();
  out.branche_id = UUID_RE.test(branche) ? branche : null;
  for (const feld of ['alter_von', 'alter_bis']) {
    const zahl = Number(persona[feld]);
    out[feld] = Number.isInteger(zahl) && zahl >= 0 && zahl <= 120 ? zahl : null;
  }
  out._audience_situations = sanitizeAudienceSituations(
    persona._audience_situations || persona.audience_situations
  );
  return out;
}

module.exports = {
  PERSONA_TOOL,
  personaTool,
  modusBrauchtUnisexName,
  gefilterteUnisexNamen,
  buildPrompt,
  loadPoolPersonas,
  validateVorschlaege,
  sanitizePersonaPayload,
  sanitizeAnalyse,
  istBreiterLauf,
  GRUND_ZU_WENIG_GRUPPEN,
  MAX_VORSCHLAEGE
};
