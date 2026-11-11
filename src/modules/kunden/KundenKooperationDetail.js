// KundenKooperationDetail.js (ES6-Modul)
// Kunden-Portal: Kooperation-Detail (Uploads read-only)

import { renderEmptyState, renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { ablageLink, istSharePoint, mitAblage } from '../../core/ablage/ablageLink.js';
import { authorizedFetch } from '../../core/auth/getAccessToken.js';

// SharePoint-webUrls oeffnen nur Konten mit Rechten; Kunden bekommen Leselinks
const istSharePointUrl = (url) => {
  try { return new URL(url).hostname.endsWith('.sharepoint.com'); } catch { return false; }
};

async function ordnerLeselink(kooperationId, typ) {
  const res = await authorizedFetch('/.netlify/functions/ablage-freigabe', {
    method: 'POST',
    body: JSON.stringify({ aktion: 'erstellen', kooperation_id: kooperationId, typ }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || `Fehler (${res.status})`);
  return data.url;
}

/** Fenster synchron im Klick oeffnen (Popup-Blocker), URL danach setzen. */
async function inNeuemFenster(holeUrl) {
  const win = window.open('', '_blank');
  try {
    const url = await holeUrl();
    if (win) {
      win.opener = null;
      win.location = url;
    } else {
      window.open(url, '_blank', 'noopener');
    }
  } catch (err) {
    win?.close();
    console.error('❌ Link konnte nicht geöffnet werden', err);
    window.toastSystem?.show?.('Link konnte nicht geöffnet werden.', 'error');
  }
}

export class KundenKooperationDetail {
  _abortController = null;

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
          .select(mitAblage('id, video_id, file_url, file_path, version_number, variant_name, is_current, description, created_at', 'ablage, etag'))
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
        <td class="u-text-right">${this.formatSize(u.filesize)}</td>
        <td>${new Date(u.created_at).toLocaleString('de-DE')}</td>
        <td class="u-text-right">
          <a href="#" class="mdc-btn mdc-btn--secondary small" data-action="download" data-path="${u.storage_path}" data-id="${u.id}">Download</a>
        </td>
      </tr>
    `).join('');
    
    const videosHtml = this.videos.length > 0 
      ? this.videos.map(video => this.renderVideoSection(video, safe, fmtDateTime)).join('')
      : renderEmptyState({ icon: 'video', title: 'Keine Videos vorhanden' });

    const html = `
      ${this.videos.length > 0 ? `
        <div class="detail-card kunden-koop-card">
          <h2>Videos</h2>
          ${videosHtml}
        </div>
      ` : ''}

      <div class="detail-card">
        <h2>Uploads</h2>
        <div class="data-table-container">
          <table class="data-table">
            <thead><tr><th>Datei</th><th>Typ</th><th class="u-text-right">Größe</th><th>Hochgeladen</th><th class="u-text-right">Aktion</th></tr></thead>
            <tbody>${uploadRows || renderEmptyStateRow({ icon: 'inbox', title: 'Keine Uploads' }, 5)}</tbody>
          </table>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  renderVideoSection(video, safe, fmtDateTime) {
    const currentAssets = (video.assets || []).filter(a => a.is_current);
    const hasDirectLinks = currentAssets.some(a => a.file_url && !a.file_path);
    const hasAnyLinks = currentAssets.length > 0;

    let contentHtml = '';
    if (video.folder_url && istSharePointUrl(video.folder_url)) {
      contentHtml = '<button type="button" class="link-btn" data-action="ordner-link" data-typ="videos">Ordner öffnen</button>';
    } else if (video.folder_url) {
      contentHtml = `<a href="${video.folder_url}" target="_blank" rel="noopener" class="link-btn">Ordner öffnen</a>`;
    } else if (hasAnyLinks) {
      contentHtml = currentAssets.map(a => {
        const label = a.description || a.variant_name || `Version ${a.version_number || 1}`;
        if (istSharePoint(a)) {
          return `<button type="button" class="link-btn kunden-koop-link-btn" data-action="datei-link" data-id="${a.id}" data-etag="${safe(a.etag || '')}">${safe(label)}</button>`;
        }
        if (!a.file_url) return '';
        return `<a href="${a.file_url}" target="_blank" rel="noopener" class="link-btn kunden-koop-link-btn">${safe(label)}</a>`;
      }).join('');
    } else {
      contentHtml = renderEmptyState({ icon: 'folder', title: 'Kein Content hinterlegt' });
    }

    return `
      <div class="video-section kunden-koop-video-section">
        <h3>${safe(video.titel || 'Video #' + video.id)}</h3>
        <div class="kunden-koop-video-header">
          <span class="status-badge status-${(video.status || 'produktion').toLowerCase()}">${video.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Produktion'}</span>
          ${video.content_art ? `<span class="badge">${safe(video.content_art)}</span>` : ''}
        </div>
        
        ${contentHtml}
        ${video.story_folder_url && istSharePointUrl(video.story_folder_url)
          ? '<button type="button" class="link-btn" data-action="ordner-link" data-typ="videos">Ordner mit Storys öffnen</button>'
          : video.story_folder_url
            ? `<a href="${video.story_folder_url}" target="_blank" rel="noopener" class="link-btn">Storys-Ordner öffnen</a>`
            : ''}
      </div>
    `;
  }

  bind() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    document.addEventListener('click', async (e) => {
      if (e.target && e.target.id === 'btn-back-kampagne') {
        e.preventDefault();
        window.history.back();
        return;
      }
      const ordner = e.target.closest('[data-action="ordner-link"]');
      if (ordner) {
        e.preventDefault();
        await inNeuemFenster(() => ordnerLeselink(this.koopId, ordner.dataset.typ));
        return;
      }
      const datei = e.target.closest('[data-action="datei-link"]');
      if (datei) {
        e.preventDefault();
        await inNeuemFenster(async () => {
          const link = await ablageLink({ typ: 'video', id: datei.dataset.id, etag: datei.dataset.etag || null });
          if (!link?.url) throw new Error('Kein Link');
          return link.url;
        });
        return;
      }
      const dl = e.target.closest('[data-action="download"]');
      if (dl) {
        e.preventDefault();
        const storagePath = dl.dataset.path;
        try {
          const { data: urlData } = window.supabase.storage
            ?.from('kooperation_uploads')
            ?.getPublicUrl(storagePath);
          if (urlData?.publicUrl) {
            window.open(urlData.publicUrl, '_blank');
          } else {
            window.open(storagePath, '_blank');
          }
        } catch (err) {
          console.error('❌ Download fehlgeschlagen', err);
        }
      }
    }, { signal });
  }

  destroy() {
    this._abortController?.abort();
    this._abortController = null;
    window.setContentSafely('');
  }
}

export const kundenKooperationDetail = new KundenKooperationDetail();















