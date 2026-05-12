// types/ContractingContract.js
// Contracting-Vertrag (Influencer-Marketing-Vertrag mit LikeGroup als Auftraggeber/Durchfuehrer):
// Steps 2-5. Direkter Bezug zu einem Contracting-Auftrag (auftrag.auftragtype='Contracting'),
// statt Kampagne/Kooperation-Kaskade.

import { VertraegeCreate } from '../VertraegeCreateCore.js';

VertraegeCreate.prototype.renderContractingStep2 = function() {
    if (!this._filtersInitialized) {
      this.updateFilteredContractingAuftraege();
    }

    const handles = this.formData.contracting_plattformen_handles || {};

    return `
      <div class="step-section">
        <h3>Vertragsparteien</h3>
        <p class="step-description">Vertragstyp: <strong>Contracting (Influencer-Marketing-Vertrag)</strong></p>

        <!-- Kunde (Unternehmen = beguenstigter Dritter) -->
        <div class="form-field">
          <label for="kunde_unternehmen_id">Unternehmen / Kunde <span class="required">*</span></label>
          <select id="kunde_unternehmen_id" name="kunde_unternehmen_id" required data-searchable="true">
            <option value="">Unternehmen auswählen...</option>
            ${this.unternehmen.map(u => `
              <option value="${u.id}" ${this.formData.kunde_unternehmen_id === u.id ? 'selected' : ''}>
                ${u.firmenname}
              </option>
            `).join('')}
          </select>
          <div id="kunde-adresse" class="address-preview"></div>
          <small class="form-hint">Das gewählte Unternehmen wird im Vertrag als begünstigter Dritter geführt.</small>
        </div>

        <!-- Contracting-Auftrag -->
        <div class="form-field">
          <label for="contracting_auftrag_id">Contracting-Auftrag <span class="required">*</span></label>
          <select id="contracting_auftrag_id" name="contracting_auftrag_id" required ${!this.formData.kunde_unternehmen_id ? 'disabled' : ''}>
            <option value="">${this.formData.kunde_unternehmen_id ? 'Auftrag auswählen...' : 'Bitte zuerst Unternehmen wählen...'}</option>
            ${(this.filteredContractingAuftraege || []).map(a => {
              const label = (a.titel || a.auftragsname || a.id) + (a.po ? ` (PO: ${a.po})` : '');
              return `<option value="${a.id}" ${this.formData.contracting_auftrag_id === a.id ? 'selected' : ''}>${label}</option>`;
            }).join('')}
          </select>
        </div>

        <!-- Creator (Influencer) -->
        <div class="form-field">
          <label for="creator_id">Influencer / Creator <span class="required">*</span></label>
          <select id="creator_id" name="creator_id" required data-searchable="true">
            <option value="">Creator auswählen...</option>
            ${this.creators.map(c => `
              <option value="${c.id}" ${this.formData.creator_id === c.id ? 'selected' : ''}>
                ${c.vorname} ${c.nachname}
              </option>
            `).join('')}
          </select>
          <div id="creator-adresse" class="address-preview"></div>
        </div>

        ${this.renderAgenturSection()}

        <h3 class="mt-section">Influencer-Daten</h3>

        <div class="form-field">
          <label for="influencer_land">Land</label>
          <input type="text" id="influencer_land" name="influencer_land"
                 value="${this.formData.influencer_land || 'Deutschland'}">
        </div>

        <div class="form-field">
          <label for="name">Vertragsname (automatisch generiert)</label>
          <input type="text" id="name" name="name" readonly
                 value="${this.formData.name || ''}"
                 placeholder="Wird automatisch generiert..." class="readonly-field">
        </div>
      </div>
    `;
};

VertraegeCreate.prototype.renderContractingStep3 = function() {
    const handles = this.formData.contracting_plattformen_handles || {};
    const formate = this.formData.contracting_content_formate || [];
    const plattformen = this.formData.plattformen || [];

    return `
      <div class="step-section">
        <h3>§2 Plattformen & Veröffentlichung</h3>

        <div class="form-field">
          <label>Plattformen</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" name="plattformen" value="instagram"
                     ${plattformen.includes('instagram') ? 'checked' : ''}>
              <span>Instagram</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="plattformen" value="tiktok"
                     ${plattformen.includes('tiktok') ? 'checked' : ''}>
              <span>TikTok</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="plattformen" value="youtube"
                     ${plattformen.includes('youtube') ? 'checked' : ''}>
              <span>YouTube</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="plattformen" value="facebook"
                     ${plattformen.includes('facebook') ? 'checked' : ''}>
              <span>Facebook</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="plattformen" value="sonstige"
                     ${plattformen.includes('sonstige') ? 'checked' : ''}>
              <span>Sonstige</span>
            </label>
          </div>
        </div>

        <div class="form-field ${plattformen.includes('sonstige') ? '' : 'hidden'}" id="plattformen-sonstige-wrapper">
          <label for="plattformen_sonstige">Sonstige Plattform(en)</label>
          <input type="text" id="plattformen_sonstige" name="plattformen_sonstige"
                 value="${this.formData.plattformen_sonstige || ''}"
                 placeholder="z.B. LinkedIn, Pinterest">
        </div>

        <h4 class="mt-section">Plattform-Handles</h4>
        <p class="form-hint">Diese werden im Vertrag als Veröffentlichungsprofile angegeben (XXX-Stellen in §2).</p>
        <div class="form-three-col">
          <div class="form-field">
            <label for="handle_instagram">Instagram-Handle</label>
            <input type="text" id="handle_instagram" name="contracting_handle_instagram"
                   value="${handles.instagram || ''}" placeholder="@username">
          </div>
          <div class="form-field">
            <label for="handle_tiktok">TikTok-Handle</label>
            <input type="text" id="handle_tiktok" name="contracting_handle_tiktok"
                   value="${handles.tiktok || ''}" placeholder="@username">
          </div>
          <div class="form-field">
            <label for="handle_youtube">YouTube-Handle</label>
            <input type="text" id="handle_youtube" name="contracting_handle_youtube"
                   value="${handles.youtube || ''}" placeholder="@channel">
          </div>
        </div>
        <div class="form-field">
          <label for="handle_weitere">Weitere Kanäle</label>
          <input type="text" id="handle_weitere" name="contracting_handle_weitere"
                 value="${handles.weitere || ''}" placeholder="z.B. LinkedIn-URL">
        </div>

        <h3 class="mt-section">§2a Inhalte & Kooperationsdetails</h3>

        <div class="form-field">
          <label>Content-Formate</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" name="contracting_content_formate" value="reels_tiktoks"
                     ${formate.includes('reels_tiktoks') ? 'checked' : ''}>
              <span>Reels / TikToks</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="contracting_content_formate" value="stories"
                     ${formate.includes('stories') ? 'checked' : ''}>
              <span>Stories</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="contracting_content_formate" value="youtube_shorts"
                     ${formate.includes('youtube_shorts') ? 'checked' : ''}>
              <span>YouTube Shorts</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="contracting_content_formate" value="videos"
                     ${formate.includes('videos') ? 'checked' : ''}>
              <span>Videos</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="contracting_content_formate" value="feedpost"
                     ${formate.includes('feedpost') ? 'checked' : ''}>
              <span>Feedpost</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="contracting_content_formate" value="ads"
                     ${formate.includes('ads') ? 'checked' : ''}>
              <span>Ads</span>
            </label>
          </div>
        </div>

        <div class="form-two-col">
          <div class="form-field">
            <label for="contracting_anzahl_inhalte">Anzahl Inhalte</label>
            <input type="text" id="contracting_anzahl_inhalte" name="contracting_anzahl_inhalte"
                   value="${this.formData.contracting_anzahl_inhalte || ''}"
                   placeholder="z.B. 1 Reel + 3 Stories">
          </div>
          <div class="form-field">
            <label for="contracting_veroeffentlichung_zeitraum">Datum / Zeitraum der Veröffentlichung</label>
            <input type="text" id="contracting_veroeffentlichung_zeitraum" name="contracting_veroeffentlichung_zeitraum"
                   value="${this.formData.contracting_veroeffentlichung_zeitraum || ''}"
                   placeholder="z.B. KW 24 oder 15.06.2025">
          </div>
        </div>
      </div>
    `;
};

VertraegeCreate.prototype.renderContractingStep4 = function() {
    const buyoutAktiv = this.formData.contracting_buyout_aktiv === true || this.formData.contracting_buyout_aktiv === 'true';
    const buyoutPlattformen = this.formData.contracting_buyout_plattformen || [];
    const buyoutArt = this.formData.contracting_buyout_art || [];
    const geo = this.formData.contracting_buyout_geografisch || '';

    return `
      <div class="step-section">
        <h3>§3 Nutzung für zusätzliche Ad-Ausspielung / Werbung (Media Buyout)</h3>

        <div class="form-field">
          <label>Media Buyout aktiv?</label>
          <div class="radio-group radio-group-inline">
            <label class="radio-option">
              <input type="radio" name="contracting_buyout_aktiv" value="true"
                     ${buyoutAktiv ? 'checked' : ''}>
              <span>Ja</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="contracting_buyout_aktiv" value="false"
                     ${!buyoutAktiv ? 'checked' : ''}>
              <span>Nein</span>
            </label>
          </div>
        </div>

        <div id="contracting-buyout-details" class="${buyoutAktiv ? '' : 'hidden'}">
          <div class="form-field">
            <label>Buyout-Plattformen</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" name="contracting_buyout_plattformen" value="instagram"
                       ${buyoutPlattformen.includes('instagram') ? 'checked' : ''}>
                <span>Instagram</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" name="contracting_buyout_plattformen" value="facebook"
                       ${buyoutPlattformen.includes('facebook') ? 'checked' : ''}>
                <span>Facebook</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" name="contracting_buyout_plattformen" value="tiktok"
                       ${buyoutPlattformen.includes('tiktok') ? 'checked' : ''}>
                <span>TikTok</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" name="contracting_buyout_plattformen" value="andere"
                       ${buyoutPlattformen.includes('andere') ? 'checked' : ''}>
                <span>Andere</span>
              </label>
            </div>
          </div>

          <div class="form-field">
            <label>Art der Nutzung</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" name="contracting_buyout_art" value="whitelisting"
                       ${buyoutArt.includes('whitelisting') ? 'checked' : ''}>
                <span>Whitelisting (Meta)</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" name="contracting_buyout_art" value="spark_ad"
                       ${buyoutArt.includes('spark_ad') ? 'checked' : ''}>
                <span>Spark Ad (TikTok)</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" name="contracting_buyout_art" value="werbeanzeigen"
                       ${buyoutArt.includes('werbeanzeigen') ? 'checked' : ''}>
                <span>Werbeanzeigen (Unternehmenskanal)</span>
              </label>
            </div>
          </div>

          <div class="form-two-col">
            <div class="form-field">
              <label for="contracting_buyout_nutzungsdauer">Nutzungsdauer</label>
              <input type="text" id="contracting_buyout_nutzungsdauer" name="contracting_buyout_nutzungsdauer"
                     value="${this.formData.contracting_buyout_nutzungsdauer || ''}"
                     placeholder="z.B. 6 Monate">
            </div>
            <div class="form-field">
              <label>Geografisch</label>
              <div class="radio-group radio-group-inline">
                <label class="radio-option">
                  <input type="radio" name="contracting_buyout_geografisch" value="deutschland"
                         ${geo === 'deutschland' ? 'checked' : ''}>
                  <span>Deutschland</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="contracting_buyout_geografisch" value="dach"
                         ${geo === 'dach' ? 'checked' : ''}>
                  <span>DACH</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="contracting_buyout_geografisch" value="europa"
                         ${geo === 'europa' ? 'checked' : ''}>
                  <span>Europa</span>
                </label>
                <label class="radio-option">
                  <input type="radio" name="contracting_buyout_geografisch" value="global"
                         ${geo === 'global' ? 'checked' : ''}>
                  <span>Global</span>
                </label>
              </div>
            </div>
          </div>

          <div class="form-field">
            <label for="contracting_buyout_besonderheiten">Besonderheiten / Absprachen</label>
            <textarea id="contracting_buyout_besonderheiten" name="contracting_buyout_besonderheiten" rows="3"
                      placeholder="Optional: Besonderheiten zur Nutzung">${this.formData.contracting_buyout_besonderheiten || ''}</textarea>
          </div>
        </div>

        <h3 class="mt-section">§5 Produktion & Freigabe</h3>
        <p class="form-hint">Es werden maximal zwei Korrekturschleifen vereinbart. Inhalte sind vor Veröffentlichung zur Freigabe vorzulegen.</p>

        <div class="form-two-col">
          <div class="form-field">
            <label for="korrekturschleifen">Korrekturschleifen</label>
            <div class="radio-group radio-group-inline">
              <label class="radio-option">
                <input type="radio" name="korrekturschleifen" value="1"
                       ${this.formData.korrekturschleifen === 1 || this.formData.korrekturschleifen === '1' ? 'checked' : ''}>
                <span>1</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="korrekturschleifen" value="2"
                       ${this.formData.korrekturschleifen === 2 || this.formData.korrekturschleifen === '2' ? 'checked' : ''}>
                <span>2</span>
              </label>
            </div>
          </div>
          <div class="form-field">
            <label for="contracting_veroeffentlichungsdatum">Voraussichtliche Veröffentlichung</label>
            <input type="text" id="contracting_veroeffentlichungsdatum" name="contracting_veroeffentlichungsdatum"
                   value="${this.formData.contracting_veroeffentlichungsdatum || ''}"
                   placeholder="z.B. 15.06.2025 oder KW 24">
          </div>
        </div>
      </div>
    `;
};

VertraegeCreate.prototype.renderContractingStep5 = function() {
    return `
      <div class="step-section">
        <h3>§6 Vergütung</h3>
        <p class="form-hint">Zahlung erfolgt innerhalb von 45 Tagen nach Leistungserbringung und Rechnungsstellung über LikeGroup GmbH.</p>

        <div class="form-field">
          <label for="verguetung_netto">Fixvergütung (netto) <span class="required">*</span></label>
          <div class="input-with-suffix">
            <input type="number" id="verguetung_netto" name="verguetung_netto"
                   step="0.01" min="0" required
                   value="${this.formData.verguetung_netto || ''}">
            <span class="input-suffix">€</span>
          </div>
        </div>

        <h3 class="mt-section">§10 Exklusivität</h3>
        <p class="form-hint">Der Influencer verpflichtet sich für die Dauer von zwei Wochen nach Veröffentlichung des Contents, keine Kooperationen mit unmittelbaren Wettbewerbern im Bereich "XXX" einzugehen.</p>

        <div class="form-field">
          <label for="contracting_exklusivitaet_bereich">Wettbewerbs-Bereich</label>
          <input type="text" id="contracting_exklusivitaet_bereich" name="contracting_exklusivitaet_bereich"
                 value="${this.formData.contracting_exklusivitaet_bereich || ''}"
                 placeholder="z.B. Haushaltselektronik, Beauty, Fashion">
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
