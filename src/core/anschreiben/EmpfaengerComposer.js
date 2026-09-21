// EmpfaengerComposer.js
// Empfänger-Auswahl für ein Anschreiben: Tabs Creator | Management | Kampagne,
// jeweils das zentrale tag-basierte Auto-Suggest (FormSystem).
// Kampagne expandiert auf Kooperations-Creators. Nur adressierbare Empfänger
// (ID + Mail); ohne Mail wird übersprungen und gezählt.
// Kein Casting, kein Konzept, keine freien Adressen — siehe ADR 0012.

import { OptionsManager } from '../form/data/OptionsManager.js';

const TABS = ['creator', 'management', 'kampagne'];

const SELECT_IDS = {
  creator: 'empfaenger-select-creator',
  management: 'empfaenger-select-management',
  kampagne: 'empfaenger-select-kampagne',
};

const PLACEHOLDERS = {
  creator: 'Creator suchen und hinzufügen...',
  management: 'Management suchen und hinzufügen...',
  kampagne: 'Kampagne suchen — Creator übernehmen...',
};

function creatorName(c) {
  return [c.vorname, c.nachname].filter(Boolean).join(' ') || c.mail || '';
}

function mountTagSelect(select, options, field) {
  if (window.formSystem?.createSearchableSelect) {
    return window.formSystem.createSearchableSelect(select, options, field);
  }
  return new OptionsManager().createTagBasedSelect(select, options, field);
}

export class EmpfaengerComposer {
  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.container
   * @param {Object} opts.db - Supabase-Client (für Tests mockbar)
   * @param {string} opts.unternehmenId - Scope für die Kampagne-Suche
   * @param {string} [opts.markeId] - zusaetzlicher Scope
   * @param {(empfaenger: Array) => void} [opts.onChange]
   */
  constructor({ container, db, unternehmenId, markeId = null, onChange = null }) {
    this.container = container;
    this.db = db;
    this.unternehmenId = unternehmenId;
    this.markeId = markeId;
    this.onChange = onChange;

    this.tab = 'creator';
    this.empfaengerByTab = { creator: [], management: [], kampagne: [] };
    this.skippedByTab = { creator: 0, management: 0, kampagne: 0 };
    this.lookup = { creator: {}, management: {} };
    this._kampagneLauf = 0;
  }

  get typ() {
    return this.tab === 'management' ? 'management' : 'creator';
  }

  // ─── State ────────────────────────────────────────────────

  key(e) { return `${e.typ}:${e.id}`; }

  getEmpfaenger() { return [...this.empfaengerByTab[this.tab]]; }
  getSkipped() { return this.skippedByTab[this.tab] || 0; }
  isEmpty() { return this.empfaengerByTab[this.tab].length === 0; }

  _emit() {
    this._renderSkipped();
    this.onChange?.(this.getEmpfaenger());
  }

  applyPrefill(items) {
    for (const item of items || []) {
      const email = String(item.email || '').trim();
      if (!item.id || !email) continue;
      const tab = item.typ === 'management' ? 'management' : 'creator';
      this.lookup[tab][item.id] = {
        id: item.id,
        email,
        name: item.name || email,
        vorname: item.vorname || '',
      };
      const prevTab = this.tab;
      this.tab = tab;
      this.addOne({ ...item, email });
      this.tab = prevTab;
    }
    this._emit();
  }

  addOne(item) {
    const e = this._normalize(item);
    if (!e) return false;
    const bucket = this.empfaengerByTab[this.tab];
    if (bucket.some((x) => this.key(x) === this.key(e))) return false;
    bucket.push(e);
    this._emit();
    return true;
  }

  remove(typ, id) {
    const k = `${typ}:${id}`;
    const bucket = this.empfaengerByTab[this.tab];
    const before = bucket.length;
    this.empfaengerByTab[this.tab] = bucket.filter((e) => this.key(e) !== k);
    if (this.empfaengerByTab[this.tab].length !== before) this._emit();
  }

  setTyp(typ) {
    if (!TABS.includes(typ) || typ === this.tab) return;
    this.tab = typ;
    this._renderToggle();
    this._showPanel();
    this._emit();
  }

  _normalize(item) {
    const email = String(item.email || '').trim();
    if (!item.id || !email) return null;
    return {
      typ: this.typ,
      id: item.id,
      email,
      name: item.name || '',
      vorname: item.vorname || '',
    };
  }

  // ─── Optionen ─────────────────────────────────────────────

  async _loadCreatorOptions() {
    const { data, error } = await this.db
      .from('creator')
      .select('id, vorname, nachname, mail')
      .not('mail', 'is', null)
      .order('vorname');
    if (error) throw error;
    const options = [];
    this.lookup.creator = {};
    for (const c of data || []) {
      const email = String(c.mail || '').trim();
      if (!c.id || !email) continue;
      this.lookup.creator[c.id] = {
        id: c.id,
        email,
        name: creatorName({ ...c, mail: email }),
        vorname: c.vorname || '',
      };
      options.push({
        value: c.id,
        label: creatorName({ ...c, mail: email }),
        description: email,
      });
    }
    return options;
  }

  async _loadManagementOptions() {
    const { data, error } = await this.db
      .from('management')
      .select('id, firmenname, email')
      .not('email', 'is', null)
      .order('firmenname');
    if (error) throw error;
    const options = [];
    this.lookup.management = {};
    for (const m of data || []) {
      const email = String(m.email || '').trim();
      if (!m.id || !email) continue;
      this.lookup.management[m.id] = {
        id: m.id,
        email,
        name: m.firmenname || email,
        vorname: '',
      };
      options.push({
        value: m.id,
        label: m.firmenname || email,
        description: email,
      });
    }
    return options;
  }

  async _loadKampagneOptions() {
    let q = this.db
      .from('kampagne')
      .select('id, kampagnenname, eigener_name')
      .eq('unternehmen_id', this.unternehmenId);
    if (this.markeId) q = q.eq('marke_id', this.markeId);
    const { data, error } = await q.order('kampagnenname');
    if (error) throw error;
    return (data || []).map((k) => ({
      value: k.id,
      label: k.kampagnenname || k.eigener_name || 'Kampagne',
    }));
  }

  async _resolveKampagneCreators(kampagneIds) {
    if (!kampagneIds.length) return { empfaenger: [], skipped: 0 };
    const { data, error } = await this.db
      .from('kooperationen')
      .select('creator:creator_id(id, vorname, nachname, mail)')
      .in('kampagne_id', kampagneIds)
      .not('creator_id', 'is', null);
    if (error) throw error;

    const seen = new Set();
    const empfaenger = [];
    let skipped = 0;
    for (const row of data || []) {
      const c = row.creator;
      if (!c?.id) continue;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const email = String(c.mail || '').trim();
      if (!email) { skipped += 1; continue; }
      empfaenger.push({
        typ: 'creator',
        id: c.id,
        email,
        name: creatorName({ ...c, mail: email }),
        vorname: c.vorname || '',
      });
    }
    return { empfaenger, skipped };
  }

  // ─── Widget-Sync ──────────────────────────────────────────

  _selectedIds(tab) {
    const panel = this.container.querySelector(`[data-panel="${tab}"]`);
    if (!panel) return [];
    return Array.from(panel.querySelectorAll('.tag[data-value]'))
      .map((tag) => tag.dataset.value)
      .filter(Boolean);
  }

  _toEmpfaenger(tab, id) {
    const row = this.lookup[tab]?.[id];
    if (!row) return null;
    return {
      typ: tab === 'management' ? 'management' : 'creator',
      id: row.id,
      email: row.email,
      name: row.name,
      vorname: row.vorname || '',
    };
  }

  _onSelectChange(tab) {
    const ids = this._selectedIds(tab);
    if (tab === 'kampagne') {
      this._syncKampagne(ids);
      return;
    }
    this.empfaengerByTab[tab] = ids.map((id) => this._toEmpfaenger(tab, id)).filter(Boolean);
    this.skippedByTab[tab] = 0;
    if (this.tab === tab) this._emit();
  }

  async _syncKampagne(ids) {
    const lauf = ++this._kampagneLauf;
    try {
      const { empfaenger, skipped } = await this._resolveKampagneCreators(ids);
      if (lauf !== this._kampagneLauf) return;
      this.empfaengerByTab.kampagne = empfaenger;
      this.skippedByTab.kampagne = skipped;
      if (this.tab === 'kampagne') this._emit();
    } catch (err) {
      if (lauf !== this._kampagneLauf) return;
      console.error('Kampagne-Empfänger laden fehlgeschlagen:', err);
      this.empfaengerByTab.kampagne = [];
      this.skippedByTab.kampagne = 0;
      if (this.tab === 'kampagne') this._emit();
    }
  }

  _mountSelect(tab, options) {
    const select = this.container.querySelector(`#${SELECT_IDS[tab]}`);
    if (!select) return;
    OptionsManager.createdTagBasedSelects.delete(SELECT_IDS[tab]);
    mountTagSelect(select, options, {
      name: select.name,
      type: 'multiselect',
      tagBased: true,
      placeholder: PLACEHOLDERS[tab],
    });
  }

  // ─── Render ───────────────────────────────────────────────

  async render() {
    this.container.innerHTML = `
      <div class="empfaenger-composer">
        <div class="empfaenger-composer__toggle" role="tablist">
          <button type="button" class="empfaenger-composer__tab" data-typ="creator" role="tab">Creator</button>
          <button type="button" class="empfaenger-composer__tab" data-typ="management" role="tab">Management</button>
          <button type="button" class="empfaenger-composer__tab" data-typ="kampagne" role="tab">Kampagne</button>
        </div>
        <div class="empfaenger-composer__panel" data-panel="creator">
          <select id="${SELECT_IDS.creator}" name="empfaenger_creator" multiple data-searchable="true" data-tag-based="true"></select>
        </div>
        <div class="empfaenger-composer__panel" data-panel="management" hidden>
          <select id="${SELECT_IDS.management}" name="empfaenger_management" multiple data-searchable="true" data-tag-based="true"></select>
        </div>
        <div class="empfaenger-composer__panel" data-panel="kampagne" hidden>
          <select id="${SELECT_IDS.kampagne}" name="empfaenger_kampagne" multiple data-searchable="true" data-tag-based="true"></select>
        </div>
        <p class="empfaenger-composer__skipped" data-skipped hidden></p>
      </div>
    `;
    this._renderToggle();
    this._showPanel();
    this._bindShell();
    this._renderSkipped();

    let creatorOpts = [];
    let managementOpts = [];
    let kampagneOpts = [];
    try {
      [creatorOpts, managementOpts, kampagneOpts] = await Promise.all([
        this._loadCreatorOptions(),
        this._loadManagementOptions(),
        this._loadKampagneOptions(),
      ]);
    } catch (err) {
      console.error('Empfänger-Optionen laden fehlgeschlagen:', err);
    }

    this._mountSelect('creator', creatorOpts);
    this._mountSelect('management', managementOpts);
    this._mountSelect('kampagne', kampagneOpts);
  }

  _bindShell() {
    this.container.querySelector('.empfaenger-composer__toggle').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-typ]');
      if (btn) this.setTyp(btn.dataset.typ);
    });
    this.container.addEventListener('change', (e) => {
      const panel = e.target.closest('[data-panel]');
      if (!panel) return;
      this._onSelectChange(panel.dataset.panel);
    });
  }

  _renderToggle() {
    this.container.querySelectorAll('.empfaenger-composer__tab').forEach((btn) => {
      const active = btn.dataset.typ === this.tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  _showPanel() {
    this.container.querySelectorAll('[data-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== this.tab;
    });
  }

  _renderSkipped() {
    const skipped = this.container.querySelector('[data-skipped]');
    if (!skipped) return;
    const count = this.getSkipped();
    skipped.hidden = count === 0;
    skipped.textContent = count > 0 ? `${count} ohne E-Mail übersprungen` : '';
  }

  destroy() {
    TABS.forEach((tab) => OptionsManager.createdTagBasedSelects.delete(SELECT_IDS[tab]));
    this.container.innerHTML = '';
  }
}
