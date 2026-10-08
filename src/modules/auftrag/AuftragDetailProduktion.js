// AuftragDetailProduktion.js
// Auftragsdetails-Tab: Produktionsuebersicht, Budget-Verbrauch, Kooperationen- und Video-Tabelle
// (Prototype-Mixin von AuftragDetail)

import { AuftragDetail } from './AuftragDetailCore.js';
import { getKampagnenartConfig } from './logic/KampagnenartenMapping.js';
import { berechneVerfuegbaresBudget } from '../../core/budget/EkVkAgencyFeeHelper.js';
import { summeKskSelbstzahler } from '../../core/budget/kskSelbstzahler.js';
import { renderEmptyState, renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import { fmtNum } from './AuftragDetailRenderer.js';

// Netto-Beträge aus Kooperationen summieren (inkl. KSK-Aufschlaege)
const verbrauchtesBudgetNetto = (kooperationen) =>
  kooperationen.reduce((sum, koop) => sum + (parseFloat(koop.einkaufspreis_netto) || 0), 0)
  + summeKskSelbstzahler(kooperationen);

Object.assign(AuftragDetail.prototype, {
  /**
   * Sammelt die Kampagnenarten
   * PRIMÄR: Aus dem Auftrag selbst (art_der_kampagne_namen)
   * FALLBACK: Aus den geladenen Kampagnen
   * @returns {string[]} - Array der eindeutigen Kampagnenarten-Namen
   */
  collectKampagnenartenFromKampagnen() {
    const artenSet = new Set();
    
    // PRIMÄR: Kampagnenarten direkt vom Auftrag
    if (this.auftrag?.art_der_kampagne_namen?.length > 0) {
      this.auftrag.art_der_kampagne_namen.forEach(name => {
        if (name) artenSet.add(name);
      });
      console.log('📋 AUFTRAGDETAIL: Kampagnenarten aus Auftrag verwendet:', Array.from(artenSet));
      return Array.from(artenSet);
    }
    
    // FALLBACK: Aus den Kampagnen (für Abwärtskompatibilität)
    (this.kampagnen || []).forEach(kampagne => {
      // Kampagnenarten können in verschiedenen Formaten kommen
      const arten = kampagne.kampagne_art_typen || kampagne.art_der_kampagne;
      if (Array.isArray(arten)) {
        arten.forEach(art => {
          if (typeof art === 'string') {
            artenSet.add(art);
          } else if (art?.name) {
            artenSet.add(art.name);
          }
        });
      } else if (arten?.name) {
        artenSet.add(arten.name);
      }
    });
    
    console.log('📋 AUFTRAGDETAIL: Kampagnenarten aus Kampagnen verwendet:', Array.from(artenSet));
    return Array.from(artenSet);
  },

  // Rendere Auftragsdetails-Tab
  renderAuftragsdetails() {
    if (!this.auftragsDetails) {
      const isMitarbeiter = window.isMitarbeiter();
      return renderEmptyState({
        icon: 'document',
        title: 'Keine Auftragsdetails vorhanden',
        text: 'Es wurden noch keine detaillierten Produktionsinformationen für diesen Auftrag hinterlegt.',
        actionsHtml: !isMitarbeiter
          ? `<button onclick="window.navigateTo('/projekt-erstellen/edit/${this.auftragId}')" class="mdc-btn">Auftragsdetails anlegen</button>`
          : ''
      });
    }

    const details = this.auftragsDetails;
    const num = fmtNum;

    // Sammle Kampagnenarten aus den Kampagnen
    const kampagnenarten = this.collectKampagnenartenFromKampagnen();
    
    // Daten für die Tabelle dynamisch aus Kampagnenarten generieren
    const colorPalette = ['#28a745', '#6f42c1', '#fd7e14', '#20c997', '#007bff', '#dc3545'];
    const sections = kampagnenarten.map((artName, index) => {
      const config = getKampagnenartConfig(artName);
      if (!config) return null;
      return {
        title: config.displayName || artName,
        prefix: config.prefix,
        color: colorPalette[index % colorPalette.length],
        hasCreator: config.hasCreator,
        hasBilder: config.hasBilder,
        hasVideographen: config.hasVideographen
      };
    }).filter(s => s !== null)
      // Dedupe nach Prefix: Legacy-Namen können auf dieselbe kanonische Art zeigen
      .filter((s, i, arr) => arr.findIndex(x => x.prefix === s.prefix) === i);
    
    // Fallback auf alle Sections wenn keine Kampagnenarten gefunden wurden
    // (für Abwärtskompatibilität mit bestehenden Daten)
    let usingFallbackSections = false;
    if (sections.length === 0) {
      usingFallbackSections = true;
      sections.push(
        { title: 'UGC Paid', prefix: 'ugc_paid', color: '#28a745', hasCreator: true, hasBilder: false, hasVideographen: false },
        { title: 'UGC Organic', prefix: 'ugc_organic', color: '#6f42c1', hasCreator: true, hasBilder: false, hasVideographen: false },
        { title: 'Influencer Kampagne', prefix: 'influencer', color: '#007bff', hasCreator: true, hasBilder: false, hasVideographen: false },
        { title: 'Influencer Story', prefix: 'story', color: '#e83e8c', hasCreator: true, hasBilder: false, hasVideographen: false },
        { title: 'Vor-Ort-Produktion', prefix: 'vor_ort', color: '#dc3545', hasCreator: true, hasBilder: false, hasVideographen: true }
      );
    }

    const tableRows = sections.map(section => {
      const videoAnzahl = details[`${section.prefix}_video_anzahl`];
      const bilderAnzahl = details[`${section.prefix}_bilder_anzahl`];
      const creatorAnzahl = details[`${section.prefix}_creator_anzahl`];
      const budgetInfo = details[`${section.prefix}_budget_info`];

      // Gewählte Kampagnenarten immer zeigen; nur im Fallback (keine Arten
      // bekannt) auf Zeilen mit Daten begrenzen
      if (usingFallbackSections && !videoAnzahl && !bilderAnzahl && !creatorAnzahl && !budgetInfo) {
        return '';
      }

      return `
        <tr>
          <td>
            <div class="section-indicator" style="background: ${section.color}"></div>
            ${section.title}
          </td>
          <td class="budget-cell">${budgetInfo ? `<div class="budget-info-large">${window.validatorSystem.sanitizeHtml(budgetInfo)}</div>` : '-'}</td>
          <td class="text-center">${num(videoAnzahl)}</td>
          <td class="text-center">${section.hasBilder ? num(bilderAnzahl) : '-'}</td>
          <td class="text-center">${section.hasCreator ? num(creatorAnzahl) : '-'}</td>
        </tr>
      `;
    }).filter(row => row).join('');

    return `
      <div class="detail-section">
        <div class="auftragsdetails-summary">
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-value">${num(this.realVideoCount)}</div>
              <div class="summary-label">Videos erstellt</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${num(this.realCreatorCount)}</div>
              <div class="summary-label">Creator gebucht</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${this.formatBudgetUsage()}</div>
              <div class="summary-label">Budget verbraucht</div>
              <div class="summary-progress">
                <div class="summary-progress-fill ${this.getBudgetProgressColorClass()}" 
                     style="width: ${Math.min(100, this.getBudgetPercentage())}%">
                </div>
              </div>
              ${(this.auftrag?.creator_budget || this.auftrag?.nettobetrag) ? `<div class="summary-planned">${this.getBudgetPercentage()}%</div>` : ''}
            </div>
            ${this.renderAuftragsbestaetigungCard()}
          </div>
        </div>

        <div class="data-table-container">
          <table class="data-table auftragsdetails-table">
            <thead>
              <tr>
                <th>Kategorie</th>
                <th>Budget & Informationen</th>
                <th class="text-center">Videos</th>
                <th class="text-center">Bilder</th>
                <th class="text-center">Creator</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || renderEmptyStateRow({ icon: 'cube', title: 'Keine Produktionsdetails vorhanden' }, 5)}
            </tbody>
          </table>
        </div>

        <!-- Kooperationen & Videos Tabelle -->
        <div class="auftrag-section-spacer">
          <h3>Kooperationen & Videos</h3>
          ${this.renderKooperationenVideosTable()}
        </div>
      </div>
    `;
  },

  // Rendere Auftragsbestätigung Card
  renderAuftragsbestaetigungCard() {
    const hasBestaetigung = this.auftrag?.auftragsbestaetigung_url;
    
    if (hasBestaetigung) {
      return `
        <div class="summary-card summary-card--document">
          <div class="summary-icon">📄</div>
          <div class="summary-label">Auftragsbestätigung</div>
          <a href="${this.auftrag.auftragsbestaetigung_url}" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="mdc-btn mdc-btn--secondary mdc-btn--sm u-mt-xs">
            <span class="mdc-btn__label">Öffnen</span>
            ${icon('external-link', { className: 'icon-16' })}
          </a>
        </div>
      `;
    }
    
    return `
      <div class="summary-card summary-card--document summary-card--empty">
        <div class="summary-icon u-opacity-50">📄</div>
        <div class="summary-label u-text-tertiary">Keine Auftragsbestätigung</div>
      </div>
    `;
  },

  // Formatiere Budget-Verbrauch (Netto-Beträge)
  formatBudgetUsage() {
    // Verfuegbares Budget (read-derived): creator_budget + KSK-Umbuchungen der Selbstzahler
    const totalBudget = berechneVerfuegbaresBudget(this.auftrag, this.kooperationen).verfuegbar;
    
    const usedBudget = verbrauchtesBudgetNetto(this.kooperationen);

    const formatCurrency = (v) => v ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '0,00 €';
    return `${formatCurrency(usedBudget)} von ${formatCurrency(totalBudget)}`;
  },

  // Berechne Budget-Prozentsatz (Netto-Beträge)
  getBudgetPercentage() {
    // Verfuegbares Budget (read-derived): creator_budget + KSK-Umbuchungen der Selbstzahler
    const totalBudget = berechneVerfuegbaresBudget(this.auftrag, this.kooperationen).verfuegbar;
    
    const usedBudget = verbrauchtesBudgetNetto(this.kooperationen);

    if (totalBudget <= 0) return 0;
    return Math.round((usedBudget / totalBudget) * 100);
  },

  // Bestimme Farbe für Budget Progress-Bar
  getBudgetProgressColorClass() {
    const percentage = this.getBudgetPercentage();
    
    if (percentage >= 90) return 'summary-progress-fill--danger';
    if (percentage >= 75) return 'summary-progress-fill--warning';
    return '';
  },

  // Rendere Kooperationen & Videos Tabelle
  renderKooperationenVideosTable() {
    if (!this.kooperationen || this.kooperationen.length === 0) {
      return renderEmptyState({
        icon: 'handshake',
        title: 'Keine Kooperationen vorhanden',
        text: 'Für diesen Auftrag wurden noch keine Kooperationen angelegt.'
      });
    }

    const formatCurrency = (value) => value ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value) : '-';
    const isKunde = window.isKunde();

    const rows = this.kooperationen.map(koop => {
      const creator = koop.creator || {};
      const creatorName = [creator.vorname, creator.nachname].filter(Boolean).join(' ') || '-';
      
      // Videos für diese Kooperation
      const koopVideos = this.videos.filter(v => v.kooperation_id === koop.id);
      
      // Budget-Info aus den Auftragsdetails holen (basierend auf Typ)
      let budgetInfo = '-';
      if (this.auftragsDetails && koop.typ) {
        const typ = koop.typ.toLowerCase().replace(/\s+/g, '_');
        budgetInfo = this.auftragsDetails[`${typ}_budget_info`] || '-';
      }
      
      // Video-Links rendern (wie in KampagneKooperationenVideoTable)
      const renderVideoLinks = (videos) => {
        if (!videos || videos.length === 0) {
          return '<span class="text-muted">-</span>';
        }
        
        return `<div class="video-fields-stack">${videos.map(video => {
          const videoUrl = video.asset_url || video.link_content;
          if (videoUrl) {
            return `
              <div class="video-field-wrapper">
                <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="Link in neuem Tab öffnen">
                  ${icon('external-link', { className: 'icon-20' })}
                </a>
              </div>
            `;
          } else {
            return '<div class="video-field-wrapper"><span class="text-muted">-</span></div>';
          }
        }).join('')}</div>`;
      };
      
      // Video-Titel rendern
      const renderVideoTitles = (videos) => {
        if (!videos || videos.length === 0) {
          return '<span class="text-muted">-</span>';
        }
        
        return `<div class="video-fields-stack">${videos.map(video => `
          <div class="video-field-wrapper">
            ${window.validatorSystem.sanitizeHtml(video.titel || video.thema || 'Video')}
            ${video.content_art ? `<span class="content-art-hint"> (${video.content_art})</span>` : ''}
          </div>
        `).join('')}</div>`;
      };
      
      return `
        <tr>
          <td>
            <a href="#" class="table-link" data-table="creator" data-id="${creator.id || ''}">
              ${window.validatorSystem.sanitizeHtml(creatorName)}
            </a>
          </td>
          <td class="text-center">${koop.videoanzahl || 0}</td>
          <td class="budget-cell">
            ${budgetInfo !== '-' ? `<div class="budget-info">${window.validatorSystem.sanitizeHtml(budgetInfo)}</div>` : '-'}
          </td>
          ${!isKunde ? `<td class="text-right">${formatCurrency(koop.einkaufspreis_gesamt)}</td>` : ''}
          <td class="video-stack-cell">${renderVideoTitles(koopVideos)}</td>
          <td class="video-stack-cell text-center">${renderVideoLinks(koopVideos)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th class="text-center">Anzahl Videos</th>
              <th>Budget & Informationen</th>
              ${!isKunde ? '<th class="text-right">Kosten (Einkauf)</th>' : ''}
              <th>Video Titel</th>
              <th class="text-center">Video Link</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  },
});
