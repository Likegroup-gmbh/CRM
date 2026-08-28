// CreatorAddressResolver.js
// Laedt Management- und Firmen-Daten fuer den Creator und resolved die Vertragsadresse.
// Ersetzt die fruehere creator_agentur-basierte Logik.

import { VertraegeCreate } from './VertraegeCreateCore.js';
import { HAUPTADRESSE_QUELLE_OPTIONS, normalizeHauptadresseQuelle } from '../../creator/hauptadresseQuelle.js';

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
      this._resetFirmaFields();
      this.formData.hauptadresse_quelle = null;
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

    await this._loadCreatorFirma(creatorId);

    const creator = this.creators.find(c => c.id === creatorId);
    if (creator && this.formData.creator_id === creatorId) {
      this._syncHauptadresseQuelleFromCreator(creator);
      this.updateCreatorAddressPreview(creator);
    }
};

// Laedt aktive Firmen des Creators aus creator_firma/firma und mappt sie
// auf influencer_firma_*-Felder in formData (analog Management).
VertraegeCreate.prototype._loadCreatorFirma = async function(creatorId) {
    if (!creatorId || !window.supabase) {
      if (!creatorId) this._resetFirmaFields();
      return;
    }

    try {
      const { data, error } = await window.supabase
        .from('creator_firma')
        .select(`
          ist_aktiv,
          firma:firma_id (
            id, firmenname, strasse, hausnummer, plz, stadt, land
          )
        `)
        .eq('creator_id', creatorId)
        .eq('ist_aktiv', true);

      if (error) {
        console.error('❌ VERTRAG: Fehler beim Laden creator_firma:', error);
        this._resetFirmaFields();
        return;
      }

      const list = (data || [])
        .filter(item => item.firma)
        .map(item => item.firma);
      this.creatorFirmen = list;

      if (list.length > 0) {
        const keep = list.find(f => f.id === this.formData._firma_id);
        this._applySelectedFirma((keep || list[0]).id);
      } else {
        this._resetFirmaFields();
      }
    } catch (err) {
      console.error('❌ VERTRAG: Exception bei _loadCreatorFirma:', err);
      this._resetFirmaFields();
    }
};

VertraegeCreate.prototype._applySelectedFirma = function(firmaId) {
    const list = this.creatorFirmen || [];
    const f = list.find(x => x.id === firmaId) || list[0];
    if (!f) {
      this._resetFirmaFields();
      return;
    }
    this.formData.influencer_firma_name = f.firmenname || '';
    this.formData.influencer_firma_strasse = f.strasse || '';
    this.formData.influencer_firma_hausnummer = f.hausnummer || '';
    this.formData.influencer_firma_plz = f.plz || '';
    this.formData.influencer_firma_stadt = f.stadt || '';
    this.formData.influencer_firma_land = f.land || 'Deutschland';
    this.formData._firma_id = f.id;
};

VertraegeCreate.prototype._syncHauptadresseQuelleFromCreator = function(creator) {
    if (!creator) return;
    this.formData.hauptadresse_quelle = normalizeHauptadresseQuelle(creator.hauptadresse_quelle);
};

VertraegeCreate.prototype._resetFirmaFields = function() {
    this.creatorFirmen = [];
    this.formData.influencer_firma_name = '';
    this.formData.influencer_firma_strasse = '';
    this.formData.influencer_firma_hausnummer = '';
    this.formData.influencer_firma_plz = '';
    this.formData.influencer_firma_stadt = '';
    this.formData.influencer_firma_land = 'Deutschland';
    this.formData._firma_id = null;
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

VertraegeCreate.prototype.hasValidFirmaAddress = function(agentur = this.formData) {
    if (!agentur) return false;
    const hasStrasse = agentur.influencer_firma_strasse && agentur.influencer_firma_strasse.trim() !== '';
    const hasPlz = agentur.influencer_firma_plz && agentur.influencer_firma_plz.trim() !== '';
    const hasStadt = agentur.influencer_firma_stadt && agentur.influencer_firma_stadt.trim() !== '';
    return hasStrasse && hasPlz && hasStadt;
};

function managementAddressFrom(agentur) {
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

function firmaAddressFrom(agentur) {
    return {
      source: 'firma',
      name: agentur.influencer_firma_name || '',
      strasse: agentur.influencer_firma_strasse || '',
      hausnummer: agentur.influencer_firma_hausnummer || '',
      plz: agentur.influencer_firma_plz || '',
      stadt: agentur.influencer_firma_stadt || '',
      land: agentur.influencer_firma_land || 'Deutschland'
    };
}

// Aufloesung der Vertrags-Hauptadresse:
// - Schalter "nur_management_adresse" AN: erzwinge Management-Adresse
// - sonst die am Creator gewaehlte Quelle (creator | management | firma)
// - ist die Wahl ungueltig: Fallback Creator -> Management -> Firma
VertraegeCreate.prototype.getResolvedCreatorContractAddress = function(creator, agentur = this.formData) {
    agentur = { ...(this.formData || {}), ...(agentur || {}) };
    const forceManagement = !!(agentur && agentur.nur_management_adresse);

    if (forceManagement) {
      if (this.hasValidManagementAddress(agentur)) {
        return managementAddressFrom(agentur);
      }
      return null;
    }

    const quelle = normalizeHauptadresseQuelle(
      agentur.hauptadresse_quelle || creator?.hauptadresse_quelle
    );

    const byQuelle = {
      firma: () => this.hasValidFirmaAddress(agentur) ? firmaAddressFrom(agentur) : null,
      management: () => this.hasValidManagementAddress(agentur) ? managementAddressFrom(agentur) : null,
      creator: () => this.hasValidCreatorAddress(creator) ? {
        source: 'creator',
        strasse: creator.lieferadresse_strasse || '',
        hausnummer: creator.lieferadresse_hausnummer || '',
        plz: creator.lieferadresse_plz || '',
        stadt: creator.lieferadresse_stadt || '',
        land: creator.lieferadresse_land || 'Deutschland'
      } : null
    };

    const selected = byQuelle[quelle]();
    if (selected) return selected;

    const fallbackOrder = ['creator', 'management', 'firma'].filter(q => q !== quelle);
    for (const q of fallbackOrder) {
      const resolved = byQuelle[q]();
      if (resolved) return resolved;
    }

    return null;
};

VertraegeCreate.prototype.renderCreatorAddressPreview = function(creator) {
    const resolved = this.getResolvedCreatorContractAddress(creator);

    if (!creator) return '';

    const picker = this._renderHauptadresseQuelleSelect(creator, resolved);

    if (!resolved) {
      this.creatorAddressMissing = true;
      return `
        ${picker}
        <div class="address-warning">
          <span>Keine Creator-, Firmen- oder Management-Adresse mit gültigen Daten hinterlegt.</span><br>
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

    this.creatorAddressMissing = resolved.source !== 'creator' && resolved.source !== 'firma';

    if (resolved.source === 'firma') {
      return `
        ${picker}
        <div class="contract-address-fallback">
          <div class="contract-address-fallback__title">Fuer den Vertrag wird die Firmenadresse als Hauptadresse verwendet.</div>
          <small class="address-text">
            ${resolved.name ? `${escapeHtml(resolved.name)}<br>` : ''}
            ${escapeHtml(resolved.strasse)} ${escapeHtml(resolved.hausnummer)}<br>
            ${escapeHtml(resolved.plz)} ${escapeHtml(resolved.stadt)}<br>
            ${escapeHtml(resolved.land)}
          </small>
        </div>
      `;
    }

    if (resolved.source === 'management') {
      const mgmtId = this.formData._management_id;
      const mgmtLink = mgmtId
        ? `<a href="/management/${escapeHtml(mgmtId)}" onclick="event.preventDefault(); window.navigateTo('/management/${escapeHtml(mgmtId)}')" class="creator-mgmt-link">${escapeHtml(resolved.name || 'Management ansehen')}</a>`
        : '';
      const titleText = this.formData.nur_management_adresse
        ? 'Fuer den Vertrag wird ausschliesslich die Management-Adresse verwendet (Creator-Adresse ausgeblendet).'
        : (normalizeHauptadresseQuelle(this.formData.hauptadresse_quelle || creator.hauptadresse_quelle) === 'management'
          ? 'Fuer den Vertrag wird die Management-Adresse als Hauptadresse verwendet.'
          : 'Creator hat keine eigene Adresse. Fuer den Vertrag wird die Management-Adresse verwendet.');
      return `
        ${picker}
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
      ${picker}
      <small class="address-text">
        ${escapeHtml(resolved.strasse)} ${escapeHtml(resolved.hausnummer)}<br>
        ${escapeHtml(resolved.plz)} ${escapeHtml(resolved.stadt)}<br>
        ${escapeHtml(resolved.land)}
      </small>
    `;
};

VertraegeCreate.prototype._availableHauptadresseQuellen = function() {
    const options = [];
    options.push(HAUPTADRESSE_QUELLE_OPTIONS[0]);
    if ((this.creatorManagements && this.creatorManagements.length > 0) || this.hasValidManagementAddress()) {
      options.push(HAUPTADRESSE_QUELLE_OPTIONS[1]);
    }
    if ((this.creatorFirmen && this.creatorFirmen.length > 0) || this.hasValidFirmaAddress()) {
      options.push(HAUPTADRESSE_QUELLE_OPTIONS[2]);
    }
    return options;
};

VertraegeCreate.prototype._renderHauptadresseQuelleSelect = function(creator, resolved) {
    const options = this._availableHauptadresseQuellen();
    if (options.length < 2) return '';

    const selected = normalizeHauptadresseQuelle(
      this.formData.hauptadresse_quelle || creator?.hauptadresse_quelle
    );
    const optionHtml = options.map(o =>
      `<option value="${escapeHtml(o.value)}" ${o.value === selected ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
    ).join('');

    const fallbackHint = resolved && resolved.source !== selected
      ? `<small class="field-hint">Gewählte Hauptadresse ist unvollständig. Es wird die ${escapeHtml(resolved.source === 'firma' ? 'Firmenadresse' : resolved.source === 'management' ? 'Management-Adresse' : 'Creator-Adresse')} verwendet.</small>`
      : '';

    return `
      <div class="form-field hauptadresse-quelle-field">
        <label for="vertrag_hauptadresse_quelle">Hauptadresse</label>
        <select id="vertrag_hauptadresse_quelle" name="vertrag_hauptadresse_quelle">
          ${optionHtml}
        </select>
        ${fallbackHint}
      </div>
    `;
};

VertraegeCreate.prototype.selectVertragHauptadresse = async function(quelle) {
    quelle = normalizeHauptadresseQuelle(quelle);
    this.formData.hauptadresse_quelle = quelle;
    const creator = this.creators.find(c => c.id === this.formData.creator_id);
    if (creator) {
      creator.hauptadresse_quelle = quelle;
      this.updateCreatorAddressPreview(creator);
      if (window.supabase && creator.id) {
        const { error } = await window.supabase
          .from('creator')
          .update({ hauptadresse_quelle: quelle })
          .eq('id', creator.id);
        if (error) {
          console.error('❌ VERTRAG: Hauptadresse konnte nicht gespeichert werden:', error);
        }
      }
    }
};

VertraegeCreate.prototype.updateCreatorAddressPreview = function(creator) {
    const preview = document.getElementById('creator-adresse');
    if (!preview) return;
    preview.innerHTML = this.renderCreatorAddressPreview(creator);
    const select = preview.querySelector('#vertrag_hauptadresse_quelle');
    if (select) {
      select.addEventListener('change', (e) => {
        this.selectVertragHauptadresse(e.target.value);
      });
    }
};

// Schreibt Firmenname (falls Hauptadresse = Firma) plus Strasse/PLZ/Land in ein PDF.
// Gibt die Y-Position nach der letzten Adresszeile zurueck.
VertraegeCreate.prototype.appendPdfCreatorContractAddress = function(doc, y, address, landFallback, x = 105) {
    if (address?.source === 'firma' && address.name) {
      doc.text(`Firma: ${address.name}`, x, y, { align: 'center' });
      y += 5;
    }
    doc.text(`${address?.strasse || ''} ${address?.hausnummer || ''}`.trim(), x, y, { align: 'center' });
    y += 5;
    doc.text(`${address?.plz || ''} ${address?.stadt || ''}`.trim(), x, y, { align: 'center' });
    y += 5;
    doc.text(`${address?.land || landFallback || 'Deutschland'}`, x, y, { align: 'center' });
    return y;
};
