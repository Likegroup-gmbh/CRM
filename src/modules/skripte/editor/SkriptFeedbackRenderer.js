// SkriptFeedbackRenderer.js
// Reine Renderer fuer die rechte Editor-Spalte: Feedback-Threads zu markierten
// Textstellen. State rein, HTML-String raus - wie SkriptEditorChatRenderer.
// Klassen kommen bewusst groesstenteils aus dem Chat (.skripte-editor-msg-*),
// damit Feedback und Liky identisch aussehen.

import { escapeHtml, relativeZeit, initialen } from '../SkripteUtils.js';
import { sektionAnzeige } from './skriptEditorVisuellHelfer.js';
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
  if (!autor) return 'Unbekannt';
  return autor.name
    || [autor.vorname, autor.nachname].filter(Boolean).join(' ')
    || 'Unbekannt';
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
  const sektion = kommentar.sektion
    ? sektionAnzeige(kommentar.sektion, kommentar.ist_visuell)
    : null;
  return [zeit, sektion].filter(Boolean).join(' – ');
}

function kopfHtml(kommentar, rechtsHtml = '') {
  return `
    <div class="skripte-editor-msg-head skripte-editor-fb-kopf">
      ${avatarHtml(kommentar)}
      <span class="skripte-editor-fb-ident">
        <span class="skripte-editor-msg-name">${escapeHtml(autorName(kommentar))}</span>
        <span class="skripte-editor-fb-meta">${escapeHtml(metaText(kommentar))}</span>
      </span>
      ${rechtsHtml}
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
            <span class="skripte-editor-msg-name">${escapeHtml(autorName(thread))}</span>
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

export function feedbackLeerHtml(kannKommentieren) {
  return `
    <div class="skripte-editor-chat-empty">
      <p>Noch kein Feedback.</p>
      ${kannKommentieren
        ? '<p class="skripte-hint">Markiere eine Stelle im Skript und wähle „Kommentieren“, um Feedback zu hinterlassen.</p>'
        : ''}
    </div>
  `;
}
