// MedienablagePage.js
// Betriebsseite der Medienablage im Accounting-Bereich (nur Admins).
// SharePoint ist die zweite Ablage neben Dropbox: die Seite zeigt den
// Stand des Abgleichs, den Notschalter zurueck auf Dropbox, die Weiche je
// Unternehmen mit Bestandsumzug und den Eingang (nicht zugeordnete und
// fehlerhafte Dateien). Stand und Aktionen laufen ueber die Function
// ablage-stand; nach jeder Aktion wird der Stand neu geladen.
// Teile: medienablageStand.js (Karten, Notschalter, Eingang),
// medienablageWeiche.js (Weiche, Umzug, Suche), medienablageDokumente.js (Verträge,
// Rechnungen, Aufträge: eigener Notschalter, Weiche, Umzug), medienablageFinale.js (Finale
// Version im Finder), medienablageFormat.js (Helfer).

import { escapeHtml } from '../../core/format.js';
import { navMark } from '../../core/dev/navTrace.js';
import { postStand, setBusy, bestaetigen, zahl, uhrzeit } from './medienablageFormat.js';
import { nichtKonfiguriertHtml, kartenHtml, notschalterHtml, unzugeordnetHtml, fehlerHtml } from './medienablageStand.js';
import { weicheHtml, filterUnternehmen, weicheSetzen, umzugStarten, umsortierenStarten } from './medienablageWeiche.js';
import { dokumenteHtml, dokumenteNotschalterUmschalten, dokumentWeicheSetzen, dokumentUmzugStarten } from './medienablageDokumente.js';
import { finalSpiegelHtml, finalSpiegelStarten } from './medienablageFinale.js';

// Solange ein Medien- oder Dokument-Umzug offen ist, laedt die Seite den Stand in diesem Takt nach.
export const UMZUG_POLL_MS = 3000;
const UMZUG_LABEL = { medien: 'Umzug', dokumente: 'Dokument-Umzug' };

export class MedienablagePage {
  constructor() {
    this.data = null;
    this._docClickHandler = null;
    this._docChangeHandler = null;
    this._docInputHandler = null;
    // Abbruch-Token wie in der Datenqualitaet: ein laufender Load rendert
    // nur, solange sein Token noch gilt.
    this._ladeId = 0;
    // Eine Aktion zur Zeit; weitere Klicks waehrenddessen verfallen.
    this._busy = false;
    // Suchtext der Weiche, ueberlebt das Neu-Rendern nach Aktionen.
    this._suche = '';
    // Laufende Umzuege: zuletzt geloggter Stand je Bereich und Unternehmen, gemeldete Dateien
    // (Fehler, Wiederholungen) und Pausen, Timer fuers Nachladen
    this._umzugLogStand = new Map();
    this._umzugMeldungen = new Map();
    this._umzugPausiert = new Map();
    this._umzugPoll = null;
    this.ready = Promise.resolve();
  }

  async init() {
    this._ladeId += 1;
    window.setContentSafely(window.content, '<div class="admin-loading">Lade Medienablage …</div>');
    navMark('skeleton:shown');
    this.ready = this.ladeInitial(this._ladeId);
  }

  async ladeInitial(ladeId) {
    try {
      await this.loadData();
    } catch (e) {
      if (ladeId !== this._ladeId) return;
      console.error('❌ Medienablage: Stand konnte nicht geladen werden', e);
      window.setContentSafely(window.content, `
        <div class="empty-state"><p>Fehler beim Laden: ${this.escape(e?.message || 'Unbekannt')}</p></div>
      `);
      return;
    }

    navMark('daten:geladen');
    if (ladeId !== this._ladeId) return;
    this.render();
    this.bindEvents();
    navMark('render:done');
    this.umzugBeobachten();
  }

  async loadData() {
    this.data = await postStand(this.standAnfrage());
  }

  // Beobachtete Umzuege mitschicken: ihre Meldungen kommen so auch nach der letzten Datei noch
  standAnfrage() {
    const ids = [...new Set([...this._umzugLogStand.keys()].map(k => k.split(':')[1]))];
    return ids.length ? { aktion: 'stand', umzug_ids: ids } : { aktion: 'stand' };
  }

  async neuLaden() {
    const ladeId = this._ladeId;
    try {
      await this.loadData();
    } catch (e) {
      if (ladeId !== this._ladeId) return;
      console.error('❌ Medienablage: Stand konnte nicht neu geladen werden', e);
      this.toast('Stand konnte nicht neu geladen werden.', 'error');
      return;
    }
    if (ladeId !== this._ladeId) return;
    this.render();
    this.umzugBeobachten();
  }

  // ---------- Umzug beobachten ----------

  umzuege() {
    const mit = (bereich, liste) => (liste || []).map(u => ({ ...u, bereich }));
    return [...mit('medien', this.data?.umzug), ...mit('dokumente', this.data?.dokument_umzug)];
  }

  umzugLaeuft() {
    return this.umzuege().some(u => Number(u.offen) > 0);
  }

  umzugKopf({ bereich, unternehmen_id: id }) {
    return `[Medienablage] ${UMZUG_LABEL[bereich]} (${this.unternehmen(id)?.firmenname || id})`;
  }

  umzugBeobachten() {
    const beobachtet = this.logUmzugFortschritt();
    this.logUmzugMeldungen(beobachtet);
    this.planeUmzugPoll();
  }

  // Eine Konsolenzeile je geaendertem Stand. Gezaehlt wird jede abgeschlossene Datei
  // (fertig, Fehler, uebersprungen), damit der Zaehler am Ende bei "N von N" steht.
  // -> Schluessel der Umzuege, die laufen oder gerade fertig wurden
  logUmzugFortschritt() {
    const beobachtet = new Set();
    for (const u of this.umzuege()) {
      const offen = Number(u.offen) || 0;
      const fertig = Number(u.fertig) || 0;
      const fehler = Number(u.fehler) || 0;
      const uebersprungen = Number(u.uebersprungen) || 0;
      const schluessel = `${u.bereich}:${u.unternehmen_id}`;
      const vorher = this._umzugLogStand.get(schluessel);
      // Umzuege, die schon vor dem Oeffnen der Seite fertig waren, bleiben still
      if (!offen && !vorher) continue;
      beobachtet.add(schluessel);
      this.logUmzugPause(u, schluessel, offen);
      const signatur = `${offen}/${fertig}/${fehler}/${uebersprungen}`;
      if (vorher === signatur) continue;

      const gesamt = offen + fertig + fehler + uebersprungen;
      const extra = [
        fehler ? `${zahl(fehler)} Fehler` : '',
        uebersprungen ? `${zahl(uebersprungen)} übersprungen` : '',
      ].filter(Boolean).join(', ');
      console.log(`${this.umzugKopf(u)}: ${zahl(gesamt - offen)} von ${zahl(gesamt)}${extra ? ` (${extra})` : ''}${offen ? '' : ' · abgeschlossen'}`);

      if (offen) this._umzugLogStand.set(schluessel, signatur);
      else this._umzugLogStand.delete(schluessel);
    }
    return beobachtet;
  }

  // Der Laeufer nimmt nichts: Notschalter (Medien haelt auch Dokumente an) oder Weiche auf Dropbox
  umzugPausiertGrund(u) {
    const e = this.data?.einstellung || {};
    if (e.notschalter) return 'Notschalter ist aktiv';
    if (u.bereich === 'dokumente') {
      if (e.notschalter_dokumente) return 'Notschalter Dokumente ist aktiv';
      const d = (this.data?.dokumente || []).find(x => String(x.id) === String(u.unternehmen_id));
      return d && d.dokument_ablage_ziel !== 'sharepoint' ? 'Weiche Dokumente steht auf Dropbox' : null;
    }
    const firma = this.unternehmen(u.unternehmen_id);
    return firma && firma.ablage_ziel !== 'sharepoint' ? 'Weiche steht auf Dropbox' : null;
  }

  logUmzugPause(u, schluessel, offen) {
    const grund = offen ? this.umzugPausiertGrund(u) : null;
    if (grund === (this._umzugPausiert.get(schluessel) || null)) return;
    if (grund) {
      this._umzugPausiert.set(schluessel, grund);
      console.warn(`${this.umzugKopf(u)}: pausiert, ${grund}`);
      return;
    }
    this._umzugPausiert.delete(schluessel);
    if (offen) console.info(`${this.umzugKopf(u)}: läuft weiter`);
  }

  // Fehler, Wiederholungen, Uebersprungene und Warten je Datei, einmal je neuem Stand der Datei.
  // Das Objekt dahinter (Quelle, Typ, Versuche) laesst sich in den DevTools aufklappen.
  logUmzugMeldungen(beobachtet) {
    for (const m of this.data?.umzug_meldungen || []) {
      if (!beobachtet.has(`${m.bereich}:${m.unternehmen_id}`)) continue;
      const signatur = `${m.status}/${m.grund}/${m.versuche}`;
      if (this._umzugMeldungen.get(m.id) === signatur) continue;
      this._umzugMeldungen.set(m.id, signatur);

      const kopf = `${this.umzugKopf(m)}: ${m.datei || m.typ}`;
      const um = uhrzeit(m.naechster_versuch);
      const details = { datei: m.datei, typ: m.typ, grund: m.grund, versuche: m.versuche, quelle: m.quelle, naechster_versuch: m.naechster_versuch };
      if (m.status === 'fehler') {
        console.error(`${kopf} endgültig fehlgeschlagen nach ${zahl(m.versuche)} ${m.versuche === 1 ? 'Versuch' : 'Versuchen'}: ${m.grund}`, details);
      } else if (m.status === 'uebersprungen') {
        console.warn(`${kopf} übersprungen: ${m.grund}`, details);
      } else if (m.versuche > 0) {
        console.warn(`${kopf} Versuch ${zahl(m.versuche)} von ${zahl(m.max_versuche)} fehlgeschlagen: ${m.grund}${um ? ` · nächster Versuch ${um}` : ''}`, details);
      } else {
        console.info(`${kopf} wartet: ${m.grund}${um ? ` · weiter ab ${um}` : ''}`, details);
      }
    }
  }

  planeUmzugPoll() {
    if (!this.umzugLaeuft()) {
      this.stoppeUmzugPoll();
      return;
    }
    if (this._umzugPoll) return;
    this._umzugPoll = setTimeout(() => {
      this._umzugPoll = null;
      void this.umzugNachladen();
    }, UMZUG_POLL_MS);
  }

  stoppeUmzugPoll() {
    clearTimeout(this._umzugPoll);
    this._umzugPoll = null;
  }

  // Wie neuLaden, aber leise (kein Toast) und neu gerendert nur bei geaendertem Stand.
  // Waehrend einer Aktion wartet es: die Aktion laedt danach selbst neu.
  async umzugNachladen() {
    const ladeId = this._ladeId;
    if (this._busy) {
      this.planeUmzugPoll();
      return;
    }
    let data;
    try {
      data = await postStand(this.standAnfrage());
    } catch (e) {
      if (ladeId !== this._ladeId) return;
      console.warn(`[Medienablage] Stand konnte nicht nachgeladen werden, neuer Versuch in ${UMZUG_POLL_MS / 1000} s: ${e?.message || e}`);
      this.planeUmzugPoll();
      return;
    }
    if (ladeId !== this._ladeId) return;
    if (this._busy) {
      this.planeUmzugPoll();
      return;
    }
    const geaendert = JSON.stringify(data) !== JSON.stringify(this.data);
    this.data = data;
    if (geaendert) this.render();
    this.umzugBeobachten();
  }

  // ---------- Helpers ----------

  escape(v) {
    return escapeHtml(v);
  }

  toast(text, type) {
    window.toastSystem?.show?.(text, type);
  }

  get konfig() {
    return this.data?.konfig || {};
  }

  get notschalterAn() {
    return !!this.data?.einstellung?.notschalter;
  }

  // Ein Eintrag je Drive; angezeigt wird der konfigurierte.
  get stand() {
    const liste = this.data?.stand || [];
    return liste.find(s => s.drive_id === this.konfig.drive_id) || liste[0] || {};
  }

  unternehmen(id) {
    return (this.data?.unternehmen || []).find(u => String(u.id) === String(id)) || null;
  }

  // ---------- Rendering ----------

  render() {
    // Das Nachladen waehrend eines Umzugs rendert neu: Fokus und Cursor der Suche bleiben
    const suche = document.activeElement?.matches?.('[data-ma-suche]') ? document.activeElement : null;
    const cursor = suche?.selectionStart ?? null;
    window.setContentSafely(window.content, `
      <div class="admin-page ma-page">
        <div class="admin-header">
          <p class="admin-hint">SharePoint ist die zweite Medienablage neben Dropbox. Hier steht, ob der Abgleich läuft, welche Unternehmen schon nach SharePoint hochladen und welche Dateien im Eingang hängen.</p>
        </div>
        ${this.konfig.konfiguriert ? `
          ${kartenHtml(this)}
          ${notschalterHtml(this)}
          ${weicheHtml(this)}
          ${dokumenteHtml(this)}
          ${finalSpiegelHtml(this)}
          ${unzugeordnetHtml(this)}
          ${fehlerHtml(this)}
        ` : nichtKonfiguriertHtml()}
      </div>
    `);
    filterUnternehmen(this);
    if (suche) {
      const neu = window.content.querySelector('[data-ma-suche]');
      neu?.focus();
      if (neu && cursor != null) neu.setSelectionRange(cursor, cursor);
    }
  }

  // ---------- Aktionen ----------

  // Server rufen, Ergebnis melden und in jedem Fall neu laden: auch eine
  // fehlgeschlagene Aktion kann den Stand veraendert haben.
  async ausfuehren(body, { button = null, erfolg = 'Erledigt.' } = {}) {
    if (this._busy) return;
    this._busy = true;
    setBusy(button, true);
    try {
      const antwort = await postStand(body);
      this.toast(typeof erfolg === 'function' ? erfolg(antwort) : erfolg, 'success');
    } catch (e) {
      console.error(`❌ Medienablage: Aktion ${body.aktion} fehlgeschlagen`, e);
      this.toast(`Fehlgeschlagen: ${e?.message || 'Unbekannt'}`, 'error');
    } finally {
      this._busy = false;
      setBusy(button, false);
    }
    await this.neuLaden();
  }

  async notschalterUmschalten(button) {
    if (this._busy) return;
    const an = !this.notschalterAn;
    if (an) {
      const ok = await bestaetigen({
        title: 'Notschalter einschalten',
        message: 'Alle neuen Uploads gehen ab sofort wieder nach Dropbox, auch für Unternehmen mit Ziel SharePoint. Dateien in SharePoint bleiben lesbar.',
        confirmText: 'Alle Uploads zu Dropbox',
        danger: true,
      });
      if (!ok) return;
    }
    await this.ausfuehren({ aktion: 'notschalter', an }, {
      button,
      erfolg: an ? 'Notschalter aktiv: alle Uploads gehen nach Dropbox.' : 'Notschalter aufgehoben: die Weiche gilt wieder.',
    });
  }

  // ---------- Events ----------

  bindEvents() {
    if (this._docClickHandler) return;

    this._docClickHandler = (e) => {
      const schalter = e.target.closest('[data-ma-notschalter]');
      if (schalter) {
        void this.notschalterUmschalten(schalter);
        return;
      }
      const dokSchalter = e.target.closest('[data-ma-notschalter-dokumente]');
      if (dokSchalter) {
        void dokumenteNotschalterUmschalten(this, dokSchalter);
        return;
      }
      const dokUmzug = e.target.closest('[data-ma-dokument-umzug]');
      if (dokUmzug) {
        void dokumentUmzugStarten(this, dokUmzug);
        return;
      }
      const abgleich = e.target.closest('[data-ma-aktion]');
      if (abgleich) {
        const aktion = abgleich.dataset.maAktion;
        void this.ausfuehren({ aktion }, {
          button: abgleich,
          erfolg: aktion === 'voll_abgleich' ? 'Vollabgleich angestoßen.' : 'Abgleich angestoßen.',
        });
        return;
      }
      const umzug = e.target.closest('[data-ma-umzug]');
      if (umzug) {
        void umzugStarten(this, umzug);
        return;
      }
      const umsortieren = e.target.closest('[data-ma-umsortieren]');
      if (umsortieren) {
        void umsortierenStarten(this, umsortieren);
        return;
      }
      const spiegeln = e.target.closest('[data-ma-final-spiegel]');
      if (spiegeln) {
        void finalSpiegelStarten(this, spiegeln);
        return;
      }
      const erneut = e.target.closest('[data-ma-erneut]');
      if (erneut) {
        void this.ausfuehren({ aktion: 'erneut', item_id: erneut.dataset.maErneut }, {
          button: erneut, erfolg: 'Datei wird erneut geprüft.',
        });
        return;
      }
      const ignorieren = e.target.closest('[data-ma-ignorieren]');
      if (ignorieren) {
        void this.ausfuehren({ aktion: 'ignorieren', item_id: ignorieren.dataset.maIgnorieren }, {
          button: ignorieren, erfolg: 'Datei wird ignoriert.',
        });
      }
    };

    this._docChangeHandler = (e) => {
      const weiche = e.target.closest?.('[data-ma-weiche]');
      if (weiche) void weicheSetzen(this, weiche);
      const dokWeiche = e.target.closest?.('[data-ma-dokument-weiche]');
      if (dokWeiche) void dokumentWeicheSetzen(this, dokWeiche);
    };

    this._docInputHandler = (e) => {
      if (!e.target.closest?.('[data-ma-suche]')) return;
      this._suche = e.target.value || '';
      filterUnternehmen(this);
    };

    document.addEventListener('click', this._docClickHandler);
    document.addEventListener('change', this._docChangeHandler);
    document.addEventListener('input', this._docInputHandler);
  }

  destroy() {
    // Ein noch laufender Load darf nicht mehr in die naechste Seite rendern.
    this._ladeId += 1;
    this.stoppeUmzugPoll();
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
      document.removeEventListener('change', this._docChangeHandler);
      document.removeEventListener('input', this._docInputHandler);
      this._docClickHandler = null;
      this._docChangeHandler = null;
      this._docInputHandler = null;
    }
  }
}
