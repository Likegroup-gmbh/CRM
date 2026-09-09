// BriefingExtractApply.js
// Uebernimmt Likys Extrakt ins Briefing-Formular. Anders als am Produkt
// (DOM-zuerst) wird hier formData zuerst geschrieben und das Formular dann
// neu gerendert - die Custom-Widgets (entitySelect, repeatableKpi,
// channelGroup) lassen sich nicht sinnvoll ueber DOM-Events befuellen.
// Danach markiert der ExtractReviewLayer die sichtbaren Felder.
//
// Die Instanz lebt am BriefingLikyPanel und uebersteht Step-Renders:
// aiFill bleibt erhalten, setForm/markVisible werden nach jedem Render
// erneut aufgerufen.

import { ExtractReviewLayer } from '../../../core/form/ai/ExtractReviewLayer.js';

export class BriefingExtractApply {
  constructor(briefingCreate) {
    this.briefing = briefingCreate;
    this.form = null;
    this.review = null;
    // name -> { from, kind } fuer die Markierung (ueberlebt Step-Renders)
    this.aiFill = new Map();
  }

  setForm(form) {
    this.form = form;
    this.review = form ? new ExtractReviewLayer(form) : null;
  }

  /**
   * Extrahierte Felder in formData schreiben. Nur leere Felder - was der
   * Nutzer selbst ausgefuellt hat, bleibt stehen.
   * @returns {{ applied: string[], skipped: string[] }}
   */
  apply(fields, spec) {
    const applied = [];
    const skipped = [];
    const specByName = new Map(spec.map((f) => [f.name, f]));

    for (const [name, entry] of Object.entries(fields || {})) {
      const specField = specByName.get(name);
      if (!specField || entry?.value == null) continue;

      const current = this.briefing.formData[name];
      if (!this.isEmpty(current)) {
        skipped.push(specField.label || name);
        continue;
      }

      this.briefing.formData[name] = entry.value;
      this.aiFill.set(name, { from: entry.from || null, kind: entry.kind || 'fact' });
      applied.push(specField.label || name);
    }

    return { applied, skipped };
  }

  /** Chat-Patches: duerfen vorhandene Werte aendern (Explizite Steuerung). */
  applyPatches(patches, spec) {
    const applied = [];
    const specByName = new Map(spec.map((f) => [f.name, f]));

    for (const [name, value] of Object.entries(patches || {})) {
      const specField = specByName.get(name);
      if (!specField || value == null) continue;

      this.briefing.formData[name] = value;
      this.aiFill.set(name, { from: 'Chat', kind: 'fact' });
      applied.push(specField.label || name);
    }

    return { applied };
  }

  /** Neu rendern und die sichtbaren Felder markieren. */
  renderAndMark() {
    this.briefing.render();
    // render() hat das DOM ersetzt - Referenzen neu holen
    this.setForm(document.getElementById('briefing-form'));
    this.markVisible();
  }

  /** Felder des aktuellen Steps markieren (nach jedem Step-Render aufrufen). */
  markVisible() {
    if (!this.form || !this.review) return;
    for (const [name, entry] of this.aiFill) {
      // mark() schreibt den Wert selbst ins Feld - also aus formData mitgeben
      this.review.mark(name, { ...entry, value: this.briefing.formData[name] });
    }
  }

  isEmpty(value) {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) {
      if (value.length === 0) return true;
      // [{kpi, zielwert}] mit leeren Feldern gilt als leer
      return value.every((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? Object.values(item).every((v) => v == null || String(v).trim() === '')
          : false
      );
    }
    if (typeof value === 'object') {
      return Object.values(value).every((v) => this.isEmpty(v));
    }
    return false;
  }
}
