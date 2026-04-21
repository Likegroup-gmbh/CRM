// AgenturSection.js
// Gemeinsame Render- und Refresh-Logik fuer den "Influencer-Vertretung"-Block
// in UGC- und Influencer-Vertraegen. Unterstuetzt zwei Modi:
//  - aus Creator-Profil uebernommen (read-only, Bearbeiten via Modal)
//  - manuell editierbar (wenn Creator keine Agentur hinterlegt hat)

import { VertraegeCreate } from './VertraegeCreateCore.js';

VertraegeCreate.prototype.renderAgenturSection = function() {
    const fromCreator = !!this.formData._agentur_from_creator;
    const vertreten = !!this.formData.influencer_agentur_vertreten;
    const readonlyAttr = fromCreator ? 'readonly disabled' : '';
    const readonlyClass = fromCreator ? 'readonly-field' : '';
    const radioDisabled = fromCreator ? 'disabled' : '';

    const hint = fromCreator
      ? `<div class="agentur-hint" style="margin-bottom: 12px; padding: 10px 12px; border-radius: 6px; background: #eef4ff; border: 1px solid #c9ddff; color: #1d4ed8; font-size: 13px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <span>
            ${vertreten
              ? 'Agentur-Daten werden aus dem Creator-Profil uebernommen.'
              : 'Fuer diesen Creator ist keine Agentur hinterlegt.'}
          </span>
          <button type="button" id="agentur-edit-btn" class="btn btn-sm" style="padding: 6px 12px; border-radius: 4px; border: 1px solid #1d4ed8; background: #fff; color: #1d4ed8; cursor: pointer; font-size: 12px; white-space: nowrap;">
            Im Creator bearbeiten
          </button>
        </div>`
      : '';

    return `
      <div id="agentur-section-container">
        <h3 class="mt-section">Influencer-Vertretung</h3>

        ${hint}

        <div class="form-field">
          <label>Wird der Influencer durch eine Agentur vertreten?</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="influencer_agentur_vertreten" value="false"
                     ${!vertreten ? 'checked' : ''} ${radioDisabled}>
              <span>Nein</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="influencer_agentur_vertreten" value="true"
                     ${vertreten ? 'checked' : ''} ${radioDisabled}>
              <span>Ja</span>
            </label>
          </div>
        </div>

        <div id="agentur-felder" class="${vertreten ? '' : 'hidden'}">
          <div class="form-field">
            <label for="influencer_agentur_name">Agenturname</label>
            <input type="text" id="influencer_agentur_name" name="influencer_agentur_name"
                   value="${this.formData.influencer_agentur_name || ''}"
                   placeholder="Name der Agentur" ${readonlyAttr} class="${readonlyClass}">
          </div>
          <div class="form-field-row">
            <div class="form-field" style="flex: 1;">
              <label for="influencer_agentur_strasse">Straße</label>
              <input type="text" id="influencer_agentur_strasse" name="influencer_agentur_strasse"
                     value="${this.formData.influencer_agentur_strasse || ''}"
                     ${readonlyAttr} class="${readonlyClass}">
            </div>
            <div class="form-field" style="flex: 0 0 100px;">
              <label for="influencer_agentur_hausnummer">Nr.</label>
              <input type="text" id="influencer_agentur_hausnummer" name="influencer_agentur_hausnummer"
                     value="${this.formData.influencer_agentur_hausnummer || ''}"
                     ${readonlyAttr} class="${readonlyClass}">
            </div>
          </div>
          <div class="form-field-row">
            <div class="form-field" style="flex: 0 0 120px;">
              <label for="influencer_agentur_plz">PLZ</label>
              <input type="text" id="influencer_agentur_plz" name="influencer_agentur_plz"
                     value="${this.formData.influencer_agentur_plz || ''}"
                     ${readonlyAttr} class="${readonlyClass}">
            </div>
            <div class="form-field" style="flex: 1;">
              <label for="influencer_agentur_stadt">Stadt</label>
              <input type="text" id="influencer_agentur_stadt" name="influencer_agentur_stadt"
                     value="${this.formData.influencer_agentur_stadt || ''}"
                     ${readonlyAttr} class="${readonlyClass}">
            </div>
          </div>
          <div class="form-field">
            <label for="influencer_agentur_land">Land</label>
            <input type="text" id="influencer_agentur_land" name="influencer_agentur_land"
                   value="${this.formData.influencer_agentur_land || 'Deutschland'}"
                   ${readonlyAttr} class="${readonlyClass}">
          </div>
          <div class="form-field">
            <label for="influencer_agentur_vertretung">Vertreten durch</label>
            <input type="text" id="influencer_agentur_vertretung" name="influencer_agentur_vertretung"
                   value="${this.formData.influencer_agentur_vertretung || ''}"
                   placeholder="Name des Vertreters" ${readonlyAttr} class="${readonlyClass}">
          </div>
        </div>
      </div>
    `;
};


// Ersetzt die #agentur-section-container im DOM mit frischem HTML aus formData.
// Wird vom Creator-Change-Flow ueber _syncAgenturDomFromFormData() aufgerufen.
VertraegeCreate.prototype.refreshAgenturSection = function() {
    const container = document.getElementById('agentur-section-container');
    if (!container) return;

    const fresh = this.renderAgenturSection();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = fresh;
    const newContainer = wrapper.querySelector('#agentur-section-container');
    if (newContainer) {
      container.replaceWith(newContainer);
      // Events neu binden: Radio-Toggle fuer agentur-felder, Modal-Button
      this._bindAgenturEvents();
    }
};


VertraegeCreate.prototype._bindAgenturEvents = function() {
    // Toggle fuer #agentur-felder je nach Radio-Auswahl (nur bei nicht-readonly relevant)
    document.querySelectorAll('input[name="influencer_agentur_vertreten"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const agenturFelder = document.getElementById('agentur-felder');
        if (agenturFelder) {
          if (e.target.value === 'true') {
            agenturFelder.classList.remove('hidden');
          } else {
            agenturFelder.classList.add('hidden');
          }
        }
        this.formData.influencer_agentur_vertreten = (e.target.value === 'true');
      });
    });

    // Modal-Button zum Bearbeiten der Agentur im Creator-Profil
    const editBtn = document.getElementById('agentur-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (this.formData.creator_id) {
          this.openAgenturEditModal(this.formData.creator_id);
        }
      });
    }
};
