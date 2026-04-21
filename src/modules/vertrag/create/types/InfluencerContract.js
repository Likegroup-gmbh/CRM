// types/InfluencerContract.js
// Influencer-Kooperationsvertrag: Steps 2-5 + Helper fuer Veroeffentlichungsdaten.

import { VertraegeCreate } from '../VertraegeCreateCore.js';
import { KampagneUtils } from '../../../kampagne/KampagneUtils.js';

VertraegeCreate.prototype.renderInfluencerStep2 = function() {
    if (!this._filtersInitialized) {
      this.updateFilteredKampagnen();
    }
    
    return `
      <div class="step-section">
        <h3>Vertragsparteien</h3>
        <p class="step-description">Vertragstyp: <strong>Influencer-Kooperationsvertrag</strong></p>
        
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

        <!-- Kampagne -->
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

        <!-- Influencer (Creator) -->
        <div class="form-field">
          <label for="creator_id">Influencer <span class="required">*</span></label>
          <select id="creator_id" name="creator_id" required ${!this.formData.kampagne_id ? 'disabled' : ''} data-searchable="true">
            <option value="">${this.formData.kampagne_id ? 'Influencer auswählen...' : 'Bitte zuerst Kampagne wählen...'}</option>
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

VertraegeCreate.prototype.renderInfluencerStep3 = function() {
    const veroeffentlichungsplan = this.formData.veroeffentlichungsplan || {};
    
    return `
      <div class="step-section">
        <h3>§2 Plattformen & Inhalte</h3>
        
        <div class="form-field">
          <label>2.1 Plattformen</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" name="plattformen" value="instagram"
                     ${(this.formData.plattformen || []).includes('instagram') ? 'checked' : ''}>
              <span>Instagram</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="plattformen" value="tiktok"
                     ${(this.formData.plattformen || []).includes('tiktok') ? 'checked' : ''}>
              <span>TikTok</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="plattformen" value="youtube"
                     ${(this.formData.plattformen || []).includes('youtube') ? 'checked' : ''}>
              <span>YouTube</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="plattformen" value="sonstige"
                     ${(this.formData.plattformen || []).includes('sonstige') ? 'checked' : ''}>
              <span>Sonstige</span>
            </label>
          </div>
        </div>

        <div class="form-field ${(this.formData.plattformen || []).includes('sonstige') ? '' : 'hidden'}" id="plattformen-sonstige-wrapper">
          <label for="plattformen_sonstige">Sonstige Plattform</label>
          <input type="text" id="plattformen_sonstige" name="plattformen_sonstige"
                 value="${this.formData.plattformen_sonstige || ''}"
                 placeholder="z.B. LinkedIn, Twitter">
        </div>

        <!-- Profile werden automatisch aus dem Creator-Profil übernommen -->

        <h4>2.2 Inhalte</h4>
        <div class="form-three-col">
          <div class="form-field">
            <label for="anzahl_reels">Videos / Reels</label>
            <input type="number" id="anzahl_reels" name="anzahl_reels" min="0" 
                   value="${this.formData.anzahl_reels || 0}">
          </div>
          <div class="form-field">
            <label for="anzahl_feed_posts">Feed-Posts</label>
            <input type="number" id="anzahl_feed_posts" name="anzahl_feed_posts" min="0" 
                   value="${this.formData.anzahl_feed_posts || 0}">
          </div>
          <div class="form-field">
            <label for="anzahl_storys">Story-Slides</label>
            <input type="number" id="anzahl_storys" name="anzahl_storys" min="0" 
                   value="${this.formData.anzahl_storys || 0}">
          </div>
        </div>

        <h3>§3 Konzept, Freigabe & Veröffentlichungsplan</h3>
        <p class="form-hint">Der Content ist der LikeGroup GmbH vor Veröffentlichung zur Freigabe vorzulegen.</p>

        <div class="form-field">
          <label for="korrekturschleifen">3.1 Korrekturschleifen</label>
          <div class="radio-group radio-group-inline">
            <label class="radio-option">
              <input type="radio" name="korrekturschleifen" value="1" 
                     ${this.formData.korrekturschleifen === 1 ? 'checked' : ''}>
              <span>1</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="korrekturschleifen" value="2" 
                     ${this.formData.korrekturschleifen === 2 ? 'checked' : ''}>
              <span>2</span>
            </label>
          </div>
        </div>

        <h4>3.2 Veröffentlichungsplan</h4>
        
        <div class="form-three-col">
          <div id="veroeffentlichungsplan-videos" class="veroeffentlichungsplan-section">
            <h5>Videos / Reels</h5>
            <div id="video-dates-list">
              ${this.renderVeroeffentlichungsDaten('videos', veroeffentlichungsplan.videos || [])}
            </div>
          </div>

          <div id="veroeffentlichungsplan-feed-posts" class="veroeffentlichungsplan-section">
            <h5>Feed-Posts</h5>
            <div id="feed-post-dates-list">
              ${this.renderVeroeffentlichungsDaten('feed_posts', veroeffentlichungsplan.feed_posts || [])}
            </div>
          </div>

          <div id="veroeffentlichungsplan-storys" class="veroeffentlichungsplan-section">
            <h5>Story-Slides</h5>
            <div id="story-dates-list">
              ${this.renderVeroeffentlichungsDaten('storys', veroeffentlichungsplan.storys || [])}
            </div>
          </div>
        </div>
      </div>
    `;
};

VertraegeCreate.prototype.renderVeroeffentlichungsDaten = function(typ, dates) {
    const labels = {
      'videos': 'Video',
      'feed_posts': 'Feed-Post',
      'storys': 'Story-Slide'
    };
    const label = labels[typ] || typ;
    
    if (!dates || dates.length === 0) {
      return `<div class="no-dates-hint">Noch keine ${label}-Termine geplant</div>`;
    }
    
    return dates.map((date, idx) => `
      <div class="veroeffentlichung-item" data-idx="${idx}">
        <span class="veroeffentlichung-label">${label} ${idx + 1}</span>
        <input type="date" name="${typ}_date_${idx}" value="${date}" class="veroeffentlichung-date">
      </div>
    `).join('');
};

VertraegeCreate.prototype.renderInfluencerStep4 = function() {
    return `
      <div class="step-section">
        <h3>§5 Nutzungsrechte & Media Buyout</h3>
        
        <div class="form-field">
          <label>5.1 Organische Veröffentlichung</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="organische_veroeffentlichung" value="influencer_only" 
                     ${this.formData.organische_veroeffentlichung === 'influencer_only' ? 'checked' : ''}>
              <span>Veröffentlichung ausschließlich über den Influencer</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="organische_veroeffentlichung" value="collab" 
                     ${this.formData.organische_veroeffentlichung === 'collab' ? 'checked' : ''}>
              <span>Co-Autoren-Post / Collab</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="organische_veroeffentlichung" value="zusatz_unternehmen" 
                     ${this.formData.organische_veroeffentlichung === 'zusatz_unternehmen' ? 'checked' : ''}>
              <span>Zusätzliche Veröffentlichung durch Unternehmen/Kunden</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="organische_veroeffentlichung" value="keine_zusatz" 
                     ${this.formData.organische_veroeffentlichung === 'keine_zusatz' ? 'checked' : ''}>
              <span>Keine zusätzliche Veröffentlichung durch Unternehmen/Kunden</span>
            </label>
          </div>
        </div>

        <div class="form-field">
          <label>5.2 Zusätzliche Nutzung für Werbung (Media Buyout)</label>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="media_buyout" value="organisch" 
                     ${this.formData.media_buyout === 'organisch' ? 'checked' : ''}>
              <span>Organisch</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="media_buyout" value="paid" 
                     ${this.formData.media_buyout === 'paid' ? 'checked' : ''}>
              <span>Paid Ads</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="media_buyout" value="beides" 
                     ${this.formData.media_buyout === 'beides' ? 'checked' : ''}>
              <span>Organisch & Paid Ads</span>
            </label>
          </div>
        </div>

        <div class="form-field">
          <label for="nutzungsdauer">Nutzungsdauer</label>
          <div class="radio-group radio-group-inline">
            <label class="radio-option">
              <input type="radio" name="nutzungsdauer" value="unbegrenzt" 
                     ${this.formData.nutzungsdauer === 'unbegrenzt' ? 'checked' : ''}>
              <span>Unbegrenzt</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsdauer" value="12_monate" 
                     ${this.formData.nutzungsdauer === '12_monate' ? 'checked' : ''}>
              <span>12 Monate</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsdauer" value="6_monate" 
                     ${this.formData.nutzungsdauer === '6_monate' ? 'checked' : ''}>
              <span>6 Monate</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsdauer" value="3_monate" 
                     ${this.formData.nutzungsdauer === '3_monate' ? 'checked' : ''}>
              <span>3 Monate</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="nutzungsdauer" value="individuell" 
                     ${this.formData.nutzungsdauer === 'individuell' ? 'checked' : ''}>
              <span>Individuell</span>
            </label>
          </div>
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

        <p class="form-hint mt-xs">Der Content darf technisch angepasst werden. Eine Weitergabe an Dritte ist ausgeschlossen.</p>

        <h4>5.3 Exklusivität</h4>
        <div class="form-two-col">
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" id="exklusivitaet" name="exklusivitaet" value="true"
                     ${this.formData.exklusivitaet ? 'checked' : ''}>
              <span>Exklusivität vereinbart</span>
            </label>
          </div>
          <div class="form-field ${this.formData.exklusivitaet ? '' : 'hidden'}" id="exklusivitaet-monate-wrapper">
            <label for="exklusivitaet_monate">Zeitraum</label>
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
        <p class="form-hint">Am Veröffentlichungstag darf keine Werbung für konkurrierende Marken erfolgen.</p>

        <h3 class="mt-section">§10 Reichweiten-Garantie</h3>
        <div class="form-two-col">
          <div class="form-field">
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="reichweiten_garantie" value="false" 
                       ${!this.formData.reichweiten_garantie ? 'checked' : ''}>
                <span>Keine Garantie</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="reichweiten_garantie" value="true" 
                       ${this.formData.reichweiten_garantie ? 'checked' : ''}>
                <span>Mindestreichweite</span>
              </label>
            </div>
          </div>
          <div class="form-field ${this.formData.reichweiten_garantie ? '' : 'hidden'}" id="reichweiten-wert-wrapper">
            <label for="reichweiten_garantie_wert">Mindestreichweite</label>
            <input type="number" id="reichweiten_garantie_wert" name="reichweiten_garantie_wert" min="0"
                   value="${this.formData.reichweiten_garantie_wert || ''}">
          </div>
        </div>

        <h3 class="mt-section">§11 Mindest-Online-Dauer</h3>
        <div class="form-field">
          <div class="radio-group radio-group-inline">
            <label class="radio-option">
              <input type="radio" name="mindest_online_dauer" value="7_tage" 
                     ${this.formData.mindest_online_dauer === '7_tage' ? 'checked' : ''}>
              <span>7 Tage</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="mindest_online_dauer" value="14_tage" 
                     ${this.formData.mindest_online_dauer === '14_tage' ? 'checked' : ''}>
              <span>14 Tage</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="mindest_online_dauer" value="30_tage" 
                     ${this.formData.mindest_online_dauer === '30_tage' ? 'checked' : ''}>
              <span>30 Tage</span>
            </label>
            <label class="radio-option">
              <input type="radio" name="mindest_online_dauer" value="unbegrenzt" 
                     ${this.formData.mindest_online_dauer === 'unbegrenzt' ? 'checked' : ''}>
              <span>Unbegrenzt</span>
            </label>
          </div>
        </div>
      </div>
    `;
};

VertraegeCreate.prototype.renderInfluencerStep5 = function() {
    return `
      <div class="step-section">
        <h3>§6 Vergütung</h3>
        
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

        <p class="form-hint">Die Zahlung erfolgt durch den Auftraggeber oder die LikeGroup GmbH im Auftrag des Kunden. Die Rechnungsstellung erfolgt nach Veröffentlichung bzw. Erreichung der Ziele.</p>

        <h3 class="mt-section">§7 Qualitätsanforderungen</h3>
        <p class="form-hint">Der Content muss technisch sauber (Ton, Licht, Bild), natürlich und nicht übermäßig werblich, markenkonform, visuell hochwertig, kreativ, lebendig und mit ästhetisch geeignetem Hintergrund umgesetzt sein.</p>

        <h3 class="mt-section">§8 Anpassungen</h3>
        <p class="form-hint">Kostenfreie Anpassungen umfassen u.a.:</p>
        <div class="form-field">
          <div class="checkbox-group checkbox-group-multi">
            <label class="checkbox-label">
              <input type="checkbox" name="anpassungen" value="schnitt"
                     ${(this.formData.anpassungen || []).includes('schnitt') ? 'checked' : ''}>
              <span>Schnitt & Tempo</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="anpassungen" value="hook"
                     ${(this.formData.anpassungen || []).includes('hook') ? 'checked' : ''}>
              <span>Hook / Einstieg</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="anpassungen" value="szenenreihenfolge"
                     ${(this.formData.anpassungen || []).includes('szenenreihenfolge') ? 'checked' : ''}>
              <span>Szenenreihenfolge</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="anpassungen" value="effekte"
                     ${(this.formData.anpassungen || []).includes('effekte') ? 'checked' : ''}>
              <span>Effekte / Zooms</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="anpassungen" value="untertitel"
                     ${(this.formData.anpassungen || []).includes('untertitel') ? 'checked' : ''}>
              <span>Untertitel</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="anpassungen" value="nachfilmen"
                     ${(this.formData.anpassungen || []).includes('nachfilmen') ? 'checked' : ''}>
              <span>Nachfilmen einzelner Szenen</span>
            </label>
          </div>
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
