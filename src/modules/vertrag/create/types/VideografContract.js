// types/VideografContract.js
// Videografen- & Fotografen-Produktionsvertrag: Steps 2-5 + Produktionsplan-Helper.

import { VertraegeCreate } from '../VertraegeCreateCore.js';
VertraegeCreate.prototype.renderVideografStep2 = function() {
    if (!this._filtersInitialized) {
      this.updateFilteredKampagnen();
    }
    
    return `
      <div class="step-section">
        <h3>Vertragsparteien</h3>
        <p class="step-description">Vertragstyp: <strong>Videografen- & Fotografen-Produktionsvertrag</strong></p>
        
        <!-- Kunde (Unternehmen) -->
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

        <div class="form-field">
          <label for="kunde_rechtsform">Rechtsform <span class="required">*</span></label>
          <input type="text" id="kunde_rechtsform" name="kunde_rechtsform" 
                 placeholder="z.B. GmbH, AG, UG..."
                 value="${this.formData.kunde_rechtsform || ''}" required>
        </div>

        <!-- Kampagne -->
        <div class="form-field">
          <label for="kampagne_id">Kampagne <span class="required">*</span></label>
          <select id="kampagne_id" name="kampagne_id" required ${!this.formData.kunde_unternehmen_id ? 'disabled' : ''} data-searchable="true">
            <option value="">${this.formData.kunde_unternehmen_id ? 'Kampagne auswählen...' : 'Bitte zuerst Kunde wählen...'}</option>
            ${this.filteredKampagnen.map(k => `
              <option value="${k.id}" ${this.formData.kampagne_id === k.id ? 'selected' : ''}>
                ${this.getKampagneDisplayName(k)}
              </option>
            `).join('')}
          </select>
        </div>

        <h3 class="mt-section">Auftragnehmer (Videograf / Fotograf)</h3>

        <!-- Auftragnehmer (Creator) -->
        <div class="form-field">
          <label for="creator_id">Videograf/Fotograf <span class="required">*</span></label>
          <select id="creator_id" name="creator_id" required ${!this.formData.kampagne_id ? 'disabled' : ''} data-searchable="true">
            <option value="">${this.formData.kampagne_id ? 'Auftragnehmer auswählen...' : 'Bitte zuerst Kampagne wählen...'}</option>
            ${this.filteredCreators.map(c => `
              <option value="${c.id}" ${this.formData.creator_id === c.id ? 'selected' : ''}>
                ${c.vorname} ${c.nachname}
              </option>
            `).join('')}
          </select>
          <div id="creator-adresse" class="address-preview"></div>
        </div>

        ${this.renderKooperationSelect()}

        <div class="form-two-col">
          <div class="form-field">
            <label for="influencer_steuer_id">Steuer-ID / USt-ID</label>
            <input type="text" id="influencer_steuer_id" name="influencer_steuer_id" 
                   placeholder="z.B. DE123456789"
                   value="${this.formData.influencer_steuer_id || ''}">
          </div>
          <div class="form-field">
            <label for="influencer_land">Land</label>
            <select id="influencer_land" name="influencer_land">
              <option value="Deutschland" ${this.formData.influencer_land === 'Deutschland' || !this.formData.influencer_land ? 'selected' : ''}>Deutschland</option>
              <option value="Österreich" ${this.formData.influencer_land === 'Österreich' ? 'selected' : ''}>Österreich</option>
              <option value="Schweiz" ${this.formData.influencer_land === 'Schweiz' ? 'selected' : ''}>Schweiz</option>
              <option value="Andere" ${this.formData.influencer_land === 'Andere' ? 'selected' : ''}>Andere</option>
            </select>
          </div>
        </div>
      </div>
    `;
};

VertraegeCreate.prototype.renderVideografStep3 = function() {
    return `
      <div class="step-section">
        <h3>§2 Leistungsumfang</h3>
        
        <h4>2.1 Art der Leistung</h4>
        <div class="form-field">
          <label>Was wird produziert? <span class="required">*</span></label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="video" 
                     ${this.formData.content_erstellung_art === 'video' ? 'checked' : ''} required>
              <span>Video</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="foto" 
                     ${this.formData.content_erstellung_art === 'foto' ? 'checked' : ''}>
              <span>Foto</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="content_erstellung_art" value="video_foto" 
                     ${this.formData.content_erstellung_art === 'video_foto' ? 'checked' : ''}>
              <span>Video & Foto</span>
            </label>
          </div>
        </div>

        <div class="form-two-col">
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
        </div>

        <h4 class="mt-subsection">2.2 Produktionsart</h4>
        <div class="form-field">
          <label>Wie wird produziert? <span class="required">*</span></label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="videograf_produktionsart" value="briefing" 
                     ${this.formData.videograf_produktionsart === 'briefing' ? 'checked' : ''} required>
              <span>Produktion nach Briefing</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="videograf_produktionsart" value="skript_shotlist" 
                     ${this.formData.videograf_produktionsart === 'skript_shotlist' ? 'checked' : ''}>
              <span>Produktion nach Skript / Shotlist</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="videograf_produktionsart" value="eigenstaendig" 
                     ${this.formData.videograf_produktionsart === 'eigenstaendig' ? 'checked' : ''}>
              <span>Eigenständige Umsetzung nach Zielvorgabe</span>
            </label>
          </div>
        </div>

        <h4 class="mt-subsection">2.3 Drehtage & Produktionsorte</h4>
        <p class="form-hint">Fügen Sie für jeden Drehtag das Datum und den Produktionsort hinzu.</p>
        
        <div id="videograf-produktionsplan-container">
          ${this.renderProduktionsplanRows()}
        </div>
        
        <button type="button" class="mdc-btn mdc-btn--secondary mt-xs" id="btn-add-drehtag">
          
          Drehtag hinzufügen
        </button>

        <p class="form-hint mt-sm">Der Auftragnehmer verpflichtet sich, zum vereinbarten Zeitpunkt vollständig einsatzbereit zu erscheinen und die Produktion fachgerecht durchzuführen.</p>
      </div>
    `;
};

VertraegeCreate.prototype.renderProduktionsplanRows = function() {
    const produktionsplan = this.formData.videograf_produktionsplan || [{ datum: '', ort: '' }];
    
    // Falls leer, mindestens eine Row
    if (produktionsplan.length === 0) {
      produktionsplan.push({ datum: '', ort: '' });
    }
    
    return produktionsplan.map((item, index) => `
      <div class="produktionsplan-row" data-index="${index}">
        <div class="form-field form-field--date">
          <label for="drehtag_datum_${index}">${index === 0 ? 'Drehtag <span class="required">*</span>' : `Drehtag ${index + 1}`}</label>
          <input type="date" id="drehtag_datum_${index}" name="drehtag_datum_${index}" 
                 value="${item.datum || ''}" ${index === 0 ? 'required' : ''}>
        </div>
        <div class="form-field form-field--ort">
          <label for="drehtag_ort_${index}">${index === 0 ? 'Produktionsort <span class="required">*</span>' : 'Produktionsort'}</label>
          <input type="text" id="drehtag_ort_${index}" name="drehtag_ort_${index}" 
                 placeholder="z.B. Frankfurt am Main, Studio ABC"
                 value="${item.ort || ''}" ${index === 0 ? 'required' : ''}>
        </div>
        ${index > 0 ? `
          <button type="button" class="mdc-btn mdc-btn--cancel" data-index="${index}" title="Entfernen">
            Entfernen
          </button>
        ` : ''}
      </div>
    `).join('');
};

VertraegeCreate.prototype.renderVideografStep4 = function() {
    const lieferumfang = this.formData.videograf_lieferumfang || [];
    
    return `
      <div class="step-section">
        <h3>§3 Output, Abgabe & Versionierung</h3>
        
        <h4>3.1 Lieferumfang</h4>
        <div class="form-field">
          <label>Was wird geliefert?</label>
          <div class="checkbox-group checkbox-group-multi">
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_lieferumfang" value="fertig_geschnitten"
                     ${lieferumfang.includes('fertig_geschnitten') ? 'checked' : ''}>
              <span>Fertig geschnittenes Video</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_lieferumfang" value="farbkorrektur"
                     ${lieferumfang.includes('farbkorrektur') ? 'checked' : ''}>
              <span>Farbkorrektur / Grading enthalten</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_lieferumfang" value="sounddesign"
                     ${lieferumfang.includes('sounddesign') ? 'checked' : ''}>
              <span>Sounddesign enthalten</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_lieferumfang" value="rohmaterial"
                     ${lieferumfang.includes('rohmaterial') ? 'checked' : ''}>
              <span>Rohmaterial (alle Clips)</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_lieferumfang" value="projektdateien"
                     ${lieferumfang.includes('projektdateien') ? 'checked' : ''}>
              <span>Projektdateien (z.B. Premiere / Final Cut)</span>
            </label>
          </div>
        </div>

        <h4 class="mt-subsection">3.2 Abgabe der ersten Version (V1)</h4>
        <div class="form-field">
          <label for="videograf_v1_deadline">V1 Deadline <span class="required">*</span></label>
          <input type="date" id="videograf_v1_deadline" name="videograf_v1_deadline" 
                 value="${this.formData.videograf_v1_deadline || ''}" required>
          <p class="form-hint">Die erste inhaltliche Version (Preview / V1) ist spätestens bis zu diesem Datum digital zur Verfügung zu stellen.</p>
        </div>

        <h4 class="mt-subsection">3.3 Korrekturschleifen</h4>
        <div class="form-field">
          <label>Anzahl Korrekturschleifen <span class="required">*</span></label>
          <div class="radio-group radio-group-inline">
            <label class="radio-option">
              <input type="radio" name="korrekturschleifen" value="1" 
                     ${this.formData.korrekturschleifen == 1 ? 'checked' : ''} required>
              <span>1 Korrekturschleife</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="korrekturschleifen" value="2" 
                     ${this.formData.korrekturschleifen == 2 ? 'checked' : ''}>
              <span>2 Korrekturschleifen</span>
            </label>
          </div>
          <p class="form-hint">Eine Korrekturschleife umfasst jeweils eine überarbeitete Version nach Feedback.</p>
        </div>

        <h4 class="mt-subsection">3.4 Abgabe der finalen Version</h4>
        <div class="form-field">
          <label for="videograf_finale_werktage">Werktage nach letzter Korrektur <span class="required">*</span></label>
          <div class="input-with-suffix">
            <input type="number" id="videograf_finale_werktage" name="videograf_finale_werktage" 
                   min="1" max="30" 
                   value="${this.formData.videograf_finale_werktage || 5}" required>
            <span class="input-suffix">Werktage</span>
          </div>
          <p class="form-hint">Die finale Version ist spätestens X Werktage nach Abschluss der letzten Korrekturschleife bereitzustellen.</p>
        </div>
      </div>
    `;
};

VertraegeCreate.prototype.renderVideografStep5 = function() {
    const nutzungsart = this.formData.videograf_nutzungsart || [];
    
    return `
      <div class="step-section">
        <h3>§7 Nutzungsrechte</h3>
        <p class="form-hint">Der Auftragnehmer überträgt dem Auftraggeber ausschließliche, zeitlich und räumlich unbegrenzte Nutzungsrechte an sämtlichen erstellten Inhalten.</p>
        
        <div class="form-field">
          <label>Nutzungsart <span class="required">*</span></label>
          <div class="checkbox-group checkbox-group-multi">
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_nutzungsart" value="organisch"
                     ${nutzungsart.includes('organisch') ? 'checked' : ''}>
              <span>Organische Nutzung</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_nutzungsart" value="paid_ads"
                     ${nutzungsart.includes('paid_ads') ? 'checked' : ''}>
              <span>Paid Ads</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="videograf_nutzungsart" value="alle_medien"
                     ${nutzungsart.includes('alle_medien') ? 'checked' : ''}>
              <span>Alle Medien (Social Media, Website, OTV, Print)</span>
            </label>
          </div>
        </div>

        <p class="form-hint">Eine Urheberbenennung ist nicht erforderlich, sofern nicht ausdrücklich vereinbart.</p>

        <h3 class="mt-section">§9 Vergütung</h3>
        
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
            <div class="radio-group radio-group-inline">
              <label class="radio-option">
                <input type="radio" name="zahlungsziel" value="14_tage" 
                       ${this.formData.zahlungsziel === '14_tage' ? 'checked' : ''}>
                <span>14 Tage</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="zahlungsziel" value="30_tage" 
                       ${this.formData.zahlungsziel === '30_tage' ? 'checked' : ''}>
                <span>30 Tage</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="zahlungsziel" value="45_tage" 
                       ${this.formData.zahlungsziel === '45_tage' ? 'checked' : ''}>
                <span>45 Tage</span>
              </label>
            </div>
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" id="zusatzkosten" name="zusatzkosten" value="true"
                     ${this.formData.zusatzkosten ? 'checked' : ''}>
              <span>Zusatzkosten vereinbart (z.B. Reisekosten, Requisiten)</span>
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
          <label>Skonto</label>
          <div class="radio-group radio-group-inline">
            <label class="radio-option">
              <input type="radio" name="skonto" value="true" 
                     ${this.formData.skonto ? 'checked' : ''}>
              <span>Ja (3% bei Zahlung innerhalb 7 Tage)</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="skonto" value="false" 
                     ${!this.formData.skonto ? 'checked' : ''}>
              <span>Nein</span>
            </label>
          </div>
        </div>

        <p class="form-hint">Die Zahlung erfolgt durch die LikeGroup GmbH im Auftrag des Kunden. Die Rechnungsstellung erfolgt nach finaler Abnahme.</p>

        <h3 class="mt-section">Weitere Bestimmungen</h3>
        <div class="form-field">
          <label for="weitere_bestimmungen">Zusätzliche Vereinbarungen (optional)</label>
          <textarea id="weitere_bestimmungen" name="weitere_bestimmungen" rows="4"
                    placeholder="z.B. besondere Vereinbarungen, Sonderkonditionen...">${this.formData.weitere_bestimmungen || ''}</textarea>
        </div>
      </div>
    `;
};
