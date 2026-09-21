// PersonaAudienceSituationPanel.js
// Audience Situations als Liste im Persona-Worksheet. Layout wie die
// Einsatzsituationen am Produkt (produkt-usecases). Stand lebt im Speicher
// und wird erst mit dem Persona-Save geschrieben.

import { PersonaService } from './PersonaService.js';
import { icon } from '../../core/icons/IconSystem.js';
import { istKiBereit } from './audienceSituationGate.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tempKey() {
  return `as_${crypto.randomUUID()}`;
}

export class PersonaAudienceSituationPanel {
  constructor() {
    this.form = null;
    this.rows = [];
    this.loadFehler = false;
    this._abort = null;
  }

  root() {
    return this.form?.querySelector('#persona-audience-situations-panel');
  }

  async mount(form, { personaId = null } = {}) {
    this._abort?.abort();
    this._abort = new AbortController();
    this.form = form;
    this.rows = [];
    this.loadFehler = false;
    this.render();

    if (personaId) {
      try {
        const data = await PersonaService.loadAudienceSituations(personaId);
        this.rows = data.map(r => ({
          key: r.id,
          id: r.id,
          name: r.name || '',
          beschreibung: r.beschreibung || '',
          quelle: r.quelle || 'manual',
          deleted: false
        }));
        this.render();
      } catch (err) {
        this.loadFehler = true;
        console.error('Audience Situations konnten nicht geladen werden:', err);
      }
    }

    this.bindEvents();
  }

  bindEvents() {
    const root = this.root();
    if (!root) return;
    const signal = this._abort?.signal;
    const opts = signal ? { signal } : undefined;
    root.addEventListener('click', (e) => this.onClick(e), opts);
    root.addEventListener('input', (e) => this.onInput(e), opts);
  }

  onClick(e) {
    const btn = e.target.closest('[data-as-action]');
    if (!btn) return;
    const action = btn.dataset.asAction;
    if (action === 'add') this.addRow();
    if (action === 'remove') this.removeRow(btn.closest('[data-key]')?.dataset.key);
  }

  onInput(e) {
    const row = e.target.closest('[data-key]');
    if (!row) return;
    const item = this.rows.find(r => r.key === row.dataset.key);
    if (!item) return;
    if (e.target.classList.contains('produkt-usecases__name')) item.name = e.target.value;
    if (e.target.classList.contains('produkt-usecases__beschreibung')) item.beschreibung = e.target.value;
  }

  addRow() {
    this.rows.push({
      key: tempKey(),
      id: null,
      name: '',
      beschreibung: '',
      quelle: 'manual',
      deleted: false
    });
    this.render();
    const letzte = this.root()?.querySelector('.produkt-usecases__row:last-child .produkt-usecases__name');
    letzte?.focus();
  }

  removeRow(key) {
    const item = this.rows.find(r => r.key === key);
    if (!item) return;
    if (item.id) item.deleted = true;
    else this.rows.splice(this.rows.indexOf(item), 1);
    this.render();
  }

  visible() {
    return this.rows.filter(r => !r.deleted);
  }

  getState() {
    return this.rows.map(r => ({ ...r }));
  }

  /**
   * KI-Vorschlaege uebernehmen. Nur wenn das Panel leer ist oder ausschliesslich
   * Seeds hat (istKiBereit). Persistierte Seeds werden zum Loeschen markiert.
   * @returns {boolean} true, wenn geschrieben
   */
  applyKi(situationen) {
    const list = Array.isArray(situationen)
      ? situationen.filter(s => String(s?.name || '').trim())
      : [];
    if (!list.length) return false;
    if (!istKiBereit(this.visible())) return false;

    const deleted = this.rows.filter(r => r.id && (r.deleted || r.quelle === 'migration'));
    for (const row of deleted) row.deleted = true;

    this.rows = [
      ...deleted,
      ...list.map(s => ({
        key: tempKey(),
        id: null,
        name: String(s.name).trim(),
        beschreibung: String(s.beschreibung || '').trim(),
        quelle: 'ki',
        deleted: false
      }))
    ];
    this.render();
    return true;
  }

  render() {
    const root = this.root();
    if (!root) return;
    const liste = this.visible();
    const rows = liste.map((r, i) => `
      <li class="produkt-usecases__row" data-key="${escapeHtml(r.key)}">
        <span class="produkt-usecases__nr">${i + 1}</span>
        <div class="produkt-usecases__felder">
          <input type="text" class="produkt-usecases__name" value="${escapeHtml(r.name)}" placeholder="Audience Situation, z.B. „morgens unter Zeitdruck“">
          <input type="text" class="produkt-usecases__beschreibung" value="${escapeHtml(r.beschreibung)}" placeholder="Wann und warum ist sie in diesem Moment empfänglich (optional)">
        </div>
        <button type="button" class="produkt-usecases__remove" data-as-action="remove" aria-label="Audience Situation entfernen">${icon('x-mark')}</button>
      </li>
    `).join('');

    root.innerHTML = `
      <div class="produkt-usecases">
        <div class="produkt-usecases__head">
          <span class="produkt-usecases__title">Audience Situations</span>
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-as-action="add">
            <span class="mdc-btn__icon" aria-hidden="true">${icon('plus-sign')}</span>
            <span class="mdc-btn__label">Hinzufügen</span>
          </button>
        </div>
        ${liste.length ? `<ol class="produkt-usecases__list">${rows}</ol>` : ''}
        ${!liste.length ? '<p class="produkt-usecases__leer">Noch keine Audience Situations – per Klick auf „Hinzufügen“ oder nach dem Übernehmen am Produkt.</p>' : ''}
      </div>
    `;
  }

  destroy() {
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* noop */ }
      this._abort = null;
    }
    this.form = null;
    this.rows = [];
  }
}
