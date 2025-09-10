// MitarbeiterDetail.js (ES6-Modul)
// Admin: Mitarbeiter-Details und Rechte bearbeiten
import { actionsDropdown } from '../../core/ActionsDropdown.js';

export class MitarbeiterDetail {
  constructor() {
    this.userId = null;
    this.user = null;
    this.assignments = { kampagnen: [], kooperationen: [], briefings: [] };
    this.budget = { invoicesByKoop: {}, totals: { netto: 0, zusatz: 0, gesamt: 0, invoice_netto: 0, invoice_brutto: 0 } };
    this.statusOptions = [];
  }

  async init(id) {
    this.userId = id;
    await this.load();
    await this.render();
    this.bind();
  }

  async load() {
    try {
      const { data: user } = await window.supabase
        .from('benutzer')
        .select('*')
        .eq('id', this.userId)
        .single();
      this.user = user || {};

      const [{ data: kampRel }, { data: koops }, { data: briefs }, { data: statusRows }] = await Promise.all([
        window.supabase
          .from('kampagne_mitarbeiter')
          .select('kampagne:kampagne_id(id, kampagnenname)')
          .eq('mitarbeiter_id', this.userId),
        window.supabase.from('kooperationen').select('id, name, status, kampagne:kampagne_id(kampagnenname), nettobetrag, zusatzkosten, gesamtkosten').eq('assignee_id', this.userId),
        window.supabase.from('briefings').select('id, product_service_offer, status').eq('assignee_id', this.userId),
        window.supabase.from('kampagne_status').select('id, name, sort_order').order('sort_order', { ascending: true }).order('name', { ascending: true })
      ]);

      this.assignments.kampagnen = (kampRel || []).map(r => r.kampagne).filter(Boolean);
      this.assignments.kooperationen = koops || [];
      this.assignments.briefings = briefs || [];
      this.statusOptions = statusRows || [];

      const koopIds = (this.assignments.kooperationen || []).map(k => k.id).filter(Boolean);
      let invoicesByKoop = {};
      let totals = { netto: 0, zusatz: 0, gesamt: 0, invoice_netto: 0, invoice_brutto: 0 };
      if (koopIds.length > 0) {
        try {
          const { data: rechnungen } = await window.supabase
            .from('rechnung')
            .select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url, kooperation_id')
            .in('kooperation_id', koopIds);
          (rechnungen || []).forEach(r => {
            if (!invoicesByKoop[r.kooperation_id]) invoicesByKoop[r.kooperation_id] = [];
            invoicesByKoop[r.kooperation_id].push(r);
            totals.invoice_netto += Number(r.nettobetrag || 0);
            totals.invoice_brutto += Number(r.bruttobetrag || 0);
          });
        } catch (_) {
          invoicesByKoop = {};
        }
      }
      (this.assignments.kooperationen || []).forEach(k => {
        totals.netto += Number(k.nettobetrag || 0);
        totals.zusatz += Number(k.zusatzkosten || 0);
        totals.gesamt += Number(k.gesamtkosten != null ? k.gesamtkosten : (Number(k.nettobetrag || 0) + Number(k.zusatzkosten || 0)));
      });
      this.budget = { invoicesByKoop, totals };
    } catch (e) {
      console.error('❌ Fehler beim Laden Mitarbeiter-Details:', e);
    }
  }

  renderAssignmentsList(items, render) {
    if (!items || items.length === 0) return '<div class="empty-state"><p>Keine Einträge</p></div>';
    return `
      <ul class="simple-list">
        ${items.map(render).join('')}
      </ul>`;
  }

  // Tabellen-Renderer
  renderKampagnenTable() {
    const rows = (this.assignments.kampagnen || []).map(k => `
      <tr>
        <td><a href="/kampagne/${k.id}" onclick="event.preventDefault(); window.navigateTo('/kampagne/${k.id}')">${window.validatorSystem.sanitizeHtml(k.kampagnenname || k.id)}</a></td>
        <td style="text-align:right;">
          <div class="actions-dropdown-container" data-entity-type="kampagne">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <div class="action-submenu">
                <a href="#" class="action-item has-submenu" data-submenu="status">
                  ${actionsDropdown.getHeroIcon('invoice')}
                  <span>Status ändern</span>
                </a>
                <div class="submenu" data-submenu="status">
                  ${ (this.statusOptions || []).map(st => `
                    <a href=\"#\" class=\"submenu-item\" data-action=\"set-field\" data-field=\"status_id\" data-value=\"${st.id}\" data-status-name=\"${st.name.replace(/\"/g,'\\\"')}\" data-id=\"${k.id}\">${actionsDropdown.getStatusIcon(st.name)}<span>${st.name}</span>${''}</a>
                  `).join('') }
                </div>
              </div>
              <a href="#" class="action-item" data-action="view" data-id="${k.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /><path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" /></svg>
                Details anzeigen
              </a>
              <a href="#" class="action-item action-danger" data-action="unassign-kampagne" data-id="${k.id}" data-mitarbeiter-id="${this.userId}">
                <i class="icon-trash"></i>
                Zuweisung entfernen
              </a>
            </div>
          </div>
        </td>
      </tr>
    `).join('');
    if (!rows) return '<div class="empty-state"><p>Keine Kampagnen zugewiesen</p></div>';
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Kampagne</th><th>Aktionen</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  renderKooperationenTable() {
    const rows = (this.assignments.kooperationen || []).map(r => `
      <tr>
        <td><a href="/kooperation/${r.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${r.id}')">${window.validatorSystem.sanitizeHtml(r.name || r.id)}</a></td>
        <td>${window.validatorSystem.sanitizeHtml(r.kampagne?.kampagnenname || '-')}</td>
        <td><span class="status-badge status-${(r.status||'').toLowerCase().replace(/\s+/g,'-')}">${r.status || '-'}</span></td>
      </tr>
    `).join('');
    if (!rows) return '<div class="empty-state"><p>Keine Kooperationen zugewiesen</p></div>';
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Kampagne</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  renderBriefingsTable() {
    const rows = (this.assignments.briefings || []).map(b => `
      <tr>
        <td><a href="/briefing/${b.id}" onclick="event.preventDefault(); window.navigateTo('/briefing/${b.id}')">${window.validatorSystem.sanitizeHtml(b.product_service_offer || b.id)}</a></td>
        <td><span class="status-badge status-${(b.status||'').toLowerCase().replace(/\s+/g,'-')}">${b.status || '-'}</span></td>
      </tr>
    `).join('');
    if (!rows) return '<div class="empty-state"><p>Keine Briefings zugewiesen</p></div>';
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead><tr><th>Briefing</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  generatePermissionsTable() {
    const perms = this.user?.zugriffsrechte || {};
    return [['creator','Creator'],['creator-lists','Creator Listen'],['unternehmen','Unternehmen'],['marke','Marken'],['auftrag','Aufträge'],['kampagne','Kampagnen'],['kooperation','Kooperationen'],['rechnung','Rechnungen'],['briefing','Briefings']].map(([key,label]) => `
      <tr>
        <td>${label}</td>
        <td style="text-align:right;">
          <label class="toggle-label" style="justify-content:flex-end;">
            <span class="toggle-switch">
              <input type="checkbox" class="perm-toggle" data-key="${key}" ${perms?.[key]?.can_view === false ? '' : (perms?.[key] === true || perms?.[key]?.can_view === true ? 'checked' : '')}>
              <span class="toggle-slider"></span>
            </span>
          </label>
        </td>
        <td style="text-align:right;">
          <label class="toggle-label" style="justify-content:flex-end;">
            <span class="toggle-switch">
              <input type="checkbox" class="perm-edit-toggle" data-key="${key}" ${perms?.[key]?.can_edit ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </span>
          </label>
        </td>
      </tr>
    `).join('');
  }

  async autoSavePermissions() {
    if (!this.user?.freigeschaltet) {
      console.log('⚠️ Auto-Save übersprungen: Benutzer nicht freigeschaltet');
      return;
    }
    
    try {
      const viewToggles = document.querySelectorAll('.perm-toggle');
      const editToggles = document.querySelectorAll('.perm-edit-toggle');
      
      let updated = {};
      viewToggles.forEach(t => {
        const key = t.dataset.key;
        if (!updated[key]) updated[key] = {};
        updated[key].can_view = !!t.checked;
      });
      editToggles.forEach(t => {
        const key = t.dataset.key;
        if (!updated[key]) updated[key] = {};
        updated[key].can_edit = !!t.checked;
      });
      
      const { error } = await window.supabase
        .from('benutzer')
        .update({ zugriffsrechte: updated })
        .eq('id', this.userId);
        
      if (error) {
        console.error('❌ Auto-Save Rechte fehlgeschlagen', error);
        alert('Fehler beim Speichern der Rechte');
        return;
      }
      
      // Lokalen Status aktualisieren
      this.user.zugriffsrechte = updated;
      console.log('✅ Rechte automatisch gespeichert');
      
    } catch (err) {
      console.error('❌ Auto-Save Rechte Fehler', err);
      alert('Fehler beim Speichern der Rechte');
    }
  }

  async render() {
    const perms = this.user?.zugriffsrechte || {};
    const getToggle = (key, label) => `
      <label class="form-toggle">
        <input type="checkbox" class="perm-toggle" data-key="${key}" ${perms?.[key]?.can_view === false ? '' : (perms?.[key] === true || perms?.[key]?.can_view === true ? 'checked' : '')}>
        <span>${label}</span>
      </label>`;

    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Mitarbeiter: ${window.validatorSystem.sanitizeHtml(this.user?.name || '-')}</h1>
          <p>Rechte und Zuweisungen verwalten</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-back-mitarbeiter">Mitarbeiter Übersicht</button>
          <p class="text-muted" style="text-align: center; font-style: italic; margin: 1rem 0;">
            Änderungen werden automatisch gespeichert
          </p>
        </div>
      </div>

      <div class="content-section">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="rechte">Rechte</button>
          <button class="tab-button" data-tab="kampagnen">Kampagnen <span class="tab-count">${this.assignments.kampagnen.length}</span></button>
          <button class="tab-button" data-tab="koops">Kooperationen <span class="tab-count">${this.assignments.kooperationen.length}</span></button>
          <button class="tab-button" data-tab="budget">Mitarbeiter Budget</button>
          <button class="tab-button" data-tab="briefings">Briefings <span class="tab-count">${this.assignments.briefings.length}</span></button>
        </div>

        <div class="tab-content">
          <div class="tab-pane active" id="tab-rechte">
            <div class="detail-section">
              <h2>Benutzer-Status</h2>
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th style="width:120px; text-align:right;">Aktiv</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div>
                          <strong>Benutzer freigeschaltet</strong>
                          <div class="form-help" style="margin-top: 4px;">
                            ${this.user?.freigeschaltet ? 
                              'Dieser Benutzer ist freigeschaltet und kann sich anmelden. Sie können Rechte vergeben.' : 
                              'Dieser Benutzer wartet auf Freischaltung. Schalten Sie ihn frei, bevor Sie Rechte vergeben.'}
                          </div>
                        </div>
                      </td>
                      <td style="text-align:right;">
                        <label class="toggle-label" style="justify-content:flex-end;">
                          <span class="toggle-switch">
                            <input type="checkbox" id="freigeschaltet-toggle" ${this.user?.freigeschaltet ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                          </span>
                        </label>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="detail-section">
              <h2>Rechte</h2>
              ${this.user?.freigeschaltet ? 
                `<div class="data-table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Recht</th>
                        <th style="width:120px; text-align:right;">Lesen</th>
                        <th style="width:120px; text-align:right;">Bearbeiten</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${this.generatePermissionsTable()}
                    </tbody>
                  </table>
                </div>` 
                : '<p class="text-muted"><em>Rechte können erst nach der Freischaltung des Benutzers vergeben werden.</em></p>'
              }
            </div>
          </div>

          <div class="tab-pane" id="tab-kampagnen">
            <div class="detail-section">
              <h2>Zugewiesene Kampagnen</h2>
              ${this.renderKampagnenTable()}
            </div>
          </div>

          <div class="tab-pane" id="tab-koops">
            <div class="detail-section">
              <h2>Zugewiesene Kooperationen</h2>
              ${this.renderKooperationenTable()}
            </div>
          </div>

          <div class="tab-pane" id="tab-budget">
            <div class="detail-section">
              <h2>Mitarbeiter Budget</h2>
              ${this.renderBudget()}
            </div>
          </div>

          <div class="tab-pane" id="tab-briefings">
            <div class="detail-section">
              <h2>Zugewiesene Briefings</h2>
              ${this.renderBriefingsTable()}
            </div>
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  formatCurrency(value) {
    const num = Number(value || 0);
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(num);
  }

  renderBudget() {
    const koopRows = (this.assignments.kooperationen || []).map(k => {
      const invoices = this.budget.invoicesByKoop[k.id] || [];
      const invHtml = invoices.length
        ? invoices.map(r => `<div><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${window.validatorSystem.sanitizeHtml(r.rechnung_nr || r.id)}</a> — ${this.formatCurrency(r.bruttobetrag)} <span class="status-badge status-${(r.status||'').toLowerCase().replace(/\s+/g,'-')}">${r.status || '-'}</span></div>`).join('')
        : '<span class="muted">Keine Rechnung</span>';
      const netto = Number(k.nettobetrag || 0);
      const zusatz = Number(k.zusatzkosten || 0);
      const gesamt = (k.gesamtkosten != null) ? Number(k.gesamtkosten) : (netto + zusatz);
      return `
        <tr>
          <td><a href="/kooperation/${k.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${k.id}')">${window.validatorSystem.sanitizeHtml(k.name || k.id)}</a></td>
          <td>${window.validatorSystem.sanitizeHtml(k.kampagne?.kampagnenname || '-')}</td>
          <td style="text-align:right;">${this.formatCurrency(netto)}</td>
          <td style="text-align:right;">${this.formatCurrency(zusatz)}</td>
          <td style="text-align:right;">${this.formatCurrency(gesamt)}</td>
          <td>${invHtml}</td>
        </tr>
      `;
    }).join('');

    const totals = this.budget.totals || { netto: 0, zusatz: 0, gesamt: 0, invoice_netto: 0, invoice_brutto: 0 };
    const summary = `
      <div class="summary-cards grid-3">
        <div class="detail-card"><h3>Summe Netto (Koops)</h3><div class="detail-value">${this.formatCurrency(totals.netto)}</div></div>
        <div class="detail-card"><h3>Summe Zusatzkosten</h3><div class="detail-value">${this.formatCurrency(totals.zusatz)}</div></div>
        <div class="detail-card"><h3>Summe Gesamtkosten</h3><div class="detail-value">${this.formatCurrency(totals.gesamt)}</div></div>
      </div>
      <div class="summary-cards grid-2" style="margin-top:12px;">
        <div class="detail-card"><h3>Summe Rechnungen Netto</h3><div class="detail-value">${this.formatCurrency(totals.invoice_netto)}</div></div>
        <div class="detail-card"><h3>Summe Rechnungen Brutto</h3><div class="detail-value">${this.formatCurrency(totals.invoice_brutto)}</div></div>
      </div>
    `;

    const table = koopRows
      ? `
        <div class="data-table-container" style="margin-top:12px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Kooperation</th>
                <th>Kampagne</th>
                <th style=\"text-align:right;\">Netto</th>
                <th style=\"text-align:right;\">Zusatz</th>
                <th style=\"text-align:right;\">Gesamt</th>
                <th>Rechnungen</th>
              </tr>
            </thead>
            <tbody>${koopRows}</tbody>
          </table>
        </div>
      `
      : '<div class="empty-state"><p>Keine Kooperationen zugewiesen</p></div>';

    return `${summary}${table}`;
  }

  bind() {
    // Tab-Navigation
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-button');
      if (!btn) return;
      e.preventDefault();
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const pane = document.getElementById(`tab-${tab}`);
      if (pane) pane.classList.add('active');
    });

    // Live Toggle für Freigeschaltet-Status mit Auto-Save
    const self = this;
    document.addEventListener('change', async (e) => {
      if (e.target && e.target.id === 'freigeschaltet-toggle') {
        const isFreigeschaltet = e.target.checked;
        const rechteSection = document.querySelector('#tab-rechte .detail-section:nth-child(2)');
        const statusHelp = document.querySelector('#tab-rechte .form-help');
        
        // Auto-Save Freigeschaltet Status
        try {
          const { error } = await window.supabase
            .from('benutzer')
            .update({ freigeschaltet: isFreigeschaltet })
            .eq('id', self.userId);
            
          if (error) {
            console.error('❌ Auto-Save Freigeschaltet fehlgeschlagen', error);
            // Toggle zurücksetzen bei Fehler
            e.target.checked = !isFreigeschaltet;
            alert('Fehler beim Speichern des Freischaltungs-Status');
            return;
          }
          
          // Lokalen Status aktualisieren
          self.user.freigeschaltet = isFreigeschaltet;
          
          // Notification senden
          if (window.notificationSystem && self.user.auth_user_id) {
            await window.notificationSystem.pushNotification(self.user.auth_user_id, {
              type: 'system',
              entity: 'benutzer',
              entityId: self.userId,
              title: isFreigeschaltet ? 'Ihr Account wurde freigeschaltet' : 'Ihr Account wurde gesperrt',
              message: isFreigeschaltet ? 
                'Sie können sich jetzt anmelden und das System nutzen.' : 
                'Ihr Zugang wurde vorübergehend deaktiviert.'
            });
            window.dispatchEvent(new Event('notificationsRefresh'));
          }
          
          console.log(`✅ Benutzer ${isFreigeschaltet ? 'freigeschaltet' : 'gesperrt'}`);
        } catch (err) {
          console.error('❌ Auto-Save Fehler', err);
          e.target.checked = !isFreigeschaltet;
          alert('Fehler beim Speichern');
          return;
        }
        
        // UI aktualisieren
        if (rechteSection) {
          if (isFreigeschaltet) {
            rechteSection.style.display = 'block';
            rechteSection.innerHTML = `
              <h2>Rechte</h2>
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Recht</th>
                      <th style="width:120px; text-align:right;">Lesen</th>
                      <th style="width:120px; text-align:right;">Bearbeiten</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${self.generatePermissionsTable()}
                  </tbody>
                </table>
              </div>
            `;
          } else {
            rechteSection.innerHTML = `
              <h2>Rechte</h2>
              <p class="text-muted"><em>Rechte können erst nach der Freischaltung des Benutzers vergeben werden.</em></p>
            `;
          }
        }
        
        // Status-Hilfetext aktualisieren
        if (statusHelp) {
          statusHelp.textContent = isFreigeschaltet ? 
            'Dieser Benutzer ist freigeschaltet und kann sich anmelden. Sie können Rechte vergeben.' : 
            'Dieser Benutzer wartet auf Freischaltung. Schalten Sie ihn frei, bevor Sie Rechte vergeben.';
        }
      }
      
      // Auto-Save für Rechte-Toggles
      if (e.target && (e.target.classList.contains('perm-toggle') || e.target.classList.contains('perm-edit-toggle'))) {
        await self.autoSavePermissions();
      }
    });

    document.addEventListener('click', async (e) => {
      if (e.target && e.target.id === 'btn-back-mitarbeiter') {
        e.preventDefault();
        window.navigateTo('/mitarbeiter');
        return;
      }
      if (e.target && e.target.id === 'btn-save-perms') {
        e.preventDefault();
        
        // Freigeschaltet-Status
        const freigeschaltetToggle = document.getElementById('freigeschaltet-toggle');
        const freigeschaltet = freigeschaltetToggle ? freigeschaltetToggle.checked : this.user?.freigeschaltet;
        
        // Rechte nur verarbeiten wenn Benutzer freigeschaltet ist
        let updated = {};
        if (freigeschaltet) {
          const viewToggles = document.querySelectorAll('.perm-toggle');
          const editToggles = document.querySelectorAll('.perm-edit-toggle');
          viewToggles.forEach(t => {
            const key = t.dataset.key;
            if (!updated[key]) updated[key] = {};
            updated[key].can_view = !!t.checked;
          });
          editToggles.forEach(t => {
            const key = t.dataset.key;
            if (!updated[key]) updated[key] = {};
            updated[key].can_edit = !!t.checked;
          });
        }
        
        try {
          const updateData = { 
            freigeschaltet: freigeschaltet,
            zugriffsrechte: updated 
          };
          
          const { error } = await window.supabase
            .from('benutzer')
            .update(updateData)
            .eq('id', this.userId);
            
          if (error) throw error;
          
          // Update local user data
          this.user.freigeschaltet = freigeschaltet;
          this.user.zugriffsrechte = updated;
          
          // Notification an den betroffenen User
          try {
            const statusMsg = freigeschaltet ? 'freigeschaltet' : 'gesperrt';
            const changes = Object.entries(updated).map(([k,v]) => `${k}: ${(v?.can_view?'R':'-')}/${(v?.can_edit?'E':'-')}`).join(', ');
            await window.notificationSystem?.pushNotification(this.userId, {
              type: 'update',
              entity: 'mitarbeiter',
              entityId: this.userId,
              title: freigeschaltet ? 'Account freigeschaltet' : 'Account gesperrt',
              message: freigeschaltet ? 
                `Ihr Account wurde freigeschaltet. ${changes ? 'Rechte: ' + changes : ''}` :
                'Ihr Account wurde gesperrt.'
            });
            window.dispatchEvent(new Event('notificationsRefresh'));
          } catch (_) {}
          
          alert(freigeschaltet ? 'Benutzer freigeschaltet und Rechte gespeichert' : 'Benutzer gesperrt');
          
          // Re-render to show/hide permissions section
          await this.render();
          this.bind();
          
        } catch (err) {
          console.error('❌ Speichern fehlgeschlagen', err);
          alert('Fehler beim Speichern');
        }
      }
    });

    // Entfernen-Logik läuft zentral im ActionsDropdown (unassign-kampagne)
  }

  destroy() {
    window.setContentSafely('');
  }
}

export const mitarbeiterDetail = new MitarbeiterDetail();


