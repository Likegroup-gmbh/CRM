// ManagementDetail.js (ES6-Modul)
// Management-Detailseite mit Tabs für Creator und Rechnungen
// Nutzt einheitliches zwei-Spalten-Layout (PersonDetailBase)

import { renderCreatorTable } from '../creator/CreatorTable.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { renderTabButton } from '../../core/TabUtils.js';
import { PersonDetailBase } from '../admin/PersonDetailBase.js';

export class ManagementDetail extends PersonDetailBase {
  constructor() {
    super();
    this.managementId = null;
    this.management = null;
    this.creators = [];
    this.rechnungen = [];
    this.activeMainTab = null;
    this.eventsBound = false;
    this._isLoading = false;
    this._lastRenderTime = 0;
    this._renderDebounceMs = 500;
  }

  async init(managementId) {
    console.log('🎯 MANAGEMENTDETAIL: Initialisiere für ID:', managementId);
    this._removeAllEventListeners();

    try {
      this._isLoading = true;
      this.managementId = managementId;
      await this.loadManagementData();

      if (window.breadcrumbSystem && this.management) {
        const canEdit = window.currentUser?.permissions?.management?.can_edit !== false;
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

    if (!this.activeMainTab) {
      this.activeMainTab = 'creators';
    }

    window.setHeadline(`${this.management?.firmenname || 'Management'} - Details`);

    const personConfig = {
      name: this.management?.firmenname || 'Unbekannt',
      email: '',
      subtitle: 'Management',
      avatarUrl: this.management?.logo_url,
      avatarOnly: false
    };

    const webseiteLinkHtml = this.management?.webseite
      ? `<a href="${this.sanitizeUrl(this.management.webseite)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="${this.sanitize(this.management.webseite)}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>`
      : null;

    const sidebarInfo = this.renderInfoItems([
      { icon: 'home', label: 'Adresse', rawHtml: this.renderAdresseBlock() },
      { icon: 'mail', label: 'E-Mail', value: this.management?.email, mailto: true },
      { icon: 'phone', label: 'Telefon', value: this.management?.telefonnummer },
      ...(webseiteLinkHtml ? [{ icon: 'link', label: 'Webseite', rawHtml: webseiteLinkHtml }] : []),
      ...(this.management?.instagram ? [{ icon: 'instagram', label: 'Instagram', rawHtml: `<a href="https://instagram.com/${this.sanitize(this.management.instagram)}" target="_blank" rel="noopener">@${this.sanitize(this.management.instagram)}</a>` }] : []),
      ...(this.management?.linkedin ? [{ icon: 'link', label: 'LinkedIn', rawHtml: `<a href="${this.sanitizeUrl(this.management.linkedin)}" target="_blank" rel="noopener">${this.sanitize(this.management.linkedin)}</a>` }] : []),
      ...(this.management?.status ? [{ icon: 'check', label: 'Status', value: this.management.status, badge: true, badgeType: this.management.status === 'aktiv' ? 'success' : 'secondary' }] : []),
      { icon: 'clock', label: 'Erstellt', value: this.formatDate(this.management?.created_at) },
      { icon: 'clock', label: 'Aktualisiert', value: this.formatDate(this.management?.updated_at) }
    ]);

    const tabNavigation = this.renderTabNavigation();
    const mainContent = this.renderMainContent();

    const html = this.renderTwoColumnLayout({
      person: personConfig,
      stats: [],
      quickActions: [],
      sidebarInfo,
      tabNavigation,
      mainContent
    });

    window.setContentSafely(window.content, html);
  }

  renderAdresseBlock() {
    const m = this.management;
    const line1 = [m?.strasse, m?.hausnummer].filter(Boolean).join(' ');
    const line2 = [m?.plz, m?.stadt].filter(Boolean).join(' ');
    const line3 = m?.land || '';
    const lines = [line1, line2, line3].filter(Boolean);
    if (lines.length === 0) return '-';
    return `<span class="info-address">${lines.map(l => this.sanitize(l)).join('<br>')}</span>`;
  }

  renderTabNavigation() {
    const tabs = [
      { tab: 'creators', label: 'Creator', count: this.creators.length, isActive: this.activeMainTab === 'creators' },
      { tab: 'rechnungen', label: 'Rechnungen', count: this.rechnungen.length, isActive: this.activeMainTab === 'rechnungen' }
    ];
    return tabs.map(t => renderTabButton({ ...t, showIcon: true })).join('');
  }

  renderMainContent() {
    return `
      <div class="tab-content secondary-tab-content">
        <div class="tab-pane ${this.activeMainTab === 'creators' ? 'active' : ''}" id="tab-creators">
          ${this.renderCreators()}
        </div>
        <div class="tab-pane ${this.activeMainTab === 'rechnungen' ? 'active' : ''}" id="tab-rechnungen">
          ${this.renderRechnungen()}
        </div>
      </div>
    `;
  }

  renderCreators() {
    if (!this.creators || this.creators.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Creator vorhanden</h3>
          <p>Diesem Management sind noch keine aktiven Creator zugeordnet.</p>
        </div>
      `;
    }
    return renderCreatorTable(this.creators);
  }

  renderRechnungen() {
    if (!this.rechnungen || this.rechnungen.length === 0) {
      return `
        <div class="empty-state">
          <h3>Keine Rechnungen vorhanden</h3>
          <p>Für die Creator dieses Managements wurden noch keine Rechnungen erfasst.</p>
        </div>
      `;
    }

    const isKunde = window.isKunde();

    const rows = this.rechnungen.map(r => {
      const kampagneName = r.kampagne ? (r.kampagne.eigener_name || r.kampagne.kampagnenname || '-') : '-';
      const preisProVideo = r.videoanzahl && r.nettobetrag ? this.formatCurrency(r.nettobetrag / r.videoanzahl) : '-';
      const creatorBubble = r.creator ? avatarBubbles.renderBubbles([{
        name: [r.creator.vorname, r.creator.nachname].filter(Boolean).join(' '),
        type: 'person', id: r.creator.id, entityType: 'creator'
      }]) : '-';
      return `
      <tr>
        <td><a href="/rechnung/${r.id}" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${this.sanitize(r.rechnung_nr || '—')}</a></td>
        <td><span class="status-badge ${r.rechnungstyp === 'contracting' ? 'status-gestellt' : 'status-beauftragt'}">${r.rechnungstyp === 'contracting' ? 'Contracting' : 'Kampagne'}</span></td>
        <td>${r.auftrag ? `<a href="#" class="table-link" data-table="auftrag" data-id="${r.auftrag.id}">${this.sanitize(r.auftrag.auftragsname || '-')}</a>` : '-'}</td>
        <td>${this.sanitize(r.po_nummer) || '-'}</td>
        <td>${this.formatDate(r.created_at)}</td>
        <td>${r.kampagne ? `<a href="#" class="table-link" data-table="kampagne" data-id="${r.kampagne.id}">${this.sanitize(kampagneName)}</a>` : '-'}</td>
        <td>${this.sanitize(r.land) || '-'}</td>
        <td>${creatorBubble}</td>
        <td>${this.formatDate(r.gestellt_am)}</td>
        <td>${this.formatDate(r.zahlungsziel)}</td>
        <td>${this.formatCurrency(r.nettobetrag)}</td>
        <td>${r.videoanzahl || '-'}</td>
        <td>${preisProVideo}</td>
        <td>${this.formatCurrency(r.bruttobetrag)}</td>
        <td>${r.rechnung_pdfs && r.rechnung_pdfs.length > 0 ? r.rechnung_pdfs.map((p, i) => `<a href="${p.file_url || p.open_url}" target="_blank" rel="noopener">PDF${r.rechnung_pdfs.length > 1 ? ' ' + (i + 1) : ''}</a>`).join(' ') : (r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" rel="noopener">PDF</a>` : '-')}</td>
        <td>${r.status || '-'}</td>
        ${!isKunde ? `<td>${this.renderPersonBubble(r.created_by)}</td>` : ''}
        ${!isKunde ? `<td>${actionBuilder.create('rechnung', r.id)}</td>` : ''}
      </tr>
    `}).join('');

    return `
      <div class="data-table-container">
        <table class="data-table data-table--nowrap">
          <thead>
            <tr>
              <th>Rechnungsname</th>
              <th>Typ</th>
              <th>Auftrag</th>
              <th>PO-Nummer</th>
              <th>Erstellt am</th>
              <th>Kampagne / Contract</th>
              <th>Land</th>
              <th>Creator</th>
              <th>Gestellt am</th>
              <th>Zahlungsziel</th>
              <th>Nettobetrag</th>
              <th>Videos</th>
              <th>Preis/Video</th>
              <th>Bruttobetrag</th>
              <th>Beleg</th>
              <th>Status</th>
              ${!isKunde ? '<th>Erstellt von</th>' : ''}
              ${!isKunde ? '<th>Aktionen</th>' : ''}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  renderPersonBubble(person, entityType = 'mitarbeiter') {
    if (!person) return '-';
    const name = person.name || [person.vorname, person.nachname].filter(Boolean).join(' ');
    if (!name) return '-';
    return avatarBubbles.renderBubbles([{
      name, type: 'person', id: person.id,
      entityType, profile_image_url: person.profile_image_url || null
    }]);
  }

  sanitizeUrl(url) {
    if (!url) return '#';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  bindEvents() {
    this.bindSidebarTabs();

    this._eventsAbort?.abort();
    this._eventsAbort = new AbortController();
    const signal = this._eventsAbort.signal;

    this._tabClickHandler = (e) => {
      const btn = e.target.closest('.tab-button');
      if (!btn) return;
      e.preventDefault();
      const tab = btn.dataset.tab;
      if (!tab) return;

      this.activeMainTab = tab;
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const pane = document.getElementById(`tab-${tab}`);
      if (pane) pane.classList.add('active');
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

    this._entityUpdatedHandler = (e) => {
      if (e.detail?.entity === 'management' && e.detail?.id === this.managementId) {
        console.log('🔄 MANAGEMENTDETAIL: Management aktualisiert, lade neu');
        this.loadManagementData().then(() => this.render());
      }
    };
    document.addEventListener('entityUpdated', this._entityUpdatedHandler, { signal });

    this._softRefreshHandler = async () => {
      if (this._isLoading) return;
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
    this._entityUpdatedHandler = null;
    this._softRefreshHandler = null;
    this._sidebarTabsBound = false;
    this.eventsBound = false;
  }

  destroy() {
    console.log('ManagementDetail: Cleaning up...');
    this._removeAllEventListeners();
    this._isLoading = false;
    this._lastRenderTime = 0;
  }
}

export const managementDetail = new ManagementDetail();
