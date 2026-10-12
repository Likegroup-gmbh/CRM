// CreatorDetailKampagnen.js
// Kampagnen und Castings in der Creator-Akte (Prototype-Mixin)

import { CreatorDetail } from './CreatorDetailCore.js';
import { renderKampagnenTable } from '../kampagne/KampagneTable.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { renderEmptyState, renderSectionHeader } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { getSourcingStatus, getKundenFeedback, getSourcingStatusOption, getKundenFeedbackOption } from '../creator-auswahl/sourcingStatusOptions.js';

CreatorDetail.prototype.renderKampagnenContent = function() {
    if (!this.kampagnen || this.kampagnen.length === 0) {
      return renderEmptyState({
        icon: 'megaphone',
        title: 'Keine Kampagnen',
        text: 'Dieser Creator ist noch keiner Kampagne zugeordnet.'
      });
    }

    const flat = this.kampagnen.map(k => {
      const base = k.kampagne || k;
      return {
        id: base.id,
        kampagnenname: base.kampagnenname,
        eigener_name: base.eigener_name,
        unternehmen: base.unternehmen || null,
        marke: base.marke || null,
        art_der_kampagne: base.art_der_kampagne,
        status: base.status,
        start: base.start,
        deadline: base.deadline,
        creatoranzahl: base.creatoranzahl,
        videoanzahl: base.videoanzahl,
      };
    });

    return `
      ${renderSectionHeader({ title: 'Kampagnen' })}
      ${renderKampagnenTable(flat, { showActions: false })}
    `;
};

CreatorDetail.prototype.renderCastingsContent = function() {
    if (!this.castings || this.castings.length === 0) {
      return renderEmptyState({
        icon: 'sourcing',
        title: 'Keine Castings',
        text: 'Dieser Creator war noch auf keinem Casting.'
      });
    }

    const sanitize = (val) => window.validatorSystem?.sanitizeHtml?.(String(val ?? '')) ?? String(val ?? '');
    const rows = this.castings.map((item) => {
      const liste = item.liste;
      const kampagne = liste?.kampagne;
      const statusOpt = getSourcingStatusOption(getSourcingStatus(item));
      const feedbackOpt = getKundenFeedbackOption(getKundenFeedback(item));
      const castingName = sanitize(liste?.name || 'Casting');
      const kampagneName = sanitize(KampagneUtils.getDisplayName(kampagne));
      const castingCell = liste?.id
        ? `<a href="/castings/${liste.id}" class="table-link" data-table="castings" data-id="${liste.id}">${castingName}</a>`
        : castingName;
      const kampagneCell = kampagne?.id
        ? `<a href="/kampagne/${kampagne.id}" class="table-link" data-table="kampagne" data-id="${kampagne.id}">${kampagneName}</a>`
        : kampagneName;

      return `
        <tr>
          <td>${castingCell}</td>
          <td>${kampagneCell}</td>
          <td><span class="status-badge">${sanitize(statusOpt?.label || 'Offen')}</span></td>
          <td>${sanitize(feedbackOpt?.label || '–')}</td>
          <td>${this.formatDate(item.created_at)}</td>
        </tr>
      `;
    }).join('');

    return `
      ${renderSectionHeader({ title: 'Castings' })}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Casting</th>
              <th>Kampagne</th>
              <th>Status</th>
              <th>Kundenfeedback</th>
              <th>Hinzugefügt</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
};
