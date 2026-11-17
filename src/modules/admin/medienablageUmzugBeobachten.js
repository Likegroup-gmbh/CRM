// medienablageUmzugBeobachten.js
// Laufende Umzuege der Medienablage-Seite beobachten (Mixin fuer MedienablagePage): Fortschritt,
// Pausen und Meldungen je Datei in die Konsole schreiben und die Seite nachladen, solange
// ein Medien- oder Dokument-Umzug offen ist.
// Zustand (_umzugLogStand, _umzugMeldungen, _umzugPausiert, _umzugPoll) legt der Konstruktor an.

import { postStand, zahl, uhrzeit } from './medienablageFormat.js';

// Solange ein Medien- oder Dokument-Umzug offen ist, laedt die Seite den Fortschritt in diesem Takt nach.
// Der volle Stand kommt erst wieder, wenn nichts mehr offen ist: er rechnet alle Assets und Dokumente.
export const UMZUG_POLL_MS = 3000;
const UMZUG_LABEL = { medien: 'Umzug', dokumente: 'Dokument-Umzug' };

// Zaehler je Unternehmen aus dem Teilstand uebernehmen, Reihenfolge und uebrige Eintraege bleiben
function zaehlerErsetzen(alt, neu) {
  const je = new Map((neu || []).map(u => [String(u.unternehmen_id), u]));
  const liste = (alt || []).map(u => je.get(String(u.unternehmen_id)) || u);
  const da = new Set(liste.map(u => String(u.unternehmen_id)));
  return [...liste, ...(neu || []).filter(u => !da.has(String(u.unternehmen_id)))];
}

export function installUmzugBeobachten(proto) {
  Object.assign(proto, {
    umzuege() {
      const mit = (bereich, liste) => (liste || []).map(u => ({ ...u, bereich }));
      return [...mit('medien', this.data?.umzug), ...mit('dokumente', this.data?.dokument_umzug)];
    },

    umzugLaeuft() {
      return this.umzuege().some(u => Number(u.offen) > 0);
    },

    umzugKopf({ bereich, unternehmen_id: id }) {
      return `[Medienablage] ${UMZUG_LABEL[bereich]} (${this.unternehmen(id)?.firmenname || id})`;
    },

    umzugBeobachten() {
      const beobachtet = this.logUmzugFortschritt();
      this.logUmzugMeldungen(beobachtet);
      this.planeUmzugPoll();
    },

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
    },

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
    },

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
    },

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
    },

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
    },

    stoppeUmzugPoll() {
      clearTimeout(this._umzugPoll);
      this._umzugPoll = null;
    },

    // Teilstand der Aktion fortschritt in den vollen Stand einarbeiten. Die Weichen und der
    // Notschalter kommen mit, weil die Pause-Meldungen davon abhaengen.
    fortschrittEinarbeiten(teil) {
      const weiche = new Map((teil.weichen || []).map(w => [String(w.id), w]));
      const mitWeiche = (liste, feld) => (liste || []).map(x => {
        const w = weiche.get(String(x.id));
        return w && w[feld] !== x[feld] ? { ...x, [feld]: w[feld] } : x;
      });
      return {
        ...this.data,
        einstellung: teil.einstellung || this.data?.einstellung,
        unternehmen: mitWeiche(this.data?.unternehmen, 'ablage_ziel'),
        dokumente: mitWeiche(this.data?.dokumente, 'dokument_ablage_ziel'),
        umzug: zaehlerErsetzen(this.data?.umzug, teil.umzug),
        dokument_umzug: zaehlerErsetzen(this.data?.dokument_umzug, teil.dokument_umzug),
        umzug_meldungen: teil.umzug_meldungen || [],
      };
    },

    // Wie neuLaden, aber leise (kein Toast), nur der Fortschritt und neu gerendert nur bei
    // geaendertem Stand. Waehrend einer Aktion wartet es: die Aktion laedt danach selbst neu.
    // Im Hintergrund-Tab fragt es nichts ab.
    async umzugNachladen() {
      const ladeId = this._ladeId;
      if (this._busy || document.hidden) {
        this.planeUmzugPoll();
        return;
      }
      let teil;
      try {
        teil = await postStand({ ...this.standAnfrage(), aktion: 'fortschritt' });
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
      const data = this.fortschrittEinarbeiten(teil);
      const geaendert = JSON.stringify(data) !== JSON.stringify(this.data);
      this.data = data;
      if (geaendert) this.render();
      this.umzugBeobachten();
      // Fertig: einmal der volle Stand, damit Dateizahlen und Rest-Liste wieder stimmen
      if (!this.umzugLaeuft()) await this.neuLaden();
    },
  });
}
