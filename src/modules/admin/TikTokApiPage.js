// TikTokApiPage.js
// TikTok-API im Accounting-Bereich (nur Admins): Testseite für den Apify-Actor
// clockworks/tiktok-scraper. Startet einen Lauf über die Function tiktok-scraper, pollt den
// Stand und zeigt Profile, Videos, Fehler-Items und Roh-JSON. Gespeichert wird nichts.
// HTML in tiktokApiRender.js.

import { navMark } from '../../core/dev/navTrace.js';
import { POLL_MAX_MS, POLL_PAUSE_MS, laufBisFertig, postFunction } from '../../core/tiktok/apifyLauf.js';
import { setBusy } from './medienablageFormat.js';
import { formHtml, laufHtml, ergebnisHtml, laufzeit, minSek } from './tiktokApiRender.js';

const ENDPOINT = '/.netlify/functions/tiktok-scraper';

export class TikTokApiPage {
  constructor() {
    this.lauf = null;
    this.ergebnis = null;
    this.fehler = null;
    this._ladeId = 0;
    this._laeuft = false;
    this._abbrechenBusy = false;
    this._uhr = null;
    this._submitHandler = null;
    this._clickHandler = null;
    this.pollPauseMs = POLL_PAUSE_MS;
    this.pollMaxMs = POLL_MAX_MS;
    this.ready = Promise.resolve();
  }

  async init() {
    this._ladeId += 1;
    this.render();
    this.bindEvents();
    navMark('render:done');
  }

  root() {
    return window.content?.querySelector('[data-tt-page]') || null;
  }

  toast(text, type) {
    window.toastSystem?.show?.(text, type);
  }

  // ---------- Rendering ----------

  render() {
    window.setContentSafely(window.content, `
      <div class="admin-page tt-page" data-tt-page>
        <div class="admin-header">
          <p class="admin-hint">Testumgebung für den TikTok-Scraper von Apify. Video-Links liefern genau diese Videos, Profile die neuesten Videos samt Follower-Zahlen. Jeder Lauf kostet bei Apify Geld (ab 1,70 USD je 1.000 Ergebnisse) und ist pro Lauf gedeckelt.</p>
        </div>
        ${formHtml()}
        <div data-tt-lauf></div>
        <div class="tt-ergebnis" data-tt-ergebnis></div>
      </div>
    `);
  }

  renderLauf() {
    const ziel = this.root()?.querySelector('[data-tt-lauf]');
    if (ziel) ziel.innerHTML = laufHtml(this.lauf, { fehler: this.fehler, laeuft: this._laeuft });
  }

  renderErgebnis() {
    const ziel = this.root()?.querySelector('[data-tt-ergebnis]');
    if (ziel) ziel.innerHTML = ergebnisHtml(this.ergebnis);
  }

  // Nur die Laufzeit tickt; der Rest der Karte bleibt stehen, damit Klicks auf Abbrechen nicht verloren gehen
  tick() {
    const el = this.root()?.querySelector('[data-tt-laufzeit]');
    if (el && this.lauf) el.textContent = minSek(laufzeit(this.lauf));
  }

  uhrStarten() {
    this.uhrStoppen();
    this._uhr = setInterval(() => this.tick(), 1000);
  }

  uhrStoppen() {
    if (this._uhr) clearInterval(this._uhr);
    this._uhr = null;
  }

  // ---------- Function ----------

  post(body) {
    return postFunction(ENDPOINT, body);
  }

  formWerte() {
    const feld = (name) => this.root()?.querySelector(`[data-tt-feld="${name}"]`)?.value ?? '';
    return { videos: feld('videos'), profile: feld('profile'), anzahl: Number(feld('anzahl')) || undefined };
  }

  uebernehmen(data) {
    if (data?.lauf) this.lauf = data.lauf;
    if (data?.ergebnis) {
      this.ergebnis = data.ergebnis;
      this.renderErgebnis();
    }
    this.renderLauf();
  }

  // ---------- Aktionen ----------

  async starten() {
    if (this._laeuft) return;
    this._ladeId += 1;
    const ladeId = this._ladeId;
    const knopf = this.root()?.querySelector('[data-tt-start]');
    this._laeuft = true;
    this.lauf = null;
    this.ergebnis = null;
    this.fehler = null;
    this.renderLauf();
    this.renderErgebnis();
    setBusy(knopf, true);
    this.uhrStarten();

    try {
      const data = await laufBisFertig((body) => this.post(body), { aktion: 'starten', ...this.formWerte() }, {
        istFertig: (d) => !!d?.lauf?.fertig,
        standBody: () => ({ aktion: 'stand', runId: this.lauf.runId }),
        onStand: (d) => this.uebernehmen(d),
        istAbgebrochen: () => ladeId !== this._ladeId,
        pauseMs: this.pollPauseMs,
        maxMs: this.pollMaxMs,
        zeitText: 'Nach 6 Minuten noch nicht fertig. Der Lauf geht in Apify weiter, das Ergebnis siehst du dort.',
      });
      if (!data) return;
      if (this.lauf?.status === 'SUCCEEDED') {
        this.toast(`TikTok-Scraper fertig: ${this.ergebnis?.videos?.length ?? 0} Videos.`, 'success');
      }
    } catch (e) {
      if (ladeId !== this._ladeId) return;
      console.error('❌ TikTok-API: Lauf fehlgeschlagen', e);
      if (e?.daten?.lauf) this.lauf = e.daten.lauf;
      this.fehler = e?.message || 'Unbekannt';
    } finally {
      if (ladeId === this._ladeId) {
        this._laeuft = false;
        this.uhrStoppen();
        setBusy(this.root()?.querySelector('[data-tt-start]'), false);
        this.renderLauf();
      }
    }
  }

  async abbrechen(knopf) {
    if (!this.lauf?.runId || this._abbrechenBusy) return;
    this._abbrechenBusy = true;
    setBusy(knopf, true);
    try {
      const data = await this.post({ aktion: 'abbrechen', runId: this.lauf.runId });
      if (data?.lauf && this._laeuft) this.uebernehmen({ lauf: data.lauf });
    } catch (e) {
      console.error('❌ TikTok-API: Abbrechen fehlgeschlagen', e);
      this.toast(`Abbrechen fehlgeschlagen: ${e?.message || 'Unbekannt'}`, 'error');
      setBusy(knopf, false);
    } finally {
      this._abbrechenBusy = false;
    }
  }

  async kopieren() {
    const text = JSON.stringify(this.ergebnis?.roh || [], null, 2);
    try {
      await navigator.clipboard.writeText(text);
      this.toast('Roh-JSON kopiert.', 'success');
    } catch {
      this.toast('Kopieren ging nicht, bitte im Feld markieren.', 'error');
    }
  }

  // ---------- Events ----------

  bindEvents() {
    if (this._clickHandler) return;
    this._submitHandler = (e) => {
      if (!e.target.closest?.('[data-tt-form]')) return;
      e.preventDefault();
      void this.starten();
    };
    this._clickHandler = (e) => {
      if (!window.content?.contains(e.target)) return;
      const abbrechen = e.target.closest('[data-tt-abbrechen]');
      if (abbrechen) {
        void this.abbrechen(abbrechen);
        return;
      }
      if (e.target.closest('[data-tt-kopieren]')) void this.kopieren();
    };
    document.addEventListener('submit', this._submitHandler);
    document.addEventListener('click', this._clickHandler);
  }

  destroy() {
    this._ladeId += 1;
    this._laeuft = false;
    this.uhrStoppen();
    if (this._submitHandler) document.removeEventListener('submit', this._submitHandler);
    if (this._clickHandler) document.removeEventListener('click', this._clickHandler);
    this._submitHandler = null;
    this._clickHandler = null;
  }
}
