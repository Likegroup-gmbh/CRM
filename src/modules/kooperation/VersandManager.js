export class KooperationVersandManager {
  constructor() {
    this.drawerId = 'kooperation-versand-drawer';
    this.bindEvents();
  }

  // Event-basierte Kommunikation
  bindEvents() {
    document.addEventListener('actionRequested', (event) => {
      const { action, entityType, entityId } = event.detail;
      
      if (action === 'showVersand' && entityType === 'kooperation') {
        console.log('🎯 VERSANDMANAGER: Event empfangen für ID:', entityId);
        this.open(entityId);
      }
    });
  }

  async open(kooperationId) {
    console.log('🎯 VERSANDMANAGER: open() aufgerufen mit ID:', kooperationId);
    try {
      console.log('🎯 VERSANDMANAGER: Erstelle Drawer');
      await this.createDrawer();
      console.log('🎯 VERSANDMANAGER: Zeige Loading');
      this.showLoading();

      console.log('🎯 VERSANDMANAGER: Lade Kooperation und Creator-Daten');
      const kooperationData = await this.loadKooperationData(kooperationId);
      console.log('🎯 VERSANDMANAGER: Kooperation-Daten geladen:', kooperationData);

      // Versuche Versand-Daten zu laden
      let versandDaten = null;
      try {
        console.log('🎯 VERSANDMANAGER: Lade Versand-Daten');
        versandDaten = await this.loadVersandDaten(kooperationId);
        console.log('🎯 VERSANDMANAGER: Versand-Daten geladen:', versandDaten);
      } catch (detailError) {
        console.warn('⚠️ Konnte Versand-Daten nicht laden, zeige leeres Formular:', detailError);
      }
      
      console.log('🎯 VERSANDMANAGER: Rendere Form');
      this.renderForm(kooperationId, kooperationData, versandDaten);
      console.log('🎯 VERSANDMANAGER: Binde Events');
      this.bindFormEvents(kooperationId);
      console.log('🎯 VERSANDMANAGER: Drawer sollte jetzt sichtbar sein');
    } catch (error) {
      console.error('❌ VersandManager.open Fehler:', error);
      this.showError('Fehler beim Laden der Versand-Daten.');
    }
  }

  async createDrawer() {
    // Entferne existierendes Drawer falls vorhanden
    this.removeDrawer();

    // Erstelle Overlay
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;
    
    // Erstelle Panel
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    // Header
    const header = document.createElement('div');
    header.className = 'drawer-header';
    
    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Versand-Daten verwalten';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Tracking-Nummer und Versand-Status verwalten';
    
    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);
    
    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close';
    closeBtn.textContent = 'Schließen';
    headerRight.appendChild(closeBtn);
    
    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Body
    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;

    panel.appendChild(header);
    panel.appendChild(body);

    // Events
    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());

    // Zum DOM hinzufügen
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Slide-in Animation nach kurzer Verzögerung
    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    if (panel) {
      panel.classList.remove('show');
      // Nach Animation entfernen
      setTimeout(() => this.removeDrawer(), 250);
    }
  }

  removeDrawer() {
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }

  showLoading() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    body.innerHTML = '<div class="drawer-loading">Lade Versand-Daten...</div>';
  }

  showError(message) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    body.innerHTML = `<div class="alert alert-danger">${message}</div>`;
  }

  showSuccess(message) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    const alert = document.createElement('div');
    alert.className = 'alert alert-success';
    alert.textContent = message;
    body.insertBefore(alert, body.firstChild);
  }

  async loadKooperationData(kooperationId) {
    if (!window.supabase) return {};
    const { data, error } = await window.supabase
      .from('kooperationen')
      .select(`
        id, 
        name, 
        creator:creator_id(
          id, vorname, nachname, 
          lieferadresse_strasse, lieferadresse_hausnummer, 
          lieferadresse_plz, lieferadresse_stadt, lieferadresse_land
        )
      `)
      .eq('id', kooperationId)
      .single();
    if (error) throw error;
    return data || {};
  }

  async loadVersandDaten(kooperationId) {
    if (!window.supabase) return [];
    
    try {
      const { data, error } = await window.supabase
        .from('kooperation_versand')
        .select('*')
        .eq('kooperation_id', kooperationId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.warn('⚠️ Fehler beim Laden der Versand-Daten:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.warn('⚠️ Fehler beim Laden der Versand-Daten:', error);
      return [];
    }
  }

  renderForm(kooperationId, kooperationData, versandDaten) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const creator = kooperationData.creator;
    
    body.innerHTML = `
      <div class="versand-form-layout">
        <div class="creator-info">
          <h3>Creator & Lieferadresse</h3>
          <div class="creator-details">
            <div class="detail-item">
              <label>Name:</label>
              <span>${creator?.vorname || ''} ${creator?.nachname || ''}</span>
            </div>
            <div class="detail-item">
              <label>Kooperation:</label>
              <span>${kooperationData.name || 'Unbekannt'}</span>
            </div>
          </div>
          
          <div class="address-preview">
            <h4>Lieferadresse (aus Creator-Profil)</h4>
            <div class="address-display">
              <div class="address-name">${creator?.vorname || ''} ${creator?.nachname || ''}</div>
              <div class="address-line">${creator?.lieferadresse_strasse || ''} ${creator?.lieferadresse_hausnummer || ''}</div>
              <div class="address-line">${creator?.lieferadresse_plz || ''} ${creator?.lieferadresse_stadt || ''}</div>
              <div class="address-line">${creator?.lieferadresse_land || 'Deutschland'}</div>
            </div>
            ${!creator?.lieferadresse_strasse ? '<p class="address-warning">⚠️ Keine Lieferadresse im Creator-Profil hinterlegt</p>' : ''}
          </div>
        </div>

        <div class="versand-table-section">
          <h3>Versand-Übersicht</h3>
          ${this.renderVersandTable(versandDaten, creator)}
        </div>

        <form id="versand-form" data-kooperation-id="${kooperationId}" class="versand-form">
          <input type="hidden" name="kooperation_id" value="${kooperationId}">

          <div class="form-section">
            <h3>Neues Produkt versenden</h3>
            <div class="versand-details-grid">
              <div class="form-field">
                <label for="produkt_name">Produktname</label>
                <input type="text" name="produkt_name" placeholder="z.B. Produktpaket, Geschenkbox, etc." required>
              </div>
              <div class="form-field">
                <label for="tracking_nummer">Tracking-Nummer</label>
                <input type="text" name="tracking_nummer" placeholder="z.B. 1Z999AA1234567890">
                <small class="field-hint">Status wird automatisch auf "versendet" gesetzt</small>
              </div>
              <div class="form-field">
                <label for="versand_datum">Versand-Datum</label>
                <input type="date" name="versand_datum">
              </div>
              <div class="form-field">
                <label for="beschreibung">Beschreibung</label>
                <textarea name="beschreibung" rows="2" placeholder="Details zum Produkt...""></textarea>
              </div>
              <div class="form-field form-field-full">
                <label for="notizen">Versand-Notizen</label>
                <textarea name="notizen" rows="2" placeholder="Zusätzliche Notizen zum Versand..."></textarea>
              </div>
            </div>
          </div>

          <div class="drawer-actions">
            <button type="submit" class="primary-btn">Produkt hinzufügen</button>
            <button type="button" class="secondary-btn" data-close>Abbrechen</button>
          </div>
        </form>
      </div>
    `;
  }

  renderVersandTable(versandDaten, creator) {
    if (!versandDaten || versandDaten.length === 0) {
      return `
        <div class="empty-state-small">
          <p>Noch keine Produkte versendet</p>
        </div>
      `;
    }

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';
    const formatAddress = (creator) => {
      if (!creator?.lieferadresse_strasse) return 'Keine Adresse hinterlegt';
      return `${creator.lieferadresse_strasse} ${creator.lieferadresse_hausnummer || ''}, ${creator.lieferadresse_plz || ''} ${creator.lieferadresse_stadt || ''}, ${creator.lieferadresse_land || 'Deutschland'}`;
    };

    const tableRows = versandDaten.map(versand => `
      <tr>
        <td>
          <div class="product-info">
            <div class="product-name">${window.validatorSystem.sanitizeHtml(versand.produkt_name)}</div>
            ${versand.beschreibung ? `<div class="product-desc">${window.validatorSystem.sanitizeHtml(versand.beschreibung)}</div>` : ''}
          </div>
        </td>
        <td class="address-cell">
          <div class="address-compact">
            <div class="address-name">${creator?.vorname || ''} ${creator?.nachname || ''}</div>
            <div class="address-text">${formatAddress(creator)}</div>
          </div>
        </td>
        <td class="text-center">
          <span class="status-badge ${versand.versendet ? 'status-versendet' : 'status-offen'}">
            ${versand.versendet ? 'Versendet' : 'Offen'}
          </span>
        </td>
        <td class="text-center">
          ${versand.tracking_nummer ? `<span class="tracking-number">${versand.tracking_nummer}</span>` : '-'}
        </td>
        <td class="text-center">${formatDate(versand.versand_datum)}</td>
        <td class="text-center">
          <button class="btn-delete-versand" data-id="${versand.id}" title="Löschen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </td>
      </tr>
    `).join('');

    return `
      <div class="data-table-container">
        <table class="data-table versand-table">
          <thead>
            <tr>
              <th>Produkt</th>
              <th>Lieferadresse</th>
              <th class="text-center">Status</th>
              <th class="text-center">Tracking-Nr</th>
              <th class="text-center">Versand-Datum</th>
              <th class="text-center">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  bindFormEvents(kooperationId) {
    const form = document.getElementById('versand-form');
    if (!form) return;

    // Delete-Buttons für Versand-Einträge
    document.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-delete-versand')) {
        e.preventDefault();
        const btn = e.target.closest('.btn-delete-versand');
        const versandId = btn.dataset.id;
        
        if (confirm('Versand-Eintrag wirklich löschen?')) {
          await this.deleteVersandEintrag(versandId, kooperationId);
        }
      }
    });

    form.querySelector('[data-close]')?.addEventListener('click', () => this.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit(form, kooperationId);
    });
  }

  async handleSubmit(form, kooperationId) {
    try {
      const formData = new FormData(form);
      const payload = { kooperation_id: kooperationId };

      formData.forEach((value, key) => {
        if (key === 'kooperation_id') return;
        if (value === '') {
          payload[key] = null;
        } else {
          payload[key] = value;
        }
      });

      // Automatische Versand-Status-Logik: Tracking-Nummer vorhanden = versendet
      const hasTracking = payload.tracking_nummer && payload.tracking_nummer.trim() !== '';
      payload.versendet = hasTracking;

      if (window.supabase) {
        // Immer neuen Eintrag erstellen (mehrere Produkte möglich)
        const { error } = await window.supabase
          .from('kooperation_versand')
          .insert(payload);

        if (error) throw error;
      } else if (window.dataService?.createEntity) {
        await window.dataService.createEntity('kooperation_versand', payload);
      }

      this.showSuccess('Versand-Daten gespeichert.');
      setTimeout(() => this.close(), 1200);

      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'kooperation_versand', kooperation_id: kooperationId, action: 'saved' }
      }));
    } catch (error) {
      console.error('❌ Versand-Daten speichern fehlgeschlagen:', error);
      this.showError(error.message || 'Speichern fehlgeschlagen.');
    }
  }

  async deleteVersandEintrag(versandId, kooperationId) {
    try {
      if (window.supabase) {
        const { error } = await window.supabase
          .from('kooperation_versand')
          .delete()
          .eq('id', versandId);

        if (error) throw error;
      }

      // Drawer neu laden
      const kooperationData = await this.loadKooperationData(kooperationId);
      const versandDaten = await this.loadVersandDaten(kooperationId);
      this.renderForm(kooperationId, kooperationData, versandDaten);
      this.bindFormEvents(kooperationId);

      // Event für Tab-Update
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'kooperation_versand', kooperation_id: kooperationId, action: 'deleted' }
      }));

    } catch (error) {
      console.error('❌ Fehler beim Löschen des Versand-Eintrags:', error);
      alert('Fehler beim Löschen: ' + error.message);
    }
  }
}

export const kooperationVersandManager = new KooperationVersandManager();

// Global verfügbar machen
window.kooperationVersandManager = kooperationVersandManager;
