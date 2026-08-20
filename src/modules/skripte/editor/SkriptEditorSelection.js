// SkriptEditorSelection.js
// Selektions-Menue im Editor: Text markieren -> Hover-Menue mit Aktionen
// (Neu schreiben, Kuerzen, ...), Chip ueber dem Chat-Input.

import { escapeHtml } from '../SkripteUtils.js';
import { AKTION_LABELS, AKTION_ICONS, PLACEHOLDER_AKTION, PLACEHOLDER_DEFAULT } from './skriptEditorKonstanten.js';
import { sektionAnzeige } from './skriptEditorVisuellHelfer.js';

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
    v.selektion = { sektion, text, istVisuell };
    v.pendingAktion = null;
    this.updateChip();

    menu.innerHTML = ['neu_schreiben', 'kuerzen', 'laenger', 'anderer_ton', 'feedback'].map((aktion) => `
      <button data-aktion="${aktion}">
        <span class="skripte-editor-selmenu-icon">${AKTION_ICONS[aktion]}</span>
        <span>${AKTION_LABELS[aktion]}</span>
      </button>
    `).join('');
    menu.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        menu.hidden = true;
        if (btn.dataset.aktion === 'feedback') {
          v.openSektionsFeedback();
        } else {
          this.setPendingAktion(btn.dataset.aktion);
        }
      });
    });

    // Position: unter dem Ende der Auswahl, relativ zum Editor-Wrapper
    // (dynamische Koordinaten gehen nur per JS)
    const wrap = v.container.querySelector('.skripte-editor');
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    menu.hidden = false;
    menu.style.top = `${rect.bottom - wrapRect.top + 6}px`;
    menu.style.left = `${Math.max(8, Math.min(rect.left - wrapRect.left, wrap.clientWidth - 220))}px`;
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
    window.getSelection()?.removeAllRanges();
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
