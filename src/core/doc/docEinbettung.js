// docEinbettung.js
// Worksheet-Formulare (Produkt, Persona; ADR 0003) als eigene Seite oder eingebettet
// in einen fremden Host, z. B. den Tab der Produktion (ADR 0079). Eingebettet schreibt
// das Formular in den Host statt in window.content, setzt weder Headline noch
// Breadcrumb und schließt über onSchliessen, statt zurückzunavigieren.

import { returnTo } from '../breadcrumbTrail.js';

// Abgebaut, während init noch lud: nicht in den Pane schreiben, den schon ein anderer belegt
function pruefe(einbettung) {
  if (einbettung.abgebaut || !einbettung.host?.isConnected) {
    throw new DOMException('Einbettung abgebaut', 'AbortError');
  }
}

/**
 * @param {object} proto Prototyp des Formulars (braucht returnRoute und destroy)
 * @param {{ seitenKopf: (titel: string, blatt: string) => void }} opts
 *   seitenKopf läuft mit this = Formular und setzt Headline und Breadcrumb der Seite
 */
export function installDocEinbettung(proto, { seitenKopf }) {
  Object.defineProperty(proto, 'embedded', {
    configurable: true,
    get() { return Boolean(this._einbettung); }
  });

  /** @param {{ host: HTMLElement, onTitel?: (blatt: string) => void, onSchliessen?: () => void }} einbettung */
  proto._einbetten = function _einbetten(einbettung) {
    this._einbettung = { ...einbettung, abgebaut: false };
  };

  proto._inhalt = function _inhalt() {
    if (!this._einbettung) return window.content;
    pruefe(this._einbettung);
    return this._einbettung.host;
  };

  /** titel: Headline der Seite, blatt: letztes Breadcrumb-Segment */
  proto._kopf = function _kopf(titel, blatt) {
    if (!this._einbettung) {
      seitenKopf.call(this, titel, blatt);
      return;
    }
    pruefe(this._einbettung);
    this._einbettung.onTitel?.(blatt);
  };

  /** Abbrechen, Speichern, Löschen, Fehler. ziel: feste Adresse statt der Herkunft. */
  proto._zurueck = function _zurueck(ziel = null) {
    if (this._einbettung) {
      if (!this._einbettung.abgebaut) this._einbettung.onSchliessen?.();
      return;
    }
    if (ziel) window.navigateTo(ziel);
    else returnTo(this.returnRoute);
  };

  const destroy = proto.destroy;
  proto.destroy = function destroyMitEinbettung() {
    if (this._einbettung) this._einbettung.abgebaut = true;
    return destroy.call(this);
  };
}
