// auswertungAnsicht.js
// Gemeinsame Ansicht für Produktions-Tab und Kampagnenseite: Kopf, Unterreiter „Report | Erfassen“
// und Inhalt rendern, danach Filter, Sortieren, Zeilen und Sprünge binden. Den Zustand
// (Ansicht, Filter, Sortierung) hält der Aufrufer; Wechsel innerhalb der Ansicht schreiben hinein.

import { bindFilterSelects } from '../../core/filters/FilterSelect.js';
import { bindSortableHeaders, syncSortHeaders } from '../../core/list/sortableHeader.js';
import { renderReport } from './auswertungReport.js';
import { ladePoster, renderTabellenGruppen, tabellenSub } from './auswertungTabelle.js';
import { STANDARD_SORT } from './auswertungGruppen.js';
import { entferneFilterPanels, filterAusEvent, leererFilter } from './auswertungFilter.js';
import { liesZaehler, wechsleZeilen, zaehleHoch } from './auswertungMotion.js';
import { oeffnePostPanel } from './auswertungPanel.js';
import { neuerErfassenZustand, renderErfassen } from './auswertungPruefbereich.js';
import { esc, exakt } from './auswertungFormat.js';

export const ANSICHTEN = ['report', 'erfassen'];

/** `ziel` ({ postId } oder { einheitId }) wählt beim nächsten Rendern von Erfassen den Eintrag. */
export function neuerZustand(teil = {}) {
  return { ansicht: 'report', ebene: 'produktion', filter: leererFilter(), sort: { ...STANDARD_SORT }, erfassen: neuerErfassenZustand(), ziel: null, ...teil };
}

const zaehlerHtml = (offen) => (offen ? ` <span class="tab-count">${esc(exakt(offen))}</span>` : '');

function unterreiter(zustand, offen) {
  const tab = (id, label, zahl = '') => `
    <button type="button" class="tab-button${zustand.ansicht === id ? ' active' : ''}" role="tab" aria-selected="${zustand.ansicht === id}" data-auswertung-ansicht="${id}">
      ${label}${zahl}
    </button>`;
  return `<div class="tab-navigation auswertung-ansichten" role="tablist">${tab('report', 'Report')}${tab('erfassen', 'Erfassen', zaehlerHtml(offen))}</div>`;
}

/**
 * Nach einer Änderung an einem Post: Lead (Zahl zählt weiter) und Zähler am Unterreiter, ohne den
 * Inhalt neu zu zeichnen.
 */
export function aktualisiereStand(root, modell, zustand, kontext) {
  const tab = root?.querySelector('[data-auswertung-ansicht="erfassen"].tab-button');
  if (tab) tab.innerHTML = `Erfassen${zaehlerHtml(kontext.offenErfassen || 0)}`;
}

/**
 * @param {object} modell - baueModell
 * @param {object} zustand - neuerZustand
 * @param {{ team?: boolean, zeigeKosten?: boolean, unterreiter?: boolean, offenErfassen?: number }} kontext
 */
export function renderInhalt(modell, zustand, kontext) {
  if (zustand.ansicht === 'erfassen') return renderErfassen(modell, zustand);
  return renderReport(modell, {
    filter: zustand.filter,
    sort: zustand.sort,
    team: kontext.team,
    zeigeKosten: kontext.zeigeKosten
  });
}

export function renderAnsicht(modell, zustand, kontext) {
  return `
    <div class="budget-tab auswertung" data-auswertung>
      ${kontext.unterreiter ? unterreiter(zustand, kontext.offenErfassen || 0) : ''}
      <div class="auswertung-inhalt" data-auswertung-inhalt>${renderInhalt(modell, zustand, kontext)}</div>
    </div>`;
}

/** Nach dem Einsetzen: Zahlen zählen (von `vorher`, sonst 0), Poster laden. */
export function belebeAnsicht(root, modell, { vorher, posterCache }) {
  zaehleHoch(root, vorher);
  ladePoster(root, modell, posterCache);
}

/**
 * Inhalt und Lead ersetzen (Ebenenwechsel, Ansicht), Zähler laufen vom alten Wert weiter.
 * Der Rest der Ansicht (Unterreiter, Listener am Root) bleibt.
 */
export function ersetzeInhalt(root, modell, zustand, kontext, { posterCache }) {
  const vorher = liesZaehler(root);
  const inhalt = root.querySelector('[data-auswertung-inhalt]');
  entferneFilterPanels();
  if (inhalt) inhalt.innerHTML = renderInhalt(modell, zustand, kontext);
  root.querySelectorAll('[data-auswertung-ansicht].tab-button').forEach((btn) => {
    const an = btn.dataset.auswertungAnsicht === zustand.ansicht;
    btn.classList.toggle('active', an);
    btn.setAttribute('aria-selected', String(an));
  });
  belebeAnsicht(root, modell, { vorher, posterCache });
}

/**
 * @param {HTMLElement} root - [data-auswertung]
 * @param {object} opts
 * @param {() => object} opts.modell - aktuelles Modell
 * @param {object} opts.zustand - wird bei Filter und Sortierung beschrieben
 * @param {{ team: boolean }} opts.kontext
 * @param {Map} opts.posterCache
 * @param {(ansicht: string, ziel?: { postId?: string, einheitId?: string }) => void} opts.onAnsicht
 * @param {(einheit: object, post: object) => void} [opts.onVideoTab]
 * @returns {() => void} cleanup
 */
export function bindeAnsicht(root, { modell, zustand, kontext, posterCache, onAnsicht, onVideoTab }) {
  const abort = new AbortController();
  const { signal } = abort;

  /**
   * Kopfzeile sofort, Creator-Gruppen nach Sortierung oder Filter animiert: wegfallende blenden
   * aus, die übrigen gleiten an ihren Platz, neue blenden ein.
   */
  const zeichneTabelle = () => {
    const table = root.querySelector('[data-auswertung-table]');
    if (!table) return;
    const m = modell();
    const sub = root.querySelector('[data-auswertung-tabelle-sub]');
    if (sub) sub.textContent = tabellenSub(m, { team: kontext.team, filter: zustand.filter });
    syncSortHeaders(root.querySelector('[data-auswertung-thead]'), zustand.sort);
    wechsleZeilen(table, renderTabellenGruppen(m, { sort: zustand.sort, team: kontext.team, filter: zustand.filter }), {
      huelle: table.closest('.auswertung-tabelle'),
      danach: () => ladePoster(table, m, posterCache)
    });
  };

  bindSortableHeaders(root, {
    signal,
    getSort: () => zustand.sort,
    defaultAscending: () => false,
    onChange: (sort) => {
      zustand.sort = sort;
      zeichneTabelle();
    }
  });

  bindFilterSelects(root, { signal });
  root.addEventListener('change', (e) => {
    const neu = filterAusEvent(e);
    if (!neu) return;
    zustand.filter = { ...zustand.filter, [neu.key]: neu.werte };
    zeichneTabelle();
  }, { signal });

  const oeffne = (zeile) => {
    const m = modell();
    const post = m.posts.find(p => p.id === zeile.dataset.postId);
    if (!post) return;
    oeffnePostPanel({
      post,
      einheit: m.einheitenById.get(post.einheitId),
      team: kontext.team,
      posterCache,
      zurueck: zeile,
      onErfassen: () => onAnsicht('erfassen', { postId: post.id }),
      onVideoTab
    });
  };

  root.addEventListener('click', (e) => {
    const creator = e.target.closest('a[data-auswertung-creator]');
    if (creator) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      window.navigateTo?.(creator.getAttribute('href'));
      return;
    }
    const ansicht = e.target.closest('[data-auswertung-ansicht]');
    if (ansicht) { onAnsicht(ansicht.dataset.auswertungAnsicht); return; }
    // Rang und Creator gehören zur ganzen Gruppe, nicht zum Post der ersten Zeile
    if (e.target.closest('[data-auswertung-gruppenkopf]')) return;
    const erfassen = e.target.closest('[data-auswertung-erfassen], [data-auswertung-erfassen-einheit]');
    if (erfassen) {
      onAnsicht('erfassen', { postId: erfassen.dataset.auswertungErfassen, einheitId: erfassen.dataset.auswertungErfassenEinheit });
      return;
    }
    const zeile = e.target.closest('tr[data-post-id]');
    if (zeile && !e.target.closest('a, button')) oeffne(zeile);
  }, { signal });

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const zeile = e.target.closest('tr[data-post-id], tr.auswertung-zeile--offen');
    if (!zeile || e.target !== zeile) return;
    e.preventDefault();
    if (zeile.dataset.postId) oeffne(zeile);
    else zeile.click();
  }, { signal });

  return () => {
    abort.abort();
    entferneFilterPanels();
  };
}
