// strategie-idee/prompt.js
// Prompt und Tool-Schema fuer Videoidee-Vorschlaege (ADR 0015, ADR 0073).
// Die Funnel-Stufe kommt nicht aus dem Briefing: bei Paid waehlt Liky je Idee
// eine der drei Stufen, sonst gibt es keine.

const { fmtCampaignBriefing } = require('../skript-context/briefing-felder');
const { fmtAudienceSituations } = require('../audience-situation');
const { ANZAHL, normalisiereAnzahl } = require('./anzahl');

const FUNNEL_WERTE = ['upper', 'mid', 'lower'];
const FUNNEL_LABELS = {
  upper: 'Upper Funnel – Awareness',
  mid: 'Mid Funnel – Consideration',
  lower: 'Lower Funnel – Conversion'
};

/** Stufen, aus denen Liky waehlt: bei Paid alle drei, sonst keine. */
function funnelStufenFuer(briefing) {
  return briefing?.bereich === 'paid_creator_ads' ? [...FUNNEL_WERTE] : [];
}

function konzeptTool(anzahl = ANZAHL, stufen = []) {
  const n = normalisiereAnzahl({ anzahl });
  const erlaubt = (stufen || []).filter((w) => FUNNEL_WERTE.includes(w));
  const ideeProperties = {
    titel: {
      type: 'string',
      description: 'Kurzer merkbare Titel, gleichzeitig der Hook in einem Satz. Keine Anfuehrungszeichen.'
    },
    pain_point: { type: 'string', description: 'Welchen Pain die Idee angreift, ein bis zwei Saetze.' },
    hook: { type: 'string', description: 'Gesprochener oder sichtbarer Aufmacher der ersten Sekunden.' },
    kernbotschaft: {
      type: 'string',
      description: 'Was haengen bleiben soll, ein Satz. Nennt das Briefing eine Kernbotschaft, ist sie der Anker: dieselbe Aussage, auf die Idee zugeschnitten.'
    },
    ablauf: { type: 'string', description: 'Grober Ablauf in zwei bis vier Schritten, keine Shotliste.' }
  };
  const ideeRequired = ['titel', 'pain_point', 'hook', 'kernbotschaft', 'ablauf'];
  if (erlaubt.length) {
    ideeProperties.funnel_stufe = {
      type: 'string',
      enum: erlaubt,
      description: 'Funnel-Stufe, fuer die die Idee gedacht ist. '
        + 'Die passendste waehlen und jede Stufe mindestens einmal vergeben, soweit die Anzahl reicht.'
    };
    ideeRequired.push('funnel_stufe');
  }
  return {
    name: 'videoideen_abgeben',
    description: 'Gibt Videoideen fuer ein Konzept ab. Jede Idee ist ein eigener Creative Angle.',
    input_schema: {
      type: 'object',
      properties: {
        ideen: {
          type: 'array',
          description: `Genau ${n} distinkte Videoideen: verschiedene Situationen, nicht dieselbe Szene anders formuliert.`,
          items: {
            type: 'object',
            properties: ideeProperties,
            required: ideeRequired
          }
        }
      },
      required: ['ideen']
    }
  };
}

const KONZEPT_TOOL = konzeptTool(ANZAHL);

function cap(value, max = 400) {
  const s = String(value || '').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
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

/** Prompt-Block zu den Stufen. Leer ohne Stufen: dann gibt es keine Vorgabe. */
function fmtFunnelStufen(stufen, n) {
  const liste = (stufen || []).filter((w) => FUNNEL_WERTE.includes(w));
  if (!liste.length) return '';
  const namen = liste.map((w) => `${w} (${FUNNEL_LABELS[w]})`).join(', ');
  if (liste.length === 1) {
    return `\nFunnel-Stufe: nur ${namen}. Setze funnel_stufe bei jeder Idee auf ${liste[0]}.\n`;
  }
  return `\nFunnel-Stufen: ${namen}.\n`
    + 'Setze funnel_stufe je Idee auf die Stufe, zu der Hook und Ablauf am besten passen (Awareness: Problem und Neugier; '
    + 'Consideration: Vergleich, Nutzen, Beweis; Conversion: Einwand, Angebot, Handlung). '
    + `Verteile die ${n} Ideen ueber diese Stufen: jede Stufe kommt vor, soweit die Anzahl reicht. Keine andere Stufe.\n`;
}

const STABLE_KOPF = `Du schreibst Videoideen fuer ein Kampagnen-Konzept einer Creator-Agentur.
Eine Idee ist eine neue Situation, kein Nacherzaehlen des Briefings. Das Briefing ist die Grenze, nicht die Geschichte.

Grenze (hart):
- Keine erfundenen Produktfeatures, Preise, Claims. Nur was im Briefing oder Produkt steht.
- Don'ts unter WICHTIGE VORGABEN sind hart, ebenso Verbote (kein, nicht, nie, ohne) in aelteren Vorgaben. Eine Idee, die eines davon bricht, wird nicht abgegeben.
- Pflichtinhalte unter WICHTIGE VORGABEN muessen in jeder Idee vorkommen (gesagt oder gezeigt). Creator-Vorgaben und fruehere Angaben wie CTA oder Hook-Vorgaben gelten ebenso. Sie sind die Grenze, nicht der Ablauf.
- Do's unter WICHTIGE VORGABEN sind Soll, kein Lock.
- Plattformen, Seitenverhaeltnis und Videolaenge aus dem Briefing gelten fuer jede Idee: der Ablauf passt in Format und Laenge.

Geschichte:
- Starte in einem konkreten Moment aus dem Leben der Persona. Hat sie Audience Situations, nimm eine davon.
- Das Produkt kommt in diesen Moment, es ist nicht der Aufmacher.
- Nennt das Briefing eine Kernbotschaft, traegt jede Idee sie im Feld kernbotschaft, zugeschnitten auf ihre Situation.
- Aufgabe, Kampagnenidee und Hook-Wortlaut aus dem Briefing nicht umformulieren und nicht als Ablauf abschreiben.
- Verbindliche Umsetzungsideen stehen schon als eigene Videoideen im Konzept: nicht wiederholen.
- An Inspirationen aus dem Briefing darfst du anknuepfen (Richtung, Stil, Situation), aber nicht abschreiben.`;

function buildPrompt({ briefing, produkte, personas, ausschluss, anzahl, hinweis, produktFix = false } = {}) {
  const n = normalisiereAnzahl({ anzahl });
  const funnelText = fmtFunnelStufen(funnelStufenFuer(briefing), n);
  const briefingText = fmtCampaignBriefing(briefing) || '(Briefing ohne auswertbare Felder)';
  const produktText = (produkte || []).map(fmtProdukt).filter(Boolean).join('\n') || '(keine Produkte am Briefing)';
  const personaText = (personas || []).map(fmtPersona).filter(Boolean).join('\n')
    || '(keine Personas: Ideen allgemein halten, ohne erfundene Zielperson)';
  const ausschlussText = (ausschluss || []).length
    ? (ausschluss || []).map((t) => `- ${t}`).join('\n')
    : '(noch keine Ideen im Konzept)';

  const stable = `${STABLE_KOPF}

Form:
- Deutsch, Du-Form in Hook und Ablauf nur wenn es zur Marke passt, sonst neutral.
- Titel = merkbare Kurzform des Hooks, eine Zeile, keine Anfuehrungszeichen.
- Pain Point, Hook, Kernbotschaft, grober Ablauf: konkret, keine Agenturlyrik.
- Ablauf: 2–4 Schritte, was passiert, keine Kameraanweisung.
${produktFix
    ? `- Genau ${n} Ideen, alle fuer das eine genannte Produkt. Keine Idee fuer ein anderes Produkt, kein anderes Produkt im Text.`
    : `- Genau ${n} Ideen, quer ueber die Produkte (nicht ${n} pro Produkt). Ohne Produkt nur aus dem Briefing.`}
- Die Ideen unterscheiden sich in Situation und Einstieg. Anderer Drehort oder andere Formulierung derselben Szene reicht nicht.
- Keine Idee, deren Titel einer ausgeschlossenen Erstzeile entspricht (Gross/Klein egal).`;

  const task = `Personas:
${personaText}

Produkte:
${produktText}

Briefing (Grenze und Kontext, nicht die Geschichte):
${briefingText}
${funnelText}
Bereits vorhandene Ideen (nicht wiederholen):
${ausschlussText}
${hinweis ? `\nHinweis aus dem Team (beruecksichtigen):\n${cap(hinweis, 600)}\n` : ''}
Gib ${n} neue Videoideen ueber das Tool ab.`;

  return { stable, task };
}

module.exports = {
  FUNNEL_WERTE, funnelStufenFuer, konzeptTool, KONZEPT_TOOL, fmtProdukt, fmtPersona, buildPrompt
};
