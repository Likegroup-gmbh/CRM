// SkriptEditorChatRenderer.js
// Reine Renderer fuer die rechte Editor-Spalte: Chat-Verlauf ("Liky"),
// Generierungs-Status-Bubble und Aktions-Tags. State rein, HTML-String raus.

import { skripteService } from '../SkripteService.js';
import { escapeHtml, badge } from '../SkripteUtils.js';
import { AKTION_LABELS, AKTION_ICONS } from './skriptEditorKonstanten.js';
import { sektionAnzeige } from './skriptEditorVisuellHelfer.js';
import { thinkingHtml } from '../../../core/chat/thinking.js';

const LIKY_HEAD = `
  <div class="skripte-editor-msg-head">
    <span class="skripte-editor-avatar">L</span>
    <span class="skripte-editor-msg-name">Liky</span>
  </div>
`;

/** Leerer Chat im Neu-Modus (noch keine Generierung gestartet). */
export function chatLeerNeuHtml() {
  return `
    <div class="skripte-editor-chat-empty">
      <p>Noch kein Skript.</p>
      <p class="skripte-hint">Füll links die Vorgaben aus und klick auf „Skript generieren“ – ich melde mich hier, sobald ich arbeite.</p>
    </div>
  `;
}

/** Leerer Verlauf bei bestehendem Skript. */
export function chatLeerHtml() {
  return `
    <div class="skripte-editor-chat-empty">
      <p>Noch kein Verlauf.</p>
      <p class="skripte-hint">Markiere eine Stelle im Skript und wähle eine Aktion – oder schreib unten dein Feedback. Vorschläge kannst du hier annehmen oder ablehnen.</p>
    </div>
  `;
}

/** Lokale Liky-Bubble fuer den Generierungs-Fortschritt (ohne DB-Message). */
export function genStatusBubbleHtml(genStatus) {
  if (!genStatus) return '';
  if (genStatus.laeuft) {
    return `
      <div class="skripte-editor-msg skripte-editor-msg--assistant">
        ${LIKY_HEAD}
        <div id="ed-gen-thinking">${thinkingHtml(genStatus.progress_steps)}</div>
        <div class="skripte-editor-msg-actions">
          <button class="skripte-editor-pill-btn" id="ed-gen-cancel">Abbrechen</button>
        </div>
      </div>
    `;
  }
  if (genStatus.error) {
    return `
      <div class="skripte-editor-msg skripte-editor-msg--assistant">
        ${LIKY_HEAD}
        <div class="skripte-editor-msg-error">Fehler: ${escapeHtml(genStatus.error)}</div>
        <div class="skripte-editor-msg-actions">
          <button class="skripte-editor-pill-btn" id="ed-gen-retry">Nochmal versuchen</button>
        </div>
      </div>
    `;
  }
  return '';
}

export function aktionTagHtml(m) {
  if (!m.aktion || m.aktion === 'chat') return '';
  const iconHtml = AKTION_ICONS[m.aktion] ? `<span class="skripte-editor-tag-icon">${AKTION_ICONS[m.aktion]}</span>` : '';
  const sektion = m.sektion && m.sektion !== 'gesamt' ? ` · ${sektionAnzeige(m.sektion, m.ist_visuell)}` : '';
  return `<span class="skripte-editor-tag">${iconHtml}${escapeHtml(AKTION_LABELS[m.aktion])}${sektion}</span>`;
}

export function messageHtml(m, { istFragenModus = false, genLaeuft = false } = {}) {
  if (m.rolle === 'user') {
    return `
      <div class="skripte-editor-msg skripte-editor-msg--user" data-msg-row="${m.id}">
        ${aktionTagHtml(m)}
        ${m.inhalt ? `<div class="skripte-editor-msg-text">${escapeHtml(m.inhalt)}</div>` : ''}
        ${m.selektion_text ? `<div class="skripte-editor-msg-quote">${escapeHtml(m.selektion_text)}</div>` : ''}
      </div>
    `;
  }

  // Assistant ("Liky")
  const tag = aktionTagHtml(m);

  if (m.status === 'pending' || m.status === 'running') {
    return `
      <div class="skripte-editor-msg skripte-editor-msg--assistant" data-msg-row="${m.id}">
        ${LIKY_HEAD}
        ${tag}
        ${thinkingHtml(m.progress_steps)}
        <div class="skripte-editor-msg-actions">
          <button class="skripte-editor-pill-btn" data-msg-action="cancel" data-msg-id="${m.id}">Abbrechen</button>
        </div>
      </div>
    `;
  }

  if (m.status === 'cancelled') {
    return `
      <div class="skripte-editor-msg skripte-editor-msg--assistant" data-msg-row="${m.id}">
        ${LIKY_HEAD}
        ${tag}
        <div class="skripte-editor-msg-state">${badge('Abgebrochen', 'neutral')}</div>
      </div>
    `;
  }

  if (m.status === 'error') {
    return `
      <div class="skripte-editor-msg skripte-editor-msg--assistant" data-msg-row="${m.id}">
        ${LIKY_HEAD}
        ${tag}
        <div class="skripte-editor-msg-error">Fehler: ${escapeHtml(m.error_message || 'Unbekannt')}</div>
        <div class="skripte-editor-msg-actions">
          <button class="skripte-editor-pill-btn" data-msg-action="retry" data-msg-id="${m.id}">Nochmal versuchen</button>
        </div>
      </div>
    `;
  }

  const vorschlagBlock = m.vorschlag_text ? `
    <div class="skripte-editor-vorschlag ${m.status === 'angenommen' ? 'is-angenommen' : ''} ${m.status === 'abgelehnt' ? 'is-abgelehnt' : ''}">
      <div class="skripte-editor-vorschlag-label">Vorschlag${m.sektion && m.sektion !== 'gesamt' ? ` · ${sektionAnzeige(m.sektion, m.ist_visuell)}` : ''}</div>
      <div class="skripte-editor-vorschlag-text">${escapeHtml(m.vorschlag_text)}</div>
    </div>
  ` : '';

  let footer = '';
  if (m.aktion === 'rueckfrage') {
    // status 'vorschlag' = alle Fragen geklaert -> Generierung anbieten
    if (m.status === 'vorschlag' && istFragenModus && !genLaeuft) {
      footer = `
        <div class="skripte-editor-msg-actions">
          <button class="skripte-editor-pill-btn skripte-editor-pill-btn--primary" data-msg-action="generieren" data-msg-id="${m.id}">Skript jetzt generieren</button>
        </div>
      `;
    }
  } else if (m.aktion === 'visuell' && m.status === 'vorschlag') {
    footer = `<p class="skripte-hint">Visual wird automatisch übernommen …</p>`;
  } else if (m.status === 'vorschlag') {
    footer = `
      <div class="skripte-editor-msg-actions">
        <button class="skripte-editor-pill-btn skripte-editor-pill-btn--primary" data-msg-action="accept" data-msg-id="${m.id}">Änderung annehmen</button>
        <button class="skripte-editor-pill-btn" data-msg-action="reject" data-msg-id="${m.id}">Änderung ablehnen</button>
        <button class="skripte-editor-pill-btn" data-msg-action="retry" data-msg-id="${m.id}">Neu schreiben</button>
      </div>
    `;
  } else if (m.status === 'angenommen') {
    footer = `<div class="skripte-editor-msg-state">${badge('Angenommen', 'success')}</div>`;
  } else if (m.status === 'abgelehnt') {
    footer = `<div class="skripte-editor-msg-state">${badge('Abgelehnt', 'danger')}</div>`;
  } else if (m.status === 'fertig' && m.vorschlag_text) {
    // Vorschlag ohne zuordenbare Sektion: kein Annehmen moeglich
    footer = `<p class="skripte-hint">Der Vorschlag konnte keiner Sektion zugeordnet werden und kann nicht automatisch übernommen werden – Text bei Bedarf manuell einarbeiten oder die Anfrage mit Markierung wiederholen.</p>`;
  }

  return `
    <div class="skripte-editor-msg skripte-editor-msg--assistant" data-msg-row="${m.id}">
      ${LIKY_HEAD}
      ${tag}
      ${m.inhalt ? `<div class="skripte-editor-msg-text">${escapeHtml(m.inhalt)}</div>` : ''}
      ${vorschlagBlock}
      ${footer}
    </div>
  `;
}

/** Hinweis im rechten Chat, wenn nicht auf der neuesten Hauptversion gearbeitet wird. */
export function versionsHinweisHtml({ neuModus, versionen, aktiveVersion }) {
  if (neuModus || !versionen.length) return '';
  const maxHaupt = Math.max(...versionen.map((v) => v.version_nr));
  const aeltere = aktiveVersion.version_nr < maxHaupt || (aktiveVersion.sub_nr || 0) > 0;
  if (!aeltere) return '';
  return `
    <div class="skripte-editor-version-hinweis">
      Du arbeitest gerade an <strong>${skripteService.versionLabel(aktiveVersion)}</strong>
      (neueste: v${maxHaupt}) – angenommene Änderungen werden als Unterversion
      v${aktiveVersion.version_nr}.x gespeichert.
    </div>
  `;
}
