// skript-context/briefing-felder.js
// Campaign-Briefing als Prompt-Sektion. Felder, Reihenfolge und Wortlaut kommen aus
// src/modules/briefing/briefingFelder.json (wie Formular und Creator-PDF, ADR 0073).
// Eigene Bloecke vor dem kuerzbaren Body: WICHTIGE VORGABEN (Pflichtinhalte, Do's, Don'ts),
// CREATOR-VORGABEN (Altfelder) und SETTING. Aeltere Briefings: einige Altfelder als
// Fallback-Zeilen; reine v1-Briefings ueber den Praefix-Katalog (briefing-katalog.js).
// Die Funnel-Stufe kommt nie aus dem Briefing, nur aus der Videoidee im Konzept.

const FELDER = require('../../../../src/modules/briefing/briefingFelder.json');
const { kuerzeTranskript, cap } = require('./formatter');
const {
  BRIEFING_MASTER_FIELDS, BRIEFING_MODULE_FIELDS, CAMPAIGN_BRIEFING_FIELD_NAMES, labelValue, fmtBriefingValue
} = require('./briefing-katalog');
const { fmtCreatorVorgaben, BEREICH_PREFIX } = require('./briefing-creator');

const BRIEFING_MAX = 6000;
const SETTING_MAX = 1500;

const BEREICH_LABELS = {
  influencer_marketing: 'Influencer Marketing',
  paid_creator_ads: 'Paid Creator Ads',
  owned_social: 'Owned Social'
};

const VORGABEN = [
  { name: 'vorgabe_pflicht', label: 'Pflichtinhalte (muss gesagt oder gezeigt werden)' },
  { name: 'vorgabe_dos', label: "Do's (bei der Umsetzung gewuenscht)" },
  { name: 'vorgabe_donts', label: "Don'ts (im Content vermeiden; betrifft nur den Inhalt, nie die Person)" }
];

// Stehen in eigenen Bloecken oder gehoeren nicht in den KI-Kontext (Produkte kommen aus dem Produkt-Kontext)
const OHNE_BODY = new Set(['setting', 'produkte', ...VORGABEN.map((v) => v.name)]);

const PRIO = {
  aktivierung_name: 1, beschreibung: 1, kernbotschaft: 1, aufgabe: 1, umsetzungsideen_eintraege: 1,
  plattformen: 1, seitenverhaeltnisse: 1, videolaenge: 1, nutzungsrechte: 3
};

// Altfelder, die die KI bei aelteren Briefings weiter liest (Funnel, TKP, Verhandlung nie)
const KI_ALTFELDER = [
  { name: 'cta', label: 'CTA', prio: 1 },
  { name: 'hook_vorgaben', label: 'Hook-/Conversion-Vorgaben', prio: 1 },
  { name: 'nischen', label: 'Nische', prio: 2 },
  { name: 'learnings_text', label: 'Learnings', prio: 3 }
];

const NEUE_MARKER = ['aufgabe', 'beschreibung', 'kernbotschaft', 'plattformen', 'umsetzungsideen_eintraege',
  'vorgabe_pflicht', 'vorgabe_dos', 'vorgabe_donts', 'nischen', 'pflichtinhalte', 'wichtige_vorgaben'];

const FUNNEL_FELDER = new Set(['funnel_stufen', 'im_funnel_stufen', 'pa_funnel_stufen']);

function leer(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim() === '';
}

function text(v) {
  return String(v ?? '').trim();
}

function optionLabels(field, werte) {
  return (Array.isArray(werte) ? werte : [])
    .map((v) => field.options?.find((o) => o.value === v)?.label || v)
    .filter(Boolean);
}

function videolaengeText(briefing) {
  const von = Number(briefing?.videolaenge_von);
  const bis = briefing?.videolaenge_bis == null ? null : Number(briefing.videolaenge_bis);
  if (!Number.isFinite(von) || von <= 0) return null;
  if (bis == null) return `mindestens ${von} Sek.`;
  return von === bis ? `${von} Sek.` : `${von}–${bis} Sek.`;
}

/** Ideen als [{ text, verbindlich }]; Fallback: alte Text-Spalte (Liste als JSON-Text oder Zeilen), alle Inspiration. */
function ideenEintraege(briefing) {
  if (Array.isArray(briefing?.umsetzungsideen_eintraege)) {
    return briefing.umsetzungsideen_eintraege
      .map((e) => (typeof e === 'string' ? { text: text(e), verbindlich: false } : { text: text(e?.text), verbindlich: e?.verbindlich === true }))
      .filter((e) => e.text);
  }
  const prefix = BEREICH_PREFIX[briefing?.bereich];
  const raw = briefing?.umsetzungsideen ?? (prefix ? briefing?.[`${prefix}ideen_text`] : null);
  let liste = Array.isArray(raw) ? raw : null;
  if (!liste && typeof raw === 'string' && raw.trim().startsWith('[')) {
    try { liste = JSON.parse(raw); } catch (_) { liste = null; }
  }
  if (!Array.isArray(liste)) liste = String(raw ?? '').split('\n');
  return liste
    .map((t) => text(t).replace(/^([-•*–—]|\d{1,2}[.)])\s+/, ''))
    .filter(Boolean)
    .map((t) => ({ text: t, verbindlich: false }));
}

const IDEEN_LABELS = {
  verbindlich: 'Umsetzungsideen - verbindlich (Kundenvorgabe, je eine wird 1:1 eine eigene Videoidee)',
  inspiration: 'Umsetzungsideen - Inspiration (frei interpretierbar, kein Muss)'
};

// Im Skript sind die Ideen andere Videos desselben Konzepts: Abgrenzung, kein Material fuer dieses Video
const IDEEN_LABELS_SKRIPT = {
  verbindlich: 'Verbindliche Ideen des Kunden (jede ist eine eigene Videoidee des Konzepts. Ist eine davon die Kernidee dieses Videos, wird sie genau umgesetzt; die anderen nicht uebernehmen)',
  inspiration: 'Inspiration des Kunden (andere Videos des Konzepts; nicht uebernehmen, dieses Video erzaehlt seine eigene Kernidee)'
};

function ideenZeilen(briefing, fuerSkript) {
  const labels = fuerSkript ? IDEEN_LABELS_SKRIPT : IDEEN_LABELS;
  const ideen = ideenEintraege(briefing);
  return ['verbindlich', 'inspiration']
    .map((art) => {
      const items = ideen.filter((e) => e.verbindlich === (art === 'verbindlich'));
      if (!items.length) return null;
      return { prio: 1, text: `- ${labels[art]}:\n${items.map((e) => `  - ${e.text}`).join('\n')}` };
    })
    .filter(Boolean);
}

/** Zeilen einer Gruppe: Haekchen als eine Zeile, Liste plus „Weitere“ als eine Zeile. */
function gruppenZeilen(briefing, group, opts) {
  const felder = group.fields || [];
  const zeilen = [];
  const an = felder.filter((f) => f.type === 'checkbox' && briefing?.[f.name] === true).map((f) => f.label);
  if (an.length) zeilen.push({ prio: 2, text: `- ${group.label}: ${an.join(', ')}` });
  const liste = felder.find((f) => f.type === 'checkboxes');
  if (liste) {
    const weitere = felder.find((f) => f.type === 'text');
    const werte = [...optionLabels(liste, briefing?.[liste.name]), weitere ? text(briefing?.[weitere.name]) : ''].filter(Boolean);
    if (werte.length) zeilen.push({ prio: PRIO[liste.name] || 2, text: `- ${liste.label}: ${werte.join(', ')}` });
  }
  for (const field of felder) {
    if (['checkbox', 'checkboxes', 'date'].includes(field.type) || (liste && field.type === 'text')) continue;
    zeilen.push(...feldZeilen(briefing, field, opts));
  }
  return zeilen;
}

function feldZeilen(briefing, field, { fuerSkript }) {
  if (OHNE_BODY.has(field.name) || field.type === 'date') return [];
  if (field.type === 'fieldGroup') return gruppenZeilen(briefing, field, { fuerSkript });
  if (field.type === 'ideenListe') return ideenZeilen(briefing, fuerSkript);
  if (field.type === 'videolaenge') {
    // Im Skript kommt die Laenge aus der Videoidee (Vorgaben fuer dieses Video)
    const laenge = fuerSkript ? null : videolaengeText(briefing);
    return laenge ? [{ prio: 1, text: `- ${field.label}: ${laenge}` }] : [];
  }
  const wert = text(briefing?.[field.name]);
  return wert ? [{ prio: PRIO[field.name] || 2, text: `- ${field.label}: ${wert}` }] : [];
}

function hatNeueInhalte(briefing) {
  return NEUE_MARKER.some((name) => !leer(briefing?.[name]));
}

/** v1-Briefing: Master-Felder plus das Modul des Bereichs, wie bisher. */
function legacyZeilen(briefing, { ohneFunnel }) {
  const fields = [...BRIEFING_MASTER_FIELDS, ...(BRIEFING_MODULE_FIELDS[briefing.bereich] || [])];
  const zeilen = [];
  for (const field of fields) {
    if (ohneFunnel && FUNNEL_FELDER.has(field.name)) continue;
    if (/_creator_merkmale$|_situationen$/.test(field.name)) continue;
    const raw = field.name === 'bereich' ? (BEREICH_LABELS[briefing.bereich] || briefing.bereich) : briefing[field.name];
    const formatted = fmtBriefingValue(raw);
    if (formatted) zeilen.push({ prio: field.prio, text: `- ${field.label}: ${formatted}` });
  }
  return zeilen;
}

function collectBriefingLines(briefing, { ohneFunnel = false, fuerSkript = false } = {}) {
  if (!hatNeueInhalte(briefing)) return legacyZeilen(briefing, { ohneFunnel });
  const zeilen = [];
  const typ = BEREICH_LABELS[briefing.bereich];
  if (typ) zeilen.push({ prio: 1, text: `- Typ: ${typ}` });
  for (const schritt of FELDER.schritte) {
    for (const field of schritt.felder) zeilen.push(...feldZeilen(briefing, field, { fuerSkript }));
  }
  for (const alt of KI_ALTFELDER) {
    const formatted = fmtBriefingValue(briefing[alt.name]);
    if (formatted) zeilen.push({ prio: alt.prio, text: `- ${alt.label} (fruehere Angabe): ${formatted}` });
  }
  return zeilen;
}

/** Pflichtinhalte, Do's und Don'ts als ein Text; aeltere Briefings: das Altfeld wichtige_vorgaben. */
function wichtigeVorgabenAusBriefing(briefing) {
  const teile = VORGABEN
    .map(({ name, label }) => (text(briefing?.[name]) ? `${label}:\n${text(briefing[name])}` : null))
    .filter(Boolean);
  if (teile.length) return teile.join('\n\n');
  return text(briefing?.wichtige_vorgaben);
}

const WICHTIGE_VORGABEN_KOPF = '# WICHTIGE VORGABEN (Briefing, vor dem restlichen Briefing, nicht kuerzen)';

function fmtLeitplanken(briefing) {
  const vorgaben = wichtigeVorgabenAusBriefing(briefing);
  if (!vorgaben) return '';
  return `\n${WICHTIGE_VORGABEN_KOPF}\n`
    + 'Verbote (kein, nicht, nie, ohne) und Don\'ts sind hart und werden nicht uebertreten. '
    + 'Pflichtinhalte und Do\'s werden umgesetzt, wo der Fakt im Briefing, am Produkt oder am Creator steht; '
    + 'ein fehlender Fakt wird weggelassen, nie erfunden.\n'
    + `${vorgaben}\n`;
}

function fmtSetting(briefing) {
  let setting = text(briefing?.setting);
  if (!setting) {
    const prefix = BEREICH_PREFIX[briefing?.bereich];
    setting = prefix ? text(briefing[`${prefix}situationen`]) : '';
  }
  if (!setting) return '';
  return '\n# SETTING (Wunschvorgabe, keine harte Grenze. Gilt, solange die Anweisung keinen anderen Ort nennt.)\n'
    + `${cap(setting, SETTING_MAX)}\n`;
}

/**
 * Campaign-Briefing als Prompt-Sektion. Leere Felder fallen raus. Bei Budget-Ueberschreitung
 * bleiben Prio-1-Felder (Aufgabe, Idee, Kernbotschaft, Ideen) zuerst erhalten. Die Wichtigen
 * Vorgaben stehen davor und werden nicht gekuerzt. ohneFunnel: nur fuer v1-Briefings relevant.
 * fuerSkript: Ideen als andere Videos des Konzepts, keine Videolaenge (kommt aus der Videoidee).
 */
function fmtCampaignBriefing(briefing, { max = BRIEFING_MAX, ohneFunnel = false, fuerSkript = false } = {}) {
  if (!briefing) return '';
  const leit = fmtLeitplanken(briefing) + fmtCreatorVorgaben(briefing) + fmtSetting(briefing);
  const lines = collectBriefingLines(briefing, { ohneFunnel, fuerSkript });
  if (!lines.length && !leit) return '';

  lines.sort((a, b) => a.prio - b.prio || 0);

  const header = '\n# CAMPAIGN-BRIEFING (verbindliche Kampagnen- und Umsetzungsvorgaben)\n';
  let body = '';
  for (const line of lines) {
    const next = `${body}${line.text}\n`;
    if (header.length + next.length > max) {
      if (!body) {
        body = `${kuerzeTranskript(line.text, Math.max(80, max - header.length - 20))}\n`;
      }
      break;
    }
    body = next;
  }
  const dump = body.trim() ? header + body : '';
  if (!leit && !dump) return '';
  return leit + dump;
}

/** Sprache aus dem Briefing (Altfeld sprachen), wenn sie vom Deutsch-Default abweicht. */
function briefingSkriptSprache(briefing) {
  const langs = Array.isArray(briefing?.sprachen)
    ? briefing.sprachen.map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (!langs.length) return null;
  if (langs.every((s) => s.toLowerCase() === 'deutsch')) return null;
  return langs.map(labelValue).join(', ');
}

module.exports = {
  fmtCampaignBriefing, fmtLeitplanken, fmtCreatorVorgaben, fmtSetting, wichtigeVorgabenAusBriefing,
  ideenEintraege, videolaengeText, briefingSkriptSprache, BRIEFING_MAX, SETTING_MAX, CAMPAIGN_BRIEFING_FIELD_NAMES
};
