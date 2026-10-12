// CreatorAuswahlAddDrawer.js
// Drawer zum Hinzufuegen von Creatorn (manuell oder aus Datenbank).
// Formular und DB-Vorschlag liegen als Prototype-Mixin daneben.

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { isAllowedCreatorTyp, normalizeCreatorTyp } from './creatorTypeOptions.js';
import { creatorAuswahlAddFormMethods } from './creatorAuswahlAddForm.js';
import {
  IG_TEXT_FIELDS,
  applyPreviewToForm,
  instagramProfilHandle,
  leereIgOwners,
  markUserEdit,
  normalizedInstagramUrl,
  schuetzeGefuellte,
  statsForSave
} from './instagramDrawerFill.js';

const IG_LADE_TEXT = 'Instagram-Daten werden geladen…';

export class CreatorAuswahlAddDrawer {
  constructor(detail) {
    this.detail = detail;
    this.mode = 'new'; // 'new' oder 'database'
    this.selectedCreatorFromDb = null;
    this.igRequest = 0;
    this.resetIgFill();
  }

  resetIgFill() {
    this.igRequest += 1;
    this.igOwners = leereIgOwners();
    this.igPayload = null;
    this.igHandle = null;
    this.igPending = false;
    this.igApplying = false;
  }

  open() {
    clearTimeout(this.closeTimer);
    this.remove();
    this.resetIgFill();
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
        <button type="button" class="mdc-btn mdc-btn--secondary active" data-mode="new">Neuer Creator</button>
        <button type="button" class="mdc-btn mdc-btn--secondary" data-mode="database">Aus Datenbank</button>
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

    toggleContainer.querySelectorAll('.view-toggle .mdc-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.switchMode(mode);
        toggleContainer.querySelectorAll('.view-toggle .mdc-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
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
    this.resetIgFill();

    const body = document.getElementById('add-creator-drawer-body');
    if (body) {
      body.innerHTML = this.renderForm();
      this.bindFormEvents();
    }
  }

  async handleSubmit(formData) {
    if (this.igPending) return;

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

    const kategorie = formData.get('kategorie')?.trim() || null;

    const submitBtn = document.getElementById('submit-btn');

    try {
      submitBtn.disabled = true;

      const resolvedTyp = typ || (this.selectedCreatorFromDb ? 'Influencer' : null);
      if (!isAllowedCreatorTyp(resolvedTyp)) {
        window.toastSystem?.show('Ungültige Creator Art. Bitte gültigen Typ auswählen.', 'error');
        submitBtn.disabled = false;
        return;
      }

      const link = formData.get('link_instagram')?.trim() || null;
      const stats = statsForSave(this.igPayload, link);

      const itemData = {
        creator_auswahl_id: this.detail.listeId,
        typ: resolvedTyp,
        name: name || (this.selectedCreatorFromDb ? `${this.selectedCreatorFromDb.vorname || ''} ${this.selectedCreatorFromDb.nachname || ''}`.trim() : null),
        link_instagram: link,
        ...(stats || {}),
        follower_instagram: formData.get('follower_instagram') ? parseInt(formData.get('follower_instagram'), 10) : null,
        link_tiktok: formData.get('link_tiktok')?.trim() || null,
        follower_tiktok: formData.get('follower_tiktok') ? parseInt(formData.get('follower_tiktok'), 10) : null,
        kategorie,
        wohnort: formData.get('wohnort')?.trim() || null,
        email: formData.get('email')?.trim() || null,
        telefon: formData.get('telefon')?.trim() || null,
        notiz: formData.get('notiz')?.trim() || null,
        pricing: formData.get('pricing')?.trim() || null,
        nutzungsrechte: formData.get('nutzungsrechte')?.trim() || null,
        preis_ek: formData.get('preis_ek') ? parseFloat(formData.get('preis_ek')) : null,
        preis_vk: formData.get('preis_vk') ? parseFloat(formData.get('preis_vk')) : null,
        reichweite_story: formData.get('reichweite_story')?.trim() || null,
        preis_story: formData.get('preis_story')?.trim() || null,
        preis_tiktok_video: formData.get('preis_tiktok_video')?.trim() || null,
        preis_tiktok_story: formData.get('preis_tiktok_story')?.trim() || null,
        reichweite_garantie: formData.get('reichweite_garantie')?.trim() || null,
        sortierung: this.detail.items.length,
        creator_id: this.selectedCreatorFromDb?.id || null
      };

      const newItem = await creatorAuswahlService.createItem(itemData);
      this.detail.items.push(newItem);

      window.toastSystem?.show('Creator erfolgreich hinzugefügt', 'success');
      this.close();
      this.detail.ensureNewItemVisible?.();
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
        absage: false,
        kategorie: null,
        wohnort: null,
        notiz: null,
        pricing: null,
        preis_ek: null,
        preis_vk: null,
        reichweite_story: null,
        preis_story: null,
        preis_reels: null,
        reichweite_garantie: null,
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
        absage: false,
        kategorie: null,
        wohnort: null,
        notiz: null,
        pricing: null,
        preis_ek: null,
        preis_vk: null,
        reichweite_story: null,
        preis_story: null,
        preis_reels: null,
        reichweite_garantie: null,
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

  verbindeInstagramAbruf(form) {
    if (!form) return;
    const linkInput = form.querySelector('input[name="link_instagram"]');
    const starten = () => this.ladeInstagramVorschau(linkInput?.value);
    linkInput?.addEventListener('paste', () => setTimeout(starten, 0));
    linkInput?.addEventListener('blur', starten);

    for (const field of IG_TEXT_FIELDS) {
      form.querySelector(`[name="${field}"]`)?.addEventListener('input', () => {
        if (this.igApplying) return;
        this.igOwners = markUserEdit(this.igOwners, field);
      });
    }
  }

  formularWerte() {
    const form = document.getElementById('add-creator-form');
    const values = {};
    for (const field of IG_TEXT_FIELDS) {
      values[field] = form?.querySelector(`[name="${field}"]`)?.value ?? '';
    }
    return values;
  }

  nachStammdaten() {
    this.igOwners = schuetzeGefuellte(this.igOwners, this.formularWerte());
    const link = document.querySelector('#add-creator-form input[name="link_instagram"]')?.value;
    if (link) this.ladeInstagramVorschau(link);
  }

  async ladeInstagramVorschau(raw) {
    const handle = instagramProfilHandle(raw);
    if (!handle) {
      this.igRequest += 1;
      this.igPending = false;
      this.igPayload = null;
      this.igHandle = null;
      this.setIgStatus(null);
      this.setSubmitLocked(false);
      return;
    }

    if (handle === this.igHandle && (this.igPayload || this.igPending)) {
      if (this.igPayload) this.setzeNormalisiertenLink(handle);
      return;
    }

    const request = ++this.igRequest;
    this.igPending = true;
    this.igPayload = null;
    this.igHandle = handle;
    this.setIgStatus(IG_LADE_TEXT);
    this.setSubmitLocked(true);

    try {
      const result = await creatorAuswahlService.previewInstagramStats(raw);
      if (request !== this.igRequest) return;
      const username = String(result.username || '').toLowerCase();
      if (username !== handle) {
        this.setIgStatus(null);
        return;
      }
      this.igPayload = { username, ...result.fields };
      this.schreibeVorschauInFelder(result.fields);
      this.setzeNormalisiertenLink(handle);
      this.setIgStatus(null);
    } catch (error) {
      if (request !== this.igRequest) return;
      this.igPayload = null;
      const text = [error.message, error.hint].filter(Boolean).join(' ');
      this.setIgStatus(text || 'Instagram-Abruf fehlgeschlagen');
    } finally {
      if (request === this.igRequest) {
        this.igPending = false;
        this.setSubmitLocked(false);
      }
    }
  }

  schreibeVorschauInFelder(fields) {
    const form = document.getElementById('add-creator-form');
    if (!form) return;
    const applied = applyPreviewToForm(this.formularWerte(), this.igOwners, fields);
    this.igApplying = true;
    for (const field of IG_TEXT_FIELDS) {
      const el = form.querySelector(`[name="${field}"]`);
      if (el) el.value = applied.values[field];
    }
    const follower = form.querySelector('[name="follower_instagram"]');
    if (follower) follower.value = applied.values.follower_instagram;
    this.igApplying = false;
    this.igOwners = applied.owners;
  }

  setzeNormalisiertenLink(handle) {
    const input = document.querySelector('#add-creator-form input[name="link_instagram"]');
    if (!input) return;
    const next = normalizedInstagramUrl(handle);
    if (input.value !== next) input.value = next;
  }

  setIgStatus(message) {
    const el = document.getElementById('ig-link-status');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      el.classList.remove('form-hint--error');
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.classList.toggle('form-hint--error', message !== IG_LADE_TEXT);
  }

  setSubmitLocked(locked) {
    const btn = document.getElementById('submit-btn');
    if (btn) btn.disabled = locked;
  }

  remove() {
    clearTimeout(this.closeTimer);
    ['add-creator-overlay', 'add-creator-drawer'].forEach(id => {
      document.getElementById(id)?.remove();
    });
  }

  close() {
    this.resetIgFill();
    document.getElementById('add-creator-overlay')?.classList.remove('active');
    document.getElementById('add-creator-drawer')?.classList.remove('show');
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => this.remove(), 300);
  }
}

Object.assign(CreatorAuswahlAddDrawer.prototype, creatorAuswahlAddFormMethods);
