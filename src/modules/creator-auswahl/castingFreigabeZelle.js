// castingFreigabeZelle.js
// Zelle "Freigabe" der Casting-Tabelle: Markup mit den Hooks fuer
// src/core/animation/freigabePuls.js und das In-place-Umschalten ohne Neu-Render.

import { escapeHtml } from '../../core/format.js';
import { SCHLOSS_BUEGEL_D, SCHLOSS_KOERPER_D } from '../../core/icons/schlossIcons.js';
import {
  animateFreigabeLock,
  animateFreigabeUnlock,
  initFreigabeButton
} from '../../core/animation/freigabePuls.js';
import {
  FREIGABE_LABEL,
  freigabeTitel,
  freigabeZustand,
  hatProduktionsKontext,
  zeigtFreigabeSpalte
} from './castingFreigabeLogik.js';

const HAKEN_D = 'M4.5 12.75l6 6 9-13.5';

const ICONS = `
  <span class="casting-freigabe-btn__icon" aria-hidden="true">
    <svg data-freigabe-lock viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path data-freigabe-shackle stroke-linecap="round" stroke-linejoin="round" d="${SCHLOSS_BUEGEL_D}" />
      <path stroke-linecap="round" d="${SCHLOSS_KOERPER_D}" />
      <circle cx="11.9964" cy="15.5" r="2" />
    </svg>
    <svg data-freigabe-check viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path pathLength="1" stroke-linecap="round" stroke-linejoin="round" d="${HAKEN_D}" />
    </svg>
  </span>`;

function labelFuer(zustand) {
  return zustand === 'done' ? FREIGABE_LABEL.fertig : FREIGABE_LABEL.offen;
}

export function renderFreigabeButton(itemId, zustand, { kontextOk = true } = {}) {
  const klassen = [
    'mdc-btn', 'mdc-btn--secondary', 'mdc-btn--sm', 'casting-freigabe-btn',
    zustand === 'locked' ? 'mdc-btn--disabled' : ''
  ].filter(Boolean).join(' ');
  const titel = escapeHtml(freigabeTitel(zustand, { kontextOk }));
  return `
    <span class="casting-freigabe" title="${titel}">
      <button type="button" class="${klassen}" data-freigabe-btn data-item-id="${escapeHtml(itemId)}"
        data-state="${zustand}" aria-label="${titel}"${zustand === 'ready' ? '' : ' disabled'}>
        ${ICONS}
        <span class="mdc-btn__label" data-freigabe-label>${labelFuer(zustand)}</span>
      </button>
      <span data-freigabe-ring aria-hidden="true"></span>
    </span>`;
}

export function renderFreigabeZelle(ctx, item) {
  if (!zeigtFreigabeSpalte(ctx)) return '';
  if (item?.isVorschlag) return '<td class="cp-col-freigabe"></td>';
  const kontextOk = hatProduktionsKontext(ctx.liste);
  // Laeuft die Anlage noch, bleibt ein Neu-Render beim Haken
  const zustand = ctx.freigabeLaeuft?.has(item.id)
    ? 'done'
    : freigabeZustand(item, { freigegebeneCreatorIds: ctx.freigegebeneCreatorIds, kontextOk });
  return `<td class="cp-col-freigabe">${renderFreigabeButton(item.id, zustand, { kontextOk })}</td>`;
}

/** Nach jedem Render: Buegel und Icons ohne Animation auf den Zustand setzen. */
export function initFreigabeButtonsInRoot(root) {
  root?.querySelectorAll?.('[data-freigabe-btn]').forEach(btn => initFreigabeButton(btn, btn.dataset.state));
}

export function findeFreigabeButton(root, itemId) {
  if (!root?.querySelector || !itemId) return null;
  const id = String(itemId).replace(/["\\]/g, '\\$&');
  return root.querySelector(`[data-freigabe-btn][data-item-id="${id}"]`);
}

/** Attribute, Klassen, Label und Tooltip auf den Zustand setzen. Bewegt nichts. */
export function setzeFreigabeZustand(btn, zustand, { kontextOk = true, mitLabel = true } = {}) {
  btn.dataset.state = zustand;
  btn.disabled = zustand !== 'ready';
  btn.classList.toggle('mdc-btn--disabled', zustand === 'locked');
  const titel = freigabeTitel(zustand, { kontextOk });
  btn.setAttribute('aria-label', titel);
  btn.closest('.casting-freigabe')?.setAttribute('title', titel);
  if (mitLabel) {
    const label = btn.querySelector('[data-freigabe-label]');
    if (label) label.textContent = labelFuer(zustand);
  }
}

/**
 * Zustand des Buttons aus dem Item neu ableiten und nur bei einem echten
 * Uebergang anfassen. Der alte Zustand steht am Button, so loest ein
 * Realtime-Echo der eigenen Aenderung keine zweite Animation aus.
 */
export function syncFreigabeButtonInPlace(root, item, { freigegebeneCreatorIds, kontextOk = true } = {}) {
  const btn = findeFreigabeButton(root, item?.id);
  if (!btn || btn.dataset.busy === '1') return null;
  const alt = btn.dataset.state;
  const neu = freigabeZustand(item, { freigegebeneCreatorIds, kontextOk });
  if (alt === neu) return neu;

  setzeFreigabeZustand(btn, neu, { kontextOk });
  if (alt === 'locked' && neu === 'ready') animateFreigabeUnlock(btn);
  else if (alt === 'ready' && neu === 'locked') animateFreigabeLock(btn);
  else initFreigabeButton(btn, neu);
  return neu;
}
