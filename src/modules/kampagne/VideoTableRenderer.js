import { renderVertragCell, renderNutzungsrechteCell } from '../../core/VertragSyncHelper.js';
import { VIDEO_FEEDBACK_FIELDS } from '../../core/VideoFeedbackBuckets.js';
import { getOrderedColumns } from './columns/ColumnRegistry.js';
import { renderCustomHeader, renderCustomCell } from './columns/CustomColumnRenderer.js';
import { renderEmptyState, resolveEmptyState } from '../../core/components/EmptyState.js';
import { hinweisTexte } from '../kooperation/platzhalter.js';
import {
  escapeHtml,
  renderVideoFieldStack,
  renderVideoDatePicker,
  renderExtraKostenInner,
  renderVideoNrInner,
  renderVkInner,
  renderVideoTypInner,
  renderThemaInner,
  renderOrganicPaidInner,
  renderTelefonInner,
  renderTrackingInner,
  renderDrehortInner,
  renderLinkSkriptInner,
  renderCheckboxStackInner,
  renderVideoNameInner,
  renderCaptionInner,
  renderFeedbackInner
} from './videoTableFieldCells.js';
import {
  renderIdeeStrategieInner,
  renderSkriptCell,
  renderContentCell,
  renderStillsCell,
  renderFinaleVersionCell
} from './videoTableMediaCells.js';
import {
  COPY_ICON,
  CHECK_ICON,
  renderCreatorInner,
  renderTagsInner,
  renderProduktInner,
  renderLieferadresseInner,
  renderActionsInner,
  renderStatusSelect as renderStatusSelectCell
} from './videoTableKoopCells.js';

export { COPY_ICON, CHECK_ICON };

export class VideoTableRenderer {
  constructor(table) {
    this.table = table;
  }

  renderStillsCell(koop, video) {
    return renderStillsCell(koop, video);
  }

  renderFinaleVersionCell(koop, video) {
    return renderFinaleVersionCell(koop, video);
  }

  renderStatusSelect(koop) {
    return renderStatusSelectCell(this.table, koop);
  }

  renderVideoFieldStack(videos, fieldRenderer) {
    return renderVideoFieldStack(videos, fieldRenderer);
  }

  escapeHtml(text) {
    return escapeHtml(text);
  }

  renderSkeletonLoading() {
    return `
      <div class="table-loading-container">
        <div class="table-loading-spinner"></div>
      </div>
    `;
  }

  getFilteredKooperationen() {
    const t = this.table;
    if (t.store) return t.store.getFilteredAndSorted(t.activeFilterTab);
    if (t.activeFilterTab === 'offen') {
      return t.kooperationen.filter(koop => !t.areAllVideosApproved(koop.id));
    }
    if (t.activeFilterTab === 'abgeschlossen') {
      return t.kooperationen.filter(koop => t.areAllVideosApproved(koop.id));
    }
    return t.kooperationen;
  }

  render() {
    const t = this.table;

    if (!t.kooperationen || t.kooperationen.length === 0) {
      const isKunde = t.isKundeRole();
      const canCreateKooperation = window.canCreate?.('kooperation') ?? false;
      return renderEmptyState({
        icon: 'film',
        title: 'Keine Kooperationen vorhanden',
        text: isKunde
          ? 'Es wurden noch keine Kooperationen für diese Kampagne angelegt.'
          : 'Erstelle eine Kooperation, um sie hier mit Videos zu verwalten.',
        actionsHtml: canCreateKooperation
          ? `<button class="mdc-btn" onclick="window.navigateToNewKooperationFromKampagne('${t.kampagneId}', null, '${t.produktionId || ''}', '${t.briefingId || ''}')">Kooperation anlegen</button>`
          : ''
      });
    }

    this._hinweisMap = this._platzhalterHinweise();

    const filteredKooperationen = this.getFilteredKooperationen();

    if (filteredKooperationen.length === 0) {
      return resolveEmptyState({
        hasActiveFilters: t.store?.hasActiveFilters?.() || false,
        states: {
          offen: { icon: 'check', title: 'Alle Kooperationen freigegeben', text: 'Es gibt keine offenen Kooperationen mehr.' },
          abgeschlossen: { icon: 'clipboard', title: 'Keine abgeschlossenen Kooperationen', text: 'Noch keine Kooperation hat alle Videos freigegeben.' },
          alle: { icon: 'clipboard', title: 'Keine Kooperationen', text: 'Erstelle eine Kooperation, um sie hier zu verwalten.' }
        }
      }, t.activeFilterTab === 'offen' || t.activeFilterTab === 'abgeschlossen' ? t.activeFilterTab : 'alle');
    }

    this._filteredKooperationen = filteredKooperationen;

    const rows = filteredKooperationen.map((koop, idx) =>
      this.renderKooperationWithVideos(koop, idx + 1)
    ).join('');

    const hasBulkCheck = window.canFeature?.('mediaDownload') ?? false;

    return `
      <div class="grid-wrapper">
        <table class="grid-table kooperation-video-grid${hasBulkCheck ? ' has-final-check' : ''}">
          <thead>
            <tr>
              ${this.renderHeaderRow()}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  _platzhalterHinweise() {
    const t = this.table;
    if (t.isKundeRole?.()) return new Map();
    const koops = t.store?.kooperationen || t.kooperationen || [];
    return hinweisTexte(koops, t.videos || {}, t.deckenStand);
  }

  renderSingleRowHtml(index) {
    this._hinweisMap = this._platzhalterHinweise();
    const koops = this._filteredKooperationen || this.getFilteredKooperationen();
    if (index < 0 || index >= koops.length) return '';
    return this.renderKooperationWithVideos(koops[index], index + 1);
  }

  renderHeaderRow() {
    const t = this.table;
    const hiddenColumns = t.hiddenColumns || [];
    const isKunde = t.isKundeRole();
    const canDragColumns = window.canFeature?.('kampagneTableLayout') ?? false;
    const columns = getOrderedColumns(t.store);

    // Fixe Auswahl-Spalte ganz links (Bulk-Download Finals): nicht Teil der
    // ColumnRegistry, damit sie weder verschieb-/ausblendbar noch resizable ist.
    const bulkCheck = (window.canFeature?.('mediaDownload') ?? false)
      ? `<th class="col-header col-final-check"><input type="checkbox" id="select-all-koop-finals" title="Alle auswählen"></th>`
      : '';

    return bulkCheck + columns.map(col => {
      if (col.isCustom) {
        return renderCustomHeader(col, hiddenColumns, isKunde);
      }
      const vis = t.isColumnVisibleForCustomer(col.id) ? '' : 'style="display:none;"';
      // Drag nur mit Layout-Feature und nur auf verschiebbaren Spalten
      // (Nr/Creator/Aktionen sind fixiert, configurable: false).
      const drag = canDragColumns && col.configurable !== false ? 'draggable="true"' : '';
      return `<th class="col-header ${col.id}" ${vis} data-col="${col.dataCol}" data-col-id="${col.id}" ${drag}>
        ${col.label}
        <div class="resize-handle resize-handle-col" data-col="${col.dataCol}"></div>
      </th>`;
    }).join('\n');
  }

  renderKooperationWithVideos(koop, rowNumber) {
    const t = this.table;
    const allVideos = t.videos[koop.id] || [];
    // Bei aktiver Suche nur die matchenden Video-Zeilen rendern
    // (Koop-Level-Match -> alle, sonst nur Treffer-Zeilen).
    const videos = t.store?.getVisibleVideos
      ? t.store.getVisibleVideos(koop)
      : allVideos;
    const creator = koop.creator || {};
    const hinweis = this._hinweisMap?.get(koop.id) || '';
    const canViewViaPage = window.canViewPage?.('creator');
    const canViewViaPerm = window.currentUser?.permissions?.creator?.can_view;
    const canViewCreator = canViewViaPage !== false && canViewViaPerm !== false;
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';

    // Header und Body laufen ueber dieselbe Spaltenliste: die Zellen folgen
    // der Reihenfolge aus getOrderedColumns (Custom Columns stehen mitten
    // drin, nicht als Block vor den Aktionen). Sonst wandert beim
    // Spalten-Drag nur der Header und der Body bleibt in der alten Reihenfolge.
    const ctx = { t, koop, videos, allVideosCount: allVideos.length, creator, canViewCreator, formatDate, rowNumber, hinweis };
    const cells = getOrderedColumns(t.store)
      .map(col => this._renderBodyCell(col, ctx))
      .join('\n');

    const bulkCheck = (window.canFeature?.('mediaDownload') ?? false)
      ? `<td class="grid-cell col-final-check read-only"><input type="checkbox" class="koop-final-check" data-kooperation-id="${koop.id}"${t._finalBulkDownload?.isSelected(koop.id) ? ' checked' : ''}></td>`
      : '';

    return `
      <tr class="kooperation-row" data-kooperation-id="${koop.id}">
        ${bulkCheck}
        ${cells}
      </tr>
    `;
  }

  _renderBodyCell(col, ctx) {
    if (col.isCustom) {
      return renderCustomCell(col, ctx.koop, ctx.videos, ctx.t.store, ctx.t);
    }
    const renderer = this._bodyCellRenderers()[col.id];
    return renderer ? renderer(ctx) : '';
  }

  /**
   * Einheitliche Body-Zelle: col.id als Klasse plus data-col-id.
   * data-col-id ist der verlaessliche Selektor - Custom-IDs ("custom:uuid")
   * enthalten einen Doppelpunkt und sind als CSS-Klasse unbrauchbar.
   */
  _td(ctx, colId, innerHtml, extraClass = '') {
    const vis = ctx.t.isColumnVisibleForCustomer(colId) ? '' : ' style="display:none;"';
    const cls = extraClass ? `grid-cell ${extraClass} ${colId}` : `grid-cell ${colId}`;
    return `<td class="${cls}" data-col-id="${colId}"${vis}>${innerHtml}</td>`;
  }

  _stackTd(ctx, colId, fieldRenderer, extraClass = 'video-stack-cell') {
    return this._td(ctx, colId, renderVideoFieldStack(ctx.videos, fieldRenderer), extraClass);
  }

  _bodyCellRenderers() {
    if (this._cellRenderers) return this._cellRenderers;

    const map = {
      'col-nr': (c) => this._td(c, 'col-nr', `${c.rowNumber}`, 'read-only'),
      'col-creator': (c) => this._td(c, 'col-creator', renderCreatorInner(c), 'read-only cell-centered'),
      'col-status': (c) => this._td(c, 'col-status', renderStatusSelectCell(c.t, c.koop), 'cell-centered'),
      'col-tags': (c) => this._td(c, 'col-tags', renderTagsInner(c.koop), 'cell-centered'),
      'col-extra-kosten': (c) => this._td(c, 'col-extra-kosten', renderExtraKostenInner(c.koop), 'read-only cell-centered'),
      'col-vertrag': (c) => this._td(c, 'col-vertrag', renderVertragCell(c.koop), 'cell-centered'),
      'col-nutzungsrechte': (c) => this._td(c, 'col-nutzungsrechte', renderNutzungsrechteCell(c.koop), 'cell-centered'),
      'col-video-nr': (c) => this._stackTd(c, 'col-video-nr', (video, index) => renderVideoNrInner(c, video, index)),
      'col-vk-video': (c) => this._stackTd(c, 'col-vk-video', (video) => renderVkInner(video), 'video-stack-cell video-stack-cell--center'),
      'col-video-script-deadline': (c) => this._stackTd(c, 'col-video-script-deadline', (video) => renderVideoDatePicker(c.t, video, 'skript_deadline', 'Script Deadline'), 'video-stack-cell video-stack-cell--center'),
      'col-video-content-deadline': (c) => this._stackTd(c, 'col-video-content-deadline', (video) => renderVideoDatePicker(c.t, video, 'content_deadline', 'Content Deadline'), 'video-stack-cell video-stack-cell--center'),
      'col-video-typ': (c) => this._stackTd(c, 'col-video-typ', (video) => renderVideoTypInner(video), 'video-stack-cell video-stack-cell--center'),
      'col-thema': (c) => this._stackTd(c, 'col-thema', (video) => renderThemaInner(c, video)),
      'col-idee-strategie': (c) => this._stackTd(c, 'col-idee-strategie', (video) => renderIdeeStrategieInner(c, video), 'video-stack-cell video-stack-cell--center'),
      'col-skript': (c) => this._stackTd(c, 'col-skript', (video) => renderSkriptCell(c.koop, video, c.t), 'video-stack-cell video-stack-cell--center'),
      'col-organic-paid': (c) => this._stackTd(c, 'col-organic-paid', (video) => renderOrganicPaidInner(c, video), 'video-stack-cell video-stack-cell--center'),
      'col-produkt': (c) => this._stackTd(c, 'col-produkt', (video) => renderProduktInner(c, video), 'video-stack-cell video-stack-cell--center'),
      'col-lieferadresse': (c) => this._stackTd(c, 'col-lieferadresse', (video) => renderLieferadresseInner(c, video), 'video-stack-cell video-stack-cell--center'),
      'col-telefon': (c) => this._td(c, 'col-telefon', renderTelefonInner(c), 'read-only cell-centered'),
      'col-paket-tracking': (c) => this._stackTd(c, 'col-paket-tracking', (video) => renderTrackingInner(c, video)),
      'col-drehort': (c) => this._stackTd(c, 'col-drehort', (video) => renderDrehortInner(c, video)),
      'col-link-skript': (c) => this._stackTd(c, 'col-link-skript', (video) => renderLinkSkriptInner(c, video)),
      'col-skript-freigegeben': (c) => this._stackTd(c, 'col-skript-freigegeben', (video) => renderCheckboxStackInner(c, video, 'skript_freigegeben'), 'video-stack-cell checkbox-stack'),
      'col-video-name': (c) => this._stackTd(c, 'col-video-name', (video) => renderVideoNameInner(c, video)),
      'col-link-content': (c) => this._stackTd(c, 'col-link-content', (video) => renderContentCell(c.koop, video), 'video-stack-cell video-stack-cell--center'),
      'col-stills': (c) => this._stackTd(c, 'col-stills', (video) => renderStillsCell(c.koop, video), 'video-stack-cell video-stack-cell--center'),
      'col-freigabe': (c) => this._stackTd(c, 'col-freigabe', (video) => renderCheckboxStackInner(c, video, 'freigabe'), 'video-stack-cell checkbox-stack'),
      'col-caption': (c) => this._stackTd(c, 'col-caption', (video) => renderCaptionInner(c, video), 'video-stack-cell wide-field'),
      'col-finale-version': (c) => this._stackTd(c, 'col-finale-version', (video) => renderFinaleVersionCell(c.koop, video), 'video-stack-cell video-stack-cell--center'),
      'col-posting-datum': (c) => this._stackTd(c, 'col-posting-datum', (video) => renderVideoDatePicker(c.t, video, 'posting_datum', 'Posting Datum'), 'video-stack-cell video-stack-cell--center'),
      'col-actions': (c) => this._td(c, 'col-actions', renderActionsInner(c))
    };

    for (const slot of VIDEO_FEEDBACK_FIELDS) {
      map[slot.colClass] = (c) => this._stackTd(
        c,
        slot.colClass,
        (video) => renderFeedbackInner(c, video, slot),
        'video-stack-cell wide-field'
      );
    }

    this._cellRenderers = map;
    return map;
  }
}
