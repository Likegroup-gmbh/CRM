// AuftragsdetailsDetail.js (ES6-Modul)
// Auftragsdetails-Detailseite ohne Tabs - direkte Anzeige der Informationen

import { buildKoopRechnungsStatusMap } from '../../core/budget/koopFakturierung.js';
import { calculateBudgetOverview, getBudgetCardVariant } from '../../core/budget/calculateBudgetOverview.js';
import { AuftragDetailsNotizController } from './AuftragDetailsNotiz.js';
import * as detailView from './AuftragsdetailsDetailView.js';
import * as budgetTables from './AuftragsdetailsBudgetTables.js';
import * as creatorTable from './AuftragsdetailsCreatorTable.js';

export class AuftragsdetailsDetail {
  constructor() {
    this.detailsId = null;
    this.details = null;
    this.auftrag = null;
    this.kampagnen = [];
    this.kooperationen = [];
    this.videos = [];
    this.rechnungen = [];
    this.rechnungStatusMap = {};
    this.budgetSummary = {
      totalBudget: 0,
      usedBudget: 0,
      totalVideos: 0,
      totalCreators: 0
    };
    this._eventsBound = false;
    this._docClickHandler = null;
    this._notiz = null;
  }

  get stayRoute() {
    return this.detailsId ? `/auftragsdetails/${this.detailsId}` : null;
  }

  beforeLeave() {
    return this._notiz?.beforeLeave() ?? true;
  }

  // Initialisiere Auftragsdetails-Detailseite
  async init(detailsId) {
    console.log('🎯 AUFTRAGSDETAILSDETAIL: Initialisiere Auftragsdetails-Detailseite für ID:', detailsId);
    
    const canView = window.currentUser?.permissions?.auftragsdetails?.can_view;
    if (canView === false) {
      window.setHeadline('Zugriff verweigert');
      window.content.innerHTML = `
        <div class="error-state">
          <h2>Zugriff verweigert</h2>
          <p>Sie haben keine Berechtigung, diese Seite zu sehen.</p>
        </div>
      `;
      return;
    }

    try {
      this.detailsId = detailsId;
      await this.loadDetailsData();
      
      if (window.breadcrumbSystem && this.auftrag) {
        const canEdit = window.canEdit?.('auftragsdetails') ?? false;
        window.breadcrumbSystem.updateDetailLabel(this.auftrag.auftragsname || 'Details', {
          id: 'btn-edit-details',
          canEdit: canEdit
        });
      }
      
      this.render();
      this.bindEvents();
      this._mountNotiz();
      console.log('✅ AUFTRAGSDETAILSDETAIL: Initialisierung abgeschlossen');
    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSDETAIL: Fehler bei der Initialisierung:', error);
      window.ErrorHandler?.handle(error, 'AuftragsdetailsDetail.init');
    }
  }

  // Lade Auftragsdetails-Daten
  async loadDetailsData() {
    console.log('🔄 AUFTRAGSDETAILSDETAIL: Lade Auftragsdetails-Daten...');
    
    try {
      // Auftragsdetails mit Auftrag-Daten laden (single query mit Joins für Performance)
      const { data: details, error } = await window.supabase
        .from('auftrag_details')
        .select(`
          *,
          auftrag:auftrag_id (
            id,
            auftragsname,
            auftragtype,
            kampagnenanzahl,
            status,
            start,
            ende,
            gesamt_budget,
            creator_budget,
            bruttobetrag,
            nettobetrag,
            po,
            unternehmen:unternehmen_id (
              id,
              firmenname
            ),
            marke:marke_id (
              id,
              markenname
            ),
            ansprechpartner:ansprechpartner_id (
              id,
              vorname,
              nachname,
              email
            )
          )
        `)
        .eq('id', this.detailsId)
        .single();

      if (error) throw error;
      
      this.details = details;
      this.auftrag = details.auftrag;
      console.log('✅ AUFTRAGSDETAILSDETAIL: Auftragsdetails geladen:', this.details);

      // Lade Kampagnen, Kooperationen und Budget-Informationen
      await this.loadBudgetData();

    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSDETAIL: Fehler beim Laden der Auftragsdetails-Daten:', error);
      throw error;
    }
  }

  // Lade Budget- und Kooperations-Daten
  async loadBudgetData() {
    try {
      const auftragId = this.auftrag?.id;
      if (!auftragId) return;

      console.log('🔄 AUFTRAGSDETAILSDETAIL: Lade Budget-Daten für Auftrag:', auftragId);

      // Lade alle Kampagnen des Auftrags
      const { data: kampagnen, error: kampagnenError } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, videoanzahl, creatoranzahl')
        .eq('auftrag_id', auftragId);

      if (kampagnenError) throw kampagnenError;
      
      this.kampagnen = kampagnen || [];
      const kampagneIds = this.kampagnen.map(k => k.id);

      console.log('✅ AUFTRAGSDETAILSDETAIL: Kampagnen geladen:', kampagneIds.length);

      if (kampagneIds.length === 0) {
        this.kooperationen = [];
        this.videos = [];
        this.rechnungen = [];
        this.rechnungStatusMap = {};
        this.calculateBudgetSummary();
        return;
      }

      // Lade alle Kooperationen der Kampagnen mit Creator-Informationen
      const { data: kooperationen, error: koopError } = await window.supabase
        .from('kooperationen')
        .select(`
          id,
          name,
          videoanzahl,
          einkaufspreis_netto,
          einkaufspreis_gesamt,
          verkaufspreis_netto,
          verkaufspreis_gesamt,
          verkaufspreis_zusatzkosten,
          ksk_selbstzahler,
          ksk_betrag,
          kampagne_id,
          creator:creator_id (
            id,
            vorname,
            nachname
          )
        `)
        .in('kampagne_id', kampagneIds)
        .order('created_at', { ascending: false });

      if (koopError) throw koopError;
      
      this.kooperationen = (kooperationen || []).map(koop => ({
        ...koop,
        kampagne: this.kampagnen.find(k => k.id === koop.kampagne_id)
      }));

      console.log('✅ AUFTRAGSDETAILSDETAIL: Kooperationen geladen:', this.kooperationen.length);

      // Lade Videos für alle Kooperationen mit Link-Informationen
      if (this.kooperationen.length > 0) {
        const koopIds = this.kooperationen.map(k => k.id);
        const { data: videos, error: videoError } = await window.supabase
          .from('kooperation_videos')
          .select('id, titel, thema, content_art, kooperation_id, link_content, asset_url, folder_url, video_name, einkaufspreis_netto, verkaufspreis_netto')
          .in('kooperation_id', koopIds);

        if (videoError) throw videoError;
        this.videos = videos || [];
        console.log('✅ AUFTRAGSDETAILSDETAIL: Videos geladen:', this.videos.length);

        // Rechnungen pro Kooperation laden (Status + Betraege fuer Creatoranteil-Breakdown
        // und die Status-Ableitung „Teilweise bezahlt" aus ADR 0015)
        const { data: rechnungen, error: rechnungError } = await window.supabase
          .from('rechnung')
          .select('id, status, nettobetrag, nettobetrag_steuerfrei, ist_schlussrechnung, kooperation_id, rechnungstyp, created_at')
          .in('kooperation_id', koopIds);

        if (rechnungError) {
          console.warn('⚠️ AUFTRAGSDETAILSDETAIL: Rechnungen konnten nicht geladen werden:', rechnungError);
          this.rechnungen = [];
          this.rechnungStatusMap = {};
        } else {
          this.rechnungen = rechnungen || [];
          this.rechnungStatusMap = buildKoopRechnungsStatusMap({
            kooperationen: this.kooperationen,
            videos: this.videos,
            rechnungen: this.rechnungen
          });
          console.log('✅ AUFTRAGSDETAILSDETAIL: Rechnungsstatus geladen für', Object.keys(this.rechnungStatusMap).length, 'Kooperationen');
        }
      } else {
        this.videos = [];
        this.rechnungen = [];
        this.rechnungStatusMap = {};
      }

      // Berechne Budget-Zusammenfassung
      this.calculateBudgetSummary();

    } catch (error) {
      console.error('❌ AUFTRAGSDETAILSDETAIL: Fehler beim Laden der Budget-Daten:', error);
      this.kooperationen = [];
      this.videos = [];
      this.rechnungen = [];
      this.rechnungStatusMap = {};
      this.calculateBudgetSummary();
    }
  }

  // Berechne Budget-Zusammenfassung (delegiert an geteilte Calc, damit
  // /stakeholder dieselben Zahlen aggregieren kann)
  calculateBudgetSummary() {
    this.budgetSummary = calculateBudgetOverview({
      auftrag: this.auftrag,
      details: this.details,
      kooperationen: this.kooperationen,
      videos: this.videos,
      kampagnen: this.kampagnen
    });

    console.log('✅ AUFTRAGSDETAILSDETAIL: Budget-Zusammenfassung berechnet:', this.budgetSummary);
  }

  // Bestimmt die Budget-Kachel-Variante (Influencer vs. UGC)
  getBudgetCardVariant() {
    return getBudgetCardVariant(this.details);
  }

  render() {
    return detailView.render(this);
  }

  renderInformationen() {
    return detailView.renderInformationen(this);
  }

  renderKampagnenTable() {
    return budgetTables.renderKampagnenTable(this);
  }

  renderZusatzleistungenTable() {
    return budgetTables.renderZusatzleistungenTable(this);
  }

  renderKategorienTable() {
    return budgetTables.renderKategorienTable(this);
  }

  renderCreatorVideosTable() {
    return creatorTable.renderCreatorVideosTable(this);
  }

  formatAnsprechpartner(ansprechpartner) {
    return detailView.formatAnsprechpartner(this, ansprechpartner);
  }

  getProgressPercentage(current, total) {
    return detailView.getProgressPercentage(this, current, total);
  }

  getProgressColorClass(current, total) {
    return detailView.getProgressColorClass(this, current, total);
  }

  getBudgetProgressPercentage() {
    return detailView.getBudgetProgressPercentage(this);
  }

  getBudgetProgressColorClass() {
    return detailView.getBudgetProgressColorClass(this);
  }

  // Binde Events
  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    const isKunde = window.isKunde();

    // Edit-Button + Table-Links
    this._docClickHandler = (e) => {
      if (!isKunde && (e.target.id === 'btn-edit-details' || e.target.closest('#btn-edit-details'))) {
        e.preventDefault();
        this.showEditForm();
      }

      // Table-Links (nur interne Links mit data-table/data-id abfangen) -- Kunden duerfen nicht navigieren
      if (isKunde) return;
      const link = e.target.closest('.table-link');
      if (link) {
        const table = link.dataset.table;
        const id = link.dataset.id;
        if (table && id) {
          e.preventDefault();
          window.navigateTo(`/${table}/${id}`);
        }
      }
    };
    document.addEventListener('click', this._docClickHandler);
  }

  // Bearbeitungsformular anzeigen
  showEditForm() {
    console.log('🎯 AUFTRAGSDETAILSDETAIL: Öffne Bearbeitungsformular für Details:', this.detailsId);

    // Edit laeuft seit dem Projekt-Erstellen-Wizard-Refactor ueber den Wizard
    // (gemeinsamer Pfad fuer Anlegen + Bearbeiten, konsistente Budget-Berechnung).
    // Wizard nutzt die auftrag_id, daher hier den Auftrag aus den geladenen Details.
    const auftragId = this.auftrag?.id || this.details?.auftrag_id;
    if (auftragId) {
      window.navigateTo(`/projekt-erstellen/edit/${auftragId}`);
    } else {
      console.warn('⚠️ AUFTRAGSDETAILSDETAIL: Keine Auftrag-ID gefunden, Fallback auf Wizard-Neuanlage');
      window.navigateTo('/projekt-erstellen');
    }
  }

  _mountNotiz() {
    this._notiz?.destroy();
    this._notiz = null;
    const root = window.content?.querySelector('[data-auftrag-notiz]');
    if (!root || !this.detailsId) return;
    this._notiz = new AuftragDetailsNotizController();
    this._notiz.mount(root, this.detailsId);
  }

  // Cleanup
  destroy() {
    console.log('AUFTRAGSDETAILSDETAIL: Cleaning up...');
    this._notiz?.destroy();
    this._notiz = null;
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
      this._docClickHandler = null;
    }
    this._eventsBound = false;
  }
}

export const auftragsdetailsDetail = new AuftragsdetailsDetail();

