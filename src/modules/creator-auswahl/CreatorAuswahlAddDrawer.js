// CreatorAuswahlAddDrawer.js
// Drawer zum Hinzufuegen von Creatorn (manuell oder aus Datenbank)

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { CREATOR_TYP_OPTIONS, isAllowedCreatorTyp, normalizeCreatorTyp } from './creatorTypeOptions.js';

export class CreatorAuswahlAddDrawer {
  constructor(detail) {
    this.detail = detail;
    this.mode = 'new'; // 'new' oder 'database'
    this.selectedCreatorFromDb = null;
  }

  open() {
    this.remove();
    this.mode = 'new';
    this.selectedCreatorFromDb = null;

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'add-creator-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'add-creator-drawer';

    const header = document.createElement('div');
    header.className = 'drawer-header';
    header.innerHTML = `
      <div>
        <span class="drawer-title">Creator hinzufügen</span>
        <p class="drawer-subtitle">Creator zur Auswahlliste hinzufügen</p>
      </div>
      <div>
        <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
      </div>
    `;

    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'drawer-toggle-container';
    toggleContainer.innerHTML = `
      <div class="view-toggle">
        <button type="button" class="secondary-btn active" data-mode="new">Neuer Creator</button>
        <button type="button" class="secondary-btn" data-mode="database">Aus Datenbank</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = 'add-creator-drawer-body';
    body.innerHTML = this.renderForm();

    panel.appendChild(header);
    panel.appendChild(toggleContainer);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.close());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => this.close());

    toggleContainer.querySelectorAll('.view-toggle .secondary-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        this.switchMode(mode);
        toggleContainer.querySelectorAll('.view-toggle .secondary-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    this.bindFormEvents();
  }

  switchMode(mode) {
    this.mode = mode;
    this.selectedCreatorFromDb = null;

    const body = document.getElementById('add-creator-drawer-body');
    if (body) {
      body.innerHTML = this.renderForm();
      this.bindFormEvents();
    }
  }

  renderForm() {
    const isDatabaseMode = this.mode === 'database';
    const creatorTypOptionsHtml = CREATOR_TYP_OPTIONS
      .map(typ => `<option value="${typ}">${typ}</option>`)
      .join('');

    const searchSection = isDatabaseMode ? `
      <div class="form-field sourcing-search-section">
        <label class="form-label">Creator suchen</label>
        <div class="auto-suggest-container">
          <input
            type="text"
            id="db-creator-search"
            class="form-input"
            placeholder="Name, Instagram oder TikTok eingeben..."
            autocomplete="off"
          />
          <div id="db-creator-dropdown" class="dropdown-menu"></div>
        </div>
        <small class="form-hint">Suche nach bestehenden Creators in der Datenbank</small>
      </div>
      <input type="hidden" id="db-selected-creator-id" value="" />
      <div id="db-selected-info" class="sourcing-selected-info" style="display: none;"></div>
    ` : '';

    return `
      <form id="add-creator-form">
        ${searchSection}

        <div id="add-creator-form-fields" ${isDatabaseMode ? 'style="display: none;"' : ''}>
          <div class="form-field">
            <label class="form-label">Creator Art *</label>
            <select id="creator-typ" name="typ" class="form-input" required>
              <option value="">Bitte wählen...</option>
              ${creatorTypOptionsHtml}
            </select>
          </div>

          <div class="form-field">
            <label class="form-label">Name *</label>
            <input type="text" id="creator-name" name="name" class="form-input" placeholder="Name des Creators" ${isDatabaseMode ? '' : 'required'}>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label class="form-label">Link Instagram</label>
              <input type="url" name="link_instagram" class="form-input" placeholder="https://instagram.com/...">
            </div>
            <div class="form-field">
              <label class="form-label">Follower IG</label>
              <input type="number" name="follower_instagram" class="form-input" placeholder="z.B. 10000">
            </div>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label class="form-label">Link TikTok</label>
              <input type="url" name="link_tiktok" class="form-input" placeholder="https://tiktok.com/@...">
            </div>
            <div class="form-field">
              <label class="form-label">Follower TikTok</label>
              <input type="number" name="follower_tiktok" class="form-input" placeholder="z.B. 50000">
            </div>
          </div>

          <div class="form-field">
            <label class="form-label">Location</label>
            <input type="text" name="wohnort" class="form-input" placeholder="z.B. Berlin">
          </div>

          <div class="form-field">
            <label class="form-label">Kurzbeschreibung</label>
            <textarea name="notiz" class="form-input" rows="2" placeholder="Kurzbeschreibung..."></textarea>
          </div>

          <div class="form-field">
            <label class="form-label">Pricing</label>
            <input type="text" name="pricing" class="form-input" placeholder="z.B. 500€ pro Video">
          </div>
        </div>

        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close-drawer">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="submit" class="mdc-btn mdc-btn--create" id="submit-btn">
            <span class="mdc-btn__label">Creator hinzufügen</span>
          </button>
        </div>
      </form>
    `;
  }

  bindFormEvents() {
    const form = document.getElementById('add-creator-form');
    const closeBtn = form?.querySelector('[data-action="close-drawer"]');

    closeBtn?.addEventListener('click', () => this.close());

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit(new FormData(form));
    });

    if (this.mode === 'database') {
      this.setupDbCreatorAutoSuggestion();
    }
  }

  setupDbCreatorAutoSuggestion() {
    const input = document.getElementById('db-creator-search');
    const dropdown = document.getElementById('db-creator-dropdown');
    const hiddenInput = document.getElementById('db-selected-creator-id');
    const infoDiv = document.getElementById('db-selected-info');
    const formFields = document.getElementById('add-creator-form-fields');

    if (!input || !dropdown) return;

    let debounceTimer;

    const escapeHtml = (str) => {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };

    const renderDropdown = (items) => {
      if (!items || items.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item no-results">Keine Creator gefunden</div>';
        dropdown.style.display = 'block';
        return;
      }

      dropdown.innerHTML = items.map(creator => {
        const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim() || 'Unbekannt';
        const socials = [creator.instagram, creator.tiktok].filter(Boolean).join(', ') || 'Keine Social Media';
        return `
          <div class="dropdown-item" data-id="${creator.id}">
            <div class="dropdown-item-title">${escapeHtml(name)}</div>
            <div class="dropdown-item-subtitle">${escapeHtml(socials)}</div>
          </div>
        `;
      }).join('');
      dropdown.style.display = 'block';
    };

    const loadCreators = async (query) => {
      try {
        let q = window.supabase
          .from('creator')
          .select('id, vorname, nachname, instagram, tiktok, instagram_follower, tiktok_follower, lieferadresse_stadt')
          .limit(20);

        if (query && query.length > 0) {
          q = q.or(`vorname.ilike.%${query}%,nachname.ilike.%${query}%,instagram.ilike.%${query}%,tiktok.ilike.%${query}%`);
        }

        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Fehler beim Laden der Creator:', error);
        return [];
      }
    };

    input.addEventListener('focus', async () => {
      const items = await loadCreators('');
      renderDropdown(items);
    });

    input.addEventListener('blur', () => {
      setTimeout(() => { dropdown.style.display = 'none'; }, 200);
    });

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const query = input.value.trim();
        const items = await loadCreators(query);
        renderDropdown(items);
      }, 250);
    });

    dropdown.addEventListener('click', async (e) => {
      const item = e.target.closest('.dropdown-item[data-id]');
      if (!item) return;

      const creatorId = item.dataset.id;

      try {
        const { data: creator, error } = await window.supabase
          .from('creator')
          .select('*')
          .eq('id', creatorId)
          .single();

        if (error) throw error;

        this.selectedCreatorFromDb = creator;
        hiddenInput.value = creatorId;

        const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim();
        infoDiv.innerHTML = `
          <div class="tag tag-selected-creator">
            <span>${escapeHtml(name)}</span>
            <button type="button" class="tag-remove" id="btn-remove-db-creator">✕</button>
          </div>
        `;
        infoDiv.style.display = 'block';
        input.style.display = 'none';

        formFields.style.display = 'block';
        this.fillFormFromDbCreator(creator);

        document.getElementById('btn-remove-db-creator')?.addEventListener('click', () => {
          this.selectedCreatorFromDb = null;
          hiddenInput.value = '';
          infoDiv.style.display = 'none';
          input.style.display = 'block';
          input.value = '';
          formFields.style.display = 'none';
        });

      } catch (error) {
        console.error('Fehler beim Laden des Creators:', error);
        window.toastSystem?.show('Fehler beim Laden des Creators', 'error');
      }
    });
  }

  fillFormFromDbCreator(creator) {
    const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim();

    const nameInput = document.getElementById('creator-name');
    if (nameInput) nameInput.value = name;

    const igInput = document.querySelector('input[name="link_instagram"]');
    if (igInput && creator.instagram) {
      igInput.value = creator.instagram.startsWith('http') ? creator.instagram : `https://instagram.com/${creator.instagram.replace('@', '')}`;
    }

    const igFollower = document.querySelector('input[name="follower_instagram"]');
    if (igFollower && creator.instagram_follower) {
      const follower = this.parseFollowerRange(creator.instagram_follower);
      if (follower) igFollower.value = follower;
    }

    const ttInput = document.querySelector('input[name="link_tiktok"]');
    if (ttInput && creator.tiktok) {
      ttInput.value = creator.tiktok.startsWith('http') ? creator.tiktok : `https://tiktok.com/@${creator.tiktok.replace('@', '')}`;
    }

    const ttFollower = document.querySelector('input[name="follower_tiktok"]');
    if (ttFollower && creator.tiktok_follower) {
      const follower = this.parseFollowerRange(creator.tiktok_follower);
      if (follower) ttFollower.value = follower;
    }

    const locationInput = document.querySelector('input[name="wohnort"]');
    if (locationInput && creator.lieferadresse_stadt) {
      locationInput.value = creator.lieferadresse_stadt;
    }

    const notizInput = document.querySelector('textarea[name="notiz"]');
    if (notizInput && creator.notiz) {
      notizInput.value = creator.notiz;
    }
  }

  parseFollowerRange(rangeStr) {
    if (!rangeStr) return null;
    if (typeof rangeStr === 'number') return rangeStr;

    if (rangeStr.includes('+')) {
      return parseInt(rangeStr.replace('+', ''), 10);
    }

    const parts = rangeStr.split('-');
    if (parts.length === 2) {
      const min = parseInt(parts[0], 10);
      const max = parseInt(parts[1], 10);
      if (!isNaN(min) && !isNaN(max)) {
        return Math.round((min + max) / 2);
      }
    }

    return parseInt(rangeStr, 10) || null;
  }

  async handleSubmit(formData) {
    const typ = normalizeCreatorTyp(formData.get('typ'));
    const name = formData.get('name')?.trim();

    if (this.mode === 'database' && !this.selectedCreatorFromDb) {
      window.toastSystem?.show('Bitte einen Creator aus der Datenbank auswählen', 'error');
      return;
    }

    if (this.mode === 'new' && (!typ || !name)) {
      window.toastSystem?.show('Bitte Creator Art und Name ausfüllen', 'error');
      return;
    }

    const submitBtn = document.getElementById('submit-btn');

    try {
      submitBtn.disabled = true;

      const resolvedTyp = typ || (this.selectedCreatorFromDb ? 'Influencer' : null);
      if (!isAllowedCreatorTyp(resolvedTyp)) {
        window.toastSystem?.show('Ungültige Creator Art. Bitte gültigen Typ auswählen.', 'error');
        submitBtn.disabled = false;
        return;
      }

      const itemData = {
        creator_auswahl_id: this.detail.listeId,
        typ: resolvedTyp,
        name: name || (this.selectedCreatorFromDb ? `${this.selectedCreatorFromDb.vorname || ''} ${this.selectedCreatorFromDb.nachname || ''}`.trim() : null),
        link_instagram: formData.get('link_instagram')?.trim() || null,
        follower_instagram: formData.get('follower_instagram') ? parseInt(formData.get('follower_instagram'), 10) : null,
        link_tiktok: formData.get('link_tiktok')?.trim() || null,
        follower_tiktok: formData.get('follower_tiktok') ? parseInt(formData.get('follower_tiktok'), 10) : null,
        rueckmeldung_creator: formData.get('rueckmeldung_creator') === 'true',
        kategorie: formData.get('kategorie')?.trim() || null,
        wohnort: formData.get('wohnort')?.trim() || null,
        notiz: formData.get('notiz')?.trim() || null,
        pricing: formData.get('pricing')?.trim() || null,
        sortierung: this.detail.items.length,
        creator_id: this.selectedCreatorFromDb?.id || null
      };

      const newItem = await creatorAuswahlService.createItem(itemData);
      this.detail.items.push(newItem);

      window.toastSystem?.show('Creator erfolgreich hinzugefügt', 'success');
      this.close();
      this.detail.rerenderTable();

    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error);
      window.toastSystem?.show(error.message || 'Fehler beim Hinzufügen des Creators', 'error');
      submitBtn.disabled = false;
    }
  }

  async createInitialEmptyRow() {
    try {
      const itemData = {
        creator_auswahl_id: this.detail.listeId,
        typ: null,
        name: null,
        link_instagram: null,
        follower_instagram: null,
        link_tiktok: null,
        follower_tiktok: null,
        rueckmeldung_creator: false,
        kategorie: null,
        wohnort: null,
        notiz: null,
        pricing: null,
        sortierung: 0,
        creator_id: null
      };

      const newItem = await creatorAuswahlService.createItem(itemData);
      this.detail.items.push(newItem);
    } catch (error) {
      console.error('Fehler beim Erstellen der initialen Zeile:', error);
    }
  }

  async addEmptyRow() {
    try {
      const itemData = {
        creator_auswahl_id: this.detail.listeId,
        typ: null,
        name: null,
        link_instagram: null,
        follower_instagram: null,
        link_tiktok: null,
        follower_tiktok: null,
        rueckmeldung_creator: false,
        kategorie: null,
        wohnort: null,
        notiz: null,
        pricing: null,
        sortierung: this.detail.items.length,
        creator_id: null
      };

      const newItem = await creatorAuswahlService.createItem(itemData);
      this.detail.items.push(newItem);
      this.detail.rerenderTable();

      setTimeout(() => {
        const nameField = document.querySelector(`textarea[data-item-id="${newItem.id}"][data-field="name"]`);
        if (nameField) nameField.focus();
      }, 100);

    } catch (error) {
      console.error('Fehler beim Hinzufügen einer leeren Zeile:', error);
      window.toastSystem?.show('Fehler beim Hinzufügen', 'error');
    }
  }

  remove() {
    ['add-creator-overlay', 'add-creator-drawer'].forEach(id => {
      document.getElementById(id)?.remove();
    });
  }

  close() {
    document.getElementById('add-creator-overlay')?.classList.remove('active');
    document.getElementById('add-creator-drawer')?.classList.remove('show');
    setTimeout(() => this.remove(), 300);
  }
}
