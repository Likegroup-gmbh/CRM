// SkriptEditorSelection.js
// Selektions-Menue im Editor: Text markieren -> Hover-Menue mit Aktionen.
// "Kommentieren" fuehrt ins Feedback-Panel und sehen alle; die AI-Aktionen
// (Neu schreiben, Kuerzen, ...) sind intern und setzen den Chip ueber dem
// Liky-Input.

import { escapeHtml } from '../SkripteUtils.js';
import {
  AKTION_LABELS, AKTION_ICONS, AI_SELEKTION_AKTIONEN, FORMAT_AKTIONEN,
    PLACEHOLDER_AKTION, PLACEHOLDER_DEFAULT
} from './skriptEditorKonstanten.js';
import { sektionAnzeige } from './skriptEditorVisuellHelfer.js';
import { openFloatingMenu } from '../../../core/components/FloatingMenu.js';
import {
  renderInlineMd, htmlToInlineMd, detectInlineFormat, domSelectionToRaw
} from '../../../core/utils/inlineFormat.js';

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
    if (!sel || sel.isCollapsed || !text) {
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
      const { toRaw } = renderInlineMd(raw);
      const offsets = domSelectionToRaw(start, toRaw);
      if (offsets && offsets.start !== offsets.end) {
        v.selektion.start = offsets.start;
        v.selektion.end = offsets.end;
        const { bold, italic } = detectInlineFormat(raw, offsets.start, offsets.end);
        const fettId = bold ? 'fett_entfernen' : 'fett';
        const kursivId = italic ? 'kursiv_entfernen' : 'kursiv';
        formatierungItem = {
          id: 'formatierung',
          iconHtml: AKTION_ICONS.formatierung,
          label: AKTION_LABELS.formatierung,
          children: [fettId, kursivId].map((id) => ({
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

    openFloatingMenu({
      el: menu,
      anchor: sel.getRangeAt(0),
      wrap: v.container.querySelector('.skripte-editor'),
      layout: 'icon-label',
      items,
      onSelect: (aktion) => this.onAktion(aktion)
    });
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
