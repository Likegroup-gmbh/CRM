// briefingListZeilen.js
// Zeilen der flachen Briefing-Tabelle: Zellen, Verknüpfungen und Leerzustand.

import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { resolveEmptyState } from '../../core/components/EmptyState.js';
import { BEREICH_LABELS } from './create/fieldConfig.js';
import {
  renderVerknuepfungen,
  namedLinks,
  skriptLinks,
  produktLinksFromJunction
} from '../../core/ui/tableVerknuepfungen.js';
import { renderLeistungszeitraumCell } from '../../core/utils/leistungszeitraum.js';

export function installBriefingListZeilen(proto) {
  Object.assign(proto, {
    renderUnternehmen(briefing) {
      const unternehmen = briefing.unternehmen;
      if (!unternehmen?.firmenname) return '-';

      return avatarBubbles.renderBubbles([{
        name: unternehmen.firmenname,
        type: 'org',
        id: unternehmen.id,
        entityType: 'unternehmen',
        logo_url: unternehmen.logo_url || null
      }]);
    },

    renderMarke(briefing) {
      const marke = briefing.marke;
      if (!marke?.markenname) return '-';

      return avatarBubbles.renderBubbles([{
        name: marke.markenname,
        type: 'org',
        id: marke.id,
        entityType: 'marke',
        logo_url: marke.logo_url || null
      }]);
    },

    renderBereich(bereich) {
      const label = BEREICH_LABELS[bereich] || bereich || '-';
      return `<span class="tag tag--type">${window.validatorSystem.sanitizeHtml(label)}</span>`;
    },

    renderStatus(isDraft) {
      return isDraft
        ? '<span class="tag tag--status tag--warning">Entwurf</span>'
        : '<span class="tag tag--status tag--success">Final</span>';
    },

    renderBriefingRow(b, options = {}) {
      const canBulkDelete = options.checkbox !== false && window.canBulkDelete();
      const escapeHtml = (s) => window.validatorSystem.sanitizeHtml(s || '—');

      return `
        <tr data-id="${b.id}">
          ${canBulkDelete ? `<td class="col-checkbox"><input type="checkbox" class="briefing-check" data-id="${b.id}"></td>` : ''}
          <td class="col-name">
            <a href="#" class="table-link" data-table="briefing" data-id="${b.id}">
              ${escapeHtml((b.aktivierung_name || 'Ohne Namen').toString().slice(0, 80))}
            </a>
          </td>
          <td>${this.renderUnternehmen(b)}</td>
          <td>${this.renderMarke(b)}</td>
          ${renderLeistungszeitraumCell(b.kampagne)}
          <td>${this.renderBereich(b.bereich)}</td>
          <td>${this.renderStatus(b.is_draft)}</td>
          <td>${b.created_at ? new Date(b.created_at).toLocaleDateString('de-DE') : '-'}</td>
          <td>${b.content_deadline ? new Date(b.content_deadline).toLocaleDateString('de-DE') : '-'}</td>
          <td>${renderVerknuepfungen(produktLinksFromJunction(b.produkte))}</td>
          <td>${renderVerknuepfungen(namedLinks(b.verknuepfte_personas, { labelKey: 'name', kind: 'persona' }))}</td>
          <td>${renderVerknuepfungen(namedLinks(b.creator_auswahl, { labelKey: 'name', kind: 'casting' }))}</td>
          <td>${renderVerknuepfungen(namedLinks(b.strategie, { labelKey: 'name', kind: 'konzept' }))}</td>
          <td>${renderVerknuepfungen(skriptLinks(b.skripte))}</td>
          <td class="col-actions">
            ${actionBuilder.create('briefing', b.id)}
          </td>
        </tr>
      `;
    },

    async updateTable(items) {
      const tbody = document.getElementById('briefings-table-body');
      if (!tbody) return;

      const canEdit = window.isAdmin() || window.currentUser?.permissions?.briefing?.can_edit;

      await TableAnimationHelper.animatedUpdate(tbody, async () => {
        if (!items || items.length === 0) {
          const colspan = tbody.closest('table')?.querySelector('thead tr')?.children?.length || 14;
          const html = resolveEmptyState({
            hasActiveFilters: this.hasActiveFilters(),
            states: {
              default: {
                icon: 'document',
                title: 'Keine Briefings vorhanden',
                text: canEdit
                  ? 'Legen Sie ein Briefing an, um es hier zu verwalten.'
                  : 'Es sind noch keine Briefings vorhanden.',
                actionsHtml: canEdit
                  ? '<button id="btn-briefing-new" class="mdc-btn">Neues Briefing anlegen</button>'
                  : ''
              }
            }
          }, 'default');
          tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-state-cell">${html}</td></tr>`;
          return;
        }

        tbody.innerHTML = items.map(b => this.renderBriefingRow(b)).join('');
      });
    }
  });
}
