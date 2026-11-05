// SkriptEditorSelection.js
// Selektions-Menue im Editor: Text markieren -> Hover-Menue mit Aktionen.
// "Kommentieren" fuehrt ins Feedback-Panel und sehen alle; die AI-Aktionen
// (Neu schreiben, Kuerzen, ...) sind intern und setzen den Chip ueber dem
// Liky-Input.

import { escapeHtml } from '../SkripteUtils.js';
import {
  AKTION_LABELS, AKTION_ICONS, AI_SELEKTION_AKTIONEN, FORMAT_AKTIONEN,
  PLACEHOLDER_AKTION, PLACEHOLDER_DEFAULT, HOOK_VARIANTE_FELDER, GRID_MD
} from './skriptEditorKonstanten.js';
import { sektionAnzeige } from './skriptEditorVisuellHelfer.js';
import { openFloatingMenu } from '../../../core/components/FloatingMenu.js';
import {
  renderInlineMd, htmlToInlineMd, detectInlineFormat, detectErweitert, domSelectionToRaw
} from '../../../core/utils/inlineFormat.js';
import { renderBlockMd } from './dokument/blockRenderer.js';

export class SkriptEditorSelection {
  constructor(view) {
    this.view = view;
  }

  checkSelection() {
    const v = this.view;
    const menu = document.getElementById('ed-selmenu');
    const doc = document.getElementById('ed-doc');
    if (!menu || !doc) return;

    const sel = window.getSelection();
    const text = sel?.toString().trim();
    v.blockSelektion = null;
    if (!sel || sel.isCollapsed || !text) {
      menu.hidden = true;
      return;
    }

    // Freie Bloecke (ADR 0062): nur Formatierung, kein Kommentar, keine Liky-Aktion
    const blockZelle = (node) => {
      const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      return el?.closest?.('.skripte-editor-block-text') || null;
    };
    const blockStart = blockZelle(sel.anchorNode);
    const blockEnde = blockZelle(sel.focusNode);
    if (blockStart || blockEnde) {
      if (blockStart === blockEnde && v.kannBloeckeEditieren) this.openBlockFormatMenu(menu, blockStart, sel);
      else menu.hidden = true;
      return;
    }
    if (!v.kannKommentieren) {
      menu.hidden = true;
      return;
    }

    // Beide Enden der Auswahl muessen in derselben Spoken- oder Visual-Zelle liegen
    const findSektion = (node) => {
      const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      return el?.closest?.('.skripte-editor-sektion-text, .skripte-editor-sektion-visual') || null;
    };
    const start = findSektion(sel.anchorNode);
    const end = findSektion(sel.focusNode);
    if (!start || start !== end) {
      menu.hidden = true;
      return;
    }

    const sektion = start.dataset.sektion;
    const feld = start.dataset.feld || sektion;
    const istVisuell = feld.endsWith('_visuell')
      || start.classList.contains('skripte-editor-sektion-visual');
    v.selektion = { sektion, text, istVisuell, feld };
    v.pendingAktion = null;

    // Formatierung (nur intern, nur Grid-Zellen): Raw-Stand + Auswahl-Offsets
    // jetzt sichern - nach einem Menue-Klick ist die DOM-Selektion evtl. weg.
    let formatierungItem = null;
    const istMasterZelle = start.classList.contains('skripte-editor-sektion-text--md');
    if (v.kannAiAktionen && !istMasterZelle) {
      const raw = htmlToInlineMd(start);
      const { toRaw } = renderInlineMd(raw, GRID_MD);
      const offsets = domSelectionToRaw(start, toRaw);
      if (offsets && offsets.start !== offsets.end) {
        v.selektion.start = offsets.start;
        v.selektion.end = offsets.end;
        const { bold, italic } = detectInlineFormat(raw, offsets.start, offsets.end);
        const { highlight } = detectErweitert(raw, offsets.start, offsets.end);
        const fettId = bold ? 'fett_entfernen' : 'fett';
        const kursivId = italic ? 'kursiv_entfernen' : 'kursiv';
        // Titel ist Klartext (Liste, PDF-Dateiname): keine Hervorhebung
        const ids = [fettId, kursivId];
        if (feld !== 'titel') ids.push(highlight ? 'highlight_entfernen' : 'highlight');
        formatierungItem = {
          id: 'formatierung',
          iconHtml: AKTION_ICONS.formatierung,
          label: AKTION_LABELS.formatierung,
          children: ids.map((id) => ({
            id,
            iconHtml: AKTION_ICONS[id],
            label: AKTION_LABELS[id]
          }))
        };
      }
    }
    this.updateChip();

    const modmenu = document.getElementById('ed-modmenu');
    if (modmenu) modmenu.hidden = true;
    v.closeVersionMenu();

    const aktionen = v.kannAiAktionen
      ? ['kommentieren', ...AI_SELEKTION_AKTIONEN]
      : ['kommentieren'];

    const items = aktionen.map((aktion) => ({
      id: aktion,
      iconHtml: AKTION_ICONS[aktion],
      label: AKTION_LABELS[aktion],
      data: { aktion }
    }));
    // Formatierung ganz oben im Menue
    if (formatierungItem) items.unshift(formatierungItem);
    if (v.kannAiAktionen && HOOK_VARIANTE_FELDER.includes(feld)) {
      items.push({
        id: 'hook_uebertragen',
        iconHtml: AKTION_ICONS.hook_uebertragen,
        label: AKTION_LABELS.hook_uebertragen,
        data: { aktion: 'hook_uebertragen' }
      });
    }

    openFloatingMenu({
      el: menu,
      anchor: sel.getRangeAt(0),
      wrap: v.container.querySelector('.skripte-editor'),
      layout: 'icon-label',
      items,
      onSelect: (aktion) => this.onAktion(aktion)
    });
  }

  /** Selektions-Menue in einem Freien Block: Fett, Kursiv, Hervorheben. */
  openBlockFormatMenu(menu, zelle, sel) {
    const v = this.view;
    const raw = htmlToInlineMd(zelle);
    const offsets = domSelectionToRaw(zelle, renderBlockMd(raw).toRaw);
    if (!offsets || offsets.start === offsets.end) {
      menu.hidden = true;
      return;
    }
    // Ein offener Grid-Chip gehoert nicht zu dieser Auswahl
    if (v.selektion || v.pendingAktion) this.clearPendingOhneAuswahl();
    v.blockSelektion = { ort: v._blocks.ortVon(zelle), start: offsets.start, end: offsets.end };
    const { bold, italic } = detectInlineFormat(raw, offsets.start, offsets.end);
    const { highlight } = detectErweitert(raw, offsets.start, offsets.end);
    const ids = [
      bold ? 'fett_entfernen' : 'fett',
      italic ? 'kursiv_entfernen' : 'kursiv',
      highlight ? 'highlight_entfernen' : 'highlight'
    ];
    const modmenu = document.getElementById('ed-modmenu');
    if (modmenu) modmenu.hidden = true;
    v.closeVersionMenu();
    openFloatingMenu({
      el: menu,
      anchor: sel.getRangeAt(0),
      wrap: v.container.querySelector('.skripte-editor'),
      layout: 'icon-label',
      items: ids.map((id) => ({ id, iconHtml: AKTION_ICONS[id], label: AKTION_LABELS[id] })),
      onSelect: (aktion) => this.view.formatiereSelektion(aktion)
    });
  }

  /** Chip und vorgemerkte Aktion weg, die DOM-Auswahl bleibt stehen. */
  clearPendingOhneAuswahl() {
    const v = this.view;
    v.selektion = null;
    v.pendingAktion = null;
    this.updateChip();
    const input = document.getElementById('ed-input');
    if (input) input.placeholder = PLACEHOLDER_DEFAULT;
  }

  /** "Kommentieren" geht ins Feedback-Panel, Formatierung direkt an die
   *  Zelle, alles andere in den Liky-Chat. */
  onAktion(aktion) {
    if (aktion === 'kommentieren') {
      const selektion = this.view.selektion;
      this.clearPending();
      this.view.startNeuerKommentar(selektion);
      return;
    }
    if (aktion === 'hook_uebertragen') {
      const feld = this.view.selektion?.feld;
      this.clearPending();
      return this.view.hookUebertragen(feld);
    }
    if (FORMAT_AKTIONEN[aktion]) {
      this.view.formatiereSelektion(aktion);
      return;
    }
    this.setPendingAktion(aktion);
  }

  /**
   * Aktion vormerken statt sofort auszufuehren: Der User kann erst noch
   * eine Anweisung eintippen (optional), Senden startet die Aktion.
   */
  setPendingAktion(aktion) {
    const v = this.view;
    if (!v.selektion) return;
    v.pendingAktion = aktion;
    window.getSelection()?.removeAllRanges();
    // Der Chip haengt am Liky-Input - ohne offene Bubble sieht der User nichts
    v.setLikyOffen(true);
    this.updateChip();

    const input = document.getElementById('ed-input');
    if (input) {
      input.placeholder = PLACEHOLDER_AKTION;
      input.focus();
    }
  }

  clearPending() {
    const v = this.view;
    v.selektion = null;
    v.pendingAktion = null;
    this.updateChip();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) sel.removeAllRanges();
    const input = document.getElementById('ed-input');
    if (input) input.placeholder = PLACEHOLDER_DEFAULT;
  }

  updateChip() {
    const v = this.view;
    const chip = document.getElementById('ed-chip');
    if (!chip) return;
    if (!v.selektion) {
      chip.hidden = true;
      return;
    }
    const kurz = v.selektion.text.length > 60 ? `${v.selektion.text.slice(0, 60)}…` : v.selektion.text;
    const sektion = sektionAnzeige(v.selektion.sektion, v.selektion.istVisuell);
    const prefix = v.pendingAktion
      ? `${AKTION_LABELS[v.pendingAktion]} · ${sektion}`
      : `Auswahl · ${sektion}`;
    chip.hidden = false;
    chip.innerHTML = `
      ${v.pendingAktion && AKTION_ICONS[v.pendingAktion] ? `<span class="skripte-editor-tag-icon">${AKTION_ICONS[v.pendingAktion]}</span>` : ''}
      <span>${escapeHtml(prefix)}: „${escapeHtml(kurz)}“</span>
      <button id="ed-chip-clear" title="Abbrechen" aria-label="Abbrechen">&times;</button>
    `;
    chip.querySelector('#ed-chip-clear').addEventListener('click', () => this.clearPending());
  }
}
