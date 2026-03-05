// ProduktDetail.js (ES6-Modul)
// Produkt-Detailseite mit zwei-Spalten-Layout

import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { getTabIcon } from '../../core/TabUtils.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';

export class ProduktDetail extends PersonDetailBase {
  constructor() {
    super();
    this.produktId = null;
    this.produkt = null;
    this.pflichtElemente = [];
    this.noGos = [];
    this.activeMainTab = 'informationen';
  }

  // Initialisiere Produkt-Detailseite
  async init(produktId) {
    console.log('🎯 PRODUKTDETAIL: Initialisiere Produkt-Detailseite für ID:', produktId);
    
    try {
      this.produktId = produktId;
      await this.loadCriticalData();
      
      // Breadcrumb aktualisieren mit Edit-Button
      if (window.breadcrumbSystem && this.produkt) {
        const canEdit = window.currentUser?.permissions?.produkt?.can_edit !== false;
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Produkte', url: '/produkt', clickable: true },
          { label: this.produkt.name || 'Details', url: `/produkt/${this.produktId}`, clickable: false }
        ], {
          id: 'btn-edit-produkt',
          canEdit: canEdit
        });
      }
      
      this.render();
      this.bindEvents();
      console.log('✅ PRODUKTDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ PRODUKTDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'ProduktDetail.init');
    }
  }

  // Lade kritische Daten parallel
  async loadCriticalData() {
    console.log('🔄 PRODUKTDETAIL: Lade kritische Daten parallel...');
    const startTime = performance.now();
    
    try {
      // Alle kritischen Daten PARALLEL laden
      const [
        produktResult,
        pflichtElementeResult,
        noGosResult
      ] = await parallelLoad([
        // 1. Produkt-Basisdaten mit Relations
        () => window.supabase
          .from('produkt')
          .select(`
            *,
            marke:marke_id(id, markenname, logo_url),
            unternehmen:unternehmen_id(id, firmenname, logo_url)
          `)
          .eq('id', this.produktId)
          .single(),
        
        // 2. Pflicht-Elemente aus Junction Table
        () => window.supabase
          .from('produkt_pflicht_elemente')
          .select(`
            pflicht_element_id,
            pflicht_element:pflicht_element_id(id, name)
          `)
          .eq('produkt_id', this.produktId),
        
        // 3. No-Gos aus Junction Table
        () => window.supabase
          .from('produkt_no_gos')
          .select(`
            no_go_id,
            no_go:no_go_id(id, name)
          `)
          .eq('produkt_id', this.produktId)
      ]);
      
      // Daten verarbeiten
      if (produktResult.error) throw produktResult.error;
      this.produkt = produktResult.data;
      
      // Pflicht-Elemente verarbeiten
      if (!pflichtElementeResult.error && pflichtElementeResult.data) {
        this.pflichtElemente = pflichtElementeResult.data.map(item => item.pflicht_element).filter(Boolean);
      } else {
        this.pflichtElemente = [];
      }
      
      // No-Gos verarbeiten
      if (!noGosResult.error && noGosResult.data) {
        this.noGos = noGosResult.data.map(item => item.no_go).filter(Boolean);
      } else {
        this.noGos = [];
      }
      
      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ PRODUKTDETAIL: Kritische Daten geladen in ${loadTime}ms`);
      
    } catch (error) {
      console.error('❌ PRODUKTDETAIL: Fehler beim Laden der kritischen Daten:', error);
      throw error;
    }
  }

  // Rendere Produkt-Detailseite
  render() {
    window.setHeadline(`${this.produkt?.name || 'Produkt'} - Details`);

    // Person-Config für die Sidebar
    const personConfig = {
      name: this.produkt?.name || 'Unbekannt',
      email: '',
      subtitle: this.produkt?.marke?.markenname || 'Produkt',
      avatarUrl: this.produkt?.marke?.logo_url,
      avatarOnly: false
    };

    // Quick Actions
    const quickActions = [];

    const markeLink = this.produkt?.marke?.id
      ? `<a href="/marke/${this.produkt.marke.id}" onclick="event.preventDefault(); window.navigateTo('/marke/${this.produkt.marke.id}')">${this.sanitize(this.produkt.marke.markenname)}</a>`
      : null;
    const unternehmenLink = this.produkt?.unternehmen?.id
      ? `<a href="/unternehmen/${this.produkt.unternehmen.id}" onclick="event.preventDefault(); window.navigateTo('/unternehmen/${this.produkt.unternehmen.id}')">${this.sanitize(this.produkt.unternehmen.firmenname)}</a>`
      : null;
    const urlLink = this.produkt?.url
      ? `<a href="${this.produkt.url}" target="_blank" rel="noopener">${this.sanitize(this.produkt.url)}</a>`
      : null;

    // Info-Items für Sidebar
    const sidebarInfo = this.renderInfoItems([
      { icon: 'tag', label: 'Marke', rawHtml: markeLink || '-' },
      { icon: 'building', label: 'Unternehmen', rawHtml: unternehmenLink || '-' },
      { icon: 'link', label: 'Produkt-URL', rawHtml: urlLink || '-' },
      { icon: 'info', label: 'Kernbotschaft', value: this.produkt?.kernbotschaft || '-' },
      { icon: 'info', label: 'Hauptproblem', value: this.produkt?.hauptproblem || '-' },
      { icon: 'info', label: 'Kernnutzen', value: this.produkt?.kernnutzen || '-' },
      { icon: 'info', label: 'USP 1', value: this.produkt?.usp_1 || '-' },
      { icon: 'info', label: 'USP 2', value: this.produkt?.usp_2 || '-' },
      { icon: 'info', label: 'USP 3', value: this.produkt?.usp_3 || '-' },
      { icon: 'tag', label: 'Pflicht-Elemente', rawHtml: this.renderTags(this.pflichtElemente, 'pflicht') },
      { icon: 'tag', label: 'No-Gos / Tabus', rawHtml: this.renderTags(this.noGos, 'nogo') },
      { icon: 'info', label: 'Kauf-Trigger', value: this.produkt?.kauf_conversion_trigger || '-' },
      { icon: 'user', label: 'Zielnutzer', value: this.produkt?.zielnutzer_anwendungskontext || '-' },
      { icon: 'clock', label: 'Erstellt', value: this.formatDate(this.produkt?.created_at) },
      { icon: 'clock', label: 'Aktualisiert', value: this.formatDate(this.produkt?.updated_at) }
    ]);

    // Layout ohne Tabs (alle Infos in der Sidebar)
    const html = this.renderTwoColumnLayout({
      person: personConfig,
      stats: [],
      quickActions,
      sidebarInfo,
      tabNavigation: '',
      mainContent: ''
    });

    window.setContentSafely(window.content, html);
  }

  getTabsConfig() {
    return [
      { tab: 'informationen', label: 'Informationen', isActive: this.activeMainTab === 'informationen' }
    ];
  }

  renderTabNavigation() {
    const tabs = this.getTabsConfig();
    return tabs.map(t => `
      <button class="tab-button ${t.isActive ? 'active' : ''}" data-tab="${t.tab}">
        <span class="tab-icon">${getTabIcon(t.tab)}</span>
        ${t.label}
      </button>
    `).join('');
  }

  renderMainContent() {
    return `
      <div class="tab-content">
        <div class="tab-pane ${this.activeMainTab === 'informationen' ? 'active' : ''}" id="tab-informationen">
          ${this.renderInformationen()}
        </div>
      </div>
    `;
  }

  // Rendere Informationen
  renderInformationen() {
    return `
      <div class="detail-section">
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Information</th>
                <th style="text-align: right;">Wert</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Produkt-Name</strong></td>
                <td style="text-align: right;">${this.sanitize(this.produkt?.name) || '-'}</td>
              </tr>
              <tr>
                <td><strong>Marke</strong></td>
                <td style="text-align: right;">
                  ${this.produkt?.marke?.id 
                    ? `<a href="/marke/${this.produkt.marke.id}" onclick="event.preventDefault(); window.navigateTo('/marke/${this.produkt.marke.id}')">${this.sanitize(this.produkt.marke.markenname)}</a>`
                    : '-'}
                </td>
              </tr>
              <tr>
                <td><strong>Unternehmen</strong></td>
                <td style="text-align: right;">
                  ${this.produkt?.unternehmen?.id 
                    ? `<a href="/unternehmen/${this.produkt.unternehmen.id}" onclick="event.preventDefault(); window.navigateTo('/unternehmen/${this.produkt.unternehmen.id}')">${this.sanitize(this.produkt.unternehmen.firmenname)}</a>`
                    : '-'}
                </td>
              </tr>
              <tr>
                <td><strong>Produkt-URL</strong></td>
                <td style="text-align: right;">
                  ${this.produkt?.url 
                    ? `<a href="${this.produkt.url}" target="_blank" rel="noopener">${this.sanitize(this.produkt.url)}</a>` 
                    : '-'}
                </td>
              </tr>
              <tr>
                <td colspan="2" class="section-divider"></td>
              </tr>
              <tr>
                <td><strong>Kernbotschaft</strong></td>
                <td style="text-align: right;">${this.sanitize(this.produkt?.kernbotschaft) || '-'}</td>
              </tr>
              <tr>
                <td><strong>Hauptproblem</strong></td>
                <td style="text-align: right;">${this.sanitize(this.produkt?.hauptproblem) || '-'}</td>
              </tr>
              <tr>
                <td><strong>Kernnutzen</strong></td>
                <td style="text-align: right;">${this.sanitize(this.produkt?.kernnutzen) || '-'}</td>
              </tr>
              <tr>
                <td colspan="2" class="section-divider"></td>
              </tr>
              <tr>
                <td><strong>USP 1</strong></td>
                <td style="text-align: right;">${this.sanitize(this.produkt?.usp_1) || '-'}</td>
              </tr>
              <tr>
                <td><strong>USP 2</strong></td>
                <td style="text-align: right;">${this.sanitize(this.produkt?.usp_2) || '-'}</td>
              </tr>
              <tr>
                <td><strong>USP 3</strong></td>
                <td style="text-align: right;">${this.sanitize(this.produkt?.usp_3) || '-'}</td>
              </tr>
              <tr>
                <td colspan="2" class="section-divider"></td>
              </tr>
              <tr>
                <td><strong>Pflicht-Elemente</strong></td>
                <td style="text-align: right;">${this.renderTags(this.pflichtElemente, 'pflicht')}</td>
              </tr>
              <tr>
                <td><strong>No-Gos / Tabus</strong></td>
                <td style="text-align: right;">${this.renderTags(this.noGos, 'nogo')}</td>
              </tr>
              <tr>
                <td colspan="2" class="section-divider"></td>
              </tr>
              <tr>
                <td><strong>Kauf- & Conversion-Trigger</strong></td>
                <td style="text-align: right;">${this.sanitize(this.produkt?.kauf_conversion_trigger) || '-'}</td>
              </tr>
              <tr>
                <td><strong>Zielnutzer / Anwendungskontext</strong></td>
                <td style="text-align: right;">${this.sanitize(this.produkt?.zielnutzer_anwendungskontext) || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Rendere Tags
  renderTags(items, type) {
    if (!items || items.length === 0) {
      return '-';
    }
    return items
      .filter(item => item && item.name)
      .map(item => `<span class="tag tag--${type}">${this.sanitize(item.name)}</span>`)
      .join(' ');
  }

  // Binde Events
  bindEvents() {
    // Sidebar Tabs binden (aus Basis-Klasse)
    this.bindSidebarTabs();

    // Main Tab-Navigation
    document.addEventListener('click', async (e) => {
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
      if (pane) {
        pane.classList.add('active');
      }
    });

    // Produkt bearbeiten Button
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-edit-produkt')) {
        this.showEditForm();
      }
    });

    // Entity Updates
    document.addEventListener('entityUpdated', (e) => {
      if (e.detail?.entity === 'produkt' && e.detail?.id === this.produktId) {
        console.log('🔄 PRODUKTDETAIL: Entity updated - lade Daten neu');
        if (e.detail.action === 'updated') {
          this.loadCriticalData().then(() => this.render());
        }
      }
    });
  }

  // Bearbeitungsformular anzeigen
  async showEditForm() {
    console.log('🎯 PRODUKTDETAIL: Zeige Bearbeitungsformular');
    window.setHeadline('Produkt bearbeiten');
    
    // Daten für FormSystem vorbereiten
    const formData = { ...this.produkt };
    
    // Edit-Mode Flags immer setzen
    formData._isEditMode = true;
    formData._entityId = this.produktId;
    
    // Pflicht-Elemente IDs für Edit-Modus
    if (this.pflichtElemente && this.pflichtElemente.length > 0) {
      formData.pflicht_elemente_ids = this.pflichtElemente.map(p => p.id);
    }
    
    // No-Gos IDs für Edit-Modus
    if (this.noGos && this.noGos.length > 0) {
      formData.no_go_ids = this.noGos.map(n => n.id);
    }
    
    console.log('📋 PRODUKTDETAIL: FormData für Rendering:', formData);
    
    const formHtml = window.formSystem.renderFormOnly('produkt', formData);
    
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events mit vorbereiteten Daten binden
    window.formSystem.bindFormEvents('produkt', formData);
    
    // Form-Datasets für DynamicDataLoader setzen
    const form = document.getElementById('produkt-form');
    if (form) {
      form.dataset.isEditMode = 'true';
      form.dataset.entityType = 'produkt';
      form.dataset.entityId = this.produktId;
      
      // Bestehende Werte für Auto-Suggestion verfügbar machen
      if (formData.unternehmen_id) {
        form.dataset.existingUnternehmenId = formData.unternehmen_id;
      }
      if (formData.marke_id) {
        form.dataset.existingMarkeId = formData.marke_id;
      }
      
      // Custom Submit Handler
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
    }
  }

  // Handle Edit Form Submit
  async handleEditFormSubmit() {
    try {
      console.log('🎯 PRODUKTDETAIL: Verarbeite Formular-Submit');
      
      const form = document.getElementById('produkt-form');
      const formData = new FormData(form);
      const allFormData = {};

      // Standard FormData-Einträge sammeln
      for (const [key, value] of formData.entries()) {
        allFormData[key] = value;
      }

      // Tag-basierte Multi-Selects explizit sammeln
      const pflichtElementeSelect = form.querySelector('select[name="pflicht_elemente_ids[]"]');
      if (pflichtElementeSelect) {
        const selectedValues = Array.from(pflichtElementeSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
        if (selectedValues.length > 0) {
          allFormData['pflicht_elemente_ids[]'] = selectedValues;
        }
      }
      
      const noGoSelect = form.querySelector('select[name="no_go_ids[]"]');
      if (noGoSelect) {
        const selectedValues = Array.from(noGoSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
        if (selectedValues.length > 0) {
          allFormData['no_go_ids[]'] = selectedValues;
        }
      }

      console.log('📤 PRODUKTDETAIL: Submit-Daten für Update:', allFormData);

      // Validierung
      const validation = window.validatorSystem.validateForm(allFormData, {
        name: { type: 'text', minLength: 2, required: true },
        kernbotschaft: { type: 'text', minLength: 2, required: true },
        hauptproblem: { type: 'text', minLength: 2, required: true }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      // Produkt aktualisieren
      const result = await window.dataService.updateEntity('produkt', this.produktId, allFormData);

      if (result.success) {
        // Many-to-Many Relationen aktualisieren
        await this.updateManyToManyRelations(this.produktId, allFormData);

        window.toastSystem.success('Produkt erfolgreich aktualisiert!');
        
        // Zur Produktübersicht navigieren
        setTimeout(() => {
          window.navigateTo('/produkt');
        }, 1500);
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }

    } catch (error) {
      console.error('❌ Formular-Submit Fehler:', error);
      this.showErrorMessage(error.message);
    }
  }
  
  // Aktualisiere Many-to-Many Relationen
  async updateManyToManyRelations(produktId, data) {
    try {
      if (!produktId || !window.supabase) return;
      
      console.log('🔄 PRODUKTDETAIL: Aktualisiere Many-to-Many Relationen für Produkt:', produktId);
      
      // Pflicht-Elemente: Erst löschen, dann neu einfügen
      await window.supabase
        .from('produkt_pflicht_elemente')
        .delete()
        .eq('produkt_id', produktId);
      
      const pflichtElementeIds = data['pflicht_elemente_ids[]'] || data.pflicht_elemente_ids || [];
      if (Array.isArray(pflichtElementeIds) && pflichtElementeIds.length > 0) {
        const pflichtElementeData = pflichtElementeIds.map(id => ({
          produkt_id: produktId,
          pflicht_element_id: id
        }));
        
        await window.supabase
          .from('produkt_pflicht_elemente')
          .insert(pflichtElementeData);
        
        console.log(`✅ ${pflichtElementeData.length} Pflicht-Elemente aktualisiert`);
      }
      
      // No-Gos: Erst löschen, dann neu einfügen
      await window.supabase
        .from('produkt_no_gos')
        .delete()
        .eq('produkt_id', produktId);
      
      const noGoIds = data['no_go_ids[]'] || data.no_go_ids || [];
      if (Array.isArray(noGoIds) && noGoIds.length > 0) {
        const noGoData = noGoIds.map(id => ({
          produkt_id: produktId,
          no_go_id: id
        }));
        
        await window.supabase
          .from('produkt_no_gos')
          .insert(noGoData);
        
        console.log(`✅ ${noGoData.length} No-Gos aktualisiert`);
      }
      
      console.log('✅ PRODUKTDETAIL: Many-to-Many Relationen aktualisiert');
    } catch (error) {
      console.error('❌ PRODUKTDETAIL: Fehler beim Aktualisieren der Many-to-Many Relationen:', error);
    }
  }

  // Show Validation Errors
  showValidationErrors(errors) {
    console.log('❌ Validierungsfehler:', errors);
    
    document.querySelectorAll('.validation-error').forEach(el => el.remove());
    
    Object.keys(errors).forEach(fieldName => {
      const field = document.querySelector(`[name="${fieldName}"]`);
      if (field) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        errorDiv.textContent = errors[fieldName];
        errorDiv.style.color = '#dc3545';
        errorDiv.style.fontSize = '0.875rem';
        errorDiv.style.marginTop = '0.25rem';
        
        field.parentNode.appendChild(errorDiv);
        field.style.borderColor = '#dc3545';
      }
    });
  }

  // Show Error Message
  showErrorMessage(message) {
    if (window.toastSystem) {
      window.toastSystem.error(message);
    } else {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'alert alert-danger';
      errorDiv.textContent = message;
      errorDiv.style.cssText = `
        background: #f8d7da;
        color: #721c24;
        padding: 1rem;
        border-radius: 4px;
        margin-bottom: 1rem;
        border: 1px solid #f5c6cb;
      `;
      
      const formPage = document.querySelector('.form-page');
      if (formPage) {
        formPage.insertBefore(errorDiv, formPage.firstChild);
      }
    }
  }

  // Cleanup
  destroy() {
    console.log('🗑️ PRODUKTDETAIL: Destroy aufgerufen');
    window.setContentSafely('');
  }
}

export const produktDetail = new ProduktDetail();
