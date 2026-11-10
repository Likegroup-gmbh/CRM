// skript-edit-prompt/verlauf.js
// Chat-Verlauf im Edit-Prompt: Verlaufs-Format, offene Vorschlaege und die
// Bloecke OFFENER VORSCHLAG, FESTGEZOGEN und FESTLEGUNGEN.

const { cap, KONTEXT_MAX } = require('../skript-context');
const { verlaufZuMessages } = require('../chat-verlauf');
const { aenderungFeld } = require('./regeln');

const VERLAUF_SKIP = new Set(['error', 'cancelled', 'pending', 'running']);
// Ohne Stand weiss das Modell nur beim letzten Vorschlag, ob er abgelehnt wurde
const VERLAUF_STAND = { abgelehnt: 'abgelehnt', angenommen: 'angenommen' };

/** Mehr-Zellen-Vorschlag als Klartext, damit der naechste Turn ihn als Basis sieht. */
function bundleText(aenderungen) {
  const liste = Array.isArray(aenderungen) ? aenderungen : [];
  const zeilen = liste
    .filter((a) => a && a.sektion && a.vorschlag_text)
    .map((a) => `- ${a.sektion} (${a.spalte === 'visuell' ? 'visuell' : 'gesprochen'}): ${cap(a.vorschlag_text, KONTEXT_MAX.userText).trim()}`);
  if (!zeilen.length) return '';
  return `Vorschlag (${zeilen.length} ${zeilen.length === 1 ? 'Zelle' : 'Zellen'}):\n${zeilen.join('\n')}`;
}

/** Assistant-Turn als Klartext. Pending und Fehler kommen nicht in den Verlauf. */
function skriptVerlaufFormat(row) {
  if (!row || VERLAUF_SKIP.has(row.status)) return null;
  if (row.rolle === 'user') {
    const content = cap(row.inhalt, KONTEXT_MAX.userText).trim();
    return content ? { role: 'user', content } : null;
  }
  if (row.rolle !== 'assistant') return null;
  const teile = [];
  const antwort = cap(row.inhalt, KONTEXT_MAX.userText).trim();
  const vorschlag = cap(row.vorschlag_text, KONTEXT_MAX.userText).trim();
  if (antwort) teile.push(antwort);
  const stand = VERLAUF_STAND[row.status] ? ` (${VERLAUF_STAND[row.status]})` : '';
  if (vorschlag) teile.push(`Vorschlag${stand}:\n${vorschlag}`);
  const bundle = bundleText(row.aenderungen);
  if (bundle) teile.push(stand ? bundle.replace(/^Vorschlag/, `Vorschlag${stand}`) : bundle);
  if (!teile.length) return null;
  return { role: 'assistant', content: teile.join('\n\n') };
}

function letzterEnthaltenerAssistant(history) {
  for (let i = (history || []).length - 1; i >= 0; i--) {
    const row = history[i];
    if (!row || row.rolle === 'user' || VERLAUF_SKIP.has(row.status)) continue;
    if (row.rolle === 'assistant' && (row.inhalt || row.vorschlag_text || bundleText(row.aenderungen))) return row;
  }
  return null;
}

const PROMPT_VERLAUF_ZEILEN = 4;

function mitVerlauf(stable, task, history) {
  return {
    stable,
    task,
    messages: verlaufZuMessages(history, { task, format: skriptVerlaufFormat, limit: PROMPT_VERLAUF_ZEILEN })
  };
}

function zielZelle(message) {
  if (!message?.sektion || message.sektion === 'gesamt') return null;
  if (message.sektion === 'titel') return 'titel';
  if (message.ist_visuell || message.aktion === 'visuell') return `${message.sektion}_visuell`;
  return message.sektion;
}

/** Zellen eines Vorschlags im Verlauf: [{ feld, text, selektion }]. */
function vorschlagZellen(row) {
  const liste = Array.isArray(row?.aenderungen) ? row.aenderungen : [];
  if (liste.length) {
    return liste
      .filter((a) => a && a.sektion && a.vorschlag_text)
      .map((a) => ({ feld: aenderungFeld(a), text: a.vorschlag_text, selektion: null }));
  }
  const feld = zielZelle(row);
  return feld && row?.vorschlag_text ? [{ feld, text: row.vorschlag_text, selektion: row.selektion_text || null }] : [];
}

function zeitwert(wert) {
  const t = Date.parse(wert || '');
  return Number.isFinite(t) ? t : null;
}

/**
 * Macht o den offenen Vorschlag row veraltet? Spiegel von istVeraltet
 * (src/modules/skripte/editor/skriptEditorVeraltet.js). history ist
 * chronologisch, ohne Zeitstempel entscheidet die Reihenfolge.
 */
function ersetzt(row, o, { iRow, iO, skript }) {
  const zr = vorschlagZellen(row);
  const zo = vorschlagZellen(o);
  if (!zr.some((x) => zo.some((y) => x.feld === y.feld))) return false;
  if (o.status === 'vorschlag') {
    const andereStelle = zr.length === 1 && zo.length === 1 && zr[0].selektion && zo[0].selektion
      && zr[0].selektion !== zo[0].selektion;
    return iO > iRow && !andereStelle;
  }
  if (o.status !== 'angenommen') return false;
  const erstellt = zeitwert(row.created_at);
  const angenommen = zeitwert(o.updated_at);
  const spaeter = erstellt != null && angenommen != null ? angenommen > erstellt : iO > iRow;
  if (!spaeter) return false;
  if (zr.length > 1 || !zr[0].selektion) return true;
  return !String(skript?.[zr[0].feld] || '').includes(zr[0].selektion);
}

/**
 * Offene Vorschlaege, pro Zelle hoechstens einer: ein neuerer Vorschlag oder
 * ein spaeterer Accept auf derselben Zelle macht einen offenen Vorschlag
 * veraltet. Ein abgelehnter neuerer Vorschlag ersetzt nichts.
 */
function offeneVorschlaege(history, skript = null) {
  const rows = (history || []).filter((r) => r?.rolle === 'assistant'
    && r.aktion !== 'visuell' && r.aktion !== 'rueckfrage' && vorschlagZellen(r).length);
  return rows.filter((row, iRow) => row.status === 'vorschlag'
    && !rows.some((o, iO) => o !== row && ersetzt(row, o, { iRow, iO, skript })));
}

const ZELLE_LABEL = {
  titel: 'TITEL', hook: 'HOOK', hauptteil: 'HAUPTTEIL', cta: 'CTA',
  hook_visuell: 'HOOK (was zu sehen ist)', hauptteil_visuell: 'HAUPTTEIL (was zu sehen ist)', cta_visuell: 'CTA (was zu sehen ist)',
  hook_variante_1: 'Hook 1', hook_variante_2: 'Hook 2', hook_variante_3: 'Hook 3'
};

/**
 * Was gerade auf dem Tisch liegt (Fall „Erster Satz ist gut …“): der offene
 * Vorschlag der Zielzelle, ohne Zielzelle alle offenen. Der Server weiss das,
 * das Modell muss es nicht aus dem Verlauf erraten.
 */
function offenerVorschlagBlock(history, message, skript = null) {
  if (message?.aktion === 'visuell') return '';
  const ziel = zielZelle(message);
  const zeilen = [];
  for (const row of offeneVorschlaege(history, skript)) {
    for (const z of vorschlagZellen(row)) {
      if (ziel && z.feld !== ziel) continue;
      const label = ZELLE_LABEL[z.feld] || z.feld.toUpperCase();
      zeilen.push(z.selektion
        ? `${label}, Ersatz fuer die markierte Stelle „${cap(z.selektion, 300)}“:\n${cap(z.text, KONTEXT_MAX.userText)}`
        : `${label}:\n${cap(z.text, KONTEXT_MAX.userText)}`);
    }
  }
  if (!zeilen.length) return '';
  return '\n# OFFENER VORSCHLAG (noch nicht angenommen, steht nicht im Dokument)\n'
    + `${zeilen.join('\n\n')}\n`
    + 'Feedback ohne ausdruecklichen Bezug aufs Dokument und ohne Markierung im Dokument gilt diesem Vorschlag: er ist die Basis. '
    + 'Was der User daran gutheisst („ist gut“, „passt“, „bleibt“), bleibt woertlich stehen. Nur was er aendern will, aendert sich. '
    + 'Saetze aus diesem Vorschlag sind kein Wiederholungsverbot.\n';
}

function festgezogenBlock(skript, message, { freierChat = false } = {}) {
  const alle = Array.isArray(skript?.festgezogen) ? skript.festgezogen : [];
  const ziel = zielZelle(message);
  const gesperrt = alle.filter((z) => z && z !== ziel);
  if (!gesperrt.length) return '';
  if (freierChat) {
    return `\n# FESTGEZOGEN\nFestgezogen sind: ${gesperrt.join(', ')}. `
      + 'Diese Zellen aendern nur, wenn dein Umfang sie einschliesst: bei „alles“ alle, bei einem benannten Teil nur die Zellen dieser Sektion, '
      + 'bei einer Markierung allein oder ohne Umfang nie. Setze dafuer umfang (und bei einem Teil umfang_sektion) im Tool. '
      + 'Der Server verwirft festgezogene Zellen ausserhalb deines Umfangs. Ein Satz ist nur geschuetzt, wenn er markiert ist.\n';
  }
  return `\n# FESTGEZOGEN\nDiese Zellen nicht zurueckgeben und nicht umschreiben: ${gesperrt.join(', ')}. `
    + 'Nur die Zelle aus dem Auftrag darf sich aendern. Ein Satz ist nur geschuetzt, wenn er markiert ist.\n';
}

function festlegungBlock(skript) {
  const liste = Array.isArray(skript?.festlegungen) ? skript.festlegungen : [];
  const zeilen = liste.map((f) => (typeof f === 'string' ? f : f?.text)).filter(Boolean);
  if (!zeilen.length) return '';
  return `\n# FESTLEGUNGEN\nDiese Fakten gelten, ohne sie neu zu erklaeren:\n${zeilen.map((z) => `- ${z}`).join('\n')}\n`;
}

module.exports = {
  VERLAUF_SKIP,
  letzterEnthaltenerAssistant,
  mitVerlauf,
  offeneVorschlaege,
  offenerVorschlagBlock,
  festgezogenBlock,
  festlegungBlock
};
