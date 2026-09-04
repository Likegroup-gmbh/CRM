// DashboardNeuigkeiten.js
// "Was ist neu"-Kachel auf dem Dashboard: kompakte Cards mit den letzten
// Update-Kurztexten (Du-Form, kein Tutorial). Es gibt keine Detail-Seite
// mehr - der volle Text steht direkt in der Card.
// Nur intern (Admin/Mitarbeiter) - Kunden bekommen weder Kachel noch Request.

import { NeuigkeitenService } from '../neuigkeiten/NeuigkeitenService.js';

const STANDARD_ANZAHL = 3;
const NEU_TAGE = 7;

// Die zuletzt geladenen neuesten Meldungen, damit "Weniger anzeigen" ohne
// erneuten Request auskommt.
let neuesteCache = [];

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDatum(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function istNeu(iso) {
  if (!iso) return false;
  const alterMs = Date.now() - new Date(iso).getTime();
  return alterMs >= 0 && alterMs < NEU_TAGE * 24 * 60 * 60 * 1000;
}

export async function loadNeuigkeiten() {
  if (typeof window.isInternal !== 'function' || !window.isInternal()) return [];
  if (!window.supabase) return [];

  try {
    // Eine mehr laden als angezeigt: so erkennen wir, ob es weitere gibt
    neuesteCache = await NeuigkeitenService.loadLatest(STANDARD_ANZAHL + 1);
    return neuesteCache;
  } catch (err) {
    console.error('❌ DashboardNeuigkeiten: Laden fehlgeschlagen:', err);
    return [];
  }
}

function renderCard(n) {
  return `
    <article class="dashboard-neuigkeiten__card">
      <div class="dashboard-neuigkeiten__card-header">
        <h4 class="dashboard-neuigkeiten__card-titel">${escapeHtml(n.titel)}</h4>
        ${istNeu(n.published_at) ? '<span class="dashboard-neuigkeiten__badge">Neu</span>' : ''}
      </div>
      ${n.kurztext ? `<p class="dashboard-neuigkeiten__card-text">${escapeHtml(n.kurztext)}</p>` : ''}
      <span class="dashboard-neuigkeiten__datum">${formatDatum(n.published_at)}</span>
    </article>
  `;
}

export function renderNeuigkeitenBlock(neuigkeiten, { expanded = false } = {}) {
  if (typeof window.isInternal !== 'function' || !window.isInternal()) return '';
  if (!neuigkeiten || neuigkeiten.length === 0) return '';

  const hatMehr = !expanded && neuigkeiten.length > STANDARD_ANZAHL;
  const sichtbar = expanded ? neuigkeiten : neuigkeiten.slice(0, STANDARD_ANZAHL);
  const toggle = hatMehr
    ? '<button type="button" class="dashboard-neuigkeiten__toggle" data-action="neuigkeiten-alle">Alle anzeigen</button>'
    : expanded
      ? '<button type="button" class="dashboard-neuigkeiten__toggle" data-action="neuigkeiten-weniger">Weniger anzeigen</button>'
      : '';

  return `
    <div class="dashboard-section dashboard-neuigkeiten">
      <h3 class="dashboard-section__title dashboard-neuigkeiten__title">Was ist neu</h3>
      <div class="dashboard-neuigkeiten__cards">
        ${sichtbar.map(renderCard).join('')}
      </div>
      ${toggle}
    </div>
  `;
}

// Bindet den Toggle-Button. Laueft nach jedem Re-Render des Blocks erneut
// (Expand ersetzt den Block per outerHTML).
export function bindNeuigkeitenEvents() {
  const toggle = document.querySelector('.dashboard-neuigkeiten__toggle[data-action]');
  if (!toggle) return;

  toggle.addEventListener('click', async () => {
    const block = toggle.closest('.dashboard-neuigkeiten');
    if (!block) return;

    if (toggle.dataset.action === 'neuigkeiten-alle') {
      toggle.disabled = true;
      try {
        const alle = await NeuigkeitenService.loadAll();
        block.outerHTML = renderNeuigkeitenBlock(alle, { expanded: true });
      } catch (err) {
        console.error('❌ DashboardNeuigkeiten: Alle laden fehlgeschlagen:', err);
        toggle.disabled = false;
        return;
      }
    } else {
      block.outerHTML = renderNeuigkeitenBlock(neuesteCache);
    }
    bindNeuigkeitenEvents();
  });
}
