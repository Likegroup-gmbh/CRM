// PdfVorlagenPage.js
// PDF-Vorlagen im Accounting-Bereich (nur Admins, ADR 0080): zeigt die Vorlage des Report-PDF
// mit Beispieldaten oder einer echten Produktion und erzeugt probeweise das PDF über
// report-pdf-background. Die Vorlage selbst ist Code (src/modules/report-pdf/reportPdfVorlage.js
// und reportPdfStil.js); im Dev-Server tauscht HMR sie ohne Neuladen der Seite aus.

import { escapeHtml } from '../../core/format.js';
import { navMark } from '../../core/dev/navTrace.js';
import { bindSegmentSwitches, renderSegmentSwitch, syncSegmentThumbs } from '../../core/components/SegmentSwitch.js';
import { bindeErfassenHoehe } from '../auswertung/auswertungErfassenHoehe.js';
import { setBusy } from './medienablageFormat.js';
import { MAX_JE_SEITE } from '../report-pdf/reportPdfSeiten.js';
import { renderReportPdf } from '../report-pdf/reportPdfVorlage.js';
import { schriftCss } from '../report-pdf/reportPdfStil.js';
import { beispielVm, ladeProduktionen, produktionVm, sucheKampagnen } from '../report-pdf/reportPdfQuelle.js';
import { SCHRITTE, erzeugeReportPdf } from '../report-pdf/reportPdfJob.js';

const SCHRIFT_CSS = schriftCss({
  latin: new URL('../../../assets/fonts/geist-latin-wght-normal.woff2', import.meta.url).href,
  latinExt: new URL('../../../assets/fonts/geist-latin-ext-wght-normal.woff2', import.meta.url).href
});

const MM_PX = 96 / 25.4;
// Seite 297 mm plus 2 × 8 mm Rand der Bildschirm-Vorschau (reportPdfStil.js, @media screen)
const VORSCHAU_BREITE_PX = Math.ceil((297 + 16) * MM_PX);
const VORSCHAU_MS = 120;
const SUCHE_MS = 250;
const ANZAHL_MAX = 30;
const QUELLE_ATTR = 'data-pv-quelle';
const MAX_ATTR = 'data-pv-max';
const QUELLEN = [{ value: 'beispiel', label: 'Beispieldaten' }, { value: 'produktion', label: 'Produktion' }];
const MAX_OPTIONEN = [3, 4, 5, 6].map(n => ({ value: String(n), label: String(n) }));

let vorlage = renderReportPdf;
let aktiveSeite = null;

export class PdfVorlagenPage {
  constructor() {
    this.quelle = 'beispiel';
    this.anzahl = 8;
    this.maxJeSeite = MAX_JE_SEITE;
    this.kampagnen = [];
    this.kampagne = null;
    this.produktionen = [];
    this.produktionId = '';
    this.vm = null;
    this._ladeId = 0;
    this._sucheId = 0;
    this._busy = false;
    this._timer = null;
    this._sucheTimer = null;
    this._handler = null;
    this._resize = null;
    this._loese = [];
    this.ready = Promise.resolve();
  }

  async init() {
    aktiveSeite = this;
    this.render();
    this.bindEvents();
    navMark('render:done');
    this.vm = beispielVm(this.anzahl);
    this.aktualisiereVorschau();
  }

  root() {
    return window.content?.querySelector('[data-pv-page]') || null;
  }

  // ---------- Rendering ----------

  render() {
    window.setContentSafely(window.content, `
      <div class="admin-page pv-page" data-pv-page>
        <div class="admin-header">
          <p class="admin-hint">Vorlage des Report-PDF: Deckblatt mit den Kennzahlen, danach je bestätigtem Post eine Kachel mit Poster, gleichmäßig auf die Seiten verteilt. Die Vorlage liegt im Code (<code>src/modules/report-pdf/</code>); die Vorschau ist dasselbe HTML, das Chromium zum PDF druckt.</p>
        </div>
        <div class="erfassen">
          <aside class="erfassen-liste">
            <div class="erfassen-liste__kopf">
              <p class="erfassen-liste__stand" data-pv-stand>${this.standHtml()}</p>
              ${renderSegmentSwitch({ id: 'Datenquelle', options: QUELLEN, value: this.quelle, attr: QUELLE_ATTR })}
            </div>
            <div class="erfassen-felder" data-pv-felder>${this.felderHtml()}</div>
            <footer class="erfassen-aktionen">
              <p class="erfassen-hinweis" data-pv-status role="status" hidden></p>
              <div class="erfassen-aktionen__rechts">
                <button type="button" class="mdc-btn mdc-btn--create" data-pv-pdf>PDF erzeugen</button>
              </div>
            </footer>
          </aside>
          <section class="erfassen-pruefung" aria-label="Vorschau Report-PDF">
            <div class="erfassen-buehne">
              <div class="pv-huelle" data-pv-buehne>
                <iframe data-pv-vorschau title="Vorschau Report-PDF" style="width: ${VORSCHAU_BREITE_PX}px"></iframe>
              </div>
            </div>
          </section>
        </div>
      </div>
    `);
  }

  standHtml() {
    const n = this.vm?.kacheln.length;
    return n == null ? 'Noch keine Daten gewählt' : `<strong>${n}</strong> ${n === 1 ? 'Post' : 'Posts'} in der Vorschau`;
  }

  felderHtml() {
    return `
      ${this.quelle === 'beispiel' ? this.beispielHtml() : this.produktionHtml()}
      <div class="erfassen-feld">
        <span class="erfassen-feld__label">Kacheln pro Seite</span>
        ${renderSegmentSwitch({ id: 'Kacheln pro Seite', options: MAX_OPTIONEN, value: String(this.maxJeSeite), attr: MAX_ATTR })}
      </div>`;
  }

  beispielHtml() {
    return `
        <label class="erfassen-feld">
          <span class="erfassen-feld__label">Anzahl Posts</span>
          <input type="number" class="form-input" min="1" max="${ANZAHL_MAX}" step="1" value="${this.anzahl}" data-pv-anzahl>
        </label>`;
  }

  produktionHtml() {
    return `
        <label class="erfassen-feld">
          <span class="erfassen-feld__label">Kampagne suchen</span>
          <input type="search" class="form-input" placeholder="Name der Kampagne" data-pv-suche>
        </label>
        <label class="erfassen-feld">
          <span class="erfassen-feld__label">Kampagne</span>
          <select class="form-input" data-pv-kampagne>${this.kampagneOptionen()}</select>
        </label>
        <label class="erfassen-feld">
          <span class="erfassen-feld__label">Produktion</span>
          <select class="form-input" data-pv-produktion${this.kampagne ? '' : ' disabled'}>${this.produktionOptionen()}</select>
        </label>`;
  }

  /** Treffer der Suche; die gewählte Kampagne bleibt wählbar, auch wenn sie nicht mehr trifft. */
  kampagneOptionen() {
    const label = (k) => [k.kampagnenname || 'Ohne Namen', k.marke?.markenname || k.unternehmen?.firmenname].filter(Boolean).join(' · ');
    const liste = this.kampagne && !this.kampagnen.some(k => k.id === this.kampagne.id)
      ? [this.kampagne, ...this.kampagnen]
      : this.kampagnen;
    const leer = liste.length ? 'Kampagne wählen' : 'Keine Kampagne mit Auswertung';
    return `<option value="">${leer}</option>${liste.map(k => `<option value="${escapeHtml(k.id)}"${k.id === this.kampagne?.id ? ' selected' : ''}>${escapeHtml(label(k))}</option>`).join('')}`;
  }

  produktionOptionen() {
    const leer = this.kampagne && !this.produktionen.length ? 'Keine Produktion' : 'Produktion wählen';
    return `<option value="">${leer}</option>${this.produktionen.map(p => `<option value="${escapeHtml(p.id)}"${p.id === this.produktionId ? ' selected' : ''}>${escapeHtml(p.name || 'Ohne Namen')}</option>`).join('')}`;
  }

  renderFelder() {
    const ziel = this.root()?.querySelector('[data-pv-felder]');
    if (!ziel) return;
    ziel.innerHTML = this.felderHtml();
    syncSegmentThumbs(ziel);
  }

  status(text, art = '') {
    const el = this.root()?.querySelector('[data-pv-status]');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.art = art;
    el.hidden = !text;
    el.setAttribute('role', art === 'fehler' ? 'alert' : 'status');
  }

  // ---------- Vorschau ----------

  aktualisiereVorschau() {
    const iframe = this.root()?.querySelector('[data-pv-vorschau]');
    if (!iframe) return;
    const stand = this.root().querySelector('[data-pv-stand]');
    if (stand) stand.innerHTML = this.standHtml();
    if (!this.vm) {
      iframe.srcdoc = '';
      return;
    }
    iframe.onload = () => this.einpassen();
    iframe.srcdoc = vorlage(this.vm, { maxJeSeite: this.maxJeSeite, fontCss: SCHRIFT_CSS });
  }

  vorschauBald() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.aktualisiereVorschau(), VORSCHAU_MS);
  }

  /** iframe in natürlicher Größe, per transform auf die Breite der Bühne verkleinert. */
  einpassen() {
    const buehne = this.root()?.querySelector('[data-pv-buehne]');
    const iframe = buehne?.querySelector('[data-pv-vorschau]');
    const doc = iframe?.contentDocument?.documentElement;
    if (!doc) return;
    // scrollHeight ist nie kleiner als das iframe selbst: erst zusammenziehen, dann messen
    iframe.style.height = '0px';
    const hoehe = doc.scrollHeight;
    const faktor = Math.min(1, buehne.clientWidth / VORSCHAU_BREITE_PX);
    iframe.style.height = `${hoehe}px`;
    iframe.style.transform = `scale(${faktor})`;
    buehne.style.height = `${Math.ceil(hoehe * faktor)}px`;
  }

  // ---------- Daten ----------

  async wechsleQuelle(quelle) {
    if (quelle === this.quelle) return;
    this.quelle = quelle;
    this.vm = quelle === 'beispiel' ? beispielVm(this.anzahl) : null;
    this.renderFelder();
    this.aktualisiereVorschau();
    if (quelle === 'produktion' && !this.kampagnen.length) await this.suchen('');
  }

  async suchen(text) {
    const sucheId = ++this._sucheId;
    try {
      const kampagnen = await sucheKampagnen(text);
      if (sucheId !== this._sucheId) return;
      this.kampagnen = kampagnen;
    } catch (e) {
      console.error('❌ PDF-Vorlagen: Kampagnen nicht lesbar', e);
      this.status(`Kampagnen konnten nicht geladen werden: ${e?.message || 'Unbekannt'}`, 'fehler');
      return;
    }
    const select = this.root()?.querySelector('[data-pv-kampagne]');
    if (select) select.innerHTML = this.kampagneOptionen();
  }

  async waehleKampagne(kampagneId) {
    this.kampagne = [this.kampagne, ...this.kampagnen].find(k => k && k.id === kampagneId) || null;
    this.produktionen = [];
    this.produktionId = '';
    this.vm = null;
    this.aktualisiereVorschau();
    if (this.kampagne) {
      const ladeId = ++this._ladeId;
      try {
        const produktionen = await ladeProduktionen(this.kampagne);
        if (ladeId !== this._ladeId) return;
        this.produktionen = produktionen;
      } catch (e) {
        console.error('❌ PDF-Vorlagen: Produktionen nicht lesbar', e);
        this.status(`Produktionen konnten nicht geladen werden: ${e?.message || 'Unbekannt'}`, 'fehler');
      }
    }
    const select = this.root()?.querySelector('[data-pv-produktion]');
    if (select) {
      select.innerHTML = this.produktionOptionen();
      select.disabled = !this.kampagne;
    }
    if (this.produktionen.length === 1) await this.waehleProduktion(this.produktionen[0].id);
  }

  async waehleProduktion(produktionId) {
    this.produktionId = produktionId;
    const select = this.root()?.querySelector('[data-pv-produktion]');
    if (select) select.value = produktionId;
    this.vm = null;
    if (!produktionId) {
      this.aktualisiereVorschau();
      return;
    }
    await this.ladeProduktionVm();
  }

  /** Lädt die Produktion und holt dabei frische Poster-Links (die alten laufen nach Minuten ab). */
  async ladeProduktionVm() {
    const kampagne = this.kampagne;
    const produktion = this.produktionen.find(p => p.id === this.produktionId);
    if (!kampagne || !produktion) return null;
    const ladeId = ++this._ladeId;
    this.status('Lade Auswertung und Poster …');
    try {
      const vm = await produktionVm({ kampagne, produktion });
      if (ladeId !== this._ladeId) return null;
      this.vm = vm;
      this.status('');
      this.aktualisiereVorschau();
      return vm;
    } catch (e) {
      console.error('❌ PDF-Vorlagen: Produktion nicht lesbar', e);
      if (ladeId === this._ladeId) this.status(`Auswertung konnte nicht geladen werden: ${e?.message || 'Unbekannt'}`, 'fehler');
      return null;
    }
  }

  // ---------- PDF ----------

  async pdfErzeugen(button) {
    if (this._busy) return;
    this._busy = true;
    setBusy(button, true);
    try {
      const vm = this.quelle === 'produktion' ? await this.ladeProduktionVm() : this.vm;
      if (!vm) {
        this.status('Erst eine Produktion wählen.', 'fehler');
        return;
      }
      this.status('PDF wird angelegt …');
      await erzeugeReportPdf({
        vm,
        maxJeSeite: this.maxJeSeite,
        onSchritt: (schritt) => this.status(SCHRITTE[schritt] || 'PDF wird erzeugt …')
      });
      this.status('PDF heruntergeladen.', 'ok');
    } catch (e) {
      console.error('❌ PDF-Vorlagen: PDF fehlgeschlagen', e);
      this.status(`PDF fehlgeschlagen: ${e?.message || 'Unbekannt'}`, 'fehler');
    } finally {
      this._busy = false;
      setBusy(button, false);
    }
  }

  // ---------- Events ----------

  bindEvents() {
    if (this._handler) return;
    this._handler = (e) => {
      const root = this.root();
      if (!root?.contains(e.target)) return;
      const t = e.target;
      if (e.type === 'click') {
        const pdf = t.closest('[data-pv-pdf]');
        if (pdf) void this.pdfErzeugen(pdf);
        return;
      }
      if (t.matches('[data-pv-anzahl]') && e.type === 'input') {
        const n = Math.round(Number(t.value));
        if (!(n >= 1)) return;
        this.anzahl = Math.min(n, ANZAHL_MAX);
        this.vm = beispielVm(this.anzahl);
        this.vorschauBald();
      } else if (t.matches('[data-pv-suche]') && e.type === 'input') {
        clearTimeout(this._sucheTimer);
        this._sucheTimer = setTimeout(() => void this.suchen(t.value), SUCHE_MS);
      } else if (t.matches('[data-pv-kampagne]') && e.type === 'change') {
        void this.waehleKampagne(t.value);
      } else if (t.matches('[data-pv-produktion]') && e.type === 'change') {
        void this.waehleProduktion(t.value);
      }
    };
    ['click', 'input', 'change'].forEach(typ => document.addEventListener(typ, this._handler));
    this._resize = () => this.einpassen();
    window.addEventListener('resize', this._resize);
    const root = this.root();
    this._loese = [
      bindSegmentSwitches(root, (_id, quelle) => void this.wechsleQuelle(quelle), { attr: QUELLE_ATTR }),
      bindSegmentSwitches(root, (_id, max) => {
        this.maxJeSeite = Number(max);
        this.vorschauBald();
      }, { attr: MAX_ATTR }),
      bindeErfassenHoehe(root, { inhalt: root })
    ];
  }

  destroy() {
    this._ladeId += 1;
    this._sucheId += 1;
    clearTimeout(this._timer);
    clearTimeout(this._sucheTimer);
    if (this._handler) {
      ['click', 'input', 'change'].forEach(typ => document.removeEventListener(typ, this._handler));
      this._handler = null;
    }
    if (this._resize) window.removeEventListener('resize', this._resize);
    this._resize = null;
    this._loese.forEach(loese => loese());
    this._loese = [];
    if (aktiveSeite === this) aktiveSeite = null;
  }
}

if (import.meta.hot) {
  // Ändert sich nur das CSS, kommt die neu geladene Vorlage über die erste Position
  import.meta.hot.accept(['../report-pdf/reportPdfVorlage.js', '../report-pdf/reportPdfStil.js'], ([mod]) => {
    if (mod?.renderReportPdf) vorlage = mod.renderReportPdf;
    aktiveSeite?.aktualisiereVorschau();
  });
}
