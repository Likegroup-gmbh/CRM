// AuftragDetailFinanzen.js
// Finanzen-Tab: Lazy-Laden der Rechnungen, Summaries, Budget- und Rechnungs-Rendering
// (Prototype-Mixin von AuftragDetail)

import { AuftragDetail } from './AuftragDetailCore.js';
import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { summeKskSelbstzahler } from '../../core/budget/kskSelbstzahler.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { renderPdfLinks } from '../../core/icons/IconSystem.js';
import { fmtNum } from './AuftragDetailRenderer.js';

Object.assign(AuftragDetail.prototype, {
  // Lade Tab-Daten lazy (Rechnungen & Kooperationen-Summaries)
  async loadTabData(tabName) {
    if (!tabName || tabName === 'informationen') return null;

    const cacheKey = tabName === 'finanzen' ? 'rechnungen' : tabName;
    return await tabDataCache.load('auftrag', this.auftragId, cacheKey, async () => {
      console.log(`🔄 Lade Tab: ${cacheKey}`);
      
      try {
        switch(cacheKey) {
          case 'rechnungen':
            const { data: rechnungen } = await window.supabase
              .from('rechnung')
              .select('id, rechnung_nr, status, nettobetrag, bruttobetrag, gestellt_am, bezahlt_am, pdf_url, rechnung_pdfs(id, file_name, file_path, file_url)')
              .eq('auftrag_id', this.auftragId)
              .order('gestellt_am', { ascending: false });
            this.rechnungen = rechnungen || [];
            
            // Summaries bilden
            const sumNetto = (this.rechnungen || []).reduce((s, r) => s + (parseFloat(r.nettobetrag) || 0), 0);
            const sumBrutto = (this.rechnungen || []).reduce((s, r) => s + (parseFloat(r.bruttobetrag) || 0), 0);
            const paidCount = (this.rechnungen || []).filter(r => r.status === 'Bezahlt').length;
            const openCount = (this.rechnungen || []).filter(r => r.status !== 'Bezahlt').length;
            this.rechnungSummary = { count: (this.rechnungen || []).length, sumNetto, sumBrutto, paidCount, openCount };
            
            // Auch Kooperationen-Summary laden (für Budget-Vergleich)
            await this.calculateKoopSummary();
            await this.calculateRealCounts();
            
            this.updateRechnungenTab();
            this._finanzenLoaded = true;
            return rechnungen;
          default:
            return null;
        }
      } catch (error) {
        console.error(`❌ Fehler beim Laden von Tab ${cacheKey}:`, error);
        return null;
      }
    });
  },

  // Kooperationen-Summary berechnen
  async calculateKoopSummary() {
    try {
      const { data: kampagnen } = await window.supabase
        .from('kampagne')
        .select('id')
        .eq('auftrag_id', this.auftragId);
      const kampagneIds = (kampagnen || []).map(k => k.id);
      if (kampagneIds.length > 0) {
        const { data: koops } = await window.supabase
          .from('kooperationen')
          .select('einkaufspreis_netto, einkaufspreis_gesamt, ksk_selbstzahler, ksk_betrag')
          .in('kampagne_id', kampagneIds);
        // Netto inkl. KSK-Selbstzahler-Aufschlag; einkaufspreis_gesamt enthaelt die KSK bereits
        const sumNetto = (koops || []).reduce((s, k) => s + (parseFloat(k.einkaufspreis_netto) || 0), 0)
          + summeKskSelbstzahler(koops || []);
        const sumGesamt = (koops || []).reduce((s, k) => s + (parseFloat(k.einkaufspreis_gesamt) || 0), 0);
        this.koopSummary = { count: (koops || []).length, sumNetto, sumGesamt };
      } else {
        this.koopSummary = { count: 0, sumNetto: 0, sumGesamt: 0 };
      }
    } catch (_) {
      this.koopSummary = { count: 0, sumNetto: 0, sumGesamt: 0 };
    }
  },

  // Berechne echte Video- und Creator-Anzahl aus Kampagnen/Kooperationen
  async calculateRealCounts() {
    try {
      console.log('🔄 AUFTRAGDETAIL: Berechne echte Video- und Creator-Anzahl');
      
      // Alle Kampagnen für diesen Auftrag laden
      const { data: kampagnen, error: kampagnenError } = await window.supabase
        .from('kampagne')
        .select('id, videoanzahl, creatoranzahl')
        .eq('auftrag_id', this.auftragId);

      if (kampagnenError) {
        console.warn('⚠️ Fehler beim Laden der Kampagnen:', kampagnenError);
        return;
      }

      let totalVideos = 0;
      let totalCreators = 0;

      if (kampagnen && kampagnen.length > 0) {
        // Summe aus Kampagnen
        totalVideos = kampagnen.reduce((sum, k) => sum + (k.videoanzahl || 0), 0);
        totalCreators = kampagnen.reduce((sum, k) => sum + (k.creatoranzahl || 0), 0);

        // Zusätzlich Kooperationen für diese Kampagnen prüfen
        const kampagneIds = kampagnen.map(k => k.id);
        
        const { data: kooperationen, error: koopError } = await window.supabase
          .from('kooperationen')
          .select('videoanzahl, creator_id')
          .in('kampagne_id', kampagneIds);

        if (!koopError && kooperationen) {
          // Videos aus Kooperationen (falls nicht schon in Kampagnen erfasst)
          const koopVideos = kooperationen.reduce((sum, k) => sum + (k.videoanzahl || 0), 0);
          
          // Unique Creator aus Kooperationen
          const uniqueCreators = new Set(kooperationen.map(k => k.creator_id).filter(Boolean));
          
          // Verwende die höhere Zahl (entweder aus Kampagnen oder aus Kooperationen)
          totalVideos = Math.max(totalVideos, koopVideos);
          totalCreators = Math.max(totalCreators, uniqueCreators.size);
        }
      }

      this.realVideoCount = totalVideos;
      this.realCreatorCount = totalCreators;

      console.log('✅ AUFTRAGDETAIL: Echte Zahlen berechnet - Videos:', totalVideos, 'Creator:', totalCreators);
      
    } catch (error) {
      console.warn('⚠️ Fehler bei der Berechnung der echten Zahlen:', error);
      this.realVideoCount = 0;
      this.realCreatorCount = 0;
    }
  },

  // Tab-Update-Methoden
  updateRechnungenTab() {
    const container = document.querySelector('#tab-finanzen');
    if (container) {
      container.innerHTML = this.renderFinanzenTab();
    }
  },

  // Rendere Finanzen-Tab (Budget + Rechnungen)
  renderFinanzenTab() {
    return `
      <div class="detail-section">
        ${this.renderBudget()}
        
        <div class="auftrag-section-spacer">
          <h3>Rechnungen</h3>
          ${this.renderRechnungen()}
        </div>
      </div>
    `;
  },

  // Rendere Budget-Tab
  renderBudget() {
    const fmt = (v) => this.formatCurrency(v);
    const num = fmtNum;
    const a = this.auftrag || {};
    const ustProzent = a.ust_prozent != null ? a.ust_prozent : 19;
    const ustBetrag = a.ust_betrag != null ? a.ust_betrag : (parseFloat(a.nettobetrag || 0) * (parseFloat(ustProzent) / 100));
    const dbProzent = a.deckungsbeitrag_prozent != null ? a.deckungsbeitrag_prozent : 0;
    const dbBetrag = a.deckungsbeitrag_betrag != null ? a.deckungsbeitrag_betrag : (parseFloat(a.nettobetrag || 0) * (parseFloat(dbProzent) / 100));
    const itemsNetto = (parseFloat(a.influencer || 0) * parseFloat(a.influencer_preis || 0)) +
      (parseFloat(a.ugc || 0) * parseFloat(a.ugc_preis || 0)) +
      (parseFloat(a.vor_ort_produktion || 0) * parseFloat(a.vor_ort_preis || 0));
    return `
      <div class="detail-section">
        <div class="detail-grid">
          <div class="detail-card">
            <h3 class="section-title">Einnahmen (Auftrag)</h3>
            ${this.renderDetailItem({ icon: 'currency', label: 'Netto:', value: fmt(a.nettobetrag) })}
            ${this.renderDetailItem({ icon: 'info', label: 'USt (%):', value: num(ustProzent) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'USt Betrag:', value: fmt(ustBetrag) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Brutto Gesamtbudget:', value: fmt(a.bruttobetrag) })}
          </div>
          <div class="detail-card">
            <h3 class="section-title">Planwerte</h3>
            ${this.renderDetailItem({ icon: 'info', label: 'Geplanter Deckungsbeitrag (%):', value: num(dbProzent) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Geplanter Deckungsbeitrag (Betrag):', value: fmt(dbBetrag) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'KSK (5% von Netto):', value: fmt(a.ksk_betrag) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Creator Budget:', value: fmt(a.creator_budget) })}
          </div>
          <div class="detail-card">
            <h3 class="section-title">Preisaufbau (Netto)</h3>
            ${this.renderDetailItem({ icon: 'user', label: 'Influencer:', value: `${num(a.influencer)} × ${fmt(a.influencer_preis)}` })}
            ${this.renderDetailItem({ icon: 'video', label: 'UGC Video:', value: `${num(a.ugc)} × ${fmt(a.ugc_preis)}` })}
            ${this.renderDetailItem({ icon: 'video', label: 'Vor Ort Produktion:', value: `${num(a.vor_ort_produktion)} × ${fmt(a.vor_ort_preis)}` })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Summe Positionen (Netto):', value: fmt(itemsNetto) })}
          </div>
          <div class="detail-card">
            <h3 class="section-title">Rechnungen</h3>
            ${this.renderDetailItem({ icon: 'info', label: 'Anzahl:', value: num(this.rechnungSummary.count) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Summe Netto:', value: fmt(this.rechnungSummary.sumNetto) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Summe Brutto:', value: fmt(this.rechnungSummary.sumBrutto) })}
            ${this.renderDetailItem({ icon: 'check', label: 'Bezahlt / Offen:', value: `${num(this.rechnungSummary.paidCount)} / ${num(this.rechnungSummary.openCount)}` })}
          </div>
          <div class="detail-card">
            <h3 class="section-title">Ausgaben (Kooperationen)</h3>
            ${this.renderDetailItem({ icon: 'kooperation', label: 'Anzahl Kooperationen:', value: num(this.koopSummary.count) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Summe Nettokosten:', value: fmt(this.koopSummary.sumNetto) })}
            ${this.renderDetailItem({ icon: 'currency', label: 'Summe Gesamtkosten:', value: fmt(this.koopSummary.sumGesamt) })}
          </div>
        </div>
      </div>
    `;
  },

  // Rendere Rechnungen
  renderRechnungen() {
    if (!this.rechnungen || this.rechnungen.length === 0) {
      return renderEmptyState({
        icon: 'invoice',
        title: 'Keine Rechnungen vorhanden',
        text: 'Für diesen Auftrag wurden noch keine Rechnungen erstellt.'
      });
    }
    const fmt = (v) => v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '-';
    const fDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';
    const rows = this.rechnungen.map(r => `
      <tr>
        <td><a href="/rechnung/${r.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${window.validatorSystem.sanitizeHtml(r.rechnung_nr || '—')}</a></td>
        <td>${r.status || '-'}</td>
        <td>${fmt(r.nettobetrag)}</td>
        <td>${fmt(r.bruttobetrag)}</td>
        <td>${fDate(r.gestellt_am)}</td>
        <td>${fDate(r.bezahlt_am)}</td>
        <td>${renderPdfLinks(r.rechnung_pdfs, r.pdf_url)}</td>
      </tr>
    `).join('');
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rechnungs-Nr</th>
              <th>Status</th>
              <th>Netto</th>
              <th>Brutto</th>
              <th>Gestellt</th>
              <th>Bezahlt</th>
              <th>Beleg</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },
});
