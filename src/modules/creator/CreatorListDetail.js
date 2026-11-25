// Eine Masterliste. Profilfelder sind live und nur lesbar.
// Eigene Spalten und die gezogene Reihenfolge gehoeren der Liste.

import { SearchInput } from '../../core/components/SearchInput.js';
import { renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { EntityCustomColumnsManager } from '../../core/customColumns/EntityCustomColumnsManager.js';
import { bindCustomSelectChange } from '../../core/customColumns/customColumnSelect.js';
import { MasterlisteAddDrawer } from './masterlisteAddDrawer.js';
import {
  ANCHOR_COLUMNS,
  ANCHOR_LABELS,
  canManageMasterliste,
  compareMembers,
  escapeHtml,
  mapMember,
  resolveHidden,
  visibleColumns
} from './masterliste.js';
import { renderMasterlisteHead, renderMasterlisteRow } from './masterlisteTable.js';
import { masterlistenCrumbs, ordnerDerListe } from './masterlisteOrdner.js';
import { closeMasterlisteFormDrawer, openMasterlisteFormDrawer } from './masterlisteFormDrawer.js';
import { installMasterlisteSpalten } from './masterlisteDetailSpalten.js';
import { installMasterlisteEintraege } from './masterlisteDetailEintraege.js';
import { masterlisteDarfZiehen, masterlisteHatFilter, mountMasterlisteFilter, sichtbareMember, syncMasterlisteTableFilter } from './masterlisteFilterSpalte.js';

const LIST_SELECT = 'id, name, beschreibung, created_at, hidden_columns, unternehmen_id, unternehmen:unternehmen_id(id, firmenname)';

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
    this.tableFilter = null;
    this._filterMounted = false;
    this.addDrawer = new MasterlisteAddDrawer(this);
    this.customColumns = new EntityCustomColumnsManager({
      parentType: 'masterliste',
      parentTable: 'creator_list',
      anchorColumns: ANCHOR_COLUMNS,
      anchorLabels: ANCHOR_LABELS,
      anchorAliases: { 'ml-col-bild': 'ml-col-ig' },
      tableSelect: true
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
        .select(LIST_SELECT)
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

  renderShell() {
    this._abortController?.abort();
    this._headerDragCleanup?.();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;
    const name = this.list?.name || 'Masterliste';
    const canManage = canManageMasterliste();
    window.setHeadline?.(name);
    const ordner = ordnerDerListe({
      unternehmenId: this.list?.unternehmen_id,
      unternehmenName: this.list?.unternehmen?.firmenname
    });
    window.breadcrumbSystem?.updateBreadcrumb?.(masterlistenCrumbs({
      ordner,
      detailLabel: name,
      detailUrl: `/creator-lists/${this.listId}`
    }));

    const beschreibung = this.list?.beschreibung
      ? `<p class="masterliste-beschreibung">${escapeHtml(this.list.beschreibung)}</p>`
      : '';
    syncMasterlisteTableFilter(this);
    this._filterMounted = false;

    window.setContentSafely(window.content, `
      <div class="list-container" id="masterliste-page">
        <div class="table-filter-wrapper masterliste-kopf">
          <div class="filter-bar">
            <div class="filter-left">
              ${SearchInput.render('masterliste-member', {
                placeholder: 'Creator in dieser Liste suchen...',
                currentValue: this.searchQuery
              })}
              ${this.tableFilter.renderToggle()}
            </div>
          </div>
          <div class="table-actions">
            ${canManage ? `
              <button type="button" class="mdc-btn mdc-btn--secondary" data-action="edit-masterliste">Bearbeiten</button>
              <button type="button" class="mdc-btn mdc-btn--secondary" data-action="masterliste-spalten">Tabelle anpassen</button>
              <button type="button" class="mdc-btn" data-action="add-masterliste-member">Creator hinzufügen</button>
            ` : ''}
          </div>
          ${beschreibung}
        </div>
        ${this.tableFilter.renderLayout(`
          <div class="table-container creator-pool-table-container">
            <table class="data-table strategie-items-table creator-pool-table" id="masterliste-table">
              <thead><tr id="masterliste-head"></tr></thead>
              <tbody id="masterliste-body"></tbody>
            </table>
          </div>
        `)}
      </div>
    `);

    SearchInput.bind('masterliste-member', (value) => {
      this.searchQuery = value;
      this.renderTable();
    }, signal);
    this.bindEvents(signal);
    this.mountLinkBar();
    this.renderTable();
    this.bindTableScroll(signal);
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

    bindCustomSelectChange(this.customColumns, { signal, onError: () => this.renderTable() });

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
        /(<th\b[^>]*data-col="ml-col-actions"[^>]*>)/,
        `${parkedHeader}$1`
      );

    syncMasterlisteTableFilter(this);
    const members = sichtbareMember(this);
    const colspan = columns.length + this.customColumns.visibleCount(this.hidden, false);
    this._headerDragCleanup?.();
    if (!members.length) {
      body.innerHTML = renderEmptyStateRow(masterlisteHatFilter(this) ? {
        icon: 'search',
        title: 'Keine Treffer',
        text: 'Kein Creator entspricht der Suche oder den Filtern.'
      } : {
        icon: 'creator',
        title: 'Noch keine Creator',
        text: 'Fügen Sie Creator per Instagram-Link oder aus den Stammdaten hinzu.',
        actionsHtml: canManage
          ? '<button type="button" class="mdc-btn" data-action="add-masterliste-member">Creator hinzufügen</button>'
          : ''
      }, Math.max(colspan, 1));
      mountMasterlisteFilter(this);
      return;
    }

    body.innerHTML = members.map(member => {
      const row = renderMasterlisteRow(member, columns, this.listId, customAt);
      if (actionsIndex === -1) return row.replace('</tr>', `${parkedCells(member.memberId)}</tr>`);
      return row.replace(
        /(<td class="col-actions ml-col-actions[^"]*">)/,
        `${parkedCells(member.memberId)}$1`
      );
    }).join('');

    window.ActionsDropdown?.init?.();
    const table = document.getElementById('masterliste-table');
    this._headerDragCleanup = this.customColumns.bindHeaderDragAndDrop(table, () => this.renderTable());
    if (masterlisteDarfZiehen(this)) this.bindRowDrag();
    mountMasterlisteFilter(this);
  }

  listeFuerFormular() {
    return {
      id: this.listId,
      name: this.list?.name || '',
      beschreibung: this.list?.beschreibung || '',
      unternehmenId: this.list?.unternehmen_id || null,
      unternehmenName: this.list?.unternehmen?.firmenname || ''
    };
  }

  openEditDrawer() {
    if (!canManageMasterliste()) return;
    this.closeDrawers(true);
    openMasterlisteFormDrawer({
      list: this.listeFuerFormular(),
      onSubmit: (values) => this.saveList(values)
    });
  }

  async saveList(values) {
    const { data, error } = await window.supabase
      .from('creator_list')
      .update(values)
      .eq('id', this.listId)
      .select(LIST_SELECT)
      .single();
    if (error) {
      window.toastSystem?.show('Speichern fehlgeschlagen.', 'error');
      return false;
    }
    this.list = { ...this.list, ...data };
    window.toastSystem?.show('Masterliste gespeichert.', 'success');
    closeMasterlisteFormDrawer();
    this.renderShell();
    return true;
  }

  openAddDrawer(mode = 'new') {
    if (!canManageMasterliste()) return;
    this.closeDrawers(true);
    this.addDrawer.open(mode);
  }

  closeDrawers(immediate = false) {
    ['masterliste-form', 'masterliste-add', 'masterliste-columns'].forEach((id) => {
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
    this.tableFilter?.destroy();
    this.tableFilter = null;
    this._filterMounted = false;
    this.linkBar?.destroy();
    this.linkBar = null;
    this._headerDragCleanup?.();
    this._headerDragCleanup = null;
    this.closeDrawers(true);
    this.members = [];
    this.list = null;
  }
}

installMasterlisteSpalten(CreatorListDetail.prototype);
installMasterlisteEintraege(CreatorListDetail.prototype);

export const creatorListDetail = new CreatorListDetail();
