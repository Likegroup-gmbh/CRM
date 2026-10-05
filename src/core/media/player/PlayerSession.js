// PlayerSession
// Gemeinsamer Zustand eines geoeffneten Players: Item-Liste + Position, geladene
// Video-Assets, die Auswahl je Medientyp, Anzeige-State (loading/src) und der
// einmalige Direkteinstiegs-Wunsch (intent). Reiner State - die Regeln dazu
// liegen in selection/*, das Anzeigen in stage/*.

export class PlayerSession {
  constructor(table) {
    this.table = table;

    this.items = [];
    this.index = 0;

    // Video-spezifisch
    this.assets = [];
    this.video = { version: null, assetId: null };
    // Story-spezifisch
    this.story = { version: null, finalAssetId: null };
    // Still-spezifisch
    this.still = { version: null, assetId: null };

    // Anzeige
    this.loading = false;
    this.src = null;
    this.fallbackUrl = null;

    /** Einmaliger Direkteinstieg "Finale Version": { final: true, assetId } */
    this.intent = null;
  }

  get current() {
    return this.items[this.index] || null;
  }

  /** Auswahl und Anzeige-Quelle zuruecksetzen (Item-Wechsel). */
  resetItemState() {
    this.assets = [];
    this.video = { version: null, assetId: null };
    this.story = { version: null, finalAssetId: null };
    this.still = { version: null, assetId: null };
    this.src = null;
    this.fallbackUrl = null;
  }

  /** Intent verbrauchen: gilt nur fuer das erste geladene Item. */
  takeIntent() {
    const intent = this.intent;
    this.intent = null;
    return intent;
  }
}
