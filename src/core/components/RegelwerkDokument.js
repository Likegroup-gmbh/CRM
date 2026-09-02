// RegelwerkDokument.js
// Word-artiges Dokument: Titel + Body, Autosave ueber InlineEdit.
// Fachlich ungebunden - DNA/Master (und spaetere Regelwerke) binden onSave.

import { InlineEdit } from './InlineEdit.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {Object} opts
 * @param {string} [opts.title]
 * @param {string} [opts.inhalt]
 * @param {string} [opts.titlePlaceholder]
 * @param {string} [opts.bodyPlaceholder]
 * @param {string} [opts.metaHtml]
 * @returns {string}
 */
export function renderRegelwerkDokument({
  title = '',
  inhalt = '',
  titlePlaceholder = 'Titel',
  bodyPlaceholder = 'Hier schreiben…',
  metaHtml = ''
} = {}) {
  return `
    <article class="regelwerk-dokument" id="regelwerk-dokument">
      <header class="regelwerk-dokument__head">
        <div class="regelwerk-dokument__title" data-feld="name"
             data-placeholder="${escapeHtml(titlePlaceholder)}">${escapeHtml(title)}</div>
        <span class="regelwerk-dokument__status" data-regelwerk-status hidden>Gespeichert</span>
      </header>
      ${metaHtml ? `<div class="regelwerk-dokument__meta">${metaHtml}</div>` : ''}
      <div class="regelwerk-dokument__paper">
        <div class="regelwerk-dokument__body" data-feld="inhalt"
             data-placeholder="${escapeHtml(bodyPlaceholder)}">${escapeHtml(inhalt)}</div>
      </div>
    </article>
  `;
}

/**
 * @param {Element|null} root
 * @param {{ onSave: Function, readonly?: boolean }} opts
 * @returns {{ destroy: Function, inlineEdit: InlineEdit, readFeld: Function } | null}
 */
export function bindRegelwerkDokument(root, { onSave, readonly } = {}) {
  if (!root) return null;

  const isReadonly = readonly ?? Boolean(window.isKunde?.());
  let statusTimer = null;
  const statusEl = root.querySelector('[data-regelwerk-status]');

  const showSaved = () => {
    if (!statusEl) return;
    statusEl.hidden = false;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { statusEl.hidden = true; }, 1600);
  };

  const readFeld = (feld) => {
    const el = root.querySelector(`[data-feld="${feld}"]`);
    if (!el) return '';
    let text = (el.innerText ?? el.textContent ?? '').replace(/\u00a0/g, ' ');
    if (text === '\n') text = '';
    return text;
  };

  const inlineEdit = new InlineEdit({
    onSave: async (feld, text, vorher) => {
      await onSave?.(feld, text, vorher);
      showSaved();
    }
  });
  inlineEdit.attach(root, { readonly: isReadonly });

  if (isReadonly) {
    root.classList.add('regelwerk-dokument--readonly');
    return {
      inlineEdit,
      readFeld,
      async destroy() {
        if (statusTimer) clearTimeout(statusTimer);
        inlineEdit.detach();
      }
    };
  }

  root.querySelector('.regelwerk-dokument__paper')?.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-feld], a, button')) return;
    const field = root.querySelector('[data-feld="inhalt"]');
    if (!field) return;
    e.preventDefault();
    field.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(field);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  });

  return {
    inlineEdit,
    readFeld,
    async destroy() {
      if (statusTimer) clearTimeout(statusTimer);
      try { await inlineEdit.flush(); } catch (_) { /* Unmount trotzdem */ }
      inlineEdit.detach();
    }
  };
}
