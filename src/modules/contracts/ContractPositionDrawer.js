// ContractPositionDrawer.js
// Drawer zum Anlegen/Bearbeiten einer Contracting-Position

function escapeHtml(v) {
  if (v == null) return '';
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class ContractPositionDrawer {
  constructor({ auftragId, position = null, onSave = null }) {
    this.auftragId = auftragId;
    this.position = position;
    this.onSave = onSave;
    this.isEdit = !!position;
    this.creatorOptions = [];
    this._overlay = null;
  }

  async open() {
    await this.loadCreators();
    this.render();
    this.bindEvents();
  }

  async loadCreators() {
    if (!window.supabase) return;
    try {
      const { data, error } = await window.supabase
        .from('creator')
        .select('id, vorname, nachname')
        .order('nachname');
      if (error) throw error;
      this.creatorOptions = (data || []).map(c => ({
        value: c.id,
        label: [c.vorname, c.nachname].filter(Boolean).join(' ') || '(Ohne Name)'
      }));
    } catch (e) {
      console.warn('⚠️ Creator-Laden fehlgeschlagen:', e);
      this.creatorOptions = [];
    }
  }

  render() {
    const p = this.position || {};
    const title = this.isEdit ? 'Position bearbeiten' : 'Neue Position';

    const creatorOptionsHtml = this.creatorOptions.map(c =>
      `<option value="${c.value}" ${p.creator_id === c.value ? 'selected' : ''}>${escapeHtml(c.label)}</option>`
    ).join('');

    const statusOptions = ['offen', 'gestellt', 'bezahlt', 'storniert'].map(s =>
      `<option value="${s}" ${(p.status || 'offen') === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.innerHTML = `
      <div class="drawer drawer--right drawer--open">
        <div class="drawer-header">
          <h3>${title}</h3>
          <button class="drawer-close" id="cp-drawer-close">&times;</button>
        </div>
        <div class="drawer-body">
          <form id="cp-drawer-form">
            <div class="form-field">
              <label for="cp-creator_id">Creator</label>
              <select id="cp-creator_id" name="creator_id">
                <option value="">Creator auswählen...</option>
                ${creatorOptionsHtml}
              </select>
            </div>

            <div class="form-field">
              <label for="cp-beschreibung">Beschreibung</label>
              <textarea id="cp-beschreibung" name="beschreibung" rows="3">${escapeHtml(p.beschreibung || '')}</textarea>
            </div>

            <div class="form-two-col">
              <div class="form-field form-field--half">
                <label for="cp-betrag_netto">Betrag Netto (€)</label>
                <input type="number" id="cp-betrag_netto" name="betrag_netto" step="0.01" min="0" value="${p.betrag_netto ?? ''}">
              </div>
              <div class="form-field form-field--half">
                <label for="cp-betrag_brutto">Betrag Brutto (€)</label>
                <input type="number" id="cp-betrag_brutto" name="betrag_brutto" step="0.01" min="0" value="${p.betrag_brutto ?? ''}">
              </div>
            </div>

            <div class="form-field">
              <label for="cp-rechnung_nr">Rechnungsnummer</label>
              <input type="text" id="cp-rechnung_nr" name="rechnung_nr" value="${escapeHtml(p.rechnung_nr || '')}">
            </div>

            <div class="form-two-col">
              <div class="form-field form-field--half">
                <label for="cp-status">Status</label>
                <select id="cp-status" name="status">
                  ${statusOptions}
                </select>
              </div>
              <div class="form-field form-field--half">
                <label for="cp-bezahlt_am">Bezahlt am</label>
                <input type="date" id="cp-bezahlt_am" name="bezahlt_am" value="${p.bezahlt_am || ''}">
              </div>
            </div>

            <div class="form-actions" style="margin-top: var(--space-lg);">
              <button type="submit" class="primary-btn">${this.isEdit ? 'Speichern' : 'Anlegen'}</button>
              <button type="button" class="secondary-btn" id="cp-drawer-cancel">Abbrechen</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this._overlay = overlay;
  }

  bindEvents() {
    const form = document.getElementById('cp-drawer-form');
    const closeBtn = document.getElementById('cp-drawer-close');
    const cancelBtn = document.getElementById('cp-drawer-cancel');

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });

    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());

    this._overlay?.addEventListener('click', (e) => {
      if (e.target === this._overlay) this.close();
    });

    const nettoInput = document.getElementById('cp-betrag_netto');
    if (nettoInput) {
      nettoInput.addEventListener('input', () => {
        const netto = parseFloat(nettoInput.value);
        const bruttoInput = document.getElementById('cp-betrag_brutto');
        if (!isNaN(netto) && bruttoInput && !bruttoInput.dataset.manual) {
          bruttoInput.value = (netto * 1.19).toFixed(2);
        }
      });
    }

    const bruttoInput = document.getElementById('cp-betrag_brutto');
    if (bruttoInput) {
      bruttoInput.addEventListener('input', () => { bruttoInput.dataset.manual = '1'; });
    }
  }

  async save() {
    const supabase = window.supabase;
    if (!supabase) return;

    const getValue = (id) => document.getElementById(id)?.value?.trim() || null;
    const getNum = (id) => {
      const v = document.getElementById(id)?.value;
      if (v === '' || v == null) return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };

    const payload = {
      auftrag_id: this.auftragId,
      creator_id: getValue('cp-creator_id') || null,
      beschreibung: getValue('cp-beschreibung'),
      betrag_netto: getNum('cp-betrag_netto'),
      betrag_brutto: getNum('cp-betrag_brutto'),
      rechnung_nr: getValue('cp-rechnung_nr'),
      status: getValue('cp-status') || 'offen',
      bezahlt_am: getValue('cp-bezahlt_am') || null
    };

    try {
      if (this.isEdit) {
        const { error } = await supabase
          .from('contracting_position')
          .update(payload)
          .eq('id', this.position.id);
        if (error) throw error;
        window.toastSystem?.show('Position aktualisiert', 'success');
      } else {
        const { error } = await supabase
          .from('contracting_position')
          .insert(payload);
        if (error) throw error;
        window.toastSystem?.show('Position angelegt', 'success');
      }

      this.close();
      this.onSave?.();
    } catch (e) {
      console.error('❌ Position speichern fehlgeschlagen:', e);
      window.toastSystem?.show(e?.message || 'Fehler beim Speichern', 'error');
    }
  }

  close() {
    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }
  }
}
