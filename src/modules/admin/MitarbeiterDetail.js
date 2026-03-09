// MitarbeiterDetail.js (ES6-Modul)
// Admin: Mitarbeiter-Details und Rechte bearbeiten
// Nutzt einheitliches zwei-Spalten-Layout
import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { PersonDetailBase } from './PersonDetailBase.js';
import { renderTabButton } from '../../core/TabUtils.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';

export class MitarbeiterDetail extends PersonDetailBase {
  constructor() {
    super();
    this.userId = null;
    this.user = null;
    this.assignments = { kampagnen: [], kooperationen: [], briefings: [], auftragsdetails: [] };
    this.zugeordnet = { unternehmen: [], marken: [] };
    this.budget = { invoicesByKoop: {}, totals: { netto: 0, zusatz: 0, gesamt: 0, invoice_netto: 0, invoice_brutto: 0 } };
    this.statusOptions = [];
    this.euLaender = [];
    this.activeMainTab = 'informationen';
    this._eventsBound = false;
  }

  async init(id) {
    this.userId = id;
    await this.load();
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem && this.user) {
      const userName = this.getDisplayName();
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Mitarbeiter', url: '/mitarbeiter', clickable: true },
        { label: userName, url: `/mitarbeiter/${this.userId}`, clickable: false }
      ]);
    }
    
    await this.loadActivities();
    await this.render();
    this.bind();
  }

  async load() {
    try {
      let { data: user, error: userError } = await window.supabase
        .from('benutzer')
        .select('*, mitarbeiter_klasse:mitarbeiter_klasse_id(id, name), telefonnummer_firmenhandy_land:telefonnummer_firmenhandy_land_id(id, name_de, vorwahl, iso_code)')
        .eq('id', this.userId)
        .single();
      if (userError) {
        console.warn('⚠️ Mitarbeiter-Ladung mit Firmenhandy-Feldern fehlgeschlagen, nutze Fallback:', userError.message);
        const fallbackResult = await window.supabase
          .from('benutzer')
          .select('*, mitarbeiter_klasse:mitarbeiter_klasse_id(id, name)')
          .eq('id', this.userId)
          .single();
        user = fallbackResult.data;
      }
      this.user = user || {};
      
      // Mitarbeiter-Klassen-Name extrahieren
      if (this.user.mitarbeiter_klasse) {
        this.user.mitarbeiter_klasse_name = this.user.mitarbeiter_klasse.name;
      }

      const [{ data: kampRel }, { data: koops }, { data: briefs }, { data: statusRows }, { data: unternehmenRel }, { data: markenRel }, { data: euLaenderRows }] = await Promise.all([
        window.supabase
          .from('kampagne_mitarbeiter')
          .select('kampagne:kampagne_id(id, kampagnenname, eigener_name)')
          .eq('mitarbeiter_id', this.userId),
        window.supabase.from('kooperationen').select('id, name, status, kampagne:kampagne_id(kampagnenname, eigener_name), einkaufspreis_netto, einkaufspreis_zusatzkosten, einkaufspreis_gesamt').eq('assignee_id', this.userId),
        window.supabase.from('briefings').select('id, product_service_offer, status').eq('assignee_id', this.userId),
        window.supabase.from('kampagne_status').select('id, name, sort_order').order('sort_order', { ascending: true }).order('name', { ascending: true }),
        window.supabase
          .from('mitarbeiter_unternehmen')
          .select('unternehmen:unternehmen_id(id, firmenname), role')
          .eq('mitarbeiter_id', this.userId),
        window.supabase
          .from('marke_mitarbeiter')
          .select('marke:marke_id(id, markenname)')
          .eq('mitarbeiter_id', this.userId),
        window.supabase
          .from('eu_laender')
          .select('id, name_de, vorwahl, iso_code')
          .order('name_de', { ascending: true })
      ]);

      // Direkt zugeordnete Kampagnen
      const directKampagnen = (kampRel || []).map(r => r.kampagne).filter(Boolean);
      
      // Kampagnen über zugeordnete Unternehmen laden
      const unternehmenIds = (unternehmenRel || []).map(r => r.unternehmen?.id).filter(Boolean);
      let unternehmenKampagnen = [];
      
      if (unternehmenIds.length > 0) {
        try {
          const { data: unternehmenMarken } = await window.supabase
            .from('marke')
            .select('id')
            .in('unternehmen_id', unternehmenIds);
          
          const markenIds = (unternehmenMarken || []).map(m => m.id).filter(Boolean);
          
          if (markenIds.length > 0) {
            const { data: kampagnen } = await window.supabase
              .from('kampagne')
              .select('id, kampagnenname, eigener_name')
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
      const allKampagnenIds = Array.from(allKampagnenMap.keys());
      let unternehmenKoops = [];
      
      if (allKampagnenIds.length > 0) {
        try {
          const { data: kampagnenKoops } = await window.supabase
            .from('kooperationen')
            .select('id, name, status, kampagne:kampagne_id(kampagnenname, eigener_name), einkaufspreis_netto, einkaufspreis_zusatzkosten, einkaufspreis_gesamt')
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
      this.euLaender = euLaenderRows || [];
      this.zugeordnet = {
        unternehmen: (unternehmenRel || []).map(r => ({
          ...r.unternehmen,
          role: r.role || 'mitarbeiter'
        })).filter(u => u && u.id),
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

      // Auftragsdetails laden (über zugeordnete Unternehmen)
      if (unternehmenIds.length > 0) {
        try {
          // Aufträge der zugeordneten Unternehmen laden
          const { data: auftraege } = await window.supabase
            .from('auftrag')
            .select('id')
            .in('unternehmen_id', unternehmenIds);
          
          const auftragIds = (auftraege || []).map(a => a.id).filter(Boolean);
          
          if (auftragIds.length > 0) {
            const { data: auftragsdetails } = await window.supabase
              .from('auftrag_details')
              .select(`
                *,
                auftrag:auftrag_id (
                  id,
                  auftragsname,
                  status
                )
              `)
              .in('auftrag_id', auftragIds)
              .order('created_at', { ascending: false });
            
            this.assignments.auftragsdetails = auftragsdetails || [];
          }
        } catch (e) {
          console.error('❌ Fehler beim Laden von Auftragsdetails:', e);
          this.assignments.auftragsdetails = [];
        }
      }
    } catch (e) {
      console.error('❌ Fehler beim Laden Mitarbeiter-Details:', e);
    }
  }

  async loadActivities() {
    try {
      // Lade relevante History-Einträge für diesen Mitarbeiter
      const allActivities = [];

      // Kampagne Status-Änderungen
      const { data: kampagneHistory } = await window.supabase
        .from('kampagne_history')
        .select('id, old_status, new_status, comment, created_at, kampagne:kampagne_id(kampagnenname, eigener_name)')
        .eq('changed_by', this.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (kampagneHistory) {
        allActivities.push(...kampagneHistory.map(h => ({
          ...h,
          type: 'kampagne',
          title: 'Kampagne',
          entity_name: KampagneUtils.getDisplayName(h.kampagne),
          action: h.old_status && h.new_status ? `Status: ${h.old_status} → ${h.new_status}` : 'Status geändert'
        })));
      }

      // Kooperation Status-Änderungen
      const { data: koopHistory } = await window.supabase
        .from('kooperation_history')
        .select('id, old_status, new_status, comment, created_at, kooperation:kooperation_id(name)')
        .eq('changed_by', this.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (koopHistory) {
        allActivities.push(...koopHistory.map(h => ({
          ...h,
          type: 'kooperation',
          title: 'Kooperation',
          entity_name: h.kooperation?.name || 'Unbekannt',
          action: h.old_status && h.new_status ? `Status: ${h.old_status} → ${h.new_status}` : 'Status geändert'
        })));
      }

      this.activities = allActivities
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 15);

    } catch (error) {
      console.error('❌ Fehler beim Laden der Activities:', error);
      this.activities = [];
    }
  }

  // Hilfsfunktion: Vollständigen Namen aus Vorname/Nachname oder Fallback auf name
  getDisplayName() {
    if (this.user?.vorname && this.user?.nachname) {
      return `${this.user.vorname} ${this.user.nachname}`;
    }
    return this.user?.name || 'Unbekannt';
  }

  async render() {
    // Person-Config für die Sidebar
    const personConfig = {
      name: this.getDisplayName(),
      avatarUrl: this.user?.profile_image_url,
      avatarOnly: false
    };

    // Quick Actions (leer - werden nicht angezeigt)
    const quickActions = [];

    // Info-Items für Sidebar
    const sidebarInfo = this.renderInfoItems([
      { icon: 'shield', label: 'Rolle', value: this.user?.rolle || '-', badge: true, badgeType: this.user?.rolle === 'admin' ? 'primary' : 'secondary' },
      { icon: 'tag', label: 'Klasse', value: this.user?.mitarbeiter_klasse_name || 'Nicht zugewiesen' },
      { icon: 'phone', label: 'Firmenhandy', value: '-', rawHtml: this.getFirmenhandyDisplayHtml() },
      { icon: 'check', label: 'Freigeschaltet', value: this.user?.freigeschaltet ? 'Ja' : 'Nein', badge: true, badgeType: this.user?.freigeschaltet ? 'success' : 'warning' },
      { icon: 'clock', label: 'Erstellt', value: this.formatDate(this.user?.created_at) }
    ]);

    // Tab-Navigation (oben über volle Breite)
    const tabNavigation = this.renderTabNavigation();

    // Main Content (nur Tab-Content)
    const mainContent = this.renderMainContent();

    // Layout mit Tabs oben rendern
    const html = this.renderTwoColumnLayout({
      person: personConfig,
      stats: [],
      quickActions,
      sidebarInfo,
      tabNavigation,
      mainContent
    });

    window.setContentSafely(window.content, html);
  }

  getTabsConfig() {
    return [
      { tab: 'unternehmen', label: 'Unternehmen', count: this.zugeordnet.unternehmen.length, isActive: this.activeMainTab === 'unternehmen' },
      { tab: 'auftragsdetails', label: 'Auftragsdetails', count: this.assignments.auftragsdetails.length, isActive: this.activeMainTab === 'auftragsdetails' },
      { tab: 'kampagnen', label: 'Kampagnen', count: this.assignments.kampagnen.length, isActive: this.activeMainTab === 'kampagnen' },
      { tab: 'briefings', label: 'Briefings', count: this.assignments.briefings.length, isActive: this.activeMainTab === 'briefings' },
      { tab: 'kooperationen', label: 'Kooperationen', count: this.assignments.kooperationen.length, isActive: this.activeMainTab === 'koops' },
      { tab: 'cashflow', label: 'Budget', isActive: this.activeMainTab === 'budget' },
      { tab: 'rechte', label: 'Rechte', isActive: this.activeMainTab === 'rechte' }
    ];
  }

  getFirmenhandyDisplayHtml() {
    const nummer = this.user?.telefonnummer_firmenhandy;
    if (!nummer) return '';
    const land = this.user?.telefonnummer_firmenhandy_land;
    const cleanNumber = String(nummer).replace(/[^\d+\s()/.-]/g, '');
    return PhoneDisplay.renderClickable(land?.iso_code, land?.vorwahl, cleanNumber);
  }

  renderTabNavigation() {
    const tabs = this.getTabsConfig();
    const tabsHtml = tabs.map(t => renderTabButton({ ...t, showIcon: true, tab: t.tab === 'kooperationen' ? 'koops' : (t.tab === 'cashflow' ? 'budget' : t.tab) })).join('');
    return `<div class="tabs-header-container" style="--tab-count: ${tabs.length}"><div class="tabs-left">${tabsHtml}</div></div>`;
  }

  renderMainContent() {
    return `
      <div class="tab-content">
        <div class="tab-pane ${this.activeMainTab === 'rechte' ? 'active' : ''}" id="tab-rechte">
          ${this.renderRechteTab()}
        </div>

        <div class="tab-pane ${this.activeMainTab === 'unternehmen' ? 'active' : ''}" id="tab-unternehmen">
          <div class="detail-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <div>
              </div>
              <button class="primary-btn" id="btn-add-unternehmen">+ Unternehmen zuordnen</button>
            </div>
            ${this.renderUnternehmenTable()}
          </div>
        </div>

        <div class="tab-pane ${this.activeMainTab === 'kampagnen' ? 'active' : ''}" id="tab-kampagnen">
          <div class="detail-section">
            ${this.renderKampagnenTable()}
          </div>
        </div>

        <div class="tab-pane ${this.activeMainTab === 'koops' ? 'active' : ''}" id="tab-koops">
          <div class="detail-section">
            ${this.renderKooperationenTable()}
          </div>
        </div>

        <div class="tab-pane ${this.activeMainTab === 'budget' ? 'active' : ''}" id="tab-budget">
          <div class="detail-section">
            ${this.renderBudget()}
          </div>
        </div>

        <div class="tab-pane ${this.activeMainTab === 'briefings' ? 'active' : ''}" id="tab-briefings">
          <div class="detail-section">
            ${this.renderBriefingsTable()}
          </div>
        </div>

        <div class="tab-pane ${this.activeMainTab === 'auftragsdetails' ? 'active' : ''}" id="tab-auftragsdetails">
          <div class="detail-section">
            ${this.renderAuftragsdetailsTable()}
          </div>
        </div>
      </div>
    `;
  }

  renderRechteTab() {
    return `
      <div class="detail-section">
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
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Kontaktdaten</th>
                <th style="width: 320px; text-align: right;">Wert</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div>
                    <strong>Firmenhandy</strong>
                    <div class="form-help" style="margin-top: 4px;">
                      Wird auf der Mitarbeiter-Detailseite angezeigt.
                    </div>
                  </div>
                </td>
                <td>
                  <div style="display:flex; gap:8px; justify-content:flex-end; align-items:center;">
                    <select id="firmenhandy-land" class="form-select" style="max-width: 170px;">
                      <option value="">Land wählen...</option>
                      ${(this.euLaender || []).map(land => `
                        <option value="${land.id}" ${land.id === this.user?.telefonnummer_firmenhandy_land_id ? 'selected' : ''}>
                          ${this.sanitize(`${land.vorwahl || ''} ${land.name_de || ''}`.trim())}
                        </option>
                      `).join('')}
                    </select>
                    <input
                      id="firmenhandy-nummer"
                      type="tel"
                      class="form-input"
                      placeholder="z. B. 15123456789"
                      value="${this.sanitize(this.user?.telefonnummer_firmenhandy || '')}"
                      style="max-width: 180px;"
                    />
                    <button id="btn-save-firmenhandy" class="secondary-btn">Speichern</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="detail-section">
        ${this.user?.freigeschaltet ? 
          `<div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="text-align:left;">Recht</th>
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
    `;
  }

  renderAssignmentsList(items, render) {
    if (!items || items.length === 0) return '<div class="empty-state"><p>Keine Einträge</p></div>';
    return `
      <ul class="simple-list">
        ${items.map(render).join('')}
      </ul>`;
  }

  renderKampagnenTable() {
    const rows = (this.assignments.kampagnen || []).map(k => `
      <tr>
        <td><a href="/kampagne/${k.id}" onclick="event.preventDefault(); window.navigateTo('/kampagne/${k.id}')">${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(k))}</a></td>
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
        <td>${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(r.kampagne))}</td>
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

  renderAuftragsdetailsTable() {
    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';
    
    const rows = (this.assignments.auftragsdetails || []).map(detail => `
      <tr>
        <td>
          <a href="/auftragsdetails/${detail.id}" onclick="event.preventDefault(); window.navigateTo('/auftragsdetails/${detail.id}')">
            ${window.validatorSystem.sanitizeHtml(detail.auftrag?.auftragsname || 'Unbekannter Auftrag')}
          </a>
        </td>
        <td><span class="status-badge status-${(detail.auftrag?.status||'').toLowerCase().replace(/\s+/g,'-')}">${detail.auftrag?.status || '-'}</span></td>
        <td>${window.validatorSystem.sanitizeHtml(detail.kategorie || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(detail.beschreibung || '-')}</td>
        <td>${formatDate(detail.created_at)}</td>
      </tr>
    `).join('');
    
    if (!rows) return '<div class="empty-state"><p>Keine Auftragsdetails vorhanden</p></div>';
    
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Auftrag</th>
              <th>Status</th>
              <th>Kategorie</th>
              <th>Beschreibung</th>
              <th>Erstellt am</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  generatePermissionsTable() {
    const perms = this.user?.zugriffsrechte || {};
    // Reihenfolge entspricht der Navigation
    return [
      ['unternehmen','Unternehmen'],
      ['marke','Marken'],
      ['ansprechpartner','Ansprechpartner'],
      ['auftrag','Aufträge'],
      ['auftragsdetails','Auftragsdetails'],
      ['kampagne','Kampagnen'],
      ['briefing','Briefings'],
      ['strategie','Strategie'],
      ['kooperation','Kooperationen'],
      ['rechnung','Rechnungen'],
      ['tasks','Aufgaben'],
      ['creator','Creator'],
      ['creator-lists','Creator Listen'],
      ['feedback','Feedback']
    ].map(([key,label]) => `
      <tr>
        <td style="text-align:left;">${label}</td>
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
      
      this.user.zugriffsrechte = updated;
      console.log('✅ Rechte automatisch gespeichert');
      
    } catch (err) {
      console.error('❌ Auto-Save Rechte Fehler', err);
      alert('Fehler beim Speichern der Rechte');
    }
  }

  renderUnternehmenTable() {
    if (!this.zugeordnet.unternehmen || this.zugeordnet.unternehmen.length === 0) {
      return '<div class="empty-state"><p>Keine Unternehmen zugeordnet</p></div>';
    }
    
    const roleLabels = {
      'management': 'Management',
      'lead_mitarbeiter': 'Lead Mitarbeiter',
      'mitarbeiter': 'Mitarbeiter'
    };
    
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Firmenname</th>
              <th style="width: 180px;">Rolle</th>
              <th style="width: 120px; text-align: center;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.zugeordnet.unternehmen.map(u => {
              return `
              <tr data-id="${u.id}">
                <td>
                  <a href="/unternehmen/${u.id}" onclick="event.preventDefault(); window.navigateTo('/unternehmen/${u.id}')" class="table-link">
                    ${window.validatorSystem.sanitizeHtml(u.firmenname || u.id)}
                  </a>
                </td>
                <td>
                  <select class="form-select role-select" data-unternehmen-id="${u.id}" style="padding: 6px 10px; font-size: 13px;">
                    <option value="management" ${u.role === 'management' ? 'selected' : ''}>Management</option>
                    <option value="lead_mitarbeiter" ${u.role === 'lead_mitarbeiter' ? 'selected' : ''}>Lead Mitarbeiter</option>
                    <option value="mitarbeiter" ${u.role === 'mitarbeiter' ? 'selected' : ''}>Mitarbeiter</option>
                  </select>
                </td>
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
          <td>${window.validatorSystem.sanitizeHtml(KampagneUtils.getDisplayName(k.kampagne))}</td>
          <td style="text-align:right;">${this.formatCurrency(netto)}</td>
          <td style="text-align:right;">${this.formatCurrency(zusatz)}</td>
          <td style="text-align:right;">${this.formatCurrency(gesamt)}</td>
          <td>${invHtml}</td>
        </tr>
      `;
    }).join('');

    const totals = this.budget.totals || { netto: 0, zusatz: 0, gesamt: 0, invoice_netto: 0, invoice_brutto: 0 };
    const summary = `
      <div class="stats-cards-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="stat-card"><div class="stat-content"><div class="stat-value">${this.formatCurrency(totals.netto)}</div><div class="stat-label">Summe Netto (Koops)</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-value">${this.formatCurrency(totals.zusatz)}</div><div class="stat-label">Summe Zusatzkosten</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-value">${this.formatCurrency(totals.gesamt)}</div><div class="stat-label">Summe Gesamtkosten</div></div></div>
      </div>
      <div class="stats-cards-grid" style="grid-template-columns: repeat(2, 1fr); margin-top:12px;">
        <div class="stat-card"><div class="stat-content"><div class="stat-value">${this.formatCurrency(totals.invoice_netto)}</div><div class="stat-label">Summe Rechnungen Netto</div></div></div>
        <div class="stat-card"><div class="stat-content"><div class="stat-value">${this.formatCurrency(totals.invoice_brutto)}</div><div class="stat-label">Summe Rechnungen Brutto</div></div></div>
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
    // Sidebar Tabs binden (aus Basis-Klasse)
    this.bindSidebarTabs();

    if (this._eventsBound) return;
    this._eventsBound = true;

    // Main Tab-Navigation
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-button');
      if (!btn) return;
      e.preventDefault();
      const tab = btn.dataset.tab;
      if (!tab) return;
      
      this.activeMainTab = tab;
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
        const rechteSection = document.querySelector('#tab-rechte .detail-section:nth-child(3)');
        const statusHelp = document.querySelector('#tab-rechte .form-help');
        
        try {
          const updateData = { freigeschaltet: isFreigeschaltet };
          
          if (isFreigeschaltet) {
            if (self.user.rolle === 'pending') {
              updateData.rolle = 'mitarbeiter';
            }
          } else {
            updateData.rolle = 'pending';
            updateData.zugriffsrechte = null;
          }
          
          const { error } = await window.supabase
            .from('benutzer')
            .update(updateData)
            .eq('id', self.userId);
            
          if (error) {
            console.error('❌ Auto-Save Freigeschaltet fehlgeschlagen', error);
            e.target.checked = !isFreigeschaltet;
            alert('Fehler beim Speichern des Freischaltungs-Status');
            return;
          }
          
          self.user.freigeschaltet = isFreigeschaltet;
          if (updateData.rolle) self.user.rolle = updateData.rolle;
          if (updateData.zugriffsrechte !== undefined) self.user.zugriffsrechte = updateData.zugriffsrechte;
          
          if (window.notificationSystem && self.userId) {
            await window.notificationSystem.pushNotification(self.userId, {
              type: 'system',
              entity: null,
              entityId: null,
              title: isFreigeschaltet ? 'Ihr Account wurde freigeschaltet' : 'Ihr Account wurde gesperrt',
              message: isFreigeschaltet ? 
                'Sie können sich jetzt anmelden und das System nutzen.' : 
                'Ihr Zugang wurde vorübergehend deaktiviert.'
            });
            window.dispatchEvent(new Event('notificationsRefresh'));
          }
          
          console.log(`✅ Benutzer ${isFreigeschaltet ? 'freigeschaltet' : 'gesperrt'}`);
          
          setTimeout(() => {
            self.render().then(() => self.bind());
          }, 100);
          
        } catch (err) {
          console.error('❌ Auto-Save Fehler', err);
          e.target.checked = !isFreigeschaltet;
          alert('Fehler beim Speichern');
          return;
        }
        
        if (rechteSection) {
          if (isFreigeschaltet) {
            rechteSection.style.display = 'block';
            rechteSection.innerHTML = `
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th style="text-align:left;">Recht</th>
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
              <p class="text-muted"><em>Rechte können erst nach der Freischaltung des Benutzers vergeben werden.</em></p>
            `;
          }
        }
        
        if (statusHelp) {
          statusHelp.textContent = isFreigeschaltet ? 
            'Dieser Benutzer ist freigeschaltet und kann sich anmelden. Sie können Rechte vergeben.' : 
            'Dieser Benutzer wartet auf Freischaltung. Schalten Sie ihn frei, bevor Sie Rechte vergeben.';
        }
      }
      
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

      if (e.target && e.target.id === 'btn-save-firmenhandy') {
        e.preventDefault();
        await this.saveFirmenhandyFromForm();
        return;
      }
    });

    // Event-Handler für Unternehmen zuordnen
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-add-unternehmen')) {
        e.preventDefault();
        this.showAddUnternehmenModal();
      }
    });
    
    // Event-Handler für Unternehmen-Rolle ändern
    document.addEventListener('change', async (e) => {
      const roleSelect = e.target.closest('.role-select');
      if (roleSelect) {
        const unternehmenId = roleSelect.dataset.unternehmenId;
        const newRole = roleSelect.value;
        await this.updateUnternehmenRole(unternehmenId, newRole);
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

  showEditForm() {
    console.log('🎯 MITARBEITERDETAIL: Zeige Bearbeitungsformular');
    window.setHeadline('Mitarbeiter bearbeiten');
    
    window.content.innerHTML = `
      <div class="content-section">
        <div class="info-message">
          <h2>Hinweis</h2>
          <p>Die Bearbeitung von Mitarbeitern erfolgt direkt über die Detail-Ansicht mit speziellen Admin-Funktionen.</p>
        </div>
      </div>
    `;
  }

  async showChangeRolleModal() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

    const modal = document.createElement('div');
    modal.className = 'modal-overlay role-modal';
    modal.innerHTML = `
      <div class="modal-content">
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
          <button id="cancel-rolle" class="mdc-btn mdc-btn--cancel">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button id="save-rolle" class="mdc-btn mdc-btn--create" disabled>
            <span class="mdc-btn__label">Speichern</span>
          </button>
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

    const renderSelectedRolle = (rolle) => {
      if (!rolle) {
        selectedContainer.innerHTML = '';
        saveBtn.disabled = true;
        return;
      }

      selectedContainer.innerHTML = `
        <div class="selected-item">
          <span class="item-name">${window.validatorSystem.sanitizeHtml(rolle.name)}</span>
          <button type="button" class="remove-item" aria-label="Auswahl entfernen">&times;</button>
        </div>
      `;
      saveBtn.disabled = false;
    };

    const currentKlasseId = this.user?.mitarbeiter_klasse_id || this.user?.mitarbeiter_klasse?.id;
    if (currentKlasseId) {
      const match = allRollen.find(r => r.id === currentKlasseId);
      if (match) {
        selectedRolle = { id: match.id, name: match.name };
        renderSelectedRolle(selectedRolle);
      }
    }

    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const query = e.target.value.trim().toLowerCase();
        
        if (query.length === 0) {
          displayRollen(allRollen);
        } else if (query.length < 2) {
          dropdown.style.display = 'none';
        } else {
          const filtered = allRollen.filter(r => 
            r.name.toLowerCase().includes(query) || 
            (r.description && r.description.toLowerCase().includes(query))
          );
          displayRollen(filtered);
        }
      }, 150);
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

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item[data-id]');
      if (!item) return;

      selectedRolle = {
        id: item.dataset.id,
        name: item.dataset.name
      };

      renderSelectedRolle(selectedRolle);

      input.value = '';
      dropdown.style.display = 'none';
    });

    selectedContainer.addEventListener('click', (e) => {
      if (e.target.closest('.remove-item') || e.target.closest('.selected-item-remove')) {
        selectedRolle = null;
        renderSelectedRolle(null);
      }
    });

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
        
        await this.load();
        await this.render();
        this.bind();
      } catch (err) {
        console.error('❌ Rolle ändern fehlgeschlagen', err);
        window.NotificationSystem?.show('error', 'Rolle ändern fehlgeschlagen: ' + err.message);
      }
    });

    const closeModal = () => modal.remove();
    modal.querySelector('#close-modal').onclick = closeModal;
    modal.querySelector('#cancel-rolle').onclick = closeModal;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    setTimeout(() => input.focus(), 100);
  }

  async showAddUnternehmenModal() {
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
          
          <div class="form-group" style="margin-top: 16px;">
            <label class="form-label">Rolle</label>
            <select id="role-select" class="form-select">
              <option value="mitarbeiter">Mitarbeiter</option>
              <option value="lead_mitarbeiter">Lead Mitarbeiter</option>
              <option value="management">Management</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button id="cancel-zuordnung" class="mdc-btn mdc-btn--cancel">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button id="save-zuordnung" class="mdc-btn mdc-btn--create" disabled>
            <span class="mdc-btn__label">Zuordnen</span>
          </button>
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

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item[data-id]');
      if (!item) return;

      selectedUnternehmen = {
        id: item.dataset.id,
        name: item.dataset.name
      };

      selectedContainer.innerHTML = `
        <div class="tag">
          <span>${window.validatorSystem.sanitizeHtml(selectedUnternehmen.name)}</span>
          <span class="tag-remove">×</span>
        </div>
      `;

      input.value = '';
      dropdown.style.display = 'none';
      saveBtn.disabled = false;
    });

    selectedContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-remove')) {
        selectedUnternehmen = null;
        selectedContainer.innerHTML = '';
        saveBtn.disabled = true;
      }
    });

    saveBtn.addEventListener('click', async () => {
      if (!selectedUnternehmen) return;

      const selectedRole = modal.querySelector('#role-select').value;
      
      try {
        const { error } = await window.supabase
          .from('mitarbeiter_unternehmen')
          .insert({ 
            mitarbeiter_id: this.userId, 
            unternehmen_id: selectedUnternehmen.id,
            role: selectedRole
          });

        if (error) {
          if (error.code === '23505') {
            window.NotificationSystem?.show('warning', 'Unternehmen ist bereits zugeordnet');
            modal.remove();
            return;
          }
          throw error;
        }

        window.NotificationSystem?.show('success', 'Unternehmen erfolgreich zugeordnet');
        modal.remove();
        
        await this.load();
        await this.render();
        this.bind();
      } catch (err) {
        console.error('❌ Zuordnung fehlgeschlagen', err);
        window.NotificationSystem?.show('error', 'Zuordnung fehlgeschlagen: ' + err.message);
      }
    });

    const closeModal = () => modal.remove();
    modal.querySelector('#close-modal').onclick = closeModal;
    modal.querySelector('#cancel-zuordnung').onclick = closeModal;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    setTimeout(() => input.focus(), 100);
  }

  async updateUnternehmenRole(unternehmenId, newRole) {
    try {
      const { error } = await window.supabase
        .from('mitarbeiter_unternehmen')
        .update({ role: newRole })
        .eq('mitarbeiter_id', this.userId)
        .eq('unternehmen_id', unternehmenId);

      if (error) throw error;

      const roleLabels = {
        'management': 'Management',
        'lead_mitarbeiter': 'Lead Mitarbeiter',
        'mitarbeiter': 'Mitarbeiter'
      };
      
      window.NotificationSystem?.show('success', `Rolle auf "${roleLabels[newRole]}" geändert`);
      
      // Lokale Daten aktualisieren
      const u = this.zugeordnet.unternehmen.find(u => u.id === unternehmenId);
      if (u) u.role = newRole;
      
    } catch (err) {
      console.error('❌ Rolle ändern fehlgeschlagen', err);
      window.NotificationSystem?.show('error', 'Rolle ändern fehlgeschlagen: ' + err.message);
    }
  }

  async removeUnternehmen(unternehmenId, unternehmenName) {
    try {
      const { error } = await window.supabase
        .from('mitarbeiter_unternehmen')
        .delete()
        .eq('mitarbeiter_id', this.userId)
        .eq('unternehmen_id', unternehmenId);

      if (error) throw error;

      window.NotificationSystem?.show('success', `Unternehmen "${unternehmenName}" erfolgreich entfernt`);
      
      await this.load();
      await this.render();
      this.bind();
    } catch (err) {
      console.error('❌ Entfernen fehlgeschlagen', err);
      window.NotificationSystem?.show('error', 'Entfernen fehlgeschlagen: ' + err.message);
    }
  }

  async saveFirmenhandyFromForm() {
    try {
      const landId = document.getElementById('firmenhandy-land')?.value || null;
      const nummer = document.getElementById('firmenhandy-nummer')?.value?.trim() || null;

      if (nummer && !landId) {
        window.NotificationSystem?.show('warning', 'Bitte Land auswählen.');
        return;
      }

      const { error } = await window.supabase
        .from('benutzer')
        .update({
          telefonnummer_firmenhandy: nummer,
          telefonnummer_firmenhandy_land_id: landId
        })
        .eq('id', this.userId);

      if (error) throw error;

      this.user.telefonnummer_firmenhandy = nummer;
      this.user.telefonnummer_firmenhandy_land_id = landId;
      this.user.telefonnummer_firmenhandy_land = (this.euLaender || []).find(land => land.id === landId) || null;

      window.NotificationSystem?.show('success', 'Firmenhandy gespeichert.');
      await this.render();
      this.bind();
    } catch (error) {
      console.error('❌ Firmenhandy speichern fehlgeschlagen', error);
      window.NotificationSystem?.show('error', `Speichern fehlgeschlagen: ${error.message}`);
    }
  }

  destroy() {
    this._eventsBound = false;
    window.setContentSafely('');
  }
}

export const mitarbeiterDetail = new MitarbeiterDetail();
