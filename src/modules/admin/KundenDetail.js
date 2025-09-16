// KundenDetail.js (ES6-Modul)
// Admin: Kunden-Details und Zuordnungen verwalten

export class KundenDetail {
  constructor() {
    this.userId = null;
    this.user = null;
    this.assignments = { unternehmen: [], marken: [] };
  }

  async init(id) {
    this.userId = id;
    await this.load();
    await this.render();
    this.bind();
  }

  async load() {
    try {
      const [{ data: user }, { data: urels }, { data: mrels }] = await Promise.all([
        window.supabase.from('benutzer').select('*').eq('id', this.userId).single(),
        window.supabase.from('kunde_unternehmen').select('unternehmen:unternehmen_id(id, firmenname)').eq('kunde_id', this.userId),
        window.supabase.from('kunde_marke').select('marke:marke_id(id, markenname)').eq('kunde_id', this.userId)
      ]);
      this.user = user || {};
      this.assignments.unternehmen = (urels || []).map(r => r.unternehmen).filter(Boolean);
      this.assignments.marken = (mrels || []).map(r => r.marke).filter(Boolean);
    } catch (e) {
      console.error('❌ Fehler beim Laden Kunden-Details:', e);
    }
  }

  renderList(items, type) {
    if (!items || items.length === 0) return '<div class="empty-state"><p>Keine Einträge</p></div>';
    
    const typeLabel = type === 'unternehmen' ? 'Unternehmen' : 'Marke';
    const nameField = type === 'unternehmen' ? 'firmenname' : 'markenname';
    
    return `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Erstellt</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(x => {
              const name = x[nameField] || x.name || x.id;
              const createdDate = x.created_at ? new Date(x.created_at).toLocaleDateString('de-DE') : '—';
              return `
                <tr>
                  <td>
                    <a href="/${type}/${x.id}" onclick="event.preventDefault(); window.navigateTo('/${type}/${x.id}')" class="table-link">
                      ${window.validatorSystem.sanitizeHtml(name)}
                    </a>
                  </td>
                  <td>${createdDate}</td>
                  <td>
                    ${window.ActionsDropdown?.createGenericActions(type, x.id, [
                      { action: 'remove', icon: 'icon-trash', label: `${typeLabel}-Zuordnung entfernen` }
                    ]) || ''}
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  async render() {
    const html = `
      <div class="kunden-detail">
        <div class="page-header">
        <div class="page-header-left">
          <h1>Kunde: ${window.validatorSystem.sanitizeHtml(this.user?.name || '-')}</h1>
          <p>Stammdaten und Zuordnungen</p>
        </div>
        <div class="page-header-right">
          <button class="secondary-btn" id="btn-back-kunden">Kunden Übersicht</button>
        </div>
      </div>

      <div class="content-section">
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="stammdaten">Stammdaten</button>
          <button class="tab-button" data-tab="unternehmen">Unternehmen <span class="tab-count">${this.assignments.unternehmen.length}</span></button>
          <button class="tab-button" data-tab="marken">Marken <span class="tab-count">${this.assignments.marken.length}</span></button>
        </div>

        <div class="tab-content">
          <div class="tab-pane active" id="tab-stammdaten">
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
                            ${this.user?.freigeschaltet ? 'Dieser Benutzer ist freigeschaltet.' : 'Dieser Benutzer ist gesperrt oder wartet auf Freischaltung.'}
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
              <h2>Rolle</h2>
              <div class="data-table-container">
                <table class="data-table">
                  <thead>
                    <tr><th>Rolle</th><th>Unterrolle</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>${window.validatorSystem.sanitizeHtml(this.user?.rolle || '-')}</td>
                      <td>${window.validatorSystem.sanitizeHtml(this.user?.unterrolle || '-')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="tab-pane" id="tab-unternehmen">
            <div class="detail-section">
              <div class="section-header">
                <h2>Unternehmen</h2>
                <button class="primary-btn" id="btn-add-unternehmen">Unternehmen hinzufügen</button>
              </div>
              ${this.renderList(this.assignments.unternehmen, 'unternehmen')}
            </div>
          </div>

          <div class="tab-pane" id="tab-marken">
            <div class="detail-section">
              <div class="section-header">
                <h2>Marken</h2>
                <button class="primary-btn" id="btn-add-marke">Marke hinzufügen</button>
              </div>
              ${this.renderList(this.assignments.marken, 'marke')}
            </div>
          </div>
        </div>
      </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Entferne Zuordnung (Unternehmen oder Marke)
  async removeZuordnung(entityId, type) {
    const kundeId = this.kundeId;
    
    if (!confirm(`Möchten Sie die Zuordnung wirklich entfernen?`)) {
      return;
    }

    try {
      let tableName, errorMessage;
      
      if (type === 'unternehmen') {
        tableName = 'kunde_unternehmen';
        errorMessage = 'Fehler beim Entfernen der Unternehmen-Zuordnung';
      } else if (type === 'marke') {
        tableName = 'kunde_marke';
        errorMessage = 'Fehler beim Entfernen der Marken-Zuordnung';
      } else {
        throw new Error('Unbekannter Typ');
      }

      const { error } = await window.supabase
        .from(tableName)
        .delete()
        .eq('kunde_id', kundeId)
        .eq(`${type}_id`, entityId);

      if (error) throw error;

      // Erfolg
      window.notificationSystem?.showSuccess(`${type === 'unternehmen' ? 'Unternehmen' : 'Marke'}-Zuordnung erfolgreich entfernt!`);
      
      // Liste neu laden
      await this.load();
      
    } catch (error) {
      console.error(`❌ ${errorMessage}:`, error);
      window.notificationSystem?.showError(`${errorMessage}: ${error.message}`);
    }
  }

  bind() {
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-back-kunden') {
        e.preventDefault();
        window.navigateTo('/admin/kunden');
        return;
      }

      if (e.target && e.target.id === 'btn-add-unternehmen') {
        e.preventDefault();
        this.showUnternehmenZuordnungModal();
        return;
      }

      if (e.target && e.target.id === 'btn-add-marke') {
        e.preventDefault();
        this.showMarkeZuordnungModal();
        return;
      }

      const tabBtn = e.target.closest('.tab-button');
      if (tabBtn) {
        e.preventDefault();
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById(`tab-${tabBtn.dataset.tab}`);
        if (pane) pane.classList.add('active');
      }
    });

    document.addEventListener('change', async (e) => {
      if (e.target && e.target.id === 'freigeschaltet-toggle') {
        const isFreigeschaltet = e.target.checked;
        try {
          const updateData = { freigeschaltet: isFreigeschaltet };
          if (!isFreigeschaltet) {
            updateData.rolle = 'pending';
            updateData.unterrolle = 'awaiting_approval';
            updateData.zugriffsrechte = null;
          }
          const { error } = await window.supabase
            .from('benutzer')
            .update(updateData)
            .eq('id', this.userId);
          if (error) throw error;
          this.user.freigeschaltet = isFreigeschaltet;
          if (updateData.rolle) this.user.rolle = updateData.rolle;
          if (updateData.unterrolle) this.user.unterrolle = updateData.unterrolle;
          window.NotificationSystem?.show('success', isFreigeschaltet ? 'Kunde freigeschaltet' : 'Kunde gesperrt');
        } catch (err) {
          console.error('❌ Update fehlgeschlagen', err);
          e.target.checked = !isFreigeschaltet;
          window.NotificationSystem?.show('error', 'Update fehlgeschlagen');
        }
      }
    });
  }

  // Modal für Unternehmen-Zuordnung mit Auto-Suggestion
  async showUnternehmenZuordnungModal() {
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
          .from('kunde_unternehmen')
          .insert({ 
            kunde_id: this.userId, 
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

  // Modal für Marken-Zuordnung mit Auto-Suggestion
  async showMarkeZuordnungModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>Marke zuordnen</h3>
          <button id="close-modal" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Marke suchen</label>
            <input id="marke-search" class="form-input" type="text" placeholder="Markenname eingeben..." autocomplete="off" />
            <div id="marke-dropdown" class="auto-suggest-dropdown" style="display: none;"></div>
          </div>
          <div id="selected-marke" class="selected-items" style="margin-top: 10px;"></div>
        </div>
        <div class="modal-footer">
          <button id="save-zuordnung" class="primary-btn" disabled>Zuordnen</button>
          <button id="cancel-zuordnung" class="secondary-btn">Abbrechen</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#marke-search');
    const dropdown = modal.querySelector('#marke-dropdown');
    const selectedContainer = modal.querySelector('#selected-marke');
    const saveBtn = modal.querySelector('#save-zuordnung');
    let selectedMarke = null;
    let searchTimeout;

    // Auto-Suggestion für Marken
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
            .from('marke')
            .select('id, markenname')
            .ilike('markenname', `%${query}%`)
            .order('markenname')
            .limit(10);

          if (error) throw error;

          if (data && data.length > 0) {
            dropdown.innerHTML = data.map(m => `
              <div class="dropdown-item" data-id="${m.id}" data-name="${m.markenname}">
                <div class="dropdown-item-main">${window.validatorSystem.sanitizeHtml(m.markenname)}</div>
              </div>
            `).join('');
            dropdown.style.display = 'block';
          } else {
            dropdown.innerHTML = '<div class="dropdown-item no-results">Keine Marken gefunden</div>';
            dropdown.style.display = 'block';
          }
        } catch (err) {
          console.error('❌ Marken-Suche fehlgeschlagen', err);
          dropdown.innerHTML = '<div class="dropdown-item no-results">Fehler bei der Suche</div>';
          dropdown.style.display = 'block';
        }
      }, 300);
    });

    // Dropdown-Auswahl
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item[data-id]');
      if (!item) return;

      selectedMarke = {
        id: item.dataset.id,
        name: item.dataset.name
      };

      selectedContainer.innerHTML = `
        <div class="selected-item">
          <span class="selected-item-name">${window.validatorSystem.sanitizeHtml(selectedMarke.name)}</span>
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
        selectedMarke = null;
        selectedContainer.innerHTML = '';
        saveBtn.disabled = true;
      }
    });

    // Speichern
    saveBtn.addEventListener('click', async () => {
      if (!selectedMarke) return;

      try {
        const { error } = await window.supabase
          .from('kunde_marke')
          .insert({ 
            kunde_id: this.userId, 
            marke_id: selectedMarke.id 
          });

        if (error) {
          // Prüfe ob es ein Duplicate-Key-Fehler ist
          if (error.code === '23505') {
            window.NotificationSystem?.show('warning', 'Marke ist bereits zugeordnet');
            modal.remove();
            return;
          }
          throw error;
        }

        window.NotificationSystem?.show('success', 'Marke erfolgreich zugeordnet');
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

  destroy() {
    window.setContentSafely('');
  }
}

export const kundenDetail = new KundenDetail();
