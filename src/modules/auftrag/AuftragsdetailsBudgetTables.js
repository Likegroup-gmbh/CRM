// Tabellen der Auftragsdetails: Kampagnen, Zusatzleistungen, Kategorien.

import { summeKskSelbstzahler } from '../../core/budget/kskSelbstzahler.js';
import { renderEmptyState, renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { CHIP_PREFIX_MAP } from '../projekt-erstellen/logic/CampaignBudgetFields.js';

// Rendere Kampagnen-Übersichtstabelle mit aggregierten Kosten
export function renderKampagnenTable(detail) {
  if (!detail.kampagnen || detail.kampagnen.length === 0) {
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

  const rowsHtml = detail.kampagnen.map(kampagne => {
    const koops = detail.kooperationen.filter(k => k.kampagne_id === kampagne.id);
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
export function renderZusatzleistungenTable(detail) {
  const details = detail.details;
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
export function renderKategorienTable(detail) {
  const details = detail.details;
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
  const auftragStart = formatDate(detail.auftrag?.start);
  const auftragEnde = formatDate(detail.auftrag?.ende);

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
