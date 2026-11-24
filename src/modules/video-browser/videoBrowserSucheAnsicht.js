// videoBrowserSucheAnsicht.js
// Textsuche (videoBrowserSuche.js) auf das Gerenderte anwenden, ohne neu zu rendern: was nicht trifft,
// bekommt `data-vb-suche-aus` (video-browser-suche.css), motion.sucheFlip animiert den Wechsel. Poster,
// Fokus und Scrollposition bleiben stehen. Hier liegen der gemeinsame Teil und der Spaltenbrowser,
// der Showcase steht in videoBrowserShowcase.js (sucheShowcase).

import { escapeHtml as esc } from '../../core/format.js';
import { icon } from '../../core/icons/IconSystem.js';
import { ordnerTreffer } from './videoBrowserSuche.js';
import { selectLevel } from './videoBrowserLogic.js';
import { applyGroupDom } from './videoBrowserKoopState.js';

const AUS = 'data-vb-suche-aus';
const setAus = (el, aus) => el?.toggleAttribute(AUS, aus);
export const istAus = (el) => !!el?.closest?.(`[${AUS}]`);

/**
 * Sichtbarkeit umschalten. Eine Gruppe ist sichtbar, wenn eins ihrer Elemente es ist; in einer wegfallenden
 * Gruppe bleiben die Elemente stehen, bis sie ausgeblendet ist. `vorher` läuft im selben Schritt (nach dem
 * Messen für den Flip), z. B. um Gruppen aufzuklappen.
 * @param {Array<{ el: Element, sichtbar: boolean, gruppe?: Element|null }>} items
 */
export function zeigeTreffer(vb, items, { animate = false, vorher = null } = {}) {
  vb._sucheRest?.();
  const gruppen = new Map();
  for (const it of items) if (it.gruppe) gruppen.set(it.gruppe, !!gruppen.get(it.gruppe) || it.sichtbar);
  const bleibt = (it) => !it.gruppe || gruppen.get(it.gruppe);
  const spaeter = items.filter(it => !bleibt(it));

  const rest = () => {
    if (vb._sucheRest !== rest) return;
    vb._sucheRest = null;
    spaeter.forEach(it => setAus(it.el, !it.sichtbar));
  };
  const apply = () => {
    vorher?.();
    gruppen.forEach((sichtbar, g) => setAus(g, !sichtbar));
    items.forEach((it) => { if (bleibt(it) || !animate) setAus(it.el, !it.sichtbar); });
    return [...gruppen.keys(), ...items.filter(bleibt).map(it => it.el)];
  };
  vb._sucheRest = rest;
  if (!animate || !vb.motion?.sucheFlip) {
    apply();
    rest();
    return;
  }
  vb.motion.sucheFlip([...gruppen.keys(), ...items.map(it => it.el)], apply, { done: rest });
}

/** Suchfeld vor dem Ansicht-Umschalter, verdrahtet in videoBrowserSucheFeld.js. */
export const sucheFeldHtml = () => `
  <div class="vb-suche" role="search" data-vb-suche>
    ${icon('search')}
    <input type="search" class="vb-suche__input" data-vb-suche-input placeholder="Creator, Video, Tag" aria-label="Videos durchsuchen" autocomplete="off" spellcheck="false" enterkeyhint="search">
    <kbd class="vb-suche__key" aria-hidden="true">/</kbd>
    <button type="button" class="vb-suche__clear" data-vb-suche-feld-clear aria-label="Suche leeren" title="Suche leeren" hidden>${icon('x-mark')}</button>
  </div>`;

export const sucheLeerHtml = (query) => `
  <div class="vb-empty vb-empty--filter vb-suche-leer" data-vb-suche-leer>
    <p>Keine Treffer für „<span data-vb-suche-term>${esc(String(query).trim())}</span>“.</p>
    <button type="button" class="mdc-btn mdc-btn--secondary" data-vb-suche-clear>Suche leeren</button>
  </div>`;

/** Leerer Zustand am Ende von `container`, ohne `query` entfernt. */
export function zeigeLeer(vb, container, query) {
  if (!container) return;
  let el = [...container.children].find(c => c.matches('[data-vb-suche-leer]')) || null;
  if (!query) {
    el?.remove();
    return;
  }
  if (el) {
    el.querySelector('[data-vb-suche-term]').textContent = String(query).trim();
    return;
  }
  container.insertAdjacentHTML('beforeend', sucheLeerHtml(query));
  el = container.lastElementChild;
  vb.motion?.sucheIn?.([el]);
}

/* ---- Spaltenbrowser ---- */

const li = (btn) => btn.closest('li');

/**
 * Spalte 0 zeigt die treffenden Kooperationen (Gruppen mit Treffern klappen auf, ohne den Merker zu
 * ändern), Spalte 1 die treffenden Videos der gewählten Kooperation. Trifft die Kooperation selbst oder
 * gar nicht, stehen dort alle. Die Auswahl bleibt, auch wenn sie nicht trifft.
 */
export function sucheOrdner(vb, { animate = false } = {}) {
  const col0 = vb.colsEl?.querySelector('.vb-col--0');
  if (!col0) return;
  const treffer = ordnerTreffer(vb.tree, vb.suche, vb.raw?.tagTypen || []);
  const koops = [...col0.querySelectorAll('.vb-row[data-depth="0"]')].map(btn => ({
    el: li(btn),
    sichtbar: !treffer || treffer.has(btn.dataset.id),
    gruppe: btn.closest('[data-vb-koopgroup-wrap]')
  }));
  const rows = treffer?.get(vb.sel?.kooperationId);
  const videos = [...vb.colsEl.querySelectorAll('.vb-col--1 .vb-row[data-depth="1"]')].map(btn => ({
    el: li(btn),
    sichtbar: !rows || rows.has(btn.dataset.id) || btn.dataset.id === vb.sel?.videoId
  }));
  const oeffnen = () => {
    col0.querySelectorAll('[data-vb-koopgroup-wrap]').forEach((wrap) => {
      const offen = treffer ? true : !vb.collapsed?.has(wrap.dataset.vbKoopgroupWrap);
      applyGroupDom(vb, wrap, offen, { animate: false });
    });
  };
  zeigeTreffer(vb, [...koops, ...videos], { animate, vorher: oeffnen });
  zeigeLeer(vb, col0.querySelector('[data-vb-body]'), treffer && !treffer.size ? vb.suche : null);
}

/** Enter im Suchfeld: erste sichtbare Kooperation, trifft nur ein Teil ihrer Videos, gleich das erste davon. */
export function oeffneErstenOrdnerTreffer(vb) {
  const btn = [...(vb.colsEl?.querySelectorAll('.vb-col--0 .vb-row[data-depth="0"]') || [])].find(b => !istAus(b));
  if (!btn) return false;
  const koopId = btn.dataset.id;
  const rows = ordnerTreffer(vb.tree, vb.suche, vb.raw?.tagTypen || [])?.get(koopId);
  const koop = vb.tree.kooperationen.find(k => k.id === koopId);
  const row = rows ? koop?.rows.find(r => rows.has(r.id)) : null;
  let next = selectLevel(vb.sel, 0, koopId);
  if (row) next = selectLevel(next, 1, row.id);
  vb._select(next, { focus: row ? { depth: 1, id: row.id } : { depth: 0, id: koopId } });
  return true;
}
