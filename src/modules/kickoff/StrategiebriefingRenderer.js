// StrategiebriefingRenderer.js
// Shared renderer for Strategiebriefing tab in Marke + Unternehmen detail views

import { StrategiebriefingService } from './StrategiebriefingService.js';

const BRIEFING_TYPES = ['influencer', 'organic', 'paid'];

function getTypeLabel(type) {
  return StrategiebriefingService.getLabel(type);
}

export function renderStrategiebriefing(detail, { parentType = 'marke' } = {}) {
  const availableCount = Object.values(detail.kickoffsByType).filter(Boolean).length;
  const activeKickoff = detail.kickoffsByType[detail.activeKickoffType];
  const isKunde = window.isKunde();

  if (availableCount === 0) {
    if (parentType === 'marke' && !detail._kickoffLoaded) {
      return `<div class="empty-state"><p>Laden...</p></div>`;
    }
    return `
      <div class="empty-state">
        <h3>Kein Strategiebriefing vorhanden</h3>
        <p>Es wurde noch kein Strategiebriefing erstellt.</p>
        ${!isKunde ? `<button type="button" class="btn btn-primary kickoff-detail-create-btn">Strategiebriefing anlegen</button>` : ''}
      </div>
    `;
  }

  const typeSwitcher = `
    <div class="tab-navigation kickoff-type-switcher">
      ${BRIEFING_TYPES.map(type => {
        const item = detail.kickoffsByType[type];
        const isActive = detail.activeKickoffType === type;
        const hasData = !!item;
        return `<button type="button" class="tab-button ${isActive ? 'active' : ''} ${!hasData ? 'tab-button--empty' : ''} kickoff-type-btn" data-kickoff-type="${type}">${getTypeLabel(type)}</button>`;
      }).join('')}
    </div>
  `;

  if (!activeKickoff) {
    const typeLabel = getTypeLabel(detail.activeKickoffType);
    return `
      <div class="detail-section">
        ${typeSwitcher}
        <div class="empty-state">
          <h3>Kein ${typeLabel} Strategiebriefing vorhanden</h3>
          <p>Für den Typ ${typeLabel} wurde noch kein Strategiebriefing erstellt.</p>
          ${!isKunde ? `<button type="button" class="btn btn-primary kickoff-detail-create-btn" data-kickoff-type="${detail.activeKickoffType}">${typeLabel} Strategiebriefing anlegen</button>` : ''}
        </div>
      </div>
    `;
  }

  const isV2 = StrategiebriefingService.isV2(activeKickoff);
  const typeLabel = getTypeLabel(activeKickoff.kampagnenart || activeKickoff.kickoff_type);
  const tableHtml = isV2
    ? renderV2Table(detail, activeKickoff)
    : renderLegacyTable(detail, activeKickoff);

  return `
    <div class="detail-section">
      ${typeSwitcher}
      ${tableHtml}
      <div class="kickoff-meta">
        <small class="text-muted">
          ${typeLabel}${!isV2 ? ' (Legacy)' : ''} | Zuletzt aktualisiert: ${detail.formatDate(activeKickoff.updated_at)}
        </small>
        ${!isKunde ? `<a href="/kickoff/${activeKickoff.id}" class="btn btn-sm btn-secondary" onclick="event.preventDefault(); window.navigateTo('/kickoff/${activeKickoff.id}')" style="margin-left: 1rem;">Details</a>` : ''}
      </div>
    </div>
  `;
}

function renderV2Table(detail, k) {
  const fv = (value) => {
    if (!value) return '<span class="text-muted">-</span>';
    return detail.sanitize(value).replace(/\n/g, '<br>');
  };

  const rows = [
    ['Kampagnen-Zusammenfassung', fv(k.kampagnen_zusammenfassung)],
  ];

  if (k.kampagnenart === 'influencer' || k.kickoff_type === 'influencer') {
    if (k.ziel_influencer) rows.push(['Ziel', fv(k.ziel_influencer)]);
    if (k.format_influencer) rows.push(['Format', fv(k.format_influencer)]);
  }
  if (k.kampagnenart === 'paid' || k.kickoff_type === 'paid') {
    if (k.funnel) rows.push(['Funnel', fv(k.funnel)]);
    if (k.ziel_paid) rows.push(['Ziel', fv(k.ziel_paid)]);
  }
  if (k.kampagnenart === 'organic' || k.kickoff_type === 'organic') {
    if (k.ziel_organic) rows.push(['Ziel', fv(k.ziel_organic)]);
    if (k.format_organic) rows.push(['Format', fv(k.format_organic)]);
  }

  rows.push(
    ['Was wird beworben?', fv(k.beworben_typ)],
    ['Beschreibung', fv(k.beworben_beschreibung)],
    ['Plattformen', Array.isArray(k.plattformen) && k.plattformen.length > 0
      ? k.plattformen.map(p => `<span class="tag">${detail.sanitize(p)}</span>`).join(' ')
      : '<span class="text-muted">-</span>'],
    ['Creator-Branche', fv(k.creator_branche)],
    ['Drehort', fv(k.drehort)],
    ['Rechtliches', fv(k.rechtliches)],
    ['Erfolgskriterien', fv(k.erfolgskriterien)],
    ['Learnings', fv(k.learnings)]
  );

  return buildTable(rows);
}

function renderLegacyTable(detail, k) {
  const fv = (value) => {
    if (!value) return '<span class="text-muted">-</span>';
    return detail.sanitize(value).replace(/\n/g, '<br>');
  };

  const activeMarkenwerte = detail.kickoffMarkenwerteByType?.[detail.activeKickoffType] || [];
  const markenwerteHtml = activeMarkenwerte.length > 0
    ? activeMarkenwerte.map(mw => `<span class="tag tag--markenwert">${detail.sanitize(mw.name)}</span>`).join(' ')
    : '<span class="text-muted">-</span>';

  const rows = [
    ['1. Brand-Essenz', fv(k.brand_essenz)],
    ['2. Mission / Zweck', fv(k.mission)],
    ['3. Markenwerte', markenwerteHtml],
    ['4. Zielgruppe', fv(k.zielgruppe)],
    ['5. Zielgruppen-Mindset', fv(k.zielgruppen_mindset)],
    ['6. Marken-USP', fv(k.marken_usp)],
    ['7. Tonalität & Sprachstil', fv(k.tonalitaet_sprachstil)],
    ['8. Content-Charakter', fv(k.content_charakter)],
    ["9. Do's & Don'ts", fv(k.dos_donts)],
    ['10. Rechtliche Leitplanken', fv(k.rechtliche_leitplanken)]
  ];

  return `<p class="text-muted" style="font-size: 0.8rem; margin-bottom: 0.5rem;">Legacy Strategiebriefing (nur Ansicht)</p>${buildTable(rows)}`;
}

function buildTable(rows) {
  return `
    <div class="data-table-container">
      <table class="data-table kickoff-table">
        <thead>
          <tr>
            <th style="width: 30%;">Kategorie</th>
            <th>Inhalt</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(([label, value]) => `<tr><td><strong>${label}</strong></td><td>${value}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function bindStrategiebriefingCreateButton(detail, { parentType = 'marke' } = {}) {
  const btn = document.querySelector('.kickoff-detail-create-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const presetType = btn.dataset.kickoffType || null;

    const container = btn.closest('.empty-state') || btn.closest('.detail-section');
    if (!container) return;

    const formHtml = window.formSystem.renderFormOnly('strategiebriefing_embedded');
    container.innerHTML = `
      <div class="kickoff-panel-header">
        <h3 class="kickoff-panel-header__title">Strategiebriefing anlegen</h3>
      </div>
      <div class="form-page" id="kickoff-inline-form-wrapper">
        ${formHtml}
      </div>
      <div class="form-actions" style="margin-top: 1rem; padding: 0 1rem;">
        <button type="button" class="mdc-btn mdc-btn--cancel" id="kickoff-inline-cancel">Abbrechen</button>
        <button type="button" class="mdc-btn mdc-btn--create" id="kickoff-inline-save">Strategiebriefing speichern</button>
      </div>
    `;

    window.formSystem.bindFormEvents('strategiebriefing_embedded', null);

    if (presetType) {
      const kampagnenartSelect = container.querySelector('[name="kampagnenart"]');
      if (kampagnenartSelect) {
        kampagnenartSelect.value = presetType;
        kampagnenartSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    const inlineForm = container.querySelector('form');
    if (inlineForm) {
      inlineForm.onsubmit = (e) => e.preventDefault();
      const submitRow = inlineForm.querySelector('.form-actions');
      if (submitRow) submitRow.style.display = 'none';
    }

    document.getElementById('kickoff-inline-cancel')?.addEventListener('click', () => {
      if (detail.renderContent) detail.renderContent();
      else if (detail.render) { detail.render(); detail.bindEvents(); }
    });

    document.getElementById('kickoff-inline-save')?.addEventListener('click', async () => {
      const saveBtn = document.getElementById('kickoff-inline-save');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Speichert...'; }

      try {
        const kickoffForm = container.querySelector('form');
        if (!kickoffForm) throw new Error('Formular nicht gefunden');

        const formData = window.formSystem.collectSubmitData(kickoffForm);
        const kampagnenart = formData.kampagnenart || kickoffForm.querySelector('[name="kampagnenart"]')?.value;

        if (!kampagnenart) {
          window.toastSystem?.show('Bitte Kampagnenart auswählen', 'error');
          if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Strategiebriefing speichern'; }
          return;
        }

        const validation = window.validatorSystem.validateForm(formData, StrategiebriefingService.getValidationRules());
        if (!validation.isValid) {
          window.toastSystem?.show('Bitte alle Pflichtfelder ausfüllen', 'error');
          if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Strategiebriefing speichern'; }
          return;
        }

        const parentId = detail.data?.id || detail.markeId || detail.unternehmenId;
        await StrategiebriefingService.saveBriefing(formData, {
          markeId: parentType === 'marke' ? parentId : null,
          unternehmenId: parentType === 'unternehmen' ? parentId : null,
          kampagnenart
        });

        window.toastSystem?.show('Strategiebriefing erfolgreich erstellt!', 'success');

        if (detail.loadData) {
          await detail.loadData(parentId);
          if (detail.renderContent) detail.renderContent();
        }
      } catch (err) {
        console.error('❌ Strategiebriefing Speicherfehler:', err);
        window.toastSystem?.show('Fehler beim Speichern: ' + err.message, 'error');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Strategiebriefing speichern'; }
      }
    });
  });
}
