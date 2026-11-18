// briefingDocBinden.js
// Inline-Bearbeitung der Dokumentansicht: Titel und Textfelder des Creator-Briefings.
// Zeilen, Tags, Produkte und „Frühere Angaben“ bleiben read-only (Formular über Bearbeiten).
// Aufgabe und Setting gehen zusätzlich in die v1-Präfix-Spalten (mirrorLegacyColumns).

import { InlineEdit } from '../../core/components/InlineEdit.js';
import { getAllFields } from './create/fieldConfig.js';
import { mirrorLegacyColumns } from './briefingLegacy.js';

const TEXTAREA_FIELDS = new Set(
  getAllFields().filter(f => f.type === 'textarea').map(f => f.name)
);

function focusFeldEnd(field) {
  field.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(field);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/**
 * Haengt InlineEdit an Titel und Textfelder.
 * @returns {{ destroy: Function, inlineEdit: InlineEdit } | null}
 */
export function bindBriefingDoc(root, { briefingId, bereich = null, canEdit = false, onSaved } = {}) {
  if (!root) return null;

  const db = window.supabase;
  let statusTimer = null;
  const statusEl = root.closest('.briefing-detail')?.querySelector('[data-briefing-status]')
    || root.querySelector('[data-briefing-status]');

  const showSaved = () => {
    if (!statusEl) return;
    statusEl.hidden = false;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusEl.hidden = true;
    }, 1600);
  };

  const stopTitleKeys = new AbortController();

  const inlineEdit = new InlineEdit({
    onSave: async (feld, text, vorher) => {
      const istTitel = feld === 'aktivierung_name';
      if (!istTitel && !TEXTAREA_FIELDS.has(feld)) throw new Error('Feld nicht editierbar');
      if (istTitel) {
        const name = String(text ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!name) {
          const el = root.querySelector('[data-feld="aktivierung_name"]');
          if (el) el.textContent = vorher || '';
          window.toastSystem?.show('Bitte einen Titel vergeben.', 'warning');
          // saved wird erst nach onSave auf den geleerten Text gesetzt
          setTimeout(() => inlineEdit.syncSaved(feld, vorher ?? ''), 0);
          return;
        }
        text = name;
        const el = root.querySelector('[data-feld="aktivierung_name"]');
        if (el && (el.textContent || '') !== name) el.textContent = name;
      }
      if (!db) throw new Error('Supabase fehlt');
      const patch = { [feld]: istTitel ? text : (String(text ?? '').trim() ? text : null) };
      mirrorLegacyColumns(patch, bereich);
      const { error } = await db
        .from('campaign_briefings')
        .update(patch)
        .eq('id', briefingId);
      if (error) {
        window.toastSystem?.show('Speichern fehlgeschlagen.', 'error');
        throw new Error(error.message);
      }
      onSaved?.(feld, text);
      showSaved();
      if (istTitel) setTimeout(() => inlineEdit.syncSaved(feld, text), 0);
    }
  });
  inlineEdit.attach(root, { readonly: !canEdit });

  if (canEdit) {
    const titleEl = root.querySelector('[data-feld="aktivierung_name"]');
    titleEl?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      titleEl.blur();
    }, { signal: stopTitleKeys.signal });
  }

  if (!canEdit) {
    return {
      inlineEdit,
      async destroy() {
        stopTitleKeys.abort();
        if (statusTimer) clearTimeout(statusTimer);
        inlineEdit.detach();
      }
    };
  }

  root.querySelectorAll('.briefing-doc__section').forEach((section) => {
    section.addEventListener('mousedown', (e) => {
      if (e.target.closest('[data-feld], a, button, table, label, summary')) return;
      const field = section.querySelector('[data-feld]');
      if (!field) return;
      e.preventDefault();
      focusFeldEnd(field);
    });
  });

  return {
    inlineEdit,
    async destroy() {
      stopTitleKeys.abort();
      if (statusTimer) clearTimeout(statusTimer);
      try { await inlineEdit.flush(); } catch (_) { /* Unmount trotzdem */ }
      inlineEdit.detach();
    }
  };
}
