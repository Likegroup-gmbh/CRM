// SkriptEditorToolbar.js
// Skript-Dokument (ADR 0062): Toolbar ueber der Seite (nur Team). Formatierung,
// Blocktypen, Bild/Tabelle/Trennlinie, Bildbreite und intern-Schalter.
// Buttons schlucken mousedown, damit die Auswahl in der Zelle stehen bleibt;
// Eingaben (Link, Farbe, Tabellenraster) laufen ueber #ed-toolbar-pop.

import { icon } from '../../../core/icons/IconSystem.js';
import { escapeHtml } from '../SkripteUtils.js';
import {
  detectInlineFormat, detectErweitert, istSichereLinkUrl,
  renderInlineMd, htmlToInlineMd, domSelectionToRaw
} from '../../../core/utils/inlineFormat.js';
import {
  SKRIPT_TABELLE, BILD_BREITEN, istTextBlock, neuerBlock
} from './dokument/blockModell.js';
import { GRID_MD } from './skriptEditorKonstanten.js';
import { SKRIPT_BILD_TYPEN } from './dokument/skriptBild.js';
import { BILD_BREITE_LABEL } from './SkriptEditorBlocks.js';
import { HIGHLIGHT_FARBEN } from '../../../core/utils/highlightFarben.js';

const RASTER = 6;
const BREITE_KURZ = { klein: 'S', mittel: 'M', voll: 'L' };

function btn(tb, iconName, title, extra = '') {
  return `<button type="button" class="skripte-editor-toolbar-btn" data-tb="${tb}" title="${title}" aria-label="${title}"${extra}>${icon(iconName)}</button>`;
}

/** Link-Eingabe: ohne Protokoll wird https:// ergaenzt. */
export function normalisiereLinkEingabe(eingabe) {
  const url = String(eingabe ?? '').trim();
  if (!url) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
  return `https://${url}`;
}

export function toolbarHtml() {
  return `
    <div class="skripte-editor-toolbar" id="ed-toolbar" role="toolbar" aria-label="Dokument bearbeiten">
      <div class="skripte-editor-toolbar-gruppe">
        ${btn('undo', 'undo', 'Rückgängig (⌘Z)')}
        ${btn('redo', 'redo', 'Wiederholen (⇧⌘Z)')}
      </div>
      <div class="skripte-editor-toolbar-gruppe">
        <select class="skripte-editor-toolbar-select" data-tb-typ aria-label="Textformat" title="Textformat">
          <option value="absatz">Normaler Text</option>
          <option value="h1">Überschrift 1</option>
          <option value="h2">Überschrift 2</option>
        </select>
      </div>
      <div class="skripte-editor-toolbar-gruppe">
        ${btn('fett', 'bold', 'Fett (⌘B)')}
        ${btn('kursiv', 'italic', 'Kursiv (⌘I)')}
        ${btn('highlight', 'highlight', 'Farbig hervorheben (⇧⌘H = Standardfarbe)', ' data-tb-pop')}
        ${btn('link', 'editor-link', 'Link (⌘K)', ' data-tb-pop')}
      </div>
      <div class="skripte-editor-toolbar-gruppe">
        ${btn('liste', 'editor-list-bullet', 'Aufzählung')}
        ${btn('nummerierung', 'editor-list-numbered', 'Nummerierung')}
      </div>
      <div class="skripte-editor-toolbar-gruppe">
        ${btn('bild', 'photo', 'Bild einfügen (PNG, JPG, WebP bis 5 MB)')}
        ${btn('tabelle', 'editor-table', 'Tabelle einfügen', ' data-tb-pop')}
        ${btn('trennlinie', 'editor-divider', 'Trennlinie einfügen')}
      </div>
      <div class="skripte-editor-toolbar-gruppe" data-tb-bild hidden>
        ${BILD_BREITEN.map((b) => `
        <button type="button" class="skripte-editor-toolbar-btn skripte-editor-toolbar-btn--text" data-tb="breite"
          data-breite="${b}" title="Bildbreite: ${BILD_BREITE_LABEL[b]}" aria-label="Bildbreite ${BILD_BREITE_LABEL[b]}">${BREITE_KURZ[b]}</button>`).join('')}
      </div>
      <div class="skripte-editor-toolbar-gruppe">
        ${btn('intern', 'editor-lock', 'Block nur intern (nicht für Kunde, Gast, Creator, PDF)')}
      </div>
      <div class="skripte-editor-toolbar-gruppe skripte-editor-toolbar-gruppe--rechts">
        <span class="skripte-editor-toolbar-status" data-tb-status aria-live="polite"></span>
      </div>
      <input type="file" accept="${SKRIPT_BILD_TYPEN.join(',')}" multiple hidden data-tb-datei>
    </div>`;
}

export class SkriptEditorToolbar {
  constructor(view, blocks) {
    this.view = view;
    this.blocks = blocks;
    this.el = null;
    this.popArt = null;
    this.gespeicherteSelektion = null;
    this._onSelChange = null;
    this._selTimer = null;
  }

  html() {
    return toolbarHtml();
  }

  get pop() {
    return document.getElementById('ed-toolbar-pop');
  }

  attach(docEl) {
    this.schliessen();
    this.el = docEl?.querySelector('#ed-toolbar') || null;
    if (!this.el) return;
    this.el.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) e.preventDefault();
    });
    this.el.addEventListener('click', (e) => {
      const knopf = e.target.closest('[data-tb]');
      if (knopf && !knopf.disabled) this.aktion(knopf.dataset.tb, knopf);
    });
    this.el.querySelector('[data-tb-typ]')?.addEventListener('change', (e) => {
      this.blocks.typSetzen(e.target.value);
    });
    const datei = this.el.querySelector('[data-tb-datei]');
    datei?.addEventListener('change', () => {
      const dateien = [...(datei.files || [])];
      datei.value = '';
      if (dateien.length) this.blocks.bilderEinfuegen(dateien);
    });
    if (!this._onSelChange) {
      this._onSelChange = () => {
        clearTimeout(this._selTimer);
        this._selTimer = setTimeout(() => this.aktualisieren(), 60);
      };
      document.addEventListener('selectionchange', this._onSelChange);
    }
    this.aktualisieren();
  }

  destroy() {
    this.schliessen();
    if (this._onSelChange) document.removeEventListener('selectionchange', this._onSelChange);
    this._onSelChange = null;
    clearTimeout(this._selTimer);
    this.el = null;
  }

  aktion(tb, knopf) {
    const b = this.blocks;
    switch (tb) {
      case 'undo': b.rueckgaengig(); break;
      case 'redo': b.wiederholen(); break;
      case 'fett': this.formatiere('bold'); break;
      case 'kursiv': this.formatiere('italic'); break;
      case 'highlight': this.oeffneFarben(knopf); break;
      case 'link': this.oeffneLink(knopf); break;
      case 'liste':
      case 'nummerierung':
        b.typSetzen(tb);
        break;
      case 'bild': this.el?.querySelector('[data-tb-datei]')?.click(); break;
      case 'tabelle': this.togglePop('tabelle', knopf); break;
      case 'trennlinie': b.einfuegenBloecke(neuerBlock('trennlinie')); break;
      case 'breite': b.setzeBildBreite(b.aktiverBlockId, knopf.dataset.breite); break;
      case 'intern': {
        const block = b.aktiverBlock();
        if (block && block.typ !== SKRIPT_TABELLE) b.setzeIntern(block.id, !block.intern);
        break;
      }
      default:
    }
  }

  /** Fett/Kursiv: Freier Block direkt, Grid-Zelle ueber SkriptEditorFormat. */
  formatiere(format) {
    if (this.blocks.formatiereLive(format)) return;
    const sel = window.getSelection();
    const grid = this.view._format?.zelleFuer(sel?.anchorNode);
    if (grid && !sel.isCollapsed) {
      this.view._format.anwendenShortcut(grid, format);
      return;
    }
    window.toastSystem?.info('Erst Text markieren.');
  }

  aktualisieren() {
    if (!this.el?.isConnected) return;
    const b = this.blocks;
    const block = b.aktiverBlock();
    const setze = (tb, { aktiv = false, aus = false } = {}) => {
      this.el.querySelectorAll(`[data-tb="${tb}"]`).forEach((k) => {
        k.classList.toggle('is-aktiv', aktiv);
        k.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
        k.disabled = aus;
      });
    };

    setze('undo', { aus: !b.kannRueckgaengig });
    setze('redo', { aus: !b.kannWiederholen });

    const typ = this.el.querySelector('[data-tb-typ]');
    if (typ) typ.value = istTextBlock(block) ? block.typ : 'absatz';

    let format = { bold: false, italic: false, highlight: false, link: '' };
    const s = b.selektionInZelle();
    if (s) {
      format = { ...detectInlineFormat(s.raw, s.start, s.end), ...detectErweitert(s.raw, s.start, s.end) };
    }
    setze('fett', { aktiv: format.bold });
    setze('kursiv', { aktiv: format.italic });
    const farbSel = s ? null : this.farbSelektion({ auchLeer: true });
    setze('highlight', {
      aktiv: farbSel ? detectErweitert(farbSel.raw, farbSel.start, farbSel.end).highlight : format.highlight
    });
    setze('link', { aktiv: Boolean(format.link) });
    setze('liste', { aktiv: block?.typ === 'liste' });
    setze('nummerierung', { aktiv: block?.typ === 'nummerierung' });

    const bildGruppe = this.el.querySelector('[data-tb-bild]');
    if (bildGruppe) bildGruppe.hidden = block?.typ !== 'bild';
    this.el.querySelectorAll('[data-tb="breite"]').forEach((k) => {
      const aktiv = block?.typ === 'bild' && block.breite === k.dataset.breite;
      k.classList.toggle('is-aktiv', aktiv);
      k.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
    });

    const internAus = !block || block.typ === SKRIPT_TABELLE;
    setze('intern', { aktiv: Boolean(block?.intern), aus: internAus });

    const status = this.el.querySelector('[data-tb-status]');
    if (status) {
      status.textContent = b.uploads > 0
        ? 'Bild wird hochgeladen…'
        : (b.dirty || b.laeuft ? 'Speichert…' : '');
    }
  }

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
  }

  togglePop(art, knopf) {
    if (this.popArt === art) {
      this.schliessen();
      return;
    }
    if (art === 'tabelle') this.zeigeTabellenRaster(knopf);
  }

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
  }

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
  }

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
  }

  /** Farbe auf das gemerkte (oder uebergebene) Ziel legen; leer = entfernen. */
  farbeAnwenden(farbe, ziel = null) {
    const sel = ziel || this.gespeicherteSelektion;
    this.gespeicherteSelektion = null;
    this.schliessen();
    if (!sel) return;
    if (sel.art === 'grid') this.view._format?.anwendenFarbe(sel.feld, sel.start, sel.end, farbe);
    else this.blocks.highlightFarbeLive(farbe, sel);
  }

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
          <button type="submit" class="mdc-btn mdc-btn--primary mdc-btn--sm">Übernehmen</button>
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
  }

  linkAnwenden(url) {
    const sel = this.gespeicherteSelektion;
    this.gespeicherteSelektion = null;
    this.schliessen();
    if (sel) this.blocks.linkSetzen(sel.ort, sel.start, sel.end, url);
  }

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
  }
}
