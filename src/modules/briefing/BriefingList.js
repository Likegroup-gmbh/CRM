// BriefingList.js (ES6-Modul)
// Briefing-Liste mit neuem Filtersystem

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export class BriefingList {
  constructor() {
    this.selectedBriefings = new Set();
    this._boundEventListeners = new Set();
  }

  // Initialisiere Briefing-Liste
  async init(id) {
    // Falls eine ID übergeben wurde, leite zu Detail-Modul um (wird in main.js gemappt)
    if (id && id !== 'new' && window.moduleRegistry) {
      // Immer zur Detailseite routen
      return window.navigateTo(`/briefing/${id}`);
    }

    window.setHeadline('Briefings Übersicht');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Briefing', url: '/briefing', clickable: false }
      ]);
    }

    // Verstecke Bulk-Actions für Kunden
    if (window.bulkActionSystem) {
      window.bulkActionSystem.hideForKunden();
    }

    const canView = (window.canViewPage && window.canViewPage('briefing')) || await window.checkUserPermission('briefing', 'can_view');
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Briefings anzuzeigen.</p>
        </div>
      `;
      return;
    }

    // BulkActionSystem für Briefing registrieren
    window.bulkActionSystem?.registerList('briefing', this);
    
    this.bindEvents();
    await this.loadAndRender();
  }

  async loadAndRender() {
    try {
      // PERFORMANCE: Keine separate loadFilterData() Query mehr!
      // Filter-Optionen werden vom FilterSystem bei Bedarf geladen
      
      await this.render();
      await this.initializeFilterBar();

      const currentFilters = filterSystem.getFilters('briefing');
      console.log('🔍 Lade Briefings mit Filter:', currentFilters);
      const briefings = await this.loadBriefingsWithRelations(currentFilters);
      console.log('📊 Briefings geladen:', briefings?.length || 0);
      await this.updateTable(briefings);
    } catch (error) {
      window.ErrorHandler.handle(error, 'BriefingList.loadAndRender');
    }
  }

  async loadBriefingsWithRelations(filters = {}) {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return await window.dataService.loadEntities('briefing', filters);
      }

      // Sichtbarkeit: Nicht-Admins nur eigene (assignee_id) ODER über zugewiesene Kooperation/Kampagne/Marken/Unternehmen
      // Neue Logik: Marken-Zuordnung als Zusatzfilter
      // - Nur Unternehmen zugeordnet → Sieht ALLES vom Unternehmen
      // - Unternehmen + bestimmte Marken → Sieht NUR Inhalte der zugewiesenen Marken
      const isAdmin = window.currentUser?.rolle === 'admin';
      let allowedKampagneIds = [];
      let allowedKoopIds = [];
      if (!isAdmin) {
        try {
          // 1. Direkt zugeordnete Kampagnen
          const { data: assignedKampagnen } = await window.supabase
            .from('kampagne_mitarbeiter')
            .select('kampagne_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const directKampagnenIds = (assignedKampagnen || []).map(r => r.kampagne_id).filter(Boolean);
          
          // 2. Zugeordnete Marken MIT Unternehmen-Info
          const { data: assignedMarken } = await window.supabase
            .from('marke_mitarbeiter')
            .select('marke_id, marke:marke_id(unternehmen_id)')
            .eq('mitarbeiter_id', window.currentUser?.id);
          
          // Zugeordnete Marken mit ihren Unternehmen
          const markenMitUnternehmen = (assignedMarken || []).map(r => ({
            marke_id: r.marke_id,
            unternehmen_id: r.marke?.unternehmen_id
          })).filter(r => r.marke_id);
          
          // 3. Zugeordnete Unternehmen
          const { data: mitarbeiterUnternehmen } = await window.supabase
            .from('mitarbeiter_unternehmen')
            .select('unternehmen_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          
          const unternehmenIds = (mitarbeiterUnternehmen || [])
            .map(r => r.unternehmen_id)
            .filter(Boolean);
          
          // Erstelle Map: Unternehmen-ID → zugeordnete Marken-IDs
          const unternehmenMarkenMap = new Map();
          markenMitUnternehmen.forEach(r => {
            if (r.unternehmen_id) {
              if (!unternehmenMarkenMap.has(r.unternehmen_id)) {
                unternehmenMarkenMap.set(r.unternehmen_id, []);
              }
              unternehmenMarkenMap.get(r.unternehmen_id).push(r.marke_id);
            }
          });
          
          // Für jedes Unternehmen die erlaubten Marken ermitteln
          let allowedMarkenIds = [];
          
          for (const unternehmenId of unternehmenIds) {
            const explicitMarkenIds = unternehmenMarkenMap.get(unternehmenId);
            
            if (explicitMarkenIds && explicitMarkenIds.length > 0) {
              // User hat explizite Marken-Zuordnung → Nur diese Marken erlauben
              allowedMarkenIds.push(...explicitMarkenIds);
            } else {
              // Keine Marken-Zuordnung → ALLE Marken des Unternehmens erlauben
              const { data: alleMarken } = await window.supabase
                .from('marke')
                .select('id')
                .eq('unternehmen_id', unternehmenId);
              
              allowedMarkenIds.push(...(alleMarken || []).map(m => m.id));
            }
          }
          
          // Duplikate entfernen
          allowedMarkenIds = [...new Set(allowedMarkenIds)];
          
          // Kampagnen für erlaubte Marken laden
          let markenKampagnenIds = [];
          if (allowedMarkenIds.length > 0) {
            const { data: kampagnen } = await window.supabase
              .from('kampagne')
              .select('id')
              .in('marke_id', allowedMarkenIds);
            
            markenKampagnenIds = (kampagnen || []).map(k => k.id).filter(Boolean);
          }
          
          // Alle zusammenführen und Duplikate entfernen
          allowedKampagneIds = [...new Set([
            ...directKampagnenIds,
            ...markenKampagnenIds
          ])];
          
          // Kooperationen aus erlaubten Kampagnen laden
          if (allowedKampagneIds.length > 0) {
            const { data: koops } = await window.supabase
              .from('kooperationen')
              .select('id')
              .in('kampagne_id', allowedKampagneIds);
            allowedKoopIds = (koops || []).map(k => k.id);
          }
          
          console.log(`🔍 BRIEFINGLIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`, {
            direkteKampagnen: directKampagnenIds.length,
            erlaubteMarken: allowedMarkenIds.length,
            markenKampagnen: markenKampagnenIds.length,
            gesamtKampagnen: allowedKampagneIds.length,
            kooperationen: allowedKoopIds.length
          });
        } catch (error) {
          console.error('❌ Fehler beim Laden der Zuordnungen:', error);
        }
      }

      // Basis-Query mit Embeds
      let query = window.supabase
        .from('briefings')
        .select(`
          *,
          unternehmen:unternehmen_id(id, firmenname, logo_url),
          marke:marke_id(id, markenname, logo_url),
          kampagne:kampagne_id(id, kampagnenname, eigener_name),
          assignee:assignee_id(id, name, profile_image_url)
        `)
        .order('created_at', { ascending: false });

      // Für Mitarbeiter: Filtere nach zugewiesenen Kampagnen
      // Für Kunden: RLS-Policies filtern automatisch
      if (!isAdmin && window.currentUser?.rolle !== 'kunde') {
        const orParts = [`assignee_id.eq.${window.currentUser?.id}`];
        if (allowedKoopIds.length) orParts.push(`kooperation_id.in.(${allowedKoopIds.join(',')})`);
        if (allowedKampagneIds.length) orParts.push(`kampagne_id.in.(${allowedKampagneIds.join(',')})`);
        query = query.or(orParts.join(','));
      }

      // Filters anwenden (einfach, analog DataService.applyFilters)
      if (filters) {
        const apply = (field, val, type = 'string') => {
          if (val == null || val === '' || val === '[object Object]') return;
          const v = String(val);
          switch (type) {
            case 'uuid':
              query = query.eq(field, v);
              break;
            case 'dateRange':
              if (val.from) query = query.gte(field, val.from);
              if (val.to) query = query.lte(field, val.to);
              break;
            case 'stringIlike':
              query = query.ilike(field, `%${v}%`);
              break;
            default:
              query = query.eq(field, v);
          }
        };

        apply('unternehmen_id', filters.unternehmen_id, 'uuid');
        apply('marke_id', filters.marke_id, 'uuid');
        apply('assignee_id', filters.assignee_id, 'uuid');
        apply('status', filters.status);
        if (filters.product_service_offer) apply('product_service_offer', filters.product_service_offer, 'stringIlike');
        if (filters.deadline) apply('deadline', filters.deadline, 'dateRange');
        if (filters.created_at) apply('created_at', filters.created_at, 'dateRange');
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];

      // Fallback-Maps laden, wenn Embeds fehlen
      const needUnternehmen = rows.filter(r => !r.unternehmen && r.unternehmen_id).map(r => r.unternehmen_id);
      const needMarke = rows.filter(r => !r.marke && r.marke_id).map(r => r.marke_id);

      this._unternehmenMap = {};
      this._markeMap = {};
      try {
        if (needUnternehmen.length > 0) {
          const uniq = Array.from(new Set(needUnternehmen));
          const { data: unternehmen } = await window.supabase
            .from('unternehmen')
            .select('id, firmenname, logo_url')
            .in('id', uniq);
          (unternehmen || []).forEach(u => { this._unternehmenMap[u.id] = u; });
        }
        if (needMarke.length > 0) {
          const uniq = Array.from(new Set(needMarke));
          const { data: marken } = await window.supabase
            .from('marke')
            .select('id, markenname, logo_url')
            .in('id', uniq);
          (marken || []).forEach(m => { this._markeMap[m.id] = m; });
        }
      } catch (relErr) {
        console.warn('⚠️ Konnte Fallback-Relationen für Briefings nicht vollständig laden:', relErr);
      }

      return rows.map(b => ({
        ...b,
        unternehmen: b.unternehmen || (b.unternehmen_id ? this._unternehmenMap[b.unternehmen_id] : null) || null,
        marke: b.marke || (b.marke_id ? this._markeMap[b.marke_id] : null) || null,
        assignee: b.assignee ? { id: b.assignee.id, name: b.assignee.name } : null
      }));
    } catch (error) {
      console.error('❌ Fehler beim Laden der Briefings mit Beziehungen:', error);
      return await window.dataService.loadEntities('briefing', filters);
    }
  }

  async render() {
    const canEdit = window.currentUser?.permissions?.briefing?.can_edit || false;
    const isKunde = window.currentUser?.rolle === 'kunde';
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';

    const filterHtml = !isKunde ? `<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-dropdown-container"></div>
      </div>
      
    </div>` : '';

    const html = `
      ${!isKunde ? `<div class="table-filter-wrapper">
        ${filterHtml}
        <div class="table-actions">
          ${isAdmin ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>` : ''}
          ${window.currentUser?.permissions?.briefing?.can_edit ? '<button id="btn-briefing-new" class="primary-btn">Neues Briefing anlegen</button>' : ''}
        </div>
      </div>` : ''}

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${!isKunde && isAdmin ? `<th class="col-checkbox"><input type="checkbox" id="select-all-briefings"></th>` : ''}
              <th class="col-name">Produkt/Angebot</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Kampagne</th>
              <th>Zugewiesen</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody id="briefings-table-body">
            <tr>
              <td colspan="${!isKunde && isAdmin ? '7' : '6'}" class="loading">Lade Briefings...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      // Nutze das neue Filter-Dropdown System
      await filterDropdown.init('briefing', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  onFiltersApplied(filters) {
    console.log('🔍 BriefingList: Filter angewendet:', filters);
    filterSystem.applyFilters('briefing', filters);
    this.loadAndRender();
  }

  onFiltersReset() {
    console.log('🔄 BriefingList: Filter zurückgesetzt');
    filterSystem.resetFilters('briefing');
    this.loadAndRender();
  }

  bindEvents() {
    // Filter-Events werden vom FilterDropdown gehandelt

    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-briefing-new' || e.target.id === 'btn-briefing-new-filter') {
        e.preventDefault();
        window.navigateTo('/briefing/new');
      }
    });

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.briefing-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedBriefings.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-briefings');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = true;
        }
        this.updateSelection();
      }
    });

    // Auswahl aufheben Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-deselect-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.briefing-check');
        checkboxes.forEach(cb => { cb.checked = false; });
        this.selectedBriefings.clear();
        const selectAllHeader = document.getElementById('select-all-briefings');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = false;
        }
        this.updateSelection();
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'briefing') {
        e.preventDefault();
        const id = e.target.dataset.id;
        window.navigateTo(`/briefing/${id}`);
      }
    });

    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'briefing') {
        this.loadAndRender();
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-briefings') {
        const checkboxes = document.querySelectorAll('.briefing-check');
        const isChecked = e.target.checked;
        checkboxes.forEach(cb => {
          cb.checked = isChecked;
          if (isChecked) this.selectedBriefings.add(cb.dataset.id);
          else this.selectedBriefings.delete(cb.dataset.id);
        });
        this.updateSelection();
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('briefing-check')) {
        if (e.target.checked) this.selectedBriefings.add(e.target.dataset.id);
        else this.selectedBriefings.delete(e.target.dataset.id);
        this.updateSelection();
        this.updateSelectAllCheckbox();
      }
    });
  }

  hasActiveFilters() {
    const filters = filterSystem.getFilters('briefing');
    return Object.keys(filters).length > 0;
  }

  // Bestätigungsdialog für Bulk-Delete
  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedBriefings.size;
    if (selectedCount === 0) {
      alert('Keine Briefings ausgewählt.');
      return;
    }

    const message = selectedCount === 1 
      ? 'Möchten Sie das ausgewählte Briefing wirklich löschen?' 
      : `Möchten Sie die ${selectedCount} ausgewählten Briefings wirklich löschen?`;

    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({ title: 'Löschvorgang bestätigen', message, confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true });
      if (res?.confirmed) this.deleteSelectedBriefings();
    } else {
      const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
      if (confirmed) this.deleteSelectedBriefings();
    }
  }

  // Ausgewählte Briefings löschen
  async deleteSelectedBriefings() {
    if (window.currentUser?.rolle !== 'admin' && window.currentUser?.rolle?.toLowerCase() !== 'admin') return;
    
    const selectedIds = Array.from(this.selectedBriefings);
    const totalCount = selectedIds.length;
    
    console.log(`🗑️ Lösche ${totalCount} Briefings...`);
    
    // Optimistisches UI-Update: Zeilen ausblenden
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      // Batch-Delete für bessere Performance
      const result = await window.dataService.deleteEntities('briefing', selectedIds);
      
      if (result.success) {
        // Entferne Zeilen aus DOM
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} Briefings erfolgreich gelöscht.`);
        
        this.selectedBriefings.clear();
        this.updateSelection();
        this.updateSelectAllCheckbox();
        
        // Nur neu laden wenn Liste leer ist
        const tbody = document.getElementById('briefings-table-body');
        if (tbody && tbody.children.length === 0) {
          await this.loadAndRender();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'briefing', action: 'bulk-deleted', count: result.deletedCount }
        }));
      } else {
        throw new Error(result.error || 'Löschen fehlgeschlagen');
      }
    } catch (error) {
      // Bei Fehler: Zeilen wiederherstellen
      selectedIds.forEach(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) row.style.opacity = '1';
      });
      
      console.error('❌ Fehler beim Löschen:', error);
      alert(`❌ Fehler beim Löschen: ${error.message}`);
      
      // Liste neu laden um konsistenten Zustand herzustellen
      await this.loadAndRender();
    }
  }

  updateSelection() {
    const selectedCount = this.selectedBriefings.size;
    const selectedCountEl = document.getElementById('selected-count');
    const selectBtn = document.getElementById('btn-select-all');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    
    if (selectedCountEl) {
      selectedCountEl.textContent = `${selectedCount} ausgewählt`;
      selectedCountEl.style.display = selectedCount > 0 ? 'inline' : 'none';
    }
    if (selectBtn) selectBtn.style.display = selectedCount > 0 ? 'none' : 'inline-block';
    if (deselectBtn) deselectBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    if (deleteBtn) deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
  }

  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-briefings');
    const checkboxes = document.querySelectorAll('.briefing-check');
    
    if (!selectAllCheckbox || checkboxes.length === 0) return;
    
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const totalCount = checkboxes.length;
    
    selectAllCheckbox.checked = checkedCount === totalCount;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < totalCount;
  }

  // Render Unternehmen als Avatar Bubble
  renderUnternehmen(briefing) {
    const unternehmen = briefing.unternehmen || (briefing.unternehmen_id ? this._unternehmenMap?.[briefing.unternehmen_id] : null);
    if (!unternehmen || !unternehmen.firmenname) return '-';

    const items = [{
      name: unternehmen.firmenname,
      type: 'org',
      id: unternehmen.id,
      entityType: 'unternehmen',
      logo_url: unternehmen.logo_url || null
    }];

    return avatarBubbles.renderBubbles(items);
  }

  // Render Marke als Avatar Bubble
  renderMarke(briefing) {
    const marke = briefing.marke || (briefing.marke_id ? this._markeMap?.[briefing.marke_id] : null);
    if (!marke || !marke.markenname) return '-';

    const items = [{
      name: marke.markenname,
      type: 'org',
      id: marke.id,
      entityType: 'marke',
      logo_url: marke.logo_url || null
    }];

    return avatarBubbles.renderBubbles(items);
  }

  // Render Assignee (zugewiesener Mitarbeiter) als Avatar Bubble
  renderAssignee(assignee) {
    if (!assignee || !assignee.name) return '-';

    const items = [{
      name: assignee.name,
      type: 'person',
      id: assignee.id,
      entityType: 'mitarbeiter',
      profile_image_url: assignee.profile_image_url
    }];

    return avatarBubbles.renderBubbles(items);
  }



  async updateTable(items) {
    const tbody = document.getElementById('briefings-table-body');
    if (!tbody) return;

    const isKunde = window.currentUser?.rolle === 'kunde';
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    const escapeHtml = (s) => window.validatorSystem.sanitizeHtml(s || '—');

    await TableAnimationHelper.animatedUpdate(tbody, async () => {
      if (!items || items.length === 0) {
        const { renderEmptyState } = await import('../../core/FilterUI.js');
        renderEmptyState(tbody);
        return;
      }

      tbody.innerHTML = items.map(b => `
        <tr data-id="${b.id}">
          ${!isKunde && isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="briefing-check" data-id="${b.id}"></td>` : ''}
          <td class="col-name">
            <a href="#" class="table-link" data-table="briefing" data-id="${b.id}">
              ${escapeHtml((b.product_service_offer || '').toString().slice(0, 80))}
            </a>
          </td>
          <td>${this.renderUnternehmen(b)}</td>
          <td>${this.renderMarke(b)}</td>
          <td>
            ${b.kampagne?.id ? `<span class="tag tag--type">${escapeHtml(KampagneUtils.getDisplayName(b.kampagne))}</span>` : '-'}
          </td>
          <td>${this.renderAssignee(b.assignee)}</td>
          <td class="col-actions">
            ${actionBuilder.create('briefing', b.id)}
          </td>
        </tr>
      `).join('');
    });
  }

  // Optionales Formular (Platzhalter, bis echtes Formular existiert)
  showCreateForm() {
    window.setHeadline('Neues Briefing anlegen');
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Briefing', url: '/briefing', clickable: true },
        { label: 'Neues Briefing', url: '/briefing/new', clickable: false }
      ]);
    }

    const formHtml = window.formSystem.renderFormOnly('briefing');
    window.content.innerHTML = `
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden (Validierung, dynamische Optionen etc.)
    window.formSystem.bindFormEvents('briefing', null);

    // Custom Submit Handler mit File-Upload
    const form = document.getElementById('briefing-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleCreateFormSubmit(form);
      };
    }
  }

  async handleCreateFormSubmit(form) {
    try {
      const formData = new FormData(form);
      const submitData = {};
      
      // FormData zu Objekt konvertieren (ohne File-Felder)
      for (const [key, value] of formData.entries()) {
        if (!key.includes('[]') && !key.includes('_files')) {
          submitData[key] = value;
        }
      }

      console.log('📝 Briefing Submit-Daten:', submitData);

      // Briefing erstellen
      const result = await window.dataService.createEntity('briefing', submitData);
      
      if (result.success) {
        console.log('✅ Briefing erstellt, ID:', result.id);
        
        // Dokumente hochladen (Multi-Upload mit Security)
        await this.uploadBriefingDocuments(result.id, form);
        
        alert('Briefing erfolgreich erstellt!');
        
        // Event auslösen für Listen-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'briefing', action: 'created', id: result.id } 
        }));
        
        // Navigation zur Detail-Ansicht
        window.navigateTo(`/briefing/${result.id}`);
      } else {
        throw new Error(result.error || 'Erstellen fehlgeschlagen');
      }
    } catch (error) {
      console.error('❌ Fehler beim Erstellen:', error);
      alert(`Fehler beim Erstellen des Briefings: ${error.message}`);
    }
  }

  async uploadBriefingDocuments(briefingId, form) {
    try {
      const uploaderRoot = form.querySelector('.uploader[data-name="documents_files"]');
      if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
        console.log('ℹ️ Keine Dokumente zum Hochladen');
        return; // Keine Dateien
      }

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - Upload übersprungen');
        return;
      }

      const files = Array.from(uploaderRoot.__uploaderInstance.files);
      const bucket = 'documents';
      
      // Security: Max 10MB pro File (clientseitig pre-check)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      for (const file of files) {
        // Security Check: Dateigröße
        if (file.size > MAX_FILE_SIZE) {
          console.warn(`⚠️ Datei zu groß: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
          alert(`Die Datei "${file.name}" ist zu groß (max. 10 MB)`);
          continue;
        }

        // Security Check: Content-Type
        if (!ALLOWED_TYPES.includes(file.type)) {
          console.warn(`⚠️ Nicht erlaubter Dateityp: ${file.name} (${file.type})`);
          alert(`Die Datei "${file.name}" hat einen nicht erlaubten Dateityp`);
          continue;
        }

        // Security: Sanitize filename (remove path traversal, special chars)
        const sanitizedName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, '_') // Nur sichere Zeichen
          .replace(/\.{2,}/g, '_') // Keine ".." für path traversal
          .substring(0, 200); // Max 200 Zeichen

        // Pfad: documents/briefings/{briefing_id}/{timestamp}_{random}_{filename}
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 10);
        const path = `briefings/${briefingId}/${timestamp}_${randomStr}_${sanitizedName}`;
        
        console.log(`📤 Uploading: ${file.name} -> ${path}`);
        
        // Upload zu Storage
        const { error: upErr } = await window.supabase.storage
          .from(bucket)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
          });
        
        if (upErr) {
          console.error(`❌ Upload-Fehler für ${file.name}:`, upErr);
          throw upErr;
        }
        
        // Signierte URL erstellen (7 Tage gültig)
        const { data: signed, error: signErr } = await window.supabase.storage
          .from(bucket)
          .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 Tage
        
        if (signErr) {
          console.error(`❌ Signierte URL Fehler für ${file.name}:`, signErr);
          throw signErr;
        }
        
        const file_url = signed?.signedUrl || '';
        
        // Metadaten in briefing_documents speichern
        const { error: dbErr } = await window.supabase.from('briefing_documents').insert({
          briefing_id: briefingId,
          file_name: sanitizedName, // Sanitized name speichern
          file_path: path,
          file_url,
          content_type: file.type,
          size: file.size,
          uploaded_by: window.currentUser?.id || null
        });
        
        if (dbErr) {
          console.error(`❌ DB-Fehler für ${file.name}:`, dbErr);
          throw dbErr;
        }
        
        console.log(`✅ Dokument hochgeladen: ${file.name}`);
      }
      
      console.log(`✅ Alle ${files.length} Dokumente erfolgreich hochgeladen`);
    } catch (error) {
      console.error('❌ Fehler beim Dokument-Upload:', error);
      // Nicht kritisch - Briefing wurde bereits erstellt
      alert(`⚠️ Warnung: Einige Dokumente konnten nicht hochgeladen werden. Bitte versuchen Sie es später erneut.`);
    }
  }

  destroy() {
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
      this.boundFilterResetHandler = null;
    }
  }
}

export const briefingList = new BriefingList();


