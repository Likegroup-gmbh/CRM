// ManagementDetail.js (ES6-Modul)
// Management-Detailseite mit Tabs für Creator und Rechnungen
// Nutzt einheitliches zwei-Spalten-Layout (PersonDetailBase)

import { activateSecondaryNavTab, getSecondaryNavTabFromEvent, getTabQueryParam } from '../../core/TabUtils.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';
import { bindFilterSelects, readFilterSelectValues } from '../../core/filters/FilterSelect.js';
import { closeDrawer } from '../creator/creatorDrawer.js';
import { createAnsprechpartner, diffIds, toggleBetreuung } from '../ansprechpartner/betreuung.js';
import { openAddAnsprechpartnerDrawer } from '../ansprechpartner/managementBetreuung.js';
import { renderManagementPage } from './ManagementDetailView.js';
import { removeCreatorFromManagement, showAddCreatorDialog, showManagementEditForm } from './ManagementDetailEdit.js';

export class ManagementDetail extends PersonDetailBase {
  constructor() {
    super();
    this.managementId = null;
    this.management = null;
    this.creators = [];
    this.ansprechpartner = [];
    this.betreuungLinks = [];
    this.rechnungen = [];
    this.activeMainTab = null;
    this.eventsBound = false;
    this._isLoading = false;
    this._isEditing = false;
    this._lastRenderTime = 0;
    this._renderDebounceMs = 500;
  }

  async init(managementId) {
    console.log('🎯 MANAGEMENTDETAIL: Initialisiere für ID:', managementId);
    this._removeAllEventListeners();

    try {
      this._isLoading = true;
      this._isEditing = false;
      this.managementId = managementId;
      this.activeMainTab = getTabQueryParam() || 'creators';
      await this.loadManagementData();

      if (window.breadcrumbSystem && this.management) {
        const canEdit = window.canEdit?.('management') ?? false;
        window.breadcrumbSystem.updateDetailLabel(this.management.firmenname || 'Details', {
          id: 'btn-edit-management',
          canEdit: canEdit
        });
      }

      this.render(true);

      if (!this.eventsBound) {
        this.bindEvents();
        this.eventsBound = true;
      }

      this._isLoading = false;
      console.log('✅ MANAGEMENTDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
      this._isLoading = false;
      console.error('❌ MANAGEMENTDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler?.handle?.(error, 'ManagementDetail.init');
    }
  }

  async loadManagementData() {
    console.log('🔄 MANAGEMENTDETAIL: Lade Daten (parallelisiert)...');
    const startTime = Date.now();

    try {
      // Batch 1: Management-Basisdaten + Creator über creator_management
      const [managementResult, creatorMgmtResult] = await Promise.all([
        window.supabase
          .from('management')
          .select('*')
          .eq('id', this.managementId)
          .single(),
        window.supabase
          .from('creator_management')
          .select(`
            creator_id,
            ist_aktiv,
            creator:creator_id (
              id, vorname, nachname, instagram, instagram_follower, tiktok_follower,
              lieferadresse_strasse, lieferadresse_hausnummer, lieferadresse_plz,
              lieferadresse_stadt, lieferadresse_land,
              creator_types:creator_creator_type(creator_type:creator_type_id(name)),
              sprachen:creator_sprachen(sprache:sprache_id(name)),
              branchen:creator_branchen(branche:branche_id(name))
            )
          `)
          .eq('management_id', this.managementId)
          .eq('ist_aktiv', true)
      ]);

      if (managementResult.error) throw managementResult.error;
      this.management = managementResult.data;

      if (creatorMgmtResult.error) {
        console.error('❌ MANAGEMENTDETAIL: Fehler beim Laden der Creator-Zuordnungen:', creatorMgmtResult.error);
      }

      // Creator-Daten aufbereiten
      this.creators = (creatorMgmtResult.data || [])
        .filter(item => item.creator)
        .map(item => {
          const c = item.creator;
          return {
            ...c,
            creator_types: (c.creator_types || []).map(t => t.creator_type?.name).filter(Boolean),
            sprachen: (c.sprachen || []).map(s => s.sprache?.name).filter(Boolean),
            branchen: (c.branchen || []).map(b => b.branche?.name).filter(Boolean)
          };
        });

      const { data: apRows, error: apError } = await window.supabase
        .from('ansprechpartner')
        .select('id, vorname, nachname, email, profile_image_url, telefonnummer, telefonnummer_land:eu_laender!telefonnummer_land_id(iso_code, vorwahl)')
        .eq('management_id', this.managementId)
        .order('nachname', { ascending: true });
      if (apError) console.error('❌ MANAGEMENTDETAIL: Ansprechpartner', apError);
      this.ansprechpartner = apRows || [];
      const apIds = this.ansprechpartner.map((person) => person.id);
      this.betreuungLinks = [];
      if (apIds.length) {
        const { data: links, error: linkError } = await window.supabase
          .from('creator_ansprechpartner')
          .select('ansprechpartner_id, creator_id')
          .in('ansprechpartner_id', apIds);
        if (linkError) console.error('❌ MANAGEMENTDETAIL: Betreuung', linkError);
        this.betreuungLinks = links || [];
      }

      console.log(`✅ MANAGEMENTDETAIL: Batch 1 geladen in ${Date.now() - startTime}ms – ${this.creators.length} Creator`);

      // Batch 2: Rechnungen über Creator-IDs
      const creatorIds = this.creators.map(c => c.id).filter(Boolean);

      if (creatorIds.length > 0) {
        const { data: rechnungenData, error: rechnungenError } = await window.supabase
          .from('rechnung')
          .select(`
            id, rechnung_nr, rechnungstyp, status, nettobetrag, bruttobetrag,
            gestellt_am, zahlungsziel, bezahlt_am, po_nummer, land, videoanzahl,
            created_at, pdf_url,
            auftrag:auftrag_id(id, auftragsname),
            kampagne:kampagne_id(id, kampagnenname, eigener_name),
            creator:creator_id(id, vorname, nachname),
            created_by:created_by_id(id, name, profile_image_url),
            rechnung_pdfs(id, file_name, file_path, file_url)
          `)
          .in('creator_id', creatorIds)
          .order('gestellt_am', { ascending: false });

        if (rechnungenError) {
          console.warn('⚠️ Rechnungen konnten nicht geladen werden:', rechnungenError);
          this.rechnungen = [];
        } else {
          this.rechnungen = rechnungenData || [];
        }
      } else {
        this.rechnungen = [];
      }

      console.log(`✅ MANAGEMENTDETAIL: Alle Daten geladen in ${Date.now() - startTime}ms – ${this.rechnungen.length} Rechnungen`);

    } catch (error) {
      console.error('❌ MANAGEMENTDETAIL: Fehler beim Laden:', error);
      throw error;
    }
  }

  render(force = false) {
    const now = Date.now();
    if (!force && (now - this._lastRenderTime) < this._renderDebounceMs) return;
    this._lastRenderTime = now;
    renderManagementPage(this);
  }

  bindEvents() {
    this.bindSidebarTabs();

    this._eventsAbort?.abort();
    this._eventsAbort = new AbortController();
    const signal = this._eventsAbort.signal;

    this._tabClickHandler = (e) => {
      const tab = getSecondaryNavTabFromEvent(e);
      if (!tab) return;
      e.preventDefault();
      this.activeMainTab = tab;
      activateSecondaryNavTab(tab);
    };
    document.addEventListener('click', this._tabClickHandler, { signal });

    this._tableLinkClickHandler = (e) => {
      if (e.target.classList.contains('table-link')) {
        e.preventDefault();
        const table = e.target.dataset.table;
        const id = e.target.dataset.id;
        window.navigateTo(`/${table}/${id}`);
      }
    };
    document.addEventListener('click', this._tableLinkClickHandler, { signal });

    if (window.content) bindFilterSelects(window.content, { signal });

    document.addEventListener('change', (e) => {
      const cell = e.target.closest?.('[data-betreuung-ap]');
      if (!cell || !document.getElementById('tab-ansprechpartner')?.contains(cell)) return;
      if (e.target !== cell && e.target.type !== 'checkbox' && !e.target.matches?.('[data-filter-select]')) return;
      const select = cell.querySelector('[data-filter-select]');
      if (!select) return;
      this._queueBetreuungSync(cell.dataset.betreuungAp, readFilterSelectValues(select));
    }, { signal });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#mgmt-ap-add')) return;
      e.preventDefault();
      this._openAddAnsprechpartner();
    }, { signal });

    // Bearbeiten-Button im Breadcrumb
    this._editClickHandler = (e) => {
      if (e.target.closest('#btn-edit-management')) {
        e.preventDefault();
        showManagementEditForm(this);
      }
    };
    document.addEventListener('click', this._editClickHandler, { signal });

    document.addEventListener('click', async (e) => {
      if (e.target.id === 'btn-add-creator-to-management' || e.target.closest('#btn-add-creator-to-management')) {
        e.preventDefault();
        await showAddCreatorDialog(this);
      }
      const removeBtn = e.target.closest('[data-action="remove-creator-from-management"]');
      if (removeBtn) {
        e.preventDefault();
        const creatorId = removeBtn.dataset.creatorId;
        if (creatorId) await removeCreatorFromManagement(this, creatorId);
      }
    }, { signal });

    this._entityUpdatedHandler = (e) => {
      if (this._isEditing) return;
      if (e.detail?.entity === 'management' && e.detail?.id === this.managementId) {
        console.log('🔄 MANAGEMENTDETAIL: Management aktualisiert, lade neu');
        this.loadManagementData().then(() => this.render());
      }
    };
    document.addEventListener('entityUpdated', this._entityUpdatedHandler, { signal });

    this._softRefreshHandler = async () => {
      if (this._isLoading || this._isEditing) return;
      if (document.querySelector('form.edit-form, .drawer.show, .modal.show')) return;
      if (!this.managementId || !location.pathname.includes('/management/')) return;

      console.log('🔄 MANAGEMENTDETAIL: Soft-Refresh');
      await this.loadManagementData();
      this.render();
    };
    window.addEventListener('softRefresh', this._softRefreshHandler, { signal });
  }

  _removeAllEventListeners() {
    this._eventsAbort?.abort();
    this._eventsAbort = null;
    this._tabClickHandler = null;
    this._tableLinkClickHandler = null;
    this._editClickHandler = null;
    this._entityUpdatedHandler = null;
    this._softRefreshHandler = null;
    this._sidebarTabsBound = false;
    this.eventsBound = false;
  }

  _openAddAnsprechpartner() {
    openAddAnsprechpartnerDrawer({
      creators: this.creators,
      subtitle: this.management?.firmenname || '',
      onSubmit: async (fields) => {
        const result = await createAnsprechpartner({
          managementId: this.managementId,
          vorname: fields.vorname,
          nachname: fields.nachname,
          email: fields.email,
          telefonnummer: fields.telefonnummer,
          telefonnummer_land_id: fields.telefonnummer_land_id
        });
        if (!result.ok) return result;
        let linked = true;
        try {
          for (const creatorId of fields.creatorIds || []) {
            await toggleBetreuung(creatorId, result.person.id, true);
          }
        } catch (error) {
          linked = false;
          window.toastSystem?.show(`Person angelegt, Creator-Zuordnung fehlgeschlagen: ${error.message}`, 'error');
        }
        if (linked && result.similar?.length) {
          window.toastSystem?.show('Ähnlicher Name vorhanden, die Person wurde trotzdem angelegt.', 'warning');
        } else if (linked) {
          window.toastSystem?.success('Ansprechpartner angelegt.');
        }
        this.activeMainTab = 'ansprechpartner';
        await this.loadManagementData();
        this.render(true);
        return result;
      }
    });
  }

  _queueBetreuungSync(personId, selectedIds) {
    if (!personId) return;
    if (!this._betreuungQueue) this._betreuungQueue = new Map();
    if (!this._betreuungActive) this._betreuungActive = new Set();
    this._betreuungQueue.set(personId, [...selectedIds]);
    if (this._betreuungActive.has(personId)) return;
    this._betreuungActive.add(personId);
    this._drainBetreuung(personId);
  }

  async _drainBetreuung(personId) {
    const managed = new Set(this.creators.map((creator) => creator.id));
    try {
      while (this._betreuungQueue.has(personId)) {
        const desired = this._betreuungQueue.get(personId).filter((id) => managed.has(id));
        this._betreuungQueue.delete(personId);
        const previous = this.betreuungLinks
          .filter((link) => link.ansprechpartner_id === personId && managed.has(link.creator_id))
          .map((link) => link.creator_id);
        const { add, remove } = diffIds(previous, desired);
        for (const creatorId of add) await toggleBetreuung(creatorId, personId, true);
        for (const creatorId of remove) await toggleBetreuung(creatorId, personId, false);
        const kept = this.betreuungLinks.filter((link) => (
          link.ansprechpartner_id !== personId || !managed.has(link.creator_id)
        ));
        this.betreuungLinks = [
          ...kept,
          ...desired.map((creatorId) => ({ ansprechpartner_id: personId, creator_id: creatorId }))
        ];
      }
    } catch (error) {
      this._betreuungQueue.delete(personId);
      window.toastSystem?.show(error.message || 'Verknüpfung fehlgeschlagen', 'error');
      await this.loadManagementData();
      this.render(true);
    } finally {
      this._betreuungActive.delete(personId);
      if (this._betreuungQueue.has(personId)) {
        this._betreuungActive.add(personId);
        this._drainBetreuung(personId);
      }
    }
  }

  showEditForm() {
    return showManagementEditForm(this);
  }

  destroy() {
    console.log('ManagementDetail: Cleaning up...');
    closeDrawer('mgmt-ap-drawer');
    this._removeAllEventListeners();
    this._isLoading = false;
    this._isEditing = false;
    this._lastRenderTime = 0;
  }
}

export const managementDetail = new ManagementDetail();
