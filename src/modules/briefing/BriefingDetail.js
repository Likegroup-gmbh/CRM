// BriefingDetail.js (ES6-Modul)
// Detailansicht für Briefings mit Tabs (Informationen, Notizen, Bewertungen)

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
      await this.loadBriefingData();
      await this.render();
      this.bindEvents();
    } catch (error) {
      console.error('❌ BRIEFINGDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler?.handle?.(error, 'BriefingDetail.init');
    }
  }

  async loadBriefingData() {
    if (!this.briefingId || this.briefingId === 'new') return;

    try {
      const { data: briefing, error } = await window.supabase
        .from('briefings')
        .select(`
          *,
          unternehmen:unternehmen_id(id, firmenname, webseite),
          marke:marke_id(id, markenname, webseite),
          assignee:assignee_id(id, name)
        `)
        .eq('id', this.briefingId)
        .single();

      if (error) throw error;

      this.briefing = briefing;

      // Kooperation separat laden (kein FK-Embed vorhanden in Schema Cache)
      if (this.briefing?.kooperation_id) {
        try {
          const { data: koop } = await window.supabase
            .from('kooperationen')
            .select(`
              id,
              name,
              status,
              kampagne:kampagne_id ( id, kampagnenname )
            `)
            .eq('id', this.briefing.kooperation_id)
            .single();
          if (koop) this.briefing.kooperation = koop;
        } catch (e) {
          console.warn('⚠️ BRIEFINGDETAIL: Kooperation konnte nicht geladen werden', e);
          this.briefing.kooperation = null;
        }
      }

      if (window.notizenSystem) {
        this.notizen = await window.notizenSystem.loadNotizen('briefing', this.briefingId);
      }
      if (window.bewertungsSystem) {
        this.ratings = await window.bewertungsSystem.loadBewertungen('briefing', this.briefingId);
      }
    } catch (error) {
      console.error('❌ BRIEFINGDETAIL: Fehler beim Laden der Briefing-Daten:', error);
      throw error;
    }
  }

  async render() {
    if (!this.briefing) {
      this.showNotFound();
      return;
    }

    const title = this.briefing.product_service_offer || 'Briefing';
    window.setHeadline(`Briefing: ${window.validatorSystem?.sanitizeHtml?.(title) || title}`);

    const canEdit = window.currentUser?.permissions?.briefing?.can_edit || false;
    const canDelete = window.currentUser?.permissions?.briefing?.can_delete || false;

    const formatDate = (d) => (d ? new Date(d).toLocaleDateString('de-DE') : '-');
    const escape = (s) => window.validatorSystem?.sanitizeHtml?.(s || '-') || (s || '-');

    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>${escape(title)}</h1>
          <p>Briefing-Details und verwandte Informationen</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/briefing')" class="secondary-btn">Zurück zur Übersicht</button>
          ${canEdit ? `<button id="btn-edit-briefing" class="primary-btn">Bearbeiten</button>` : ''}
        </div>
      </div>

      <div class="content-section">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="info">
            <i class="icon-information-circle"></i>
            Informationen
          </button>
          <button class="tab-button" data-tab="notizen">
            <i class="icon-document-text"></i>
            Notizen
            <span class="tab-count">${this.notizen.length}</span>
          </button>
          <button class="tab-button" data-tab="ratings">
           
            Bewertungen
            <span class="tab-count">${this.ratings.length}</span>
          </button>
        </div>

        <div class="tab-content">
          <div class="tab-pane active" id="tab-info">
            <div class="detail-section">
              <h2>Briefing Informationen</h2>
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
                    <label>Do's:</label>
                    <span>${escape(this.briefing.dos)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Don'ts:</label>
                    <span>${escape(this.briefing.donts)}</span>
                  </div>
                  <div class="detail-item">
                    <label>Rechtlicher Hinweis:</label>
                    <span>${escape(this.briefing.rechtlicher_hinweis)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="tab-pane" id="tab-notizen">
            <div class="detail-section">
              <h2>Notizen</h2>
              ${this.renderNotizen()}
            </div>
          </div>

          <div class="tab-pane" id="tab-ratings">
            <div class="detail-section">
              <h2>Bewertungen</h2>
              ${this.renderRatings()}
            </div>
          </div>
        </div>
      </div>

      <div class="detail-actions">
        ${canEdit ? `<button id="btn-edit-briefing-bottom" class="primary-btn">Briefing bearbeiten</button>` : ''}
        ${canDelete ? `<button id="btn-delete-briefing" class="danger-btn">Briefing löschen</button>` : ''}
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
      if (e.target.id === 'btn-edit-briefing' || e.target.id === 'btn-edit-briefing-bottom') {
        e.preventDefault();
        window.navigateTo(`/briefing/${this.briefingId}/edit`);
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

  showNotFound() {
    window.setHeadline('Briefing nicht gefunden');
    window.content.innerHTML = `
      <div class="error-message">
        <h2>Briefing nicht gefunden</h2>
        <p>Das angeforderte Briefing konnte nicht gefunden werden.</p>
        <button onclick="window.navigateTo('/briefing')" class="primary-btn">Zurück zur Übersicht</button>
      </div>
    `;
  }

  destroy() {
    window.setContentSafely('');
  }
}

export const briefingDetail = new BriefingDetail();


