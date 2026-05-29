/**
 * NutzungsrechteModal.js
 *
 * Zentriertes Modal (Pattern `modal overlay-modal` + `modal-dialog`),
 * das die Nutzungsrechte eines Vertrags lesbar auflistet.
 * Die NR-Felder werden lazy beim Oeffnen aus `vertraege` nachgeladen.
 */

import { buildNutzungsrechte, NUTZUNGSRECHTE_SELECT } from '../../core/NutzungsrechteFormatter.js';

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class NutzungsrechteModal {
  constructor() {
    this._currentModal = null;
  }

  async open(vertragId) {
    if (!vertragId) return;
    this._close();

    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal nutzungsrechte-modal';
    modal.innerHTML = this._shell(this._loadingBody());
    document.body.appendChild(modal);
    this._currentModal = modal;

    const close = () => this._close();
    modal.querySelector('[data-action="close"]').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    const onKey = (ev) => { if (ev.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    modal._onKey = onKey;

    try {
      const { data, error } = await window.supabase
        .from('vertraege')
        .select(`${NUTZUNGSRECHTE_SELECT}, kooperationen(nutzungsrechte)`)
        .eq('id', vertragId)
        .single();

      if (!this._currentModal) return; // zwischenzeitlich geschlossen
      if (error || !data) {
        this._setBody(this._errorBody('Nutzungsrechte konnten nicht geladen werden.'));
        return;
      }

      data._koopNutzungsrechte = Array.isArray(data.kooperationen)
        ? data.kooperationen[0]?.nutzungsrechte
        : data.kooperationen?.nutzungsrechte;

      const { typLabel, sections } = buildNutzungsrechte(data);
      this._setHeader(typLabel);
      this._setBody(sections.length ? this._sectionsBody(sections) : this._emptyBody());
    } catch (err) {
      console.warn('NutzungsrechteModal Fehler:', err);
      if (this._currentModal) this._setBody(this._errorBody('Nutzungsrechte konnten nicht geladen werden.'));
    }
  }

  _close() {
    const modal = this._currentModal;
    if (!modal) return;
    if (modal._onKey) window.removeEventListener('keydown', modal._onKey);
    modal.remove();
    this._currentModal = null;
  }

  _shell(bodyHtml, titleSuffix = '') {
    return `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Nutzungsrechte<span class="nutzungsrechte-typ"${titleSuffix ? '' : ' style="display:none;"'}>${escapeHtml(titleSuffix)}</span></h3>
          <button class="modal-close" data-action="close" aria-label="Schliessen">&times;</button>
        </div>
        <div class="modal-body nutzungsrechte-body">${bodyHtml}</div>
      </div>`;
  }

  _setHeader(typLabel) {
    const el = this._currentModal?.querySelector('.nutzungsrechte-typ');
    if (!el) return;
    el.textContent = typLabel;
    el.style.display = typLabel ? '' : 'none';
  }

  _setBody(html) {
    const el = this._currentModal?.querySelector('.nutzungsrechte-body');
    if (el) el.innerHTML = html;
  }

  _loadingBody() {
    return `<div class="nutzungsrechte-state"><div class="table-loading-spinner"></div></div>`;
  }

  _errorBody(message) {
    return `<div class="nutzungsrechte-state nutzungsrechte-state--error">${escapeHtml(message)}</div>`;
  }

  _emptyBody() {
    return `<div class="nutzungsrechte-state">Fuer diesen Vertrag sind keine Nutzungsrechte hinterlegt.</div>`;
  }

  _sectionsBody(sections) {
    return sections.map(sec => `
      <div class="nutzungsrechte-section">
        <h4 class="nutzungsrechte-section-title">${escapeHtml(sec.title)}</h4>
        <dl class="nutzungsrechte-list">
          ${sec.items.map(it => `
            <div class="nutzungsrechte-row">
              <dt>${escapeHtml(it.label)}</dt>
              <dd>${escapeHtml(it.value)}</dd>
            </div>`).join('')}
        </dl>
      </div>`).join('');
  }
}

export const nutzungsrechteModal = new NutzungsrechteModal();

if (typeof window !== 'undefined') {
  window.nutzungsrechteModal = nutzungsrechteModal;
}
