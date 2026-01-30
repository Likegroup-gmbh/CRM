// BriefingDetail.js (ES6-Modul)
// Detailansicht für Briefings mit Tabs (Informationen, Notizen, Bewertungen)
import { parallelLoad } from '../../core/loaders/ParallelQueryHelper.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { getTabIcon } from '../../core/TabUtils.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export class BriefingDetail {
  constructor() {
    this.briefingId = null;
    this.briefing = null;
    this.notizen = [];
    this.ratings = [];
  }

  async init(briefingId) {
    this.briefingId = briefingId;

    if (window.moduleRegistry?.currentModule !== this) {
      return;
    }

    try {
      await this.loadCriticalData();
      
      // Breadcrumb aktualisieren mit Edit-Button
      if (window.breadcrumbSystem && this.briefing) {
        const canEdit = window.currentUser?.permissions?.briefing?.can_edit || false;
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Briefing', url: '/briefing', clickable: true },
          { label: this.briefing.product_service_offer || 'Details', url: `/briefing/${this.briefingId}`, clickable: false }
        ], {
          id: 'btn-edit-briefing',
          canEdit: canEdit
        });
      }
      
      await this.render();
      this.bindEvents();
      this.setupCacheInvalidation();
    } catch (error) {
      console.error('❌ BRIEFINGDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler?.handle?.(error, 'BriefingDetail.init');
    }
  }

  async loadCriticalData() {
    if (!this.briefingId || this.briefingId === 'new') return;

    console.log('🔄 BRIEFINGDETAIL: Lade kritische Daten parallel...');
    const startTime = performance.now();

    try {
      // Alle kritischen Daten PARALLEL laden
      const [
        briefingResult,
        notizenResult,
        ratingsResult,
        documentsResult
      ] = await parallelLoad([
        // 1. Briefing mit Relations
        () => window.supabase
          .from('briefings')
          .select(`
            *,
            unternehmen:unternehmen_id(id, firmenname, webseite),
            marke:marke_id(id, markenname, webseite),
            kampagne:kampagne_id(id, kampagnenname, eigener_name),
            assignee:assignee_id(id, name)
          `)
          .eq('id', this.briefingId)
          .single(),
        
        // 2. Notizen
        () => window.notizenSystem 
          ? window.notizenSystem.loadNotizen('briefing', this.briefingId)
          : Promise.resolve([]),
        
        // 3. Ratings
        () => window.bewertungsSystem
          ? window.bewertungsSystem.loadBewertungen('briefing', this.briefingId)
          : Promise.resolve([]),
        
        // 4. Dokumente
        () => window.supabase
          .from('briefing_documents')
          .select('*')
          .eq('briefing_id', this.briefingId)
          .order('created_at', { ascending: false })
          .then(r => r.data || [])
          .catch(() => [])
      ]);

      if (briefingResult.error) throw briefingResult.error;

      this.briefing = briefingResult.data;
      this.notizen = notizenResult || [];
      this.ratings = ratingsResult || [];
      this.briefing.documents = documentsResult;

      // Kooperation separat nachladen falls vorhanden
      if (this.briefing?.kooperation_id) {
        try {
          const { data: koop } = await window.supabase
            .from('kooperationen')
            .select(`
              id, name, status,
              kampagne:kampagne_id ( id, kampagnenname, eigener_name )
            `)
            .eq('id', this.briefing.kooperation_id)
            .single();
          if (koop) this.briefing.kooperation = koop;
        } catch (e) {
          console.warn('⚠️ BRIEFINGDETAIL: Kooperation konnte nicht geladen werden', e);
          this.briefing.kooperation = null;
        }
      }

      const loadTime = (performance.now() - startTime).toFixed(0);
      console.log(`✅ BRIEFINGDETAIL: Kritische Daten geladen in ${loadTime}ms`);
    } catch (error) {
      console.error('❌ BRIEFINGDETAIL: Fehler beim Laden:', error);
      throw error;
    }
  }
  
  setupCacheInvalidation() {
    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'briefing' && e.detail.id === this.briefingId) {
        console.log('🔄 BRIEFINGDETAIL: Entity updated - invalidiere Cache');
        tabDataCache.invalidate('briefing', this.briefingId);
        
        if (e.detail.action === 'updated') {
          this.loadCriticalData().then(() => this.render());
        }
      }
    });
  }

  async render() {
    if (!this.briefing) {
      this.showNotFound();
      return;
    }

    const title = this.briefing.product_service_offer || 'Briefing';
    window.setHeadline(`Briefing: ${window.validatorSystem?.sanitizeHtml?.(title) || title}`);

    const isAdmin = window.currentUser?.rolle === 'admin';
    const canDelete = isAdmin; // Nur Admins dürfen löschen

    const formatDate = (d) => (d ? new Date(d).toLocaleDateString('de-DE') : '-');
    const escape = (s) => window.validatorSystem?.sanitizeHtml?.(s || '-') || (s || '-');

    const html = `
      ${canDelete ? `
      <div class="page-header">
        <div class="page-header-right">
          <button id="btn-delete-briefing" class="danger-btn">Löschen</button>
        </div>
      </div>
      ` : ''}

      <div class="content-section">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="info">
            <span class="tab-icon">${getTabIcon('info')}</span>
            Informationen
          </button>
          <button class="tab-button" data-tab="dokumente">
            <span class="tab-icon">${getTabIcon('dateien')}</span>
            Dokumente<span class="tab-count">${this.briefing.documents?.length || 0}</span>
          </button>
        </div>

        <div class="tab-content">
          <div class="tab-pane active" id="tab-info">
            <div class="detail-section">
              <div class="detail-grid">
                <div class="detail-card">
                  <h3>Allgemein</h3>
                  <div class="detail-grid-2">
                    <div class="detail-item">
                      <label>Produkt/Angebot:</label>
                      <span>${escape(this.briefing.product_service_offer)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Status:</label>
                      <span class="status-badge status-${(this.briefing.status || 'unknown').toLowerCase()}">${escape(this.briefing.status)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Deadline:</label>
                      <span>${formatDate(this.briefing.deadline)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Zugewiesen:</label>
                      <span>${escape(this.briefing.assignee?.name)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Produktseite:</label>
                      <span>${this.briefing.produktseite_url ? `<a href="${this.briefing.produktseite_url}" target="_blank">Link</a>` : '-'}</span>
                    </div>
                    <div class="detail-item">
                      <label>Erstellt:</label>
                      <span>${formatDate(this.briefing.created_at)}</span>
                    </div>
                    <div class="detail-item">
                      <label>Aktualisiert:</label>
                      <span>${formatDate(this.briefing.updated_at)}</span>
                    </div>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Unternehmen & Marke</h3>
                  <div class="detail-item">
                    <label>Unternehmen:</label>
                    <span>${escape(this.briefing.unternehmen?.firmenname)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Marke:</label>
                    <span>${escape(this.briefing.marke?.markenname)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Kampagne:</label>
                    <span>${this.briefing.kampagne?.id ? `<a href="/kampagne/${this.briefing.kampagne.id}" onclick="event.preventDefault(); window.navigateTo('/kampagne/${this.briefing.kampagne.id}')">${escape(KampagneUtils.getDisplayName(this.briefing.kampagne))}</a>` : '-'}</span>
                  </div>
                  <div class="detail-item">
                    <label>Kooperation:</label>
                    <span>${this.briefing.kooperation?.id ? `<a href="/kooperation/${this.briefing.kooperation.id}" onclick="event.preventDefault(); window.navigateTo('/kooperation/${this.briefing.kooperation.id}')">${escape(this.briefing.kooperation.name || 'Kooperation')}</a>` : '-'}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Briefing-Inhalte</h3>
                  <div class="detail-item">
                    <label>Creator Aufgabe:</label>
                    <span>${escape(this.briefing.creator_aufgabe)}</span>
                  </div>
                  <div class="detail-item">
                    <label>USPs:</label>
                    <span>${escape(this.briefing.usp)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Zielgruppe:</label>
                    <span>${escape(this.briefing.zielgruppe)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Zieldetails:</label>
                    <span>${escape(this.briefing.zieldetails)}</span>
                  </div>
                </div>

                <div class="detail-card">
                  <h3>Guidelines</h3>
                  <div class="detail-item">
                    <label>Must Haves:</label>
                    <span>${escape(this.briefing.must_haves)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Rechtlicher Hinweis:</label>
                    <span>${escape(this.briefing.rechtlicher_hinweis)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="tab-pane" id="tab-dokumente">
            <div class="detail-section">
              ${this.renderDocumentsTable()}
            </div>
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  renderNotizen() {
    if (window.notizenSystem) {
      return window.notizenSystem.renderNotizenContainer(this.notizen, 'briefing', this.briefingId);
    }
    if (!this.notizen || this.notizen.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Notizen vorhanden</p>
        </div>
      `;
    }
    const inner = this.notizen.map(n => `
      <div class="notiz-card">
        <div class="notiz-header">
          <span>${n.user_name || 'Unbekannt'}</span>
          <span>${new Date(n.created_at).toLocaleDateString('de-DE')}</span>
        </div>
        <div class="notiz-content">
          <p>${window.validatorSystem?.sanitizeHtml?.(n.text) || n.text}</p>
        </div>
      </div>
    `).join('');
    return `<div class="notizen-container">${inner}</div>`;
  }

  renderRatings() {
    if (window.bewertungsSystem) {
      return window.bewertungsSystem.renderBewertungenContainer(this.ratings, 'briefing', this.briefingId);
    }
    if (!this.ratings || this.ratings.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Bewertungen vorhanden</p>
        </div>
      `;
    }
    const inner = this.ratings.map(r => `
      <div class="rating-card">
        <div class="rating-header">
          <span>${r.user_name || 'Unbekannt'}</span>
          <span>${new Date(r.created_at).toLocaleDateString('de-DE')}</span>
        </div>
        <div class="rating-stars">
          ${Array.from({ length: 5 }, (_, i) => `
            <span class="star ${i < r.rating ? 'filled' : ''}">★</span>
          `).join('')}
        </div>
      </div>
    `).join('');
    return `<div class="ratings-container">${inner}</div>`;
  }

  bindEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-button')) {
        e.preventDefault();
        this.switchTab(e.target.dataset.tab);
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-edit-briefing')) {
        e.preventDefault();
        window.navigateTo(`/briefing/${this.briefingId}/edit`);
      }
    });

    // Dokument öffnen
    document.addEventListener('click', async (e) => {
      const openLink = e.target.closest('.action-doc-open');
      if (openLink) {
        e.preventDefault();
        const docPath = openLink.dataset.docPath;
        
        if (!docPath) {
          alert('Fehler: Dokumentpfad nicht gefunden');
          return;
        }
        
        try {
          console.log('📄 Öffne Dokument:', docPath);
          // Permanente Public URL generieren
          const { data: urlData } = window.supabase.storage
            .from('documents')
            .getPublicUrl(docPath);
          
          if (urlData?.publicUrl) {
            console.log('✅ Public URL generiert, öffne neues Fenster');
            window.open(urlData.publicUrl, '_blank', 'noopener,noreferrer');
          } else {
            throw new Error('Public URL konnte nicht generiert werden');
          }
        } catch (error) {
          console.error('❌ Fehler beim Öffnen:', error);
          alert(`Fehler beim Öffnen des Dokuments: ${error.message}`);
        }
      }
    });

    // Dokument löschen
    document.addEventListener('click', async (e) => {
      if (e.target.closest('.action-doc-delete')) {
        e.preventDefault();
        const btn = e.target.closest('.action-doc-delete');
        const docId = btn.dataset.docId;
        const docName = btn.dataset.docName;
        const docPath = btn.dataset.docPath;
        
        if (!confirm(`Dokument "${docName}" wirklich löschen?`)) return;
        
        try {
          // Datei aus Storage löschen
          const { error: storageError } = await window.supabase.storage
            .from('documents')
            .remove([docPath]);
          
          if (storageError) throw storageError;
          
          // Metadaten aus DB löschen
          const { error: dbError } = await window.supabase
            .from('briefing_documents')
            .delete()
            .eq('id', docId);
          
          if (dbError) throw dbError;
          
          alert('Dokument erfolgreich gelöscht');
          
          // Dokumente neu laden
          await this.loadBriefingData();
          await this.render();
          this.bindEvents();
          
          // Zum Dokumente-Tab wechseln
          this.switchTab('dokumente');
        } catch (error) {
          console.error('❌ Fehler beim Löschen:', error);
          alert(`Fehler beim Löschen: ${error.message}`);
        }
      }
    });

    document.addEventListener('click', async (e) => {
      if (e.target.id === 'btn-delete-briefing') {
        e.preventDefault();
        const confirmed = confirm('Dieses Briefing wirklich löschen?');
        if (!confirmed) return;
        try {
          const { error } = await window.supabase
            .from('briefings')
            .delete()
            .eq('id', this.briefingId);
          if (error) throw error;
          window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'briefing', action: 'deleted', id: this.briefingId } }));
          window.navigateTo('/briefing');
        } catch (err) {
          console.error('❌ Fehler beim Löschen des Briefings:', err);
          alert('Löschen fehlgeschlagen.');
        }
      }
    });

    window.addEventListener('notizenUpdated', async (e) => {
      if (e.detail.entityType === 'briefing' && e.detail.entityId === this.briefingId) {
        this.notizen = await window.notizenSystem.loadNotizen('briefing', this.briefingId);
        const pane = document.querySelector('#tab-notizen .detail-section');
        if (pane) pane.innerHTML = `<h2>Notizen</h2>${this.renderNotizen()}`;
      }
    });

    window.addEventListener('bewertungenUpdated', async (e) => {
      if (e.detail.entityType === 'briefing' && e.detail.entityId === this.briefingId) {
        this.ratings = await window.bewertungsSystem.loadBewertungen('briefing', this.briefingId);
        const pane = document.querySelector('#tab-ratings .detail-section');
        if (pane) pane.innerHTML = `<h2>Bewertungen</h2>${this.renderRatings()}`;
      }
    });

    // Soft-Refresh bei Realtime-Updates (nur wenn kein Formular aktiv)
    window.addEventListener('softRefresh', async (e) => {
      const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
      if (hasActiveForm) {
        console.log('⏸️ BRIEFINGDETAIL: Formular aktiv - Soft-Refresh übersprungen');
        return;
      }
      if (!this.briefingId || !location.pathname.includes('/briefing/')) {
        return;
      }
      console.log('🔄 BRIEFINGDETAIL: Soft-Refresh - lade Daten neu');
      await this.loadBriefingData();
      await this.render();
      this.bindEvents();
    });
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activePane = document.getElementById(`tab-${tabName}`);
    if (activeButton && activePane) {
      activeButton.classList.add('active');
      activePane.classList.add('active');
    }
  }

  renderDocumentActions(doc) {
    const canDelete = window.currentUser?.permissions?.briefing?.can_delete || false;
    
    return `
      <div class="actions-dropdown-container" data-entity-type="briefing_documents">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item action-doc-open" data-doc-path="${doc.file_path}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Öffnen
          </a>
          ${canDelete ? `
            <div class="action-separator"></div>
            <a href="#" class="action-item action-danger action-doc-delete" data-doc-id="${doc.id}" data-doc-name="${doc.file_name}" data-doc-path="${doc.file_path}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Löschen
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderDocumentsTable() {
    if (!this.briefing.documents || this.briefing.documents.length === 0) {
      return `
        <div class="empty-state">
          <p>Keine Dokumente vorhanden</p>
        </div>
      `;
    }
    
    const formatSize = (bytes) => {
      if (!bytes) return '-';
      const mb = bytes / (1024 * 1024);
      return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
    };
    
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { 
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    }) : '-';
    
    const escape = (s) => window.validatorSystem?.sanitizeHtml?.(s || '') || (s || '');
    
    const getFileIcon = (contentType) => {
      if (contentType?.includes('pdf')) return '📄';
      if (contentType?.includes('image')) return '🖼️';
      if (contentType?.includes('word') || contentType?.includes('document')) return '📝';
      return '📎';
    };
    
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 50px;">Typ</th>
              <th>Dateiname</th>
              <th style="width: 120px;">Größe</th>
              <th style="width: 180px;">Hochgeladen am</th>
              <th style="width: 100px;">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${this.briefing.documents.map(doc => `
              <tr>
                <td style="text-align: center; font-size: 1.5rem;">
                  ${getFileIcon(doc.content_type)}
                </td>
                <td>
                  <strong>${escape(doc.file_name)}</strong>
                </td>
                <td>${formatSize(doc.size)}</td>
                <td>${formatDate(doc.created_at)}</td>
                <td>
                  ${this.renderDocumentActions(doc)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  showNotFound() {
    window.setHeadline('Briefing nicht gefunden');
    window.content.innerHTML = `
      <div class="error-message">
        <h2>Briefing nicht gefunden</h2>
        <p>Das angeforderte Briefing konnte nicht gefunden werden.</p>
      </div>
    `;
  }

  // Bearbeitungsformular anzeigen
  showEditForm() {
    console.log('🎯 BRIEFINGDETAIL: Zeige Bearbeitungsformular');
    window.setHeadline('Briefing bearbeiten');
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('briefing', this.briefing);
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('briefing', this.briefing);
    
    // Custom Submit Handler für Bearbeitungsformular
    const form = document.getElementById('briefing-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleEditFormSubmit();
      };
    }
  }

  // Handle Edit Form Submit
  async handleEditFormSubmit() {
    try {
      const form = document.getElementById('briefing-form');
      const formData = new FormData(form);
      const submitData = {};

      // FormData zu Objekt konvertieren
      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          // Multi-Select behandeln
          const cleanKey = key.replace('[]', '');
          if (!submitData[cleanKey]) {
            submitData[cleanKey] = [];
          }
          submitData[cleanKey].push(value);
        } else {
          submitData[key] = value;
        }
      }

      console.log('📝 Briefing Edit Submit-Daten:', submitData);

      // Update Briefing
      const result = await window.dataService.updateEntity('briefing', this.briefingId, submitData);
      
      if (result.success) {
        this.showSuccessMessage('Briefing erfolgreich aktualisiert!');
        
        // Event auslösen für Listen-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'briefing', action: 'updated', id: this.briefingId }
        }));
        
        // Zurück zur Detail-Ansicht
        setTimeout(() => {
          window.navigateTo(`/briefing/${this.briefingId}`);
        }, 1500);
      } else {
        this.showErrorMessage(`Fehler beim Aktualisieren: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren des Briefings:', error);
      this.showErrorMessage('Ein unerwarteter Fehler ist aufgetreten.');
    }
  }

  // Zeige Erfolgsmeldung
  showSuccessMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success';
    alertDiv.textContent = message;
    
    const form = document.getElementById('briefing-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }

  // Zeige Fehlermeldung
  showErrorMessage(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-danger';
    alertDiv.textContent = message;
    
    const form = document.getElementById('briefing-form');
    if (form) {
      form.parentNode.insertBefore(alertDiv, form);
      
      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }

  destroy() {
    console.log('🗑️ BRIEFINGDETAIL: Destroy aufgerufen - räume auf');
    
    // Invalidiere Tab-Cache für dieses Briefing
    tabDataCache.invalidate('briefing', this.briefingId);
    
    window.setContentSafely('');
  }
}

export const briefingDetail = new BriefingDetail();


