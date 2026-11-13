// Eine Masterliste. Profilfelder sind live und nur lesbar.
// Eigene Spalten und die gezogene Reihenfolge gehoeren der Liste.

import { SearchInput } from '../../core/components/SearchInput.js';
import { renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { EntityCustomColumnsManager } from '../../core/customColumns/EntityCustomColumnsManager.js';
import { CreatorFormDrawer } from './CreatorFormDrawer.js';
import { MasterlisteAddDrawer } from './masterlisteAddDrawer.js';
import { SelectionBar } from '../../core/list/SelectionBar.js';
import { CREATOR_TYP_OPTIONS } from '../creator-auswahl/creatorTypeOptions.js';
import { creatorAuswahlService } from '../creator-auswahl/CreatorAuswahlService.js';
import { ladeCreatorFuerHandles } from '../creator-auswahl/castingCreatorVerknuepfung.js';
import { normalizedInstagramUrl } from '../creator-auswahl/instagramDrawerFill.js';
import { connectInstagramSilent } from '../../core/ActionsDropdownEffects.js';
import {
  ANCHOR_COLUMNS,
  ANCHOR_LABELS,
  canManageMasterliste,
  compareMembers,
  eintragAusFormular,
  escapeHtml,
  filterMembers,
  leseMasterlisteLinks,
  mapMember,
  prefillOhneDatensatz,
  quickAddText,
  resolveHidden,
  teileHandlesAuf,
  verknuepfbareMember,
  visibleColumns
} from './masterliste.js';
import { renderMasterlisteHead, renderMasterlisteRow } from './masterlisteTable.js';

const MEMBER_SELECT = `
  id, position, added_at, ig_username, sourcing_creator_id,
  name, typ, follower_instagram, link_tiktok, follower_tiktok, wohnort, email, telefon,
  pool:sourcing_creator_id (
    name, link_instagram, follower_instagram,
    profile_image_url, profile_image_thumb_url,
    email, telefon, wohnort, ig_stats
  ),
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
    this._igWarteschlange = Promise.resolve();
    this.addDrawer = new MasterlisteAddDrawer(this);
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
    const [listResult, members] = await Promise.all([
      window.supabase
        .from('creator_list')
        .select('id, name, beschreibung, created_at, hidden_columns')
        .eq('id', this.listId)
        .single(),
      this.fetchMembers()
    ]);

    if (listResult.error) {
      console.error('Masterliste konnte nicht geladen werden:', listResult.error);
      this.list = { id: this.listId, name: 'Masterliste', beschreibung: '' };
      this.hidden = resolveHidden(null);
    } else {
      this.list = listResult.data;
      this.hidden = resolveHidden(listResult.data?.hidden_columns);
    }

    this.members = members;
    if (await this.verknuepfeOffene()) this.members = await this.fetchMembers();
  }

  async fetchMembers() {
    const { data, error } = await window.supabase
      .from('creator_list_member')
      .select(MEMBER_SELECT)
      .eq('list_id', this.listId);
    if (error) {
      console.error('Creator der Masterliste konnten nicht geladen werden:', error);
      return [];
    }
    return (data || []).map(mapMember).sort(compareMembers);
  }

  async refreshMembers() {
    this.members = await this.fetchMembers();
    await this.customColumns.loadValues(this.members.map(member => member.memberId).filter(Boolean));
    this.renderTable();
  }

  /** Eintraege ohne Creator mit dem CRM-Creator verknuepfen, dem der Handle eindeutig gehoert. */
  async verknuepfeOffene() {
    if (!canManageMasterliste()) return false;
    const offen = this.members.filter(member => !member.hatDatensatz && member.igUsername);
    if (!offen.length) return false;
    try {
      const creators = await ladeCreatorFuerHandles(offen.map(member => member.igUsername));
      const links = verknuepfbareMember(this.members, creators);
      const results = await Promise.all(links.map(link =>
        window.supabase.from('creator_list_member').update({ creator_id: link.creatorId }).eq('id', link.memberId)
      ));
      return results.some(result => !result.error);
    } catch (error) {
      console.warn('Masterliste: Verknüpfung mit Stammdaten fehlgeschlagen', error);
      return false;
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
    this.mountLinkBar();
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
        this.removeMember(removeBtn.dataset.memberId);
        return;
      }
      const anlegenBtn = e.target.closest('[data-action="masterliste-creator-anlegen"]');
      if (anlegenBtn) {
        e.preventDefault();
        this.openCreatorAnlegen(anlegenBtn.dataset.memberId);
        return;
      }
      const ladenBtn = e.target.closest('[data-action="masterliste-instagram-laden"]');
      if (ladenBtn) {
        e.preventDefault();
        this.instagramNeuLaden(ladenBtn.dataset.memberId);
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
        text: 'Fügen Sie Creator per Instagram-Link oder aus den Stammdaten hinzu.',
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

  openAddDrawer(mode = 'new') {
    if (!canManageMasterliste()) return;
    this.closeDrawers(true);
    this.addDrawer.open(mode);
  }

  nextPosition() {
    return this.members.reduce((max, member) => Math.max(max, member.position ?? -1), -1) + 1;
  }

  /** true, wenn der Creator auf der Liste steht und der Drawer zu ist. */
  async addMember(creatorId) {
    const { error } = await window.supabase.from('creator_list_member').insert({
      list_id: this.listId,
      creator_id: creatorId,
      added_at: new Date().toISOString(),
      position: this.nextPosition()
    });
    if (error) {
      const schonDabei = error.code === '23505';
      window.toastSystem?.show(
        schonDabei ? 'Creator ist schon auf dieser Masterliste.' : 'Hinzufügen fehlgeschlagen.',
        schonDabei ? 'warning' : 'error'
      );
      return false;
    }
    window.toastSystem?.show('Creator hinzugefügt.', 'success');
    this.closeDrawers();
    await this.load();
    await this.customColumns.loadValues(this.members.map(member => member.memberId).filter(Boolean));
    this.renderShell();
    return true;
  }

  /**
   * Ein oder mehrere Instagram-Links auf die Liste setzen. true, wenn Zeilen
   * angelegt wurden und der Drawer zu ist; der Instagram-Abruf laeuft danach weiter.
   */
  async addLinks(raw) {
    if (!canManageMasterliste() || this._addLinksBusy) return false;
    const { handles, ungueltig } = leseMasterlisteLinks(raw);
    if (!handles.length) {
      window.toastSystem?.show('Bitte Instagram-Profil-Links einfügen (kein Reel oder Post)', 'info');
      return false;
    }

    this._addLinksBusy = true;
    try {
      const creators = await ladeCreatorFuerHandles(handles);
      const { schonDabei, crmTreffer, neu } = teileHandlesAuf(handles, this.members, creators);
      const addedAt = new Date().toISOString();
      let position = this.nextPosition();
      const rows = [
        ...crmTreffer.map(({ creator }) => ({ list_id: this.listId, creator_id: creator.id, added_at: addedAt, position: position++ })),
        ...neu.map(handle => ({ list_id: this.listId, ig_username: handle, added_at: addedAt, position: position++ }))
      ];

      const text = quickAddText({
        hinzugefuegt: rows.length,
        verknuepft: crmTreffer.length,
        schonDabei: schonDabei.length,
        ungueltig: ungueltig.length
      });
      if (!rows.length) {
        window.toastSystem?.show(text, 'info');
        return false;
      }

      const { data, error } = await window.supabase
        .from('creator_list_member')
        .insert(rows)
        .select('id, ig_username, creator_id');
      if (error) throw error;
      window.toastSystem?.show(text, 'success');
      this.closeDrawers();
      await this.refreshMembers();

      const offen = (data || []).filter(entry => !entry.creator_id && entry.ig_username);
      this._igWarteschlange = this._igWarteschlange
        .then(() => this.ladeInstagramFuer(offen))
        .catch(error => console.warn('Masterliste: Instagram-Abruf abgebrochen', error));
      return true;
    } catch (error) {
      console.error('Masterliste: Hinzufügen per Link fehlgeschlagen', error);
      window.toastSystem?.show(
        error?.code === '23505' ? 'Creator ist schon auf dieser Masterliste.' : 'Hinzufügen fehlgeschlagen.',
        error?.code === '23505' ? 'warning' : 'error'
      );
      return false;
    } finally {
      this._addLinksBusy = false;
    }
  }

  /**
   * Tab "Neuer Creator": Eintrag mit eigenen Werten. Mit Instagram-Link haengt er
   * am Handle (oder am Creator, dem der Handle gehoert), ohne Link nur an den Werten.
   */
  async addEintrag(values) {
    if (!canManageMasterliste() || this._addLinksBusy) return false;
    const ergebnis = eintragAusFormular(values, { erlaubteTypen: CREATOR_TYP_OPTIONS });
    if (ergebnis.fehler) {
      window.toastSystem?.show(ergebnis.fehler, 'error');
      return false;
    }

    this._addLinksBusy = true;
    try {
      const basis = { list_id: this.listId, added_at: new Date().toISOString(), position: this.nextPosition() };
      let row = { ...basis, ...ergebnis.werte };
      let meldung = 'Creator hinzugefügt.';
      if (ergebnis.handle) {
        const creators = await ladeCreatorFuerHandles([ergebnis.handle]);
        const { schonDabei, crmTreffer } = teileHandlesAuf([ergebnis.handle], this.members, creators);
        if (schonDabei.length) {
          window.toastSystem?.show('Dieser Creator steht schon auf der Liste', 'info');
          return false;
        }
        if (crmTreffer.length) {
          row = { ...basis, creator_id: crmTreffer[0].creator.id };
          meldung = 'Creator aus den Stammdaten verknüpft.';
        } else {
          row.ig_username = ergebnis.handle;
        }
      }

      const { data, error } = await window.supabase
        .from('creator_list_member')
        .insert(row)
        .select('id, ig_username, creator_id')
        .single();
      if (error) throw error;
      window.toastSystem?.show(meldung, 'success');
      this.closeDrawers();
      await this.refreshMembers();

      if (data && !data.creator_id && data.ig_username) {
        this._igWarteschlange = this._igWarteschlange
          .then(() => this.ladeInstagramFuer([data]))
          .catch(error => console.warn('Masterliste: Instagram-Abruf abgebrochen', error));
      }
      return true;
    } catch (error) {
      console.error('Masterliste: Neuer Creator fehlgeschlagen', error);
      window.toastSystem?.show(
        error?.code === '23505' ? 'Creator ist schon auf dieser Masterliste.' : 'Hinzufügen fehlgeschlagen.',
        error?.code === '23505' ? 'warning' : 'error'
      );
      return false;
    } finally {
      this._addLinksBusy = false;
    }
  }

  /** Leiste unten wie im Casting: Link(s) einfügen oder aus der Datenbank wählen. */
  mountLinkBar() {
    this.linkBar?.destroy();
    this.linkBar = null;
    if (!canManageMasterliste()) return;
    this.linkBar = new SelectionBar({
      id: 'masterliste-link-bar',
      onAction: (name, event) => {
        if (name === 'masterliste-links') this.submitLinkBar(event.target.elements?.links);
        else if (name === 'masterliste-aus-db') this.openAddDrawer('database');
      }
    });
    this.linkBar.mount('', {
      idleHtml: `
        <form data-selection-form="masterliste-links" autocomplete="off" novalidate>
          <input id="masterliste-link-input" name="links" type="text" class="form-input"
                 placeholder="Instagram-Link(s) einfügen" aria-label="Instagram-Link(s) einfügen">
          <button type="submit" class="mdc-btn mdc-btn--sm">Hinzufügen</button>
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-selection-action="masterliste-aus-db">Aus Datenbank</button>
        </form>
      `
    });
  }

  async submitLinkBar(input) {
    if (!input || input.disabled) return;
    input.disabled = true;
    try {
      if (await this.addLinks(input.value)) input.value = '';
    } finally {
      input.disabled = false;
      if (input.isConnected) input.focus();
    }
  }

  /** Nacheinander wegen des Meta-Limits; ein Fehler stoppt die uebrigen Abrufe nicht. */
  async ladeInstagramFuer(rows) {
    let fehlgeschlagen = 0;
    for (const row of rows) {
      if (!await this.ladeInstagram(row.id, row.ig_username)) fehlgeschlagen += 1;
      await this.refreshMembers();
    }
    if (fehlgeschlagen) {
      window.toastSystem?.show(
        fehlgeschlagen === 1
          ? 'Instagram konnte für einen Eintrag nicht geladen werden'
          : `Instagram konnte für ${fehlgeschlagen} Einträge nicht geladen werden`,
        'warning'
      );
    }
  }

  /** Instagram-Abruf ueber den Creator-Pool. true, wenn der Eintrag danach am Pool haengt. */
  async ladeInstagram(memberId, handle) {
    try {
      const result = await creatorAuswahlService.previewInstagramStats(normalizedInstagramUrl(handle));
      const poolId = result?.fields?.sourcing_creator_id;
      if (!poolId) return false;
      const { error } = await window.supabase
        .from('creator_list_member')
        .update({ sourcing_creator_id: poolId })
        .eq('id', memberId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.warn(`Masterliste: Instagram-Abruf für @${handle} fehlgeschlagen`, error);
      return false;
    }
  }

  async instagramNeuLaden(memberId) {
    const member = this.members.find(item => item.memberId === memberId);
    if (!member?.igUsername || !canManageMasterliste()) return;
    window.toastSystem?.show('Instagram-Daten werden geladen...', 'info');
    const ok = await this.ladeInstagram(memberId, member.igUsername);
    window.toastSystem?.show(
      ok ? 'Instagram-Daten geladen' : 'Instagram konnte nicht geladen werden',
      ok ? 'success' : 'error'
    );
    if (ok) await this.refreshMembers();
  }

  openCreatorAnlegen(memberId) {
    const member = this.members.find(item => item.memberId === memberId);
    if (!member || member.hatDatensatz || !canManageMasterliste()) return;
    new CreatorFormDrawer().open({
      prefill: prefillOhneDatensatz(member),
      originalFollowers: {
        instagram: member.pool?.follower_instagram ?? member.eigen?.follower_instagram ?? null,
        tiktok: member.eigen?.follower_tiktok ?? null
      },
      extraInsert: { profilbild_url: member.pool?.profile_image_url || null },
      onCreated: async (creator) => {
        const ok = await this.verknuepfeMember(memberId, creator.id);
        if (ok && creator.instagram) void connectInstagramSilent(creator.id);
      },
      onUseExisting: async (creatorId) => {
        if (await this.verknuepfeMember(memberId, creatorId)) {
          window.toastSystem?.show('Bestehenden Creator verknüpft', 'success');
        }
      }
    });
  }

  async verknuepfeMember(memberId, creatorId) {
    const { error } = await window.supabase
      .from('creator_list_member')
      .update({ creator_id: creatorId })
      .eq('id', memberId);
    if (error) {
      const schonDabei = error.code === '23505';
      window.toastSystem?.show(
        schonDabei ? 'Dieser Creator steht schon auf der Masterliste.' : 'Verknüpfen fehlgeschlagen.',
        schonDabei ? 'warning' : 'error'
      );
      return false;
    }
    await this.refreshMembers();
    return true;
  }

  async removeMember(memberId) {
    const member = this.members.find(item => item.memberId === memberId);
    if (!member) return;
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
      .eq('id', memberId);
    if (error) {
      window.toastSystem?.show('Entfernen fehlgeschlagen.', 'error');
      return;
    }
    this.members = this.members.filter(item => item.memberId !== memberId);
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
    this.linkBar?.destroy();
    this.linkBar = null;
    this._headerDragCleanup?.();
    this._headerDragCleanup = null;
    this.closeDrawers(true);
    this.members = [];
    this.list = null;
  }
}

export const creatorListDetail = new CreatorListDetail();
