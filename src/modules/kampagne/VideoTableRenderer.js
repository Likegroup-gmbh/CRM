import { renderVertragCell } from '../../core/VertragSyncHelper.js';

export class VideoTableRenderer {
  constructor(table) {
    this.table = table;
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
    if (t.store) return t.store.getFiltered(t.activeFilterTab);
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
      return `
        <div class="empty-state">
          <div class="empty-icon">🎬</div>
          <h3>Keine Kooperationen vorhanden</h3>
          ${!isKunde ? `
            <p>Erstelle eine Kooperation, um sie hier mit Videos zu verwalten.</p>
            <button class="primary-btn" onclick="window.navigateTo('/kooperation/new?kampagne_id=${t.kampagneId}')">
              Kooperation anlegen
            </button>
          ` : '<p>Es wurden noch keine Kooperationen für diese Kampagne angelegt.</p>'}
        </div>
      `;
    }

    const filteredKooperationen = this.getFilteredKooperationen();

    if (filteredKooperationen.length === 0) {
      const msg = t.activeFilterTab === 'offen'
        ? { icon: '✅', title: 'Alle Kooperationen freigegeben', text: 'Es gibt keine offenen Kooperationen mehr.' }
        : t.activeFilterTab === 'abgeschlossen'
          ? { icon: '📋', title: 'Keine abgeschlossenen Kooperationen', text: 'Noch keine Kooperation hat alle Videos freigegeben.' }
          : { icon: '📋', title: 'Keine Kooperationen', text: 'Erstelle eine Kooperation, um sie hier zu verwalten.' };
      return `
        <div class="empty-state">
          <div class="empty-icon">${msg.icon}</div>
          <h3>${msg.title}</h3>
          <p>${msg.text}</p>
        </div>
      `;
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
    const h = (colClass, label, dataCol, extraAttr = '') => {
      const vis = t.isColumnVisibleForCustomer(colClass) ? '' : 'style="display:none;"';
      return `<th class="col-header ${colClass}" ${vis} data-col="${dataCol}" ${extraAttr}>
        ${label}
        <div class="resize-handle resize-handle-col" data-col="${dataCol}"></div>
      </th>`;
    };
    return [
      h('col-nr', 'Nr', '0'),
      h('col-creator', 'Creator', '1'),
      h('col-status', 'Status', '1b'),
      h('col-vertrag', 'Vertrag', '4'),
      h('col-nutzungsrechte', 'Nutzungsrechte', '5'),
      h('col-start-datum', 'Erstellt', '6'),
      h('col-script-deadline', 'Script Deadline', '7'),
      h('col-end-datum', 'Content Deadline', '8'),
      h('col-videoanzahl', 'Videos', '9'),
      h('col-video-nr', 'Video-Nr', '10'),
      h('col-vk-video', 'Kosten', '10b'),
      h('col-video-typ', 'Typ', '10c'),
      h('col-thema', 'Thema', '11'),
      h('col-organic-paid', 'Content/Art', '12'),
      h('col-produkt', 'Produkte', '13'),
      h('col-lieferadresse', 'Lieferadresse', '14'),
      h('col-paket-tracking', 'Tracking', '15'),
      h('col-drehort', 'Drehort', '16'),
      h('col-link-skript', 'Link Skript / Briefing', '17'),
      h('col-skript-freigegeben', 'Skript freigegeben', '18'),
      h('col-video-name', 'Video-Name', '18b'),
      h('col-link-content', 'Content', '19'),
      h('col-feedback-cj', 'Feedback CJ', '20'),
      h('col-feedback-kunde', 'Feedback Kunde', '21'),
      h('col-freigabe', 'Freigabe', '22'),
      h('col-caption', 'Caption', '23'),
      h('col-posting-datum', 'Posting Datum', '24'),
      h('col-actions', 'Aktionen', '25'),
    ].join('\n');
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
        </td>
        <td class="grid-cell cell-centered col-status" ${!t.isColumnVisibleForCustomer('col-status') ? 'style="display:none;"' : ''}>
          ${this.renderStatusBadge(koop)}
        </td>
        <td class="grid-cell cell-centered" ${!t.isColumnVisibleForCustomer('col-vertrag') ? 'style="display:none;"' : ''}>
          ${renderVertragCell(koop)}
        </td>
        <td class="grid-cell" ${!t.isColumnVisibleForCustomer('col-nutzungsrechte') ? 'style="display:none;"' : ''}>
          <input 
            type="text" 
            class="grid-input" 
            data-entity="kooperation" 
            data-id="${koop.id}" 
            data-field="nutzungsrechte"
            ${!t.isFieldEditableForUser('kooperation', 'nutzungsrechte') ? 'readonly' : ''}
            value="${koop.nutzungsrechte || ''}"
            placeholder="Nutzungsrechte"
          />
        </td>
        <td class="grid-cell read-only" ${!t.isColumnVisibleForCustomer('col-start-datum') ? 'style="display:none;"' : ''}>${formatDate(koop.created_at)}</td>
        <td class="grid-cell read-only" ${!t.isColumnVisibleForCustomer('col-script-deadline') ? 'style="display:none;"' : ''}>${formatDate(koop.skript_deadline)}</td>
        <td class="grid-cell read-only" ${!t.isColumnVisibleForCustomer('col-end-datum') ? 'style="display:none;"' : ''}>${formatDate(koop.content_deadline)}</td>
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
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-video-typ') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            return `<div class="video-typ-text">${this.escapeHtml(video.kampagnenart || '—')}</div>`;
          })}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-thema') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            if (video.strategie_item && video.strategie_item.screenshot_url) {
              const strategieId = video.strategie_item.strategie_id;
              const screenshotUrl = video.strategie_item.screenshot_url;
              const beschreibung = video.strategie_item.beschreibung || 'Strategie-Idee';
              return `
                <a href="/strategie/${strategieId}" class="thema-thumbnail-link" title="${this.escapeHtml(beschreibung)}">
                  <img src="${screenshotUrl}" alt="Thema" class="thema-thumbnail" />
                </a>
              `;
            }
            return `<span class="no-strategie-hint">Noch kein Thema/Strategie verknüpft</span>`;
          })}
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
            let adresse = '';

            if (versandForVideo?.creator_adresse_id) {
              const ca = (t.store || t).creatorAdressen?.[versandForVideo.creator_adresse_id];
              if (ca) {
                adresse = [ca.strasse, ca.hausnummer, ca.plz, ca.stadt].filter(Boolean).join(', ');
              }
            } else if (versandForVideo?.strasse) {
              adresse = [versandForVideo.strasse, versandForVideo.hausnummer, versandForVideo.plz, versandForVideo.stadt]
                .filter(Boolean).join(', ');
            }

            if (!adresse && koop.creator) {
              adresse = [koop.creator.lieferadresse_strasse, koop.creator.lieferadresse_hausnummer,
                         koop.creator.lieferadresse_plz, koop.creator.lieferadresse_stadt]
                .filter(Boolean).join(', ');
            }

            return `<div class="small-text address-text">${this.escapeHtml(adresse || '-')}</div>`;
          })}
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
                ? `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="external-link-btn stacked-video-link-btn" title="Skript öffnen">Link öffnen</a>`
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
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-video-name') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <input type="text" class="grid-input stacked-video-input"
              data-entity="video" data-id="${video.id}" data-field="video_name"
              ${!t.isFieldEditableForUser('video', 'video_name') ? 'readonly' : ''}
              value="${this.escapeHtml(video.video_name || '')}" placeholder="Video-Name"/>
          `)}
        </td>
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-link-content') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const folderUrl = video.folder_url;
            const storyFolderUrl = video.story_folder_url;
            const videoUrl = video.file_url || video.link_content || video.asset_url;
            const isKunde = t.isKundeRole();
            if (folderUrl || storyFolderUrl) {
              return `<div class="content-cell-actions">
                ${folderUrl ? `<a href="${folderUrl}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Ordner öffnen">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                  </svg>
                </a>` : ''}
                ${storyFolderUrl ? `<a href="${storyFolderUrl}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Storys-Ordner öffnen">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                </a>` : ''}
                ${koop.bilder_folder_url ? `<a href="${koop.bilder_folder_url}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Bilder-Ordner öffnen">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                  </svg>
                </a>` : ''}
                ${!isKunde ? `<button type="button" class="video-settings-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" data-file-path="${video.currentAsset?.file_path || ''}" data-video-url="${videoUrl || ''}" title="Video verwalten">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                </button>` : ''}
              </div>`;
            } else {
              if (isKunde) {
                return `<span class="no-content-placeholder">—</span>`;
              }
              const bilderBtn = koop.bilder_folder_url ? `<a href="${koop.bilder_folder_url}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Bilder-Ordner öffnen">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
              </a>` : '';
              return `<div class="content-cell-actions">
                <button type="button" class="video-upload-btn" data-video-id="${video.id}" data-kooperation-id="${koop.id}" title="Video hochladen">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/></svg>
                  Upload
                </button>
                ${bilderBtn}
              </div>`;
            }
          })}
        </td>
        <td class="grid-cell video-stack-cell wide-field" ${!t.isColumnVisibleForCustomer('col-feedback-cj') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const comments = t.videoComments[video.id];
            const relevantComments = comments?.r1 || [];
            const value = relevantComments.length > 0 
              ? relevantComments.map(c => c.text).join('\n\n---\n\n')
              : '';
            return `<textarea class="grid-textarea stacked-video-textarea auto-resize-textarea" 
              data-entity="video" data-id="${video.id}" data-field="feedback_creatorjobs"
              ${!t.isFieldEditableForUser('video', 'feedback_creatorjobs') ? 'readonly' : ''}
              placeholder="Feedback Runde 1" rows="1">${this.escapeHtml(value)}</textarea>`;
          })}
        </td>
        <td class="grid-cell video-stack-cell wide-field" ${!t.isColumnVisibleForCustomer('col-feedback-kunde') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => {
            const comments = t.videoComments[video.id];
            const relevantComments = comments?.r2 || [];
            const value = relevantComments.length > 0 
              ? relevantComments.map(c => c.text).join('\n\n---\n\n')
              : '';
            return `<textarea class="grid-textarea stacked-video-textarea auto-resize-textarea" 
              data-entity="video" data-id="${video.id}" data-field="feedback_ritzenhoff"
              placeholder="Feedback Runde 2" rows="1">${this.escapeHtml(value)}</textarea>`;
          })}
        </td>
        <td class="grid-cell video-stack-cell checkbox-stack" ${!t.isColumnVisibleForCustomer('col-freigabe') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <div class="stacked-video-checkbox-wrapper">
              <input type="checkbox" class="grid-checkbox stacked-video-checkbox" 
                data-entity="video" data-id="${video.id}" data-field="freigabe"
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
        <td class="grid-cell video-stack-cell" ${!t.isColumnVisibleForCustomer('col-posting-datum') ? 'style="display:none;"' : ''}>
          ${this.renderVideoFieldStack(videos, (video) => `
            <input type="date" class="grid-input stacked-video-input" 
              data-entity="video" data-id="${video.id}" data-field="posting_datum"
              ${!t.isFieldEditableForUser('video', 'posting_datum') ? 'readonly' : ''}
              value="${video.posting_datum || ''}"
              placeholder="TT.MM.JJJJ"/>
          `)}
        </td>
        <td class="grid-cell col-actions" ${!t.isColumnVisibleForCustomer('col-actions') ? 'style="display:none;"' : ''}>
          <div class="actions-dropdown-container" data-entity-type="kooperation">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
              </svg>
            </button>
            <div class="actions-dropdown">
              ${this.renderActionStatusSubmenu(koop)}
              <a href="#" class="action-item" data-action="edit" data-id="${koop.id}" data-return-to="/kampagne/${t.kampagneId}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
                Bearbeiten
              </a>
              ${t.canDeleteKooperation() ? `
                <div class="action-separator"></div>
                <a href="#" class="action-item action-danger" data-action="delete" data-id="${koop.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21H8.084a2.25 2.25 0 0 1-2.244-2.327L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916A2.25 2.25 0 0 0 13.5 2.25h-3a2.25 2.25 0 0 0-2.25 2.25v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  Löschen
                </a>
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  renderActionStatusSubmenu(koop) {
    const t = this.table;
    if (t.isKundeRole()) return '';
    const statusOptions = t.statusOptions || [];
    if (statusOptions.length === 0) return '';

    const checkSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>`;
    const items = statusOptions.map(opt => {
      const isActive = koop.status_id === opt.id;
      return `<a href="#" class="submenu-item" data-action="set-field" data-field="status_id" data-value="${opt.id}" data-status-name="${this.escapeHtml(opt.name)}" data-id="${koop.id}"><span>${this.escapeHtml(opt.name)}</span>${isActive ? `<span class="submenu-check">${checkSvg}</span>` : ''}</a>`;
    }).join('');

    return `
      <div class="action-submenu">
        <a href="#" class="action-item has-submenu" data-submenu="status">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" />
          </svg>
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
