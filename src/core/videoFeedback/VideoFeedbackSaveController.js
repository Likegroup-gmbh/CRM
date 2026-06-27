// VideoFeedbackSaveController
// Zentrale Speicher-Steuerung fuer Video-Feedback-Felder (Tabelle UND Player).
// - Autosave waehrend des Tippens (debounced).
// - Genau ein laufender Save pro Feld (Dedup); Aenderungen waehrend des Saves
//   loesen genau einen Folge-Save aus.
// - flush()/flushAll() fuer Exit-Pfade (blur, Player schliessen/Weiter,
//   Navigation, beforeunload) -> garantiert kein verlorener Text.
// Die eigentliche DB-Schreiblogik liegt im VideoTableFieldHandler
// (table.handleFieldUpdate); dieser Controller orchestriert nur Timing,
// Dedup und Status.

import { FeedbackSaveStatus } from './FeedbackSaveStatus.js';

const DEFAULT_DEBOUNCE_MS = 800;

export class VideoFeedbackSaveController {
  constructor(table, { debounceMs = DEFAULT_DEBOUNCE_MS } = {}) {
    this.table = table;
    this.debounceMs = debounceMs;
    this.status = new FeedbackSaveStatus();
    this._pending = new Map();   // key -> { field, timer, saving, rerun }
    this._lastSaved = new Map(); // key -> zuletzt erfolgreich gespeicherter Wert
    this._dirty = new Set();     // keys mit ungespeicherten Aenderungen
  }

  _key(field) {
    return `${field.dataset.id}|${field.dataset.field}`;
  }

  // Feld fokussiert: Status-Tag sofort anzeigen ("Bearbeiten"), ausser es laeuft
  // gerade ein Save oder es gibt ungespeicherte/fehlgeschlagene Aenderungen
  // (dann darf der vorhandene Status-Text nicht ueberschrieben werden).
  onFocus(field) {
    const key = this._key(field);
    if (this._dirty.has(key) || this._pending.get(key)?.saving) return;
    this.status.setEditing(field);
  }

  // Feld verlassen: offene Aenderungen sofort speichern. War nichts zu speichern,
  // verschwindet das "Bearbeiten"-Tag wieder.
  onBlur(field) {
    const key = this._key(field);
    const p = this.flushField(field);
    if (!this._dirty.has(key) && !this._pending.has(key)) {
      this.status.clear(field);
    }
    return p;
  }

  // Debounced Autosave waehrend des Tippens.
  schedule(field) {
    const key = this._key(field);
    this._dirty.add(key);
    const entry = this._pending.get(key) || {};
    entry.field = field;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => { this.flush(key); }, this.debounceMs);
    this._pending.set(key, entry);
  }

  // Sofort speichern (blur / Exit-Pfade). Gibt ein Promise zurueck.
  flushField(field) {
    const key = this._key(field);
    this._dirty.add(key);
    const entry = this._pending.get(key) || {};
    entry.field = field;
    this._pending.set(key, entry);
    return this.flush(key);
  }

  async flush(key) {
    const entry = this._pending.get(key);
    if (!entry || !entry.field) return;
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = null; }

    // Nur ein Save pro Feld gleichzeitig. Spaetere Aenderungen -> ein Rerun.
    if (entry.saving) { entry.rerun = true; return; }

    const field = entry.field;
    const value = field.value;

    // Kein No-op-Save (z.B. blur direkt nach erledigtem Autosave).
    if (this._lastSaved.get(key) === value) {
      this._dirty.delete(key);
      this._pending.delete(key);
      return;
    }

    entry.saving = true;
    this.status.setSaving(field);

    let ok = false;
    try {
      ok = await this.table.handleFieldUpdate(field);
    } catch (_) {
      ok = false;
    }
    entry.saving = false;

    if (ok) {
      this._lastSaved.set(key, value);
      this._dirty.delete(key);
      this.status.setSaved(field);
      this._syncSiblings(field);
    } else {
      // Bleibt dirty -> Realtime darf den (noch) nicht gespeicherten Text nicht
      // ueberschreiben; Status zeigt Retry an.
      this.status.setError(field, () => this.flushField(field));
    }

    if (entry.rerun) {
      entry.rerun = false;
      return this.flush(key);
    }
    this._pending.delete(key);
  }

  // Alle offenen Saves sofort ausloesen (Exit-Pfade). Liest den Wert aus den
  // gemerkten Feld-Referenzen -> funktioniert auch, wenn das Feld bereits aus
  // dem DOM entfernt wurde (Node behaelt .value).
  async flushAll() {
    const keys = [...this._pending.keys()];
    await Promise.all(keys.map(k => this.flush(k)));
  }

  hasPending() {
    return this._pending.size > 0;
  }

  // Hat dieser Slot (videoId+Feld) ungespeicherte Aenderungen (pending, laufend
  // oder fehlgeschlagen)? Realtime nutzt das, um lokalen Text nicht zu
  // ueberschreiben.
  isDirty(videoId, fieldName) {
    return this._dirty.has(`${videoId}|${fieldName}`);
  }

  // Haelt doppelte Textareas desselben Feldes (Tabelle <-> Player) in Sync.
  _syncSiblings(field) {
    const id = field.dataset.id;
    const fieldName = field.dataset.field;
    if (!id || !fieldName) return;
    document
      .querySelectorAll(`textarea[data-entity="video"][data-id="${id}"][data-field="${fieldName}"]`)
      .forEach(el => {
        if (el !== field && el.value !== field.value) el.value = field.value;
      });
    this.table._rowHeightSync?.schedule?.();
  }
}
