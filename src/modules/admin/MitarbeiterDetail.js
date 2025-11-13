// MitarbeiterDetail.js (ES6-Modul)
// Admin: Mitarbeiter-Details und Rechte bearbeiten
import { actionsDropdown } from '../../core/ActionsDropdown.js';

export class MitarbeiterDetail {
  constructor() {
    this.userId = null;
    this.user = null;
    this.assignments = { kampagnen: [], kooperationen: [], briefings: [] };
    this.zugeordnet = { unternehmen: [], marken: [] };
    this.budget = { invoicesByKoop: {}, totals: { netto: 0, zusatz: 0, gesamt: 0, invoice_netto: 0, invoice_brutto: 0 } };
    this.statusOptions = [];
  }

  async init(id) {
    this.userId = id;
    await this.load();
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem && this.user) {
      const userName = this.user.name || 'Details';
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Mitarbeiter', url: '/mitarbeiter', clickable: true },
        { label: userName, url: `/mitarbeiter/${this.userId}`, clickable: false }
      ]);
    }
    
    await this.render();
    this.bind();
  }

  async load() {
    try {
      const { data: user } = await window.supabase
        .from('benutzer')
        .select('*, mitarbeiter_klasse:mitarbeiter_klasse_id(id, name)')
        .eq('id', this.userId)
        .single();
      this.user = user || {};
      
      // Mitarbeiter-Klassen-Name extrahieren
      if (this.user.mitarbeiter_klasse) {
        this.user.mitarbeiter_klasse_name = this.user.mitarbeiter_klasse.name;
      }

      const [{ data: kampRel }, { data: koops }, { data: briefs }, { data: statusRows }, { data: unternehmenRel }, { data: markenRel }] = await Promise.all([
        window.supabase
          .from('kampagne_mitarbeiter')
          .select('kampagne:kampagne_id(id, kampagnenname)')
          .eq('mitarbeiter_id', this.userId),
        window.supabase.from('kooperationen').select('id, name, status, kampagne:kampagne_id(kampagnenname), einkaufspreis_netto, einkaufspreis_zusatzkosten, einkaufspreis_gesamt').eq('assignee_id', this.userId),
        window.supabase.from('briefings').select('id, product_service_offer, status').eq('assignee_id', this.userId),
        window.supabase.from('kampagne_status').select('id, name, sort_order').order('sort_order', { ascending: true }).order('name', { ascending: true }),
        window.supabase
          .from('mitarbeiter_unternehmen')
          .select('unternehmen:unternehmen_id(id, firmenname)')
          .eq('mitarbeiter_id', this.userId),
        window.supabase
          .from('marke_mitarbeiter')
          .select('marke:marke_id(id, markenname)')
          .eq('mitarbeiter_id', this.userId)
      ]);

      // Direkt zugeordnete Kampagnen
      const directKampagnen = (kampRel || []).map(r => r.kampagne).filter(Boolean);
      
      // Kampagnen über zugeordnete Unternehmen laden
      const unternehmenIds = (unternehmenRel || []).map(r => r.unternehmen?.id).filter(Boolean);
      let unternehmenKampagnen = [];
      
      if (unternehmenIds.length > 0) {
        try {
          // Alle Marken dieser Unternehmen finden
          const { data: unternehmenMarken } = await window.supabase
            .from('marke')
            .select('id')
            .in('unternehmen_id', unternehmenIds);
          
          const markenIds = (unternehmenMarken || []).map(m => m.id).filter(Boolean);
          
          if (markenIds.length > 0) {
            // Alle Kampagnen dieser Marken laden
            const { data: kampagnen } = await window.supabase
              .from('kampagne')
              .select('id, kampagnenname')
              .in('marke_id', markenIds);
            
            unternehmenKampagnen = (kampagnen || []).filter(Boolean);
          }
        } catch (e) {
          console.error('❌ Fehler beim Laden von Unternehmen-Kampagnen:', e);
        }
      }
      
      // Alle Kampagnen zusammenführen (ohne Duplikate)
      const allKampagnenMap = new Map();
      [...directKampagnen, ...unternehmenKampagnen].forEach(k => {
        if (k && k.id) {
          allKampagnenMap.set(k.id, k);
        }
      });
      
      this.assignments.kampagnen = Array.from(allKampagnenMap.values());
      
      // Kooperationen: Direkt zugewiesen + über Kampagnen des Unternehmens
      const directKoops = koops || [];
      
      // Kooperationen über Kampagnen laden (die wir durch Unternehmen haben)
      const allKampagnenIds = Array.from(allKampagnenMap.keys());
      let unternehmenKoops = [];
      
      if (allKampagnenIds.length > 0) {
        try {
          const { data: kampagnenKoops } = await window.supabase
            .from('kooperationen')
            .select('id, name, status, kampagne:kampagne_id(kampagnenname), einkaufspreis_netto, einkaufspreis_zusatzkosten, einkaufspreis_gesamt')
            .in('kampagne_id', allKampagnenIds);
          
          unternehmenKoops = kampagnenKoops || [];
        } catch (e) {
          console.error('❌ Fehler beim Laden von Unternehmen-Kooperationen:', e);
        }
      }
      
      // Alle Kooperationen zusammenführen (ohne Duplikate)
      const allKoopsMap = new Map();
      [...directKoops, ...unternehmenKoops].forEach(k => {
        if (k && k.id) {
          allKoopsMap.set(k.id, k);
        }
      });
      
      this.assignments.kooperationen = Array.from(allKoopsMap.values());
      this.assignments.briefings = briefs || [];
      this.statusOptions = statusRows || [];
      this.zugeordnet = {
        unternehmen: (unternehmenRel || []).map(r => r.unternehmen).filter(Boolean),
        marken: (markenRel || []).map(r => r.marke).filter(Boolean)
      };

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
        totals.netto += Number(k.einkaufspreis_netto || 0);
        totals.zusatz += Number(k.einkaufspreis_zusatzkosten || 0);
        totals.gesamt += Number(k.einkaufspreis_gesamt != null ? k.einkaufspreis_gesamt : (Number(k.einkaufspreis_netto || 0) + Number(k.einkaufspreis_zusatzkosten || 0)));
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
      <div class="content-section">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="rechte">Rechte</button>
          <button class="tab-button" data-tab="unternehmen">Unternehmen <span class="tab-count">${this.zugeordnet.unternehmen.length}</span></button>
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
              <h2>Mitarbeiter-Rolle</h2>
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Rolle / Klasse</th>
                      <th style="width: 200px; text-align: right;">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div>
                          <strong>${this.user?.mitarbeiter_klasse_name || 'Keine Rolle zugewiesen'}</strong>
                          <div class="form-help" style="margin-top: 4px;">
                            Definiert die Hauptaufgaben und Zuständigkeiten des Mitarbeiters
                          </div>
                        </div>
                      </td>
                      <td style="text-align: right;">
                        <button class="secondary-btn" id="btn-change-rolle">Rolle ändern</button>
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

          <div class="tab-pane" id="tab-unternehmen">
            <div class="detail-section">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>
                  <h2>Zugeordnete Unternehmen</h2>
                  <p class="form-help" style="margin-top: 8px;">Wenn Sie einem Mitarbeiter ein Unternehmen zuordnen, hat er automatisch Zugriff auf alle Marken, Kampagnen und Kooperationen dieses Unternehmens.</p>
                </div>
                <button class="primary-btn" id="btn-add-unternehmen">+ Unternehmen zuordnen</button>
              </div>
              ${this.renderUnternehmenTable()}
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

  // Render Unternehmen Tabelle
  renderUnternehmenTable() {
    if (!this.zugeordnet.unternehmen || this.zugeordnet.unternehmen.length === 0) {
      return '<div class="empty-state"><p>Keine Unternehmen zugeordnet</p></div>';
    }
    
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Firmenname</th>
              <th>Erstellt</th>
              <th style="width: 150px; text-align: center;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.zugeordnet.unternehmen.map(u => {
              const createdDate = u.created_at ? new Date(u.created_at).toLocaleDateString('de-DE') : '—';
              return `
              <tr data-id="${u.id}">
                <td>
                  <a href="/unternehmen/${u.id}" onclick="event.preventDefault(); window.navigateTo('/unternehmen/${u.id}')" class="table-link">
                    ${window.validatorSystem.sanitizeHtml(u.firmenname || u.id)}
                  </a>
                </td>
                <td>${createdDate}</td>
                <td style="text-align: center;">
                  <button class="secondary-btn btn-remove-unternehmen" data-id="${u.id}" data-name="${window.validatorSystem.sanitizeHtml(u.firmenname)}">
                    Entfernen
                  </button>
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // Render Marken Liste
  renderMarkenListe() {
    if (!this.zugeordnet.marken || this.zugeordnet.marken.length === 0) {
      return '<div class="empty-state"><p>Keine Marken zugeordnet</p></div>';
    }
    
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Markenname</th>
              <th style="width: 120px;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.zugeordnet.marken.map(m => `
              <tr data-id="${m.id}">
                <td>
                  <a href="/marke/${m.id}" onclick="event.preventDefault(); window.navigateTo('/marke/${m.id}')" class="table-link">
                    ${window.validatorSystem.sanitizeHtml(m.markenname || m.id)}
                  </a>
                </td>
                <td>
                  <button class="secondary-btn btn-remove-marke" data-id="${m.id}" data-name="${window.validatorSystem.sanitizeHtml(m.markenname)}">Entfernen</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }

  renderBudget() {
    const koopRows = (this.assignments.kooperationen || []).map(k => {
      const invoices = this.budget.invoicesByKoop[k.id] || [];
      const invHtml = invoices.length
        ? invoices.map(r => `<div><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${window.validatorSystem.sanitizeHtml(r.rechnung_nr || r.id)}</a> — ${this.formatCurrency(r.bruttobetrag)} <span class="status-badge status-${(r.status||'').toLowerCase().replace(/\s+/g,'-')}">${r.status || '-'}</span></div>`).join('')
        : '<span class="muted">Keine Rechnung</span>';
      const netto = Number(k.einkaufspreis_netto || 0);
      const zusatz = Number(k.einkaufspreis_zusatzkosten || 0);
      const gesamt = (k.einkaufspreis_gesamt != null) ? Number(k.einkaufspreis_gesamt) : (netto + zusatz);
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

    // Event-Handler für "Rolle ändern" Button
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-change-rolle')) {
        e.preventDefault();
        this.showChangeRolleModal();
      }
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
          // Bei Freischaltung auch rolle und unterrolle anpassen
          const updateData = { freigeschaltet: isFreigeschaltet };
          
          if (isFreigeschaltet) {
            // Wenn freigeschaltet: rolle von "pending" auf "mitarbeiter" und unterrolle auf "can_view"
            if (self.user.rolle === 'pending') {
              updateData.rolle = 'mitarbeiter';
            }
            if (self.user.unterrolle === 'awaiting_approval') {
              updateData.unterrolle = 'can_view';
            }
          } else {
            // Wenn gesperrt: zurück auf pending status
            updateData.rolle = 'pending';
            updateData.unterrolle = 'awaiting_approval';
            updateData.zugriffsrechte = null; // Rechte entfernen
          }
          
          const { error } = await window.supabase
            .from('benutzer')
            .update(updateData)
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
          if (updateData.rolle) self.user.rolle = updateData.rolle;
          if (updateData.unterrolle) self.user.unterrolle = updateData.unterrolle;
          if (updateData.zugriffsrechte !== undefined) self.user.zugriffsrechte = updateData.zugriffsrechte;
          
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
          
          // Seite neu rendern um aktualisierte Rolle/Unterrolle anzuzeigen
          setTimeout(() => {
            self.render().then(() => self.bind());
          }, 100);
          
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
    
    // Event-Handler für Unternehmen zuordnen
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-add-unternehmen')) {
        e.preventDefault();
        this.showAddUnternehmenModal();
      }
    });
    
    // Event-Handler für Unternehmen entfernen
    document.addEventListener('click', async (e) => {
      const removeBtn = e.target.closest('.btn-remove-unternehmen');
      if (removeBtn) {
        e.preventDefault();
        const unternehmenId = removeBtn.dataset.id;
        const unternehmenName = removeBtn.dataset.name;
        
        if (window.confirmationModal) {
          const result = await window.confirmationModal.open({
            title: 'Unternehmen-Zuordnung entfernen',
            message: `Möchten Sie die Zuordnung zu "${unternehmenName}" wirklich entfernen?\n\nDer Mitarbeiter verliert dadurch automatisch den Zugriff auf alle Marken, Kampagnen und Kooperationen dieses Unternehmens.`,
            confirmText: 'Zuordnung entfernen',
            cancelText: 'Abbrechen',
            danger: true
          });
          
          if (result?.confirmed) {
            await this.removeUnternehmen(unternehmenId, unternehmenName);
          }
        } else {
          if (confirm(`Möchten Sie die Zuordnung zu "${unternehmenName}" wirklich entfernen?`)) {
            await this.removeUnternehmen(unternehmenId, unternehmenName);
          }
        }
      }
    });
  }

  // Bearbeitungsformular anzeigen (für Admin-Bearbeitung)
  showEditForm() {
    console.log('🎯 MITARBEITERDETAIL: Zeige Bearbeitungsformular');
    window.setHeadline('Mitarbeiter bearbeiten');
    
    // Für Mitarbeiter verwenden wir ein spezielles Admin-Formular
    // Da es sehr spezifisch ist, nutzen wir das bestehende Inline-Editing
    // oder zeigen eine Nachricht, dass die Bearbeitung über die Detail-Ansicht erfolgt
    
    window.content.innerHTML = `
      <div class="content-section">
        <div class="info-message">
          <h2>Hinweis</h2>
          <p>Die Bearbeitung von Mitarbeitern erfolgt direkt über die Detail-Ansicht mit speziellen Admin-Funktionen.</p>
        </div>
      </div>
    `;
  }

  // Modal für Rollen-Änderung
  async showChangeRolleModal() {
    // Entferne existierende Modals
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>Mitarbeiter-Rolle ändern</h3>
          <button id="close-modal" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Rolle / Klasse</label>
            <p class="form-help" style="margin-bottom: 10px;">Definiert die Hauptaufgaben und Zuständigkeiten des Mitarbeiters</p>
            <input id="rolle-search" class="form-input" type="text" placeholder="Rolle suchen..." autocomplete="off" />
            <div id="rolle-dropdown" class="auto-suggest-dropdown" style="display: none;"></div>
          </div>
          <div id="selected-rolle" class="selected-items" style="margin-top: 10px;"></div>
        </div>
        <div class="modal-footer">
          <button id="save-rolle" class="primary-btn" disabled>Speichern</button>
          <button id="cancel-rolle" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#rolle-search');
    const dropdown = modal.querySelector('#rolle-dropdown');
    const selectedContainer = modal.querySelector('#selected-rolle');
    const saveBtn = modal.querySelector('#save-rolle');
    let selectedRolle = null;
    let searchTimeout;
    let allRollen = [];

    // Alle Mitarbeiter-Klassen laden
    try {
      const { data, error } = await window.supabase
        .from('mitarbeiter_klasse')
        .select('id, name, description')
        .order('sort_order')
        .order('name');

      if (error) throw error;
      allRollen = data || [];
    } catch (err) {
      console.error('❌ Fehler beim Laden der Rollen', err);
      window.NotificationSystem?.show('error', 'Fehler beim Laden der Rollen');
      modal.remove();
      return;
    }

    // Auto-Suggestion für Rollen
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const query = e.target.value.trim().toLowerCase();
        
        if (query.length === 0) {
          // Zeige alle Rollen wenn leer
          displayRollen(allRollen);
        } else if (query.length < 2) {
          dropdown.style.display = 'none';
        } else {
          // Filtere lokale Rollen
          const filtered = allRollen.filter(r => 
            r.name.toLowerCase().includes(query) || 
            (r.description && r.description.toLowerCase().includes(query))
          );
          displayRollen(filtered);
        }
      }, 150);
    });

    // Zeige initial alle Rollen
    input.addEventListener('focus', () => {
      if (input.value.trim().length === 0) {
        displayRollen(allRollen);
      }
    });

    function displayRollen(rollen) {
      if (rollen.length > 0) {
        dropdown.innerHTML = rollen.map(r => `
          <div class="dropdown-item" data-id="${r.id}" data-name="${r.name}">
            <div class="dropdown-item-main">${window.validatorSystem.sanitizeHtml(r.name)}</div>
            ${r.description ? `<div class="dropdown-item-sub">${window.validatorSystem.sanitizeHtml(r.description)}</div>` : ''}
          </div>
        `).join('');
        dropdown.style.display = 'block';
      } else {
        dropdown.innerHTML = '<div class="dropdown-item no-results">Keine Rolle gefunden</div>';
        dropdown.style.display = 'block';
      }
    }

    // Dropdown-Auswahl
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item[data-id]');
      if (!item) return;

      selectedRolle = {
        id: item.dataset.id,
        name: item.dataset.name
      };

      selectedContainer.innerHTML = `
        <div class="selected-item">
          <span class="selected-item-name">${window.validatorSystem.sanitizeHtml(selectedRolle.name)}</span>
          <button type="button" class="selected-item-remove">&times;</button>
        </div>
      `;

      input.value = '';
      dropdown.style.display = 'none';
      saveBtn.disabled = false;
    });

    // Entfernen der Auswahl
    selectedContainer.addEventListener('click', (e) => {
      if (e.target.closest('.selected-item-remove')) {
        selectedRolle = null;
        selectedContainer.innerHTML = '';
        saveBtn.disabled = true;
      }
    });

    // Speichern
    saveBtn.addEventListener('click', async () => {
      if (!selectedRolle) return;

      try {
        const { error } = await window.supabase
          .from('benutzer')
          .update({ mitarbeiter_klasse_id: selectedRolle.id })
          .eq('id', this.userId);

        if (error) throw error;

        window.NotificationSystem?.show('success', `Rolle erfolgreich auf "${selectedRolle.name}" geändert`);
        modal.remove();
        
        // Daten neu laden und Seite aktualisieren
        await this.load();
        await this.render();
        this.bind();
      } catch (err) {
        console.error('❌ Rolle ändern fehlgeschlagen', err);
        window.NotificationSystem?.show('error', 'Rolle ändern fehlgeschlagen: ' + err.message);
      }
    });

    // Modal schließen
    const closeModal = () => modal.remove();
    modal.querySelector('#close-modal').onclick = closeModal;
    modal.querySelector('#cancel-rolle').onclick = closeModal;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Focus auf Input
    setTimeout(() => input.focus(), 100);
  }

  // Event-Handler für Unternehmen-Zuordnungen
  async showAddUnternehmenModal() {
    // Entferne existierende Modals
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>Unternehmen zuordnen</h3>
          <button id="close-modal" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Unternehmen suchen</label>
            <input id="unternehmen-search" class="form-input" type="text" placeholder="Firmenname eingeben..." autocomplete="off" />
            <div id="unternehmen-dropdown" class="auto-suggest-dropdown" style="display: none;"></div>
          </div>
          <div id="selected-unternehmen" class="selected-items" style="margin-top: 10px;"></div>
        </div>
        <div class="modal-footer">
          <button id="save-zuordnung" class="primary-btn" disabled>Zuordnen</button>
          <button id="cancel-zuordnung" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#unternehmen-search');
    const dropdown = modal.querySelector('#unternehmen-dropdown');
    const selectedContainer = modal.querySelector('#selected-unternehmen');
    const saveBtn = modal.querySelector('#save-zuordnung');
    let selectedUnternehmen = null;
    let searchTimeout;

    // Auto-Suggestion für Unternehmen
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const query = e.target.value.trim();
        
        if (query.length < 2) {
          dropdown.style.display = 'none';
          return;
        }

        try {
          const { data, error } = await window.supabase
            .from('unternehmen')
            .select('id, firmenname')
            .ilike('firmenname', `%${query}%`)
            .order('firmenname')
            .limit(10);

          if (error) throw error;

          if (data && data.length > 0) {
            dropdown.innerHTML = data.map(u => `
              <div class="dropdown-item" data-id="${u.id}" data-name="${u.firmenname}">
                <div class="dropdown-item-main">${window.validatorSystem.sanitizeHtml(u.firmenname)}</div>
              </div>
            `).join('');
            dropdown.style.display = 'block';
          } else {
            dropdown.innerHTML = '<div class="dropdown-item no-results">Keine Unternehmen gefunden</div>';
            dropdown.style.display = 'block';
          }
        } catch (err) {
          console.error('❌ Unternehmen-Suche fehlgeschlagen', err);
          dropdown.innerHTML = '<div class="dropdown-item no-results">Fehler bei der Suche</div>';
          dropdown.style.display = 'block';
        }
      }, 300);
    });

    // Dropdown-Auswahl
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item[data-id]');
      if (!item) return;

      selectedUnternehmen = {
        id: item.dataset.id,
        name: item.dataset.name
      };

      selectedContainer.innerHTML = `
        <div class="selected-item">
          <span class="selected-item-name">${window.validatorSystem.sanitizeHtml(selectedUnternehmen.name)}</span>
          <button type="button" class="selected-item-remove">&times;</button>
        </div>
      `;

      input.value = '';
      dropdown.style.display = 'none';
      saveBtn.disabled = false;
    });

    // Auswahl entfernen
    selectedContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('selected-item-remove')) {
        selectedUnternehmen = null;
        selectedContainer.innerHTML = '';
        saveBtn.disabled = true;
      }
    });

    // Speichern
    saveBtn.addEventListener('click', async () => {
      if (!selectedUnternehmen) return;

      try {
        const { error } = await window.supabase
          .from('mitarbeiter_unternehmen')
          .insert({ 
            mitarbeiter_id: this.userId, 
            unternehmen_id: selectedUnternehmen.id 
          });

        if (error) {
          // Prüfe ob es ein Duplicate-Key-Fehler ist
          if (error.code === '23505') {
            window.NotificationSystem?.show('warning', 'Unternehmen ist bereits zugeordnet');
            modal.remove();
            return;
          }
          throw error;
        }

        window.NotificationSystem?.show('success', 'Unternehmen erfolgreich zugeordnet');
        modal.remove();
        
        // Daten neu laden und Seite aktualisieren
        await this.load();
        await this.render();
        this.bind();
      } catch (err) {
        console.error('❌ Zuordnung fehlgeschlagen', err);
        window.NotificationSystem?.show('error', 'Zuordnung fehlgeschlagen: ' + err.message);
      }
    });

    // Modal schließen
    const closeModal = () => modal.remove();
    modal.querySelector('#close-modal').onclick = closeModal;
    modal.querySelector('#cancel-zuordnung').onclick = closeModal;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Focus auf Input
    setTimeout(() => input.focus(), 100);
  }

  // Unternehmen-Zuordnung entfernen
  async removeUnternehmen(unternehmenId, unternehmenName) {
    try {
      const { error } = await window.supabase
        .from('mitarbeiter_unternehmen')
        .delete()
        .eq('mitarbeiter_id', this.userId)
        .eq('unternehmen_id', unternehmenId);

      if (error) throw error;

      window.NotificationSystem?.show('success', `Unternehmen "${unternehmenName}" erfolgreich entfernt`);
      
      // Daten neu laden und Seite aktualisieren
      await this.load();
      await this.render();
      this.bind();
    } catch (err) {
      console.error('❌ Entfernen fehlgeschlagen', err);
      window.NotificationSystem?.show('error', 'Entfernen fehlgeschlagen: ' + err.message);
    }
  }

  destroy() {
    window.setContentSafely('');
  }
}

export const mitarbeiterDetail = new MitarbeiterDetail();


