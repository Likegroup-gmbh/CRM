// strategie-idee.js
// Videoidee-Vorschlaege im Konzept (ADR 0015): Laeufe entwerfen und als
// flagged strategie_items inserieren. Kein Candidate-Pool: das Modell schreibt
// neue Ideen als strukturierte Bloecke. Die Bausteine liegen in strategie-idee/
// (anzahl, prompt, validierung, laden, verbindlich); diese Datei buendelt sie.

const {
  ANZAHL, ANZAHL_MIN, ANZAHL_MAX, normalisiereAnzahl, normalisiereQuoten, planeLaeufe
} = require('./strategie-idee/anzahl');
const {
  FUNNEL_WERTE, funnelStufenFuer, konzeptTool, KONZEPT_TOOL, fmtProdukt, fmtPersona, buildPrompt
} = require('./strategie-idee/prompt');
const {
  erstzeile, formatBeschreibung, normalizeIdeenJson, ideenDiagnose, leerFehler, validateIdeen
} = require('./strategie-idee/validierung');
const { loadIdeeInput, loadPersonas, ladeItemProdukt } = require('./strategie-idee/laden');
const {
  verbindlicheIdeen, offeneVerbindlicheIdeen, frueherAngelegt, buildVerbindlichInsert, starteReferenzVerarbeitung
} = require('./strategie-idee/verbindlich');

function summiereUsage(a, b) {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  const summe = { ...a };
  for (const [key, value] of Object.entries(b)) {
    summe[key] = typeof value === 'number' && typeof summe[key] === 'number'
      ? summe[key] + value
      : (summe[key] ?? value);
  }
  return summe;
}

/**
 * Entwirft Ideen lauf-weise (ein Produkt pro Lauf). Je Lauf ein Modellaufruf,
 * bei leerem Ergebnis ein zweiter. Bleibt ein Lauf leer, wird er uebersprungen;
 * der Aufrufer wirft, wenn gar nichts zusammenkommt.
 *
 * rufe({ stable, task, tool, lauf }) -> Ergebnis von callClaude ({ json, model, usage, ... }).
 * zustand wird laufend gefuellt (model, usage, letzterResult), damit der
 * Aufrufer auch nach einem Abbruch abrechnen kann.
 * Hooks: onStep(step, lauf), onDiagnose(diagnose).
 *
 * @returns {Promise<{ ergebnisse: Array<{ produkt: object|null, ideen: object[] }>, verworfen: object[], letzterResult: object|null, letzteGeprueft: object|null }>}
 */
async function entwerfeLaeufe({ input, laeufe, hinweis, rufe, zustand = {}, onStep, onDiagnose } = {}) {
  const ausschluss = [...(input?.ausschluss || [])];
  const stufen = funnelStufenFuer(input?.briefing);
  const ergebnisse = [];
  const verworfen = [];
  let letzteGeprueft = null;

  const merke = (result) => {
    zustand.letzterResult = result;
    zustand.model = result?.model || zustand.model || null;
    zustand.usage = summiereUsage(zustand.usage, result?.usage);
  };

  for (const lauf of laeufe) {
    const produkte = lauf.produkt ? [lauf.produkt] : (input?.produkte || []);
    const { stable, task } = buildPrompt({
      ...input,
      produkte,
      produktFix: !!lauf.produkt,
      ausschluss,
      anzahl: lauf.anzahl,
      hinweis
    });
    const tool = konzeptTool(lauf.anzahl, stufen);
    const ruf = () => rufe({ stable, task, tool, lauf });
    const pruefe = (result) => (result?.json
      ? validateIdeen(result.json, { ausschluss, anzahl: lauf.anzahl, stufen })
      : { ideen: [], verworfen: [] });

    onStep?.('generieren', lauf);
    let result = await ruf();
    merke(result);
    onStep?.('pruefen', lauf);
    let geprueft = pruefe(result);

    if (!geprueft.ideen.length) {
      onDiagnose?.(ideenDiagnose(result?.json, geprueft, result));
      onStep?.('wiederholen', lauf);
      result = await ruf();
      merke(result);
      onStep?.('pruefen', lauf);
      geprueft = pruefe(result);
      if (!geprueft.ideen.length) {
        onDiagnose?.({ ...ideenDiagnose(result?.json, geprueft, result), retry: true });
      }
    }

    letzteGeprueft = geprueft;
    verworfen.push(...geprueft.verworfen);
    if (geprueft.ideen.length) {
      ergebnisse.push({ produkt: lauf.produkt || null, ideen: geprueft.ideen });
      for (const idee of geprueft.ideen) ausschluss.push(idee.titel);
    }
  }

  return { ergebnisse, verworfen, letzterResult: zustand.letzterResult || null, letzteGeprueft };
}

/** Fehler, wenn alle Laeufe leer blieben. */
function leereLaeufeFehler({ letzterResult, letzteGeprueft } = {}) {
  if (!letzterResult?.json) return new Error('Die KI hat kein strukturiertes Ergebnis geliefert');
  return new Error(leerFehler(letzteGeprueft));
}

/** Ideen ohne Link: plattform null, analog addItemPayload. 'idea' knallt gegen strategie_items_plattform_check.
 *  createdBy ist benutzer.id (FK), nicht auth.users.id. */
function buildVorschlagInsert({ strategieId, idee, sortierung, createdBy, produktId = null }) {
  return {
    ...(produktId ? { produkt_id: produktId } : {}),
    strategie_id: strategieId,
    video_link: null,
    plattform: null,
    sortierung,
    teilbereich: null,
    beschreibung: idee.beschreibung,
    beschreibung_quelle: 'ki',
    ...(FUNNEL_WERTE.includes(idee.funnel_stufe) ? { funnel_stufe: idee.funnel_stufe } : {}),
    ist_vorschlag: true,
    created_by: createdBy
  };
}

module.exports = {
  ANZAHL,
  ANZAHL_MIN,
  ANZAHL_MAX,
  KONZEPT_TOOL,
  normalisiereAnzahl,
  normalisiereQuoten,
  planeLaeufe,
  entwerfeLaeufe,
  leereLaeufeFehler,
  konzeptTool,
  funnelStufenFuer,
  erstzeile,
  formatBeschreibung,
  fmtProdukt,
  fmtPersona,
  loadIdeeInput,
  loadPersonas,
  ladeItemProdukt,
  buildPrompt,
  normalizeIdeenJson,
  validateIdeen,
  leerFehler,
  ideenDiagnose,
  buildVorschlagInsert,
  verbindlicheIdeen,
  offeneVerbindlicheIdeen,
  frueherAngelegt,
  buildVerbindlichInsert,
  starteReferenzVerarbeitung
};
