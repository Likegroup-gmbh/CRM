// Eine Masterliste. Profilfelder sind live und nur lesbar.
// Eigene Spalten und die gezogene Reihenfolge gehoeren der Liste.

import { SearchInput } from '../../core/components/SearchInput.js';
import { renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { EntityCustomColumnsManager } from '../../core/customColumns/EntityCustomColumnsManager.js';
import {
  ANCHOR_COLUMNS,
  ANCHOR_LABELS,
  canManageMasterliste,
  compareMembers,
  escapeHtml,
  filterMembers,
  mapMember,
  resolveHidden,
  visibleColumns
} from './masterliste.js';
import { renderMasterlisteHead, renderMasterlisteRow } from './masterlisteTable.js';

const MEMBER_SELECT = `
  id, position, added_at,
  creator:creator_id (
    id, vorname, nachname, instagram, tiktok,
    instagram_follower, tiktok_follower,
    ig_engagement_rate, ig_engagement_rate_clean, ig_trial_gate,
    lieferadresse_stadt, lieferadresse_land,
    mail, telefonnummer,
    profilbild_thumb_url, profilbild_url,
    branchen:creator_branchen(branche:branche_id(name)),
    sprachen:creator_sprachen(sprache:sprache_id(name)),
    creator_types:creator_creator_type(creator_type:creator_type_id(name))
  )
`;

export class CreatorListDetail {
  constructor() {
    this.listId = null;
    this.list = null;
    this.members = [];
    this.searchQuery = '';
    this.hidden = resolveHidden(null);
    this._abortController = null;
    this._headerDragCleanup = null;
    this.customColumns = new EntityCustomColumnsManager({
      parentType: 'masterliste',
      parentTable: 'creator_list',
      anchorColumns: ANCHOR_COLUMNS,
      anchorLabels: ANCHOR_LABELS
    });
  }

  async init(id) {
    this.listId = id;
    this.searchQuery = '';
    await Promise.all([
      this.load(),
      this.customColumns.init(id)
    ]);
    await this.customColumns.loadValues(this.members.map(member => member.memberId).filter(Boolean));
    this.renderShell();
  }

  async load() {
    const [listResult, memberResult] = await Promise.all([
      window.supabase
        .from('creator_list')
        .select('id, name, beschreibung, created_at, hidden_columns')
        .eq('id', this.listId)
        .single(),
      window.supabase
        .from('creator_list_member')
        .select(MEMBER_SELECT)
        .eq('list_id', this.listId)
    ]);

    if (listResult.error) {
      console.error('Masterliste konnte nicht geladen werden:', listResult.error);
      this.list = { id: this.listId, name: 'Masterliste', beschreibung: '' };
      this.hidden = resolveHidden(null);
    } else {
      this.list = listResult.data;
      this.hidden = resolveHidden(listResult.data?.hidden_columns);
    }

    if (memberResult.error) {
      console.error('Creator der Masterliste konnten nicht geladen werden:', memberResult.error);
      this.members = [];
    } else {
      this.members = (memberResult.data || [])
        .filter(row => row.creator)
        .map(mapMember)
        .sort(compareMembers);
    }
  }

  renderShell() {
    this._abortController?.abort();
    this._headerDragCleanup?.();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;
    const name = this.list?.name || 'Masterliste';
    const canManage = canManageMasterliste();
    window.setHeadline?.(name);
    window.breadcrumbSystem?.updateDetailLabel?.(name);

    const beschreibung = this.list?.beschreibung
      ? `<p class="masterliste-beschreibung">${escapeHtml(this.list.beschreibung)}</p>`
      : '';

    window.setContentSafely(window.content, `
      <div class="list-container">
        <div class="table-filter-wrapper masterliste-kopf">
          <div class="filter-bar">
            <div class="filter-left">
              ${SearchInput.render('masterliste-member', {
                placeholder: 'Creator in dieser Liste suchen...',
                currentValue: this.searchQuery
              })}
            </div>
          </div>
          <div class="table-actions">
            ${canManage ? `
              <button type="button" class="mdc-btn mdc-btn--secondary" data-action="edit-masterliste">Bearbeiten</button>
              <button type="button" class="mdc-btn mdc-btn--secondary" data-action="masterliste-spalten">Tabelle anpassen</button>
              <button type="button" class="mdc-btn mdc-btn--secondary" data-action="masterliste-eigene-spalten">Eigene Spalten</button>
              <button type="button" class="mdc-btn" data-action="add-masterliste-member">Creator hinzufügen</button>
            ` : ''}
          </div>
          ${beschreibung}
        </div>
        <div class="table-container data-table-container">
          <table class="data-table" id="masterliste-table">
            <thead><tr id="masterliste-head"></tr></thead>
            <tbody id="masterliste-body"></tbody>
          </table>
        </div>
      </div>
    `);

    SearchInput.bind('masterliste-member', (value) => {
      this.searchQuery = value;
      this.renderTable();
    }, signal);
    this.bindEvents(signal);
    this.renderTable();
  }

  bindEvents(signal) {
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="add-masterliste-member"]')) {
        e.preventDefault();
        this.openAddDrawer();
        return;
      }
      if (e.target.closest('[data-action="edit-masterliste"]')) {
        e.preventDefault();
        this.openEditDrawer();
        return;
      }
      if (e.target.closest('[data-action="masterliste-spalten"]')) {
        e.preventDefault();
        this.openColumnsDrawer();
        return;
      }
      if (e.target.closest('[data-action="masterliste-eigene-spalten"]')) {
        e.preventDefault();
        this.customColumns.openManagementDrawer(() => this.renderTable());
        return;
      }
      const removeBtn = e.target.closest('[data-action="remove-masterliste-member"]');
      if (removeBtn) {
        e.preventDefault();
        this.removeMember(removeBtn.dataset.creatorId);
        return;
      }
      const link = e.target.closest('.table-link[data-table="creator"]');
      if (link) {
        e.preventDefault();
        window.navigateTo(`/creator/${link.dataset.id}`);
      }
    }, { signal });

    document.addEventListener('focusout', (e) => {
      const field = e.target;
      if (!field?.getAttribute || field.tagName === 'SELECT') return;
      if (!this.customColumns.isCustomField(field)) return;
      this.customColumns.handleFieldUpdate(field).catch(() => {
        window.toastSystem?.show('Speichern fehlgeschlagen.', 'error');
      });
    }, { signal });

    document.addEventListener('change', (e) => {
      const field = e.target;
      if (!this.customColumns.isCustomField(field)) return;
      this.customColumns.handleFieldUpdate(field).catch(() => {
        window.toastSystem?.show('Speichern fehlgeschlagen.', 'error');
      });
    }, { signal });
  }

  renderTable() {
    const head = document.getElementById('masterliste-head');
    const body = document.getElementById('masterliste-body');
    if (!head || !body) return;

    const canManage = canManageMasterliste();
    const columns = visibleColumns(this.hidden, { canManage });
    const visibleKeys = new Set(columns.map(col => col.key));
    const parkedAnchors = ANCHOR_COLUMNS.filter(key => !visibleKeys.has(key));

    const customAt = (anchor, kind, memberId) => {
      if (kind === 'header') return this.customColumns.renderHeadersAt(anchor, this.hidden, false);
      return this.customColumns.renderCellsAt(anchor, memberId, this.hidden, false, canManage);
    };
    const parkedHeader = parkedAnchors.map(key => customAt(key, 'header')).join('')
      + this.customColumns.renderHeaders(this.hidden, false);
    const parkedCells = (memberId) => parkedAnchors.map(key => customAt(key, 'cell', memberId)).join('')
      + this.customColumns.renderCells(memberId, this.hidden, false, canManage);

    const actionsIndex = columns.findIndex(col => col.key === 'ml-col-actions');
    const headHtml = renderMasterlisteHead(columns, customAt);
    head.innerHTML = actionsIndex === -1
      ? headHtml + parkedHeader
      : headHtml.replace(
        `<th class="ml-col-actions">Aktionen</th>`,
        `${parkedHeader}<th class="ml-col-actions">Aktionen</th>`
      );

    const members = filterMembers(this.members, this.searchQuery);
    const colspan = columns.length + this.customColumns.visibleCount(this.hidden, false);
    if (!members.length) {
      const searching = this.searchQuery.trim().length > 0;
      body.innerHTML = renderEmptyStateRow(searching ? {
        icon: 'search',
        title: 'Keine Treffer',
        text: 'Kein Creator in dieser Masterliste entspricht der Suche.'
      } : {
        icon: 'creator',
        title: 'Noch keine Creator',
        text: 'Fügen Sie Creator aus den Stammdaten hinzu.',
        actionsHtml: canManage
          ? '<button type="button" class="mdc-btn" data-action="add-masterliste-member">Creator hinzufügen</button>'
          : ''
      }, Math.max(colspan, 1));
      return;
    }

    body.innerHTML = members.map(member => {
      const row = renderMasterlisteRow(member, columns, this.listId, customAt);
      if (actionsIndex === -1) return row.replace('</tr>', `${parkedCells(member.memberId)}</tr>`);
      return row.replace(
        `<td class="col-actions ml-col-actions">`,
        `${parkedCells(member.memberId)}<td class="col-actions ml-col-actions">`
      );
    }).join('');

    window.ActionsDropdown?.init?.();
    this._headerDragCleanup?.();
    const table = document.getElementById('masterliste-table');
    this._headerDragCleanup = this.customColumns.bindHeaderDragAndDrop(table, () => this.renderTable());
    if (canManage && !this.searchQuery.trim()) this.bindRowDrag();
  }

  bindRowDrag() {
    const tbody = document.getElementById('masterliste-body');
    if (!tbody) return;
    const signal = this._abortController?.signal;
    let dragged = null;

    tbody.querySelectorAll('tr[data-member-id]').forEach(row => {
      const handle = row.querySelector('.drag-handle');
      if (!handle) return;
      handle.addEventListener('mousedown', () => row.setAttribute('draggable', 'true'), { signal });
      row.addEventListener('dragstart', (event) => {
        dragged = row;
        row.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
      }, { signal });
      row.addEventListener('dragend', () => {
        row.classList.remove('is-dragging');
        row.setAttribute('draggable', 'false');
        dragged = null;
      }, { signal });
      row.addEventListener('dragover', (event) => {
        if (!dragged || dragged === row) return;
        event.preventDefault();
        const rect = row.getBoundingClientRect();
        const after = event.clientY > rect.top + rect.height / 2;
        tbody.insertBefore(dragged, after ? row.nextSibling : row);
      }, { signal });
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        this.persistOrder();
      }, { signal });
    });
  }

  async persistOrder() {
    const tbody = document.getElementById('masterliste-body');
    if (!tbody) return;
    const ids = [...tbody.querySelectorAll('tr[data-member-id]')].map(row => row.dataset.memberId);
    const byId = new Map(this.members.map(member => [member.memberId, member]));
    this.members = ids.map((id, index) => {
      const member = byId.get(id);
      if (member) member.position = index;
      return member;
    }).filter(Boolean);

    const results = await Promise.all(ids.map((id, index) =>
      window.supabase.from('creator_list_member').update({ position: index }).eq('id', id)
    ));
    if (results.some(result => result.error)) {
      window.toastSystem?.show('Reihenfolge konnte nicht gespeichert werden.', 'error');
    }
  }

  openColumnsDrawer() {
    if (!canManageMasterliste()) return;
    this.closeDrawers(true);
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'masterliste-columns-overlay';
    const panel = document.createElement('div');
    panel.className = 'drawer-panel';
    panel.id = 'masterliste-columns-drawer';
    panel.setAttribute('role', 'dialog');

    const toggles = [
      ...ANCHOR_COLUMNS.map(key => ({ key, label: ANCHOR_LABELS[key] })),
      ...this.customColumns.getOrderedColumns().map(col => ({
        key: `custom:${col.id}`,
        label: col.name
      }))
    ];
    const rows = toggles.map(item => `
      <div class="sourcing-spalten-item">
        <span aria-hidden="true"></span>
        <span class="sourcing-spalten-name">${escapeHtml(item.label)}</span>
        <label class="toggle-switch">
          <input type="checkbox" class="column-visibility-toggle" data-column="${escapeHtml(item.key)}" ${this.hidden.includes(item.key) ? '' : 'checked'}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join('');
    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Tabelle anpassen</span>
          <p class="drawer-subtitle">Sichtbarkeit der Spalten, nur für diese Masterliste</p>
        </div>
        <div><button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button></div>
      </div>
      <div class="drawer-body">
        <h4 class="drawer-section-title">Spalten</h4>
        <div class="sourcing-spalten-kopf">
          <span class="sourcing-spalten-kopf-griff" aria-hidden="true"></span>
          <span>Spalte</span>
          <span class="sourcing-spalten-kopf-sichtbar">Sichtbar</span>
        </div>
        <div class="sourcing-spalten-liste">${rows}</div>
        <p class="drawer-info-text">„Name“ und „Aktionen“ bleiben fest und können nicht ausgeblendet werden.</p>
        <div class="drawer-footer">
          <button type="button" class="mdc-btn" data-action="close-masterliste-columns">Fertig</button>
        </div>
      </div>
    `;
    const close = () => this.closeDrawers();
    overlay.addEventListener('click', close);
    panel.querySelector('.drawer-close-btn').addEventListener('click', close);
    panel.querySelector('[data-action="close-masterliste-columns"]').addEventListener('click', close);
    panel.querySelectorAll('.column-visibility-toggle').forEach(toggle => {
      toggle.addEventListener('change', () => {
        const shown = new Set([...panel.querySelectorAll('.column-visibility-toggle:checked')].map(input => input.dataset.column));
        const hidden = toggles.map(item => item.key).filter(key => !shown.has(key));
        this.saveHidden(hidden, { close: false });
      });
    });
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));
  }

  async saveHidden(hidden, { close = true } = {}) {
    const { error } = await window.supabase
      .from('creator_list')
      .update({ hidden_columns: hidden })
      .eq('id', this.listId);
    if (error) {
      window.toastSystem?.show('Spalten konnten nicht gespeichert werden.', 'error');
      return;
    }
    this.hidden = hidden;
    this.list.hidden_columns = hidden;
    if (close) this.closeDrawers();
    this.renderTable();
  }

  openEditDrawer() {
    if (!canManageMasterliste()) return;
    this.closeDrawers(true);
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'masterliste-edit-overlay';
    const panel = document.createElement('div');
    panel.className = 'drawer-panel';
    panel.id = 'masterliste-edit-drawer';
    panel.setAttribute('role', 'dialog');
    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Masterliste bearbeiten</span>
          <p class="drawer-subtitle">Name und Beschreibung</p>
        </div>
        <div><button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button></div>
      </div>
      <div class="drawer-body">
        <form id="masterliste-edit-form">
          <div class="form-group">
            <label class="form-label" for="masterliste-edit-name">Name</label>
            <input type="text" id="masterliste-edit-name" class="form-input" value="${escapeHtml(this.list?.name || '')}" required maxlength="120">
          </div>
          <div class="form-group">
            <label class="form-label" for="masterliste-edit-beschreibung">Beschreibung</label>
            <textarea id="masterliste-edit-beschreibung" class="form-input" rows="3" maxlength="500">${escapeHtml(this.list?.beschreibung || '')}</textarea>
          </div>
          <div class="drawer-footer u-mt-lg">
            <button type="submit" class="mdc-btn">Speichern</button>
            <button type="button" class="mdc-btn mdc-btn--secondary" data-action="close-masterliste-edit">Abbrechen</button>
          </div>
        </form>
      </div>
    `;
    const close = () => this.closeDrawers();
    overlay.addEventListener('click', close);
    panel.querySelector('.drawer-close-btn').addEventListener('click', close);
    panel.querySelector('[data-action="close-masterliste-edit"]').addEventListener('click', close);
    panel.querySelector('#masterliste-edit-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = panel.querySelector('#masterliste-edit-name').value.trim();
      const beschreibung = panel.querySelector('#masterliste-edit-beschreibung').value.trim();
      if (!name) {
        window.toastSystem?.show('Name darf nicht leer sein.', 'warning');
        return;
      }
      this.saveList(name, beschreibung);
    });
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));
    panel.querySelector('#masterliste-edit-name')?.focus();
  }

  async saveList(name, beschreibung) {
    const { error } = await window.supabase
      .from('creator_list')
      .update({ name, beschreibung: beschreibung || null })
      .eq('id', this.listId);
    if (error) {
      window.toastSystem?.show('Speichern fehlgeschlagen.', 'error');
      return;
    }
    this.list = { ...this.list, name, beschreibung };
    window.toastSystem?.show('Masterliste gespeichert.', 'success');
    this.closeDrawers();
    this.renderShell();
  }

  openAddDrawer() {
    if (!canManageMasterliste()) return;
    this.closeDrawers(true);
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'masterliste-add-overlay';
    const panel = document.createElement('div');
    panel.className = 'drawer-panel';
    panel.id = 'masterliste-add-drawer';
    panel.setAttribute('role', 'dialog');
    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Creator hinzufügen</span>
          <p class="drawer-subtitle">Bestehenden Creator aus den Stammdaten auf diese Masterliste setzen</p>
        </div>
        <div><button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button></div>
      </div>
      <div class="drawer-body">
        <form id="masterliste-add-form">
          <div class="form-field">
            <label class="form-label" for="masterliste-creator-select">Creator suchen</label>
            <select id="masterliste-creator-select" name="creator_id" class="form-input">
              <option value="">Name, Instagram oder TikTok eingeben...</option>
            </select>
          </div>
          <div class="drawer-footer u-mt-lg">
            <button type="submit" class="mdc-btn" id="masterliste-add-confirm" disabled>Hinzufügen</button>
            <button type="button" class="mdc-btn mdc-btn--secondary" data-action="close-masterliste-add">Abbrechen</button>
          </div>
        </form>
      </div>
    `;
    const close = () => this.closeDrawers();
    overlay.addEventListener('click', close);
    panel.querySelector('.drawer-close-btn').addEventListener('click', close);
    panel.querySelector('[data-action="close-masterliste-add"]').addEventListener('click', close);
    const select = panel.querySelector('#masterliste-creator-select');
    const confirm = panel.querySelector('#masterliste-add-confirm');
    select.addEventListener('change', () => { confirm.disabled = !select.value; });
    panel.querySelector('#masterliste-add-form').addEventListener('submit', (event) => {
      event.preventDefault();
      if (select.value) this.addMember(select.value);
    });
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));
    this.bindCreatorSearch(select);
  }

  bindCreatorSearch(select) {
    if (!window.formSystem?.createSimpleSearchableSelect) return;
    const excluded = new Set(this.members.map(member => member.creator?.id).filter(Boolean));
    const loadCreators = async (query) => {
      try {
        let request = window.supabase.from('creator').select('id, vorname, nachname, instagram, tiktok').limit(20);
        const term = String(query || '').trim().replace(/[,()]/g, '');
        if (term) {
          request = request.or(`vorname.ilike.%${term}%,nachname.ilike.%${term}%,instagram.ilike.%${term}%,tiktok.ilike.%${term}%`);
        }
        const { data, error } = await request;
        if (error) throw error;
        return (data || [])
          .filter(creator => !excluded.has(creator.id))
          .map(creator => {
            const name = [creator.vorname, creator.nachname].filter(Boolean).join(' ').trim() || 'Unbekannt';
            const socials = [creator.instagram, creator.tiktok].filter(Boolean).join(', ');
            return { value: creator.id, label: socials ? `${name} — ${socials}` : name };
          });
      } catch (error) {
        console.error('Creator-Suche fehlgeschlagen:', error);
        return [];
      }
    };
    window.formSystem.createSimpleSearchableSelect(select, [], {
      placeholder: 'Name, Instagram oder TikTok eingeben...',
      serverSearch: loadCreators
    });
  }

  async addMember(creatorId) {
    const next = this.members.reduce((max, member) => Math.max(max, member.position ?? -1), -1) + 1;
    const { error } = await window.supabase.from('creator_list_member').insert({
      list_id: this.listId,
      creator_id: creatorId,
      added_at: new Date().toISOString(),
      position: next
    });
    if (error) {
      const schonDabei = error.code === '23505';
      window.toastSystem?.show(
        schonDabei ? 'Creator ist schon auf dieser Masterliste.' : 'Hinzufügen fehlgeschlagen.',
        schonDabei ? 'warning' : 'error'
      );
      return;
    }
    window.toastSystem?.show('Creator hinzugefügt.', 'success');
    this.closeDrawers();
    await this.load();
    await this.customColumns.loadValues(this.members.map(member => member.memberId).filter(Boolean));
    this.renderShell();
  }

  async removeMember(creatorId) {
    const member = this.members.find(item => item.creator?.id === creatorId);
    let confirmed = false;
    if (window.confirmationModal) {
      const result = await window.confirmationModal.open({
        title: 'Creator entfernen',
        message: `${escapeHtml(member?.creator?.name || 'Dieser Creator')} wird nur von dieser Masterliste genommen.`,
        confirmText: 'Entfernen',
        cancelText: 'Abbrechen',
        danger: true
      });
      confirmed = result?.confirmed;
    } else {
      confirmed = confirm('Creator von dieser Masterliste nehmen?');
    }
    if (!confirmed) return;
    const { error } = await window.supabase
      .from('creator_list_member')
      .delete()
      .eq('list_id', this.listId)
      .eq('creator_id', creatorId);
    if (error) {
      window.toastSystem?.show('Entfernen fehlgeschlagen.', 'error');
      return;
    }
    this.members = this.members.filter(item => item.creator?.id !== creatorId);
    window.toastSystem?.show('Creator von der Masterliste genommen.', 'success');
    this.renderTable();
  }

  closeDrawers(immediate = false) {
    ['masterliste-edit', 'masterliste-add', 'masterliste-columns'].forEach((id) => {
      const overlay = document.getElementById(`${id}-overlay`);
      const panel = document.getElementById(`${id}-drawer`);
      if (!panel) {
        overlay?.remove();
        return;
      }
      if (immediate) {
        overlay?.remove();
        panel.remove();
        return;
      }
      panel.classList.remove('show');
      setTimeout(() => {
        overlay?.remove();
        panel.remove();
      }, 300);
    });
  }

  destroy() {
    this._abortController?.abort();
    this._abortController = null;
    this._headerDragCleanup?.();
    this._headerDragCleanup = null;
    this.closeDrawers(true);
    this.members = [];
    this.list = null;
  }
}

export const creatorListDetail = new CreatorListDetail();
