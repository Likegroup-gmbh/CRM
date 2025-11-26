// KundenLanding.js (ES6-Modul)
// Kunden-Portal Landing: Kampagnenliste und Strategien (read-only)

import { strategieService } from '../strategie/StrategieService.js';

export class KundenLanding {
  constructor() {
    this.kampagnen = [];
    this.strategien = [];
  }

  async init() {
    window.setHeadline('Übersicht');
    
    // Breadcrumb für Kunden-Landing
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Übersicht', url: '/kunden', clickable: false }
      ]);
    }
    
    await this.load();
    await this.render();
    this.bind();
  }

  async load() {
    try {
      // Kampagnen laden
      const { data: kampagnenData, error: kampagnenError } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname), status:status_id(name)')
        .order('created_at', { ascending: false });
      
      if (kampagnenError) throw kampagnenError;
      this.kampagnen = kampagnenData || [];

      // Strategien laden
      this.strategien = await strategieService.getAllStrategien();
    } catch (e) {
      console.error('❌ Fehler beim Laden der Daten (Kunden):', e);
      this.kampagnen = [];
      this.strategien = [];
    }
  }

  async render() {
    const kampagnenRows = (this.kampagnen || []).map(k => `
      <tr class="table-row-clickable" onclick="window.navigateTo('/kunden-kampagne/${k.id}')">
        <td><strong>${window.validatorSystem.sanitizeHtml(k.kampagnenname || k.id)}</strong></td>
        <td>${window.validatorSystem.sanitizeHtml(k.unternehmen?.firmenname || '—')}</td>
        <td>${window.validatorSystem.sanitizeHtml(k.marke?.markenname || '—')}</td>
        <td>${window.validatorSystem.sanitizeHtml(k.status?.name || '—')}</td>
      </tr>
    `).join('');

    const strategienRows = (this.strategien || []).map(s => {
      let verknuepfung = '';
      if (s.marke) {
        verknuepfung = s.marke.name;
      } else if (s.unternehmen) {
        verknuepfung = s.unternehmen.name;
      }

      const createdAt = new Date(s.created_at).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      return `
        <tr class="table-row-clickable" onclick="window.navigateTo('/strategie/${s.id}')">
          <td>
            <strong>${window.validatorSystem.sanitizeHtml(s.name || 'Ohne Namen')}</strong>
            ${s.beschreibung ? `<br><span style="font-size: var(--text-xs); color: var(--text-secondary);">${window.validatorSystem.sanitizeHtml(s.beschreibung)}</span>` : ''}
          </td>
          <td>${window.validatorSystem.sanitizeHtml(verknuepfung || '—')}</td>
          <td>${createdAt}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <div class="kunden-portal">
        <!-- Kampagnen Section -->
        <div style="margin-bottom: var(--space-xxl);">
          <h2 style="margin-bottom: var(--space-md);">Meine Kampagnen</h2>
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
              <tbody>
                ${kampagnenRows || '<tr><td colspan="4" style="text-align: center; padding: var(--space-lg); color: var(--text-secondary);">Keine Kampagnen</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Strategien Section -->
        <div>
          <h2 style="margin-bottom: var(--space-md);">Content-Strategien</h2>
          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Strategie</th>
                  <th>Verknüpfung</th>
                  <th>Erstellt am</th>
                </tr>
              </thead>
              <tbody>
                ${strategienRows || '<tr><td colspan="3" style="text-align: center; padding: var(--space-lg); color: var(--text-secondary);">Keine Strategien</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
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















