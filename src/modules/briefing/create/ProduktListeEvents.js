// ProduktListeEvents.js
// Produktliste im Briefing-Formular: Zeilen hinzufügen und entfernen, beim Verlassen eines
// Felds im Hintergrund anlegen oder verknüpfen (briefingProduktSync.js), Shop-Link und
// Unterlagen-PDF auslesen. Nach dem Speichern hängen alle Produkte am Briefing.
// Einladung (produktSyncAus): nur erfassen, angelegt wird erst beim Anlegen der Einreichung.

import { BriefingCreate } from './BriefingCreateCore.js';
import { feldNachName } from './fieldConfig.js';
import { produktZeileHtml } from './fieldRendererListen.js';
import { addBriefingProdukte, removeBriefingProdukt, loadBriefingProduktDetails } from '../BriefingProdukte.js';
import {
  PRODUKT_EINGABE,
  syncEintrag,
  liesProduktAus,
  wendeAuslesenAn,
  ladeProdukt,
  istPlatzhalter,
  findeDublette
} from './briefingProduktSync.js';

const FELD = 'produkte';
const STATUS = {
  angelegt: 'Neu angelegt',
  verknuepft: 'Mit vorhandenem Produkt verknüpft',
  aktualisiert: 'Am Briefing'
};

let keyZaehler = 0;

function zeilenEintrag(row) {
  const eintrag = { produkt_id: row.dataset.produktId || null };
  for (const feld of PRODUKT_EINGABE) {
    eintrag[feld] = row.querySelector(`[data-produkt-feld="${feld}"]`)?.value.trim() || '';
  }
  return eintrag;
}

function setzeStatus(row, text, { fehler = false } = {}) {
  const el = row?.querySelector('[data-produkt-status]');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('is-fehler', fehler);
}

function eintragAusProdukt(p) {
  const eintrag = { produkt_id: p.id };
  for (const feld of PRODUKT_EINGABE) eintrag[feld] = p[feld] ?? '';
  if (istPlatzhalter(eintrag.name)) eintrag.name = '';
  return eintrag;
}

/** Leere Eingabefelder der Zeile mit Werten füllen. Ein Platzhalter-Name kommt nie ins Formular. */
function fuelleLeere(row, werte) {
  for (const feld of PRODUKT_EINGABE) {
    const input = row?.querySelector(`[data-produkt-feld="${feld}"]`);
    const wert = werte?.[feld];
    if (!input || input.value.trim() || wert == null || !String(wert).trim()) continue;
    if (feld === 'name' && istPlatzhalter(wert)) continue;
    input.value = String(wert);
  }
}

function liste() {
  return document.querySelector(`#briefing-form [data-produktliste="${FELD}"]`);
}

/** Die Zeile im aktuellen DOM: dieselbe, oder nach einem Schrittwechsel die mit gleicher Produkt-ID. */
function aktuelleZeile(row) {
  if (row?.isConnected) return row;
  const id = row?.dataset.produktId;
  return id ? liste()?.querySelector(`[data-produkt-row][data-produkt-id="${id}"]`) || null : null;
}

BriefingCreate.prototype.bindProduktListe = function() {
  const container = liste();
  if (!container) return;
  const field = feldNachName(FELD);

  container.closest('.bf-produkte')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-produkt-add]')) {
      const max = parseInt(container.dataset.max || '10', 10);
      if (container.querySelectorAll('[data-produkt-row]').length >= max) {
        window.toastSystem?.show(`Maximal ${max} Produkte.`, 'warning');
        return;
      }
      container.insertAdjacentHTML('beforeend', produktZeileHtml(field, {}, { ohneUpload: !!this.produktSyncAus }));
      container.querySelector('[data-produkt-row]:last-child [data-produkt-feld]')?.focus();
      return;
    }
    const remove = e.target.closest('[data-produkt-remove]');
    if (remove) {
      this.entferneProduktZeile(remove.closest('[data-produkt-row]'), field);
      return;
    }
    const trigger = e.target.closest('[data-produkt-pdf-trigger]');
    if (trigger) trigger.closest('[data-produkt-row]')?.querySelector('[data-produkt-pdf]')?.click();
  });

  container.addEventListener('change', (e) => {
    const row = e.target.closest('[data-produkt-row]');
    if (!row) return;
    if (e.target.matches('[data-produkt-pdf]')) {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) void this.produktAuslesen(row, { file });
      return;
    }
    this.saveCurrentStepData();
    void this.syncProduktZeile(row);
  });

  document.getElementById('unternehmen_id')?.addEventListener('change', () => this.syncOffeneProdukte());
  this.syncOffeneProdukte();
};

BriefingCreate.prototype.entferneProduktZeile = function(row, field) {
  if (!row) return;
  const container = row.parentElement;
  const id = row.dataset.produktId;
  row.remove();
  if (container && !container.querySelector('[data-produkt-row]')) {
    container.insertAdjacentHTML('beforeend', produktZeileHtml(field, {}, { ohneUpload: !!this.produktSyncAus }));
  }
  this.saveCurrentStepData();
  if (id && this.editId && !this.produktSyncAus) {
    removeBriefingProdukt(this.editId, id).catch((error) => {
      console.error('Produkt nicht vom Briefing gelöst:', error);
      window.toastSystem?.show('Produkt konnte nicht vom Briefing gelöst werden.', 'error');
    });
  }
};

/** Zeilen mit Inhalt, aber ohne Produkt (Einreichung, Liky-Import, Unternehmen nachgetragen). */
BriefingCreate.prototype.syncOffeneProdukte = async function() {
  if (this.produktSyncAus) return;
  // Läuft noch ein Sync aus dem vorigen Render, erst abwarten - sonst legen zwei Zeilen dasselbe Produkt an
  await Promise.allSettled([...(this._produktSyncs?.values() || [])]);
  liste()?.querySelectorAll('[data-produkt-row]').forEach((row) => {
    if (row.dataset.produktId) return;
    const e = zeilenEintrag(row);
    if (e.name || e.url) void this.syncProduktZeile(row);
  });
};

/** Pro Zeile nacheinander, damit schnelles Tippen kein Produkt doppelt anlegt. */
BriefingCreate.prototype.syncProduktZeile = function(row, opts = {}) {
  if (this.produktSyncAus || !row) return Promise.resolve(null);
  if (!row.dataset.produktKey) row.dataset.produktKey = `p${++keyZaehler}`;
  this._produktSyncs ||= new Map();
  const key = row.dataset.produktKey;
  const lauf = (this._produktSyncs.get(key) || Promise.resolve())
    .catch(() => null)
    .then(() => this.syncProduktZeileJetzt(row, opts));
  this._produktSyncs.set(key, lauf);
  return lauf;
};

BriefingCreate.prototype.syncProduktZeileJetzt = async function(row, { auslesen = true } = {}) {
  const eintrag = zeilenEintrag(row);
  if (!eintrag.produkt_id && !eintrag.name && !eintrag.url) return null;
  if (!this.formData.unternehmen_id) {
    setzeStatus(row, 'Wird angelegt, sobald das Unternehmen feststeht');
    return null;
  }
  setzeStatus(row, eintrag.produkt_id ? 'Speichert …' : 'Wird angelegt …');
  try {
    const ergebnis = await syncEintrag(eintrag, {
      unternehmenId: this.formData.unternehmen_id,
      markeId: this.formData.marke_id || null
    });
    if (!ergebnis) return null;
    row.dataset.produktId = ergebnis.id;
    fuelleLeere(row, ergebnis.produkt);
    setzeStatus(row, STATUS[ergebnis.art]);
    if (this.editId) await addBriefingProdukte(this.editId, [ergebnis.id]);
    if (row.isConnected) this.saveCurrentStepData();
    else this.merkeProduktId(eintrag, ergebnis.id);
    if (auslesen && ergebnis.urlNeu && ergebnis.produkt.url) void this.produktAuslesen(row, { url: ergebnis.produkt.url });
    return ergebnis.id;
  } catch (error) {
    console.error('Produkt aus dem Briefing nicht gespeichert:', error);
    setzeStatus(row, 'Produkt konnte nicht gespeichert werden', { fehler: true });
    return null;
  }
};

/** Shop-Link oder PDF auslesen: leere Formularfelder und leere Produktspalten füllen. */
BriefingCreate.prototype.produktAuslesen = async function(row, { url = null, file = null }) {
  setzeStatus(row, file ? 'Liest Unterlagen …' : 'Liest Produktseite …');
  try {
    const fields = await liesProduktAus({ url, file });
    const werte = Object.fromEntries(Object.entries(fields).map(([k, e]) => [k, e?.value]));
    const zeile = aktuelleZeile(row);
    if (zeile) fuelleLeere(zeile, werte);
    let id = zeile?.dataset.produktId || row.dataset.produktId;
    if (!id && zeile) id = await this.syncProduktZeile(zeile, { auslesen: false });
    if (!id) {
      setzeStatus(zeile || row, 'Ausgelesen. Zum Anlegen fehlen Name, Link oder Unternehmen.');
      return;
    }
    const patch = await wendeAuslesenAn(id, fields);
    setzeStatus(zeile || row, Object.keys(patch).length ? 'Ausgelesen, leere Felder ergänzt' : 'Ausgelesen');
    if (zeile) this.saveCurrentStepData();
    else this.ergaenzeProduktEintrag(id, werte);
  } catch (error) {
    console.error('Produkt nicht ausgelesen:', error);
    setzeStatus(aktuelleZeile(row) || row, `Auslesen fehlgeschlagen: ${error.message}`, { fehler: true });
  }
};

/** Zeile wurde während des Syncs weggerendert: ID am passenden formData-Eintrag festhalten. */
BriefingCreate.prototype.merkeProduktId = function(eintrag, id) {
  const offen = (this.formData[FELD] || []).filter(e => !e.produkt_id);
  const treffer = findeDublette(offen, eintrag);
  if (treffer) treffer.produkt_id = id;
};

BriefingCreate.prototype.ergaenzeProduktEintrag = function(id, werte) {
  const eintrag = (this.formData[FELD] || []).find(e => e.produkt_id === id);
  if (!eintrag) return;
  for (const feld of PRODUKT_EINGABE) {
    if (!String(eintrag[feld] ?? '').trim() && werte?.[feld] && !(feld === 'name' && istPlatzhalter(werte[feld]))) {
      eintrag[feld] = String(werte[feld]);
    }
  }
};

/** Nach dem Speichern: offene Einträge anlegen, alle Produkte ans Briefing hängen. */
BriefingCreate.prototype.produkteVerknuepfen = async function() {
  if (this.produktSyncAus || !this.editId) return;
  try {
    await Promise.allSettled([...(this._produktSyncs?.values() || [])]);
    const rows = [...(liste()?.querySelectorAll('[data-produkt-row]') || [])];
    if (rows.length) {
      for (const row of rows) if (!row.dataset.produktId) await this.syncProduktZeile(row);
      this.saveCurrentStepData();
    } else if (this.formData.unternehmen_id) {
      for (const eintrag of this.formData[FELD] || []) {
        if (eintrag.produkt_id) continue;
        const ergebnis = await syncEintrag(eintrag, {
          unternehmenId: this.formData.unternehmen_id,
          markeId: this.formData.marke_id || null
        });
        if (ergebnis) eintrag.produkt_id = ergebnis.id;
      }
    }
    const ids = (this.formData[FELD] || []).map(e => e.produkt_id).filter(Boolean);
    if (ids.length) await addBriefingProdukte(this.editId, ids);
  } catch (error) {
    console.error('Produkte nicht ans Briefing gehängt:', error);
    window.toastSystem?.show('Briefing gespeichert, aber nicht alle Produkte wurden verknüpft.', 'warning');
  }
};

BriefingCreate.prototype.ladeBriefingProdukte = async function(briefingId) {
  try {
    this.formData[FELD] = (await loadBriefingProduktDetails(briefingId)).map(eintragAusProdukt);
  } catch (error) {
    console.error('Produkte des Briefings nicht geladen:', error);
  }
};

/** Neues Briefing aus einer Produktion mit Produkt: das Produkt steht schon in der Liste. */
BriefingCreate.prototype.vorbelegeKontextProdukt = async function() {
  const id = this.formData.produkt_id || this._produktionKontext?.produktId;
  if (!id || (this.formData[FELD] || []).length) return;
  try {
    const produkt = await ladeProdukt(id);
    if (produkt) this.formData[FELD] = [eintragAusProdukt(produkt)];
  } catch (error) {
    console.warn('Produkt der Produktion nicht vorbelegt:', error);
  }
};
