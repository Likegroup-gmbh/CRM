// Leitet das Geschlecht eines Creators aus Vorname, Instagram-Name und Bio ab.
//
// Hintergrund: Meta gibt das Geschlecht eines Profils ueber keine API heraus -
// weder Business Discovery noch Insights (audience_gender_age beschreibt die
// Follower, nicht den Account-Inhaber). Die Ableitung laeuft daher ueber den
// Namen, mit der Bio als Korrektiv fuer Accounts, hinter denen keine einzelne
// Person steht (Paare, Familien, Tiere).
//
// Genutzt von backfill-geschlecht.js (Bestand) und instagram-connect.js
// (Neuzugaenge). Schreibt selbst nicht in die DB - der Aufrufer entscheidet,
// was er mit den Vorschlaegen macht.

const { callClaude, extractJson, MODELS } = require('./anthropic');
const { starteKiRequest } = require('./ki-log');

// Muss zu GESCHLECHT_OPTIONS in src/core/form/config/CreatorFormConfig.js passen
const GESCHLECHTER = ['männlich', 'weiblich', 'divers', 'paar', 'familie', 'tier'];

const BATCH_GROESSE = 25;
// Unterhalb davon wird das Feld lieber leer gelassen als geraten - eine falsche
// Ansprache ist teurer als ein fehlender Filter-Treffer
const MIN_KONFIDENZ = 0.8;
const BIO_MAX_ZEICHEN = 300;

const GESCHLECHT_TOOL = {
  name: 'geschlecht_abgeben',
  description: 'Gibt die Einschaetzung fuer alle Eintraege der Liste strukturiert ab.',
  input_schema: {
    type: 'object',
    properties: {
      ergebnisse: {
        type: 'array',
        description: 'Ein Eintrag pro Nummer aus der Liste, in derselben Reihenfolge.',
        items: {
          type: 'object',
          properties: {
            nr: { type: 'integer', description: 'Nummer des Eintrags aus der Liste' },
            geschlecht: {
              type: ['string', 'null'],
              enum: [...GESCHLECHTER, null],
              description: 'Eingeschaetztes Geschlecht oder null, wenn unklar'
            },
            konfidenz: {
              type: 'number',
              description: 'Sicherheit zwischen 0 und 1, ehrlich geschaetzt'
            }
          },
          required: ['nr', 'geschlecht', 'konfidenz']
        }
      }
    },
    required: ['ergebnisse']
  }
};

// Stabiler Prefix -> wird gecacht und kostet ab dem zweiten Batch fast nichts
const SYSTEM_PROMPT = [
  'Du ordnest Eintraege aus einem Creator-CRM einer Geschlechts-Kategorie zu.',
  'Grundlage sind Name, Instagram-Name, Handle und Bio.',
  'Antworte ausschliesslich ueber das Tool.',
  '',
  'Erlaubte Werte:',
  '- "männlich" / "weiblich": eine einzelne Person dieses Geschlechts',
  '- "divers": nur bei ausdruecklichem Signal (they/them, non-binary, enby, nicht-binaer).',
  '  Ein uneindeutiger Vorname allein ist KEIN Signal dafuer.',
  '- "paar": der Eintrag steht fuer zwei erwachsene Personen gemeinsam',
  '- "familie": der Eintrag steht fuer eine Familie als Ganzes',
  '- "tier": der Account gehoert einem Tier (Tiername statt Personenname, "my human",',
  '  Rassebezeichnung, Pfoten-Emojis)',
  '- null: keine Person erkennbar oder Name international nicht eindeutig und die Bio',
  '  liefert nichts. Lieber null als geraten.',
  '',
  'Wichtigste Regel - gemeint ist die Person im Namensfeld, nicht der Account:',
  '- Nennt das Namensfeld genau eine Person, gilt deren Geschlecht. Auch dann, wenn der',
  '  Account von einem Paar oder einer Familie gefuehrt wird. Ein Eintrag "Merle D." mit',
  '  der Bio "Merle & Thies mit Baby" ist "weiblich", nicht "paar".',
  '- "paar" und "familie" nur, wenn das Namensfeld selbst mehrere Personen nennt',
  '  ("Joni & Svenja", "StineundMarc", "lena.tim") oder keinen Personennamen enthaelt',
  '  und die Bio den Account eindeutig als Paar bzw. Familie ausweist.',
  '',
  'Weitere Regeln:',
  '- Steht im Namensfeld eine Firma (GmbH, GbR, Media, Agentur) oder ein interner',
  '  Platzhalter, entscheidet die Bio: beschreibt sie eine einzelne Person, gilt deren',
  '  Geschlecht. Gibt die Bio nichts her, ist die Antwort null.',
  '- Die Bio ist das Korrektiv fuer uneindeutige Namen, und zwar in beide Richtungen:',
  '  ein Kunstname mit der Bio "mom of two" ist "weiblich"; ein Namensfeld mit zwei',
  '  Vornamen, dessen Bio durchgehend nur eine Frau beschreibt, ist "weiblich".',
  '- Deutsche und internationale Vornamen bewerten, Schreibvarianten beruecksichtigen.',
  '- Bei Namen, die je nach Land ein anderes Geschlecht haben (Andrea, Simone, Noa,',
  '  Dominique), ohne weiteres Signal die Konfidenz niedrig halten.',
  '- konfidenz ehrlich schaetzen: 0.95+ nur bei eindeutigen Vornamen oder klarer Bio,',
  '  unter 0.8 bei allem, wo du raten wuerdest.',
  '- Fuer JEDE Nummer der Liste genau einen Eintrag zurueckgeben.'
].join('\n');

/** Kompakte, tokensparende Darstellung eines Creators fuer den Prompt */
function formatEintrag(creator, nr) {
  const zeilen = [`${nr}.`];
  const name = [creator.vorname, creator.nachname].filter(Boolean).join(' ').trim();
  if (name) zeilen.push(`Name: ${name}`);
  if (creator.ig_name && creator.ig_name !== name) zeilen.push(`IG-Name: ${creator.ig_name}`);
  if (creator.ig_username) zeilen.push(`Handle: @${creator.ig_username}`);
  const bio = (creator.ig_biography || '').replace(/\s+/g, ' ').trim();
  if (bio) zeilen.push(`Bio: ${bio.slice(0, BIO_MAX_ZEICHEN)}`);
  return zeilen.join(' | ');
}

/** Ein Batch durch das Modell schicken, Rohantwort auf die IDs zurueckmappen */
async function verarbeiteBatch(batch, { supabase, userId, feature, timeoutMs }) {
  const liste = batch.map((c, i) => formatEintrag(c, i + 1)).join('\n');
  const userPrompt = `Ordne die folgenden ${batch.length} Creator ein:\n\n${liste}`;

  // Kein eigenes Frequenz-Limit: Backfill und Instagram-Connect sind bereits
  // durch ihre eigene Auth gated, hier zaehlt nur die Kostentransparenz
  const ki = await starteKiRequest(supabase, { userId, feature, pruefeLimit: false });

  let result;
  try {
    result = await callClaude({
      model: MODELS.distill,
      systemBlocks: [{ text: SYSTEM_PROMPT, cache: true }],
      userPrompt,
      maxTokens: 2048,
      tool: GESCHLECHT_TOOL,
      timeoutMs
    });
    await ki.abschliessen(result);
  } catch (err) {
    await ki.fehlgeschlagen(err);
    throw err;
  }

  const parsed = result.json || extractJson(result.text, { keys: ['ergebnisse'] });
  const ergebnisse = Array.isArray(parsed?.ergebnisse) ? parsed.ergebnisse : [];

  const treffer = [];
  for (const eintrag of ergebnisse) {
    const creator = batch[Number(eintrag?.nr) - 1];
    if (!creator) continue;

    const geschlecht = GESCHLECHTER.includes(eintrag.geschlecht) ? eintrag.geschlecht : null;
    const konfidenz = Number(eintrag.konfidenz);
    const sicher = geschlecht && Number.isFinite(konfidenz) && konfidenz >= MIN_KONFIDENZ;

    treffer.push({
      id: creator.id,
      geschlecht: sicher ? geschlecht : null,
      konfidenz: Number.isFinite(konfidenz) ? Math.round(konfidenz * 100) / 100 : null,
      // Fuer die Diagnose im Trockenlauf: was das Modell wollte, bevor die
      // Konfidenz-Schwelle gegriffen hat
      vorschlag: geschlecht
    });
  }

  return treffer;
}

/**
 * Schaetzt das Geschlecht fuer eine Liste von Creators.
 *
 * @param {Array} creators [{ id, vorname, nachname, ig_username, ig_name, ig_biography }]
 * @param {object} opts { supabase (Service-Role), userId, feature, timeoutMs }
 * @returns {Promise<{ treffer: Array, fehler: Array }>}
 *          treffer: [{ id, geschlecht, konfidenz, vorschlag }] - geschlecht ist
 *          null, wenn das Modell unsicher war. fehler: [{ batch, message }]
 */
async function erkenneGeschlecht(creators, {
  supabase,
  userId = null,
  feature = 'geschlecht_ableitung',
  timeoutMs = 0
} = {}) {
  if (!supabase) throw new Error('geschlecht-erkennen: supabase-Client fehlt');

  const offen = (creators || []).filter((c) => c?.id && (c.vorname || c.ig_biography || c.ig_name));
  const treffer = [];
  const fehler = [];

  for (let i = 0; i < offen.length; i += BATCH_GROESSE) {
    const batch = offen.slice(i, i + BATCH_GROESSE);
    const nummer = Math.floor(i / BATCH_GROESSE) + 1;
    try {
      const ergebnis = await verarbeiteBatch(batch, { supabase, userId, feature, timeoutMs });
      treffer.push(...ergebnis);
    } catch (err) {
      // Ein kaputter Batch darf den Rest nicht mitreissen
      console.warn(`⚠️ geschlecht-erkennen: Batch ${nummer} fehlgeschlagen: ${err.message}`);
      fehler.push({ batch: nummer, message: err.message });
    }
  }

  return { treffer, fehler };
}

module.exports = { erkenneGeschlecht, GESCHLECHTER, MIN_KONFIDENZ, BATCH_GROESSE };
