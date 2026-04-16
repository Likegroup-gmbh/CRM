// KundenKooperationDetail.js (ES6-Modul)
// Kunden-Portal: Kooperation-Detail (Uploads read-only)

export class KundenKooperationDetail {
  constructor() {
    this.koopId = null;
    this.koop = null;
    this.uploads = [];
    this.videos = [];
  }

  async init(id) {
    this.koopId = id;
    await this.load();
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem && this.koop) {
      window.breadcrumbSystem.updateDetailLabel(this.koop.name || 'Kooperation');
    }
    
    await this.render();
    this.bind();
  }

  async load() {
    try {
      const [{ data: koop }, { data: uploads }, { data: videos }] = await Promise.all([
        window.supabase.from('kooperationen').select('id, name, kampagne:kampagne_id(kampagnenname, eigener_name)').eq('id', this.koopId).single(),
        window.supabase.from('kooperation_uploads').select('id, filename, filetype, filesize, created_at, storage_path').eq('kooperation_id', this.koopId).order('created_at', { ascending: false }),
        window.supabase.from('kooperation_videos').select('id, titel, content_art, status, position, folder_url, story_folder_url, created_at').eq('kooperation_id', this.koopId).order('position', { ascending: true })
      ]);
      this.koop = koop || null;
      this.uploads = uploads || [];
      this.videos = videos || [];
      
      // Für jedes Video die Assets laden
      if (this.videos.length > 0) {
        const videoIds = this.videos.map(v => v.id);
        const { data: assets } = await window.supabase
          .from('kooperation_video_asset')
          .select('id, video_id, file_url, version_number, is_current, description, created_at')
          .in('video_id', videoIds)
          .order('version_number', { ascending: false });
        
        // Assets den Videos zuordnen
        this.videos.forEach(video => {
          video.assets = (assets || []).filter(a => a.video_id === video.id);
        });
      }
    } catch (e) {
      console.error('❌ Fehler beim Laden Kooperation/Uploads/Videos (Kunden):', e);
      this.koop = null;
      this.uploads = [];
      this.videos = [];
    }
  }

  formatSize(bytes) {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024*1024) return `${(n/1024).toFixed(1)} KB`;
    if (n < 1024*1024*1024) return `${(n/1024/1024).toFixed(1)} MB`;
    return `${(n/1024/1024/1024).toFixed(1)} GB`;
  }

  async render() {
    const safe = (s) => window.validatorSystem?.sanitizeHtml?.(s) ?? s;
    const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('de-DE') : '-');
    
    const uploadRows = (this.uploads || []).map(u => `
      <tr>
        <td>${safe(u.filename || u.id)}</td>
        <td>${safe(u.filetype || '—')}</td>
        <td style="text-align:right;">${this.formatSize(u.filesize)}</td>
        <td>${new Date(u.created_at).toLocaleString('de-DE')}</td>
        <td style="text-align:right;">
          <a href="#" class="secondary-btn small" data-action="download" data-path="${u.storage_path}" data-id="${u.id}">Download</a>
        </td>
      </tr>
    `).join('');
    
    const videosHtml = this.videos.length > 0 
      ? this.videos.map(video => this.renderVideoSection(video, safe, fmtDateTime)).join('')
      : '<p class="empty-state">Keine Videos vorhanden.</p>';

    const html = `
      ${this.videos.length > 0 ? `
        <div class="detail-card" style="margin-bottom:24px;">
          <h2>Videos</h2>
          ${videosHtml}
        </div>
      ` : ''}

      <div class="detail-card">
        <h2>Uploads</h2>
        <div class="data-table-container">
          <table class="data-table">
            <thead><tr><th>Datei</th><th>Typ</th><th style="text-align:right;">Größe</th><th>Hochgeladen</th><th style="text-align:right;">Aktion</th></tr></thead>
            <tbody>${uploadRows || '<tr><td colspan="5" class="loading">Keine Uploads</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  renderVideoSection(video, safe, fmtDateTime) {
    return `
      <div class="video-section" style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid var(--border-primary);">
        <h3>${safe(video.titel || 'Video #' + video.id)}</h3>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <span class="status-badge status-${(video.status || 'produktion').toLowerCase()}">${video.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Produktion'}</span>
          ${video.content_art ? `<span class="badge">${safe(video.content_art)}</span>` : ''}
        </div>
        
        ${video.folder_url
          ? `<a href="${video.folder_url}" target="_blank" rel="noopener" class="link-btn">Ordner öffnen</a>`
          : '<p class="empty-state">Kein Ordner hinterlegt.</p>'}
        ${video.story_folder_url
          ? `<a href="${video.story_folder_url}" target="_blank" rel="noopener" class="link-btn">Storys-Ordner öffnen</a>`
          : ''}
      </div>
    `;
  }

  bind() {
    document.addEventListener('click', async (e) => {
      if (e.target && e.target.id === 'btn-back-kampagne') {
        e.preventDefault();
        window.history.back();
        return;
      }
      const dl = e.target.closest('[data-action="download"]');
      if (dl) {
        e.preventDefault();
        const storagePath = dl.dataset.path;
        try {
          // Permanente Public URL generieren
          const { data: urlData } = window.supabase.storage
            ?.from('kooperation_uploads')
            ?.getPublicUrl(storagePath);
          if (urlData?.publicUrl) {
            window.open(urlData.publicUrl, '_blank');
          } else {
            // Fallback: versuche direkten Link
            window.open(storagePath, '_blank');
          }
        } catch (err) {
          console.error('❌ Download fehlgeschlagen', err);
          window.NotificationSystem?.show('error', 'Download fehlgeschlagen');
        }
      }
    });
  }

  destroy() {
    window.setContentSafely('');
  }
}

export const kundenKooperationDetail = new KundenKooperationDetail();















