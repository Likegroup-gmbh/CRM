// InstagramCpmPage.js
// Instagram-CPM im Accounting-Bereich (nur Admins, ADR 0087): Testseite fuer den neuen
// CPM-Rechner. Holt ueber die Function instagram-reels-scraper die neuesten Reels eines Profils
// (Apify, apify/instagram-reel-scraper), zeigt die Kandidaten als Grid, schlaegt Ausreisser
// anhand der typischen Range vor und rechnet erst auf "Berechnen" mit genau der Auswahl.
// Gespeichert wird nichts. Rechenlogik in core/instagram/reelAuswahl.js, HTML in
// instagramCpmRender.js und instagramCpmGrid.js.

import { navMark } from '../../core/dev/navTrace.js';
import { POLL_MAX_MS, POLL_PAUSE_MS, laufBisFertig, postFunction } from '../../core/tiktok/apifyLauf.js';
import { REGELN_STANDARD, berechne, fenster, rangeFuer, regelnAus, vorschlag } from '../../core/instagram/reelAuswahl.js';
import { setBusy } from './medienablageFormat.js';
import { laufHtml, laufzeit, minSek } from './tiktokApiRender.js';
import { gefiltertHtml, gridHtml } from './instagramCpmGrid.js';
import {
  berechnungHtml, fehlerHtml, formHtml, leisteHtml, profilKopfHtml, rangeHtml, rohHtml,
} from './instagramCpmRender.js';

const ENDPOINT = '/.netlify/functions/instagram-reels-scraper';

export class InstagramCpmPage {
  constructor() {
    this.lauf = null;
    this.ergebnis = null;
    this.fehler = null;
    this.regeln = { ...REGELN_STANDARD };
    this.range = null;
    this.vorschlag = new Map();
    this.abgewaehlt = new Set();
    this.berechnung = null;
    this.veraltet = false;
    this._ladeId = 0;
    this._laeuft = false;
    this._abbrechenBusy = false;
    this._uhr = null;
    this._handler = null;
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
    return window.content?.querySelector('[data-ig-page]') || null;
  }

  teil(name) {
    return this.root()?.querySelector(`[data-ig-${name}]`) || null;
  }

  toast(text, type) {
    window.toastSystem?.show?.(text, type);
  }

  get reels() {
    return this.ergebnis?.reels || [];
  }

  // ---------- Rendering ----------

  render() {
    window.setContentSafely(window.content, `
      <div class="admin-page tt-page ig-page" data-ig-page>
        <div class="admin-header">
          <p class="admin-hint">Testumgebung für den neuen CPM-Rechner. Der Scraper holt die neuesten Reels ohne angepinnte und Trial-Reels. Werbung mit Verlinkung und Collabs fallen vorab raus, Ausreißer werden vorgeschlagen. Gerechnet wird nur mit dem, was im Grid ausgewählt ist. Jeder Lauf kostet bei Apify Geld.</p>
        </div>
        ${formHtml()}
        <div data-ig-lauf></div>
        <div class="tt-ergebnis" data-ig-ergebnis></div>
      </div>
    `);
  }

  renderLauf() {
    const ziel = this.teil('lauf');
    if (ziel) ziel.innerHTML = laufHtml(this.lauf, { fehler: this.fehler, laeuft: this._laeuft });
  }

  renderErgebnis() {
    const ziel = this.teil('ergebnis');
    if (!ziel) return;
    if (!this.ergebnis) {
      ziel.innerHTML = '';
      return;
    }
    const { profil, gefiltert = [], fehler = [], roh = [] } = this.ergebnis;
    const seiten = [...this.vorschlag.values()];
    ziel.innerHTML = `
      ${profilKopfHtml(profil, { kandidaten: this.reels.length, gefiltert: gefiltert.length })}
      ${rangeHtml(this.range, this.regeln, {
        ausreisser: seiten.filter((s) => s === 'hoch').length,
        flops: seiten.filter((s) => s === 'flop').length,
      })}
      <div class="dq-list-card ig-reels">
        <div class="dq-list-header">
          <h2 class="dq-list-title">Reels</h2>
          <p class="dq-list-hint">Neueste zuerst. Ausgegraut zählt nicht mit.</p>
        </div>
        <div data-ig-leiste></div>
        <div data-ig-kacheln></div>
      </div>
      <div data-ig-berechnung></div>
      ${gefiltertHtml(gefiltert)}
      ${fehlerHtml(fehler)}
      ${rohHtml(roh)}
    `;
    this.renderAuswahl();
  }

  // Nur Leiste, Kacheln und Berechnung; Range, Regeln und Roh-JSON bleiben stehen
  renderAuswahl() {
    const { kurz, lang } = fenster(this.reels, this.abgewaehlt);
    const imKurz = new Set(kurz);
    const imLang = new Set(lang);
    const leiste = this.teil('leiste');
    const kacheln = this.teil('kacheln');
    const berechnung = this.teil('berechnung');
    if (leiste) {
      leiste.innerHTML = leisteHtml({
        ausgewaehlt: this.reels.length - this.abgewaehlt.size,
        kandidaten: this.reels.length,
        imKurz: kurz.length,
        imLang: lang.length,
      });
    }
    if (kacheln) {
      kacheln.innerHTML = gridHtml(this.reels, (r) => ({
        aus: this.abgewaehlt.has(r.id),
        imKurz: imKurz.has(r.id),
        imLang: imLang.has(r.id),
        vorschlag: this.vorschlag.get(r.id),
      }));
    }
    if (berechnung) berechnung.innerHTML = berechnungHtml(this.berechnung, { veraltet: this.veraltet });
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

  // ---------- Auswahl ----------

  /** Range und Vorschlag neu, Auswahl auf den Vorschlag, Berechnung verwerfen */
  vorbereiten() {
    this.range = rangeFuer(this.reels, this.regeln);
    this.vorschlag = vorschlag(this.reels, this.range);
    this.abgewaehlt = new Set(this.vorschlag.keys());
    this.berechnung = null;
    this.veraltet = false;
  }

  geaendert() {
    if (this.berechnung) this.veraltet = true;
    this.renderAuswahl();
  }

  umschalten(id) {
    if (!this.reels.some((r) => r.id === id)) return;
    if (this.abgewaehlt.has(id)) this.abgewaehlt.delete(id);
    else this.abgewaehlt.add(id);
    this.geaendert();
  }

  zuruecksetzen() {
    this.abgewaehlt = new Set(this.vorschlag.keys());
    this.geaendert();
  }

  regelnAnwenden() {
    const werte = {};
    this.root()?.querySelectorAll('[data-ig-regel]').forEach((input) => {
      werte[input.dataset.igRegel] = input.value === '' ? undefined : Number(input.value);
    });
    this.regeln = regelnAus(werte);
    this.vorbereiten();
    this.renderErgebnis();
  }

  tkp() {
    return Number(this.root()?.querySelector('[data-ig-feld="tkp"]')?.value) || undefined;
  }

  berechnen() {
    this.berechnung = berechne(this.reels, this.abgewaehlt, this.tkp());
    this.veraltet = false;
    this.renderAuswahl();
  }

  // ---------- Function ----------

  post(body) {
    return postFunction(ENDPOINT, body);
  }

  formWerte() {
    const feld = (name) => this.root()?.querySelector(`[data-ig-feld="${name}"]`)?.value ?? '';
    return { profil: feld('profil'), anzahl: Number(feld('anzahl')) || undefined };
  }

  uebernehmen(data) {
    if (data?.lauf) this.lauf = data.lauf;
    if (data?.ergebnis) {
      this.ergebnis = data.ergebnis;
      this.vorbereiten();
      this.renderErgebnis();
    }
    this.renderLauf();
  }

  async starten() {
    if (this._laeuft) return;
    this._ladeId += 1;
    const ladeId = this._ladeId;
    this._laeuft = true;
    this.lauf = null;
    this.ergebnis = null;
    this.fehler = null;
    this.berechnung = null;
    this.renderLauf();
    this.renderErgebnis();
    setBusy(this.root()?.querySelector('[data-ig-start]'), true);
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
        this.toast(`Instagram-Scraper fertig: ${this.reels.length} Reels im Grid.`, 'success');
      }
    } catch (e) {
      if (ladeId !== this._ladeId) return;
      console.error('❌ Instagram-CPM: Lauf fehlgeschlagen', e);
      if (e?.daten?.lauf) this.lauf = e.daten.lauf;
      this.fehler = e?.message || 'Unbekannt';
    } finally {
      if (ladeId === this._ladeId) {
        this._laeuft = false;
        this.uhrStoppen();
        setBusy(this.root()?.querySelector('[data-ig-start]'), false);
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
      console.error('❌ Instagram-CPM: Abbrechen fehlgeschlagen', e);
      this.toast(`Abbrechen fehlgeschlagen: ${e?.message || 'Unbekannt'}`, 'error');
      setBusy(knopf, false);
    } finally {
      this._abbrechenBusy = false;
    }
  }

  async kopieren() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(this.ergebnis?.roh || [], null, 2));
      this.toast('Roh-JSON kopiert.', 'success');
    } catch {
      this.toast('Kopieren ging nicht, bitte im Feld markieren.', 'error');
    }
  }

  // ---------- Events ----------

  klick(e) {
    const ziel = e.target;
    const abbrechen = ziel.closest('[data-tt-abbrechen]');
    if (abbrechen) return void this.abbrechen(abbrechen);
    if (ziel.closest('[data-ig-kopieren]')) return void this.kopieren();
    if (ziel.closest('[data-ig-berechnen]')) return this.berechnen();
    if (ziel.closest('[data-ig-zuruecksetzen]')) return this.zuruecksetzen();
    if (ziel.closest('[data-ig-regeln-anwenden]')) return this.regelnAnwenden();
    if (ziel.closest('[data-ig-link]')) return undefined;
    const kachel = ziel.closest('[data-ig-reel]');
    if (kachel) this.umschalten(kachel.dataset.igReel);
    return undefined;
  }

  bindEvents() {
    if (this._handler) return;
    const imInhalt = (e) => window.content?.contains(e.target) && this.root()?.contains(e.target);
    this._handler = {
      submit: (e) => {
        if (!e.target.closest?.('[data-ig-form]')) return;
        e.preventDefault();
        void this.starten();
      },
      click: (e) => {
        if (imInhalt(e)) this.klick(e);
      },
      keydown: (e) => {
        if (!imInhalt(e) || (e.key !== 'Enter' && e.key !== ' ')) return;
        const kachel = e.target.closest?.('[data-ig-reel]');
        if (!kachel || e.target !== kachel) return;
        e.preventDefault();
        this.umschalten(kachel.dataset.igReel);
      },
      input: (e) => {
        if (imInhalt(e) && e.target.matches?.('[data-ig-feld="tkp"]') && this.berechnung) this.geaendert();
      },
    };
    Object.entries(this._handler).forEach(([typ, fn]) => document.addEventListener(typ, fn));
  }

  destroy() {
    this._ladeId += 1;
    this._laeuft = false;
    this.uhrStoppen();
    if (this._handler) {
      Object.entries(this._handler).forEach(([typ, fn]) => document.removeEventListener(typ, fn));
    }
    this._handler = null;
  }
}
