// AgenturSection.js
// Render- und Refresh-Logik fuer den "Management-Vertretung"-Block
// in UGC- und Influencer-Vertraegen.

import { VertraegeCreate } from './VertraegeCreateCore.js';

function escapeAttr(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
}

VertraegeCreate.prototype.renderAgenturSection = function() {
    const managements = this.creatorManagements || [];
    const hasManagements = managements.length > 0;

    // Mehrfach-Management: Dropdown steuert Auswahl, Vertretung implizit, Schalter fuer Adresse
    if (hasManagements) {
      return this._renderAgenturSectionWithDropdown(managements);
    }

    // Kein Management am Creator: manuelle Eingabe wie bisher
    const vertreten = !!this.formData.influencer_agentur_vertreten;

    return `
      <div id="agentur-section-container">
        <h3 class="mt-section">Management-Vertretung</h3>

        <div class="form-field">
          <label>Wird der Influencer durch ein Management vertreten?</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="influencer_agentur_vertreten" value="false"
                     ${!vertreten ? 'checked' : ''}>
              <span>Nein</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="influencer_agentur_vertreten" value="true"
                     ${vertreten ? 'checked' : ''}>
              <span>Ja</span>
            </label>
          </div>
        </div>

        <div id="agentur-felder" class="${vertreten ? '' : 'hidden'}">
          <div class="form-field">
            <label for="influencer_agentur_name">Managementname</label>
            <input type="text" id="influencer_agentur_name" name="influencer_agentur_name"
                   value="${this.formData.influencer_agentur_name || ''}"
                   placeholder="Name des Managements">
          </div>
          <div class="form-field-row">
            <div class="form-field" style="flex: 1;">
              <label for="influencer_agentur_strasse">Straße</label>
              <input type="text" id="influencer_agentur_strasse" name="influencer_agentur_strasse"
                     value="${this.formData.influencer_agentur_strasse || ''}"
                    >
            </div>
            <div class="form-field" style="flex: 0 0 100px;">
              <label for="influencer_agentur_hausnummer">Nr.</label>
              <input type="text" id="influencer_agentur_hausnummer" name="influencer_agentur_hausnummer"
                     value="${this.formData.influencer_agentur_hausnummer || ''}"
                    >
            </div>
          </div>
          <div class="form-field-row">
            <div class="form-field" style="flex: 0 0 120px;">
              <label for="influencer_agentur_plz">PLZ</label>
              <input type="text" id="influencer_agentur_plz" name="influencer_agentur_plz"
                     value="${this.formData.influencer_agentur_plz || ''}"
                    >
            </div>
            <div class="form-field" style="flex: 1;">
              <label for="influencer_agentur_stadt">Stadt</label>
              <input type="text" id="influencer_agentur_stadt" name="influencer_agentur_stadt"
                     value="${this.formData.influencer_agentur_stadt || ''}"
                    >
            </div>
          </div>
          <div class="form-field">
            <label for="influencer_agentur_land">Land</label>
            <input type="text" id="influencer_agentur_land" name="influencer_agentur_land"
                   value="${this.formData.influencer_agentur_land || 'Deutschland'}"
                  >
          </div>
          <div class="form-field">
            <label for="influencer_agentur_vertretung">Vertreten durch</label>
            <input type="text" id="influencer_agentur_vertretung" name="influencer_agentur_vertretung"
                   value="${this.formData.influencer_agentur_vertretung || ''}"
                   placeholder="Name des Vertreters">
          </div>
        </div>
      </div>
    `;
};


// Mehrfach-Management: Dropdown-Auswahl + Schalter "nur Management-Adresse".
// Die Auswahl fuellt implizit den Vertretungs-Block (readonly).
VertraegeCreate.prototype._renderAgenturSectionWithDropdown = function(managements) {
    const selectedId = this.formData._management_id || (managements[0] && managements[0].id);
    const multi = managements.length > 1;
    const nurMgmt = !!this.formData.nur_management_adresse;
    const mgmtLink = selectedId ? `/management/${selectedId}` : '/management/new';

    const options = managements.map(m =>
      `<option value="${escapeAttr(m.id)}" ${m.id === selectedId ? 'selected' : ''}>${escapeAttr(m.firmenname || '—')}</option>`
    ).join('');

    const f = this.formData;

    return `
      <div id="agentur-section-container">
        <h3 class="mt-section">Management-Vertretung</h3>

        <div class="agentur-hint" style="margin-bottom: 12px; padding: 10px 12px; border-radius: 6px; background: #eef4ff; border: 1px solid #c9ddff; color: #1d4ed8; font-size: 13px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <span>Der Influencer wird durch ein Management vertreten. Die Auswahl bestimmt die Vertretungsdaten${nurMgmt ? ' und die Vertragsadresse' : ''}.</span>
          <a href="${mgmtLink}" onclick="event.preventDefault(); window.navigateTo('${mgmtLink}')"
             class="btn btn-sm" style="padding: 6px 12px; border-radius: 4px; border: 1px solid #1d4ed8; background: #fff; color: #1d4ed8; cursor: pointer; font-size: 12px; white-space: nowrap; text-decoration: none;">
            Management ansehen
          </a>
        </div>

        <div class="form-field">
          <label for="vertrag_management_select">Management${multi ? ' (Auswahl erforderlich)' : ''}</label>
          <select id="vertrag_management_select" name="vertrag_management_select" ${multi ? 'required' : ''}>
            ${options}
          </select>
        </div>

        <div class="form-field">
          <label class="checkbox-option" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="nur_management_adresse" name="nur_management_adresse" value="true" ${nurMgmt ? 'checked' : ''}>
            <span>Nur Management-Adresse verwenden (Influencer-Adresse im Vertrag ausblenden)</span>
          </label>
        </div>

        <div id="agentur-felder">
          <div class="form-field">
            <label for="influencer_agentur_name">Managementname</label>
            <input type="text" id="influencer_agentur_name" name="influencer_agentur_name"
                   value="${escapeAttr(f.influencer_agentur_name || '')}" readonly disabled class="readonly-field">
          </div>
          <div class="form-field-row">
            <div class="form-field" style="flex: 1;">
              <label for="influencer_agentur_strasse">Straße</label>
              <input type="text" id="influencer_agentur_strasse" name="influencer_agentur_strasse"
                     value="${escapeAttr(f.influencer_agentur_strasse || '')}" readonly disabled class="readonly-field">
            </div>
            <div class="form-field" style="flex: 0 0 100px;">
              <label for="influencer_agentur_hausnummer">Nr.</label>
              <input type="text" id="influencer_agentur_hausnummer" name="influencer_agentur_hausnummer"
                     value="${escapeAttr(f.influencer_agentur_hausnummer || '')}" readonly disabled class="readonly-field">
            </div>
          </div>
          <div class="form-field-row">
            <div class="form-field" style="flex: 0 0 120px;">
              <label for="influencer_agentur_plz">PLZ</label>
              <input type="text" id="influencer_agentur_plz" name="influencer_agentur_plz"
                     value="${escapeAttr(f.influencer_agentur_plz || '')}" readonly disabled class="readonly-field">
            </div>
            <div class="form-field" style="flex: 1;">
              <label for="influencer_agentur_stadt">Stadt</label>
              <input type="text" id="influencer_agentur_stadt" name="influencer_agentur_stadt"
                     value="${escapeAttr(f.influencer_agentur_stadt || '')}" readonly disabled class="readonly-field">
            </div>
          </div>
          <div class="form-field">
            <label for="influencer_agentur_land">Land</label>
            <input type="text" id="influencer_agentur_land" name="influencer_agentur_land"
                   value="${escapeAttr(f.influencer_agentur_land || 'Deutschland')}" readonly disabled class="readonly-field">
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
    // Toggle fuer #agentur-felder je nach Radio-Auswahl (nur bei manueller Eingabe relevant)
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

    // Mehrfach-Management: Dropdown wechselt das gewaehlte Management
    const mgmtSelect = document.getElementById('vertrag_management_select');
    if (mgmtSelect) {
      mgmtSelect.addEventListener('change', (e) => {
        this.selectVertragManagement(e.target.value);
      });
    }

    // Schalter "Nur Management-Adresse verwenden"
    const nurMgmt = document.getElementById('nur_management_adresse');
    if (nurMgmt) {
      nurMgmt.addEventListener('change', (e) => {
        this.formData.nur_management_adresse = !!e.target.checked;
        const creator = this.creators.find(c => c.id === this.formData.creator_id);
        if (creator) this.updateCreatorAddressPreview(creator);
      });
    }

    // Management-Link ist ein <a>-Tag mit onclick, kein JS-Handler noetig
};
