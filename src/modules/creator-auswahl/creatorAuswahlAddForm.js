// creatorAuswahlAddForm.js
// Formular, TikTok-Preisfelder und DB-Creator-Vorschlag
// (Prototype-Mixin von CreatorAuswahlAddDrawer)

import { CREATOR_TYP_OPTIONS } from './creatorTypeOptions.js';
import { DEAKTIVIERTE_SPALTEN } from './sourcingSpaltenKatalog.js';
import { berechneHiddenColumns } from './sourcingSpaltenPreset.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { personaDisplayLabel } from './castingPersonaGroups.js';

export function renderForm() {
  const isDatabaseMode = this.mode === 'database';
  const creatorTypOptionsHtml = CREATOR_TYP_OPTIONS
    .map(typ => `<option value="${typ}">${typ}</option>`)
    .join('');

  const personas = this.detail?.personas || [];
  const defaultPersonaId = personas.length === 1 ? personas[0].id : '';
  const personaOptionsHtml = personas
    .map(p => `<option value="${escapeAttr(p.id)}"${p.id === defaultPersonaId ? ' selected' : ''}>${escapeAttr(personaDisplayLabel(p))}</option>`)
    .join('');

  const searchSection = isDatabaseMode ? `
    <div class="form-field sourcing-search-section">
      <label class="form-label">Creator suchen</label>
      <select id="db-creator-select" class="form-input">
        <option value="">Name, Instagram oder TikTok eingeben...</option>
      </select>
      <small class="form-hint">Suche nach bestehenden Creators in der Datenbank</small>
    </div>
    <input type="hidden" id="db-selected-creator-id" value="" />
    <div id="db-selected-info" class="sourcing-selected-info" style="display: none;"></div>
  ` : '';

  const personaFeld = `
        <div class="form-field">
          <label class="form-label">Persona *</label>
          <select id="creator-persona" name="persona_id" class="form-input" required>
            <option value="">Bitte wählen...</option>
            ${personaOptionsHtml}
          </select>
        </div>
  `;

  // EK/VK folgen demselben Schalter wie die Tabelle, sonst laesst der Drawer
  // Werte in Spalten laufen, die niemand mehr sieht
  const ekVkAktiv = !DEAKTIVIERTE_SPALTEN.includes('cp-col-ek') || !DEAKTIVIERTE_SPALTEN.includes('cp-col-vk');
  const preisFelder = ekVkAktiv ? `
        <div class="form-row">
          ${!DEAKTIVIERTE_SPALTEN.includes('cp-col-ek') ? `
          <div class="form-field">
            <label class="form-label">EK (€)</label>
            <input type="number" name="preis_ek" class="form-input" placeholder="z.B. 300" step="0.01">
          </div>
          ` : ''}
          ${!DEAKTIVIERTE_SPALTEN.includes('cp-col-vk') ? `
          <div class="form-field">
            <label class="form-label">VK (€)</label>
            <input type="number" name="preis_vk" class="form-input" placeholder="z.B. 500" step="0.01">
          </div>
          ` : ''}
        </div>
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

        ${personaFeld}

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

        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Mail</label>
            <input type="text" name="email" class="form-input" placeholder="mail@...">
          </div>
          <div class="form-field">
            <label class="form-label">Telefon</label>
            <input type="text" name="telefon" class="form-input" placeholder="+49...">
          </div>
        </div>

        <div class="form-field">
          <label class="form-label">Kurzbeschreibung</label>
          <textarea name="notiz" class="form-input" rows="2" placeholder="Kurzbeschreibung..."></textarea>
        </div>

        ${preisFelder}

        <div class="form-field">
          <label class="form-label">Gesamtpreis</label>
          <input type="text" name="pricing" class="form-input" placeholder="z.B. 500">
        </div>

        <div class="form-field">
          <label class="form-label">Nutzungsrechte</label>
          <textarea name="nutzungsrechte" class="form-input" rows="2" placeholder="z.B. 6 Monate Paid Social, IG + TikTok"></textarea>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Reichweite Story</label>
            <input type="text" name="reichweite_story" class="form-input" placeholder="z.B. 10K">
          </div>
          <div class="form-field">
            <label class="form-label">Preis Story</label>
            <input type="text" name="preis_story" class="form-input" placeholder="z.B. 250€">
          </div>
        </div>

        ${this.zeigtTikTokPreise() ? `
        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Preis TikTok Video</label>
            <input type="text" name="preis_tiktok_video" class="form-input" placeholder="z.B. 400€">
          </div>
          <div class="form-field">
            <label class="form-label">Preis TikTok Story</label>
            <input type="text" name="preis_tiktok_story" class="form-input" placeholder="z.B. 200€">
          </div>
        </div>
        ` : ''}

        <div class="form-field">
          <label class="form-label">Reichweitengarantie</label>
          <input type="text" name="reichweite_garantie" class="form-input" placeholder="z.B. 100K">
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

/** TikTok-Preisfelder nur, wenn die Liste die TikTok-Spalten ueberhaupt zeigt */
export function zeigtTikTokPreise() {
  return !berechneHiddenColumns(this.detail.liste || {}).includes('cp-col-preis-tt-video');
}

export function bindFormEvents() {
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

export function setupDbCreatorAutoSuggestion() {
  const selectEl = document.getElementById('db-creator-select');
  const hiddenInput = document.getElementById('db-selected-creator-id');
  const infoDiv = document.getElementById('db-selected-info');
  const formFields = document.getElementById('add-creator-form-fields');

  if (!selectEl || !window.formSystem) return;

  const escapeHtml = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  const loadCreators = async (query) => {
    try {
      let q = window.supabase
        .from('creator')
        .select('id, vorname, nachname, instagram, tiktok')
        .limit(20);

      if (query && query.length > 0) {
        q = q.or(`vorname.ilike.%${query}%,nachname.ilike.%${query}%,instagram.ilike.%${query}%,tiktok.ilike.%${query}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(c => {
        const name = `${c.vorname || ''} ${c.nachname || ''}`.trim() || 'Unbekannt';
        const socials = [c.instagram, c.tiktok].filter(Boolean).join(', ');
        return {
          value: c.id,
          label: socials ? `${name} — ${socials}` : name
        };
      });
    } catch (error) {
      console.error('Fehler beim Laden der Creator:', error);
      return [];
    }
  };

  window.formSystem.createSimpleSearchableSelect(selectEl, [], {
    placeholder: 'Name, Instagram oder TikTok eingeben...',
    serverSearch: loadCreators
  });

  selectEl.addEventListener('change', async () => {
    const creatorId = selectEl.value;
    if (!creatorId) return;

    try {
      const { data: creator, error } = await window.supabase
        .from('creator')
        .select('*')
        .eq('id', creatorId)
        .single();

      if (error) throw error;

      this.selectedCreatorFromDb = creator;
      hiddenInput.value = creatorId;

      const ssContainer = selectEl.parentNode.querySelector('.searchable-select-container');
      if (ssContainer) ssContainer.style.display = 'none';

      const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim();
      infoDiv.innerHTML = `
        <div class="tag tag-selected-creator">
          <span>${escapeHtml(name)}</span>
          <button type="button" class="tag-remove" id="btn-remove-db-creator">✕</button>
        </div>
      `;
      infoDiv.style.display = 'block';

      formFields.style.display = 'block';
      this.fillFormFromDbCreator(creator);

      document.getElementById('btn-remove-db-creator')?.addEventListener('click', () => {
        this.selectedCreatorFromDb = null;
        hiddenInput.value = '';
        infoDiv.style.display = 'none';
        if (ssContainer) ssContainer.style.display = '';
        formFields.style.display = 'none';
        selectEl.value = '';
        const ssInput = ssContainer?.querySelector('.searchable-select-input');
        if (ssInput) ssInput.value = '';
      });

    } catch (error) {
      console.error('Fehler beim Laden des Creators:', error);
      window.toastSystem?.show('Fehler beim Laden des Creators', 'error');
    }
  });
}

export function fillFormFromDbCreator(creator) {
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

export function parseFollowerRange(rangeStr) {
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

export const creatorAuswahlAddFormMethods = {
  renderForm,
  zeigtTikTokPreise,
  bindFormEvents,
  setupDbCreatorAutoSuggestion,
  fillFormFromDbCreator,
  parseFollowerRange
};

