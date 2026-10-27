// CreatorAddressPreview.js
// Hauptadresse im Vertrag: Auswahl, Vorschau und die Adresszeilen im PDF.

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
// Zeilen mit DB-Inhalt werden umgebrochen (zentriert, max. 170mm), damit lange Firmen-/
// Strassennamen nie ueber den Seitenrand laufen. y = Baseline der letzten Zeile.
VertraegeCreate.prototype.appendPdfCreatorContractAddress = function(doc, y, address, landFallback, x = 105) {
    const centerLine = (text) => {
      const lines = typeof doc.splitTextToSize === 'function' ? doc.splitTextToSize(text, 170) : [text];
      lines.forEach((l, i) => {
        if (i > 0) y += 5;
        doc.text(l, x, y, { align: 'center' });
      });
    };
    if (address?.source === 'firma' && address.name) {
      centerLine(`Firma: ${address.name}`);
      y += 5;
    }
    centerLine(`${address?.strasse || ''} ${address?.hausnummer || ''}`.trim());
    y += 5;
    centerLine(`${address?.plz || ''} ${address?.stadt || ''}`.trim());
    y += 5;
    centerLine(`${address?.land || landFallback || 'Deutschland'}`);
    return y;
};
