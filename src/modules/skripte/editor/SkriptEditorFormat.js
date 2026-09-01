// SkriptEditorFormat.js
// Mini-WYSIWYG im Editor: Fett/Kursiv auf die aktuelle Auswahl anwenden.
// Ausloeser: Formatierung-Submenue im Selektions-Menue (Offsets stammen aus
// checkSelection) oder Cmd/Ctrl+B/I direkt in der Zelle (live gelesen).
// Gespeichert wird Markdown (**/*) ueber den normalen saveManuell-Pfad
// (updateSkript + Version), die Zelle selbst zeigt weiter WYSIWYG an.

import {
  renderInlineMd, htmlToInlineMd, toggleInlineFormat,
  domSelectionToRaw, selectRawRange
} from '../../../core/utils/inlineFormat.js';
import { FORMAT_AKTIONEN } from './skriptEditorKonstanten.js';

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

  /** Eintrag aus dem Formatierung-Submenue (Offsets aus v.selektion). */
  async anwendenAusMenue(aktion) {
    const v = this.view;
    const format = FORMAT_AKTIONEN[aktion];
    const sel = v.selektion;
    if (!format || !sel?.feld || sel.start == null || sel.end == null) return;
    const zelle = v.container?.querySelector(`[data-feld="${sel.feld}"]`);
    v.clearPending();
    if (!zelle) return;
    await this._apply(zelle, sel.feld, sel.start, sel.end, format);
  }

  /** Cmd/Ctrl+B oder Cmd/Ctrl+I direkt in einer Zelle. */
  async anwendenShortcut(zelle, format) {
    if (!zelle?.dataset?.feld) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const raw = htmlToInlineMd(zelle);
    const { toRaw } = renderInlineMd(raw);
    const offsets = domSelectionToRaw(zelle, toRaw);
    if (!offsets || offsets.start === offsets.end) return;
    await this._apply(zelle, zelle.dataset.feld, offsets.start, offsets.end, format);
  }

  async _apply(zelle, feld, start, end, format) {
    const v = this.view;
    // Offen getippte Aenderungen erst persistieren, damit Raw + Offsets zusammenpassen
    await v.inlineEdit.flush();

    const raw = htmlToInlineMd(zelle);
    if (start > raw.length || end > raw.length) return; // Zelle wurde zwischenzeitlich ersetzt
    const toggled = toggleInlineFormat(raw, start, end, format);
    if (toggled.text === raw) return;

    const gerendert = renderInlineMd(toggled.text);
    zelle.innerHTML = gerendert.html;
    v.skript[feld] = toggled.text || null;
    v.inlineEdit.syncSaved(feld, toggled.text);
    selectRawRange(zelle, gerendert.toRendered, toggled.start, toggled.end);
    await v.saveManuell(feld, toggled.text, raw);
  }
}
