// DashboardNeuigkeiten.js
// "Was ist neu"-Block auf dem Dashboard: die letzten Update-Posts.
// Nur intern (Admin/Mitarbeiter) - Kunden bekommen weder Block noch Request.

import { NeuigkeitenService } from '../neuigkeiten/NeuigkeitenService.js';
import { icon } from '../../core/icons/IconSystem.js';

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

export async function loadNeuigkeiten() {
  if (typeof window.isInternal !== 'function' || !window.isInternal()) return [];
  if (!window.supabase) return [];

  try {
    return await NeuigkeitenService.loadLatest(3);
  } catch (err) {
    console.error('❌ DashboardNeuigkeiten: Laden fehlgeschlagen:', err);
    return [];
  }
}

export function renderNeuigkeitenBlock(neuigkeiten) {
  if (typeof window.isInternal !== 'function' || !window.isInternal()) return '';
  if (!neuigkeiten || neuigkeiten.length === 0) return '';

  const items = neuigkeiten.map(n => `
    <li class="dashboard-neuigkeiten__item">
      <a href="/neuigkeiten/${encodeURIComponent(n.slug)}" class="dashboard-neuigkeiten__link" data-route="/neuigkeiten/${encodeURIComponent(n.slug)}">
        <span class="dashboard-neuigkeiten__titel">${escapeHtml(n.titel)}</span>
        ${n.teaser ? `<span class="dashboard-neuigkeiten__teaser">${escapeHtml(n.teaser)}</span>` : ''}
        <span class="dashboard-neuigkeiten__datum">${formatDatum(n.published_at)}</span>
      </a>
    </li>
  `).join('');

  return `
    <div class="dashboard-section dashboard-neuigkeiten">
      <h3 class="dashboard-section__title dashboard-neuigkeiten__title">Was ist neu</h3>
      <ul class="dashboard-neuigkeiten__list">
        ${items}
      </ul>
      <a href="/neuigkeiten" class="dashboard-neuigkeiten__alle" data-route="/neuigkeiten">
        Alle Updates
        ${icon('arrow-right')}
      </a>
    </div>
  `;
}
