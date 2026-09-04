import { renderVertragCell, renderNutzungsrechteCell } from '../../core/VertragSyncHelper.js';
import { formatVideoFeedbackValue, VIDEO_FEEDBACK_FIELDS } from '../../core/VideoFeedbackBuckets.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { getOrderedColumns, isColumnVisible, isCustomColumnId } from './columns/ColumnRegistry.js';
import { renderCustomHeader, renderCustomCell } from './columns/CustomColumnRenderer.js';
import { renderEmptyState, resolveEmptyState } from '../../core/components/EmptyState.js';
import { formatCompactNumber, formatExactNumber } from '../../core/format/compactNumber.js';
import { renderChipCell, renderPlatformChip, renderStaticChip } from '../../core/components/chipCell.js';
import { liveLinkDotState, LIVE_LINK_TOOLBAR } from './liveLinkCell.js';
import { getCachedCreatorUploadStatus } from './CreatorUploadActions.js';
import { icon } from '../../core/icons/IconSystem.js';
import { finalStills, stillsForVideoCell } from '../../core/stills/stillAssets.js';
import { STILL_FINAL_VARIANT } from '../../core/PromoteFinalAsset.js';
import { toRawDropboxUrl, canPreviewImageAsset } from '../../core/VideoUploadUtils.js';

const EXTERNAL_LINK_ICON = `${icon('arrow-top-right')}`;

const INSTAGRAM_ICON = `${icon('instagram')}`;

const TIKTOK_ICON = `${icon('tiktok')}`;

const PLAY_ICON = `${icon('play-circle')}`;

const FOLDER_ICON = `${icon('folder-open')}`;

const STORYS_ICON = `${icon('device-phone')}`;

const BILDER_ICON = `${icon('photo')}`;

const GEAR_ICON = `${icon('cog')}`;

const UPLOAD_ICON = `${icon('upload')}`;

const SKRIPT_ICON = `${icon('skripte', { className: 'w-4 h-4' })}`;

const SKRIPT_EDIT_ICON = `${icon('pencil-square', { className: 'w-4 h-4' })}`;

// Auch vom VideoTableEventBinder genutzt (Copy-Feedback)
export const COPY_ICON = `${icon('squares-2x2')}`;

export const CHECK_ICON = `${icon('check')}`;

export class VideoTableRenderer {
  constructor(table) {
    this.table = table;
  }

  _renderVideoDatePicker(video, fieldName, label) {
    const t = this.table;
    const formatDate = (d) => {
      if (!d) return '—';
      const date = new Date(d + 'T00:00:00');
      if (isNaN(date)) return '—';
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    if (t.isKundeRole() || !t.isFieldEditableForUser('video', fieldName)) {
      return `<div class="video-deadline-text">${formatDate(video[fieldName])}</div>`;
    }
    const pickerHtml = CustomDatePicker.render({
      id: video.id,
      entity: 'video',
      field: fieldName,
      value: video[fieldName],
      label,
      inputClass: 'video-date-picker-input'
    });
    const displayText = formatDate(video[fieldName]);
    return `<div class="video-date-cell">${pickerHtml}<span class="video-date-display">${displayText}</span></div>`;
  }

  /**
   * Live-Link-Zelle: sichtbar ist nur der Chip ("Reel · @handle") plus ein
   * kleiner Status-Punkt. Die drei Aktionen (Statistiken abrufen, Video
   * oeffnen, Link entfernen) liegen in einer schwebenden Hover-Toolbar, die
   * bei Hover ueber der Zelle erscheint. data-hover-toolbar genuegt dafuer -
   * die Engine bindet global, die Aktionen stehen in liveLinkToolbarConfig.
   *
   * Das Geruest kommt aus chipCell (src/core/components), die Sourcing-Tabelle
   * nutzt dasselbe fuer ihre Instagram-Spalte. Der Chip ist ein Overlay ueber
   * dem Input - dasselbe Muster wie bei den Stats-Zahlen
   * (_renderStatsNumberCell): der Input haelt die Roh-URL, beim Fokussieren
   * blendet CSS den Chip aus. Vorher standen Input, Haekchen, Extern-Link und X
   * in einer Flex-Row; der Input wurde dabei zerdrueckt und sprang in der
   * Breite, sobald ein Link gespeichert war.
   */
  _renderLiveLinkCell(koop, video) {
    const t = this.table;
    const url = video.link_live || '';
    const handle = koop?.creator?.instagram || koop?.creator?.tiktok || '';
    const chip = renderPlatformChip(url, handle);

    if (t.isKundeRole() || !t.isFieldEditableForUser('video', 'link_live')) {
      return renderStaticChip({ href: url, chip, title: 'Video öffnen' })
        || `<span class="stacked-video-empty">-</span>`;
    }

    return renderChipCell({
      toolbar: LIVE_LINK_TOOLBAR,
      id: video.id,
      input: {
        className: 'grid-input stacked-video-input',
        value: url,
        placeholder: 'Reel-Link',
        attrs: {
          'data-entity': 'video',
          'data-id': video.id,
          'data-field': 'link_live',
          'data-live-link-handle': handle
        }
      },
      chip,
      dot: liveLinkDotState(video)
    });
  }

  /**
   * Views/Likes/Kommentare. Editierbar, weil der Abruf nicht immer greift
   * (Creator ohne Business-Account, Collab-Post unter dem Marken-Handle) -
   * dann traegt man die Zahl von Hand ein.
   *
   * Wie die Follower-Zelle im Sourcing: der Rohwert steckt im Input, darueber
   * liegt die kompakte Anzeige (21,6K / 1,39M). Beim Fokussieren blendet CSS
   * das Overlay aus, editiert wird also immer die exakte Zahl.
   */
  _renderStatsNumberCell(video, fieldName, label) {
    const t = this.table;
    const value = video[fieldName];
    const compact = formatCompactNumber(value);
    const exact = formatExactNumber(value);

    if (t.isKundeRole() || !t.isFieldEditableForUser('video', fieldName)) {
      return `<div class="video-stats-text" title="${exact}">${compact || '—'}</div>`;
    }

    return `
      <div class="video-stats-cell">
        <input type="text" inputmode="numeric" class="grid-input stacked-video-input cell-number__input"
          data-entity="video" data-id="${video.id}" data-field="${fieldName}" data-value-type="compact-integer"
          value="${value != null ? value : ''}" aria-label="${this.escapeHtml(label)}"/>
        <span class="cell-number__display" data-number-display title="${exact}">${compact || '—'}</span>
      </div>
    `;
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
      return renderEmptyState({
        icon: 'film',
        title: 'Keine Kooperationen vorhanden',
        text: isKunde
          ? 'Es wurden noch keine Kooperationen für diese Kampagne angelegt.'
          : 'Erstelle eine Kooperation, um sie hier mit Videos zu verwalten.',
        actionsHtml: !isKunde
          ? `<button class="mdc-btn" onclick="window.navigateToNewKooperationFromKampagne('${t.kampagneId}')">Kooperation anlegen</button>`
          : ''
      });
    }

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

    return `
      <div class="grid-wrapper">
        <table class="grid-table kooperation-video-grid">
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

  renderSingleRowHtml(index) {
    const koops = this._filteredKooperationen || this.getFilteredKooperationen();
    if (index < 0 || index >= koops.length) return '';
    return this.renderKooperationWithVideos(koops[index], index + 1);
  }

  renderHeaderRow() {
    const t = this.table;
    const hiddenColumns = t.hiddenColumns || [];
    const isKunde = t.isKundeRole();
    const columns = getOrderedColumns(t.store);

    return columns.map(col => {
      if (col.isCustom) {
        return renderCustomHeader(col, hiddenColumns, isKunde);
      }
      const vis = t.isColumnVisibleForCustomer(col.id) ? '' : 'style="display:none;"';
      return `<th class="col-header ${col.id}" ${vis} data-col="${col.dataCol}" draggable="true">
        ${col.label}
        <div class="resize-handle resize-handle-col" data-col="${col.dataCol}"></div>
      </th>`;
    }).join('\n');
  }

  renderKooperationWithVideos(koop, rowNumber) {
    const t = this.table;
    const videos = t.videos[koop.id] || [];
    const creator = koop.creator || {};
    const canViewViaPage = window.canViewPage?.('creator');
    const canViewViaPerm = window.currentUser?.permissions?.creator?.can_view;
    const canViewCreator = !t.isKundeRole() && canViewViaPage !== false && canViewViaPerm !== false;
    
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';

    return `
      <tr class="kooperation-row" data-kooperation-id="${koop.id}">
        <td class="grid-cell read-only" ${!t.isColumnVisibleForCustomer('col-nr') ? 'style="display:none;"' : ''}>${rowNumber}</td>
        <td class="grid-cell read-only" ${!t.isColumnVisibleForCustomer('col-creator') ? 'style="display:none;"' : ''}>
          ${canViewCreator && creator.id
            ? `<a href="/creator/${creator.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${creator.id}')" class="table-link">
            ${this.escapeHtml(`${creator.vorname || ''} ${creator.nachname || ''}`.trim() || 'Unbekannt')}
          </a>`
            : this.escapeHtml(`${creator.vorname || ''} ${creator.nachname || ''}`.trim() || 'Unbekannt')}
          ${(creator.instagram || creator.tiktok) ? `<div class="creator-social-links">
            ${creator.instagram ? `<a href="${creator.instagram.startsWith('http') ? this.escapeHtml(creator.instagram) : `https://instagram.com/${encodeURIComponent(creator.instagram.replace('@', ''))}`}" target="_blank" rel="noopener" title="@${this.escapeHtml(creator.instagram)}">${INSTAGRAM_ICON}</a>` : ''}
            ${creator.tiktok ? `<a href="${creator.tiktok.startsWith('http') ? this.escapeHtml(creator.tiktok) : `https://tiktok.com/@${encodeURIComponent(creator.tiktok.replace('@', ''))}`}" target="_blank" rel="noopener" title="@${this.escapeHtml(creator.tiktok)}">${TIKTOK_ICON}</a>` : ''}
          </div>` : ''}
        </td>
        <td class="grid-cell col-status" ${!t.isColumnVisibleForCustomer('col-status') ? 'style="display:none;"' : ''}>
          ${this.renderStatusSelect(koop)}
        </td>
        <td class="grid-cell col-tags" ${!t.isColumnVisibleForCustomer('col-tags') ? 'style="display:none;"' : ''}>
          ${(koop._tags || []).length > 0
            ? `<div class="tags tags-compact">${koop._tags.map(name => `<span class="tag tag--branche">${this.escapeHtml(name)}</span>`).join('')}</div>`
            : '<span class="text-muted">-</span>'}
        </td>
        <td class="grid-cell read-only" ${!t.isColumnVisibleForCustomer('col-extra-kosten') ? 'style="display:none;"' : ''}>
          ${koop.verkaufspreis_zusatzkosten != null && parseFloat(koop.verkaufspreis_zusatzkosten) !== 0
            ? parseFloat(koop.verkaufspreis_zusatzkosten).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
            : '—'}
        </td>
        <td class="grid-cell cell-centered" ${!t.isColumnVisibleForCustomer('col-vertrag') ? 'style="display:none;"' : ''}>
          ${renderVertragCell(koop)}
        </td>
        <td class="grid-cell cell-centered" ${!t.isColumnVisibleForCustomer('col-nutzungsrechte') ? 'style="display:none;"' : ''}>
          ${renderNutzungsrechteCell(koop)}
        </td>
        <td class="grid-cell read-only" ${!t.isColumnVisibleForCustomer('col-start-datum') ? 'style="display:none;"' : ''}>${formatDate(koop.created_at)}</td>
        <td class="grid-cell read-only" ${!t.isColumnVisibleForCustomer('col-videoanzahl') ? 'style="display:none;"' : ''}>${koop.videoanzahl || 0}</td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-video-nr') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video, index, total) => {
            const videoNr = index + 1;
            return `<div class="video-nr-text">${videoNr}/${total}</div>`;
          })}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-vk-video') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const vk = video.verkaufspreis_netto != null ? parseFloat(video.verkaufspreis_netto) : null;
            return vk != null ? `<div class="video-vk-text">${vk.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>` : '<div class="video-vk-text">—</div>';
          })}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-video-script-deadline') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => this._renderVideoDatePicker(video, 'skript_deadline', 'Script Deadline'))}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-video-content-deadline') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => this._renderVideoDatePicker(video, 'content_deadline', 'Content Deadline'))}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-video-typ') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            return `<div class="video-typ-text">${this.escapeHtml(video.kampagnenart || '—')}</div>`;
          })}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-thema') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <input type="text" class="grid-input stacked-video-input"
              data-entity="video" data-id="${video.id}" data-field="thema"
              ${!t.isFieldEditableForUser('video', 'thema') ? 'readonly' : ''}
              value="${this.escapeHtml(video.thema || '')}" placeholder="Thema"/>
          `)}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-idee-strategie') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const canLink = !t.isKundeRole();
            if (video.strategie_item && video.strategie_item.screenshot_url) {
              const videoLink = video.strategie_item.video_link;
              const screenshotUrl = video.strategie_item.screenshot_url;
              const beschreibung = video.strategie_item.beschreibung || 'Strategie-Idee';
              const href = videoLink || `/strategie/${video.strategie_item.strategie_id}`;
              const targetAttr = videoLink ? ' target="_blank" rel="noopener noreferrer"' : '';
              if (canLink) {
                return `
                  <button type="button" class="thema-link-btn thema-link-btn--linked"
                    data-action="link-strategie-item"
                    data-video-id="${video.id}"
                    data-kooperation-id="${koop.id}"
                    title="${this.escapeHtml(beschreibung)}">
                    <img src="${screenshotUrl}" alt="Thema" class="thema-thumbnail" />
                  </button>
                `;
              }
              return `
                <a href="${href}" class="thema-thumbnail-link" title="${this.escapeHtml(beschreibung)}"${targetAttr}>
                  <img src="${screenshotUrl}" alt="Thema" class="thema-thumbnail" />
                </a>
              `;
            }
            if (canLink) {
              return `
                <button type="button" class="thema-link-btn"
                  data-action="link-strategie-item"
                  data-video-id="${video.id}"
                  data-kooperation-id="${koop.id}">
                  Idee verknüpfen
                </button>
              `;
            }
            return `<span class="no-strategie-hint">Noch kein Thema/Strategie verknüpft</span>`;
          })}
        </td>
        <td class="grid-cell video-stack-cell col-skript" ${!t.isColumnVisibleForCustomer('col-skript') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => this.renderSkriptCell(koop, video))}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-organic-paid') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <select class="grid-select stacked-video-select" 
              data-entity="video" data-id="${video.id}" data-field="content_art"
              ${!t.isFieldEditableForUser('video', 'content_art') ? 'disabled' : ''}>
              <option value="">– bitte wählen –</option>
              <option value="Paid" ${video.content_art === 'Paid' ? 'selected' : ''}>Paid</option>
              <option value="Organisch" ${video.content_art === 'Organisch' ? 'selected' : ''}>Organisch</option>
              <option value="Influencer" ${video.content_art === 'Influencer' ? 'selected' : ''}>Influencer</option>
              <option value="Videograph" ${video.content_art === 'Videograph' ? 'selected' : ''}>Videograph</option>
              <option value="Whitelisting" ${video.content_art === 'Whitelisting' ? 'selected' : ''}>Whitelisting</option>
              <option value="Spark-Ad" ${video.content_art === 'Spark-Ad' ? 'selected' : ''}>Spark-Ad</option>
            </select>
          `)}
        </td>
        <td class="grid-cell video-stack-cell col-produkt" ${!t.isColumnVisibleForCustomer('col-produkt') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const versandForVideo = t.getVersandForVideo(video.id);
            return `
              <input type="text" class="grid-input stacked-video-input" 
                data-entity="versand" 
                data-id="${versandForVideo?.id || 'new'}"
                data-video-id="${video.id}"
                data-kooperation-id="${koop.id}"
                data-field="produkt_name"
                ${!t.isFieldEditableForUser('versand', 'produkt_name') ? 'readonly' : ''}
                value="${this.escapeHtml(versandForVideo?.produkt_name || '')}" 
                placeholder="Produktname"/>
              <input type="url" class="grid-input stacked-video-input" 
                data-entity="versand" 
                data-id="${versandForVideo?.id || 'new'}"
                data-video-id="${video.id}"
                data-kooperation-id="${koop.id}"
                data-field="produkt_link"
                ${!t.isFieldEditableForUser('versand', 'produkt_link') ? 'readonly' : ''}
                value="${this.escapeHtml(versandForVideo?.produkt_link || '')}" 
                placeholder="Produktlink (optional)"/>
            `;
          })}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-lieferadresse') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const versandForVideo = t.getVersandForVideo(video.id);
            let strasse = '';
            let plzStadt = '';
            let land = '';

            if (versandForVideo?.creator_adresse_id) {
              const ca = (t.store || t).creatorAdressen?.[versandForVideo.creator_adresse_id];
              if (ca) {
                strasse = [ca.strasse, ca.hausnummer].filter(Boolean).join(' ');
                plzStadt = [ca.plz, ca.stadt].filter(Boolean).join(' ');
                land = ca.land || '';
              }
            } else if (versandForVideo?.strasse) {
              strasse = [versandForVideo.strasse, versandForVideo.hausnummer].filter(Boolean).join(' ');
              plzStadt = [versandForVideo.plz, versandForVideo.stadt].filter(Boolean).join(' ');
              land = versandForVideo.land || '';
            }

            if (!strasse && !plzStadt && koop.creator) {
              strasse = [koop.creator.lieferadresse_strasse, koop.creator.lieferadresse_hausnummer]
                .filter(Boolean).join(' ');
              plzStadt = [koop.creator.lieferadresse_plz, koop.creator.lieferadresse_stadt]
                .filter(Boolean).join(' ');
              land = koop.creator.lieferadresse_land || '';
            }

            const lines = [strasse, plzStadt].filter(Boolean);
            const copyText = [strasse, plzStadt, land].filter(Boolean).join('\n');
            if (lines.length === 0) lines.push('-');
            const addressHtml = `<div class="small-text address-text">`
                 + lines.map(l => `<div class="address-line">${this.escapeHtml(l)}</div>`).join('')
                 + (land ? `<div class="address-line address-land-text">${this.escapeHtml(land)}</div>` : '')
                 + `</div>`;
            const copyBtn = copyText
              ? `<button type="button" class="address-copy-btn" data-action="copy-address" data-address="${this.escapeHtml(copyText)}" title="Adresse kopieren">${COPY_ICON}</button>`
              : '';
            return `<div class="address-cell">${addressHtml}${copyBtn}</div>`;
          })}
        </td>
        <td class="grid-cell read-only" ${!t.isColumnVisibleForCustomer('col-telefon') ? 'style="display:none;"' : ''}>
          ${koop.creator?.telefonnummer
            ? `<a href="tel:${this.escapeHtml(koop.creator.telefonnummer)}" class="small-text telefon-link">${this.escapeHtml(koop.creator.telefonnummer)}</a>`
            : '<span class="text-muted">-</span>'}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-paket-tracking') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const versandForVideo = t.getVersandForVideo(video.id);
            return `
              <input type="text" class="grid-input stacked-video-input" 
                data-entity="versand" 
                data-id="${versandForVideo?.id || 'new'}"
                data-video-id="${video.id}"
                data-kooperation-id="${koop.id}"
                data-field="tracking_nummer"
                ${!t.isFieldEditableForUser('versand', 'tracking_nummer') ? 'readonly' : ''}
                value="${this.escapeHtml(versandForVideo?.tracking_nummer || '')}" 
                placeholder="Tracking Nr."/>
            `;
          })}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-drehort') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <input type="text" class="grid-input stacked-video-input" 
              data-entity="video" data-id="${video.id}" data-field="drehort"
              ${!t.isFieldEditableForUser('video', 'drehort') ? 'readonly' : ''}
              value="${this.escapeHtml(video.drehort || '')}" placeholder="Drehort"/>
          `)}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-link-skript') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            if (t.isKundeRole()) {
              const url = video.link_skript || '';
              return url
                ? `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="external-link-btn stacked-video-link-btn" title="Skript öffnen">${EXTERNAL_LINK_ICON}</a>`
                : `<span class="stacked-video-empty">-</span>`;
            }
            return `
              <input type="text" class="grid-input stacked-video-input" 
                data-entity="video" data-id="${video.id}" data-field="link_skript"
                value="${this.escapeHtml(video.link_skript || '')}" placeholder="Link"/>
            `;
          })}
        </td>
        <td class="grid-cell video-stack-cell checkbox-stack" ${!t.isColumnVisibleForCustomer('col-skript-freigegeben') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <div class="stacked-video-checkbox-wrapper">
              <input type="checkbox" class="grid-checkbox stacked-video-checkbox" 
                data-entity="video" data-id="${video.id}" data-field="skript_freigegeben"
                ${!t.isFieldEditableForUser('video', 'skript_freigegeben') ? 'disabled' : ''}
                ${video.skript_freigegeben ? 'checked' : ''}/>
            </div>
          `)}
        </td>
        <td class="grid-cell video-stack-cell col-video-name" ${!t.isColumnVisibleForCustomer('col-video-name') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <input type="text" class="grid-input stacked-video-input"
              data-entity="video" data-id="${video.id}" data-field="video_name"
              ${!t.isFieldEditableForUser('video', 'video_name') ? 'readonly' : ''}
              value="${this.escapeHtml(video.video_name || '')}" placeholder="Video-Name"/>
          `)}
        </td>
        <td class="grid-cell video-stack-cell col-link-content" ${!t.isColumnVisibleForCustomer('col-link-content') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => this.renderContentCell(koop, video))}
        </td>
        <td class="grid-cell video-stack-cell col-stills" ${!t.isColumnVisibleForCustomer('col-stills') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => this.renderStillsCell(koop, video))}
        </td>
        ${VIDEO_FEEDBACK_FIELDS.map(slot => `
        <td class="grid-cell video-stack-cell wide-field" ${!t.isColumnVisibleForCustomer(slot.colClass) ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const comments = t.videoComments[video.id];
            const value = formatVideoFeedbackValue(comments, slot.bucket);
            return `<textarea class="grid-textarea stacked-video-textarea auto-resize-textarea" 
              data-entity="video" data-id="${video.id}" data-field="${slot.field}"
              ${!t.isFieldEditableForUser('video', slot.field) ? 'readonly' : ''}
              placeholder="${slot.label}" rows="1">${this.escapeHtml(value)}</textarea>`;
          })}
        </td>`).join('')}
        <td class="grid-cell video-stack-cell checkbox-stack" ${!t.isColumnVisibleForCustomer('col-freigabe') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <div class="stacked-video-checkbox-wrapper">
              <input type="checkbox" class="grid-checkbox stacked-video-checkbox"
                data-entity="video" data-id="${video.id}" data-field="freigabe"
                ${!t.isFieldEditableForUser('video', 'freigabe') ? 'disabled' : ''}
                ${video.freigabe ? 'checked' : ''}/>
            </div>
          `)}
        </td>
        <td class="grid-cell video-stack-cell wide-field" ${!t.isColumnVisibleForCustomer('col-caption') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <textarea class="grid-textarea stacked-video-textarea auto-resize-textarea" 
              data-entity="video" data-id="${video.id}" data-field="caption"
              ${!t.isFieldEditableForUser('video', 'caption') ? 'readonly' : ''}
              placeholder="Caption" rows="1">${this.escapeHtml(video.caption || '')}</textarea>
          `)}
        </td>
        <td class="grid-cell video-stack-cell col-finale-version" ${!t.isColumnVisibleForCustomer('col-finale-version') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => this.renderFinaleVersionCell(koop, video))}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-posting-datum') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => this._renderVideoDatePicker(video, 'posting_datum', 'Posting Datum'))}
        </td>
        <td class="grid-cell video-stack-cell col-link-live" ${!t.isColumnVisibleForCustomer('col-link-live') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => this._renderLiveLinkCell(koop, video))}
        </td>
        <td class="grid-cell video-stack-cell col-stats-views" ${!t.isColumnVisibleForCustomer('col-stats-views') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => this._renderStatsNumberCell(video, 'stats_views', 'Views'))}
        </td>
        <td class="grid-cell video-stack-cell col-stats-likes" ${!t.isColumnVisibleForCustomer('col-stats-likes') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => this._renderStatsNumberCell(video, 'stats_likes', 'Likes'))}
        </td>
        <td class="grid-cell video-stack-cell col-stats-comments" ${!t.isColumnVisibleForCustomer('col-stats-comments') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => this._renderStatsNumberCell(video, 'stats_comments', 'Kommentare'))}
        </td>
        ${this._renderCustomColumnCells(koop, videos)}
        <td class="grid-cell col-actions" ${!t.isColumnVisibleForCustomer('col-actions') ? 'style="display:none;"' : ''}>
          <div class="actions-dropdown-container" data-entity-type="kooperation">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              ${icon('dots-grid', { className: 'w-5 h-5' })}
            </button>
            <div class="actions-dropdown">
              ${this.renderActionStatusSubmenu(koop)}
              <a href="#" class="action-item" data-action="edit" data-id="${koop.id}" data-return-to="/kampagne/${t.kampagneId}">
                ${icon('pencil-square', { className: 'w-4 h-4' })}
                Bearbeiten
              </a>
              ${this.renderCreatorUploadItems(koop)}
              ${t.canDeleteKooperation() ? `
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${koop.id}">
                  ${icon('trash-alt', { className: 'w-4 h-4' })}
                  Löschen
                </a>
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  renderContentCell(koop, video) {
    const t = this.table;
    const isKunde = t.isKundeRole();
    const folderUrl = video.folder_url;
    const storyFolderUrl = video.story_folder_url;
    const videoUrl = video.file_url || video.link_content || video.asset_url;
    const hasPlayable = !!videoUrl;
    const hasStorys = !!storyFolderUrl;
    const hasContent = hasPlayable || !!folderUrl || hasStorys;

    const buttons = [];

    if (hasPlayable) {
      buttons.push(`<button type="button" class="external-link-btn media-action-btn play-btn" data-action="play-video" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Video abspielen">${PLAY_ICON}</button>`);
    } else if (folderUrl) {
      buttons.push(`<a href="${folderUrl}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Ordner öffnen">${FOLDER_ICON}</a>`);
    }

    if (hasStorys) {
      buttons.push(`<button type="button" class="external-link-btn media-action-btn" data-action="view-storys" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Storys ansehen">${STORYS_ICON}</button>`);
    }

    if (!isKunde) {
      if (hasContent) {
        buttons.push(`<button type="button" class="video-settings-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" data-file-path="${video.currentAsset?.file_path || ''}" data-video-url="${videoUrl || ''}" title="Video verwalten">${GEAR_ICON}</button>`);
      } else {
        buttons.push(`<button type="button" class="video-upload-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Video hochladen">${UPLOAD_ICON} Upload</button>`);
      }
    }

    if (buttons.length === 0) {
      return `<span class="no-content-placeholder">—</span>`;
    }

    return `<div class="content-cell-actions">${buttons.join('')}</div>`;
  }

  renderStillsCell(koop, video) {
    const t = this.table;
    const isKunde = t.isKundeRole();
    const stills = stillsForVideoCell(koop, video);
    const hasStills = stills.length > 0
      || (!Array.isArray(koop._bilder) && !!koop.bilder_folder_url);

    const buttons = [];
    if (hasStills) {
      buttons.push(`<button type="button" class="external-link-btn media-action-btn" data-action="view-bilder" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Stills ansehen">${BILDER_ICON}</button>`);
    }

    if (!isKunde) {
      if (hasStills) {
        buttons.push(`<button type="button" class="video-settings-btn stills-settings-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" data-file-path="" data-video-url="" title="Stills verwalten">${GEAR_ICON}</button>`);
      } else {
        buttons.push(`<button type="button" class="video-upload-btn stills-upload-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Stills hochladen">${UPLOAD_ICON} Upload</button>`);
      }
    }

    if (buttons.length === 0) {
      return `<span class="no-content-placeholder">—</span>`;
    }

    return `<div class="content-cell-actions stills-cell-actions">${buttons.join('')}</div>`;
  }

  renderFinaleVersionCell(koop, video) {
    const t = this.table;
    const isKunde = t.isKundeRole();
    const finals = video.finalAssets || [];
    const stillFinals = finalStills(stillsForVideoCell(koop, video));

    const buttons = finals.map(asset => {
      const label = asset.variant_name || 'Final';
      return `<button type="button" class="external-link-btn media-action-btn finale-play-btn" data-action="play-final" data-video-id="${video.id}" data-kooperation-id="${koop.id}" data-asset-id="${asset.id}" title="Finale Version ${this.escapeHtml(label)} abspielen">${PLAY_ICON}<span class="finale-variant-label">${this.escapeHtml(label)}</span></button>`;
    });

    stillFinals.forEach(asset => {
      const label = asset.variant_name || STILL_FINAL_VARIANT;
      // Icon liegt unter dem Bild: laedt das Thumb nicht, entfernt sich das
      // <img> und das Icon bleibt stehen.
      const thumb = canPreviewImageAsset(asset)
        ? `<span class="finale-still-media">${BILDER_ICON}<img class="finale-still-thumb" src="${this.escapeHtml(toRawDropboxUrl(asset.file_url) || '')}" alt="" loading="lazy" onerror="this.remove()"></span>`
        : BILDER_ICON;
      buttons.push(`<button type="button" class="external-link-btn media-action-btn finale-play-btn finale-still-btn" data-action="play-final-still" data-video-id="${video.id}" data-kooperation-id="${koop.id}" data-asset-id="${asset.id}" title="Finales Still ansehen">${thumb}<span class="finale-variant-label">${this.escapeHtml(label)}</span></button>`);
    });

    if (!isKunde) {
      buttons.push(`<button type="button" class="video-upload-btn finale-upload-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Finale Version hochladen">${UPLOAD_ICON}${finals.length === 0 && stillFinals.length === 0 ? ' Upload' : ''}</button>`);
    }

    if (buttons.length === 0) {
      return `<span class="no-content-placeholder">—</span>`;
    }

    return `<div class="content-cell-actions finale-cell-actions">${buttons.join('')}</div>`;
  }

  renderSkriptCell(koop, video) {
    const t = this.table;
    const canLink = !t.isKundeRole();
    // Share-Gaeste duerfen nicht in den Skript-Editor durchgreifen -
    // Skripte werden nur ueber eigene Skript-Links geteilt.
    const isGast = Boolean(window.isGast?.());
    const skript = video.skript;
    const skriptId = video.skript_id || skript?.id;
    const titel = (skript?.titel || '').trim() || 'Skript';

    if (skriptId) {
      const href = `/skripte/${skriptId}`;
      if (isGast) {
        return `
          <span class="skript-link-cell skript-link-cell--static">
            ${SKRIPT_ICON}<span class="skript-link-title">${this.escapeHtml(titel)}</span>
          </span>
        `;
      }
      if (canLink) {
        return `
          <div class="skript-link-cell">
            <button type="button" class="thema-link-btn skript-link-open"
              data-action="open-skript"
              data-skript-id="${skriptId}"
              title="${this.escapeHtml(titel)}">
              ${SKRIPT_ICON}<span class="skript-link-title">${this.escapeHtml(titel)}</span>
            </button>
            <button type="button" class="skript-link-edit-btn"
              data-action="link-skript"
              data-video-id="${video.id}"
              data-kooperation-id="${koop.id}"
              title="Verknüpfung ändern"
              aria-label="Verknüpfung ändern">
              ${SKRIPT_EDIT_ICON}
            </button>
          </div>
        `;
      }
      return `
        <a href="${href}" class="thema-link-btn skript-link-open"
          data-action="open-skript"
          data-skript-id="${skriptId}"
          title="${this.escapeHtml(titel)}">
          ${SKRIPT_ICON}<span class="skript-link-title">${this.escapeHtml(titel)}</span>
        </a>
      `;
    }

    if (canLink) {
      return `
        <button type="button" class="thema-link-btn"
          data-action="link-skript"
          data-video-id="${video.id}"
          data-kooperation-id="${koop.id}">
          Skript verknüpfen
        </button>
      `;
    }
    return `<span class="no-strategie-hint">Noch kein Skript verknüpft</span>`;
  }

  _renderCustomColumnCells(koop, videos) {
    const t = this.table;
    const columns = getOrderedColumns(t.store);
    const customCols = columns.filter(c => c.isCustom);
    if (customCols.length === 0) return '';

    return customCols.map(col =>
      renderCustomCell(col, koop, videos, t.store, t)
    ).join('');
  }

  renderCreatorUploadItems(koop) {
    const t = this.table;
    if (t.isKundeRole()) return '';
    if (t.kampagneInfo?.keinDropbox) return '';
    if (!koop.creator_id) return '';

    const status = getCachedCreatorUploadStatus(t.kampagneId).get(koop.creator_id);
    const stateLine = status?.expiresAt
      ? `<div class="action-item action-item--info" style="pointer-events:none; font-size:12px; opacity:0.75;">Zugang aktiv bis ${new Date(status.expiresAt).toLocaleDateString('de-DE')}</div>`
      : '';

    const attrs = `data-id="${koop.id}" data-kampagne-id="${t.kampagneId}" data-creator-id="${koop.creator_id}"`;
    return `
      <div class="action-separator"></div>
      ${stateLine}
      <a href="#" class="action-item" data-action="creator-upload-send" ${attrs}>
        ${icon('envelope', { className: 'w-4 h-4' })}
        Upload-Link senden
      </a>
      <a href="#" class="action-item" data-action="creator-upload-resend" ${attrs}>
        ${icon('arrow-path', { className: 'w-4 h-4' })}
        Upload-Link erneut senden
      </a>
      <a href="#" class="action-item" data-action="creator-upload-copy" ${attrs}>
        ${icon('link', { className: 'w-4 h-4' })}
        Upload-Link kopieren
      </a>
      <a href="#" class="action-item action-danger" data-action="creator-upload-revoke" ${attrs}>
        ${icon('x-circle', { className: 'w-4 h-4' })}
        Upload-Zugang widerrufen
      </a>
    `;
  }

  renderActionStatusSubmenu(koop) {
    const t = this.table;
    if (t.isKundeRole()) return '';
    const statusOptions = t.statusOptions || [];
    if (statusOptions.length === 0) return '';

    const checkSvg = `${icon('check-bold', { className: 'size-5' })}`;
    const items = statusOptions.map(opt => {
      const isActive = koop.status_id === opt.id;
      return `<a href="#" class="submenu-item" data-action="set-field" data-field="status_id" data-value="${opt.id}" data-status-name="${this.escapeHtml(opt.name)}" data-id="${koop.id}"><span>${this.escapeHtml(opt.name)}</span>${isActive ? `<span class="submenu-check">${checkSvg}</span>` : ''}</a>`;
    }).join('');

    return `
      <div class="action-submenu">
        <a href="#" class="action-item has-submenu" data-submenu="status">
          ${icon('tag', { className: 'w-4 h-4' })}
          Status ändern
        </a>
        <div class="submenu" data-submenu="status" data-entity-id="${koop.id}" data-entity-type="kooperation">
          ${items}
        </div>
      </div>
    `;
  }

  renderStatusBadge(koop) {
    const statusName = koop.status_name || koop.status_ref?.name || '';
    const statusClass = statusName ? `status-${statusName.toLowerCase().replace(/\s+/g, '-')}` : '';
    
    if (!statusName) {
      return '<span class="text-muted">-</span>';
    }
    
    return `<span class="status-badge ${statusClass}">${this.escapeHtml(statusName)}</span>`;
  }

  renderStatusSelect(koop) {
    const t = this.table;
    const statusOptions = t.statusOptions || [];
    const isEditable = !t.isKundeRole() && statusOptions.length > 0;

    if (!isEditable) return this.renderStatusBadge(koop);

    const currentId = koop.status_id || '';
    const statusName = koop.status_name || koop.status_ref?.name || '';
    const statusClass = statusName ? `status-${statusName.toLowerCase().replace(/\s+/g, '-')}` : '';
    const chevron = `<span class="status-select-chevron">${icon('chevron-down')}</span>`;
    const checkSvg = `${icon('check-bold', { className: 'size-5' })}`;

    const triggerClasses = statusName
      ? `status-badge ${statusClass} status-select-trigger`
      : `status-badge status-select-trigger status-no-value`;
    const triggerLabel = statusName ? this.escapeHtml(statusName) : '<span class="text-muted">–</span>';

    return `<div class="status-select-wrapper" data-kooperation-id="${koop.id}">
      <span class="${triggerClasses}" role="button">${triggerLabel} ${chevron}</span>
      <div class="status-dropdown">
        <a href="#" class="status-dropdown-item ${!currentId ? 'is-active' : ''}" data-value="">
          <span>– kein Status –</span>
          ${!currentId ? `<span class="submenu-check">${checkSvg}</span>` : ''}
        </a>
        ${statusOptions.map(opt => {
          const isActive = opt.id === currentId;
          return `<a href="#" class="status-dropdown-item ${isActive ? 'is-active' : ''}" data-value="${opt.id}">
            <span>${this.escapeHtml(opt.name)}</span>
            ${isActive ? `<span class="submenu-check">${checkSvg}</span>` : ''}
          </a>`;
        }).join('')}
      </div>
    </div>`;
  }

  renderVideoFieldStack(videos, fieldRenderer) {
    if (!videos || videos.length === 0) {
      return '<span class="text-muted">-</span>';
    }
    
    const total = videos.length;
    return `<div class="video-fields-stack">${videos.map((video, index) => {
      const result = fieldRenderer(video, index, total);
      const approvedClass = video.freigabe ? 'video-field-wrapper--approved' : '';
      return `<div class="video-field-wrapper ${approvedClass}" data-video-id="${video.id}">${result}</div>`;
    }).join('')}</div>`;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
