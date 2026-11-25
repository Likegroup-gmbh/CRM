// SkriptEditorFormat.js
// Mini-WYSIWYG im Editor: Fett/Kursiv auf die aktuelle Auswahl anwenden.
// Ausloeser: Formatierung-Submenue im Selektions-Menue (Offsets stammen aus
// checkSelection) oder Cmd/Ctrl+B/I direkt in der Zelle (live gelesen).
// Gespeichert wird Markdown (**/*) ueber den normalen saveManuell-Pfad
// (updateSkript + Version), die Zelle selbst zeigt weiter WYSIWYG an.

import {
  renderInlineMd, htmlToInlineMd, toggleInlineFormat, setzeHighlightFarbe,
  domSelectionToRaw, selectRawRange
} from '../../../core/utils/inlineFormat.js';
import { FORMAT_AKTIONEN, GRID_MD } from './skriptEditorKonstanten.js';

export class SkriptEditorFormat {
  constructor(view) {
    this.view = view;
  }

  /** Grid-Zelle unter node, aber keine Master-Markdown-Zelle (--md). */
  zelleFuer(node) {
    const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const zelle = el?.closest?.('.skripte-editor-sektion-text, .skripte-editor-sektion-visual') || null;
    if (!zelle || zelle.classList.contains('skripte-editor-sektion-text--md')) return null;
    return zelle;
  }

  /**
   * Eintrag aus dem Formatierung-Submenue (Offsets aus v.selektion). Auswahl
   * in einem Freien Block geht an SkriptEditorBlocks (erweitertes Markdown).
   */
  async anwendenAusMenue(aktion) {
    const v = this.view;
    const format = FORMAT_AKTIONEN[aktion];
    if (format === 'highlight') {
      this.hervorhebenAusMenue(aktion);
      return;
    }
    if (v.blockSelektion) {
      v._blocks.formatiereAusMenue(aktion);
      return;
    }
    const sel = v.selektion;
    if (!format || !sel?.feld || sel.start == null || sel.end == null) return;
    const zelle = v.container?.querySelector(`[data-feld="${sel.feld}"]`);
    v.clearPending();
    if (!zelle) return;
    await this._apply(zelle, sel.feld, sel.start, sel.end, format);
  }

  /** "Hervorheben" im Selektions-Menue oeffnet die Farbpalette, "entfernen" wirkt sofort. */
  hervorhebenAusMenue(aktion) {
    const v = this.view;
    const b = v.blockSelektion;
    const g = v.selektion;
    let ziel = null;
    if (b) ziel = { art: 'block', ort: b.ort, start: b.start, end: b.end };
    else if (g?.feld && g.start != null && g.end != null) {
      ziel = { art: 'grid', feld: g.feld, start: g.start, end: g.end };
    }
    v.blockSelektion = null;
    if (!ziel) return;
    // Chip/Vormerkung weg, die DOM-Auswahl bleibt als Anker fuer die Palette
    if (v.selektion || v.pendingAktion) v._selection.clearPendingOhneAuswahl();
    if (aktion === 'highlight_entfernen') v._toolbar?.farbeAnwenden('', ziel);
    else v._toolbar?.oeffneFarben(null, ziel);
  }

  /** Farbige Hervorhebung (farbe leer / gleiche Farbe = entfernen) auf einen Raw-Bereich der Zelle. */
  async anwendenFarbe(feld, start, end, farbe) {
    const zelle = this.view.container?.querySelector(`[data-feld="${feld}"]`);
    if (!zelle) return;
    await this._apply(zelle, feld, start, end, (raw, a, b) => setzeHighlightFarbe(raw, a, b, farbe));
  }

  /** Cmd/Ctrl+B oder Cmd/Ctrl+I direkt in einer Zelle. */
  async anwendenShortcut(zelle, format) {
    if (!zelle?.dataset?.feld) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const raw = htmlToInlineMd(zelle);
    const { toRaw } = renderInlineMd(raw, GRID_MD);
    const offsets = domSelectionToRaw(zelle, toRaw);
    if (!offsets || offsets.start === offsets.end) return;
    await this._apply(zelle, zelle.dataset.feld, offsets.start, offsets.end, format);
  }

  /** format: 'bold' | 'italic' | 'highlight' oder Funktion (raw, start, end) => { text, start, end }. */
  async _apply(zelle, feld, start, end, format) {
    const v = this.view;
    // Offen getippte Aenderungen erst persistieren, damit Raw + Offsets zusammenpassen
    await v.inlineEdit.flush();

    const raw = htmlToInlineMd(zelle);
    if (start > raw.length || end > raw.length) return; // Zelle wurde zwischenzeitlich ersetzt
    const toggled = typeof format === 'function'
      ? format(raw, start, end)
      : toggleInlineFormat(raw, start, end, format);
    if (toggled.text === raw) return;

    const gerendert = renderInlineMd(toggled.text, GRID_MD);
    zelle.innerHTML = gerendert.html;
    v.skript[feld] = toggled.text || null;
    v.inlineEdit.syncSaved(feld, toggled.text);
    selectRawRange(zelle, gerendert.toRendered, toggled.start, toggled.end);
    await v.saveManuell(feld, toggled.text, raw);
  }
}
