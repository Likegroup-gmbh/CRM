// CreatorAddressResolver.js
// Laedt Management-Daten fuer den Creator und resolved die Vertragsadresse.
// Ersetzt die fruehere creator_agentur-basierte Logik.

import { VertraegeCreate } from './VertraegeCreateCore.js';

function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
}

// Laedt Management-Daten fuer den gewaehlten Creator aus creator_management/management
// und mappt sie auf die bestehenden influencer_agentur_*-Felder in formData.
VertraegeCreate.prototype._loadCreatorManagement = async function(creatorId) {
    if (!creatorId) {
      this._resetManagementFields();
      this._syncAgenturDomFromFormData();
      return;
    }

    if (!window.supabase) {
      console.warn('⚠️ VERTRAG: Supabase nicht verfuegbar fuer Management-Load');
      const creator = this.creators.find(c => c.id === creatorId);
      if (creator && this.formData.creator_id === creatorId) {
        this.updateCreatorAddressPreview(creator);
      }
      return;
    }

    try {
      const { data, error } = await window.supabase
        .from('creator_management')
        .select(`
          ist_aktiv,
          management:management_id (
            id, firmenname, strasse, hausnummer, plz, stadt, land
          )
        `)
        .eq('creator_id', creatorId)
        .eq('ist_aktiv', true);

      if (error) {
        console.error('❌ VERTRAG: Fehler beim Laden creator_management:', error);
        this._resetManagementFields();
      } else {
        const list = (data || [])
          .filter(item => item.management)
          .map(item => item.management);
        this.creatorManagements = list;

        if (list.length > 0) {
          // Bisherige Auswahl beibehalten, falls noch vorhanden; sonst erste
          const keep = list.find(m => m.id === this.formData._management_id);
          this._applySelectedManagement((keep || list[0]).id);
        } else {
          this._resetManagementFields();
        }
      }
    } catch (err) {
      console.error('❌ VERTRAG: Exception bei _loadCreatorManagement:', err);
      this._resetManagementFields();
    }

    this._syncAgenturDomFromFormData();

    const creator = this.creators.find(c => c.id === creatorId);
    if (creator && this.formData.creator_id === creatorId) {
      this.updateCreatorAddressPreview(creator);
    }
};

// Uebernimmt die Daten des gewaehlten Managements in die influencer_agentur_*-Felder.
VertraegeCreate.prototype._applySelectedManagement = function(managementId) {
    const list = this.creatorManagements || [];
    const m = list.find(x => x.id === managementId) || list[0];
    if (!m) {
      this._resetManagementFields();
      return;
    }
    this.formData.influencer_agentur_vertreten = true;
    this.formData.influencer_agentur_name = m.firmenname || '';
    this.formData.influencer_agentur_strasse = m.strasse || '';
    this.formData.influencer_agentur_hausnummer = m.hausnummer || '';
    this.formData.influencer_agentur_plz = m.plz || '';
    this.formData.influencer_agentur_stadt = m.stadt || '';
    this.formData.influencer_agentur_land = m.land || 'Deutschland';
    this.formData.influencer_agentur_vertretung = '';
    this.formData._agentur_from_creator = true;
    this.formData._management_id = m.id;
};

// Wird vom Management-Dropdown im Vertrag aufgerufen (Auswahl wechseln).
VertraegeCreate.prototype.selectVertragManagement = function(managementId) {
    this._applySelectedManagement(managementId);
    this._syncAgenturDomFromFormData();
    const creator = this.creators.find(c => c.id === this.formData.creator_id);
    if (creator) this.updateCreatorAddressPreview(creator);
};

VertraegeCreate.prototype._resetManagementFields = function() {
    this.creatorManagements = [];
    this.formData.influencer_agentur_vertreten = false;
    this.formData.influencer_agentur_name = '';
    this.formData.influencer_agentur_strasse = '';
    this.formData.influencer_agentur_hausnummer = '';
    this.formData.influencer_agentur_plz = '';
    this.formData.influencer_agentur_stadt = '';
    this.formData.influencer_agentur_land = 'Deutschland';
    this.formData.influencer_agentur_vertretung = '';
    this.formData._agentur_from_creator = false;
    this.formData._management_id = null;
    // Schalter zuruecksetzen, wenn kein Management vorhanden
    if (!this.creatorManagements || this.creatorManagements.length === 0) {
      this.formData.nur_management_adresse = false;
    }
};

VertraegeCreate.prototype._syncAgenturDomFromFormData = function() {
    if (typeof this.refreshAgenturSection === 'function') {
      this.refreshAgenturSection();
    }
};

VertraegeCreate.prototype.hasValidCreatorAddress = function(creator) {
    if (!creator) return false;
    const hasStrasse = creator.lieferadresse_strasse && creator.lieferadresse_strasse.trim() !== '';
    const hasPlz = creator.lieferadresse_plz && creator.lieferadresse_plz.trim() !== '';
    const hasStadt = creator.lieferadresse_stadt && creator.lieferadresse_stadt.trim() !== '';
    return hasStrasse && hasPlz && hasStadt;
};

VertraegeCreate.prototype.hasValidManagementAddress = function(agentur = this.formData) {
    if (!agentur) return false;
    const hasStrasse = agentur.influencer_agentur_strasse && agentur.influencer_agentur_strasse.trim() !== '';
    const hasPlz = agentur.influencer_agentur_plz && agentur.influencer_agentur_plz.trim() !== '';
    const hasStadt = agentur.influencer_agentur_stadt && agentur.influencer_agentur_stadt.trim() !== '';
    return !!agentur.influencer_agentur_vertreten && hasStrasse && hasPlz && hasStadt;
};

// Aufloesung:
// - Schalter "nur_management_adresse" AN: erzwinge Management-Adresse (kein Creator-Fallback)
// - sonst Fallback-Kette: 1. Creator-Lieferadresse, 2. Management-Adresse, 3. null
VertraegeCreate.prototype.getResolvedCreatorContractAddress = function(creator, agentur = this.formData) {
    const forceManagement = !!(agentur && agentur.nur_management_adresse);

    if (forceManagement) {
      if (this.hasValidManagementAddress(agentur)) {
        return {
          source: 'management',
          name: agentur.influencer_agentur_name || '',
          strasse: agentur.influencer_agentur_strasse || '',
          hausnummer: agentur.influencer_agentur_hausnummer || '',
          plz: agentur.influencer_agentur_plz || '',
          stadt: agentur.influencer_agentur_stadt || '',
          land: agentur.influencer_agentur_land || 'Deutschland'
        };
      }
      // Schalter an, aber keine gueltige Management-Adresse -> kein Creator-Fallback
      return null;
    }

    if (this.hasValidCreatorAddress(creator)) {
      return {
        source: 'creator',
        strasse: creator.lieferadresse_strasse || '',
        hausnummer: creator.lieferadresse_hausnummer || '',
        plz: creator.lieferadresse_plz || '',
        stadt: creator.lieferadresse_stadt || '',
        land: creator.lieferadresse_land || 'Deutschland'
      };
    }

    if (this.hasValidManagementAddress(agentur)) {
      return {
        source: 'management',
        name: agentur.influencer_agentur_name || '',
        strasse: agentur.influencer_agentur_strasse || '',
        hausnummer: agentur.influencer_agentur_hausnummer || '',
        plz: agentur.influencer_agentur_plz || '',
        stadt: agentur.influencer_agentur_stadt || '',
        land: agentur.influencer_agentur_land || 'Deutschland'
      };
    }

    return null;
};

VertraegeCreate.prototype.renderCreatorAddressPreview = function(creator) {
    const resolved = this.getResolvedCreatorContractAddress(creator);

    if (!creator) return '';

    if (!resolved) {
      this.creatorAddressMissing = true;
      return `
        <div class="address-warning">
          <span>Keine Creator-Adresse und kein Management mit gueltiger Adresse hinterlegt.</span><br>
          <a href="/creator/${escapeHtml(creator.id)}" onclick="event.preventDefault(); window.navigateTo('/creator/${escapeHtml(creator.id)}')">
            Zum Creator-Profil
          </a>
          &nbsp;|&nbsp;
          <a href="/management/new" onclick="event.preventDefault(); window.navigateTo('/management/new')">
            Management anlegen
          </a>
        </div>
      `;
    }

    this.creatorAddressMissing = resolved.source !== 'creator';

    if (resolved.source === 'management') {
      const mgmtId = this.formData._management_id;
      const mgmtLink = mgmtId
        ? `<a href="/management/${escapeHtml(mgmtId)}" onclick="event.preventDefault(); window.navigateTo('/management/${escapeHtml(mgmtId)}')" style="font-size: 12px;">${escapeHtml(resolved.name || 'Management ansehen')}</a>`
        : '';
      const titleText = this.formData.nur_management_adresse
        ? 'Fuer den Vertrag wird ausschliesslich die Management-Adresse verwendet (Creator-Adresse ausgeblendet).'
        : 'Creator hat keine eigene Adresse. Fuer den Vertrag wird die Management-Adresse verwendet.';
      return `
        <div class="contract-address-fallback">
          <div class="contract-address-fallback__title">${titleText}</div>
          <small class="address-text">
            ${resolved.name ? `${escapeHtml(resolved.name)}<br>` : ''}
            ${escapeHtml(resolved.strasse)} ${escapeHtml(resolved.hausnummer)}<br>
            ${escapeHtml(resolved.plz)} ${escapeHtml(resolved.stadt)}<br>
            ${escapeHtml(resolved.land)}
          </small>
          ${mgmtLink}
        </div>
      `;
    }

    return `
      <small class="address-text">
        ${escapeHtml(resolved.strasse)} ${escapeHtml(resolved.hausnummer)}<br>
        ${escapeHtml(resolved.plz)} ${escapeHtml(resolved.stadt)}<br>
        ${escapeHtml(resolved.land)}
      </small>
    `;
};

VertraegeCreate.prototype.updateCreatorAddressPreview = function(creator) {
    const preview = document.getElementById('creator-adresse');
    if (!preview) return;
    preview.innerHTML = this.renderCreatorAddressPreview(creator);
};
