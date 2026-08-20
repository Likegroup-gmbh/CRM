// SkriptEditorFeedback.js
// Feedback-Steuerung im Editor: Sektions-Feedback (aus der Markierung) loest
// die KI-Ueberarbeitung aus, Voll-Feedback ist reine Bewertung.

import { skripteService } from '../SkripteService.js';

export class SkriptEditorFeedback {
  constructor(view) {
    this.view = view;
  }

  async openSektionsFeedback() {
    const v = this.view;
    if (!v.selektion || !v.skript) return;
    const { sektion, text: selektionText, istVisuell } = v.selektion;
    v.clearPending();

    await v.feedbackDrawer.openSektion({
      skript: v.skript,
      sektion,
      selektionText,
      onSubmit: ({ score, begruendung, korrektur }) =>
        this.submitSektionsFeedback({
          sektion, selektionText, score, begruendung, korrektur, ist_visuell: !!istVisuell
        })
    });
  }

  /**
   * 1. Feedback-Zeile speichern (die Bewertung darf nie verloren gehen;
   *    sie bezieht sich auf den Stand VOR der Aenderung, siehe version_nr),
   * 2. Message-Paar mit aktion 'feedback' anlegen (startet die Ueberarbeitung),
   * 3. chat_message_id am Feedback-Eintrag nachtragen (best effort).
   */
  async submitSektionsFeedback({ sektion, selektionText, score, begruendung, korrektur, ist_visuell = false }) {
    const v = this.view;
    let gespeichert;
    try {
      gespeichert = await skripteService.saveFeedback(v.skript.id, [{
        sektion,
        score,
        begruendung,
        korrigierte_version: korrektur,
        selektion_text: selektionText,
        version_nr: v.aktiveVersion.version_nr
      }]);
    } catch (err) {
      window.toastSystem?.error(`Feedback konnte nicht gespeichert werden: ${err.message}`);
      return;
    }

    const teile = [];
    if (score != null) teile.push(`Bewertung der markierten Stelle: ${String(score).replace('.', ',')}/5`);
    if (begruendung) teile.push(begruendung);
    if (korrektur) teile.push(`So sollte es sein: ${korrektur}`);

    const assistantMsg = await v.sendMessagePair({
      aktion: 'feedback',
      sektion,
      selektion_text: selektionText,
      inhalt: teile.join('\n'),
      ist_visuell: !!ist_visuell
    });

    if (!assistantMsg) {
      const melden = window.toastSystem?.warning || window.toastSystem?.error;
      melden?.call(window.toastSystem, 'Feedback gespeichert – Überarbeitung konnte nicht gestartet werden. Du kannst sie unten im Chat erneut anstoßen.');
      return;
    }

    // Verknuepfung Bewertung <-> Ueberarbeitung (fuer spaetere Auswertung,
    // ob der aus dem Feedback generierte Vorschlag angenommen wurde)
    const feedbackRow = gespeichert?.[0];
    if (feedbackRow) {
      try {
        await skripteService.updateFeedback(feedbackRow.id, { chat_message_id: assistantMsg.id });
      } catch (_) { /* Verknuepfung ist best effort, Feedback + Job stehen bereits */ }
    }

    window.toastSystem?.success('Feedback gespeichert – Liky überarbeitet die Stelle');
  }

  async openVollFeedback() {
    const v = this.view;
    if (!v.skript) return;
    await v.feedbackDrawer.openVoll({
      skript: v.skript,
      versionNr: v.aktiveVersion.version_nr,
      onSaved: async () => {
        // Branche/Label/Status koennen sich geaendert haben -> Skript neu laden
        const fresh = await skripteService.loadSkript(v.skript.id);
        if (fresh) {
          v.skript = fresh;
          v.renderDoc();
        }
      },
      onDeleted: async () => {
        v.skripte = await skripteService.loadSkripte();
        const naechstes = v.skripte.find((s) => s.id !== v.skript.id);
        if (naechstes) {
          v.skript = null;
          await v.switchSkript(naechstes.id);
        } else {
          v.startNeuModus();
        }
      }
    });
  }
}
