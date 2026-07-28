// MarkeProduktExtractPanel.js
// Der Verlauf unter der URL-Eingabe in der rechten Spalte. Aufgebaut wie der
// Chat im Skript-Editor: Liky begruesst, die eingegebene Adresse erscheint als
// eigener Beitrag rechts, darunter arbeitet Liky die Schritte ab.
//
// Die Daten kommen aus den Events, die SiteExtractHandler beim Pollen der
// extract_jobs-Zeile feuert: siteExtractStarted, siteExtractProgress,
// siteExtractFinished. Das Panel rendert nur - es startet nichts selbst.

const STEP_TEXTS = {
  start: 'Ich schaue mir die Seite an',
  cache: 'Die Seite kenne ich schon',
  laden: 'Seite wird geladen',
  unterseite: 'Ich gehe die Unterseiten durch',
  auswerten: 'USPs und Pain Points werden durchsucht',
  bilder: 'Produktbilder zusammengesucht'
};

const GRUSS = 'Schick mir die Produktseite, dann fülle ich Beschreibung, USPs, '
  + 'Preis und Bilder aus. Was du selbst geschrieben hast, bleibt stehen.';

const ICONS = {
  done: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>'
};

export class ProduktExtractPanel {
  constructor() {
    this.root = null;
    this._abort = null;
    // Der laufende Liky-Beitrag, an den Schritte und Abschluss angehaengt werden
    this.turn = null;
    this.steps = null;
    // step -> <li>, damit ein doppelt gemeldeter Schritt keine zweite Zeile gibt
    this.items = new Map();
    this.active = null;
  }

  /** @param {HTMLFormElement} form - traegt das vom Renderer gebaute Panel */
  mount(form) {
    this.root = form?.querySelector('#produkt-extract-feed') || null;
    if (!this.root) return;

    this.root.setAttribute('aria-live', 'polite');
    this.reset();
    this.addLikyTurn(GRUSS);

    this._abort = new AbortController();
    const opts = { signal: this._abort.signal };

    document.addEventListener('siteExtractStarted', (e) => {
      if (e.detail?.entity !== 'produkt') return;
      this.addUserTurn(e.detail.url);
      this.addLikyTurn();
    }, opts);

    document.addEventListener('siteExtractProgress', (e) => {
      if (e.detail?.entity !== 'produkt') return;
      this.addStep(e.detail.step);
    }, opts);

    document.addEventListener('siteExtractFinished', (e) => {
      if (e.detail?.entity !== 'produkt') return;
      this.finish(e.detail);
    }, opts);
  }

  reset() {
    this.items.clear();
    this.active = null;
    this.turn = null;
    this.steps = null;
    if (this.root) this.root.innerHTML = '';
  }

  /**
   * Die eingegebene Adresse, rechtsbuendig. Das Schema faellt weg, damit in der
   * schmalen Spalte mehr vom aussagekraeftigen Teil der Adresse sichtbar ist.
   */
  addUserTurn(url) {
    if (!this.root || !url) return;

    const msg = document.createElement('div');
    msg.className = 'produkt-chat__msg produkt-chat__msg--user';
    const text = document.createElement('div');
    text.className = 'produkt-chat__text';
    text.textContent = String(url).replace(/^https?:\/\//i, '');
    msg.appendChild(text);

    this.root.appendChild(msg);
    this.scrollToEnd();
  }

  /**
   * Neuer Beitrag von Liky. Ein vorheriger wird abgeschlossen, damit Schritte
   * immer im aktuellen Beitrag landen.
   * @param {string} [message] - optionaler Einleitungstext
   */
  addLikyTurn(message = '') {
    if (!this.root) return;

    this.settleActive();
    this.items.clear();

    const msg = document.createElement('div');
    msg.className = 'produkt-chat__msg produkt-chat__msg--liky';
    msg.innerHTML = `
      <div class="produkt-chat__head">
        <span class="produkt-chat__avatar" aria-hidden="true">L</span>
        <span class="produkt-chat__name">Liky</span>
      </div>
    `;

    if (message) msg.appendChild(this.textNode(message));

    const steps = document.createElement('ul');
    steps.className = 'produkt-chat__steps';
    msg.appendChild(steps);

    this.root.appendChild(msg);
    this.turn = msg;
    this.steps = steps;
    this.scrollToEnd();
  }

  addStep(step) {
    if (!this.steps || !step || this.items.has(step)) return;

    this.settleActive();

    const li = document.createElement('li');
    li.className = 'produkt-chat__step is-active';
    li.innerHTML = `
      <span class="produkt-chat__mark" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="produkt-chat__step-text"></span>
    `;
    li.querySelector('.produkt-chat__step-text').textContent = STEP_TEXTS[step] || 'Ich arbeite';

    this.steps.appendChild(li);
    this.items.set(step, li);
    this.active = li;
    this.scrollToEnd();
  }

  /** Den laufenden Schritt als erledigt markieren. */
  settleActive() {
    if (!this.active) return;
    this.active.classList.remove('is-active');
    const mark = this.active.querySelector('.produkt-chat__mark');
    if (mark) mark.innerHTML = ICONS.done;
    this.active = null;
  }

  finish(detail = {}) {
    if (!this.turn) return;
    this.settleActive();

    if (detail.ok) {
      this.turn.appendChild(this.textNode(this.erfolgText(detail)));
    } else {
      const error = document.createElement('div');
      error.className = 'produkt-chat__error';
      error.textContent = 'Das hat nicht geklappt. Prüf die Adresse und versuch es nochmal.';
      this.turn.appendChild(error);
    }

    this.scrollToEnd();
  }

  erfolgText(detail) {
    if (!detail.felder) return 'Auf der Seite war nichts Brauchbares zu finden.';
    return 'Fertig, schau es dir an. Was ich nur vermute, ist im Dokument markiert.';
  }

  textNode(message) {
    const el = document.createElement('div');
    el.className = 'produkt-chat__text';
    el.textContent = message;
    return el;
  }

  /** Die Spalte scrollt selbst, der neueste Beitrag soll sichtbar bleiben. */
  scrollToEnd() {
    const spalte = this.root?.closest('.produkt-doc__side');
    if (spalte) spalte.scrollTop = spalte.scrollHeight;
  }

  destroy() {
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* noop */ }
      this._abort = null;
    }
    this.reset();
    this.root = null;
  }
}
