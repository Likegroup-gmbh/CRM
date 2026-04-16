// KampagneDetailSummaryCards.js
// Summary-Kacheln: Berechnung, Rendering und DOM-Updates

import { KampagneUtils } from './KampagneUtils.js';

export function calculateSummaryCards(kooperationen, videos) {
  const koopBudgetSum = (videos || []).reduce((sum, v) => sum + (parseFloat(v.verkaufspreis_netto) || 0), 0);
  const koopVideosUsed = (kooperationen || []).reduce((sum, koop) => sum + (parseInt(koop.videoanzahl, 10) || 0), 0);
  const uniqueCreatorIds = new Set();
  (kooperationen || []).forEach(koop => {
    if (koop.creator_id) uniqueCreatorIds.add(koop.creator_id);
  });
  const koopCreatorsUsed = uniqueCreatorIds.size;

  console.log('✅ KAMPAGNEDETAIL: Summary Cards berechnet:', { budget: koopBudgetSum, videos: koopVideosUsed, creators: koopCreatorsUsed });
  return { koopBudgetSum, koopVideosUsed, koopCreatorsUsed };
}

export function updateSummaryCardsDOM(kampagneData, koopBudgetSum, koopVideosUsed, koopCreatorsUsed) {
  const totalBudget = parseFloat(
    kampagneData?.auftrag?.creator_budget ||
    kampagneData?.auftrag?.gesamt_budget ||
    kampagneData?.auftrag?.bruttobetrag ||
    kampagneData?.auftrag?.nettobetrag || 0
  );
  const usedBudget = koopBudgetSum || 0;
  const openBudget = Math.max(0, totalBudget - usedBudget);
  const totalVideos = kampagneData?.videoanzahl || 0;
  const totalCreators = kampagneData?.creatoranzahl || 0;

  const budgetPct = KampagneUtils.getProgressPercentage(usedBudget, totalBudget);
  const openPct = totalBudget > 0 ? Math.max(0, 100 - budgetPct) : 0;

  const setBudgetColor = (el, pct) => {
    el.className = 'summary-progress-fill';
    if (pct >= 90) el.classList.add('summary-progress-fill--danger');
    else if (pct >= 75) el.classList.add('summary-progress-fill--warning');
  };

  // Gesamtbudget
  const totalBudgetVal = document.querySelector('[data-summary-value="total-budget"]');
  if (totalBudgetVal) totalBudgetVal.textContent = `${KampagneUtils.formatCurrency(usedBudget)} / ${KampagneUtils.formatCurrency(totalBudget)}`;
  const totalBudgetProg = document.querySelector('[data-summary-progress="total-budget"]');
  if (totalBudgetProg) { totalBudgetProg.style.width = `${budgetPct}%`; setBudgetColor(totalBudgetProg, budgetPct); }

  // Verbrauchtes Budget
  const spentVal = document.querySelector('[data-summary-value="spent-budget"]');
  if (spentVal) spentVal.textContent = KampagneUtils.formatCurrency(usedBudget);
  const spentProg = document.querySelector('[data-summary-progress="spent-budget"]');
  if (spentProg) { spentProg.style.width = `${budgetPct}%`; setBudgetColor(spentProg, budgetPct); }

  // Offenes Budget
  const openVal = document.querySelector('[data-summary-value="open-budget"]');
  if (openVal) openVal.textContent = KampagneUtils.formatCurrency(openBudget);
  const openProg = document.querySelector('[data-summary-progress="open-budget"]');
  if (openProg) {
    openProg.style.width = `${openPct}%`;
    openProg.className = 'summary-progress-fill';
    if (openPct <= 10) openProg.classList.add('summary-progress-fill--danger');
    else if (openPct <= 25) openProg.classList.add('summary-progress-fill--warning');
    else openProg.classList.add('summary-progress-fill--success');
  }

  // Creator & Videos (nur Werte, keine Progress-Bars)
  const creatorsVal = document.querySelector('[data-summary-value="creators"]');
  if (creatorsVal) creatorsVal.textContent = `${KampagneUtils.num(koopCreatorsUsed || 0)} von ${KampagneUtils.num(totalCreators)}`;

  const videosVal = document.querySelector('[data-summary-value="videos"]');
  if (videosVal) videosVal.textContent = `${KampagneUtils.num(koopVideosUsed || 0)} von ${KampagneUtils.num(totalVideos)}`;
}

export function renderSummaryCards(kampagneData, koopBudgetSum, koopVideosUsed, koopCreatorsUsed) {
  const totalBudget = parseFloat(
    kampagneData?.auftrag?.creator_budget ||
    kampagneData?.auftrag?.gesamt_budget ||
    kampagneData?.auftrag?.bruttobetrag ||
    kampagneData?.auftrag?.nettobetrag || 0
  );
  const usedBudget = koopBudgetSum || 0;
  const openBudget = Math.max(0, totalBudget - usedBudget);
  const totalVideos = kampagneData?.videoanzahl || 0;
  const usedVideos = koopVideosUsed || 0;
  const totalCreators = kampagneData?.creatoranzahl || 0;
  const usedCreators = koopCreatorsUsed || 0;

  const budgetPct = KampagneUtils.getProgressPercentage(usedBudget, totalBudget);
  const openPct = totalBudget > 0 ? Math.max(0, 100 - budgetPct) : 0;

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

  const isAdmin = window.currentUser?.rolle === 'admin';

  return `
    <div class="auftragsdetails-summary" style="margin-bottom: var(--space-xl);">
      <div class="summary-cards">
        ${isAdmin ? `
        <div class="summary-card" data-summary-card="total-budget">
          <div class="summary-value" data-summary-value="total-budget">${KampagneUtils.formatCurrency(usedBudget)} / ${KampagneUtils.formatCurrency(totalBudget)}</div>
          <div class="summary-label">Gesamtbudget</div>
          <div class="summary-progress">
            <div class="summary-progress-fill ${getBudgetColorClass(budgetPct)}" data-summary-progress="total-budget"
                 style="width: ${budgetPct}%">
            </div>
          </div>
        </div>
        <div class="summary-card" data-summary-card="spent-budget">
          <div class="summary-value" data-summary-value="spent-budget">${KampagneUtils.formatCurrency(usedBudget)}</div>
          <div class="summary-label">Verbrauchtes Budget</div>
          <div class="summary-progress">
            <div class="summary-progress-fill ${getBudgetColorClass(budgetPct)}" data-summary-progress="spent-budget"
                 style="width: ${budgetPct}%">
            </div>
          </div>
        </div>
        <div class="summary-card" data-summary-card="open-budget">
          <div class="summary-value" data-summary-value="open-budget">${KampagneUtils.formatCurrency(openBudget)}</div>
          <div class="summary-label">Offenes Budget</div>
          <div class="summary-progress">
            <div class="summary-progress-fill ${getOpenBudgetColorClass(openPct)}" data-summary-progress="open-budget"
                 style="width: ${openPct}%">
            </div>
          </div>
        </div>` : ''}
        <div class="summary-card" data-summary-card="creators">
          <div class="summary-value" data-summary-value="creators">${KampagneUtils.num(usedCreators)} von ${KampagneUtils.num(totalCreators)}</div>
          <div class="summary-label">Gebuchte Creator</div>
        </div>
        <div class="summary-card" data-summary-card="videos">
          <div class="summary-value" data-summary-value="videos">${KampagneUtils.num(usedVideos)} von ${KampagneUtils.num(totalVideos)}</div>
          <div class="summary-label">Gebuchte Videos</div>
        </div>
      </div>
    </div>
  `;
}
