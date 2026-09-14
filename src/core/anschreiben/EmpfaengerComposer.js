// EmpfaengerComposer.js
// Empfänger-Auswahl für ein Anschreiben: Toggle Creator|Management,
// Autosuggest (EntitySearchInput) für den aktiven Typ, Kampagne als Bulk-Add.
// Nur adressierbare Empfänger (ID + Mail); ohne Mail wird übersprungen und gezählt.
// Kein Casting, kein Konzept, keine freien Adressen — siehe ADR 0012.

import { EntitySearchInput } from '../components/EntitySearchInput.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeIlike(term) {
  return String(term || '').replace(/[\\%_]/g, (c) => `\\${c}`);
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

    this.typ = 'creator'; // 'creator' | 'management'
    this.empfaenger = []; // [{ typ, id, email, name, vorname }]
    this.skipped = 0;     // ohne Mail übersprungen (Bulk)
    this._suche = null;
    this._kampagneSuche = null;
  }

  // ─── State ────────────────────────────────────────────────

  key(e) { return `${e.typ}:${e.id}`; }

  getEmpfaenger() { return [...this.empfaenger]; }
  getSkipped() { return this.skipped; }
  isEmpty() { return this.empfaenger.length === 0; }

  _emit() {
    this._renderTags();
    this.onChange?.(this.getEmpfaenger());
  }

  addOne(item) {
    const e = this._normalize(item);
    if (!e) return false;
    if (this.empfaenger.some((x) => this.key(x) === this.key(e))) return false;
    this.empfaenger.push(e);
    this._emit();
    return true;
  }

  remove(typ, id) {
    const k = `${typ}:${id}`;
    const before = this.empfaenger.length;
    this.empfaenger = this.empfaenger.filter((e) => this.key(e) !== k);
    if (this.empfaenger.length !== before) this._emit();
  }

  setTyp(typ) {
    if (typ === this.typ) return;
    this.typ = typ;
    this.empfaenger = [];
    this.skipped = 0;
    this._renderToggle();
    this._mountSuche();
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

  // ─── Suche (Autosuggest) ──────────────────────────────────

  async searchEmpfaenger(term) {
    const safe = escapeIlike(term);
    if (this.typ === 'creator') {
      const { data, error } = await this.db
        .from('creator')
        .select('id, vorname, nachname, mail')
        .not('mail', 'is', null)
        .or(`vorname.ilike.%${safe}%,nachname.ilike.%${safe}%,mail.ilike.%${safe}%`)
        .order('vorname')
        .limit(8);
      if (error) throw error;
      return (data || [])
        .filter((c) => c.mail)
        .map((c) => ({
          id: c.id,
          label: [c.vorname, c.nachname].filter(Boolean).join(' ') || c.mail,
          sub: c.mail,
          data: { id: c.id, email: c.mail, vorname: c.vorname, name: [c.vorname, c.nachname].filter(Boolean).join(' ') },
        }));
    }
    const { data, error } = await this.db
      .from('management')
      .select('id, firmenname, email')
      .not('email', 'is', null)
      .or(`firmenname.ilike.%${safe}%,email.ilike.%${safe}%`)
      .order('firmenname')
      .limit(8);
    if (error) throw error;
    return (data || [])
      .filter((m) => m.email)
      .map((m) => ({
        id: m.id,
        label: m.firmenname || m.email,
        sub: m.email,
        data: { id: m.id, email: m.email, name: m.firmenname },
      }));
  }

  async searchKampagne(term) {
    const safe = escapeIlike(term);
    let q = this.db
      .from('kampagne')
      .select('id, kampagnenname, eigener_name')
      .eq('unternehmen_id', this.unternehmenId)
      .or(`kampagnenname.ilike.%${safe}%,eigener_name.ilike.%${safe}%`);
    if (this.markeId) q = q.eq('marke_id', this.markeId);
    const { data, error } = await q.order('kampagnenname').limit(8);
    if (error) throw error;
    return (data || []).map((k) => ({
      id: k.id,
      label: k.kampagnenname || k.eigener_name || 'Kampagne',
      sub: 'Alle übernehmen',
      data: { id: k.id },
    }));
  }

  // ─── Kampagne Bulk-Add ────────────────────────────────────

  async addKampagne(kampagneId) {
    const added = this.typ === 'creator'
      ? await this._addKampagneCreators(kampagneId)
      : await this._addKampagneManagements(kampagneId);
    // Auch ohne Adds rendern: der Skip-Zaehler kann sich geaendert haben
    this._emit();
    return added;
  }

  async _addKampagneCreators(kampagneId) {
    const { data, error } = await this.db
      .from('kooperationen')
      .select('creator:creator_id(id, vorname, nachname, mail)')
      .eq('kampagne_id', kampagneId)
      .not('creator_id', 'is', null);
    if (error) throw error;
    let added = 0;
    for (const row of data || []) {
      const c = row.creator;
      if (!c) continue;
      if (!c.mail) { this.skipped += 1; continue; }
      if (this.addOne({ id: c.id, email: c.mail, vorname: c.vorname, name: [c.vorname, c.nachname].filter(Boolean).join(' ') })) added += 1;
    }
    return added;
  }

  async _addKampagneManagements(kampagneId) {
    const { data: koops, error: kErr } = await this.db
      .from('kooperationen')
      .select('creator_id')
      .eq('kampagne_id', kampagneId)
      .not('creator_id', 'is', null);
    if (kErr) throw kErr;
    const creatorIds = [...new Set((koops || []).map((r) => r.creator_id).filter(Boolean))];
    if (!creatorIds.length) return 0;

    const { data: links, error: lErr } = await this.db
      .from('creator_management')
      .select('management:management_id(id, firmenname, email)')
      .in('creator_id', creatorIds)
      .eq('ist_aktiv', true);
    if (lErr) throw lErr;
    let added = 0;
    for (const row of links || []) {
      const m = row.management;
      if (!m) continue;
      if (!m.email) { this.skipped += 1; continue; }
      if (this.addOne({ id: m.id, email: m.email, name: m.firmenname })) added += 1;
    }
    return added;
  }

  // ─── Render ───────────────────────────────────────────────

  render() {
    this.container.innerHTML = `
      <div class="empfaenger-composer">
        <div class="empfaenger-composer__toggle" role="tablist">
          <button type="button" class="empfaenger-composer__tab" data-typ="creator" role="tab">Creator</button>
          <button type="button" class="empfaenger-composer__tab" data-typ="management" role="tab">Management</button>
        </div>
        <div class="empfaenger-composer__suche" data-suche></div>
        <div class="empfaenger-composer__kampagne">
          <label class="empfaenger-composer__label">Kampagne — alle übernehmen</label>
          <div data-kampagne-suche></div>
        </div>
        <div class="empfaenger-composer__tags" data-tags></div>
        <p class="empfaenger-composer__skipped" data-skipped hidden></p>
      </div>
    `;
    this._renderToggle();
    this._mountSuche();
    this._mountKampagneSuche();
    this._renderTags();

    this.container.querySelector('.empfaenger-composer__toggle').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-typ]');
      if (btn) this.setTyp(btn.dataset.typ);
    });
  }

  _renderToggle() {
    this.container.querySelectorAll('.empfaenger-composer__tab').forEach((btn) => {
      const active = btn.dataset.typ === this.typ;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  _mountSuche() {
    this._suche?.destroy();
    const el = this.container.querySelector('[data-suche]');
    if (!el) return;
    el.innerHTML = '';
    this._suche = new EntitySearchInput({
      placeholder: this.typ === 'creator' ? 'Creator suchen…' : 'Management suchen…',
      emptyText: 'Keine Treffer mit E-Mail',
      persistent: true,
      search: (term) => this.searchEmpfaenger(term),
      onSelect: (item) => { this.addOne(item.data || item); },
    });
    this._suche.mount(el);
  }

  _mountKampagneSuche() {
    this._kampagneSuche?.destroy();
    const el = this.container.querySelector('[data-kampagne-suche]');
    if (!el) return;
    el.innerHTML = '';
    this._kampagneSuche = new EntitySearchInput({
      placeholder: 'Kampagne suchen…',
      emptyText: 'Keine Kampagne gefunden',
      persistent: true,
      search: (term) => this.searchKampagne(term),
      onSelect: (item) => { this.addKampagne(item.data?.id || item.id); },
    });
    this._kampagneSuche.mount(el);
  }

  _renderTags() {
    const el = this.container.querySelector('[data-tags]');
    if (!el) return;
    el.innerHTML = this.empfaenger.map((e) => `
      <span class="empfaenger-composer__tag" data-typ="${escapeHtml(e.typ)}" data-id="${escapeHtml(e.id)}">
        <span class="empfaenger-composer__tag-label">${escapeHtml(e.name || e.email)}</span>
        <button type="button" class="empfaenger-composer__tag-remove" aria-label="Entfernen">&times;</button>
      </span>
    `).join('');
    el.querySelectorAll('.empfaenger-composer__tag-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.closest('.empfaenger-composer__tag');
        this.remove(tag.dataset.typ, tag.dataset.id);
      });
    });

    const skipped = this.container.querySelector('[data-skipped]');
    if (skipped) {
      skipped.hidden = this.skipped === 0;
      skipped.textContent = this.skipped > 0
        ? `${this.skipped} ohne E-Mail übersprungen`
        : '';
    }
  }

  destroy() {
    this._suche?.destroy();
    this._kampagneSuche?.destroy();
    this.container.innerHTML = '';
  }
}
