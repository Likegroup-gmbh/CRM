// SkriptEditorToolbarPopover.js
// Popover unter der Toolbar (#ed-toolbar-pop): Farbpalette, Link-Eingabe und
// Tabellenraster (Prototype-Mixin von SkriptEditorToolbar)

import { escapeHtml } from '../SkripteUtils.js';
import {
  detectErweitert, istSichereLinkUrl, renderInlineMd, htmlToInlineMd, domSelectionToRaw
} from '../../../core/utils/inlineFormat.js';
import { neuerBlock } from './dokument/blockModell.js';
import { GRID_MD } from './skriptEditorKonstanten.js';
import { HIGHLIGHT_FARBEN } from '../../../core/utils/highlightFarben.js';

const RASTER = 6;

/** Link-Eingabe: ohne Protokoll wird https:// ergaenzt. */
export function normalisiereLinkEingabe(eingabe) {
  const url = String(eingabe ?? '').trim();
  if (!url) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
  return `https://${url}`;
}

export const toolbarPopoverMethoden = {
  // ------------------------------------------------------------------
  // Popover (#ed-toolbar-pop)
  // ------------------------------------------------------------------

  schliessen() {
    const pop = this.pop;
    if (pop) {
      pop.hidden = true;
      pop.innerHTML = '';
    }
    this.popArt = null;
  },

  togglePop(art, knopf) {
    if (this.popArt === art) {
      this.schliessen();
      return;
    }
    if (art === 'tabelle') this.zeigeTabellenRaster(knopf);
  },

  zeigePop(art, anker, html) {
    const pop = this.pop;
    const wrap = this.view.container?.querySelector('.skripte-editor');
    if (!pop || !wrap) return null;
    this.popArt = art;
    pop.innerHTML = html;
    pop.dataset.art = art;
    pop.hidden = false;
    const wrapRect = wrap.getBoundingClientRect();
    const rect = anker?.getBoundingClientRect?.() || this.el?.getBoundingClientRect();
    if (rect) {
      const breite = pop.offsetWidth || 260;
      const left = Math.max(8, Math.min(rect.left - wrapRect.left, wrap.clientWidth - breite - 8));
      pop.style.top = `${Math.round(rect.bottom - wrapRect.top + 6)}px`;
      pop.style.left = `${Math.round(left)}px`;
    }
    return pop;
  },

  // ---------- Farbige Hervorhebung ----------

  /**
   * Auswahl fuer die Farbe: Freier Block oder Grid-Zelle der Skript-Tabelle
   * (ohne Titel). Rueckgabe { art, raw, start, end, ort | feld } oder null.
   */
  farbSelektion({ auchLeer = false } = {}) {
    const ok = (a, b) => auchLeer || a !== b;
    const s = this.blocks.selektionInZelle();
    if (s && ok(s.start, s.end)) return { art: 'block', raw: s.raw, ort: s.ort, start: s.start, end: s.end };
    const sel = window.getSelection();
    const zelle = this.view._format?.zelleFuer(sel?.anchorNode);
    const feld = zelle?.dataset?.feld;
    if (!feld || feld === 'titel' || !sel.rangeCount || !zelle.contains(sel.focusNode)) return null;
    const raw = htmlToInlineMd(zelle);
    const offsets = domSelectionToRaw(zelle, renderInlineMd(raw, GRID_MD).toRaw);
    if (!offsets || !ok(offsets.start, offsets.end)) return null;
    return { art: 'grid', raw, feld, start: offsets.start, end: offsets.end };
  },

  /**
   * Farbpalette oeffnen. Ohne `ziel` gilt die Live-Auswahl; aus dem
   * Selektions-Menue kommt das gemerkte Ziel mit.
   */
  oeffneFarben(anker, ziel = null) {
    if (this.popArt === 'farben' && !ziel) {
      this.schliessen();
      return;
    }
    const s = ziel || this.farbSelektion();
    if (!s || s.start === s.end) {
      window.toastSystem?.info('Erst Text markieren.');
      return;
    }
    // Roh-Text fuer die Erkennung der aktuellen Farbe
    let raw = s.raw;
    if (raw == null) {
      const zelle = s.art === 'grid'
        ? this.view.container?.querySelector(`[data-feld="${s.feld}"]`)
        : this.blocks.zelleFuerOrt(s.ort);
      raw = zelle ? htmlToInlineMd(zelle) : '';
    }
    const { highlight, farbe } = detectErweitert(raw, s.start, s.end);
    this.gespeicherteSelektion = { art: s.art, ort: s.ort, feld: s.feld, start: s.start, end: s.end };

    // Aus dem Selektions-Menue direkt an der Auswahl, sonst unter dem Button
    const range = ziel && window.getSelection().rangeCount && !window.getSelection().isCollapsed
      ? window.getSelection().getRangeAt(0)
      : null;
    const pop = this.zeigePop(
      'farben',
      range || anker || this.el?.querySelector('[data-tb="highlight"]'),
      `
      <div class="skripte-editor-farben" role="group" aria-label="Hervorhebungsfarbe">
        ${HIGHLIGHT_FARBEN.map((f) => `
        <button type="button" class="skripte-editor-farbe${f.id === farbe ? ' is-aktiv' : ''}" data-farbe="${f.id}"
          style="background-color: ${f.hex}" title="${f.label}" aria-label="${f.label}"
          aria-pressed="${f.id === farbe ? 'true' : 'false'}"></button>`).join('')}
      </div>
      ${highlight ? `
      <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm skripte-editor-farben-weg" data-farbe-weg>
        Hervorhebung entfernen
      </button>` : ''}`
    );
    if (!pop) return;
    pop.querySelectorAll('[data-farbe]').forEach((k) => {
      k.addEventListener('mousedown', (e) => e.preventDefault());
      k.addEventListener('click', () => this.farbeAnwenden(k.dataset.farbe));
    });
    const weg = pop.querySelector('[data-farbe-weg]');
    weg?.addEventListener('mousedown', (e) => e.preventDefault());
    weg?.addEventListener('click', () => this.farbeAnwenden(''));
  },

  /** Farbe auf das gemerkte (oder uebergebene) Ziel legen; leer = entfernen. */
  farbeAnwenden(farbe, ziel = null) {
    const sel = ziel || this.gespeicherteSelektion;
    this.gespeicherteSelektion = null;
    this.schliessen();
    if (!sel) return;
    if (sel.art === 'grid') this.view._format?.anwendenFarbe(sel.feld, sel.start, sel.end, farbe);
    else this.blocks.highlightFarbeLive(farbe, sel);
  },

  // ---------- Link ----------

  oeffneLink(anker) {
    const s = this.blocks.selektionInZelle();
    const { link } = s ? detectErweitert(s.raw, s.start, s.end) : { link: '' };
    if (!s || (s.start === s.end && !link)) {
      window.toastSystem?.info('Erst Text in einem Block außerhalb der Skript-Tabelle markieren.');
      return;
    }
    this.gespeicherteSelektion = { ort: s.ort, start: s.start, end: s.end };
    const pop = this.zeigePop('link', anker || this.el?.querySelector('[data-tb="link"]'), `
      <form class="skripte-editor-toolbar-form" data-pop-link>
        <input type="text" class="skripte-editor-toolbar-input" data-pop-link-url inputmode="url"
          placeholder="https://… oder name@firma.de" value="${escapeHtml(link)}" aria-label="Link-Adresse">
        <div class="skripte-editor-toolbar-form-aktionen">
          ${link ? '<button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-pop-link-weg>Entfernen</button>' : ''}
          <button type="submit" class="mdc-btn mdc-btn--sm">Übernehmen</button>
        </div>
      </form>`);
    if (!pop) return;
    const input = pop.querySelector('[data-pop-link-url]');
    input?.focus();
    input?.select();
    pop.querySelector('[data-pop-link]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const url = normalisiereLinkEingabe(input?.value);
      if (url && !istSichereLinkUrl(url)) {
        window.toastSystem?.error('Nur http(s)- oder Mail-Links ohne Leerzeichen.');
        return;
      }
      this.linkAnwenden(url);
    });
    pop.querySelector('[data-pop-link-weg]')?.addEventListener('click', () => this.linkAnwenden(''));
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.schliessen();
        this.blocks.fokussiere(this.gespeicherteSelektion?.ort);
      }
    });
  },

  linkAnwenden(url) {
    const sel = this.gespeicherteSelektion;
    this.gespeicherteSelektion = null;
    this.schliessen();
    if (sel) this.blocks.linkSetzen(sel.ort, sel.start, sel.end, url);
  },

  // ---------- Tabelle ----------

  zeigeTabellenRaster(anker) {
    const zellen = [];
    for (let z = 1; z <= RASTER; z++) {
      for (let s = 1; s <= RASTER; s++) {
        zellen.push(`<button type="button" class="skripte-editor-raster-zelle" data-z="${z}" data-s="${s}" aria-label="${z} × ${s}"></button>`);
      }
    }
    const pop = this.zeigePop('tabelle', anker, `
      <div class="skripte-editor-raster" style="--raster: ${RASTER}">${zellen.join('')}</div>
      <div class="skripte-editor-raster-label" data-raster-label>Tabelle: Zeilen × Spalten</div>`);
    if (!pop) return;
    const label = pop.querySelector('[data-raster-label]');
    pop.addEventListener('mousedown', (e) => e.preventDefault());
    pop.querySelectorAll('.skripte-editor-raster-zelle').forEach((zelle) => {
      zelle.addEventListener('mouseenter', () => {
        const z = Number(zelle.dataset.z);
        const s = Number(zelle.dataset.s);
        pop.querySelectorAll('.skripte-editor-raster-zelle').forEach((x) => {
          x.classList.toggle('is-aktiv', Number(x.dataset.z) <= z && Number(x.dataset.s) <= s);
        });
        if (label) label.textContent = `${z} × ${s}`;
      });
      zelle.addEventListener('click', () => {
        this.schliessen();
        this.blocks.einfuegenBloecke(neuerBlock('tabelle', {
          zeilen: Number(zelle.dataset.z),
          spalten: Number(zelle.dataset.s)
        }));
      });
    });
  },
};
