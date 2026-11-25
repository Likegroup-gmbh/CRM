// MedienablagePage.js
// Betriebsseite der Medienablage im Accounting-Bereich (nur Admins). Alle Dateien liegen
// in SharePoint (ADR 0082): die Seite zeigt den Stand des Abgleichs, Umsortieren je
// Unternehmen, Finale spiegeln und den Eingang (nicht zugeordnete und fehlerhafte Dateien).
// Stand und Aktionen laufen ueber die Function ablage-stand; nach jeder Aktion wird der
// Stand neu geladen.
// Teile: medienablageStand.js (Karten, Eingang), medienablageUmsortieren.js (Umsortieren,
// Suche), medienablageFinale.js (Finale Version im Finder), medienablageFormat.js (Helfer).

import { escapeHtml } from '../../core/format.js';
import { navMark } from '../../core/dev/navTrace.js';
import { postStand, setBusy } from './medienablageFormat.js';
import { nichtKonfiguriertHtml, kartenHtml, unzugeordnetHtml, fehlerHtml } from './medienablageStand.js';
import { umsortierenHtml, filterUnternehmen, umsortierenStarten } from './medienablageUmsortieren.js';
import { finalSpiegelHtml, finalSpiegelStarten } from './medienablageFinale.js';

export class MedienablagePage {
  constructor() {
    this.data = null;
    this._docClickHandler = null;
    this._docInputHandler = null;
    // Abbruch-Token wie in der Datenqualitaet: ein laufender Load rendert
    // nur, solange sein Token noch gilt.
    this._ladeId = 0;
    // Eine Aktion zur Zeit; weitere Klicks waehrenddessen verfallen.
    this._busy = false;
    // Suchtext der Unternehmensliste, ueberlebt das Neu-Rendern nach Aktionen.
    this._suche = '';
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
  }

  async loadData() {
    this.data = await postStand({ aktion: 'stand' });
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
    // Neu-Rendern nach Aktionen: Fokus und Cursor der Suche bleiben
    const suche = document.activeElement?.matches?.('[data-ma-suche]') ? document.activeElement : null;
    const cursor = suche?.selectionStart ?? null;
    window.setContentSafely(window.content, `
      <div class="admin-page ma-page">
        <div class="admin-header">
          <p class="admin-hint">Alle Uploads gehen nach SharePoint. Hier steht, ob der Abgleich läuft, welche Dateien im Eingang hängen, und hier wird umsortiert und Finale gespiegelt.</p>
        </div>
        ${this.konfig.konfiguriert ? `
          ${kartenHtml(this)}
          ${umsortierenHtml(this)}
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

  // ---------- Events ----------

  bindEvents() {
    if (this._docClickHandler) return;

    this._docClickHandler = (e) => {
      const abgleich = e.target.closest('[data-ma-aktion]');
      if (abgleich) {
        const aktion = abgleich.dataset.maAktion;
        void this.ausfuehren({ aktion }, {
          button: abgleich,
          erfolg: aktion === 'voll_abgleich' ? 'Vollabgleich angestoßen.' : 'Abgleich angestoßen.',
        });
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

    this._docInputHandler = (e) => {
      if (!e.target.closest?.('[data-ma-suche]')) return;
      this._suche = e.target.value || '';
      filterUnternehmen(this);
    };

    document.addEventListener('click', this._docClickHandler);
    document.addEventListener('input', this._docInputHandler);
  }

  destroy() {
    // Ein noch laufender Load darf nicht mehr in die naechste Seite rendern.
    this._ladeId += 1;
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
      document.removeEventListener('input', this._docInputHandler);
      this._docClickHandler = null;
      this._docInputHandler = null;
    }
  }
}
