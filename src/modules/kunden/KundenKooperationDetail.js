// KundenKooperationDetail.js (ES6-Modul)
// Kunden-Portal: Kooperation-Detail (Uploads read-only)

export class KundenKooperationDetail {
  constructor() {
    this.koopId = null;
    this.koop = null;
    this.uploads = [];
  }

  async init(id) {
    this.koopId = id;
    await this.load();
    await this.render();
    this.bind();
  }

  async load() {
    try {
      const [{ data: koop }, { data: uploads }] = await Promise.all([
        window.supabase.from('kooperationen').select('id, name, status, kampagne:kampagne_id(kampagnenname)').eq('id', this.koopId).single(),
        window.supabase.from('kooperation_uploads').select('id, filename, filetype, filesize, created_at, storage_path').eq('kooperation_id', this.koopId).order('created_at', { ascending: false })
      ]);
      this.koop = koop || null;
      this.uploads = uploads || [];
    } catch (e) {
      console.error('❌ Fehler beim Laden Kooperation/Uploads (Kunden):', e);
      this.koop = null;
      this.uploads = [];
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
    const rows = (this.uploads || []).map(u => `
      <tr>
        <td>${window.validatorSystem.sanitizeHtml(u.filename || u.id)}</td>
        <td>${window.validatorSystem.sanitizeHtml(u.filetype || '—')}</td>
        <td style="text-align:right;">${this.formatSize(u.filesize)}</td>
        <td>${new Date(u.created_at).toLocaleString('de-DE')}</td>
        <td style="text-align:right;">
          <a href="#" class="secondary-btn small" data-action="download" data-path="${u.storage_path}" data-id="${u.id}">Download</a>
        </td>
      </tr>
    `).join('');

    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>${window.validatorSystem.sanitizeHtml(this.koop?.name || '-')}</h1>
          <p>${window.validatorSystem.sanitizeHtml(this.koop?.kampagne?.kampagnenname || '—')}</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-back-kampagne">Zurück</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Datei</th><th>Typ</th><th style="text-align:right;">Größe</th><th>Hochgeladen</th><th style="text-align:right;">Aktion</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="loading">Keine Uploads</td></tr>'}</tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
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
          // Falls Storage privat ist, hier signierte URL generieren (Edge/Server). Vorerst: direkte URL.
          const { data, error } = await window.supabase.storage
            ?.from('kooperation_uploads')
            ?.createSignedUrl(storagePath, 60 * 10);
          if (!error && data?.signedUrl) {
            window.open(data.signedUrl, '_blank');
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



