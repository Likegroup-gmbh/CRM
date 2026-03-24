// KundenKampagneDetail.js (ES6-Modul)
// Kunden-Portal: Kampagne-Detail (Kooperationenliste)

import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export class KundenKampagneDetail {
  constructor() {
    this.kampagneId = null;
    this.kampagne = null;
    this.koops = [];
  }

  async init(id) {
    this.kampagneId = id;
    await this.load();
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem && this.kampagne) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Meine Kampagnen', url: '/kunden', clickable: true },
        { label: KampagneUtils.getDisplayName(this.kampagne), url: `/kunden-kampagne/${this.kampagneId}`, clickable: false }
      ]);
    }
    
    await this.render();
    this.bind();
  }

  async load() {
    try {
      const [{ data: kampagne }, { data: koops }] = await Promise.all([
        window.supabase.from('kampagne').select('id, kampagnenname, eigener_name, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname)').eq('id', this.kampagneId).single(),
        window.supabase.from('kooperationen').select('id, name').eq('kampagne_id', this.kampagneId).order('created_at', { ascending: false })
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
      </tr>
    `).join('');

    const html = `
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Kooperation</th></tr></thead>
          <tbody>${rows || '<tr><td class="loading">Keine Kooperationen</td></tr>'}</tbody>
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















