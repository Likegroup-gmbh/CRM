// CreatorDetailAdresse.js
// Adressen der Creator-Akte: Hauptadresse und Zusatzadressen (Prototype-Mixin)

import { CreatorDetail } from './CreatorDetailCore.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { renderSectionHeader } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { HAUPTADRESSE_QUELLE, normalizeHauptadresseQuelle } from './hauptadresseQuelle.js';

const PLUS_ICON_SVG = `${icon('plus-lg')}`;

CreatorDetail.prototype.renderAdresseContent = function() {
    const c = this.creator || {};
    const sanitizeVal = (val) => {
      if (val === undefined || val === null || val === '') return '-';
      if (val === '-') return '-';
      return window.validatorSystem.sanitizeHtml(String(val));
    };

    const hauptAdresseTable = `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Firma</th>
              <th>Straße</th>
              <th>Hausnummer</th>
              <th>PLZ</th>
              <th>Stadt</th>
              <th>Land</th>
              ${this.readOnly ? '' : '<th>Aktionen</th>'}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="badge badge-secondary">Creator-Adresse</span></td>
              <td>-</td>
              <td>${sanitizeVal(c.lieferadresse_strasse)}</td>
              <td>${sanitizeVal(c.lieferadresse_hausnummer)}</td>
              <td>${sanitizeVal(c.lieferadresse_plz)}</td>
              <td>${sanitizeVal(c.lieferadresse_stadt)}</td>
              <td>${sanitizeVal(c.lieferadresse_land)}</td>
              ${this.readOnly ? '' : `<td>
                ${actionBuilder.create('creator_hauptadresse', this.creatorId)}
              </td>`}
            </tr>
            ${this.renderZusatzAdressenRows()}
          </tbody>
        </table>
      </div>
    `;

    const neueAdresseBtn = this.readOnly ? '' : `
      <button
        class="mdc-btn mdc-btn--sm"
        onclick="window.creatorAdressenManager?.open('${this.creatorId}')"
      >
        ${PLUS_ICON_SVG}
        Neue Adresse hinzufügen
      </button>
    `;

    return `
      <div class="creator-addresses-container">
        <div class="address-section">
          ${renderSectionHeader({ title: 'Hauptadresse (Vertrag)' })}
          <p class="field-hint">Diese Adresse wird im Vertragsgenerator verwendet. Versandadressen bleiben davon unabhängig.</p>
          ${this.renderHauptadressePicker()}
        </div>
        <div class="address-section">
          ${renderSectionHeader({ title: 'Adressen', actionsHtml: neueAdresseBtn })}
          ${this.creatorAdressen && this.creatorAdressen.length === 0 
            ? `${hauptAdresseTable}<p class="empty-text">Keine zusätzlichen Adressen hinterlegt.</p>` 
            : hauptAdresseTable
          }
        </div>
      </div>
    `;
};

CreatorDetail.prototype.renderHauptadressePicker = function() {
    const c = this.creator || {};
    const selected = normalizeHauptadresseQuelle(c.hauptadresse_quelle);
    const management = (this.managements || [])[0] || null;
    const firma = (this.firmen || [])[0] || null;

    const formatLine = (strasse, hausnummer, plz, stadt, land) => {
      const street = [strasse, hausnummer].filter(Boolean).join(' ').trim();
      const city = [plz, stadt].filter(Boolean).join(' ').trim();
      const parts = [street, city, land].filter(Boolean);
      return parts.length ? parts.join(', ') : 'Keine Adresse hinterlegt';
    };

    const rows = [
      {
        value: HAUPTADRESSE_QUELLE.CREATOR,
        title: 'Creator-Adresse',
        detail: formatLine(c.lieferadresse_strasse, c.lieferadresse_hausnummer, c.lieferadresse_plz, c.lieferadresse_stadt, c.lieferadresse_land),
        enabled: true
      },
      {
        value: HAUPTADRESSE_QUELLE.MANAGEMENT,
        title: management ? `Management: ${management.firmenname || '—'}` : 'Management-Adresse',
        detail: management
          ? formatLine(management.strasse, management.hausnummer, management.plz, management.stadt, management.land)
          : 'Kein Management zugeordnet',
        enabled: !!management
      },
      {
        value: HAUPTADRESSE_QUELLE.FIRMA,
        title: firma ? `Firma: ${firma.firmenname || '—'}` : 'Firmenadresse',
        detail: firma
          ? formatLine(firma.strasse, firma.hausnummer, firma.plz, firma.stadt, firma.land)
          : 'Keine Firma zugeordnet',
        enabled: !!firma
      }
    ];

    return `
      <div class="hauptadresse-picker" role="radiogroup" aria-label="Hauptadresse">
        ${rows.map(row => `
          <label class="radio-option hauptadresse-picker__option ${row.enabled && !this.readOnly ? '' : 'is-disabled'}">
            <input type="radio" name="hauptadresse_quelle" value="${row.value}"
                   ${selected === row.value ? 'checked' : ''}
                   ${row.enabled && !this.readOnly ? '' : 'disabled'}>
            <span>
              <strong>${window.validatorSystem.sanitizeHtml(row.title)}</strong>
              <small>${window.validatorSystem.sanitizeHtml(row.detail)}</small>
            </span>
          </label>
        `).join('')}
      </div>
    `;
};

CreatorDetail.prototype.renderZusatzAdressenRows = function() {
    if (!this.creatorAdressen || this.creatorAdressen.length === 0) {
      return '';
    }

    return this.creatorAdressen.map(adresse => `
      <tr>
        <td>
          <div class="address-name-cell">
            <span>${window.validatorSystem.sanitizeHtml(adresse.adressname)}</span>
            ${adresse.ist_standard ? `
              ${icon('star', { className: 'icon-18' })}
            ` : ''}
          </div>
        </td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.firmenname || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.strasse || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.hausnummer || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.plz || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.stadt || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(adresse.land || 'Deutschland')}</td>
        ${this.readOnly ? '' : `<td>
          ${actionBuilder.create('creator_adresse', adresse.id)}
        </td>`}
      </tr>
    `).join('');
};
