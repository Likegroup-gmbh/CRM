// KundenLanding.js (ES6-Modul)
// Kunden-Portal Landing: Kampagnenliste (read-only)

export class KundenLanding {
  constructor() {
    this.kampagnen = [];
  }

  async init() {
    window.setHeadline('Meine Kampagnen');
    
    // Breadcrumb für Kunden-Landing
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Meine Kampagnen', url: '/kunden', clickable: false }
      ]);
    }
    
    await this.load();
    await this.render();
    this.bind();
  }

  async load() {
    try {
      // RLS sorgt für Filterung; Kundenrolle sieht nur eigene Kampagnen
      const { data, error } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname), status:status_id(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      this.kampagnen = data || [];
    } catch (e) {
      console.error('❌ Fehler beim Laden der Kampagnen (Kunden):', e);
      this.kampagnen = [];
    }
  }

  async render() {
    const rows = (this.kampagnen || []).map(k => `
      <tr>
        <td><a href="/kunden-kampagne/${k.id}" onclick="event.preventDefault(); window.navigateTo('/kunden-kampagne/${k.id}')">${window.validatorSystem.sanitizeHtml(k.kampagnenname || k.id)}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(k.unternehmen?.firmenname || '—')}</td>
        <td>${window.validatorSystem.sanitizeHtml(k.marke?.markenname || '—')}</td>
        <td>${window.validatorSystem.sanitizeHtml(k.status?.name || '—')}</td>
      </tr>
    `).join('');

    const html = `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kampagne</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="4" class="loading">Keine Kampagnen</td></tr>'}</tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  bind() {}

  destroy() {
    window.setContentSafely('');
  }
}

export const kundenLanding = new KundenLanding();















