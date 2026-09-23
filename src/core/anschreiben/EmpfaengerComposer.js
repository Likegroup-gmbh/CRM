// EmpfaengerComposer.js
// Empfänger für ein Anschreiben. Kernel-Flag empfaengerFest:
// true = Anzeige (kein Picker), false = Tabs Creator | Management | Kampagne.
// extraTabs haengt weitere Typen an (Skript: Ansprechpartner). Kampagne
// expandiert auf Kooperations-Creators. Nur adressierbare Empfänger
// (ID + Mail); ohne Mail wird übersprungen und gezählt.
// empfaengerScope ersetzt die Stammdaten-Suche: der Skript-Pool liefert
// Creator, deren Managements und genau eine Kampagne.
// Kein Casting, kein Konzept, keine freien Adressen — siehe ADR 0012 und 0029.

import { OptionsManager } from '../form/data/OptionsManager.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BASE_TABS = ['creator', 'management', 'kampagne'];

const TAB_LABELS = {
  creator: 'Creator',
  management: 'Management',
  kampagne: 'Kampagne',
  ansprechpartner: 'Ansprechpartner',
};

const SELECT_IDS = {
  creator: 'empfaenger-select-creator',
  management: 'empfaenger-select-management',
  kampagne: 'empfaenger-select-kampagne',
  ansprechpartner: 'empfaenger-select-ansprechpartner',
};

const PLACEHOLDERS = {
  creator: 'Creator suchen und hinzufügen...',
  management: 'Management suchen und hinzufügen...',
  kampagne: 'Kampagne suchen — Creator übernehmen...',
  ansprechpartner: 'Ansprechpartner suchen und hinzufügen...',
};

function creatorName(c) {
  return [c.vorname, c.nachname].filter(Boolean).join(' ') || c.mail || '';
}

function withSelected(options, selected) {
  const ids = new Set((selected || []).map((row) => row.id || row));
  return options.map((opt) => ({ ...opt, selected: ids.has(opt.value) }));
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
   * @param {boolean} [opts.empfaengerFest] - Anzeige statt Picker
   * @param {Array} [opts.prefill]
   * @param {string[]} [opts.extraTabs] - zusaetzliche Tabs, z.B. ['ansprechpartner']
   * @param {Object|null} [opts.empfaengerScope] - gesetzter Pool statt Stammdaten
   * @param {(empfaenger: Array) => void} [opts.onChange]
   */
  constructor({
    container,
    db,
    unternehmenId,
    markeId = null,
    empfaengerFest = false,
    prefill = [],
    extraTabs = [],
    empfaengerScope = null,
    onChange = null,
  }) {
    this.container = container;
    this.db = db;
    this.unternehmenId = unternehmenId;
    this.markeId = markeId;
    this.empfaengerFest = Boolean(empfaengerFest);
    this.prefill = prefill;
    this.empfaengerScope = empfaengerScope;
    this.managementCreators = empfaengerScope?.managementCreators || {};
    this.onChange = onChange;
    this.tabs = [
      ...BASE_TABS,
      ...extraTabs.filter((tab) => TAB_LABELS[tab] && !BASE_TABS.includes(tab)),
    ];

    this.tab = 'creator';
    this.empfaengerByTab = Object.fromEntries(this.tabs.map((tab) => [tab, []]));
    this.skippedByTab = Object.fromEntries(this.tabs.map((tab) => [tab, 0]));
    this.lookup = { creator: {}, management: {}, ansprechpartner: {} };
    this.festItems = [];
    this._kampagneLauf = 0;
  }

  get typ() {
    if (this.empfaengerFest) {
      const festTyp = this.festItems[0]?.typ;
      if (festTyp === 'management' || festTyp === 'ansprechpartner') return festTyp;
      return 'creator';
    }
    if (this.tab === 'management' || this.tab === 'ansprechpartner') return this.tab;
    return 'creator';
  }

  // ─── State ────────────────────────────────────────────────

  key(e) { return `${e.typ}:${e.id}`; }

  getEmpfaenger() {
    if (this.empfaengerFest) return this.festItems.filter((e) => e.email);
    return [...this.empfaengerByTab[this.tab]];
  }

  getSkipped() {
    if (this.empfaengerFest) return this.festItems.filter((e) => !e.email).length;
    return this.skippedByTab[this.tab] || 0;
  }

  isEmpty() { return this.getEmpfaenger().length === 0; }

  _emit() {
    this._renderSkipped();
    this.onChange?.(this.getEmpfaenger());
  }

  applyPrefill(items) {
    if (this.empfaengerFest) {
      this._applyFest(items);
      return;
    }
    for (const item of items || []) {
      const email = String(item.email || '').trim();
      if (!item.id || !email) continue;
      const tab = item.typ === 'management' || item.typ === 'ansprechpartner' ? item.typ : 'creator';
      if (!this.tabs.includes(tab)) continue;
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

  _applyFest(items) {
    this.festItems = [];
    for (const item of items || []) {
      if (!item.id) continue;
      const email = String(item.email || '').trim();
      const typ = item.typ === 'management' || item.typ === 'ansprechpartner' ? item.typ : 'creator';
      this.festItems.push({
        typ,
        id: item.id,
        email,
        name: item.name || email,
        vorname: item.vorname || '',
      });
    }
    this._renderFest();
    this._emit();
  }

  addOne(item) {
    if (this.empfaengerFest) return false;
    const e = this._normalize(item);
    if (!e) return false;
    const bucket = this.empfaengerByTab[this.tab];
    if (bucket.some((x) => this.key(x) === this.key(e))) return false;
    bucket.push(e);
    this._emit();
    return true;
  }

  remove(typ, id) {
    if (this.empfaengerFest) return;
    const k = `${typ}:${id}`;
    const bucket = this.empfaengerByTab[this.tab];
    const before = bucket.length;
    this.empfaengerByTab[this.tab] = bucket.filter((e) => this.key(e) !== k);
    if (this.empfaengerByTab[this.tab].length !== before) this._emit();
  }

  setTyp(typ) {
    if (this.empfaengerFest) return;
    if (!this.tabs.includes(typ) || typ === this.tab) return;
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
    if (this.empfaengerScope) return this._optionsFromScope('creator', this.empfaengerScope.creators, 'skippedCreator');
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

  _optionsFromScope(tab, rows, skippedKey) {
    const options = [];
    this.lookup[tab] = {};
    for (const row of rows || []) {
      const email = String(row.email || '').trim();
      if (!row.id || !email) continue;
      this.lookup[tab][row.id] = {
        id: row.id,
        email,
        name: row.name || email,
        vorname: row.vorname || '',
      };
      options.push({ value: row.id, label: row.name || email, description: email });
    }
    if (skippedKey) this.skippedByTab[tab] = this.empfaengerScope[skippedKey] || 0;
    return options;
  }

  async _loadManagementOptions() {
    if (this.empfaengerScope) {
      this.managementCreators = this.empfaengerScope.managementCreators || {};
      return this._optionsFromScope('management', this.empfaengerScope.managements);
    }
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
    if (this.empfaengerScope) {
      const kampagne = this.empfaengerScope.kampagne;
      if (!kampagne?.id) return [];
      return [{ value: kampagne.id, label: kampagne.label || 'Kampagne' }];
    }
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

  async _pullAnsprechpartner(table, column, id, byId) {
    if (!id) return 0;
    const { data, error } = await this.db
      .from(table)
      .select('ansprechpartner:ansprechpartner_id(id, vorname, nachname, email)')
      .eq(column, id);
    if (error) throw error;
    let skipped = 0;
    for (const row of data || []) {
      const ap = row.ansprechpartner;
      if (!ap?.id || byId.has(ap.id)) continue;
      const email = String(ap.email || '').trim();
      if (!email) {
        skipped += 1;
        byId.set(ap.id, null);
        continue;
      }
      byId.set(ap.id, { ...ap, email });
    }
    return skipped;
  }

  async _loadAnsprechpartnerOptions() {
    const byId = new Map();
    const skippedUnternehmen = await this._pullAnsprechpartner(
      'ansprechpartner_unternehmen', 'unternehmen_id', this.unternehmenId, byId
    );
    const skippedMarke = await this._pullAnsprechpartner(
      'ansprechpartner_marke', 'marke_id', this.markeId, byId
    );
    this.skippedByTab.ansprechpartner = skippedUnternehmen + skippedMarke;
    const options = [];
    this.lookup.ansprechpartner = {};
    for (const ap of byId.values()) {
      if (!ap) continue;
      const name = [ap.vorname, ap.nachname].filter(Boolean).join(' ') || ap.email;
      this.lookup.ansprechpartner[ap.id] = {
        id: ap.id,
        email: ap.email,
        name,
        vorname: ap.vorname || '',
      };
      options.push({ value: ap.id, label: name, description: ap.email });
    }
    return options;
  }

  async _resolveKampagneCreators(kampagneIds) {
    if (this.empfaengerScope) {
      const id = this.empfaengerScope.kampagne?.id;
      if (!id || !kampagneIds.includes(id)) return { empfaenger: [], skipped: 0 };
      const empfaenger = (this.empfaengerScope.creators || []).map((c) => ({
        typ: 'creator',
        id: c.id,
        email: c.email,
        name: c.name || '',
        vorname: c.vorname || '',
      })).filter((c) => c.id && c.email);
      return { empfaenger, skipped: this.empfaengerScope.skippedCreator || 0 };
    }
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
    const typ = tab === 'management' || tab === 'ansprechpartner' ? tab : 'creator';
    return {
      typ,
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
    if (!(this.empfaengerScope && tab === 'creator')) this.skippedByTab[tab] = 0;
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
    document.getElementById(`${SELECT_IDS[tab]}_hidden`)?.remove();
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
    if (this.empfaengerFest) {
      this.applyPrefill(this.prefill);
      return;
    }

    const tabsHtml = this.tabs.map((tab) =>
      `<button type="button" class="empfaenger-composer__tab" data-typ="${tab}" role="tab">${TAB_LABELS[tab]}</button>`
    ).join('');
    const panelsHtml = this.tabs.map((tab) => `
        <div class="empfaenger-composer__panel" data-panel="${tab}"${tab === this.tab ? '' : ' hidden'}>
          <select id="${SELECT_IDS[tab]}" name="empfaenger_${tab}" multiple data-searchable="true" data-tag-based="true"></select>
        </div>`).join('');

    this.container.innerHTML = `
      <div class="empfaenger-composer">
        <div class="empfaenger-composer__toggle" role="tablist">
          ${tabsHtml}
        </div>
        ${panelsHtml}
        <p class="empfaenger-composer__skipped" data-skipped hidden></p>
      </div>
    `;
    this._renderToggle();
    this._showPanel();
    this._bindShell();
    this._renderSkipped();

    const loads = [
      this._loadCreatorOptions(),
      this._loadManagementOptions(),
      this._loadKampagneOptions(),
    ];
    if (this.tabs.includes('ansprechpartner')) loads.push(this._loadAnsprechpartnerOptions());
    let creatorOpts = [];
    let managementOpts = [];
    let kampagneOpts = [];
    let ansprechpartnerOpts = [];
    try {
      [creatorOpts, managementOpts, kampagneOpts, ansprechpartnerOpts] = await Promise.all(loads);
    } catch (err) {
      console.error('Empfänger-Optionen laden fehlgeschlagen:', err);
    }

    this._mountSelect('creator', creatorOpts);
    this._mountSelect('management', managementOpts);
    this._mountSelect('kampagne', kampagneOpts);
    if (this.tabs.includes('ansprechpartner')) {
      this._mountSelect('ansprechpartner', ansprechpartnerOpts || []);
      if (this.tab === 'ansprechpartner') this._emit();
    }
    this._renderSkipped();
  }

  async setEmpfaengerScope(scope) {
    this.empfaengerScope = scope;
    const creatorOpts = await this._loadCreatorOptions();
    const managementOpts = await this._loadManagementOptions();
    const kampagneOpts = await this._loadKampagneOptions();
    this.empfaengerByTab.creator = (this.empfaengerByTab.creator || [])
      .filter((e) => this.lookup.creator?.[e.id]);
    this.empfaengerByTab.management = (this.empfaengerByTab.management || [])
      .filter((e) => this.lookup.management?.[e.id]);
    const kampagneIds = new Set(kampagneOpts.map((o) => o.value));
    const keptKampagne = this._selectedIds('kampagne').filter((id) => kampagneIds.has(id));
    if (!keptKampagne.length) {
      this.empfaengerByTab.kampagne = [];
      this.skippedByTab.kampagne = 0;
    }
    this._mountSelect('creator', withSelected(creatorOpts, this.empfaengerByTab.creator));
    this._mountSelect('management', withSelected(managementOpts, this.empfaengerByTab.management));
    this._mountSelect('kampagne', withSelected(kampagneOpts, keptKampagne.map((id) => ({ id }))));
    if (keptKampagne.length) await this._syncKampagne(keptKampagne);
    this._emit();
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

  _renderFest() {
    const rows = this.festItems.map((e) => {
      const label = e.name || e.email || '';
      const initial = (e.vorname || label || '?')[0].toUpperCase();
      const mail = e.email || 'keine E-Mail';
      return `
        <div class="empfaenger-fest__row">
          <span class="table-avatar">${escapeHtml(initial)}</span>
          <div class="empfaenger-fest__meta">
            <span class="empfaenger-fest__name">${escapeHtml(label)}</span>
            <span class="empfaenger-fest__mail">${escapeHtml(mail)}</span>
          </div>
        </div>`;
    }).join('');

    this.container.innerHTML = `
      <div class="empfaenger-fest">
        ${rows || '<p class="empfaenger-fest__leer">Kein Empfänger am Dokument</p>'}
        <p class="empfaenger-composer__skipped" data-skipped hidden></p>
      </div>
    `;
  }

  _renderSkipped() {
    const skipped = this.container.querySelector('[data-skipped]');
    if (!skipped) return;
    if (this.empfaengerFest) {
      skipped.hidden = true;
      skipped.textContent = '';
      return;
    }
    const count = this.getSkipped();
    skipped.hidden = count === 0;
    skipped.textContent = count > 0 ? `${count} ohne E-Mail übersprungen` : '';
  }

  destroy() {
    this.tabs.forEach((tab) => OptionsManager.createdTagBasedSelects.delete(SELECT_IDS[tab]));
    this.container.innerHTML = '';
  }
}
