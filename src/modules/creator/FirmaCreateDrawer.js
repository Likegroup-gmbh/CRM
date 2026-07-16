// FirmaCreateDrawer.js - Slide-in Drawer zum Inline-Anlegen einer Firma
// Zwei Modi:
//  - Formular-Modus (Creator anlegen/bearbeiten): neue Firma wird als Tag im firma_ids-Multiselect gesetzt
//  - Zuordnungs-Modus (Creator-Detailseite): neue Firma wird direkt via creator_firma verknuepft

export class FirmaCreateDrawer {
  constructor() {
    this.drawerId = 'firma-create-drawer';
    this.creatorId = null;
    this.onCreated = null;
  }

  // options: { creatorId, onCreated }
  // creatorId gesetzt → direkt verknuepfen; sonst Tag ins Creator-Formular setzen
  open(options = {}) {
    this.creatorId = options.creatorId || null;
    this.onCreated = options.onCreated || null;

    this.createDrawer();
    this.renderForm();
    this.bindFormEvents();
  }

  createDrawer() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    const header = document.createElement('div');
    header.className = 'drawer-header';

    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Neue Firma anlegen';

    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = this.creatorId
      ? 'Firma anlegen und diesem Creator zuordnen'
      : 'Firma anlegen und dem Creator zuordnen';

    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);

    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
  }

  renderForm() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    body.innerHTML = `
      <form id="firma-create-form" class="drawer-form">
        <div id="firma-create-error" class="drawer-form-error"></div>

        <div class="form-field">
          <label for="firma_firmenname" class="drawer-form-label">Firmenname *</label>
          <input type="text" id="firma_firmenname" name="firmenname" class="form-input drawer-form-input" required placeholder="z.B. Muster GmbH" />
        </div>

        <div class="drawer-form-grid">
          <div class="form-field">
            <label for="firma_strasse" class="drawer-form-label">Straße</label>
            <input type="text" id="firma_strasse" name="strasse" class="form-input drawer-form-input" />
          </div>
          <div class="form-field">
            <label for="firma_hausnummer" class="drawer-form-label">Nr.</label>
            <input type="text" id="firma_hausnummer" name="hausnummer" class="form-input drawer-form-input" />
          </div>
        </div>

        <div class="drawer-form-grid">
          <div class="form-field">
            <label for="firma_plz" class="drawer-form-label">PLZ</label>
            <input type="text" id="firma_plz" name="plz" class="form-input drawer-form-input" />
          </div>
          <div class="form-field">
            <label for="firma_stadt" class="drawer-form-label">Stadt</label>
            <input type="text" id="firma_stadt" name="stadt" class="form-input drawer-form-input" />
          </div>
        </div>

        <div class="form-field">
          <label for="firma_land" class="drawer-form-label">Land</label>
          <input type="text" id="firma_land" name="land" class="form-input drawer-form-input" value="Deutschland" />
        </div>

        <div class="drawer-actions">
          <button type="button" id="firma-create-cancel" class="mdc-btn mdc-btn--cancel">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="submit" class="mdc-btn mdc-btn--create">
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
              </svg>
            </span>
            <span class="mdc-btn__spinner" aria-hidden="true">
              <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
              </svg>
            </span>
            <span class="mdc-btn__label">Speichern</span>
          </button>
        </div>
      </form>
    `;

    setTimeout(() => {
      document.getElementById('firma_firmenname')?.focus();
    }, 100);
  }

  bindFormEvents() {
    const form = document.getElementById('firma-create-form');
    const cancelBtn = document.getElementById('firma-create-cancel');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit(new FormData(form));
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }
  }

  showError(message) {
    const errorDiv = document.getElementById('firma-create-error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  async handleSubmit(formData) {
    const submitBtn = document.querySelector(`#${this.drawerId} button[type="submit"]`);

    const firmenname = (formData.get('firmenname') || '').trim();
    if (firmenname.length < 2) {
      this.showError('Bitte einen Firmennamen (mind. 2 Zeichen) angeben.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
    }

    try {
      const data = {
        firmenname,
        strasse: (formData.get('strasse') || '').trim() || null,
        hausnummer: (formData.get('hausnummer') || '').trim() || null,
        plz: (formData.get('plz') || '').trim() || null,
        stadt: (formData.get('stadt') || '').trim() || null,
        land: (formData.get('land') || '').trim() || null
      };

      const result = await window.dataService.createEntity('firma', data);
      if (!result.success) {
        throw new Error(result.error || 'Firma konnte nicht angelegt werden');
      }

      const firma = { id: result.id, ...data };

      if (this.creatorId) {
        await this._linkToCreator(firma.id);
      } else {
        this._addFirmaToCreatorForm(firma);
      }

      window.toastSystem?.success?.(`Firma "${firmenname}" angelegt!`);

      if (this.onCreated) {
        await this.onCreated(firma);
      }

      this.close();
    } catch (error) {
      console.error('❌ FirmaCreateDrawer: Fehler beim Anlegen:', error);
      this.showError(error.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }
    }
  }

  // Junction-Insert (bzw. Reaktivierung) fuer bestehenden Creator
  async _linkToCreator(firmaId) {
    const { data: existing } = await window.supabase
      .from('creator_firma')
      .select('id')
      .eq('creator_id', this.creatorId)
      .eq('firma_id', firmaId)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await window.supabase
        .from('creator_firma')
        .update({ ist_aktiv: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id));
    } else {
      ({ error } = await window.supabase
        .from('creator_firma')
        .insert([{ creator_id: this.creatorId, firma_id: firmaId, ist_aktiv: true }]));
    }

    if (error) {
      throw new Error('Firma angelegt, aber Zuordnung fehlgeschlagen: ' + error.message);
    }
  }

  // Neue Firma als selektierten Tag ins firma_ids-Multiselect des Creator-Formulars setzen
  _addFirmaToCreatorForm(firma) {
    const form = document.getElementById('creator-form');
    const select = form?.querySelector('select[name="firma_ids"]');
    if (!select) {
      console.warn('⚠️ FirmaCreateDrawer: firma_ids-Feld nicht gefunden');
      return;
    }

    const formField = select.closest('.form-field');
    const container = formField?.querySelector('.tag-based-select');
    const tagsContainer = container?.querySelector('.tags-container');
    const hiddenSelect = document.getElementById(select.id + '_hidden');

    const addSelectedOption = (sel) => {
      if (!sel || sel.querySelector(`option[value="${firma.id}"]`)) return;
      const opt = document.createElement('option');
      opt.value = firma.id;
      opt.textContent = firma.firmenname;
      opt.selected = true;
      sel.appendChild(opt);
    };
    addSelectedOption(hiddenSelect);
    addSelectedOption(select);

    // Optionsbasis des Tag-Selects ergaenzen, damit die Firma nach Tag-Entfernung suchbar bleibt
    if (container) {
      try {
        const opts = JSON.parse(container.dataset.options || '[]');
        if (!opts.some(o => o.value === firma.id)) {
          opts.push({ value: firma.id, label: firma.firmenname });
          container.dataset.options = JSON.stringify(opts);
        }
      } catch (_) { }
    }

    if (tagsContainer) {
      if (tagsContainer.querySelector(`.tag[data-value="${firma.id}"]`)) return;

      tagsContainer.querySelector('.tags-placeholder')?.remove();
      tagsContainer.classList.remove('tags-container--empty');

      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.dataset.value = firma.id;

      const tagText = document.createElement('span');
      tagText.textContent = firma.firmenname;

      const removeBtn = document.createElement('span');
      removeBtn.className = 'tag-remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        tag.remove();
        hiddenSelect?.querySelector(`option[value="${firma.id}"]`)?.remove();
        select.querySelector(`option[value="${firma.id}"]`)?.remove();
        hiddenSelect?.dispatchEvent(new Event('change', { bubbles: true }));
      });

      tag.appendChild(tagText);
      tag.appendChild(removeBtn);
      tagsContainer.appendChild(tag);
    }
  }

  close() {
    const panel = document.getElementById(this.drawerId);

    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => {
        this.removeDrawer();
      }, 250);
    } else {
      this.removeDrawer();
    }
  }

  removeDrawer() {
    document.getElementById(this.drawerId)?.remove();
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
  }
}

export const firmaCreateDrawer = new FirmaCreateDrawer();

// Haengt einen "+ Neue Firma anlegen"-Button unter das firma_ids-Feld eines gerenderten Creator-Formulars
export function injectFirmaCreateButton() {
  const form = document.getElementById('creator-form');
  const select = form?.querySelector('select[name="firma_ids"]');
  if (!select) return;

  const formField = select.closest('.form-field');
  if (!formField || formField.querySelector('.btn-add-firma-inline')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'secondary-btn btn-sm btn-add-firma-inline';
  btn.style.marginTop = '6px';
  btn.textContent = '+ Neue Firma anlegen';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    firmaCreateDrawer.open();
  });

  formField.appendChild(btn);
}
