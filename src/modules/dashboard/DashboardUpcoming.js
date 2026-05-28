// DashboardUpcoming.js
// Lädt und rendert anstehende Kampagnen + Kooperationen mit Sichtbarkeitsfilter

import { KampagneUtils } from '../kampagne/KampagneUtils.js';

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Lädt anstehende Kampagnen (nach Deadline sortiert).
 * Respektiert Sichtbarkeitsfilter je nach Rolle.
 */
export async function loadUpcomingKampagnen() {
  if (!window.supabase) return [];

  try {
    const allowedIds = await KampagneUtils.loadAllowedKampagneIds();

    let query = window.supabase
      .from('kampagne')
      .select('id, kampagnenname, eigener_name, deadline, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname)')
      .not('deadline', 'is', null)
      .gte('deadline', new Date().toISOString().split('T')[0])
      .order('deadline', { ascending: true })
      .limit(10);

    if (Array.isArray(allowedIds)) {
      if (allowedIds.length === 0) return [];
      query = query.in('id', allowedIds);
    }

    const { data, error } = await query;
    if (error) {
      console.error('❌ DashboardUpcoming: Fehler beim Laden der Kampagnen:', error);
      return [];
    }

    return (data || []).map(k => ({
      id: k.id,
      name: KampagneUtils.getDisplayName(k),
      deadline: k.deadline,
      unternehmen: k.unternehmen?.firmenname || '',
      marke: k.marke?.markenname || ''
    }));
  } catch (err) {
    console.error('❌ DashboardUpcoming: Unerwarteter Fehler (Kampagnen):', err);
    return [];
  }
}

/**
 * Lädt aktive Kooperationen.
 * Filtert basierend auf erlaubten Kampagnen-IDs.
 */
export async function loadUpcomingKooperationen() {
  if (!window.supabase) return [];

  try {
    const allowedIds = await KampagneUtils.loadAllowedKampagneIds();

    let query = window.supabase
      .from('kooperationen')
      .select('id, name, status, kampagne:kampagne_id(id, kampagnenname, eigener_name), creator:creator_id(vorname, nachname)')
      .order('created_at', { ascending: false })
      .limit(10);

    if (Array.isArray(allowedIds)) {
      if (allowedIds.length === 0) return [];
      query = query.in('kampagne_id', allowedIds);
    }

    const { data, error } = await query;
    if (error) {
      console.error('❌ DashboardUpcoming: Fehler beim Laden der Kooperationen:', error);
      return [];
    }

    return (data || []).map(k => ({
      id: k.id,
      name: k.name || '—',
      status: k.status || '',
      kampagne: k.kampagne ? KampagneUtils.getDisplayName(k.kampagne) : '',
      kampagneId: k.kampagne?.id || null,
      creator: k.creator ? `${k.creator.vorname || ''} ${k.creator.nachname || ''}`.trim() : ''
    }));
  } catch (err) {
    console.error('❌ DashboardUpcoming: Unerwarteter Fehler (Kooperationen):', err);
    return [];
  }
}

function formatDeadline(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

  const formatted = date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

  if (diffDays <= 0) return `<span class="dashboard-upcoming__deadline--overdue">${formatted}</span>`;
  if (diffDays <= 3) return `<span class="dashboard-upcoming__deadline--urgent">${formatted}</span>`;
  return formatted;
}

/**
 * Rendert den Kampagnen-Block.
 */
export function renderKampagnenBlock(kampagnen) {
  if (!kampagnen || kampagnen.length === 0) {
    return `
      <div class="dashboard-section dashboard-upcoming dashboard-upcoming--kampagnen">
        <h3 class="dashboard-section__title dashboard-upcoming__title">Nächste Kampagnen</h3>
        <p class="dashboard-section__empty dashboard-upcoming__empty">Keine anstehenden Kampagnen.</p>
      </div>
    `;
  }

  const items = kampagnen.map(k => `
    <li class="dashboard-upcoming__item" data-route="/kampagne/${k.id}">
      <div class="dashboard-upcoming__info">
        <span class="dashboard-upcoming__name">${escapeHtml(k.name)}</span>
        <span class="dashboard-upcoming__meta">${escapeHtml(k.unternehmen)}${k.marke ? ' · ' + escapeHtml(k.marke) : ''}</span>
      </div>
      <span class="dashboard-upcoming__deadline">${formatDeadline(k.deadline)}</span>
    </li>
  `).join('');

  return `
    <div class="dashboard-section dashboard-upcoming dashboard-upcoming--kampagnen">
      <h3 class="dashboard-section__title dashboard-upcoming__title">Nächste Kampagnen</h3>
      <ul class="dashboard-upcoming__list">
        ${items}
      </ul>
    </div>
  `;
}

/**
 * Rendert den Kooperationen-Block.
 */
export function renderKooperationenBlock(kooperationen) {
  if (!kooperationen || kooperationen.length === 0) {
    return `
      <div class="dashboard-section dashboard-upcoming dashboard-upcoming--kooperationen">
        <h3 class="dashboard-section__title dashboard-upcoming__title">Aktuelle Kooperationen</h3>
        <p class="dashboard-section__empty dashboard-upcoming__empty">Keine aktiven Kooperationen.</p>
      </div>
    `;
  }

  const items = kooperationen.map(k => `
    <li class="dashboard-upcoming__item" data-route="/kooperation/${k.id}">
      <div class="dashboard-upcoming__info">
        <span class="dashboard-upcoming__name">${escapeHtml(k.name)}</span>
        <span class="dashboard-upcoming__meta">${escapeHtml(k.creator)}${k.kampagne ? ' · ' + escapeHtml(k.kampagne) : ''}</span>
      </div>
      ${k.status ? `<span class="dashboard-upcoming__status">${escapeHtml(k.status)}</span>` : ''}
    </li>
  `).join('');

  return `
    <div class="dashboard-section dashboard-upcoming dashboard-upcoming--kooperationen">
      <h3 class="dashboard-section__title dashboard-upcoming__title">Aktuelle Kooperationen</h3>
      <ul class="dashboard-upcoming__list">
        ${items}
      </ul>
    </div>
  `;
}
