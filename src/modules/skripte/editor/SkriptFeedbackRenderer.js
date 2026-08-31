// SkriptFeedbackRenderer.js
// Reine Renderer fuer die rechte Editor-Spalte: Feedback-Threads zu markierten
// Textstellen. State rein, HTML-String raus - wie SkriptEditorChatRenderer.
// Klassen kommen bewusst groesstenteils aus dem Chat (.skripte-editor-msg-*),
// damit Feedback und Liky identisch aussehen.

import { escapeHtml, relativeZeit, datumZeit, initialen } from '../SkripteUtils.js';
import { sektionAnzeige, sektionAnzeigeKurz } from './skriptEditorVisuellHelfer.js';
import { SEND_ICON } from './skriptEditorKonstanten.js';
import { icon } from '../../../core/icons/IconSystem.js';

/**
 * Flache Kommentarliste zu Threads gruppieren: Wurzeln (parent_id === null)
 * chronologisch, Antworten darunter. Verwaiste Antworten (Wurzel fehlt, z.B.
 * durch Scoping) fallen bewusst weg statt kontextlos aufzutauchen.
 */
export function gruppiereThreads(kommentare) {
  const wurzeln = [];
  const antwortenNach = new Map();

  for (const k of kommentare || []) {
    if (k.parent_id) {
      if (!antwortenNach.has(k.parent_id)) antwortenNach.set(k.parent_id, []);
      antwortenNach.get(k.parent_id).push(k);
    } else {
      wurzeln.push(k);
    }
  }

  return wurzeln.map((wurzel) => ({
    ...wurzel,
    antworten: (antwortenNach.get(wurzel.id) || [])
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }));
}

function autorName(kommentar) {
  const autor = kommentar.created_by;
  // Realtime liefert created_by als UUID-String, der Join (Objekt) fehlt
  // Kunden zusaetzlich per RLS - dann traegt die Zeile author_name selbst.
  if (autor && typeof autor === 'object') {
    const name = autor.name
      || [autor.vorname, autor.nachname].filter(Boolean).join(' ');
    if (name) return name;
  }
  return kommentar.author_name || 'Unbekannt';
}

function avatarHtml(kommentar) {
  const name = autorName(kommentar);
  const bild = kommentar.created_by?.profile_image_url;
  const inner = bild
    ? `<img src="${escapeHtml(bild)}" alt="" />`
    : escapeHtml(initialen(name));
  return `<span class="skripte-editor-avatar skripte-editor-avatar--user">${inner}</span>`;
}

function metaText(kommentar) {
  const zeit = relativeZeit(kommentar.created_at);
  // Bei Info-Zeilen (aenderung) steht die Sektion schon im Text ("Hook geändert")
  const sektion = kommentar.typ !== 'aenderung' && kommentar.sektion
    ? sektionAnzeige(kommentar.sektion, kommentar.ist_visuell)
    : null;
  return [zeit, sektion].filter(Boolean).join(' – ');
}

/** Kennzeichnet Share-Gaeste (Autor kam per Name + Code rein, ohne Account). */
function gastBadgeHtml(kommentar) {
  return kommentar.guest_participant_id
    ? '<span class="skripte-editor-fb-gast" title="Geteilter Zugang (ohne Account)">Gast</span>'
    : '';
}

function kopfHtml(kommentar, rechtsHtml = '') {
  return `
    <div class="skripte-editor-msg-head skripte-editor-fb-kopf">
      ${avatarHtml(kommentar)}
      <span class="skripte-editor-fb-ident">
        <span class="skripte-editor-msg-name">${escapeHtml(autorName(kommentar))}${gastBadgeHtml(kommentar)}</span>
        <span class="skripte-editor-fb-meta" title="${escapeHtml(datumZeit(kommentar.created_at))}">${escapeHtml(metaText(kommentar))}</span>
      </span>
      ${rechtsHtml}
    </div>
  `;
}

const DIFF_KONTEXT_WOERTER = 5;

/**
 * Wort-Diff ueber gemeinsames Praefix/Suffix: die differierende Mitte ist
 * die eigentliche Aenderung. Tokens enthalten den Whitespace (split mit
 * Capture-Gruppe), sodass sich der Text exakt rekonstruieren laesst.
 */
export function wortDiff(alt, neu) {
  const a = String(alt ?? '').split(/(\s+)/);
  const b = String(neu ?? '').split(/(\s+)/);

  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p += 1;

  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s += 1;

  return {
    prefix: a.slice(0, p),
    altMitte: a.slice(p, a.length - s),
    neuMitte: b.slice(p, b.length - s),
    suffix: a.slice(a.length - s)
  };
}

const istWortToken = (token) => token.trim().length > 0;

/** Die letzten n Woerter aus den Praefix-Tokens, inkl. Whitespace dazwischen. */
function kontextVorne(prefixTokens, n) {
  let count = 0;
  let i = prefixTokens.length;
  while (i > 0 && count < n) {
    i -= 1;
    if (istWortToken(prefixTokens[i])) count += 1;
  }
  return {
    text: prefixTokens.slice(i).join(''),
    gekuerzt: prefixTokens.slice(0, i).some(istWortToken)
  };
}

/** Die ersten n Woerter aus den Suffix-Tokens, inkl. Whitespace dazwischen. */
function kontextHinten(suffixTokens, n) {
  let count = 0;
  let i = 0;
  while (i < suffixTokens.length && count < n) {
    if (istWortToken(suffixTokens[i])) count += 1;
    i += 1;
  }
  return {
    text: suffixTokens.slice(0, i).join(''),
    gekuerzt: suffixTokens.slice(i).some(istWortToken)
  };
}

/** Kontext + markierte Mitte als Snippet: "… danach: [drei] kurze Reactions …" */
function diffSnippetHtml({ vorne, mitte, mitteKlasse, hinten }) {
  const mitteText = mitte.join('').trim();
  const mitteHtml = mitteText
    ? `<mark class="${mitteKlasse}">${escapeHtml(mitteText)}</mark>`
    : '';
  return `${vorne.gekuerzt ? '… ' : ''}${escapeHtml(vorne.text)}${mitteHtml}${escapeHtml(hinten.text)}${hinten.gekuerzt ? ' …' : ''}`;
}

function aenderungDiffBlockHtml(eintrag, richtung, inhaltHtml) {
  return `
    <button type="button"
      class="skripte-editor-fb-diff skripte-editor-fb-diff--${richtung}"
      data-fb-action="diff-toggle" data-fb-id="${escapeHtml(eintrag.id)}-${richtung}"
      title="Klicken zum Aufklappen">
      <span class="skripte-editor-fb-diff-text"><span class="skripte-editor-fb-diff-label">${richtung === 'vorher' ? 'Vorher' : 'Nachher'}:</span> ${inhaltHtml}</span>
    </button>
  `;
}

/**
 * Info-Zeile statt Thread: ein Kunden-Edit am Dokument. Bewusst ohne
 * Reply und Erledigt-Haken - reine Info fuer alle Betrachter. Liegen beide
 * Volltexte vor, zeigt der Wort-Diff nur den geaenderten Ausschnitt mit
 * etwas Kontext; Einfuegung/Loeschung mitten im Text wird als solche
 * beschriftet und einseitig gezeigt.
 */
function aenderungHtml(eintrag) {
  const vorher = eintrag.vorher_text?.trim() ? eintrag.vorher_text : null;
  const nachherVoll = eintrag.nachher_text?.trim() ? eintrag.nachher_text : null;
  // Fallback fuer Zeilen aus der ersten Version: dort steht der neue
  // Text noch in selektion_text statt in nachher_text
  const nachherAlt = eintrag.selektion_text?.trim() ? eintrag.selektion_text : null;

  let label = eintrag.inhalt;
  let vorherHtml = null;
  let nachherHtml = null;

  if (vorher && nachherVoll) {
    const diff = wortDiff(vorher, nachherVoll);
    const vorne = kontextVorne(diff.prefix, DIFF_KONTEXT_WOERTER);
    const hinten = kontextHinten(diff.suffix, DIFF_KONTEXT_WOERTER);
    const sektion = eintrag.sektion
      ? sektionAnzeigeKurz(eintrag.sektion, eintrag.ist_visuell)
      : null;
    const einfuegung = !diff.altMitte.join('').trim();
    const loeschung = !diff.neuMitte.join('').trim();

    if (einfuegung) {
      label = sektion ? `${sektion} · Text hinzugefügt` : 'Text hinzugefügt';
      nachherHtml = diffSnippetHtml({ vorne, mitte: diff.neuMitte, mitteKlasse: 'skripte-editor-fb-mark--ins', hinten });
    } else if (loeschung) {
      label = sektion ? `${sektion} · Text entfernt` : 'Text entfernt';
      vorherHtml = diffSnippetHtml({ vorne, mitte: diff.altMitte, mitteKlasse: 'skripte-editor-fb-mark--del', hinten });
    } else {
      label = sektion ? `${sektion} bearbeitet` : eintrag.inhalt;
      vorherHtml = diffSnippetHtml({ vorne, mitte: diff.altMitte, mitteKlasse: 'skripte-editor-fb-mark--del', hinten });
      nachherHtml = diffSnippetHtml({ vorne, mitte: diff.neuMitte, mitteKlasse: 'skripte-editor-fb-mark--ins', hinten });
    }
  } else {
    // Ganzes Feld neu/geleert oder Alt-Zeile ohne Volltexte: Volltext, geclamp't
    if (vorher) vorherHtml = escapeHtml(vorher);
    const nachher = nachherVoll || nachherAlt;
    if (nachher) nachherHtml = escapeHtml(nachher);
  }

  return `
    <div class="skripte-editor-fb-thread skripte-editor-fb-thread--aenderung" data-thread="${escapeHtml(eintrag.id)}">
      ${kopfHtml(eintrag)}
      <div class="skripte-editor-msg-text">${escapeHtml(label)}</div>
      ${vorherHtml ? aenderungDiffBlockHtml(eintrag, 'vorher', vorherHtml) : ''}
      ${nachherHtml ? aenderungDiffBlockHtml(eintrag, 'nachher', nachherHtml) : ''}
    </div>
  `;
}

function antwortHtml(antwort) {
  return `
    <div class="skripte-editor-fb-antwort" data-kommentar="${escapeHtml(antwort.id)}">
      ${kopfHtml(antwort)}
      <div class="skripte-editor-msg-text">${escapeHtml(antwort.inhalt)}</div>
    </div>
  `;
}

function replyHtml(threadId) {
  return `
    <div class="skripte-editor-fb-reply">
      <div class="skripte-editor-input">
        <textarea rows="2" placeholder="Antwort" data-fb-reply-input="${escapeHtml(threadId)}"></textarea>
        <div class="skripte-editor-input-footer">
          <div class="skripte-editor-input-actions">
            <button type="button" class="skripte-editor-send"
              data-fb-action="antworten" data-fb-id="${escapeHtml(threadId)}"
              title="Antwort senden" aria-label="Antwort senden">${SEND_ICON}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Ein Thread. Erledigte Threads klappen auf die Kopfzeile plus eine
 * gekuerzte Textzeile zusammen und lassen sich per Klick wieder oeffnen.
 */
export function threadHtml(thread, { kannErledigen = false, kannAntworten = true, aufgeklappt = false } = {}) {
  if (thread.typ === 'aenderung') return aenderungHtml(thread);

  const erledigt = Boolean(thread.erledigt_at);
  const kollabiert = erledigt && !aufgeklappt;

  const checkBtn = kannErledigen
    ? `<button type="button" class="skripte-editor-fb-check${erledigt ? ' is-erledigt' : ''}"
        data-fb-action="erledigt" data-fb-id="${escapeHtml(thread.id)}"
        title="${erledigt ? 'Wieder öffnen' : 'Als erledigt markieren'}"
        aria-pressed="${erledigt}">${icon('check')}</button>`
    : '';

  const klassen = [
    'skripte-editor-fb-thread',
    erledigt ? 'skripte-editor-fb-thread--erledigt' : '',
    kollabiert ? 'is-kollabiert' : ''
  ].filter(Boolean).join(' ');

  if (kollabiert) {
    const kurz = thread.inhalt.length > 60 ? `${thread.inhalt.slice(0, 60)}…` : thread.inhalt;
    return `
      <div class="${klassen}" data-thread="${escapeHtml(thread.id)}">
        <button type="button" class="skripte-editor-fb-aufklappen"
          data-fb-action="aufklappen" data-fb-id="${escapeHtml(thread.id)}"
          title="Feedback anzeigen">
          ${avatarHtml(thread)}
          <span class="skripte-editor-fb-ident">
            <span class="skripte-editor-msg-name">${escapeHtml(autorName(thread))}${gastBadgeHtml(thread)}</span>
            <span class="skripte-editor-fb-meta">${escapeHtml(kurz)}</span>
          </span>
        </button>
        ${checkBtn}
      </div>
    `;
  }

  return `
    <div class="${klassen}" data-thread="${escapeHtml(thread.id)}">
      ${kopfHtml(thread, checkBtn)}
      ${thread.selektion_text
        ? `<div class="skripte-editor-msg-quote">${escapeHtml(thread.selektion_text)}</div>`
        : ''}
      <div class="skripte-editor-msg-text">${escapeHtml(thread.inhalt)}</div>
      ${thread.antworten.map(antwortHtml).join('')}
      ${kannAntworten && !erledigt ? replyHtml(thread.id) : ''}
    </div>
  `;
}

/** Composer fuer einen neuen Thread, vorbelegt mit der markierten Stelle. */
export function neuerKommentarHtml(selektion) {
  const sektion = selektion?.sektion
    ? sektionAnzeige(selektion.sektion, selektion.istVisuell)
    : '';
  const kurz = selektion?.text?.length > 120
    ? `${selektion.text.slice(0, 120)}…`
    : (selektion?.text || '');

  return `
    <div class="skripte-editor-fb-thread skripte-editor-fb-thread--neu" id="ed-fb-neu">
      <div class="skripte-editor-fb-kopf">
        <span class="skripte-editor-fb-ident">
          <span class="skripte-editor-msg-name">Neues Feedback</span>
          ${sektion ? `<span class="skripte-editor-fb-meta">${escapeHtml(sektion)}</span>` : ''}
        </span>
        <button type="button" class="skripte-editor-fb-check"
          data-fb-action="neu-abbrechen" title="Abbrechen" aria-label="Abbrechen">${icon('x-mark')}</button>
      </div>
      ${kurz ? `<div class="skripte-editor-msg-quote">${escapeHtml(kurz)}</div>` : ''}
      <div class="skripte-editor-input">
        <textarea rows="3" id="ed-fb-neu-input" placeholder="Was soll an dieser Stelle anders werden?"></textarea>
        <div class="skripte-editor-input-footer">
          <div class="skripte-editor-input-actions">
            <button type="button" class="skripte-editor-send" data-fb-action="neu-senden"
              title="Feedback senden" aria-label="Feedback senden">${SEND_ICON}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function feedbackLeerHtml(kannKommentieren, tab = 'kommentare') {
  if (tab === 'aenderungen') {
    return `
      <div class="skripte-editor-chat-empty">
        <p>Noch keine Änderungen.</p>
        <p class="skripte-hint">Sobald jemand das Dokument bearbeitet, erscheinen die Änderungen hier.</p>
      </div>
    `;
  }
  return `
    <div class="skripte-editor-chat-empty">
      <p>Noch kein Feedback.</p>
      ${kannKommentieren
        ? '<p class="skripte-hint">Markiere eine Stelle im Skript und wähle „Kommentieren“, um Feedback zu hinterlassen.</p>'
        : ''}
    </div>
  `;
}
