// AuftragsdetailsDetail.js (ES6-Modul)
// Auftragsdetails-Detailseite ohne Tabs - direkte Anzeige der Informationen

import { renderAgencyFeeCardHtml, renderKskCardHtml, calculateCreatorPaymentSummary, renderCreatorAnteilCardHtml } from '../../core/budget/EkVkAgencyFeeHelper.js';
import { calculateBudgetOverview, getBudgetCardVariant } from '../../core/budget/calculateBudgetOverview.js';
import { summeKskSelbstzahler } from '../../core/budget/kskSelbstzahler.js';
import { renderEmptyState, renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { CHIP_PREFIX_MAP } from '../projekt-erstellen/logic/CampaignBudgetFields.js';

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
        const canEdit = window.currentUser?.permissions?.auftragsdetails?.can_edit !== false;
        window.breadcrumbSystem.updateDetailLabel(this.auftrag.auftragsname || 'Details', {
          id: 'btn-edit-details',
          canEdit: canEdit
        });
      }
      
      this.render();
      this.bindEvents();
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

        // Rechnungen pro Kooperation laden (Status + Netto für Creatoranteil-Breakdown)
        const { data: rechnungen, error: rechnungError } = await window.supabase
          .from('rechnung')
          .select('id, status, nettobetrag, kooperation_id, rechnungstyp')
          .in('kooperation_id', koopIds);

        if (rechnungError) {
          console.warn('⚠️ AUFTRAGSDETAILSDETAIL: Rechnungen konnten nicht geladen werden:', rechnungError);
          this.rechnungen = [];
          this.rechnungStatusMap = {};
        } else {
          this.rechnungen = rechnungen || [];
          this.rechnungStatusMap = this.rechnungen.reduce((acc, r) => {
            if (r.kooperation_id) acc[r.kooperation_id] = r.status;
            return acc;
          }, {});
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

  // Rendere Auftragsdetails-Detailseite
  render() {
    window.setHeadline(`${this.auftrag?.auftragsname || 'Auftragsdetails'} - Details`);
    
    const html = `
      <div class="content-section">
        ${this.renderInformationen()}
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Rendere Informationen
  renderInformationen() {
    const num = (v) => v || v === 0 ? new Intl.NumberFormat('de-DE').format(v) : '-';
    const formatCurrency = (v) => {
      if (v === null || v === undefined) return '-';
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    };

    const auftragtype = this.auftrag?.auftragtype || '-';
    const canViewInternalBudget = window.canSeePricing();
    const sanitize = (v) => window.validatorSystem?.sanitizeHtml(v) || v || '';

    const auftragsvolumen = parseFloat(this.auftrag?.nettobetrag) || 0;
    const verbrauchtesBudget = this.budgetSummary.verbrauchtesBudget || 0;
    const verfuegbaresBudget = this.budgetSummary.verfuegbaresBudget || 0;
    const creatorAnteil = this.budgetSummary.creatorAnteil || 0;
    const budgetPct = auftragsvolumen > 0 ? Math.min(100, Math.round((verbrauchtesBudget / auftragsvolumen) * 100)) : 0;
    const openPct = auftragsvolumen > 0 ? Math.max(0, 100 - budgetPct) : 0;

    const getBudgetColorClass = (pct) => {
      if (pct >= 90) return 'summary-progress-fill--danger';
      if (pct >= 75) return 'summary-progress-fill--warning';
      return '';
    };
    const getOpenBudgetColorClass = (pct) => {
      if (pct <= 10) return 'summary-progress-fill--danger';
      if (pct <= 25) return 'summary-progress-fill--warning';
      return 'summary-progress-fill--success';
    };

    const d = this.details || {};
    const extraServices = Array.isArray(d.extra_services) ? d.extra_services : [];
    const validExtraServices = (d.extra_services_enabled !== false)
      ? extraServices.filter(s => s && typeof s.name === 'string' && s.name.trim())
      : [];

    const agencyFeeSummary = this.budgetSummary.agencyFeeSummary || {};
    const creatorPayment = calculateCreatorPaymentSummary(creatorAnteil, this.rechnungen);

    const zusatzleistungenCardsHtml = canViewInternalBudget
      ? validExtraServices.map(s => `
            <div class="summary-card">
              <div class="summary-value">${formatCurrency(parseFloat(s.amount) || 0)}</div>
              <div class="summary-label">${sanitize(s.name)}</div>
            </div>
          `).join('')
      : '';

    const budgetCardVariant = this.getBudgetCardVariant();

    // Influencer-Variante: festgelegtes Creatorbudget, Verbrauch ueber VK-Preise
    const creatorBudget = this.budgetSummary.totalBudget || 0;
    const verbrauchtesCreatorBudget = this.budgetSummary.usedVkBudget || 0;
    const offenesBudget = Math.max(0, creatorBudget - verbrauchtesCreatorBudget);
    const creatorBudgetPct = creatorBudget > 0 ? Math.min(100, Math.round((verbrauchtesCreatorBudget / creatorBudget) * 100)) : 0;
    const offenesBudgetPct = creatorBudget > 0 ? Math.max(0, 100 - creatorBudgetPct) : 0;

    const budgetCardsHtml = budgetCardVariant === 'influencer' ? `
            <div class="summary-card">
              <div class="summary-value">${formatCurrency(auftragsvolumen)}</div>
              <div class="summary-label">Gesamt Nettobetrag</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${formatCurrency(creatorBudget)}</div>
              <div class="summary-label">Creatorbudget</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${formatCurrency(verbrauchtesCreatorBudget)}</div>
              <div class="summary-label">Verbrauchtes Creatorbudget</div>
              <div class="summary-progress">
                <div class="summary-progress-fill ${getBudgetColorClass(creatorBudgetPct)}"
                     style="width: ${creatorBudgetPct}%">
                </div>
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${formatCurrency(offenesBudget)}</div>
              <div class="summary-label">Offenes Creator Budget</div>
              <div class="summary-progress">
                <div class="summary-progress-fill ${getOpenBudgetColorClass(offenesBudgetPct)}"
                     style="width: ${offenesBudgetPct}%">
                </div>
              </div>
            </div>
            ${renderKskCardHtml(agencyFeeSummary, formatCurrency)}
            ${renderAgencyFeeCardHtml(agencyFeeSummary, formatCurrency, { canSeePricing: true })}
            <div class="summary-card">
              <div class="summary-value">${formatCurrency(this.budgetSummary.extraKostenVkSum || 0)}</div>
              <div class="summary-label">Zusatzkosten</div>
            </div>
            ${zusatzleistungenCardsHtml}` : `
            <div class="summary-card">
              <div class="summary-value">${formatCurrency(auftragsvolumen)}</div>
              <div class="summary-label">Auftragsvolumen</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${formatCurrency(verfuegbaresBudget)}</div>
              <div class="summary-label">Verfügbares Budget</div>
              <div class="summary-progress">
                <div class="summary-progress-fill ${getOpenBudgetColorClass(openPct)}"
                     style="width: ${openPct}%">
                </div>
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${formatCurrency(verbrauchtesBudget)}</div>
              <div class="summary-label">Verbrauchtes Budget</div>
              <div class="summary-progress">
                <div class="summary-progress-fill ${getBudgetColorClass(budgetPct)}"
                     style="width: ${budgetPct}%">
                </div>
              </div>
            </div>
            ${renderCreatorAnteilCardHtml(creatorAnteil, creatorPayment, formatCurrency)}
            ${renderAgencyFeeCardHtml(agencyFeeSummary, formatCurrency, { canSeePricing: true })}
            ${renderKskCardHtml(agencyFeeSummary, formatCurrency)}
            <div class="summary-card">
              <div class="summary-value">${formatCurrency(this.budgetSummary.extraKostenVkSum || 0)}</div>
              <div class="summary-label">Zusatzkosten</div>
            </div>
            ${zusatzleistungenCardsHtml}`;

    return `
      <div class="detail-section">
        <!-- Budget-Kacheln -->
        <div class="auftragsdetails-summary">
          <div class="summary-cards">
            ${canViewInternalBudget ? budgetCardsHtml : ''}
            ${!canViewInternalBudget ? renderAgencyFeeCardHtml(agencyFeeSummary, formatCurrency, { canSeePricing: false }) : ''}
          </div>
        </div>

        <!-- Kategorien-Übersicht Tabelle -->
        ${this.renderKategorienTable()}

        <!-- Zusatzleistungen -->
        ${this.renderZusatzleistungenTable()}

        <!-- Kampagnen-Übersicht -->
        ${this.renderKampagnenTable()}

        <!-- Gebuchte Creator & Videos Cards -->
        <div class="auftragsdetails-summary u-mt-lg">
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-value">${num(this.budgetSummary.totalCreators)} von ${num(this.budgetSummary.targetCreators)}</div>
              <div class="summary-label">Gebuchte Creator</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${num(this.budgetSummary.totalVideos)} von ${num(this.budgetSummary.targetVideos)}</div>
              <div class="summary-label">Gebuchte Videos</div>
            </div>
          </div>
        </div>

        <!-- Kooperationen & Videos -->
        <div class="detail-section">
          <h3 class="section-title section-title--spaced">Kooperationen & Videos</h3>
          ${this.renderCreatorVideosTable()}
        </div>
      </div>
    `;
  }

  // Rendere Kampagnen-Übersichtstabelle mit aggregierten Kosten
  renderKampagnenTable() {
    if (!this.kampagnen || this.kampagnen.length === 0) {
      return `
        <div class="detail-section u-mt-lg">
          <h3 class="section-title section-title--spaced">Kampagnen</h3>
          ${renderEmptyState({
            icon: 'megaphone',
            title: 'Keine Kampagnen vorhanden',
            text: 'Für diesen Auftrag wurden noch keine Kampagnen angelegt.'
          })}
        </div>
      `;
    }

    const formatCurrency = (v) => {
      if (v === null || v === undefined) return '-';
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    };
    const sanitize = (v) => window.validatorSystem?.sanitizeHtml(v) || v || '';
    const isAdmin = window.isAdmin();
    const isKunde = window.isKunde();

    let totalEk = 0;
    let totalVk = 0;
    let totalKoops = 0;
    let totalVideos = 0;

    const rowsHtml = this.kampagnen.map(kampagne => {
      const koops = this.kooperationen.filter(k => k.kampagne_id === kampagne.id);
      const koopCount = koops.length;
      const videoCount = koops.reduce((sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 0);
      // EK inkl. KSK-Selbstzahler-Aufschlag (echte Creator-Kosten)
      const ekGesamt = koops.reduce((sum, k) => sum + (parseFloat(k.einkaufspreis_netto) || 0), 0) + summeKskSelbstzahler(koops);
      const vkGesamt = koops.reduce((sum, k) => sum + (parseFloat(k.verkaufspreis_netto) || 0), 0);

      totalEk += ekGesamt;
      totalVk += vkGesamt;
      totalKoops += koopCount;
      totalVideos += videoCount;

      const kampagneNameHtml = isKunde
        ? sanitize(kampagne.kampagnenname || 'Ohne Name')
        : `<a href="#" class="table-link" data-table="kampagne" data-id="${kampagne.id}">
              ${sanitize(kampagne.kampagnenname || 'Ohne Name')}
            </a>`;

      return `
        <tr>
          <td>${kampagneNameHtml}</td>
          <td class="text-center">${koopCount}</td>
          <td class="text-center">${videoCount}</td>
          ${isAdmin ? `
          <td class="text-right">${formatCurrency(ekGesamt)}</td>
          <td class="text-right">${formatCurrency(vkGesamt)}</td>
          ` : ''}
        </tr>
      `;
    }).join('');

    return `
      <div class="detail-section u-mt-lg">
        <h3 class="section-title section-title--spaced">Kampagnen</h3>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Kampagnenname</th>
                <th class="text-center">Kooperationen</th>
                <th class="text-center">Videos</th>
                ${isAdmin ? `
                <th class="text-right">EK Netto</th>
                <th class="text-right">VK Netto</th>
                ` : ''}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr class="fw-600">
                <td>Gesamt</td>
                <td class="text-center">${totalKoops}</td>
                <td class="text-center">${totalVideos}</td>
                ${isAdmin ? `
                <td class="text-right">${formatCurrency(totalEk)}</td>
                <td class="text-right">${formatCurrency(totalVk)}</td>
                ` : ''}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }

  // Rendere Zusatzleistungen-Tabelle (aus auftrag_details.extra_services)
  renderZusatzleistungenTable() {
    const details = this.details;
    if (!details) return '';

    if (details.extra_services_enabled === false) return '';

    const services = Array.isArray(details.extra_services) ? details.extra_services : [];
    const valid = services.filter(s => s && typeof s.name === 'string' && s.name.trim());
    if (valid.length === 0) return '';

    const isKunde = window.isKunde();
    const isAdmin = window.isAdmin();
    const showAmount = isAdmin && !isKunde;

    const formatCurrency = (v) => {
      const n = parseFloat(v);
      if (isNaN(n)) return '-';
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
    };
    const sanitize = (v) => window.validatorSystem?.sanitizeHtml(v) || v || '';

    let total = 0;
    const rowsHtml = valid.map(s => {
      const amount = parseFloat(s.amount) || 0;
      total += amount;
      return `
        <tr>
          <td>${sanitize(s.name)}</td>
          ${showAmount ? `<td class="text-right">${formatCurrency(amount)}</td>` : ''}
        </tr>
      `;
    }).join('');

    return `
      <div class="detail-section u-mt-lg">
        <h3 class="section-title section-title--spaced">Zusatzleistungen</h3>
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Leistung</th>
                ${showAmount ? '<th class="text-right">Betrag (Netto)</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            ${showAmount ? `
            <tfoot>
              <tr class="fw-600">
                <td>Gesamt</td>
                <td class="text-right">${formatCurrency(total)}</td>
              </tr>
            </tfoot>
            ` : ''}
          </table>
        </div>
      </div>
    `;
  }

  // Rendere Kategorien-Übersichtstabelle (UGC, Influencer, Vor Ort, etc.)
  renderKategorienTable() {
    const details = this.details;
    if (!details) return '';

    const isKunde = window.isKunde();
    const num = (v) => v || v === 0 ? new Intl.NumberFormat('de-DE').format(v) : '-';
    const formatCurrency = (v) => {
      if (v === null || v === undefined || v === '') return '-';
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    };
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
    const formatPriceRange = (von, bis) => {
      if (!von && !bis) return '-';
      if (von && bis && von !== bis) {
        return `${formatCurrency(von)} - ${formatCurrency(bis)}`;
      }
      return formatCurrency(von || bis);
    };
    
    // Start und Ende aus Auftrag
    const auftragStart = formatDate(this.auftrag?.start);
    const auftragEnde = formatDate(this.auftrag?.ende);

    // Im Wizard gewaehlte Kampagnenarten (Slugs) auf Section-Prefixe mappen,
    // damit sie auch ohne gepflegte Werte als Zeile erscheinen.
    const selectedChips = Array.isArray(details.campaign_type) ? details.campaign_type : [];
    const selectedPrefixes = new Set(
      selectedChips.map(chip => CHIP_PREFIX_MAP[chip]).filter(Boolean)
    );

    // Daten für die Tabelle vorbereiten (kanonische Kampagnenarten seit der Zusammenführung 2026-08)
    const sections = [
      {
        title: 'UGC Paid',
        prefix: 'ugc_paid',
        color: '#28a745',
        hasVideographen: false
      },
      {
        title: 'UGC Organic',
        prefix: 'ugc_organic',
        color: '#17a2b8',
        hasVideographen: false
      },
      {
        title: 'Influencer Kampagne',
        prefix: 'influencer',
        color: '#20c997',
        hasVideographen: false
      },
      {
        title: 'Influencer Story',
        prefix: 'story',
        color: '#e83e8c',
        hasVideographen: false
      },
      {
        title: 'Vor-Ort-Produktion',
        prefix: 'vor_ort',
        color: '#007bff',
        hasVideographen: true
      }
    ];

    const tableRows = sections.map(section => {
      const videoAnzahl = details[`${section.prefix}_video_anzahl`];
      const bilderAnzahl = details[`${section.prefix}_bilder_anzahl`];
      const creatorAnzahl = details[`${section.prefix}_creator_anzahl`];
      const videographenAnzahl = section.hasVideographen ? details[`${section.prefix}_videographen_anzahl`] : null;
      const budgetInfo = details[`${section.prefix}_budget_info`];
      const einkaufspreisVon = details[`${section.prefix}_einkaufspreis_netto_von`];
      const einkaufspreisBis = details[`${section.prefix}_einkaufspreis_netto_bis`];
      const verkaufspreisVon = details[`${section.prefix}_verkaufspreis_netto_von`];
      const verkaufspreisBis = details[`${section.prefix}_verkaufspreis_netto_bis`];

      // Gewaehlte Kampagnenarten immer zeigen, sonst nur Zeilen mit Daten
      const isSelected = selectedPrefixes.has(section.prefix);
      if (!isSelected && !videoAnzahl && !bilderAnzahl && !creatorAnzahl && !videographenAnzahl && !budgetInfo && !einkaufspreisVon && !einkaufspreisBis && !verkaufspreisVon && !verkaufspreisBis) {
        return '';
      }

      return `
        <tr>
          <td>
            <div class="section-indicator" style="background: ${section.color}"></div>
            ${section.title}
          </td>
          <td class="budget-cell">${budgetInfo ? `<div class="budget-info-large">${window.validatorSystem.sanitizeHtml(budgetInfo)}</div>` : '-'}</td>
          <td class="text-center">${auftragStart}</td>
          <td class="text-center">${auftragEnde}</td>
          ${!isKunde ? `<td class="text-right">${formatCurrency(einkaufspreisVon)}</td>` : ''}
          ${!isKunde ? `<td class="text-right">${formatCurrency(einkaufspreisBis)}</td>` : ''}
          <td class="text-right">${formatCurrency(verkaufspreisVon)}</td>
          <td class="text-right">${formatCurrency(verkaufspreisBis)}</td>
          <td class="text-center">${num(videoAnzahl)}</td>
          <td class="text-center">${num(bilderAnzahl)}</td>
          <td class="text-center">${num(creatorAnzahl)}</td>
          <td class="text-center">${section.hasVideographen ? num(videographenAnzahl) : '-'}</td>
        </tr>
      `;
    }).filter(row => row).join('');

    const kategorienHeader = `
              <th>Kategorie</th>
              <th>Budget & Informationen</th>
              <th class="text-center">Start</th>
              <th class="text-center">Ende</th>
              ${!isKunde ? '<th class="text-right">EK von</th>' : ''}
              ${!isKunde ? '<th class="text-right">EK bis</th>' : ''}
              <th class="text-right">VK von</th>
              <th class="text-right">VK bis</th>
              <th class="text-center">Videos</th>
              <th class="text-center">Bilder</th>
              <th class="text-center">Creator</th>
              <th class="text-center">Videographen</th>`;
    const kategorienColspan = isKunde ? 10 : 12;

    if (!tableRows) {
      return `
        <div class="data-table-container u-mt-lg">
          <table class="data-table auftragsdetails-table">
            <thead>
              <tr>${kategorienHeader}</tr>
            </thead>
            <tbody>
              ${renderEmptyStateRow({ icon: 'cube', title: 'Keine Produktionsdetails vorhanden' }, kategorienColspan)}
            </tbody>
          </table>
        </div>
      `;
    }

    return `
      <div class="data-table-container u-mt-lg">
        <table class="data-table auftragsdetails-table">
          <thead>
            <tr>${kategorienHeader}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Rendere Creator & Videos Tabelle
  renderCreatorVideosTable() {
    if (!this.kooperationen || this.kooperationen.length === 0) {
      return renderEmptyState({
        icon: 'handshake',
        title: 'Keine Kooperationen vorhanden',
        text: 'Für diesen Auftrag wurden noch keine Kooperationen mit Creator und Videos angelegt.'
      });
    }

    // Erstelle eine Liste aller Videos mit Creator-Informationen
    const videoRows = [];
    
    this.kooperationen.forEach(koop => {
      const creator = koop.creator || {};
      const creatorName = [creator.vorname, creator.nachname].filter(Boolean).join(' ') || 'Unbekannt';
      const creatorId = creator.id;
      
      // Videos für diese Kooperation
      const koopVideos = this.videos.filter(v => v.kooperation_id === koop.id);
      
      const kampagne = koop.kampagne;

      if (koopVideos.length === 0) {
        videoRows.push({
          creatorName,
          creatorId,
          kategorie: '-',
          videoTitel: '-',
          videoLink: null,
          kooperationId: koop.id,
          kooperationName: koop.name || 'Kooperation',
          kampagneId: kampagne?.id,
          kampagneName: kampagne?.kampagnenname || '-',
          ekNetto: koop.einkaufspreis_netto,
          vkNetto: koop.verkaufspreis_netto,
          extraKostenVk: koop.verkaufspreis_zusatzkosten
        });
      } else {
        koopVideos.forEach(video => {
          const videoLink = video.link_content || video.asset_url || null;
          videoRows.push({
            creatorName,
            creatorId,
            kategorie: video.content_art || '-',
            videoTitel: video.titel || video.thema || '-',
            videoLink,
            videoName: video.video_name || null,
            kooperationId: koop.id,
            kooperationName: koop.name || 'Kooperation',
            videoId: video.id,
            kampagneId: kampagne?.id,
            kampagneName: kampagne?.kampagnenname || '-',
            ekNetto: video.einkaufspreis_netto,
            vkNetto: video.verkaufspreis_netto,
            extraKostenVk: koop.verkaufspreis_zusatzkosten
          });
        });
      }
    });

    if (videoRows.length === 0) {
      return `
        <div class="u-mt-xl">
          <h3 class="u-mb-md">Creator & Videos Übersicht</h3>
          ${renderEmptyState({
            icon: 'video',
            title: 'Keine Videos vorhanden',
            text: 'Für diesen Auftrag wurden noch keine Videos angelegt.'
          })}
        </div>
      `;
    }

    const isKunde = window.isKunde();
    const formatCurrency = (v) => {
      if (v === null || v === undefined) return '-';
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    };

    const formatCreatorbudgetPct = (pct) => new Intl.NumberFormat('de-DE', {
      maximumFractionDigits: 1,
    }).format(pct ?? 0);

    const renderRechnungStatusBadge = (kooperationId) => {
      const status = this.rechnungStatusMap[kooperationId];
      if (!status) {
        return '<span class="status-badge status-nicht-erstellt">Nicht erstellt</span>';
      }
      const slug = status.toLowerCase().replace(/\s+/g, '-').replace(/ü/g, 'ue').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ß/g, 'ss');
      return `<span class="status-badge status-${slug}">${status}</span>`;
    };

    const rowsHtml = videoRows.map(row => {
      const sanitize = (v) => window.validatorSystem.sanitizeHtml(v);
      const videoDisplayName = row.videoName || row.videoTitel;
      const videoHtml = row.videoLink
        ? `<a href="${sanitize(row.videoLink)}" target="_blank" rel="noopener noreferrer" class="table-link">
             ${sanitize(videoDisplayName)}
             ${icon('external-link', { className: 'icon-14' })}
           </a>`
        : (videoDisplayName && videoDisplayName !== '-' ? sanitize(videoDisplayName) : '-');
      
      const creatorLinkHtml = isKunde
        ? sanitize(row.creatorName)
        : (row.creatorId
          ? `<a href="#" class="table-link" data-table="creator" data-id="${row.creatorId}">
               ${sanitize(row.creatorName)}
             </a>`
          : sanitize(row.creatorName));

      const kampagneLinkHtml = isKunde
        ? sanitize(row.kampagneName)
        : (row.kampagneId
          ? `<a href="#" class="table-link" data-table="kampagne" data-id="${row.kampagneId}">${sanitize(row.kampagneName)}</a>`
          : sanitize(row.kampagneName));

      return `
        <tr>
          <td>${creatorLinkHtml}</td>
          <td>${kampagneLinkHtml}</td>
          ${!isKunde ? `<td>${sanitize(row.kategorie)}</td>` : ''}
          ${!isKunde ? `<td class="text-right">${formatCurrency(row.ekNetto)}</td>` : ''}
          <td class="text-right">${formatCurrency(row.vkNetto)}</td>
          ${!isKunde ? `<td class="text-right">${formatCurrency(row.extraKostenVk)}</td>` : ''}
          <td>${renderRechnungStatusBadge(row.kooperationId)}</td>
          <td>${videoHtml}</td>
        </tr>
      `;
    }).join('');

    return `
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Kampagne</th>
                ${!isKunde ? '<th>Kategorie</th>' : ''}
                ${!isKunde ? '<th class="text-right">EK Netto</th>' : ''}
                <th class="text-right">VK Netto</th>
                ${!isKunde ? '<th class="text-right">Extra Kosten (VK)</th>' : ''}
                <th>Rechnungsstatus</th>
                <th>Video</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            ${!isKunde ? `
            <tfoot>
              <tr>
                <td colspan="3">Gesamt</td>
                <td class="text-right">${formatCurrency(this.budgetSummary.ekSum || 0)}</td>
                <td class="text-right">${formatCurrency(this.budgetSummary.vkSum || 0)}</td>
                <td class="text-right">${formatCurrency(this.budgetSummary.extraKostenVkSum || 0)}</td>
                <td colspan="2"></td>
              </tr>
              ${this.budgetSummary.ekVkMarginSum ? `
              <tr>
                <td colspan="3">Differenz (VK − EK)</td>
                <td></td>
                <td class="text-right">
                  <div class="data-table-footer-value-group">
                    <span>${formatCurrency(this.budgetSummary.ekVkMarginSum)}</span>
                    <div class="tags tags-compact">
                      <span class="tag tag--branche">${formatCreatorbudgetPct(this.budgetSummary.ekVkMarginCreatorbudgetPct)}% Creatorbudget</span>
                    </div>
                  </div>
                </td>
                <td colspan="3"></td>
              </tr>` : ''}
            </tfoot>
            ` : ''}
          </table>
        </div>
    `;
  }


  // Formatiere Ansprechpartner
  formatAnsprechpartner(ansprechpartner) {
    if (!ansprechpartner) return '-';
    const name = [ansprechpartner.vorname, ansprechpartner.nachname].filter(Boolean).join(' ');
    return ansprechpartner.email ? `${name} (${ansprechpartner.email})` : name;
  }

  // Berechne Progress-Prozentsatz für Videos/Creator
  getProgressPercentage(current, total) {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((current / total) * 100));
  }

  // Bestimme Farbe für Progress-Bar basierend auf Prozentsatz (Videos/Creator)
  getProgressColorClass(current, total) {
    if (!total || total <= 0) return '';
    const percentage = this.getProgressPercentage(current, total);
    
    if (percentage >= 100) return 'summary-progress-fill--success';
    if (percentage >= 75) return 'summary-progress-fill--warning';
    return '';
  }

  // Berechne Budget Progress-Prozentsatz
  getBudgetProgressPercentage() {
    if (this.getBudgetCardVariant() === 'influencer') {
      const creatorBudget = this.budgetSummary.totalBudget || 0;
      if (creatorBudget <= 0) return 0;
      return Math.min(100, Math.round(((this.budgetSummary.usedVkBudget || 0) / creatorBudget) * 100));
    }
    const auftragsvolumen = parseFloat(this.auftrag?.nettobetrag) || 0;
    if (auftragsvolumen <= 0) return 0;
    return Math.min(100, Math.round(((this.budgetSummary.verbrauchtesBudget || 0) / auftragsvolumen) * 100));
  }

  // Bestimme Farbe für Budget Progress-Bar
  getBudgetProgressColorClass() {
    const percentage = this.getBudgetProgressPercentage();
    
    if (percentage >= 90) return 'summary-progress-fill--danger';
    if (percentage >= 75) return 'summary-progress-fill--warning';
    return '';
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

  // Cleanup
  destroy() {
    console.log('AUFTRAGSDETAILSDETAIL: Cleaning up...');
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
      this._docClickHandler = null;
    }
    this._eventsBound = false;
  }
}

export const auftragsdetailsDetail = new AuftragsdetailsDetail();

