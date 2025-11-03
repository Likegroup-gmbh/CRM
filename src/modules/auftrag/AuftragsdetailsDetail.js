// AuftragsdetailsDetail.js (ES6-Modul)
// Auftragsdetails-Detailseite mit Tabs für verschiedene Kategorien

export class AuftragsdetailsDetail {
  constructor() {
    this.detailsId = null;
    this.details = null;
    this.auftrag = null;
    this.notizen = [];
    this.ratings = [];
  }

  // Initialisiere Auftragsdetails-Detailseite
  async init(detailsId) {
    console.log('🎯 AUFTRAGSDETAILSDETAIL: Initialisiere Auftragsdetails-Detailseite für ID:', detailsId);
    
    // Security: Nur Mitarbeiter haben Zugriff (Kunden nicht)
    const isKunde = window.currentUser?.rolle === 'kunde';
    if (isKunde) {
      window.setHeadline('Zugriff verweigert');
      window.content.innerHTML = `
        <div class="error-state">
          <h2>Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung, diese Seite zu sehen.</p>
        </div>
      `;
      return;
    }

    try {
      this.detailsId = detailsId;
      await this.loadDetailsData();
      
      // Breadcrumb aktualisieren
      if (window.breadcrumbSystem && this.auftrag) {
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Auftragsdetails', url: '/auftragsdetails', clickable: true },
          { label: this.auftrag.auftragsname || 'Details', url: `/auftragsdetails/${this.detailsId}`, clickable: false }
        ]);
      }
      
      this.render();
      this.bindEvents();
      console.log('✅ AUFTRAGSDETAILSDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler?.handle(error, 'AuftragsdetailsDetail.init');
    }
  }

  // Lade Auftragsdetails-Daten
  async loadDetailsData() {
    console.log('🔄 AUFTRAGSDETAILSDETAIL: Lade Auftragsdetails-Daten...');
    
    try {
      // Auftragsdetails mit Auftrag-Daten laden (single query mit Joins für Performance)
      const { data: details, error } = await window.supabase
        .from('auftrag_details')
        .select(`
          *,
          auftrag:auftrag_id (
            id,
            auftragsname,
            kampagnenanzahl,
            status,
            start,
            ende,
            unternehmen:unternehmen_id (
              id,
              firmenname
            ),
            marke:marke_id (
              id,
              markenname
            ),
            ansprechpartner:ansprechpartner_id (
              id,
              vorname,
              nachname,
              email
            )
          )
        `)
        .eq('id', this.detailsId)
        .single();

      if (error) throw error;
      
      this.details = details;
      this.auftrag = details.auftrag;
      console.log('✅ AUFTRAGSDETAILSDETAIL: Auftragsdetails geladen:', this.details);

      // Notizen laden (falls Notizen-System verfügbar)
      if (window.notizenSystem) {
        this.notizen = await window.notizenSystem.loadNotizen('auftrag_details', this.detailsId);
        console.log('✅ AUFTRAGSDETAILSDETAIL: Notizen geladen:', this.notizen.length);
      }

      // Bewertungen laden (falls Bewertungs-System verfügbar)
      if (window.bewertungsSystem) {
        this.ratings = await window.bewertungsSystem.loadBewertungen('auftrag_details', this.detailsId);
        console.log('✅ AUFTRAGSDETAILSDETAIL: Ratings geladen:', this.ratings.length);
      }

    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSDETAIL: Fehler beim Laden der Auftragsdetails-Daten:', error);
      throw error;
    }
  }

  // Rendere Auftragsdetails-Detailseite
  render() {
    window.setHeadline(`${this.auftrag?.auftragsname || 'Auftragsdetails'} - Details`);
    
    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <button id="btn-edit-details" class="secondary-btn">
            <i class="icon-edit"></i>
            Bearbeiten
          </button>
        </div>
      </div>

      <div class="content-section">
        <!-- Tab-Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="informationen">
            Informationen
            <span class="tab-count">1</span>
          </button>
          <button class="tab-button" data-tab="ugc">
            UGC
          </button>
          <button class="tab-button" data-tab="influencer">
            Influencer
          </button>
          <button class="tab-button" data-tab="vor-ort">
            Vor Ort Dreh
          </button>
          <button class="tab-button" data-tab="vor-ort-mitarbeiter">
            Vor Ort Mitarbeiter
          </button>
          <button class="tab-button" data-tab="zusammenfassung">
            Zusammenfassung
          </button>
          ${window.notizenSystem ? `
          <button class="tab-button" data-tab="notizen">
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          ` : ''}
        </div>

        <!-- Tab-Content -->
        <div class="tab-content">
          <!-- Informationen Tab -->
          <div class="tab-pane active" id="informationen">
            ${this.renderInformationen()}
          </div>

          <!-- UGC Tab -->
          <div class="tab-pane" id="ugc">
            ${this.renderUGC()}
          </div>

          <!-- Influencer Tab -->
          <div class="tab-pane" id="influencer">
            ${this.renderInfluencer()}
          </div>

          <!-- Vor Ort Tab -->
          <div class="tab-pane" id="vor-ort">
            ${this.renderVorOrt()}
          </div>

          <!-- Vor Ort Mitarbeiter Tab -->
          <div class="tab-pane" id="vor-ort-mitarbeiter">
            ${this.renderVorOrtMitarbeiter()}
          </div>

          <!-- Zusammenfassung Tab -->
          <div class="tab-pane" id="zusammenfassung">
            ${this.renderZusammenfassung()}
          </div>

          ${window.notizenSystem ? `
          <!-- Notizen Tab -->
          <div class="tab-pane" id="notizen">
            ${this.renderNotizen()}
          </div>
          ` : ''}
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Rendere Informationen
  renderInformationen() {
    const auftrag = this.auftrag || {};
    const unternehmen = auftrag.unternehmen || {};
    const marke = auftrag.marke || {};
    const ansprechpartner = auftrag.ansprechpartner || {};

    return `
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Auftrags-Informationen</h3>
            <div class="detail-item">
              <label>Auftragsname:</label>
              <span>
                <a href="#" class="table-link" data-table="auftrag" data-id="${auftrag.id || ''}">
                  ${window.validatorSystem.sanitizeHtml(auftrag.auftragsname || '-')}
                </a>
              </span>
            </div>
            <div class="detail-item">
              <label>Unternehmen:</label>
              <span>
                ${unternehmen.firmenname 
                  ? `<a href="#" class="table-link" data-table="unternehmen" data-id="${unternehmen.id}">${window.validatorSystem.sanitizeHtml(unternehmen.firmenname)}</a>`
                  : '-'}
              </span>
            </div>
            <div class="detail-item">
              <label>Marke:</label>
              <span>
                ${marke.markenname 
                  ? `<a href="#" class="table-link" data-table="marke" data-id="${marke.id}">${window.validatorSystem.sanitizeHtml(marke.markenname)}</a>`
                  : '-'}
              </span>
            </div>
            <div class="detail-item">
              <label>Ansprechpartner:</label>
              <span>${this.formatAnsprechpartner(ansprechpartner)}</span>
            </div>
            <div class="detail-item">
              <label>Status:</label>
              <span class="status-${auftrag.status?.toLowerCase() || 'unknown'}">
                ${auftrag.status || 'Unbekannt'}
              </span>
            </div>
            <div class="detail-item">
              <label>Kampagnenanzahl:</label>
              <span>${this.details?.kampagnenanzahl || auftrag.kampagnenanzahl || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Zeitraum:</label>
              <span>
                ${auftrag.start ? new Date(auftrag.start).toLocaleDateString('de-DE') : '-'} 
                bis 
                ${auftrag.ende ? new Date(auftrag.ende).toLocaleDateString('de-DE') : '-'}
              </span>
            </div>
            <div class="detail-item">
              <label>Erstellt am:</label>
              <span>${this.details?.created_at ? new Date(this.details.created_at).toLocaleDateString('de-DE') : '-'}</span>
            </div>
            <div class="detail-item">
              <label>Zuletzt aktualisiert:</label>
              <span>${this.details?.updated_at ? new Date(this.details.updated_at).toLocaleDateString('de-DE') : '-'}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Rendere UGC Details
  renderUGC() {
    const details = this.details || {};
    return `
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>UGC (User Generated Content)</h3>
            <div class="detail-item">
              <label>Anzahl Videos:</label>
              <span>${details.ugc_video_anzahl || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Anzahl Creator:</label>
              <span>${details.ugc_creator_anzahl || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Budget & Informationen:</label>
              <div class="budget-info">
                ${details.ugc_budget_info 
                  ? window.validatorSystem.sanitizeHtml(details.ugc_budget_info) 
                  : '<em>Keine Informationen hinterlegt</em>'}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Rendere Influencer Details
  renderInfluencer() {
    const details = this.details || {};
    return `
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Influencer</h3>
            <div class="detail-item">
              <label>Anzahl Videos:</label>
              <span>${details.influencer_video_anzahl || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Anzahl Creator:</label>
              <span>${details.influencer_creator_anzahl || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Budget & Informationen:</label>
              <div class="budget-info">
                ${details.influencer_budget_info 
                  ? window.validatorSystem.sanitizeHtml(details.influencer_budget_info) 
                  : '<em>Keine Informationen hinterlegt</em>'}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Rendere Vor Ort Details
  renderVorOrt() {
    const details = this.details || {};
    return `
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Vor Ort Dreh</h3>
            <div class="detail-item">
              <label>Anzahl Videos:</label>
              <span>${details.vor_ort_video_anzahl || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Anzahl Creator:</label>
              <span>${details.vor_ort_creator_anzahl || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Anzahl Videographen:</label>
              <span>${details.vor_ort_videographen_anzahl || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Budget & Informationen:</label>
              <div class="budget-info">
                ${details.vor_ort_budget_info 
                  ? window.validatorSystem.sanitizeHtml(details.vor_ort_budget_info) 
                  : '<em>Keine Informationen hinterlegt</em>'}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Rendere Vor Ort Mitarbeiter Details
  renderVorOrtMitarbeiter() {
    const details = this.details || {};
    return `
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Vor Ort Dreh Mitarbeiter</h3>
            <div class="detail-item">
              <label>Anzahl Videos:</label>
              <span>${details.vor_ort_mitarbeiter_video_anzahl || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Anzahl Videographen:</label>
              <span>${details.vor_ort_mitarbeiter_videographen_anzahl || '-'}</span>
            </div>
            <div class="detail-item">
              <label>Budget & Informationen:</label>
              <div class="budget-info">
                ${details.vor_ort_mitarbeiter_budget_info 
                  ? window.validatorSystem.sanitizeHtml(details.vor_ort_mitarbeiter_budget_info) 
                  : '<em>Keine Informationen hinterlegt</em>'}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Rendere Zusammenfassung
  renderZusammenfassung() {
    const details = this.details || {};
    const num = (v) => v || v === 0 ? new Intl.NumberFormat('de-DE').format(v) : '-';
    
    return `
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3>Gesamtübersicht</h3>
            <div class="detail-item">
              <label>Gesamtanzahl Videos (geplant):</label>
              <span class="highlight-value">${num(details.gesamt_videos)}</span>
            </div>
            <div class="detail-item">
              <label>Gesamtanzahl Creator (geplant):</label>
              <span class="highlight-value">${num(details.gesamt_creator)}</span>
            </div>
          </div>
          
          <div class="detail-card">
            <h3>Aufschlüsselung nach Kategorie</h3>
            <div class="category-breakdown">
              <div class="breakdown-item">
                <strong>UGC:</strong>
                <span>${num(details.ugc_video_anzahl)} Videos, ${num(details.ugc_creator_anzahl)} Creator</span>
              </div>
              <div class="breakdown-item">
                <strong>Influencer:</strong>
                <span>${num(details.influencer_video_anzahl)} Videos, ${num(details.influencer_creator_anzahl)} Creator</span>
              </div>
              <div class="breakdown-item">
                <strong>Vor Ort:</strong>
                <span>${num(details.vor_ort_video_anzahl)} Videos, ${num(details.vor_ort_creator_anzahl)} Creator, ${num(details.vor_ort_videographen_anzahl)} Videographen</span>
              </div>
              <div class="breakdown-item">
                <strong>Vor Ort Mitarbeiter:</strong>
                <span>${num(details.vor_ort_mitarbeiter_video_anzahl)} Videos, ${num(details.vor_ort_mitarbeiter_videographen_anzahl)} Videographen</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Rendere Notizen
  renderNotizen() {
    if (window.notizenSystem) {
      return window.notizenSystem.renderNotizenContainer(this.notizen, 'auftrag_details', this.detailsId);
    }
    return '<p>Notizen-System nicht verfügbar</p>';
  }

  // Formatiere Ansprechpartner
  formatAnsprechpartner(ansprechpartner) {
    if (!ansprechpartner) return '-';
    const name = [ansprechpartner.vorname, ansprechpartner.nachname].filter(Boolean).join(' ');
    return ansprechpartner.email ? `${name} (${ansprechpartner.email})` : name;
  }

  // Binde Events
  bindEvents() {
    // Tab-Navigation
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-button')) {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      }

      // Edit-Button
      if (e.target.id === 'btn-edit-details' || e.target.closest('#btn-edit-details')) {
        this.showEditForm();
      }

      // Table-Links
      const link = e.target.closest('.table-link');
      if (link) {
        e.preventDefault();
        const table = link.dataset.table;
        const id = link.dataset.id;
        if (table && id) {
          window.navigateTo(`/${table}/${id}`);
        }
      }
    });

    // Notizen und Bewertungen Events
    document.addEventListener('notizenUpdated', () => {
      this.loadDetailsData().then(() => {
        this.render();
        this.bindEvents();
      });
    });

    document.addEventListener('bewertungenUpdated', () => {
      this.loadDetailsData().then(() => {
        this.render();
        this.bindEvents();
      });
    });
  }

  // Tab wechseln
  switchTab(tabName) {
    // Alle Tab-Buttons deaktivieren
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });

    // Alle Tab-Panes ausblenden
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    // Gewählten Tab aktivieren
    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedPane = document.getElementById(tabName);

    if (selectedButton) selectedButton.classList.add('active');
    if (selectedPane) selectedPane.classList.add('active');
  }

  // Bearbeitungsformular anzeigen
  showEditForm() {
    console.log('🎯 AUFTRAGSDETAILSDETAIL: Öffne Bearbeitungsformular via Drawer');
    
    // Verwende den bestehenden AuftragsDetailsManager
    if (window.auftragsDetailsManager) {
      window.auftragsDetailsManager.open(this.auftrag.id);
    } else {
      window.notificationSystem?.show('Bearbeitungsformular nicht verfügbar', 'error');
    }
  }

  // Cleanup
  destroy() {
    console.log('AUFTRAGSDETAILSDETAIL: Cleaning up...');
  }
}

export const auftragsdetailsDetail = new AuftragsdetailsDetail();

