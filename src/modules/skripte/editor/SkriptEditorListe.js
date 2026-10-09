// SkriptEditorListe.js
// Linke Spalte: Kampagnen-Sidebar zum Umschalten (Prototype-Mixin).

import { bindCollapsible } from '../../../core/collapsiblePanel.js';
import { matchesKampagne } from '../SkriptList.js';
import { openSkriptCreateDrawer } from '../SkriptCreateDrawer.js';
import { skripteService } from '../SkripteService.js';
import { escapeHtml, formatDate, skriptEditorPath } from '../SkripteUtils.js';
import { SkriptEditorView } from './SkriptEditorViewCore.js';
import { creatorsFuerListe, listeCreatorHtml, listeVideoHtml, sortListeSkripte } from './SkriptEditorDocRenderer.js';

/**
 * Einzelnes Skript in der Sidebar-Liste upserten statt nach jeder
 * Aktion die volle Liste (200 Rows) neu zu laden. Beim Stub kommen die
 * Join-Namen aus dem Generator-Formular (der Stub wurde genau mit diesen
 * IDs angelegt); sonst reicht ein frisch geladenes Skript (loadSkript
 * bringt die Joins mit).
 */
SkriptEditorView.prototype.upsertSkriptInListe = function(skript) {
  if (!skript) return;
  // Nur upserten, wenn das Skript zum aktuellen Sidebar-Scope passt.
  // Fremde Kampagnen wuerden sonst in der gefilterten Liste landen.
  if (this._listeKampagneId !== undefined
      && !matchesKampagne(skript, this._listeKampagneId)) return;
  const angereichert = { ...skript };
  const idx = this.skripte.findIndex((s) => s.id === skript.id);
  if (idx >= 0) this.skripte[idx] = { ...this.skripte[idx], ...angereichert };
  else this.skripte.unshift(angereichert);
};

SkriptEditorView.prototype.bindListeHead = function() {
  this.container.querySelector('#ed-neu')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (this.isReadonly) return;
    openSkriptCreateDrawer(await this.neuPrefill());
  });
};

/**
 * Vorbelegung fuer "Neues Skript" aus dem geoeffneten Skript: Unternehmen und
 * Konzept, aenderbar (soft). Ohne Skript oder bei Fehlern: kein Prefill.
 */
SkriptEditorView.prototype.neuPrefill = async function() {
  const s = this.skript;
  if (!s?.unternehmen_id) return undefined;
  let konzeptId = null;
  try {
    konzeptId = await skripteService.loadStrategieIdVonItem?.(s.strategie_item_id) || null;
  } catch (_) { /* Konzept ist nur Komfort */ }
  return {
    unternehmen_id: s.unternehmen_id,
    unternehmenName: s.unternehmen?.firmenname || null,
    konzept_id: konzeptId,
    soft: true
  };
};

SkriptEditorView.prototype.sollListeStartCollapsed = function() {
  try {
    return localStorage.getItem('skripte-liste-collapsed') === 'true';
  } catch {
    return false;
  }
};

SkriptEditorView.prototype.bindListeCollapse = function() {
  this._listeCollapse?.destroy();
  const editor = this.container.querySelector('.skripte-editor');
  const btn = document.getElementById('ed-liste-toggle');
  if (!editor || !btn) return;
  this._listeCollapse = bindCollapsible({
    root: editor,
    toggleBtn: btn,
    collapsedClass: 'skripte-editor--liste-collapsed',
    storageKey: 'skripte-liste-collapsed'
  });
  this._listeCollapse.restore();
};

SkriptEditorView.prototype.setListeCollapsed = function(collapsed, opts) {
  this._listeCollapse?.setCollapsed(collapsed, opts);
};

SkriptEditorView.prototype.renderListe = function() {
  const el = document.getElementById('ed-liste-items');
  if (!el) return;
  // Safety-Net: nur Skripte derselben Kampagne wie das geoeffnete.
  // Das geoeffnete Skript bleibt immer sichtbar, auch wenn kampagne_id null ist.
  const kampagneId = this.skript?.kampagne_id ?? null;
  const verknuepfungenFuer = (s) => (s.id === this.skript?.id
    ? (this.verknuepfungen || [])
    : (s.kooperation_videos || []));
  const items = sortListeSkripte(
    this.skripte.filter((s) => s.id === this.skript?.id || matchesKampagne(s, kampagneId)),
    verknuepfungenFuer
  );
  el.innerHTML = items.map((s) => {
    const aktiv = s.id === this.skript?.id;
    const verknuepfungen = verknuepfungenFuer(s);
    const creators = creatorsFuerListe(s, verknuepfungen);
    return `
      <a href="${skriptEditorPath(s.id)}" class="skripte-editor-liste-item ${aktiv ? 'active' : ''}"
        data-id="${s.id}"${aktiv ? ' aria-current="page"' : ''}>
        <span class="skripte-editor-liste-top">
          ${listeCreatorHtml(creators) || '<span class="skripte-editor-liste-creator"></span>'}
          <span class="skripte-editor-liste-datum">${escapeHtml(formatDate(s.created_at))}</span>
        </span>
        <span class="skripte-editor-liste-titel">${escapeHtml(s.titel || s.hook?.slice(0, 50) || '(ohne Titel)')}</span>
        ${listeVideoHtml(verknuepfungen)}
      </a>
    `;
  }).join('');
  el.querySelectorAll('.skripte-editor-liste-item').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (this.isModifiedClick(e)) return;
      e.preventDefault();
      if (link.dataset.id !== this.skript?.id) this.switchSkript(link.dataset.id);
    });
  });
};

/** Cmd/Ctrl/Shift/Mittelklick: Browser-Default (neuer Tab), kein In-Place-Switch. */
SkriptEditorView.prototype.isModifiedClick = function(e) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1;
};
