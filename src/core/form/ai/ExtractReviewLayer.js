// ExtractReviewLayer.js
// Markiert Felder, die aus einer Webseite gefuellt wurden. Unterscheidet
// belegbare Fakten von interpretierten Vorschlaegen, damit niemand eine
// erfundene Angabe ungeprueft mitspeichert: die Feldfarbe zeigt den
// Unterschied, der Tooltip nennt ihn.

const BADGE_CLASS = 'tag--extract';

const KINDS = {
  fact: { className: 'ai-filled--fact', title: 'Aus der Webseite übernommen' },
  guess: { className: 'ai-filled--guess', title: 'KI-Vorschlag, bitte prüfen' }
};

export class ExtractReviewLayer {
  constructor(form) {
    this.form = form;
    // fieldName -> { input, wrapper, previousValue, onManualEdit }
    this.marked = new Map();
    this.applying = false;
  }

  /**
   * Setzt einen Wert und markiert das Feld. Das Tag landet in der Label-Zeile,
   * damit es in Feld-Reihen (PLZ/Stadt) nicht mit dem Nachbarfeld kollidiert.
   * @param {string} fieldName
   * @param {Object} entry - { value, kind, from }
   * @returns {boolean} true, wenn das Feld gefunden und gesetzt wurde
   */
  mark(fieldName, entry) {
    const input = this.findInput(fieldName);
    if (!input) return false;

    const kind = KINDS[entry.kind] ? entry.kind : 'guess';
    const previousValue = input.value;

    this.applying = true;
    input.value = this.formatForInput(input, entry.value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    this.applying = false;

    const wrapper = input.closest('.form-field') || input.parentElement;
    if (!wrapper) return true;

    // Doppelte Markierung vermeiden, wenn zweimal ausgelesen wird
    this.unmark(fieldName, { restore: false });

    wrapper.classList.add('ai-filled', KINDS[kind].className);
    (this.labelOf(wrapper) || wrapper).appendChild(this.buildBadge(kind, entry.from));

    const onManualEdit = () => {
      if (this.applying) return;
      this.unmark(fieldName, { restore: false });
    };
    input.addEventListener('input', onManualEdit);

    this.marked.set(fieldName, { input, wrapper, previousValue, onManualEdit });
    return true;
  }

  /** Graues Tag aus dem bestehenden Tag-System, Details im Tooltip. */
  buildBadge(kind, from) {
    const badge = document.createElement('span');
    badge.className = `tag ${BADGE_CLASS}`;
    badge.textContent = 'Vorschlag';
    badge.title = from ? `${KINDS[kind].title} · Quelle: ${from}` : KINDS[kind].title;
    return badge;
  }

  /** Nur das direkte Label des Feldes, nicht Labels aus inneren Widgets. */
  labelOf(wrapper) {
    return wrapper.querySelector(':scope > label');
  }

  /** Markierung entfernen, optional den vorherigen Wert wiederherstellen. */
  unmark(fieldName, { restore = false } = {}) {
    const state = this.marked.get(fieldName);
    if (!state) return;

    const { input, wrapper, previousValue, onManualEdit } = state;
    input.removeEventListener('input', onManualEdit);

    if (restore) {
      this.applying = true;
      input.value = previousValue;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      this.applying = false;
    }

    wrapper.classList.remove('ai-filled', KINDS.fact.className, KINDS.guess.className);
    wrapper.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());

    this.marked.delete(fieldName);
  }

  /** Alle Markierungen entfernen, Werte bleiben stehen. */
  reset() {
    for (const fieldName of [...this.marked.keys()]) {
      this.unmark(fieldName, { restore: false });
    }
  }

  /**
   * Alle uebernommenen Werte zuruecknehmen. Wird vor einem erneuten Auslesen
   * aufgerufen, damit die Felder wieder frei sind und neu gefuellt werden
   * koennen. Manuell nachbearbeitete Felder sind hier nicht mehr enthalten,
   * die haben ihre Markierung beim Tippen verloren.
   */
  revertAll() {
    for (const fieldName of [...this.marked.keys()]) {
      this.unmark(fieldName, { restore: true });
    }
  }

  findInput(fieldName) {
    return this.form.querySelector(`[name="${fieldName}"]:not([type="hidden"])`);
  }

  /** URL-Felder zeigen den Wert ohne https://-Prefix an (siehe FormRenderer). */
  formatForInput(input, value) {
    const str = value == null ? '' : String(value);
    if (input.dataset.urlField === 'true') {
      return str.replace(/^https?:\/\//i, '');
    }
    return str;
  }

  hasMarks() {
    return this.marked.size > 0;
  }
}
