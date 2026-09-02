import { renderThinking, pushStep } from '../../core/chat/thinking.js';
// ProduktExtractPanel.js
// Der Verlauf unter der URL-Eingabe in der rechten Spalte. Aufgebaut wie der
// Chat im Skript-Editor: Liky begruesst, die eingegebene Adresse erscheint als
// eigener Beitrag rechts, darunter arbeitet Liky die Schritte ab.
//
// Die Daten kommen aus den Events, die SiteExtractHandler beim Pollen der
// extract_jobs-Zeile feuert: siteExtractStarted, siteExtractProgress,
// siteExtractFinished. Das Panel rendert nur - es startet nichts selbst.
// Labels kommen im Event ({ step, label } oder steps[]) - kein eigener Katalog.

const GRUSS = 'Schick mir die Produktseite, dann fülle ich Beschreibung, USPs, '
  + 'Preis und Bilder aus. Was du selbst geschrieben hast, bleibt stehen.';

export class ProduktExtractPanel {
  constructor() {
    this.root = null;
    this._abort = null;
    // Der laufende Liky-Beitrag, an den Schritte und Abschluss angehaengt werden
    this.turn = null;
    this.slot = null;
    this.received = [];
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
      if (Array.isArray(e.detail.steps) && e.detail.steps.length) {
        this.setSteps(e.detail.steps);
        return;
      }
      this.addStep(e.detail.step, e.detail.label);
    }, opts);

    document.addEventListener('siteExtractFinished', (e) => {
      if (e.detail?.entity !== 'produkt') return;
      this.finish(e.detail);
    }, opts);

    // Persona-Job: haengt sich als eigener Liky-Beitrag hinter den Extract
    document.addEventListener('produktPersonaProgress', (e) => {
      if (e.detail?.step === 'start') this.addLikyTurn();
      if (Array.isArray(e.detail?.steps) && e.detail.steps.length) {
        this.setSteps(e.detail.steps);
        return;
      }
      if (e.detail?.step && e.detail.step !== 'start') {
        this.addStep(e.detail.step, e.detail.label);
      }
    }, opts);

    document.addEventListener('produktPersonaFinished', (e) => {
      this.finishPersona(e.detail || {});
    }, opts);
  }

  reset() {
    this.received = [];
    this.turn = null;
    this.slot = null;
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

    this.received = [];

    const msg = document.createElement('div');
    msg.className = 'produkt-chat__msg produkt-chat__msg--liky';
    msg.innerHTML = `
      <div class="produkt-chat__head">
        <span class="produkt-chat__avatar" aria-hidden="true">L</span>
        <span class="produkt-chat__name">Liky</span>
      </div>
    `;

    if (message) msg.appendChild(this.textNode(message));

    const slot = document.createElement('div');
    slot.className = 'produkt-chat__thinking';
    msg.appendChild(slot);

    this.root.appendChild(msg);
    this.turn = msg;
    this.slot = slot;
    this.scrollToEnd();
  }

  addStep(step, label) {
    if (!this.slot || !step) return;
    if (this.received.some((s) => s.step === step)) return;
    this.setSteps(pushStep(this.received, { step, label: label || 'Ich arbeite' }));
  }

  setSteps(steps) {
    if (!this.slot) return;
    this.received = Array.isArray(steps) ? steps : [];
    renderThinking(this.slot, this.received);
    this.scrollToEnd();
  }

  finish(detail = {}) {
    if (!this.turn) return;
    if (this.received.length) renderThinking(this.slot, this.received, { done: true });

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

  /** Abschluss des Persona-Beitrags (Erfolg/Fehler als Text unter den Steps). */
  finishPersona(detail) {
    if (!this.turn) return;
    if (this.received.length) renderThinking(this.slot, this.received, { done: true });

    if (detail.ok) {
      this.turn.appendChild(this.textNode(
        'Einsatzsituationen und Persona-Vorschläge liegen im Dokument – bitte prüfen: annehmen, neu generieren oder verwerfen.'
      ));
    } else {
      const error = document.createElement('div');
      error.className = 'produkt-chat__error';
      error.textContent = 'Die Persona-Vorschläge haben nicht geklappt. Du kannst sie im Dokument neu anstoßen.';
      this.turn.appendChild(error);
    }

    this.scrollToEnd();
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
