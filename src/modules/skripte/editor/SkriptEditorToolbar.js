// SkriptEditorToolbar.js
// Skript-Dokument (ADR 0062): Toolbar ueber der Seite (nur Team). Formatierung,
// Blocktypen, Bild/Tabelle/Trennlinie, Bildbreite und intern-Schalter.
// Buttons schlucken mousedown, damit die Auswahl in der Zelle stehen bleibt;
// Eingaben (Link, Farbe, Tabellenraster) laufen ueber #ed-toolbar-pop
// (SkriptEditorToolbarPopover).

import { icon } from '../../../core/icons/IconSystem.js';
import { detectInlineFormat, detectErweitert } from '../../../core/utils/inlineFormat.js';
import {
  SKRIPT_TABELLE, BILD_BREITEN, istTextBlock, neuerBlock
} from './dokument/blockModell.js';
import { SKRIPT_BILD_TYPEN } from './dokument/skriptBild.js';
import { BILD_BREITE_LABEL } from './SkriptEditorBlocks.js';
import { toolbarPopoverMethoden } from './SkriptEditorToolbarPopover.js';

export { normalisiereLinkEingabe } from './SkriptEditorToolbarPopover.js';

const BREITE_KURZ = { klein: 'S', mittel: 'M', voll: 'L' };

function btn(tb, iconName, title, extra = '') {
  return `<button type="button" class="skripte-editor-toolbar-btn" data-tb="${tb}" title="${title}" aria-label="${title}"${extra}>${icon(iconName)}</button>`;
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
}

Object.assign(SkriptEditorToolbar.prototype, toolbarPopoverMethoden);
