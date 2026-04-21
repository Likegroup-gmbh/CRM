// types/UgcContract.js
// UGC-Produktionsvertrag: Steps 2-5.

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { KampagneUtils } from '../../../kampagne/KampagneUtils.js';

VertraegeCreate.prototype.renderStep2 = function() {
    // Filter nur initialisieren wenn noch nicht geschehen (z.B. bei Draft-Load bereits erledigt)
    if (!this._filtersInitialized) {
      this.updateFilteredKampagnen();
      // updateFilteredCreators ist async, aber hier brauchen wir es synchron für den Render
      // Bei neuem Vertrag ist filteredCreators sowieso leer
    }
    
    return `
      <div class="step-section">
        <h3>Vertragsparteien</h3>
        <p class="step-description">Vertragstyp: <strong>${this.selectedTyp}</strong></p>
        
        <!-- Kunde -->
        <div class="form-field">
          <label for="kunde_unternehmen_id">Kunde (Unternehmen) <span class="required">*</span></label>
          <select id="kunde_unternehmen_id" name="kunde_unternehmen_id" required data-searchable="true">
            <option value="">Unternehmen auswählen...</option>
            ${this.unternehmen.map(u => `
              <option value="${u.id}" ${this.formData.kunde_unternehmen_id === u.id ? 'selected' : ''}>
                ${u.firmenname}
              </option>
            `).join('')}
          </select>
          <div id="kunde-adresse" class="address-preview"></div>
        </div>

        <!-- Kampagne (abhängig von Kunde) -->
        <div class="form-field">
          <label for="kampagne_id">Kampagne <span class="required">*</span></label>
          <select id="kampagne_id" name="kampagne_id" required ${!this.formData.kunde_unternehmen_id ? 'disabled' : ''}>
            <option value="">${this.formData.kunde_unternehmen_id ? 'Kampagne auswählen...' : 'Bitte zuerst Kunde wählen...'}</option>
            ${this.filteredKampagnen.map(k => `
              <option value="${k.id}" ${this.formData.kampagne_id === k.id ? 'selected' : ''}>
                ${KampagneUtils.getDisplayName(k)}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Creator (abhängig von Kampagne, optional) -->
        <div class="form-field">
          <label for="creator_id">Creator</label>
          <select id="creator_id" name="creator_id" ${!this.formData.kampagne_id ? 'disabled' : ''} data-searchable="true">
            <option value="">${this.formData.kampagne_id ? 'Creator auswählen (optional)...' : 'Bitte zuerst Kampagne wählen...'}</option>
            ${this.filteredCreators.map(c => `
              <option value="${c.id}" ${this.formData.creator_id === c.id ? 'selected' : ''}>
                ${c.vorname} ${c.nachname}
              </option>
            `).join('')}
          </select>
          <div id="creator-adresse" class="address-preview"></div>
        </div>

        ${this.renderKooperationSelect()}

        ${this.renderAgenturSection()}

        <div class="form-field">
          <label for="name">Vertragsname (automatisch generiert)</label>
          <input type="text" id="name" name="name" readonly 
                 value="${this.formData.name || ''}"
                 placeholder="Wird automatisch generiert..." class="readonly-field">
        </div>
      </div>
    `;
};

VertraegeCreate.prototype.renderStep3 = function() {
    return `
      <div class="step-section">
        <h3>§2 Leistungsumfang</h3>
        
        <div class="form-three-col">
          <div class="form-field">
            <label for="anzahl_videos">Anzahl Videos</label>
            <input type="number" id="anzahl_videos" name="anzahl_videos" min="0" 
                   value="${this.formData.anzahl_videos || 0}">
          </div>
          <div class="form-field">
            <label for="anzahl_fotos">Anzahl Fotos</label>
            <input type="number" id="anzahl_fotos" name="anzahl_fotos" min="0" 
                   value="${this.formData.anzahl_fotos || 0}">
          </div>
          <div class="form-field">
            <label for="anzahl_storys">Anzahl Storys</label>
            <input type="number" id="anzahl_storys" name="anzahl_storys" min="0" 
                   value="${this.formData.anzahl_storys || 0}">
          </div>
        </div>

        <div class="form-field">
          <label>Art der Content-Erstellung</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="skript_fertig" 
                     ${this.formData.content_erstellung_art === 'skript_fertig' ? 'checked' : ''}>
              <span>Fertiges Skript vom Auftraggeber</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="briefing_direkt" 
                     ${this.formData.content_erstellung_art === 'briefing_direkt' ? 'checked' : ''}>
              <span>Briefing vom Auftraggeber, direkter Dreh ohne Skript</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="briefing_skript" 
                     ${this.formData.content_erstellung_art === 'briefing_skript' ? 'checked' : ''}>
              <span>Briefing vom Auftraggeber, Skript durch Creator</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="eigenstaendig" 
                     ${this.formData.content_erstellung_art === 'eigenstaendig' ? 'checked' : ''}>
              <span>Eigenständige Konzeption durch Creator</span>
            </label>
          </div>
        </div>

        <h3>§3 Output & Lieferumfang</h3>
        
        <div class="form-field">
          <label>Art der Lieferung</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="lieferung_art" value="fertig_geschnitten" 
                     ${this.formData.lieferung_art === 'fertig_geschnitten' ? 'checked' : ''}>
              <span>Fertig geschnittenes Video</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="lieferung_art" value="raw_cut" 
                     ${this.formData.lieferung_art === 'raw_cut' ? 'checked' : ''}>
              <span>Raw Cut (Szenen aneinandergeschnitten, ohne Feinschnitt)</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="lieferung_art" value="rohmaterial" 
                     ${this.formData.lieferung_art === 'rohmaterial' ? 'checked' : ''}>
              <span>Rohmaterial (ungeschnittene Clips)</span>
            </label>
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" name="rohmaterial_enthalten" value="true"
                     ${this.formData.rohmaterial_enthalten ? 'checked' : ''}>
              <span>Rohmaterial enthalten</span>
            </label>
          </div>
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" name="untertitel" value="true"
                     ${this.formData.untertitel ? 'checked' : ''}>
              <span>Untertitel</span>
            </label>
          </div>
        </div>
      </div>
    `;
};

VertraegeCreate.prototype.renderStep4 = function() {
    return `
      <div class="step-section">
        <h3>§4 Nutzungsrechte</h3>
        
        <div class="form-field">
          <label>Nutzungsart</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="nutzungsart" value="organisch" 
                     ${this.formData.nutzungsart === 'organisch' ? 'checked' : ''}>
              <span>Organische Nutzung</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsart" value="paid" 
                     ${this.formData.nutzungsart === 'paid' ? 'checked' : ''}>
              <span>Paid Ads Nutzung</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsart" value="beides" 
                     ${this.formData.nutzungsart === 'beides' ? 'checked' : ''}>
              <span>Organisch & Paid Ads</span>
            </label>
          </div>
        </div>

        <div class="form-field">
          <label>Medien</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" name="medien" value="social_media"
                     ${(this.formData.medien || []).includes('social_media') ? 'checked' : ''}>
              <span>Social Media</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="medien" value="website"
                     ${(this.formData.medien || []).includes('website') ? 'checked' : ''}>
              <span>Website</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="medien" value="otv"
                     ${(this.formData.medien || []).includes('otv') ? 'checked' : ''}>
              <span>OTV</span>
            </label>
          </div>
        </div>

        <div class="form-field">
          <label for="nutzungsdauer">Nutzungsdauer</label>
          <select id="nutzungsdauer" name="nutzungsdauer">
            <option value="">Bitte wählen...</option>
            <option value="unbegrenzt" ${this.formData.nutzungsdauer === 'unbegrenzt' ? 'selected' : ''}>Unbegrenzt</option>
            <option value="12_monate" ${this.formData.nutzungsdauer === '12_monate' ? 'selected' : ''}>12 Monate</option>
            <option value="6_monate" ${this.formData.nutzungsdauer === '6_monate' ? 'selected' : ''}>6 Monate</option>
            <option value="3_monate" ${this.formData.nutzungsdauer === '3_monate' ? 'selected' : ''}>3 Monate</option>
            <option value="individuell" ${this.formData.nutzungsdauer === 'individuell' ? 'selected' : ''}>Individuell</option>
          </select>
        </div>
        <div class="form-field ${this.formData.nutzungsdauer === 'individuell' ? '' : 'hidden'}" id="nutzungsdauer-custom-wrapper">
          <label for="nutzungsdauer_custom_wert">Nutzungsdauer individuell</label>
          <div class="input-with-select">
            <input type="number" id="nutzungsdauer_custom_wert" name="nutzungsdauer_custom_wert" min="1" max="99"
                   value="${this.formData.nutzungsdauer_custom_wert ?? ''}" placeholder="Anzahl">
            <select id="nutzungsdauer_custom_einheit" name="nutzungsdauer_custom_einheit">
              <option value="jahre" ${this.formData.nutzungsdauer_custom_einheit === 'jahre' ? 'selected' : ''}>Jahre</option>
              <option value="monate" ${!this.formData.nutzungsdauer_custom_einheit || this.formData.nutzungsdauer_custom_einheit === 'monate' ? 'selected' : ''}>Monate</option>
            </select>
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" id="exklusivitaet" name="exklusivitaet" value="true"
                     ${this.formData.exklusivitaet ? 'checked' : ''}>
              <span>Exklusivität</span>
            </label>
          </div>
          <div class="form-field ${this.formData.exklusivitaet ? '' : 'hidden'}" id="exklusivitaet-monate-wrapper">
            <label for="exklusivitaet_monate">Exklusivität Zeitraum</label>
            <div class="input-with-select">
              <input type="number" id="exklusivitaet_monate" name="exklusivitaet_monate" min="1" max="365"
                     value="${this.formData.exklusivitaet_monate || ''}" placeholder="Anzahl">
              <select id="exklusivitaet_einheit" name="exklusivitaet_einheit">
                <option value="monate" ${!this.formData.exklusivitaet_einheit || this.formData.exklusivitaet_einheit === 'monate' ? 'selected' : ''}>Monate</option>
                <option value="wochen" ${this.formData.exklusivitaet_einheit === 'wochen' ? 'selected' : ''}>Wochen</option>
                <option value="tage" ${this.formData.exklusivitaet_einheit === 'tage' ? 'selected' : ''}>Tage</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    `;
};

VertraegeCreate.prototype.renderStep5 = function() {
    return `
      <div class="step-section">
        <h3>§5 Vergütung</h3>
        
        <div class="form-two-col">
          <div class="form-field">
            <label for="verguetung_netto">Fixvergütung (netto) <span class="required">*</span></label>
            <div class="input-with-suffix">
              <input type="number" id="verguetung_netto" name="verguetung_netto" 
                     step="0.01" min="0" required
                     value="${this.formData.verguetung_netto || ''}">
              <span class="input-suffix">€</span>
            </div>
          </div>
          <div class="form-field">
            <label for="zahlungsziel">Zahlungsziel</label>
            <select id="zahlungsziel" name="zahlungsziel">
              <option value="">Bitte wählen...</option>
              <option value="30_tage" ${this.formData.zahlungsziel === '30_tage' ? 'selected' : ''}>30 Tage</option>
              <option value="60_tage" ${this.formData.zahlungsziel === '60_tage' ? 'selected' : ''}>60 Tage</option>
            </select>
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" id="zusatzkosten" name="zusatzkosten" value="true"
                     ${this.formData.zusatzkosten ? 'checked' : ''}>
              <span>Zusatzkosten vereinbart</span>
            </label>
          </div>
          <div class="form-field ${this.formData.zusatzkosten ? '' : 'hidden'}" id="zusatzkosten-wrapper">
            <label for="zusatzkosten_betrag">Zusatzkosten (netto)</label>
            <div class="input-with-suffix">
              <input type="number" id="zusatzkosten_betrag" name="zusatzkosten_betrag" 
                     step="0.01" min="0"
                     value="${this.formData.zusatzkosten_betrag || ''}">
              <span class="input-suffix">€</span>
            </div>
          </div>
        </div>

        <div class="form-field">
          <label class="checkbox-label">
            <input type="checkbox" name="skonto" value="true"
                   ${this.formData.skonto ? 'checked' : ''}>
            <span>Skonto (3% bei Zahlung innerhalb von 7 Tagen)</span>
          </label>
        </div>

        <h3>§6 Deadlines & Korrekturen</h3>
        
        <div class="form-three-col">
          <div class="form-field">
            <label for="content_deadline">Content-Deadline</label>
            <input type="date" id="content_deadline" name="content_deadline"
                   value="${this.formData.content_deadline || ''}">
          </div>
          <div class="form-field">
            <label for="korrekturschleifen">Korrekturschleifen</label>
            <select id="korrekturschleifen" name="korrekturschleifen">
              <option value="">Bitte wählen...</option>
              <option value="1" ${this.formData.korrekturschleifen === 1 ? 'selected' : ''}>1</option>
              <option value="2" ${this.formData.korrekturschleifen === 2 ? 'selected' : ''}>2</option>
            </select>
          </div>
          <div class="form-field">
            <label for="abnahmedatum">Abnahmedatum</label>
            <input type="date" id="abnahmedatum" name="abnahmedatum"
                   value="${this.formData.abnahmedatum || ''}">
          </div>
        </div>

        <h3>Weitere Bestimmungen</h3>
        <div class="form-field">
          <label for="weitere_bestimmungen">Zusätzliche Vereinbarungen (optional)</label>
          <textarea id="weitere_bestimmungen" name="weitere_bestimmungen" rows="4"
                    placeholder="z.B. besondere Vereinbarungen, Sonderkonditionen...">${this.formData.weitere_bestimmungen || ''}</textarea>
        </div>
      </div>
    `;
};
