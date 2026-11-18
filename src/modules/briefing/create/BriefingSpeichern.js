// BriefingSpeichern.js
// Entwurf speichern, Finalisieren und Laden des Briefing-Generators.
// Produkte hängen nach jedem Speichern am Briefing (ProduktListeEvents, ADR 0074).

import { BriefingCreate } from './BriefingCreateCore.js';
import { getAllFields } from './fieldConfig.js';
import { videolaengeAusBriefing } from '../videolaenge.js';
import { resolveBriefingFieldValue } from '../briefingLegacy.js';
import { BRIEFING_SPALTEN } from '../briefingSpalten.js';
import { briefingPlattformen, umsetzungsideenEintraege } from '../briefingAltfelder.js';
import { starteBriefingAuswertung } from './BriefingAuswertung.js';
import { backTarget, returnTo } from '../../../core/breadcrumbTrail.js';
import { linieRueckkehr } from '../../kampagne/linienScope.js';
import { hatNutzung, nutzungAusBereich } from './bereichAbleiten.js';

// Nach dem Speichern zurück zur Herkunft; aus einer Produktion landet man auf dem Briefing-Tab dieses Briefings.
function zurueckNachSpeichern(fallback, briefingId) {
  return returnTo(linieRueckkehr(backTarget(fallback), briefingId));
}

BriefingCreate.prototype.saveDraftToDB = async function() {
  this.saveCurrentStepData();

  const saveDraftBtn = document.getElementById('btn-save-draft');
  const saveDraftLabel = saveDraftBtn?.querySelector('.btn-label');
  if (saveDraftBtn) {
    saveDraftBtn.disabled = true;
    if (saveDraftLabel) saveDraftLabel.textContent = 'Speichert...';
  }

  try {
    await this.persistDraft();
    window.toastSystem?.show(this.editId ? 'Entwurf aktualisiert!' : 'Entwurf gespeichert!', 'success');
    setTimeout(() => {
      zurueckNachSpeichern('/briefing', this.editId);
    }, 500);
  } catch (error) {
    console.error('Fehler beim Speichern des Entwurfs:', error);
    window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
  } finally {
    if (saveDraftBtn) {
      saveDraftBtn.disabled = false;
      if (saveDraftLabel) saveDraftLabel.textContent = 'Als Entwurf speichern';
    }
  }
};

/**
 * Interner Draft ohne Toast und ohne Navigation. Wird auch vom Liky-Panel und vom
 * Produkt-Sync aufgerufen, wenn noch keine Briefing-ID existiert.
 */
BriefingCreate.prototype.persistDraft = async function() {
  const data = this.prepareDataForDB();
  data.is_draft = true;
  // Eine Kunden-Einreichung wird als Entwurf-Linie der Produktion angelegt (ADR 0055).
  // ensureBriefingLine läuft erst beim Finalisieren, damit nicht sofort Casting und Konzept entstehen.
  if (this._einreichungId) {
    data.produktion_id = this.formData.produktion_id || this._produktionKontext?.produktionId || null;
  }

  if (this.editId) {
    const { error } = await window.supabase
      .from('campaign_briefings')
      .update(data)
      .eq('id', this.editId);
    if (error) throw error;
  } else {
    const { data: created, error } = await window.supabase
      .from('campaign_briefings')
      .insert([data])
      .select('id')
      .single();
    if (error) throw error;
    this.editId = created.id;
  }
  await this.einreichungAbschliessen?.(this.editId);
  await this.produkteVerknuepfen?.();
  return this.editId;
};

function zuordnungFehlt(self) {
  if (!self.formData.unternehmen_id) return 'Bitte ein Unternehmen zuordnen (Schritt Rahmen).';
  if (!(self.formData.kampagne_id || self._produktionKontext?.kampagneId)) return 'Bitte eine Kampagne zuordnen (Schritt Rahmen).';
  if (!self.resolveBriefingName()) return 'Bitte einen Kampagnentitel vergeben (Schritt Rahmen).';
  if (!hatNutzung(self.formData)) return 'Bitte angeben, wie der Content verwendet wird (Schritt Rahmen).';
  if (!(self.formData.produktion_id || self._produktionKontext?.produktionId)) {
    return 'Bitte eine Produktion wählen. Sonst im Auftrag oder in der Kampagne eine anlegen.';
  }
  return null;
}

BriefingCreate.prototype.handleSubmit = async function() {
  if (!this.validateCurrentStep()) return;
  this.saveCurrentStepData();

  const fehlt = zuordnungFehlt(this);
  if (fehlt) {
    window.toastSystem?.show(fehlt, 'warning');
    return;
  }
  const kampagneId = this.formData.kampagne_id || this._produktionKontext?.kampagneId || null;
  const produktId = this.formData.produkt_id || this._produktionKontext?.produktId || null;
  const produktionId = this.formData.produktion_id || this._produktionKontext?.produktionId || null;

  const submitBtn = document.getElementById('btn-submit');
  const isEdit = !!this.editId;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = isEdit ? 'Wird aktualisiert...' : 'Wird erstellt...';
  }

  try {
    const data = this.prepareDataForDB();
    data.is_draft = false;

    if (this.editId) {
      const { error } = await window.supabase
        .from('campaign_briefings')
        .update(data)
        .eq('id', this.editId);
      if (error) throw error;
    } else {
      const { data: created, error } = await window.supabase
        .from('campaign_briefings')
        .insert([data])
        .select('id')
        .single();
      if (error) throw error;
      this.editId = created.id;
    }
    await this.einreichungAbschliessen?.(this.editId);
    await this.produkteVerknuepfen?.();

    let auswertungOk = false;
    try {
      await starteBriefingAuswertung({ briefingId: this.editId });
      auswertungOk = true;
    } catch (auswertungError) {
      console.warn('KI-Auswertung:', auswertungError);
    }

    const { ensureBriefingLine } = await import('../../produktion/ProduktionService.js');
    await ensureBriefingLine({
      briefing: {
        id: this.editId,
        is_draft: false,
        aktivierung_name: data.aktivierung_name,
        bereich: data.bereich,
        plattformen: data.plattformen,
        unternehmen_id: data.unternehmen_id,
        marke_id: data.marke_id,
        kampagne_id: kampagneId,
        produktion_id: produktionId,
        produkt_id: produktId
      },
      kampagneId,
      produktId,
      produktionId
    });

    window.toastSystem?.show(
      auswertungOk
        ? 'Briefing gespeichert – KI-Auswertung läuft im Hintergrund'
        : (isEdit ? 'Briefing aktualisiert!' : 'Briefing erfolgreich erstellt!'),
      'success'
    );

    setTimeout(() => {
      Promise.resolve(zurueckNachSpeichern(`/briefing/${this.editId}`, this.editId)).catch((navError) => {
        console.error('Weiterleitung nach dem Speichern fehlgeschlagen:', navError);
        window.toastSystem?.show('Gespeichert, aber die Weiterleitung ist fehlgeschlagen. Bitte Seite neu laden.', 'error');
      });
    }, 500);
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? 'Briefing aktualisieren' : 'Briefing erstellen';
    }
  }
};

/** formData aus einer Briefing-Zeile. Ältere Briefings: Plattformen und Ideen aus den Altfeldern. */
export function formDataAusBriefing(briefing) {
  const formData = {};
  for (const field of getAllFields()) {
    if (field.type === 'videolaenge' || field.type === 'ideenListe') continue;
    const value = resolveBriefingFieldValue(briefing, field.name);
    if (value !== undefined && value !== null) formData[field.name] = value;
  }
  const plattformen = briefingPlattformen(briefing);
  if (plattformen.length) formData.plattformen = plattformen;
  const laenge = videolaengeAusBriefing(briefing);
  if (laenge) formData.videolaenge = laenge;
  formData.umsetzungsideen_eintraege = umsetzungsideenEintraege(briefing);
  formData.bereich = briefing.bereich;
  Object.assign(formData, nutzungAusBereich(formData, briefing.bereich));
  formData.unternehmen_id = briefing.unternehmen_id;
  formData.marke_id = briefing.marke_id;
  return formData;
}

BriefingCreate.prototype.loadFromDB = async function(id) {
  try {
    const { data: briefing, error } = await window.supabase
      .from('campaign_briefings')
      .select(BRIEFING_SPALTEN)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!briefing) return;

    this.formData = formDataAusBriefing(briefing);

    const { data: produktion } = briefing.produktion_id
      ? await window.supabase
        .from('produktion')
        .select('id, kampagne_id, produkt_id')
        .eq('id', briefing.produktion_id)
        .maybeSingle()
      : { data: null };
    if (produktion?.id) {
      this.formData.produktion_id = produktion.id;
      if (produktion.kampagne_id) this.formData.kampagne_id = produktion.kampagne_id;
      if (produktion.produkt_id) this.formData.produkt_id = produktion.produkt_id;
      this._produktionKontext = {
        kampagneId: this.formData.kampagne_id,
        produktId: this.formData.produkt_id,
        produktionId: produktion.id
      };
      this._linieGesperrt = !!this.formData.kampagne_id;
    }

    await this.ladeBriefingProdukte?.(id);

    this.selectedBereich = briefing.bereich;
    this.currentStep = 1;
  } catch (error) {
    console.error('Fehler beim Laden des Briefings:', error);
    window.toastSystem?.show('Briefing konnte nicht geladen werden', 'error');
  }
};
