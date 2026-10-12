// rezension.js
// Eine Rezension pro Kooperation. Der Wert ist der Mittelwert der beiden
// Achsen, der Creator-Wert der Mittelwert dieser Rezensionen. Ohne Rezension
// gibt es keinen Wert. Kunden sehen weder Sterne noch Kommentar.

import { icon } from '../../core/icons/IconSystem.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';

const STAR = icon('star');

const esc = (value) => window.validatorSystem?.sanitizeHtml?.(String(value ?? '')) ?? String(value ?? '');

export function darfRezensionSehen() {
  if (typeof window.isInternal !== 'function') return true;
  return window.isInternal();
}

export function darfRezensionSchreiben() {
  return darfRezensionSehen() && Boolean(window.canEdit?.('kooperation'));
}

export function wertDerRezension(produktion, kommunikation) {
  return (Number(produktion) + Number(kommunikation)) / 2;
}

export function creatorWert(reviews) {
  if (!reviews?.length) return null;
  const sum = reviews.reduce(
    (acc, review) => acc + wertDerRezension(review.produktionsqualitaet, review.kommunikation_verlaesslichkeit),
    0
  );
  return sum / reviews.length;
}

export function formatRezension(value) {
  if (value == null || value === '') return '–';
  const n = Number(value);
  if (!Number.isFinite(n)) return '–';
  return n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function ganzeSterne(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** Mindestwert gewinnt. „Ohne Bewertung“ fällt dann weg. */
export function settleRezensionFilters(filters) {
  if (!filters) return filters;
  const min = filters.rezension_min;
  if (min == null || min === '') return filters;
  if (!filters.rezension_ohne) return filters;
  const next = { ...filters };
  delete next.rezension_ohne;
  return next;
}

export function matchesRezension(schnitt, filter) {
  if (filter?.type === 'rezension_min') {
    return schnitt != null && schnitt !== '' && Number(schnitt) >= filter.value;
  }
  if (filter?.type === 'rezension_ohne') return schnitt == null || schnitt === '';
  return true;
}

function stars(axis, value, canEdit) {
  const chosen = ganzeSterne(value);
  const buttons = [1, 2, 3, 4, 5].map((n) => {
    const on = chosen != null && n <= chosen;
    return `<button type="button" class="rezension-star${on ? ' is-on' : ''}" role="radio" data-axis="${axis}" data-value="${n}" aria-checked="${chosen === n ? 'true' : 'false'}" aria-label="${n} von 5" ${canEdit ? '' : 'disabled'}>${STAR}</button>`;
  }).join('');
  return `<div class="rezension-stars" role="radiogroup">${buttons}</div>`;
}

function person(name) {
  return esc(name || 'Unbekannt');
}

function infoRow(iconKey, label, valueHtml) {
  return `
    <div class="profile-info-item">
      <div class="info-icon">${icon(iconKey)}</div>
      <div class="info-label">${label}</div>
      <div class="info-value">${valueHtml}</div>
    </div>
  `;
}

export function renderKooperationRezension(rezension, { canEdit = false } = {}) {
  if (!darfRezensionSehen()) return '';
  const wert = rezension
    ? formatRezension(wertDerRezension(rezension.produktionsqualitaet, rezension.kommunikation_verlaesslichkeit))
    : '–';
  const namen = rezension ? `
    ${infoRow('user', 'Angelegt von', person(rezension.angelegt_von))}
    ${infoRow('user', 'Zuletzt geändert von', person(rezension.geaendert_von))}
  ` : '';

  return `
    <div class="detail-card" id="koop-rezension" data-rezension-id="${esc(rezension?.id || '')}">
      <h3 class="section-title">Rezension</h3>
      <div class="profile-info-section">
        ${infoRow('star', 'Wert', `<span data-rezension-wert>${wert}</span>`)}
        ${infoRow('video', 'Produktionsqualität', stars('produktion', rezension?.produktionsqualitaet, canEdit))}
        ${infoRow('chat-bubble', 'Kommunikation &amp; Verlässlichkeit', stars('kommunikation', rezension?.kommunikation_verlaesslichkeit, canEdit))}
        ${namen}
      </div>
      <div class="form-field">
        <label for="koop-rezension-kommentar">Kommentar</label>
        <textarea id="koop-rezension-kommentar" class="form-input" name="kommentar" rows="3" ${canEdit ? '' : 'readonly'}>${esc(rezension?.kommentar || '')}</textarea>
      </div>
      ${canEdit ? '<div class="detail-actions"><button type="button" class="mdc-btn mdc-btn--secondary" data-action="save-rezension">Rezension speichern</button></div>' : ''}
    </div>
  `;
}

export function readRezensionForm(root) {
  const achse = (name) => {
    const on = root.querySelector(`[data-axis="${name}"][aria-checked="true"]`);
    return ganzeSterne(on?.dataset.value);
  };
  const kommentar = root.querySelector('[name="kommentar"]')?.value?.trim() || null;
  return {
    produktionsqualitaet: achse('produktion'),
    kommunikation_verlaesslichkeit: achse('kommunikation'),
    kommentar
  };
}

export function paintStars(group, value) {
  const chosen = ganzeSterne(value);
  group.querySelectorAll('.rezension-star').forEach((btn) => {
    const n = Number(btn.dataset.value);
    btn.classList.toggle('is-on', chosen != null && n <= chosen);
    btn.setAttribute('aria-checked', chosen === n ? 'true' : 'false');
  });
}

export function syncRezensionForm(root) {
  const values = readRezensionForm(root);
  const ready = values.produktionsqualitaet != null && values.kommunikation_verlaesslichkeit != null;
  const preview = root.querySelector('[data-rezension-wert]');
  if (preview) {
    preview.textContent = ready
      ? formatRezension(wertDerRezension(values.produktionsqualitaet, values.kommunikation_verlaesslichkeit))
      : '–';
  }
  const button = root.querySelector('[data-action="save-rezension"]');
  if (button) button.disabled = !ready;
  return values;
}

async function loadNamen(supabase, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase
    .from('benutzer')
    .select('auth_user_id, name')
    .in('auth_user_id', unique);
  if (error) throw error;
  return new Map((data || []).map((row) => [row.auth_user_id, row.name]));
}

function withNames(row, names) {
  return {
    ...row,
    angelegt_von: names.get(row.created_by) || null,
    geaendert_von: names.get(row.updated_by) || null
  };
}

export async function loadRezension(supabase, kooperationId) {
  const { data, error } = await supabase
    .from('rezensionen')
    .select('*')
    .eq('kooperation_id', kooperationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const names = await loadNamen(supabase, [data.created_by, data.updated_by]);
  return withNames(data, names);
}

export async function loadCreatorRezensionen(supabase, creatorId) {
  const { data, error } = await supabase
    .from('rezensionen')
    .select('*, kooperation:kooperation_id(id, name)')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data || [];
  const names = await loadNamen(supabase, rows.flatMap((row) => [row.created_by, row.updated_by]));
  return rows.map((row) => withNames(row, names));
}

export async function saveRezension(supabase, { id, kooperationId, creatorId, produktionsqualitaet, kommunikation_verlaesslichkeit, kommentar }) {
  const produktion = ganzeSterne(produktionsqualitaet);
  const kommunikation = ganzeSterne(kommunikation_verlaesslichkeit);
  if (produktion == null || kommunikation == null) {
    throw new Error('Beide Achsen brauchen ganze Sterne von 1 bis 5');
  }
  const payload = {
    produktionsqualitaet: produktion,
    kommunikation_verlaesslichkeit: kommunikation,
    kommentar: kommentar?.trim() || null
  };
  if (id) {
    const { data, error } = await supabase.from('rezensionen').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('rezensionen').insert({
    ...payload,
    kooperation_id: kooperationId,
    creator_id: creatorId
  }).select('*').single();
  if (error) throw error;
  return data;
}

export function renderRezensionListe(reviews) {
  if (!darfRezensionSehen()) return '';
  if (!reviews?.length) {
    return renderEmptyState({
      icon: 'star',
      title: 'Keine Rezensionen',
      text: 'Sobald eine Kooperation bewertet ist, steht sie hier.'
    });
  }
  const rows = reviews.map((review) => {
    const koop = review.kooperation || {};
    const name = koop.name || 'Kooperation';
    const href = koop.id ? `/kooperation/${koop.id}` : '';
    const link = href
      ? `<a href="${esc(href)}" class="table-link" onclick="event.preventDefault(); window.navigateTo('${esc(href)}')">${esc(name)}</a>`
      : esc(name);
    return `
      <tr>
        <td>${link}</td>
        <td>${review.produktionsqualitaet}</td>
        <td>${review.kommunikation_verlaesslichkeit}</td>
        <td>${formatRezension(wertDerRezension(review.produktionsqualitaet, review.kommunikation_verlaesslichkeit))}</td>
        <td>${review.kommentar ? esc(review.kommentar) : '–'}</td>
        <td>${person(review.angelegt_von)}</td>
        <td>${person(review.geaendert_von)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Kooperation</th>
            <th>Produktionsqualität</th>
            <th>Kommunikation</th>
            <th>Wert</th>
            <th>Kommentar</th>
            <th>Angelegt von</th>
            <th>Zuletzt geändert von</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
