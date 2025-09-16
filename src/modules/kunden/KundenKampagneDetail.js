// KundenKampagneDetail.js (ES6-Modul)
// Kunden-Portal: Kampagne-Detail (Kooperationenliste)

export class KundenKampagneDetail {
  constructor() {
    this.kampagneId = null;
    this.kampagne = null;
    this.koops = [];
  }

  async init(id) {
    this.kampagneId = id;
    await this.load();
    await this.render();
    this.bind();
  }

  async load() {
    try {
      const [{ data: kampagne }, { data: koops }] = await Promise.all([
        window.supabase.from('kampagne').select('id, kampagnenname, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname)').eq('id', this.kampagneId).single(),
        window.supabase.from('kooperationen').select('id, name, status').eq('kampagne_id', this.kampagneId).order('created_at', { ascending: false })
      ]);
      this.kampagne = kampagne || null;
      this.koops = koops || [];
    } catch (e) {
      console.error('❌ Fehler beim Laden Kampagne/Kooperationen (Kunden):', e);
      this.kampagne = null;
      this.koops = [];
    }
  }

  async render() {
    const rows = (this.koops || []).map(r => `
      <tr>
        <td><a href="/kunden-kooperation/${r.id}" onclick="event.preventDefault(); window.navigateTo('/kunden-kooperation/${r.id}')">${window.validatorSystem.sanitizeHtml(r.name || r.id)}</a></td>
        <td><span class="status-badge status-${(r.status||'').toLowerCase().replace(/\s+/g,'-')}">${window.validatorSystem.sanitizeHtml(r.status || '—')}</span></td>
      </tr>
    `).join('');

    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>${window.validatorSystem.sanitizeHtml(this.kampagne?.kampagnenname || '-')}</h1>
          <p>${window.validatorSystem.sanitizeHtml(this.kampagne?.unternehmen?.firmenname || '—')} · ${window.validatorSystem.sanitizeHtml(this.kampagne?.marke?.markenname || '—')}</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-back-kunden">Zurück</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Kooperation</th><th>Status</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="2" class="loading">Keine Kooperationen</td></tr>'}</tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  bind() {
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-back-kunden') {
        e.preventDefault();
        window.navigateTo('/kunden');
      }
    });
  }

  destroy() {
    window.setContentSafely('');
  }
}

export const kundenKampagneDetail = new KundenKampagneDetail();



