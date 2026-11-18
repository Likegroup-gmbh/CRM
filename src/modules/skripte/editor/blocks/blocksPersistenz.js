// blocksPersistenz.js
// Stand laden, debounced speichern mit Revisionszaehler, Konflikt-Dialog, Undo/Redo
// (Prototype-Mixin von SkriptEditorBlocks)

import { skripteService } from '../../SkripteService.js';
import { normalisiereBloecke, fuerSpeichern } from '../dokument/blockModell.js';

const SPEICHERN_MS = 800;
const UNDO_MAX = 100;

export const blocksPersistenzMethoden = {
  // ------------------------------------------------------------------
  // Stand und Speichern
  // ------------------------------------------------------------------

  /** Vor jedem renderDoc: Stand aus dem Skript, ungespeicherte eigene Aenderungen gewinnen. */
  sync(skript) {
    if (!skript?.id) return;
    if (skript.id !== this.skriptId) {
      this.laden(skript);
      return;
    }
    if (skript.dokument_bloecke === this.bloecke) return;
    if (this.dirty || this.laeuft) {
      skript.dokument_bloecke = this.bloecke;
      skript.dokument_bloecke_rev = this.rev;
      return;
    }
    this.laden(skript, { undoBehalten: true });
  },

  laden(skript, { undoBehalten = false } = {}) {
    clearTimeout(this.timer);
    this.timer = null;
    this.skriptId = skript.id;
    this.bloecke = normalisiereBloecke(skript.dokument_bloecke);
    this.rev = Number(skript.dokument_bloecke_rev) || 0;
    skript.dokument_bloecke = this.bloecke;
    this.dirty = false;
    if (!undoBehalten) {
      this.undoStack = [];
      this.redoStack = [];
      this.aktiverBlockId = null;
      this.letzteTabellenZelle = null;
    }
    this.tippGruppe = { key: null, zeit: 0 };
  },

  geaendert() {
    const v = this.view;
    if (v.skript?.id === this.skriptId) v.skript.dokument_bloecke = this.bloecke;
    this.dirty = true;
    v._toolbar?.aktualisieren();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.speichern();
    }, SPEICHERN_MS);
  },

  async speichern({ ueberschreiben = false } = {}) {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.laeuft) {
      this.nochmal = true;
      if (ueberschreiben) this.nochmalUeberschreiben = true;
      return this.laeuft;
    }
    if (!this.dirty || !this.skriptId || this.konfliktOffen) return;
    this.dirty = false;
    const skriptId = this.skriptId;
    const stand = fuerSpeichern(this.bloecke);
    this.laeuft = (async () => {
      try {
        let rev = this.rev;
        if (ueberschreiben) rev = (await skripteService.loadDokumentBloecke(skriptId)).rev;
        const res = await skripteService.saveDokumentBloecke(skriptId, stand, rev);
        if (skriptId !== this.skriptId) return;
        if (res.konflikt) {
          this.dirty = true;
          this.nochmal = false;
          this.konflikt();
          return;
        }
        this.rev = res.rev;
        if (this.view.skript?.id === skriptId) this.view.skript.dokument_bloecke_rev = res.rev;
      } catch (err) {
        if (skriptId === this.skriptId) this.dirty = true;
        window.toastSystem?.error(`Dokument nicht gespeichert: ${err.message}`);
      }
    })();
    try {
      await this.laeuft;
    } finally {
      this.laeuft = null;
      if (this.nochmal) {
        const mitUeberschreiben = this.nochmalUeberschreiben;
        this.nochmal = false;
        this.nochmalUeberschreiben = false;
        if (this.dirty) this.speichern({ ueberschreiben: mitUeberschreiben });
      }
      this.view._toolbar?.aktualisieren();
    }
  },

  /** Vor Skript-Wechsel und Abbau. */
  async flush() {
    clearTimeout(this.timer);
    this.timer = null;
    for (let i = 0; i < 3 && (this.laeuft || (this.dirty && !this.konfliktOffen)); i++) {
      if (this.laeuft) await this.laeuft.catch(() => {});
      else await this.speichern();
    }
  },

  async konflikt() {
    if (this.konfliktOffen) return;
    this.konfliktOffen = true;
    let ueberschreiben = false;
    try {
      const res = await window.confirmationModal?.open({
        title: 'Dokument wurde parallel geändert',
        message: 'Jemand anderes hat die Blöcke rund um die Skript-Tabelle gespeichert, während du sie bearbeitet hast. '
          + 'Speicherst du deinen Stand, ist der andere weg. Lädst du den anderen Stand, holt ⌘Z deinen zurück.',
        confirmText: 'Meinen Stand speichern',
        cancelText: 'Anderen Stand laden'
      });
      ueberschreiben = Boolean(res?.confirmed);
    } finally {
      this.konfliktOffen = false;
    }
    if (ueberschreiben) {
      this.dirty = true;
      await this.speichern({ ueberschreiben: true });
      return;
    }
    await this.neuLaden();
  },

  async neuLaden() {
    const skriptId = this.skriptId;
    try {
      const { bloecke, rev } = await skripteService.loadDokumentBloecke(skriptId);
      if (skriptId !== this.skriptId) return;
      this.merkeStand();
      this.bloecke = normalisiereBloecke(bloecke);
      this.rev = rev;
      this.dirty = false;
      if (this.view.skript?.id === skriptId) {
        this.view.skript.dokument_bloecke = this.bloecke;
        this.view.skript.dokument_bloecke_rev = rev;
      }
      this.renderBloecke();
    } catch (err) {
      window.toastSystem?.error(err.message);
    }
  },

  // ------------------------------------------------------------------
  // Undo / Redo (nur Bloecke; die Skript-Tabelle hat eigene Versionen)
  // ------------------------------------------------------------------

  merkeStand() {
    const stand = JSON.stringify(this.bloecke);
    if (this.undoStack.at(-1) !== stand) {
      this.undoStack.push(stand);
      if (this.undoStack.length > UNDO_MAX) this.undoStack.shift();
    }
    this.redoStack = [];
  },

  rueckgaengig() {
    const jetzt = JSON.stringify(this.bloecke);
    while (this.undoStack.length && this.undoStack.at(-1) === jetzt) this.undoStack.pop();
    const vorher = this.undoStack.pop();
    if (!vorher) return false;
    this.redoStack.push(jetzt);
    this.anwendenStand(vorher);
    return true;
  },

  wiederholen() {
    const nachher = this.redoStack.pop();
    if (!nachher) return false;
    this.undoStack.push(JSON.stringify(this.bloecke));
    this.anwendenStand(nachher);
    return true;
  },

  anwendenStand(json) {
    const fokus = this.aktuellerFokus();
    this.bloecke = normalisiereBloecke(JSON.parse(json));
    this.tippGruppe = { key: null, zeit: 0 };
    this.geaendert();
    this.renderBloecke({ fokus });
  },

  /** Strukturaenderung: Undo-Punkt, neue Liste, neu rendern, Fokus setzen. */
  struktur(fn, fokus = null) {
    this.merkeStand();
    this.bloecke = normalisiereBloecke(fn(this.bloecke));
    this.tippGruppe = { key: null, zeit: 0 };
    this.geaendert();
    this.renderBloecke({ fokus });
  },
};
