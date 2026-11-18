// auswertungAnsicht.js
// Gemeinsame Ansicht für Produktions-Tab und Kampagnenseite: Kopf, Unterreiter „Report | Erfassen“
// und Inhalt rendern, danach Diagramm-Auswahl, Sortieren, Zeilen und Sprünge binden. Den Zustand
// (Ansicht, Auswahl, Sortierung) hält der Aufrufer; Wechsel innerhalb der Ansicht schreiben hinein.

import { bindSegmentSwitches, syncSegmentThumbs } from '../../core/components/SegmentSwitch.js';
import { bindSortableHeaders, syncSortHeaders } from '../../core/list/sortableHeader.js';
import { renderReport } from './auswertungReport.js';
import { DIAGRAMM_SEG_ATTR, renderDiagrammZeilen, syncDiagrammUntertitel } from './auswertungDiagramm.js';
import { STANDARD_SORT, ladePoster, renderTabellenZeilen } from './auswertungTabelle.js';
import { liesZaehler, merkeZustand, spieleUebergang, zaehleHoch } from './auswertungMotion.js';
import { oeffnePostPanel } from './auswertungPanel.js';
import { neuerErfassenZustand, renderErfassen } from './auswertungPruefbereich.js';
import { esc, exakt } from './auswertungFormat.js';

export const ANSICHTEN = ['report', 'erfassen'];

/** `ziel` ({ postId } oder { einheitId }) wählt beim nächsten Rendern von Erfassen den Eintrag. */
export function neuerZustand(teil = {}) {
  return { ansicht: 'report', ebene: 'produktion', auswahl: {}, sort: { ...STANDARD_SORT }, erfassen: neuerErfassenZustand(), ziel: null, ...teil };
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
  if (tab) tab.innerHTML = `Erfassen${zaehlerHtml(kontext.offenProduktion || 0)}`;
}

/**
 * @param {object} modell - baueModell
 * @param {object} zustand - neuerZustand
 * @param {{ team?: boolean, zeigeKosten?: boolean, unterreiter?: boolean, offenProduktion?: number }} kontext
 */
export function renderInhalt(modell, zustand, kontext) {
  if (zustand.ansicht === 'erfassen') return renderErfassen(modell, zustand);
  return renderReport(modell, {
    auswahl: zustand.auswahl,
    sort: zustand.sort,
    team: kontext.team,
    zeigeKosten: kontext.zeigeKosten
  });
}

export function renderAnsicht(modell, zustand, kontext) {
  return `
    <div class="budget-tab auswertung" data-auswertung>
      ${kontext.unterreiter ? unterreiter(zustand, kontext.offenProduktion || 0) : ''}
      <div class="auswertung-inhalt" data-auswertung-inhalt>${renderInhalt(modell, zustand, kontext)}</div>
    </div>`;
}

/** Nach dem Einsetzen: Zahlen zählen (von `vorher`, sonst 0), Balken wachsen, Poster laden. */
export function belebeAnsicht(root, modell, { vorher, posterCache }) {
  zaehleHoch(root, vorher);
  spieleUebergang(null, root.querySelector('[data-diagramm-zeilen]'));
  ladePoster(root, modell, posterCache);
  syncSegmentThumbs(root, { attr: DIAGRAMM_SEG_ATTR });
}

/**
 * Inhalt und Lead ersetzen (Ebenenwechsel, Ansicht), Zähler laufen vom alten Wert weiter.
 * Der Rest der Ansicht (Unterreiter, Listener am Root) bleibt.
 */
export function ersetzeInhalt(root, modell, zustand, kontext, { posterCache }) {
  const vorher = liesZaehler(root);
  const inhalt = root.querySelector('[data-auswertung-inhalt]');
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
 * @param {object} opts.zustand - wird bei Auswahl und Sortierung beschrieben
 * @param {{ team: boolean }} opts.kontext
 * @param {Map} opts.posterCache
 * @param {(ansicht: string, ziel?: { postId?: string, einheitId?: string }) => void} opts.onAnsicht
 * @param {(einheit: object, post: object) => void} [opts.onVideoTab]
 * @returns {() => void} cleanup
 */
export function bindeAnsicht(root, { modell, zustand, kontext, posterCache, onAnsicht, onVideoTab }) {
  const abort = new AbortController();
  const { signal } = abort;

  const loeseSegmente = bindSegmentSwitches(root, (id, value) => {
    zustand.auswahl = { ...zustand.auswahl, [id]: value };
    const zeilen = root.querySelector('[data-diagramm-zeilen]');
    if (!zeilen) return;
    const vorher = merkeZustand(zeilen);
    zeilen.innerHTML = renderDiagrammZeilen(modell(), zustand.auswahl);
    syncDiagrammUntertitel(root, modell(), zustand.auswahl);
    spieleUebergang(vorher, zeilen);
  }, { attr: DIAGRAMM_SEG_ATTR });

  bindSortableHeaders(root, {
    signal,
    getSort: () => zustand.sort,
    defaultAscending: () => false,
    onChange: (sort) => {
      zustand.sort = sort;
      const tbody = root.querySelector('[data-auswertung-tbody]');
      if (!tbody) return;
      const vorher = merkeZustand(tbody);
      tbody.innerHTML = renderTabellenZeilen(modell(), { sort, team: kontext.team });
      syncSortHeaders(root.querySelector('[data-auswertung-thead]'), sort);
      spieleUebergang(vorher, tbody);
      ladePoster(tbody, modell(), posterCache);
    }
  });

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
    const ansicht = e.target.closest('[data-auswertung-ansicht]');
    if (ansicht) { onAnsicht(ansicht.dataset.auswertungAnsicht); return; }
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
    loeseSegmente();
  };
}
