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
  stammdatenTreffer,
  statsForSave
} from './instagramDrawerFill.js';
import { normalizeHandle } from '../creator/creatorProfil.js';

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
    this.dbRequest = (this.dbRequest || 0) + 1;
    this.dbTreffer = [];
    this.dbTrefferHandle = null;
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

      if (this.selectedCreatorFromDb && this.istAufCasting(this.selectedCreatorFromDb.id)) {
        window.toastSystem?.show('Creator ist bereits auf diesem Casting', 'error');
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
      this.dbRequest += 1;
      this.dbTreffer = [];
      this.dbTrefferHandle = null;
      if (this.selectedCreatorFromDb) this.verwirfStammdatenAuswahl();
      else this.zeigeDbHinweis([]);
      this.setIgStatus(null);
      this.setSubmitLocked(false);
      return;
    }

    if (this.selectedCreatorFromDb && normalizeHandle(this.selectedCreatorFromDb.instagram) !== handle) {
      this.selectedCreatorFromDb = null;
      this.dbTreffer = [];
      this.dbTrefferHandle = null;
      if (this.mode === 'database') this.verwirfStammdatenAuswahl();
    }

    if (handle === this.igHandle && (this.igPayload || this.igPending)) {
      if (this.igPayload) {
        this.setzeNormalisiertenLink(handle);
        this.schreibeVorschauInFelder(this.igPayload);
      }
      this.pruefeStammdaten(handle);
      return;
    }

    const request = ++this.igRequest;
    this.igPending = true;
    this.igPayload = null;
    this.igHandle = handle;
    this.setIgStatus(IG_LADE_TEXT);
    this.setSubmitLocked(true);
    this.zeigeDbHinweis([]);
    this.pruefeStammdaten(handle);

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

  istAufCasting(creatorId) {
    return (this.detail?.items || []).some(item => item.creator_id === creatorId);
  }

  castingCreatorIds() {
    return (this.detail?.items || []).map(item => item.creator_id).filter(Boolean);
  }

  async sucheCreatorNachHandle(handle) {
    if (!window.supabase) return [];
    const { data, error } = await window.supabase
      .from('creator')
      .select('id, vorname, nachname, instagram, instagram_follower, tiktok, tiktok_follower, lieferadresse_stadt, mail, telefonnummer, notiz')
      .ilike('instagram', `%${handle}%`)
      .limit(50);
    if (error) throw error;
    return data || [];
  }

  pruefeStammdaten(handle) {
    if (this.selectedCreatorFromDb && normalizeHandle(this.selectedCreatorFromDb.instagram) === handle) {
      this.zeigeDbHinweis([]);
      return;
    }
    if (this.dbTrefferHandle === handle && Array.isArray(this.dbTreffer)) {
      this.zeigeDbHinweis(stammdatenTreffer(this.dbTreffer, handle, this.castingCreatorIds()));
      return;
    }
    const request = ++this.dbRequest;
    this.dbTrefferHandle = handle;
    this.dbTreffer = null;
    this.ladeStammdatenTreffer(handle, request);
  }

  async ladeStammdatenTreffer(handle, request) {
    try {
      const rows = await this.sucheCreatorNachHandle(handle);
      if (request !== this.dbRequest) return;
      this.dbTreffer = rows;
      if (this.selectedCreatorFromDb && normalizeHandle(this.selectedCreatorFromDb.instagram) === handle) {
        this.zeigeDbHinweis([]);
        return;
      }
      this.zeigeDbHinweis(stammdatenTreffer(rows, handle, this.castingCreatorIds()));
    } catch (error) {
      if (request !== this.dbRequest) return;
      console.error('Stammdaten-Abgleich fehlgeschlagen:', error);
      this.dbTreffer = [];
      this.zeigeDbHinweis([]);
    }
  }

  zeigeDbHinweis(eintraege) {
    const el = document.getElementById('ig-db-hinweis');
    if (!el) return;
    if (!eintraege?.length) {
      el.hidden = true;
      el.replaceChildren();
      return;
    }
    el.hidden = false;
    el.replaceChildren();
    for (const eintrag of eintraege) {
      const row = document.createElement('p');
      row.className = 'form-hint ig-db-hinweis__row';
      const text = document.createElement('span');
      text.textContent = eintrag.bereitsAufCasting
        ? `${eintrag.name} (@${eintrag.handle}) steht schon auf diesem Casting.`
        : `${eintrag.name} (@${eintrag.handle}) ist schon in der Datenbank.`;
      row.appendChild(text);
      if (!eintrag.bereitsAufCasting) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mdc-btn mdc-btn--secondary ig-db-hinweis__action';
        button.textContent = 'Aus der Datenbank übernehmen';
        button.addEventListener('click', () => this.uebernimmStammdaten(eintrag.creator));
        row.appendChild(button);
      }
      el.appendChild(row);
    }
  }

  markiereModus(mode) {
    this.mode = mode;
    document.querySelectorAll('#add-creator-drawer .view-toggle .mdc-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.mode === mode);
    });
  }

  liesFormular() {
    const form = document.getElementById('add-creator-form');
    const werte = {};
    form?.querySelectorAll('input, textarea, select').forEach(el => {
      if (el.name) werte[el.name] = el.value;
    });
    return werte;
  }

  schreibeFormular(werte) {
    const form = document.getElementById('add-creator-form');
    if (!form) return;
    this.igApplying = true;
    for (const [name, value] of Object.entries(werte || {})) {
      const el = form.querySelector(`[name="${name}"]`);
      if (el) el.value = value ?? '';
    }
    this.igApplying = false;
  }

  igZustand() {
    return {
      request: this.igRequest,
      owners: { ...this.igOwners },
      payload: this.igPayload,
      handle: this.igHandle,
      pending: this.igPending,
      applying: this.igApplying,
      dbRequest: this.dbRequest,
      dbTreffer: this.dbTreffer,
      dbTrefferHandle: this.dbTrefferHandle
    };
  }

  igZustandSetzen(zustand) {
    if (!zustand) return;
    this.igRequest = zustand.request;
    this.igOwners = zustand.owners;
    this.igPayload = zustand.payload;
    this.igHandle = zustand.handle;
    this.igPending = zustand.pending;
    this.igApplying = zustand.applying;
    this.dbRequest = zustand.dbRequest;
    this.dbTreffer = zustand.dbTreffer;
    this.dbTrefferHandle = zustand.dbTrefferHandle;
    if (zustand.pending) this.setSubmitLocked(true);
  }

  uebernimmStammdaten(creator) {
    if (!creator || this.istAufCasting(creator.id)) return;
    const werte = this.liesFormular();
    const zustand = this.igZustand();
    this.selectedCreatorFromDb = creator;
    this.markiereModus('database');
    const body = document.getElementById('add-creator-drawer-body');
    if (!body) return;
    body.innerHTML = this.renderForm();
    this.bindFormEvents();
    this.igZustandSetzen(zustand);
    this.schreibeFormular(werte);
    this.zeigeGewaehltenCreator(creator);
    this.fillFormFromDbCreator(creator);
  }

  zeigeGewaehltenCreator(creator) {
    const infoDiv = document.getElementById('db-selected-info');
    const formFields = document.getElementById('add-creator-form-fields');
    const search = document.querySelector('#add-creator-form .sourcing-search-section');
    const hidden = document.getElementById('db-selected-creator-id');
    if (hidden) hidden.value = creator.id || '';
    if (search) search.hidden = true;
    if (formFields) formFields.style.display = 'block';
    if (!infoDiv) return;
    infoDiv.style.display = 'block';
    infoDiv.replaceChildren();
    const tag = document.createElement('div');
    tag.className = 'tag tag-selected-creator';
    const label = document.createElement('span');
    label.textContent = `${creator.vorname || ''} ${creator.nachname || ''}`.trim() || 'Unbekannt';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'tag-remove';
    remove.id = 'btn-remove-db-creator';
    remove.textContent = '✕';
    remove.addEventListener('click', () => this.verwirfStammdatenAuswahl());
    tag.append(label, remove);
    infoDiv.appendChild(tag);
  }

  verwirfStammdatenAuswahl() {
    const werte = this.liesFormular();
    const zustand = this.igZustand();
    this.selectedCreatorFromDb = null;
    this.markiereModus('new');
    const body = document.getElementById('add-creator-drawer-body');
    if (body) {
      body.innerHTML = this.renderForm();
      this.bindFormEvents();
    }
    this.igZustandSetzen(zustand);
    this.schreibeFormular(werte);
    const handle = instagramProfilHandle(werte.link_instagram);
    if (handle) this.pruefeStammdaten(handle);
    else this.zeigeDbHinweis([]);
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
