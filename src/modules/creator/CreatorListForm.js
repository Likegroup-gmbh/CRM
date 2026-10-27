// CreatorListForm.js
// Anlegen: Instagram-Link zuerst, dann Formular und Submit (Prototype-Mixin). Duplikat-Check: DuplicateCheckBinding

import { CreatorList } from './CreatorListCore.js';
import { injectFirmaCreateButton } from './FirmaCreateDrawer.js';
import { bindDuplicateCheck } from '../../core/validation/DuplicateCheckBinding.js';
import { bindGenerationControls, normalizeHandle } from './creatorProfil.js';
import { formularAusInstagramVorschau, followerZumSpeichern } from './creatorInstagramPrefill.js';
import { mountCreatorBetreuung, syncCreatorBetreuung } from '../ansprechpartner/betreuung.js';
import { instagramProfilHandle } from '../creator-auswahl/instagramDrawerFill.js';
import { creatorAuswahlService } from '../creator-auswahl/CreatorAuswahlService.js';
import { connectInstagramSilent } from '../../core/ActionsDropdownEffects.js';

CreatorList.prototype.showCreateForm = function() {
  window.setHeadline('Neuen Creator anlegen');
  if (window.breadcrumbSystem) {
    window.breadcrumbSystem.updateDetailLabel('Neuer Creator');
  }
  window.content.innerHTML = `
    <div class="form-page form-page--half">
      <form id="creator-instagram-start">
        <div class="form-field">
          <label for="creator-instagram-link">Instagram-Link</label>
          <input id="creator-instagram-link" name="instagram" type="url" class="form-input"
                 placeholder="https://instagram.com/…" required />
          <span class="form-hint">Der Link füllt das Formular. Gleicher Handle öffnet den vorhandenen Creator.</span>
        </div>
        <div class="form-actions">
          <button type="submit" class="mdc-btn mdc-btn--create">
            <span class="mdc-btn__label">Weiter</span>
          </button>
          <button type="button" class="mdc-btn mdc-btn--secondary" id="creator-skip-instagram">
            <span class="mdc-btn__label">Ohne Instagram-Link weiter</span>
          </button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('creator-instagram-start')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const label = button?.querySelector('.mdc-btn__label');
    const skip = document.getElementById('creator-skip-instagram');
    if (button) {
      button.disabled = true;
      button.classList.add('is-loading');
    }
    if (skip) skip.disabled = true;
    if (label) label.textContent = 'Wird geladen…';
    try {
      await this.continueFromInstagram(event.target.instagram.value);
    } finally {
      if (button?.isConnected) {
        button.disabled = false;
        button.classList.remove('is-loading');
        if (label) label.textContent = 'Weiter';
      }
      if (skip?.isConnected) skip.disabled = false;
    }
  });
  document.getElementById('creator-skip-instagram')?.addEventListener('click', () => {
    this._instagramFollowerZahl = null;
    this.renderCreatorForm('');
  });
};

CreatorList.prototype.continueFromInstagram = async function(raw) {
  this._instagramFollowerZahl = null;
  const handle = normalizeHandle(raw);
  if (handle && window.supabase) {
    const { data } = await window.supabase
      .from('creator')
      .select('id, vorname, nachname, mail, telefonnummer, instagram, profilbild_url, ig_biography')
      .ilike('instagram', `%${handle}%`)
      .limit(20);
    const existing = (data || []).find((row) => normalizeHandle(row.instagram) === handle);
    if (existing) {
      await this.fillEmptyFromScrape(existing, raw);
      window.navigateTo(`/creator/${existing.id}`);
      return;
    }
  }
  const values = await this.instagramFelderFuerNeuesFormular(raw);
  if (!document.getElementById('creator-instagram-start')) return;
  this.renderCreatorForm(values);
};

CreatorList.prototype.instagramFelderFuerNeuesFormular = async function(raw) {
  const link = String(raw || '').trim();
  if (!instagramProfilHandle(raw)) {
    window.toastSystem?.show('Nur ein Instagram-Profil wird ausgelesen', 'info');
    return { instagram: link };
  }
  try {
    const result = await creatorAuswahlService.previewInstagramStats(raw);
    const values = formularAusInstagramVorschau(raw, result);
    if (!values.geladen) {
      window.toastSystem?.show('Instagram konnte nicht geladen werden', 'error');
      return values;
    }
    const zahl = Number(result?.fields?.follower_instagram);
    if (Number.isFinite(zahl)) this._instagramFollowerZahl = zahl;
    return values;
  } catch (error) {
    console.warn('Instagram-Vorschau fehlgeschlagen', error);
    window.toastSystem?.show('Instagram konnte nicht geladen werden', 'error');
    return { instagram: link };
  }
};

CreatorList.prototype.fillEmptyFromScrape = async function(existing, rawUrl) {
  try {
    const scraped = await creatorAuswahlService.scrapeCreator(rawUrl);
    const patch = {};
    const name = String(scraped?.name || '').trim();
    const [vorname, ...rest] = name.split(/\s+/);
    if (!existing.vorname && vorname) patch.vorname = vorname;
    if (!existing.nachname && rest.length) patch.nachname = rest.join(' ');
    if (!existing.instagram && (scraped?.handle || normalizeHandle(rawUrl))) {
      patch.instagram = scraped?.handle || normalizeHandle(rawUrl);
    }
    if (!existing.ig_biography && scraped?.bio) patch.ig_biography = scraped.bio;
    const photo = scraped?.profile_image_url || scraped?.profileImageUrl;
    if (!existing.profilbild_url && photo) patch.profilbild_url = photo;
    if (Object.keys(patch).length) {
      await window.dataService.updateEntity('creator', existing.id, patch);
    }
  } catch (error) {
    console.warn('Instagram-Daten konnten leere Felder nicht füllen', error);
  }
};

CreatorList.prototype.renderCreatorForm = function(instagramPrefill = '') {
  const values = typeof instagramPrefill === 'string'
    ? { instagram: instagramPrefill }
    : { ...(instagramPrefill || {}) };
  delete values.geladen;
  const formHtml = window.formSystem.renderFormOnly('creator', values);
  window.content.innerHTML = `
    <div class="form-split-container">
      <div class="form-split-left">
        <div class="form-page">
          ${formHtml}
        </div>
      </div>
      <div class="form-split-right hidden" id="creator-split-container">
        <div id="creator-embedded-form"></div>
      </div>
    </div>
  `;

  window.formSystem.bindFormEvents('creator', null);
  injectFirmaCreateButton();

  const form = document.getElementById('creator-form');
  if (!form) return;
  for (const [name, value] of Object.entries(values)) {
    if (value == null || value === '') continue;
    const field = form.querySelector(`[name="${name}"]`);
    if (field) field.value = value;
  }
  bindGenerationControls(form);
  mountCreatorBetreuung(form);
  form.onsubmit = async (e) => {
    e.preventDefault();
    await this.handleFormSubmit();
  };
  this._duplicateCheck?.destroy();
  this._duplicateCheck = bindDuplicateCheck('creator', form);
};

CreatorList.prototype.handleFormSubmit = async function() {
  const btn = document.querySelector('.mdc-btn.mdc-btn--create');
  
  if (btn?.dataset.locked === 'true') return;
  if (btn) {
    btn.dataset.locked = 'true';
    btn.classList.add('is-loading');
    const labelEl = btn.querySelector('.mdc-btn__label');
    if (labelEl) labelEl.textContent = 'Wird angelegt…';
  }

  try {
    const form = document.getElementById('creator-form');
    const formData = new FormData(form);
    const submitData = {};

    const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
    tagBasedSelects.forEach(select => {
      const fieldName = select.name;
      
      let hiddenSelect = form.querySelector(`select[name="${fieldName}[]"][style*="display: none"]`);
      if (!hiddenSelect) {
        hiddenSelect = form.querySelector(`select[name="${fieldName}"][style*="display: none"]`);
      }
      
      if (!hiddenSelect) {
        const tagContainer = form.querySelector(`select[name="${fieldName}"]`)?.closest('.form-field')?.querySelector('.tag-based-select');
        if (tagContainer) {
          const tags = tagContainer.querySelectorAll('.tag[data-value]');
          const tagValues = Array.from(tags).map(tag => tag.dataset.value).filter(Boolean);
          if (tagValues.length > 0) {
            submitData[fieldName] = tagValues;
            return;
          }
        }
      }
      
      if (hiddenSelect) {
        const values = Array.from(hiddenSelect.selectedOptions).map(opt => opt.value).filter(Boolean);
        if (values.length > 0) {
          submitData[fieldName] = values;
        }
      }
    });

    for (const [key, value] of formData.entries()) {
      if (key.includes('[]')) {
        const cleanKey = key.replace('[]', '');
        if (!submitData[cleanKey]) {
          submitData[cleanKey] = [];
        }
        submitData[cleanKey].push(value);
      } else {
        if (!submitData.hasOwnProperty(key) || !Array.isArray(submitData[key])) {
          submitData[key] = value;
        }
      }
    }

    // Checkboxes/Toggles explizit als Boolean setzen (auch wenn nicht angehakt)
    const toggleInputs = form.querySelectorAll('input[type="checkbox"][name]');
    toggleInputs.forEach(input => {
      submitData[input.name] = input.checked;
    });

    for (const [key, value] of Object.entries(submitData)) {
      if (Array.isArray(value)) {
        submitData[key] = [...new Set(value)];
      }
    }

    const validation = window.validatorSystem.validateForm(submitData, {
      vorname: { type: 'text', minLength: 2, required: true },
      nachname: { type: 'text', minLength: 2, required: true },
      mail: { type: 'email' },
      telefonnummer: { type: 'phone' },
      portfolio_link: { type: 'url' }
    });
    
    const mail = String(submitData.mail || '').trim();
    const phone = String(submitData.telefonnummer || '').trim();
    const phoneMissing = submitData.telefon_nicht_vorhanden === true;
    if (!mail) validation.errors = { ...(validation.errors || {}), mail: 'Mail ist Pflicht' };
    if (!phone && !phoneMissing) {
      validation.errors = { ...(validation.errors || {}), telefonnummer: 'Telefon ist Pflicht, oder „nicht vorhanden“' };
    }
    if (!mail || (!phone && !phoneMissing)) validation.isValid = false;

    submitData.instagram_follower = followerZumSpeichern(
      submitData.instagram_follower,
      this._instagramFollowerZahl
    );

    if (!validation.isValid) {
      if (btn) {
        btn.dataset.locked = 'false';
        btn.classList.remove('is-loading');
        const labelEl = btn.querySelector('.mdc-btn__label');
        if (labelEl) labelEl.textContent = 'Anlegen';
      }
      this.showValidationErrors(validation.errors);
      return;
    }

    const result = await window.dataService.createEntity('creator', submitData);

    if (result.success) {
      if (btn) {
        btn.classList.remove('is-loading');
        btn.classList.add('is-success');
        const labelEl = btn.querySelector('.mdc-btn__label');
        if (labelEl) labelEl.textContent = 'Creator angelegt';
      }
      
      this.showSuccessMessage('Creator erfolgreich erstellt!');
      await syncCreatorBetreuung(result.id, form);
      await this.auslesenWennNeu(result.id, '', submitData.instagram);

      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'creator', id: result.id, action: 'created', redirect: true }
      }));
    } else {
      throw new Error(result.error || 'Unbekannter Fehler');
    }

  } catch (error) {
    if (btn) {
      btn.dataset.locked = 'false';
      btn.classList.remove('is-loading');
      const labelEl = btn.querySelector('.mdc-btn__label');
      if (labelEl) labelEl.textContent = 'Anlegen';
    }
    console.error('❌ Formular-Submit Fehler:', error);
    this.showErrorMessage(error.message);
  }
};

CreatorList.prototype.auslesenWennNeu = async function(creatorId, before, after) {
  const next = normalizeHandle(after);
  if (!creatorId || !next || next === normalizeHandle(before)) return;
  window.toastSystem?.show('Instagram-Daten werden geladen', 'info');
  const result = await connectInstagramSilent(creatorId);
  if (!result?.ok) window.toastSystem?.show('Instagram konnte nicht ausgelesen werden', 'error');
};

CreatorList.prototype.showValidationErrors = function(errors) {
  document.querySelectorAll('.field-error').forEach(el => el.remove());

  Object.entries(errors).forEach(([field, message]) => {
    const fieldElement = document.querySelector(`[name="${field}"]`);
    if (fieldElement) {
      const errorElement = document.createElement('div');
      errorElement.className = 'field-error';
      errorElement.textContent = message;
      fieldElement.parentNode.appendChild(errorElement);
    }
  });
};

CreatorList.prototype.showSuccessMessage = function(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'alert alert-success';
  successDiv.textContent = message;
  
  const form = document.getElementById('creator-form');
  if (form) {
    form.parentNode.insertBefore(successDiv, form);
  }
};

CreatorList.prototype.showErrorMessage = function(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'alert alert-error';
  errorDiv.textContent = message;
  
  const form = document.getElementById('creator-form');
  if (form) {
    form.parentNode.insertBefore(errorDiv, form);
  }
};
