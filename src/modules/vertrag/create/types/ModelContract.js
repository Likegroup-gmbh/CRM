// types/ModelContract.js
// Modelvertrag: Steps 2-5.

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { KampagneUtils } from '../../../kampagne/KampagneUtils.js';

VertraegeCreate.prototype.renderModelStep2 = function() {
    if (!this._filtersInitialized) {
      this.updateFilteredKampagnen();
    }

    return `
      <div class="step-section">
        <h3>Vertragsparteien</h3>
        <p class="step-description">Vertragstyp: <strong>Modelvertrag</strong></p>

        <!-- Auftraggeber (Unternehmen) -->
        <div class="form-field">
          <label for="kunde_unternehmen_id">Auftraggeber (Unternehmen) <span class="required">*</span></label>
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

        <!-- Kampagne -->
        <div class="form-field">
          <label for="kampagne_id">Kampagne <span class="required">*</span></label>
          <select id="kampagne_id" name="kampagne_id" required ${!this.formData.kunde_unternehmen_id ? 'disabled' : ''} data-searchable="true">
            <option value="">${this.formData.kunde_unternehmen_id ? 'Kampagne auswählen...' : 'Bitte zuerst Kunde wählen...'}</option>
            ${this.filteredKampagnen.map(k => `
              <option value="${k.id}" ${this.formData.kampagne_id === k.id ? 'selected' : ''}>
                ${KampagneUtils.getDisplayName(k)}
              </option>
            `).join('')}
          </select>
        </div>

        <h3 class="mt-section">Model</h3>

        <!-- Model (Creator) -->
        <div class="form-field">
          <label for="creator_id">Model <span class="required">*</span></label>
          <select id="creator_id" name="creator_id" required ${!this.formData.kampagne_id ? 'disabled' : ''} data-searchable="true">
            <option value="">${this.formData.kampagne_id ? 'Model auswählen...' : 'Bitte zuerst Kampagne wählen...'}</option>
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

        <!-- PO / Auftragsnummer -->
        <div class="form-field">
          <label for="kunde_po_nummer">PO / Auftragsnummer</label>
          <select id="kunde_po_nummer" name="kunde_po_nummer" data-searchable="true">
            <option value="">Keine PO-Nummer</option>
            ${this.kundeAuftraegePo.map(po => `
              <option value="${po}" ${this.formData.kunde_po_nummer === po ? 'selected' : ''}>
                ${po}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Vertragsname -->
        <div class="form-field">
          <label for="name">Vertragsname</label>
          <input type="text" id="name" name="name" 
                 placeholder="Wird automatisch generiert"
                 value="${this.formData.name || ''}">
          <p class="form-hint">Leer lassen für automatische Benennung.</p>
        </div>
      </div>
    `;
};

VertraegeCreate.prototype.renderModelStep3 = function() {
    const einsatzortArt = this.formData.model_einsatzort_art || [];
    const rolle = this.formData.model_rolle || [];

    return `
      <div class="step-section">
        <h3>§2 Produktion & Einsatz</h3>

        <h4>2.1 Produktionsart</h4>
        <div class="form-field">
          <label>Was wird produziert? <span class="required">*</span></label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="model_produktionsart" value="foto"
                     ${this.formData.model_produktionsart === 'foto' ? 'checked' : ''} required>
              <span>Fotoshooting</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_produktionsart" value="video"
                     ${this.formData.model_produktionsart === 'video' ? 'checked' : ''}>
              <span>Videoshooting</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_produktionsart" value="kombiniert"
                     ${this.formData.model_produktionsart === 'kombiniert' ? 'checked' : ''}>
              <span>Kombiniert (Foto & Video)</span>
            </label>
          </div>
        </div>

        <h4 class="mt-subsection">2.2 Produktionszeitraum</h4>
        <div class="form-two-col">
          <div class="form-field">
            <label for="model_shooting_von">Shooting von <span class="required">*</span></label>
            <input type="date" id="model_shooting_von" name="model_shooting_von"
                   value="${this.formData.model_shooting_von || ''}" required>
          </div>
          <div class="form-field">
            <label for="model_shooting_bis">Shooting bis <span class="required">*</span></label>
            <input type="date" id="model_shooting_bis" name="model_shooting_bis"
                   value="${this.formData.model_shooting_bis || ''}" required>
          </div>
        </div>

        <h4 class="mt-subsection">2.3 Tagesstruktur</h4>
        <div class="form-two-col">
          <div class="form-field">
            <label for="model_call_time">Call Time (Ankunft)</label>
            <input type="time" id="model_call_time" name="model_call_time"
                   value="${this.formData.model_call_time || ''}">
          </div>
          <div class="form-field">
            <label for="model_drehbeginn">Geplanter Drehbeginn</label>
            <input type="time" id="model_drehbeginn" name="model_drehbeginn"
                   value="${this.formData.model_drehbeginn || ''}">
          </div>
        </div>
        <div class="form-two-col">
          <div class="form-field">
            <label for="model_produktionsende">Geplantes Produktionsende</label>
            <input type="time" id="model_produktionsende" name="model_produktionsende"
                   value="${this.formData.model_produktionsende || ''}">
          </div>
          <div class="form-field">
            <label for="model_max_tagesstunden">Max. tägliche Einsatzdauer (Stunden)</label>
            <input type="number" id="model_max_tagesstunden" name="model_max_tagesstunden"
                   min="1" max="24" step="0.5"
                   value="${this.formData.model_max_tagesstunden || ''}">
          </div>
        </div>

        <h4 class="mt-subsection">2.4 Einsatzort</h4>
        <div class="form-field">
          <label>Art des Einsatzortes</label>
          <div class="checkbox-group checkbox-group-multi">
            <label class="checkbox-label">
              <input type="checkbox" name="model_einsatzort_art" value="studio"
                     ${einsatzortArt.includes('studio') ? 'checked' : ''}>
              <span>Studio</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_einsatzort_art" value="outdoor"
                     ${einsatzortArt.includes('outdoor') ? 'checked' : ''}>
              <span>Outdoor</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_einsatzort_art" value="on_location"
                     ${einsatzortArt.includes('on_location') ? 'checked' : ''}>
              <span>On-Location</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_einsatzort_art" value="ausland"
                     ${einsatzortArt.includes('ausland') ? 'checked' : ''}>
              <span>Ausland</span>
            </label>
          </div>
        </div>
        <div class="form-field">
          <label for="model_einsatzort_adresse">Adresse / genauer Ort</label>
          <input type="text" id="model_einsatzort_adresse" name="model_einsatzort_adresse"
                 placeholder="z.B. Studio XY, Musterstraße 1, 60314 Frankfurt"
                 value="${this.formData.model_einsatzort_adresse || ''}">
        </div>

        <h4 class="mt-subsection">2.5 Optionstage</h4>
        <div class="form-field">
          <label for="model_optionstage">Optionstage (optional)</label>
          <input type="text" id="model_optionstage" name="model_optionstage"
                 placeholder="z.B. 15.04.2026 – 16.04.2026 oder 'Keine'"
                 value="${this.formData.model_optionstage || ''}">
          <p class="form-hint">Die Buchung eines Optionstages bedarf der rechtzeitigen Bestätigung durch den Auftraggeber.</p>
        </div>

        <h3 class="mt-section">§3 Produktionsrahmen</h3>

        <h4>3.1 Geplanter Output</h4>
        <div class="form-two-col">
          <div class="form-field">
            <label for="model_anzahl_foto_motive">Anzahl Foto-Motive (ca.)</label>
            <input type="number" id="model_anzahl_foto_motive" name="model_anzahl_foto_motive"
                   min="0" value="${this.formData.model_anzahl_foto_motive || 0}">
          </div>
          <div class="form-field">
            <label for="model_anzahl_video_sequenzen">Anzahl Video-Sequenzen (ca.)</label>
            <input type="number" id="model_anzahl_video_sequenzen" name="model_anzahl_video_sequenzen"
                   min="0" value="${this.formData.model_anzahl_video_sequenzen || 0}">
          </div>
        </div>
        <p class="form-hint">Die tatsächliche Anzahl der finalen Assets liegt im Ermessen des Auftraggebers.</p>

        <h4 class="mt-subsection">3.2 Rolle des Models</h4>
        <div class="form-field">
          <label>Rolle <span class="required">*</span></label>
          <div class="checkbox-group checkbox-group-multi">
            <label class="checkbox-label">
              <input type="checkbox" name="model_rolle" value="posing"
                     ${rolle.includes('posing') ? 'checked' : ''}>
              <span>Reines Posing</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_rolle" value="acting"
                     ${rolle.includes('acting') ? 'checked' : ''}>
              <span>Acting / Performance</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_rolle" value="sprechrolle"
                     ${rolle.includes('sprechrolle') ? 'checked' : ''}>
              <span>Mit Sprechrolle</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_rolle" value="moderation"
                     ${rolle.includes('moderation') ? 'checked' : ''}>
              <span>Moderation</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_rolle" value="sport"
                     ${rolle.includes('sport') ? 'checked' : ''}>
              <span>Sportliche Performance</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_rolle" value="sonstiges"
                     ${rolle.includes('sonstiges') ? 'checked' : ''}>
              <span>Sonstiges</span>
            </label>
          </div>
        </div>
        <div class="form-field ${rolle.includes('sonstiges') ? '' : 'hidden'}" id="model-rolle-sonstiges-wrapper">
          <label for="model_rolle_sonstiges">Sonstiges (Beschreibung)</label>
          <input type="text" id="model_rolle_sonstiges" name="model_rolle_sonstiges"
                 value="${this.formData.model_rolle_sonstiges || ''}">
        </div>

        <h4 class="mt-subsection">3.3 Styling</h4>
        <div class="form-field">
          <label>Styling <span class="required">*</span></label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="model_styling" value="auftraggeber"
                     ${this.formData.model_styling === 'auftraggeber' ? 'checked' : ''} required>
              <span>Styling wird vom Auftraggeber gestellt</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_styling" value="eigene"
                     ${this.formData.model_styling === 'eigene' ? 'checked' : ''}>
              <span>Model bringt eigene Outfits mit</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_styling" value="fitting"
                     ${this.formData.model_styling === 'fitting' ? 'checked' : ''}>
              <span>Fitting-Termin vereinbart</span>
            </label>
          </div>
        </div>
        <div class="form-field ${this.formData.model_styling === 'fitting' ? '' : 'hidden'}" id="model-fitting-datum-wrapper">
          <label for="model_fitting_datum">Fitting-Termin</label>
          <input type="date" id="model_fitting_datum" name="model_fitting_datum"
                 value="${this.formData.model_fitting_datum || ''}">
        </div>
      </div>
    `;
};

VertraegeCreate.prototype.renderModelStep4 = function() {
    const nutzungsarten = this.formData.model_nutzungsarten || [];
    const kiNutzung = this.formData.model_ki_nutzung || [];

    return `
      <div class="step-section">
        <h3>§4 Nutzungsrechte</h3>

        <h4>4.1 Nutzungsarten</h4>
        <div class="form-field">
          <label>Wofür darf das Material genutzt werden? <span class="required">*</span></label>
          <div class="checkbox-group checkbox-group-multi">
            <label class="checkbox-label">
              <input type="checkbox" name="model_nutzungsarten" value="ecommerce"
                     ${nutzungsarten.includes('ecommerce') ? 'checked' : ''}>
              <span>E-Commerce</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_nutzungsarten" value="social_media"
                     ${nutzungsarten.includes('social_media') ? 'checked' : ''}>
              <span>Social Media (organisch)</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_nutzungsarten" value="paid_ads"
                     ${nutzungsarten.includes('paid_ads') ? 'checked' : ''}>
              <span>Paid Ads</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_nutzungsarten" value="website"
                     ${nutzungsarten.includes('website') ? 'checked' : ''}>
              <span>Website</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_nutzungsarten" value="ooh"
                     ${nutzungsarten.includes('ooh') ? 'checked' : ''}>
              <span>OOH (Out of Home)</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_nutzungsarten" value="print"
                     ${nutzungsarten.includes('print') ? 'checked' : ''}>
              <span>Print</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_nutzungsarten" value="tv_ctv"
                     ${nutzungsarten.includes('tv_ctv') ? 'checked' : ''}>
              <span>TV / CTV</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_nutzungsarten" value="pos"
                     ${nutzungsarten.includes('pos') ? 'checked' : ''}>
              <span>POS</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_nutzungsarten" value="pr"
                     ${nutzungsarten.includes('pr') ? 'checked' : ''}>
              <span>PR</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_nutzungsarten" value="kampagne"
                     ${nutzungsarten.includes('kampagne') ? 'checked' : ''}>
              <span>Kampagne</span>
            </label>
          </div>
        </div>

        <h4 class="mt-subsection">4.2 Territorium</h4>
        <div class="form-field">
          <label>Territorium <span class="required">*</span></label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="model_territorium" value="dach"
                     ${this.formData.model_territorium === 'dach' ? 'checked' : ''} required>
              <span>DACH</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_territorium" value="eu"
                     ${this.formData.model_territorium === 'eu' ? 'checked' : ''}>
              <span>EU</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_territorium" value="weltweit"
                     ${this.formData.model_territorium === 'weltweit' ? 'checked' : ''}>
              <span>Weltweit</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_territorium" value="beschraenkt"
                     ${this.formData.model_territorium === 'beschraenkt' ? 'checked' : ''}>
              <span>Beschränkt auf...</span>
            </label>
          </div>
        </div>
        <div class="form-field ${this.formData.model_territorium === 'beschraenkt' ? '' : 'hidden'}" id="model-territorium-beschraenkt-wrapper">
          <label for="model_territorium_beschraenkt">Land / Region</label>
          <input type="text" id="model_territorium_beschraenkt" name="model_territorium_beschraenkt"
                 placeholder="z.B. Frankreich, Benelux"
                 value="${this.formData.model_territorium_beschraenkt || ''}">
        </div>

        <h4 class="mt-subsection">4.3 Nutzungsdauer</h4>
        <div class="form-field">
          <label>Nutzungsdauer <span class="required">*</span></label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="model_nutzungsdauer" value="3_monate"
                     ${this.formData.model_nutzungsdauer === '3_monate' ? 'checked' : ''} required>
              <span>3 Monate</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_nutzungsdauer" value="6_monate"
                     ${this.formData.model_nutzungsdauer === '6_monate' ? 'checked' : ''}>
              <span>6 Monate</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_nutzungsdauer" value="12_monate"
                     ${this.formData.model_nutzungsdauer === '12_monate' ? 'checked' : ''}>
              <span>12 Monate</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_nutzungsdauer" value="24_monate"
                     ${this.formData.model_nutzungsdauer === '24_monate' ? 'checked' : ''}>
              <span>24 Monate</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_nutzungsdauer" value="unbegrenzt"
                     ${this.formData.model_nutzungsdauer === 'unbegrenzt' ? 'checked' : ''}>
              <span>Unbegrenzt</span>
            </label>
          </div>
        </div>
        <div class="form-field">
          <label for="model_nutzungsbeginn">Beginn der Nutzungsdauer</label>
          <input type="date" id="model_nutzungsbeginn" name="model_nutzungsbeginn"
                 value="${this.formData.model_nutzungsbeginn || ''}">
        </div>

        <h4 class="mt-subsection">4.4 Exklusivität</h4>
        <div class="form-field">
          <label>Exklusivität</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="model_exklusivitaet_art" value="keine"
                     ${this.formData.model_exklusivitaet_art === 'keine' || !this.formData.model_exklusivitaet_art ? 'checked' : ''}>
              <span>Keine Exklusivität</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_exklusivitaet_art" value="branche"
                     ${this.formData.model_exklusivitaet_art === 'branche' ? 'checked' : ''}>
              <span>Branchenexklusivität</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_exklusivitaet_art" value="wettbewerber"
                     ${this.formData.model_exklusivitaet_art === 'wettbewerber' ? 'checked' : ''}>
              <span>Wettbewerber-Exklusivität</span>
            </label>
          </div>
        </div>
        <div class="form-field ${this.formData.model_exklusivitaet_art && this.formData.model_exklusivitaet_art !== 'keine' ? '' : 'hidden'}" id="model-exklusivitaet-dauer-wrapper">
          <label for="model_exklusivitaet_dauer">Dauer der Exklusivität (Monate)</label>
          <input type="number" id="model_exklusivitaet_dauer" name="model_exklusivitaet_dauer"
                 min="1" value="${this.formData.model_exklusivitaet_dauer || ''}">
        </div>

        <h4 class="mt-subsection">4.5 Bearbeitung & Anpassung</h4>
        <p class="form-hint">Der Auftraggeber ist berechtigt, das Bild- und Videomaterial im Rahmen des Vertragszwecks zu bearbeiten, zu kürzen, grafisch zu verändern oder mit anderen Inhalten zu kombinieren.</p>

        <h4 class="mt-subsection">4.6 KI- und digitale Weiterverarbeitung</h4>
        <div class="form-field">
          <label>KI-Nutzung</label>
          <div class="checkbox-group checkbox-group-multi">
            <label class="checkbox-label">
              <input type="checkbox" name="model_ki_nutzung" value="ki_erlaubt"
                     ${kiNutzung.includes('ki_erlaubt') ? 'checked' : ''}>
              <span>Nutzung für KI-gestützte Weiterverarbeitung erlaubt</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_ki_nutzung" value="training_ausgeschlossen"
                     ${kiNutzung.includes('training_ausgeschlossen') ? 'checked' : ''}>
              <span>Nutzung für Trainingsdaten ausgeschlossen</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_ki_nutzung" value="deepfake_nein"
                     ${kiNutzung.includes('deepfake_nein') ? 'checked' : ''}>
              <span>Keine Deepfake-Nutzung</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_ki_nutzung" value="nur_kampagne"
                     ${kiNutzung.includes('nur_kampagne') ? 'checked' : ''}>
              <span>Nutzung ausschließlich im Rahmen der vereinbarten Kampagne</span>
            </label>
          </div>
        </div>
      </div>
    `;
};

VertraegeCreate.prototype.renderModelStep5 = function() {
    const absageRegelung = this.formData.model_absage_regelung || [];

    return `
      <div class="step-section">
        <h3>§5 Vergütung</h3>

        <h4>5.1 Honorar</h4>
        <div class="form-two-col">
          <div class="form-field">
            <label for="verguetung_netto">Honorar (netto) <span class="required">*</span></label>
            <div class="input-with-suffix">
              <input type="number" id="verguetung_netto" name="verguetung_netto"
                     step="0.01" min="0" required
                     value="${this.formData.verguetung_netto || ''}">
              <span class="input-suffix">€</span>
            </div>
          </div>
          <div class="form-field">
            <label>Honorar-Art <span class="required">*</span></label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="model_honorar_art" value="tagesgage"
                       ${this.formData.model_honorar_art === 'tagesgage' ? 'checked' : ''} required>
                <span>Tagesgage</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="model_honorar_art" value="halbtagesgage"
                       ${this.formData.model_honorar_art === 'halbtagesgage' ? 'checked' : ''}>
                <span>Halbtagesgage</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="model_honorar_art" value="pauschal"
                       ${this.formData.model_honorar_art === 'pauschal' ? 'checked' : ''}>
                <span>Pauschalhonorar</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="model_honorar_art" value="stunde"
                       ${this.formData.model_honorar_art === 'stunde' ? 'checked' : ''}>
                <span>Stundenhonorar</span>
              </label>
            </div>
          </div>
        </div>

        <h4 class="mt-subsection">5.2 Buyout</h4>
        <div class="form-field">
          <label class="checkbox-label">
            <input type="checkbox" id="model_buyout_inklusiv" name="model_buyout_inklusiv" value="true"
                   ${this.formData.model_buyout_inklusiv ? 'checked' : ''}>
            <span>Buyout im Honorar enthalten</span>
          </label>
        </div>
        <div class="form-field ${this.formData.model_buyout_inklusiv ? 'hidden' : ''}" id="model-buyout-betrag-wrapper">
          <label for="model_buyout_betrag">Zusätzliches Buyout-Honorar (netto)</label>
          <div class="input-with-suffix">
            <input type="number" id="model_buyout_betrag" name="model_buyout_betrag"
                   step="0.01" min="0"
                   value="${this.formData.model_buyout_betrag || ''}">
            <span class="input-suffix">€</span>
          </div>
        </div>

        <h4 class="mt-subsection">5.3 Reise- und Nebenkosten</h4>
        <div class="form-field">
          <label>Reisekosten</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="model_reisekosten" value="inklusive"
                     ${this.formData.model_reisekosten === 'inklusive' ? 'checked' : ''}>
              <span>Inklusive</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_reisekosten" value="nachweis"
                     ${this.formData.model_reisekosten === 'nachweis' ? 'checked' : ''}>
              <span>Werden gegen Nachweis erstattet</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="model_reisekosten" value="pauschale"
                     ${this.formData.model_reisekosten === 'pauschale' ? 'checked' : ''}>
              <span>Reisepauschale</span>
            </label>
          </div>
        </div>
        <div class="form-field ${this.formData.model_reisekosten === 'pauschale' ? '' : 'hidden'}" id="model-reisepauschale-wrapper">
          <label for="model_reisepauschale">Reisepauschale (netto)</label>
          <div class="input-with-suffix">
            <input type="number" id="model_reisepauschale" name="model_reisepauschale"
                   step="0.01" min="0"
                   value="${this.formData.model_reisepauschale || ''}">
            <span class="input-suffix">€</span>
          </div>
        </div>

        <h4 class="mt-subsection">5.4 Zahlungsziel</h4>
        <div class="form-field">
          <label>Zahlungsziel</label>
          <div class="radio-group radio-group-inline">
            <label class="radio-option">
              <input type="radio" name="zahlungsziel" value="7_tage"
                     ${this.formData.zahlungsziel === '7_tage' ? 'checked' : ''}>
              <span>7 Tage</span>
            </label>
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
          </div>
        </div>
        <p class="form-hint">Rechnungsstellung durch das Model nach Abschluss der Produktion.</p>

        <h3 class="mt-section">§6 Absage & Ausfall</h3>

        <h4>6.1 Wetterabhängigkeit</h4>
        <div class="form-field">
          <label class="checkbox-label">
            <input type="checkbox" id="model_wetterabhaengig" name="model_wetterabhaengig" value="true"
                   ${this.formData.model_wetterabhaengig ? 'checked' : ''}>
            <span>Produktion ist wetterabhängig</span>
          </label>
        </div>

        <h4 class="mt-subsection">6.2 Absagebedingungen</h4>
        <div class="form-field">
          <label>Absageregelung bei Absage durch den Auftraggeber</label>
          <div class="checkbox-group checkbox-group-multi">
            <label class="checkbox-label">
              <input type="checkbox" name="model_absage_regelung" value="100_24h"
                     ${absageRegelung.includes('100_24h') ? 'checked' : ''}>
              <span>100 % Honorar bei Absage < 24 Stunden</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_absage_regelung" value="50_48h"
                     ${absageRegelung.includes('50_48h') ? 'checked' : ''}>
              <span>50 % Honorar bei Absage < 48 Stunden</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="model_absage_regelung" value="individuell"
                     ${absageRegelung.includes('individuell') ? 'checked' : ''}>
              <span>Individuelle Regelung</span>
            </label>
          </div>
        </div>
        <div class="form-field ${absageRegelung.includes('individuell') ? '' : 'hidden'}" id="model-absage-individuell-wrapper">
          <label for="model_absage_individuell">Individuelle Absageregelung</label>
          <textarea id="model_absage_individuell" name="model_absage_individuell" rows="3"
                    placeholder="Beschreibung der individuellen Regelung...">${this.formData.model_absage_individuell || ''}</textarea>
        </div>

        <h3 class="mt-section">Weitere Bestimmungen</h3>
        <div class="form-field">
          <label for="weitere_bestimmungen">Zusätzliche Vereinbarungen (optional)</label>
          <textarea id="weitere_bestimmungen" name="weitere_bestimmungen" rows="4"
                    placeholder="z.B. besondere Vereinbarungen, Sonderkonditionen...">${this.formData.weitere_bestimmungen || ''}</textarea>
        </div>
      </div>
    `;
};
