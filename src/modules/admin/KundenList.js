// KundenList.js (ES6-Modul)
// Admin: Kunden verwalten (Übersicht)

import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';

export class KundenList {
  constructor() {
    this.rows = [];
    this.filteredRows = [];
    this.unternehmenMap = {};
    this.markenMap = {};
  }

  async init() {
    window.setHeadline('Kunden');
    
    // Breadcrumb für Kunden-Liste
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Kunden', url: '/admin/kunden', clickable: false }
      ]);
    }
    
    const isAdmin = window.currentUser?.rolle === 'admin' || window.canViewPage?.('mitarbeiter');
    if (!isAdmin) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Keine Berechtigung.</p>
        </div>
      `;
      return;
    }

    await this.load();
    await this.render();
    this.bind();
  }

  async load() {
    try {
      if (window.supabase) {
        const { data, error } = await window.supabase
          .from('benutzer')
          .select('id, name, rolle, unterrolle, freigeschaltet, auth_user_id')
          .in('rolle', ['kunde', 'kunde_editor'])
          .order('name', { ascending: true });
        
        if (error) throw error;
        
        this.rows = data || [];
        this.filteredRows = this.rows;

        // Relationen laden
        const ids = (this.rows || []).map(r => r.id).filter(Boolean);
        if (ids.length) {
          const [{ data: ulinks }, { data: mlinks }] = await Promise.all([
            window.supabase
              .from('kunde_unternehmen')
              .select('kunde_id, unternehmen:unternehmen_id(id, firmenname)')
              .in('kunde_id', ids),
            window.supabase
              .from('kunde_marke')
              .select('kunde_id, marke:marke_id(id, markenname)')
              .in('kunde_id', ids)
          ]);
          this.unternehmenMap = {};
          (ulinks || []).forEach(r => {
            if (!this.unternehmenMap[r.kunde_id]) this.unternehmenMap[r.kunde_id] = [];
            if (r.unternehmen) this.unternehmenMap[r.kunde_id].push(r.unternehmen);
          });
          this.markenMap = {};
          (mlinks || []).forEach(r => {
            if (!this.markenMap[r.kunde_id]) this.markenMap[r.kunde_id] = [];
            if (r.marke) this.markenMap[r.kunde_id].push(r.marke);
          });
        }
      } else {
        this.rows = await window.dataService.loadEntities('benutzer');
        this.rows = (this.rows || []).filter(u => ['kunde','kunde_editor'].includes((u.rolle||'').toLowerCase()));
        this.filteredRows = this.rows;
      }
    } catch (e) {
      console.error('❌ Fehler beim Laden der Kunden:', e);
      this.rows = [];
      this.filteredRows = [];
    }
  }

  async render() {
    const tbody = (this.filteredRows || []).map(u => {
      const freigeschaltetIcon = u.freigeschaltet ?
        '<span class="status-badge success">FREIGESCHALTET</span>' :
        '<span class="status-badge warning">WARTET</span>';
      const actionsMenu = this.renderActionsMenu(u);
      const uCount = (this.unternehmenMap[u.id] || []).length;
      const mCount = (this.markenMap[u.id] || []).length;
      const uBadges = uCount ? `<div class="tags tags-compact"><span class="tag">${uCount}</span></div>` : '—';
      const mBadges = mCount ? `<div class="tags tags-compact"><span class="tag">${mCount}</span></div>` : '—';
      return `
        <tr data-id="${u.id}">
          <td>${u.id ? `<a href="#" class="table-link" data-table="kunden" data-id="${u.id}">${window.validatorSystem.sanitizeHtml(u.name || '—')}</a>` : window.validatorSystem.sanitizeHtml(u.name || '—')}</td>
          <td>${window.validatorSystem.sanitizeHtml(u.auth_user_id ? 'Registriert' : '—')}</td>
          <td>${window.validatorSystem.sanitizeHtml(u.rolle || '—')}</td>
          <td>${window.validatorSystem.sanitizeHtml(u.unterrolle || '—')}</td>
          <td>${uBadges}</td>
          <td>${mBadges}</td>
          <td>${freigeschaltetIcon}</td>
          <td>${actionsMenu}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <div class="search-inline">
            <input id="kunden-search" class="form-input" type="text" placeholder="Suche nach Name/Rolle..." />
          </div>
          <button class="primary-btn" id="btn-kunde-anlegen" style="margin-left:8px;">Kunde anlegen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Rolle</th>
              <th>Unterrolle</th>
              <th>Unternehmen</th>
              <th>Marken</th>
              <th>Freigeschaltet</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${tbody || '<tr><td colspan="8" class="loading">Keine Kunden gefunden</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  renderActionsMenu(user) {
    return actionBuilder.create('kunde', user.id);
  }

  bind() {
    // Create button
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-kunde-anlegen') {
        e.preventDefault();
        window.navigateTo('/admin/kunden/new');
      }
    });
    // Suche
    document.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'kunden-search') {
        const q = (e.target.value || '').toLowerCase();
        if (!q) {
          this.filteredRows = this.rows;
        } else {
          this.filteredRows = (this.rows || []).filter(u => (
            (u.name||'').toLowerCase().includes(q) ||
            (u.rolle||'').toLowerCase().includes(q) ||
            (u.unterrolle||'').toLowerCase().includes(q)
          ));
        }
        this.render();
      }
    });
    document.addEventListener('click', (e) => {
      const link = e.target.closest('.table-link');
      if (link && link.dataset.table === 'kunden') {
        e.preventDefault();
        const id = link.dataset.id;
        window.navigateTo(`/kunden-admin/${id}`);
      }
    });

    document.addEventListener('click', async (e) => {
      if (e.target.closest('.submenu-item[data-action="set-role"]')) {
        e.preventDefault();
        const item = e.target.closest('.submenu-item[data-action="set-role"]');
        const userId = item.dataset.id;
        const role = item.dataset.role;
        try {
          await actionsDropdown.setField('benutzer', userId, 'rolle', role);
          await this.load();
          await this.render();
          this.bind();
          window.NotificationSystem?.show('success', `Rolle gesetzt: ${role}`);
        } catch (err) {
          console.error('❌ Rolle setzen fehlgeschlagen', err);
          window.NotificationSystem?.show('error', 'Rolle setzen fehlgeschlagen');
        }
      }

      // Zuordnungen
      if (e.target.closest('.submenu-item[data-action="assign-unternehmen"]')) {
        e.preventDefault();
        const id = e.target.closest('.submenu-item').dataset.id;
        await this.showUnternehmenZuordnungModal(id);
      }
      if (e.target.closest('.submenu-item[data-action="remove-unternehmen"]')) {
        e.preventDefault();
        const id = e.target.closest('.submenu-item').dataset.id;
        const unternehmenId = prompt('Unternehmen-ID zum Entfernen');
        if (!unternehmenId) return;
        try {
          const { error } = await window.supabase.from('kunde_unternehmen').delete().eq('kunde_id', id).eq('unternehmen_id', unternehmenId);
          if (error) throw error;
          await this.load();
          await this.render();
          this.bind();
          window.NotificationSystem?.show('success', 'Unternehmen entfernt');
        } catch (err) {
          console.error('❌ Entfernen fehlgeschlagen', err);
          window.NotificationSystem?.show('error', 'Entfernen fehlgeschlagen');
        }
      }
      if (e.target.closest('.submenu-item[data-action="assign-marke"]')) {
        e.preventDefault();
        const id = e.target.closest('.submenu-item').dataset.id;
        const markeId = prompt('Marken-ID eingeben');
        if (!markeId) return;
        try {
          const { error } = await window.supabase.from('kunde_marke').insert({ kunde_id: id, marke_id: markeId });
          if (error) throw error;
          await this.load();
          await this.render();
          this.bind();
          window.NotificationSystem?.show('success', 'Marke zugeordnet');
        } catch (err) {
          console.error('❌ Zuordnung fehlgeschlagen', err);
          window.NotificationSystem?.show('error', 'Zuordnung fehlgeschlagen');
        }
      }
      if (e.target.closest('.submenu-item[data-action="remove-marke"]')) {
        e.preventDefault();
        const id = e.target.closest('.submenu-item').dataset.id;
        const markeId = prompt('Marken-ID zum Entfernen');
        if (!markeId) return;
        try {
          const { error } = await window.supabase.from('kunde_marke').delete().eq('kunde_id', id).eq('marke_id', markeId);
          if (error) throw error;
          await this.load();
          await this.render();
          this.bind();
          window.NotificationSystem?.show('success', 'Marke entfernt');
        } catch (err) {
          console.error('❌ Entfernen fehlgeschlagen', err);
          window.NotificationSystem?.show('error', 'Entfernen fehlgeschlagen');
        }
      }
      if (e.target.closest('.action-item[data-action="invite"]')) {
        e.preventDefault();
        const item = e.target.closest('.action-item[data-action="invite"]');
        const userId = item.dataset.id;
        try {
          await window.notificationSystem?.sendCustomerInvite?.(userId);
          window.NotificationSystem?.show('success', 'Einladung gesendet');
        } catch (err) {
          console.error('❌ Einladung fehlgeschlagen', err);
          window.NotificationSystem?.show('error', 'Einladung fehlgeschlagen');
        }
      }

      if (e.target.closest('.action-item[data-action="freischalten"]')) {
        e.preventDefault();
        const item = e.target.closest('.action-item[data-action="freischalten"]');
        const userId = item.dataset.id;
        const currentStatus = item.dataset.currentStatus === 'true';
        try {
          await actionsDropdown.setField('benutzer', userId, 'freigeschaltet', !currentStatus);
          await this.load();
          await this.render();
          this.bind();
          window.NotificationSystem?.show('success', !currentStatus ? 'Kunde freigeschaltet' : 'Kunde gesperrt');
        } catch (err) {
          console.error('❌ Status-Update fehlgeschlagen', err);
          window.NotificationSystem?.show('error', 'Update fehlgeschlagen');
        }
      }

      if (e.target.closest('.action-item[data-action="view"]')) {
        e.preventDefault();
        const item = e.target.closest('.action-item[data-action="view"]');
        const id = item.dataset.id;
        window.navigateTo(`/kunden-admin/${id}`);
      }
    });
  }

  // Wizard zum Anlegen eines Kunden (Form-Page)
  async showCreateForm() {
    // Nur Admin
    const isAdmin = window.currentUser?.rolle === 'admin';
    if (!isAdmin) {
      window.content.innerHTML = '<div class="error-message"><p>Keine Berechtigung.</p></div>';
      return;
    }
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Kunden', url: '/admin/kunden', clickable: true },
        { label: 'Neuer Kunde', url: '/admin/kunden/new', clickable: false }
      ]);
    }

    const html = `
      <div class="content-section">
        <form id="kunden-create-form" class="form-grid">
          <div class="form-group">
            <label class="form-label" for="c-name">Name</label>
            <input class="form-input" id="c-name" type="text" placeholder="Max Mustermann" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="c-email">E-Mail</label>
            <input class="form-input" id="c-email" type="email" placeholder="kunde@example.com" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="c-rolle">Rolle</label>
            <select id="c-rolle" class="form-input">
              <option value="kunde" selected>Kunde</option>
              <option value="kunde_editor">Kunde (Editor)</option>
            </select>
          </div>

          <div class="form-group tag-based-select" style="grid-column: 1 / -1;">
            <label class="form-label">Unternehmen</label>
            <input type="text" id="as-unternehmen" class="form-input auto-suggest-input" placeholder="Unternehmen suchen..." />
            <div id="asdd-unternehmen" class="auto-suggest-dropdown"></div>
            <div id="tags-unternehmen" class="tags-container"></div>
          </div>

          <div class="form-group tag-based-select" style="grid-column: 1 / -1;">
            <label class="form-label">Marken (Multi-Select)</label>
            <input type="text" id="as-marke" class="form-input auto-suggest-input" placeholder="Marke suchen..." />
            <div id="asdd-marke" class="auto-suggest-dropdown"></div>
            <div id="tags-marke" class="tags-container"></div>
          </div>

          <div class="form-group tag-based-select" style="grid-column: 1 / -1;">
            <label class="form-label">Kampagnen (Multi-Select)</label>
            <input type="text" id="as-kampagne" class="form-input auto-suggest-input" placeholder="Kampagne suchen..." />
            <div id="asdd-kampagne" class="auto-suggest-dropdown"></div>
            <div id="tags-kampagne" class="tags-container"></div>
          </div>

          <div class="form-group tag-based-select" style="grid-column: 1 / -1;">
            <label class="form-label">Kooperationen (Multi-Select)</label>
            <input type="text" id="as-kooperation" class="form-input auto-suggest-input" placeholder="Kooperation suchen..." />
            <div id="asdd-kooperation" class="auto-suggest-dropdown"></div>
            <div id="tags-kooperation" class="tags-container"></div>
          </div>

          <div class="form-group" style="grid-column: 1 / -1; display:flex; gap:8px; align-items:center;">
            <button type="submit" class="primary-btn" id="btn-kunde-speichern">Kunde speichern</button>
            <button type="button" class="secondary-btn" id="btn-invite-copy">Einladungslink kopieren</button>
            <span class="muted" id="invite-hint">Kunde nicht vorhanden? Link kopieren und versenden.</span>
          </div>
        </form>

        <div id="kunden-create-msg" class="info-message" style="display:none; margin-top:12px;"></div>
      </div>
    `;

    window.setContentSafely(window.content, html);

    // Events
    document.getElementById('btn-kunden-zurueck')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.navigateTo('/admin/kunden');
    });

    document.getElementById('btn-invite-copy')?.addEventListener('click', (e) => {
      e.preventDefault();
      const name = document.getElementById('c-name').value.trim();
      const email = document.getElementById('c-email').value.trim();
      const url = `${window.location.origin}/src/auth/kunden-register.html?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;
      navigator.clipboard?.writeText(url).then(() => {
        window.NotificationSystem?.show('success', 'Einladungslink kopiert');
      }).catch(() => {
        window.NotificationSystem?.show('info', url);
      });
    });

    // Auto-Suggest State
    let selectedUnternehmenId = null;
    let selectedMarken = [];
    let selectedKampagnen = [];
    let selectedKoops = [];

    const addTag = (wrapId, id, label, onRemove) => {
      const wrap = document.getElementById(wrapId);
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = label;
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'tag-remove';
      close.innerHTML = '&times;';
      close.addEventListener('click', () => { onRemove(); tag.remove(); });
      tag.appendChild(close);
      wrap.appendChild(tag);
    };

    const bindAutoSuggest = (inputId, dropdownId, queryFn, onSelect, renderItem) => {
      const input = document.getElementById(inputId);
      const dd = document.getElementById(dropdownId);
      let debounce;
      const renderNo = (text) => { dd.innerHTML = `<div class="dropdown-item no-results">${text}</div>`; };
      // Beim Fokus ohne Tippen: dynamisch laden
      input.addEventListener('focus', async () => {
        try {
          const rows = await queryFn('');
          dd.innerHTML = rows && rows.length ? rows.map(r => renderItem(r)).join('') : '<div class="dropdown-item no-results">Keine Treffer</div>';
          dd.classList.add('show');
        } catch (err) {
          renderNo('Fehler bei der Suche');
          dd.classList.add('show');
        }
      });
      input.addEventListener('blur', () => { setTimeout(() => dd.classList.remove('show'), 150); });
      input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
          const q = input.value.trim();
          if (q.length < 1) {
            // bei leerer Eingabe trotzdem Vorschläge (Top gefiltert) laden
            try {
              const rows = await queryFn('');
              dd.innerHTML = rows && rows.length ? rows.map(r => renderItem(r)).join('') : '<div class="dropdown-item no-results">Keine Treffer</div>';
              dd.classList.add('show');
            } catch (err) {
              renderNo('Fehler bei der Suche');
              dd.classList.add('show');
            }
            return;
          }
          try {
            const rows = await queryFn(q);
            if (!rows || rows.length === 0) {
              renderNo('Keine Treffer');
              dd.classList.add('show');
              return;
            }
            dd.innerHTML = rows.map(r => renderItem(r)).join('');
            dd.classList.add('show');
          } catch (err) {
            console.warn('AutoSuggest query error', err);
            renderNo('Fehler bei der Suche');
            dd.classList.add('show');
          }
        }, 200);
      });
      dd.addEventListener('click', (e) => {
        const it = e.target.closest('.dropdown-item[data-id]');
        if (!it) return;
        const id = it.dataset.id;
        onSelect(id, it.dataset.label);
        dd.classList.remove('show');
        input.value = '';
      });
    };

    // Unternehmen (single)
    bindAutoSuggest('as-unternehmen', 'asdd-unternehmen', async (q) => {
      let query = window.supabase
        .from('unternehmen')
        .select('id, firmenname')
        .order('firmenname', { ascending: true })
        .limit(20);
      if (q && q.length > 0) query = query.ilike('firmenname', `%${q}%`);
      const { data } = await query;
      return data || [];
    }, (id, label) => {
      // Reset
      selectedUnternehmenId = id;
      document.getElementById('tags-unternehmen').innerHTML = '';
      addTag('tags-unternehmen', id, label, () => { selectedUnternehmenId = null; });
      // Kaskadierte Selektionen zurücksetzen
      document.getElementById('tags-marke').innerHTML = '';
      document.getElementById('tags-kampagne').innerHTML = '';
      document.getElementById('tags-kooperation').innerHTML = '';
      selectedMarken = [];
      selectedKampagnen = [];
      selectedKoops = [];
      // Vorschläge für nachgelagerte Felder aktualisieren
      document.getElementById('as-marke')?.dispatchEvent(new Event('focus'));
      document.getElementById('as-kampagne')?.dispatchEvent(new Event('focus'));
      document.getElementById('as-kooperation')?.dispatchEvent(new Event('focus'));
    }, (r) => `<div class="dropdown-item" data-id="${r.id}" data-label="${window.validatorSystem.sanitizeHtml(r.firmenname)}">${window.validatorSystem.sanitizeHtml(r.firmenname)}</div>`);

    // Marken (multi)
    bindAutoSuggest('as-marke', 'asdd-marke', async (q) => {
      let query = window.supabase
        .from('marke')
        .select('id, markenname, unternehmen_id')
        .order('markenname', { ascending: true })
        .limit(20);
      if (q && q.length > 0) query = query.ilike('markenname', `%${q}%`);
      if (selectedUnternehmenId) query = query.eq('unternehmen_id', selectedUnternehmenId);
      const { data } = await query;
      return (data || []).filter(r => !selectedMarken.includes(r.id));
    }, (id, label) => {
      if (!selectedMarken.includes(id)) {
        selectedMarken.push(id);
        addTag('tags-marke', id, label, () => {
          selectedMarken = selectedMarken.filter(x => x !== id);
        });
        // Reset nachgelagerte Ebenen
        document.getElementById('tags-kampagne').innerHTML = '';
        document.getElementById('tags-kooperation').innerHTML = '';
        selectedKampagnen = [];
        selectedKoops = [];
        document.getElementById('as-kampagne')?.dispatchEvent(new Event('focus'));
        document.getElementById('as-kooperation')?.dispatchEvent(new Event('focus'));
      }
    }, (r) => `<div class="dropdown-item" data-id="${r.id}" data-label="${window.validatorSystem.sanitizeHtml(r.markenname)}">${window.validatorSystem.sanitizeHtml(r.markenname)}</div>`);

    // Kampagnen (multi)
    bindAutoSuggest('as-kampagne', 'asdd-kampagne', async (q) => {
      let query = window.supabase
        .from('kampagne')
        .select('id, kampagnenname, marke_id, unternehmen_id')
        .order('created_at', { ascending: false })
        .limit(20);
      if (q && q.length > 0) query = query.ilike('kampagnenname', `%${q}%`);
      if (selectedMarken.length > 0) query = query.in('marke_id', selectedMarken);
      else if (selectedUnternehmenId) query = query.eq('unternehmen_id', selectedUnternehmenId);
      const { data } = await query;
      return (data || []).filter(r => !selectedKampagnen.includes(r.id));
    }, (id, label) => {
      if (!selectedKampagnen.includes(id)) {
        selectedKampagnen.push(id);
        addTag('tags-kampagne', id, label, () => {
          selectedKampagnen = selectedKampagnen.filter(x => x !== id);
        });
        // Reset koops
        document.getElementById('tags-kooperation').innerHTML = '';
        selectedKoops = [];
        document.getElementById('as-kooperation')?.dispatchEvent(new Event('focus'));
      }
    }, (r) => `<div class="dropdown-item" data-id="${r.id}" data-label="${window.validatorSystem.sanitizeHtml(r.kampagnenname)}">${window.validatorSystem.sanitizeHtml(r.kampagnenname)}</div>`);

    // Kooperationen (multi)
    bindAutoSuggest('as-kooperation', 'asdd-kooperation', async (q) => {
      let query = window.supabase
        .from('kooperationen')
        .select('id, name, kampagne_id, unternehmen_id')
        .order('created_at', { ascending: false })
        .limit(20);
      if (q && q.length > 0) query = query.ilike('name', `%${q}%`);
      if (selectedKampagnen.length > 0) query = query.in('kampagne_id', selectedKampagnen);
      else if (selectedMarken.length > 0) {
        // Filter über Kampagnen der Marken
        const { data: ks } = await window.supabase.from('kampagne').select('id').in('marke_id', selectedMarken);
        const ids = (ks || []).map(r => r.id);
        if (ids.length > 0) query = query.in('kampagne_id', ids);
      } else if (selectedUnternehmenId) {
        query = query.eq('unternehmen_id', selectedUnternehmenId);
      }
      const { data } = await query;
      return (data || []).filter(r => !selectedKoops.includes(r.id));
    }, (id, label) => {
      if (!selectedKoops.includes(id)) {
        selectedKoops.push(id);
        addTag('tags-kooperation', id, label, () => {
          selectedKoops = selectedKoops.filter(x => x !== id);
        });
      }
    }, (r) => `<div class=\"dropdown-item\" data-id=\"${r.id}\" data-label=\"${window.validatorSystem.sanitizeHtml(r.name)}\">${window.validatorSystem.sanitizeHtml(r.name)}</div>`);

    document.getElementById('kunden-create-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('c-name').value.trim();
      const email = document.getElementById('c-email').value.trim();
      const rolle = document.getElementById('c-rolle').value;
      const uSel = selectedUnternehmenId ? [selectedUnternehmenId] : [];
      const mSel = [...selectedMarken];
      const kSel = [...selectedKampagnen];
      const koopSel = [...selectedKoops];

      const msgBox = document.getElementById('kunden-create-msg');
      const showMsg = (type, text) => { msgBox.className = `${type === 'error' ? 'error-message' : 'success-message'}`; msgBox.textContent = text; msgBox.style.display = ''; };

      try {
        // Prüfe ob Benutzer existiert
        const { data: existing } = await window.supabase.from('benutzer').select('id, email').eq('email', email).maybeSingle?.() || {};
        const benutzerId = existing?.id || null;

        if (!benutzerId) {
          showMsg('info', 'Benutzer noch nicht vorhanden. Einladung senden und nach Registrierung erneut Zuordnungen speichern.');
          window.NotificationSystem?.show('info', 'Einladung erforderlich.');
          return;
        }

        // Update Stammdaten
        const { error: upErr } = await window.supabase.from('benutzer').update({ name, rolle }).eq('id', benutzerId);
        if (upErr) throw upErr;

        // Zuordnungen ableiten: Marken direkt + aus Kampagnen/Koops
        let markeFromK = [];
        if (kSel.length > 0) {
          const { data: ks } = await window.supabase.from('kampagne').select('id, marke_id').in('id', kSel);
          markeFromK = (ks || []).map(r => r.marke_id).filter(Boolean);
        }
        let markeFromKoop = [];
        if (koopSel.length > 0) {
          const { data: koops } = await window.supabase
            .from('kooperationen')
            .select('id, kampagne:kampagne_id(marke_id)')
            .in('id', koopSel);
          markeFromKoop = (koops || []).map(r => r.kampagne?.marke_id).filter(Boolean);
        }
        const allMarken = Array.from(new Set([...(mSel||[]), ...markeFromK, ...markeFromKoop]));

        // Zuordnungen upsert
        if (uSel.length) {
          const rows = uSel.map(id => ({ kunde_id: benutzerId, unternehmen_id: id }));
          await window.supabase.from('kunde_unternehmen').upsert(rows, { onConflict: 'kunde_id,unternehmen_id', ignoreDuplicates: true });
        }
        if (allMarken.length) {
          const rows = allMarken.map(id => ({ kunde_id: benutzerId, marke_id: id }));
          await window.supabase.from('kunde_marke').upsert(rows, { onConflict: 'kunde_id,marke_id', ignoreDuplicates: true });
        }

        showMsg('success', 'Kunde aktualisiert und Zuordnungen gespeichert.');
        window.NotificationSystem?.show('success', 'Gespeichert');
        
        // Event auslösen für Listen-Update statt Navigation
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'kunden', id: benutzerId, action: 'updated' } 
        }));
        
        // Optional: Zur Detail-Seite navigieren (nur wenn gewünscht)
        // setTimeout(() => window.navigateTo(`/kunden-admin/${benutzerId}`), 800);
      } catch (err) {
        console.error('❌ Speichern fehlgeschlagen', err);
        showMsg('error', err?.message || 'Speichern fehlgeschlagen');
      }
    });
  }

  // Modal für Unternehmen-Zuordnung mit Auto-Suggestion
  async showUnternehmenZuordnungModal(kundeId) {
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
            kunde_id: kundeId, 
            unternehmen_id: selectedUnternehmen.id 
          });

        if (error) throw error;

        window.NotificationSystem?.show('success', 'Unternehmen erfolgreich zugeordnet');
        modal.remove();
        
        // Liste aktualisieren
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

export const kundenList = new KundenList();
