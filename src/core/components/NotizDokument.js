// NotizDokument.js
// Word-artiges Strategie-/Notiz-Dokument mit festen Sektionen.
// Render ist pur (HTML-String), Bind haengt InlineEdit + Autosave + Realtime an.
// Die KI schreibt nur die vier Auswertungs-Sektionen; "notizen" bleibt manuell.

import { InlineEdit } from './InlineEdit.js';

export const DOKUMENT_SEKTIONEN = [
  { key: 'kampagnenstrategie', label: 'Kampagnenstrategie', placeholder: 'Kurze Strategie: Ziel, Hebel, Kanäle…' },
  { key: 'todos', label: 'Handlungsempfehlungen & To-dos', placeholder: 'Konkrete nächste Schritte…' },
  { key: 'offene_punkte', label: 'Offene Punkte', placeholder: 'Was fehlt noch, was muss entschieden werden…' },
  { key: 'empfehlungen', label: 'Empfehlungen Sourcing, Creator & Content', placeholder: 'Wen suchen, welche Formate, welcher Ton…' },
  { key: 'notizen', label: 'Eigene Notizen', placeholder: 'Frei notieren – die KI überschreibt das nicht.' }
];

export const KI_SEKTIONEN = ['kampagnenstrategie', 'todos', 'offene_punkte', 'empfehlungen'];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatKiStand(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function kiStandHtml(kiStand) {
  const label = formatKiStand(kiStand);
  return label
    ? `KI-Stand: ${escapeHtml(label)}`
    : 'Noch keine KI-Auswertung';
}

/**
 * @param {Object} opts
 * @param {string} opts.entityType
 * @param {string} opts.entityId
 * @param {Object} [opts.sektionen]
 * @param {string|null} [opts.kiStand]
 * @returns {string}
 */
export function renderNotizDokument({ entityType, entityId, sektionen = {}, kiStand = null } = {}) {
  const sections = DOKUMENT_SEKTIONEN.map((s) => {
    const text = sektionen[s.key] ?? '';
    return `
      <section class="notiz-dokument__section" data-doc-sektion="${escapeHtml(s.key)}">
        <h3 class="notiz-dokument__heading">${escapeHtml(s.label)}</h3>
        <div class="notiz-dokument__text" data-feld="${escapeHtml(s.key)}"
             data-placeholder="${escapeHtml(s.placeholder)}">${escapeHtml(text)}</div>
      </section>
    `;
  }).join('');

  return `
    <article class="notiz-dokument" id="notiz-dokument"
             data-entity-type="${escapeHtml(entityType || '')}"
             data-entity-id="${escapeHtml(entityId || '')}">
      <header class="notiz-dokument__head">
        <h2 class="notiz-dokument__title">Strategie &amp; Notizen</h2>
        <span class="notiz-dokument__meta" data-notiz-kistand>${kiStandHtml(kiStand)}</span>
        <span class="notiz-dokument__status" data-notiz-status hidden>Gespeichert</span>
      </header>
      <div class="notiz-dokument__paper">
        ${sections}
      </div>
    </article>
  `;
}

/**
 * Schreibt Remote-Sektionen ins DOM, laesst dirty Felder in Ruhe.
 * @param {Element} root
 * @param {InlineEdit|null} inlineEdit
 * @param {Object} sektionen
 */
export function applyRemoteSektionen(root, inlineEdit, sektionen) {
  if (!root || !sektionen) return;
  for (const { key } of DOKUMENT_SEKTIONEN) {
    if (inlineEdit?.isDirty(key)) continue;
    const el = root.querySelector(`[data-feld="${key}"]`);
    if (!el) continue;
    const text = sektionen[key] ?? '';
    if ((el.innerText ?? el.textContent ?? '') !== text) {
      el.textContent = text;
    }
    inlineEdit?.syncSaved(key, text);
  }
}

export function updateKiStand(root, kiStand) {
  const el = root?.querySelector('[data-notiz-kistand]');
  if (!el) return;
  const label = formatKiStand(kiStand);
  el.textContent = label ? `KI-Stand: ${label}` : 'Noch keine KI-Auswertung';
}

/**
 * @param {Element|null} root
 * @param {{ entityType: string, entityId: string, supabase?: any }} opts
 * @returns {{ destroy: Function, inlineEdit: InlineEdit } | null}
 */
export function bindNotizDokument(root, { entityType, entityId, supabase, readonly } = {}) {
  if (!root || !entityType || !entityId) return null;

  const db = supabase || window.supabase;
  const isReadonly = readonly ?? Boolean(window.isKunde?.());
  let statusTimer = null;
  const statusEl = root.querySelector('[data-notiz-status]');

  const showSaved = () => {
    if (!statusEl) return;
    statusEl.hidden = false;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusEl.hidden = true;
    }, 1600);
  };

  const inlineEdit = new InlineEdit({
    onSave: async (feld, text) => {
      if (!db) throw new Error('Supabase fehlt');
      const { error } = await db.rpc('patch_entity_dokument_sektion', {
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_feld: feld,
        p_text: text
      });
      if (error) throw new Error(error.message);
      showSaved();
    }
  });
  inlineEdit.attach(root, { readonly: isReadonly });

  if (isReadonly) {
    root.classList.add('notiz-dokument--readonly');
    return {
      inlineEdit,
      async destroy() {
        inlineEdit.detach();
      }
    };
  }

  root.querySelectorAll('.notiz-dokument__section').forEach((section) => {
    section.addEventListener('mousedown', (e) => {
      if (e.target.closest('[data-feld], a, button')) return;
      const field = section.querySelector('[data-feld]');
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
  });

  let channel = null;
  if (db?.channel) {
    channel = db
      .channel(`entity-dokument-${entityType}-${entityId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'entity_dokumente',
        filter: `entity_id=eq.${entityId}`
      }, (payload) => {
        const row = payload.new;
        if (!row || row.entity_type !== entityType) return;
        applyRemoteSektionen(root, inlineEdit, row.sektionen || {});
        updateKiStand(root, row.ki_stand);
      })
      .subscribe();
  }

  return {
    inlineEdit,
    async destroy() {
      if (statusTimer) clearTimeout(statusTimer);
      try { await inlineEdit.flush(); } catch (_) { /* Unmount trotzdem */ }
      inlineEdit.detach();
      if (channel && db?.removeChannel) db.removeChannel(channel);
      channel = null;
    }
  };
}
