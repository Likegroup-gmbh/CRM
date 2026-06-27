// VideoFeedbackBinding
// Bindet die Feedback-Textareas der Kampagnen-Tabelle an den
// VideoFeedbackSaveController: Autosave beim Tippen (input) und sofortiges
// Speichern beim Verlassen (blur). Haelt den 925-Zeilen-Orchestrator
// (KampagneKooperationenVideoTable) frei von dieser Logik.

import { getVideoFeedbackSlotByField } from '../../core/VideoFeedbackBuckets.js';

export class VideoFeedbackBinding {
  constructor(controller) {
    this.controller = controller;
  }

  static isEditableFeedbackField(el) {
    return !!el
      && el.tagName === 'TEXTAREA'
      && el.dataset?.entity === 'video'
      && !el.readOnly
      && !!getVideoFeedbackSlotByField(el.dataset.field);
  }

  bind(container, signal) {
    // Fokus -> Status-Tag sofort sichtbar ("Bearbeiten"), damit der User schon
    // vor dem Tippen weiss, wo der Speicher-Status erscheint.
    container.addEventListener('focusin', (e) => {
      if (VideoFeedbackBinding.isEditableFeedbackField(e.target)) {
        this.controller.onFocus(e.target);
      }
    }, { signal });

    container.addEventListener('input', (e) => {
      if (VideoFeedbackBinding.isEditableFeedbackField(e.target)) {
        this.controller.schedule(e.target);
      }
    }, { signal });

    container.addEventListener('focusout', (e) => {
      if (VideoFeedbackBinding.isEditableFeedbackField(e.target)) {
        this.controller.onBlur(e.target);
      }
    }, { signal });
  }
}
