// VideoTableEventBinder
// Buendelt das gesamte Event-Binding der Kampagnen-Video-Tabelle (Feld-Updates,
// Feedback-Autosave, Upload/Settings/Media-Buttons, Status-Dropdown, Resize/Drag).
// Wird bei jedem (Re-)Render aufgerufen und nutzt einen frischen AbortController,
// damit alte Listener sauber getrennt werden. Haelt den Orchestrator schlank.

import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { VideoRowHeightSync } from './VideoRowHeightSync.js';
import { getVideoFeedbackSlotByField } from '../../core/VideoFeedbackBuckets.js';
import { nutzungsrechteModal } from './NutzungsrechteModal.js';

export class VideoTableEventBinder {
  constructor(table) {
    this.table = table;
  }

  bind() {
    const t = this.table;
    if (t._abortController) t._abortController.abort();
    t._abortController = new AbortController();
    const signal = t._abortController.signal;

    const container = document.querySelector('.kooperation-video-grid');
    if (!container) return;

    CustomDatePicker.destroy(container);
    CustomDatePicker.bind(container, signal);

    // Zeilen-Hoehen ueber Spalten angleichen (Feedback bestimmt die Reihenhoehe).
    // Tabelle wird bei jedem Render neu erzeugt -> alte Sync trennen, neu binden.
    t._rowHeightSync?.disconnect();
    t._rowHeightSync = new VideoRowHeightSync(container);
    t._rowHeightSync.observe();
    t._rowHeightSync.schedule();

    container.addEventListener('change', async (e) => {
      if (e.target.classList.contains('custom-date-picker__input')) {
        if (e.target.dataset.entity === 'custom') {
          await t.handleFieldUpdate(e.target);
          return;
        }
        if (e.target.dataset.entity === 'video') {
          await t.handleFieldUpdate(e.target);
          if (e.target.dataset.field === 'posting_datum' && t._isGoLiveSortActive()) {
            clearTimeout(t._refilterTimer);
            t._refilterTimer = setTimeout(() => t.refilter(), 600);
          }
        }
      }
    }, { signal });

    container.addEventListener('blur', async (e) => {
      // Feedback-Felder laufen ueber den VideoFeedbackSaveController (Autosave +
      // Flush), nicht ueber diesen generischen Handler -> Doppel-Save vermeiden.
      if (e.target.dataset?.entity === 'video' && getVideoFeedbackSlotByField(e.target.dataset.field)) return;
      if (e.target.classList.contains('grid-input') || e.target.classList.contains('grid-textarea') || e.target.classList.contains('custom-col-input')) {
        await t.handleFieldUpdate(e.target);
      }
    }, { capture: true, signal });

    // Autosave + Flush fuer Feedback-Felder (input/blur) an den Controller binden.
    t._feedbackBinding.bind(container, signal);

    // Letzte Sicherung: offene Feedback-Saves vor dem Verlassen der Seite flushen.
    // Async-Saves koennen beim Tab-Schliessen abbrechen -> Browser-Prompt setzen,
    // solange noch etwas offen ist (verhindert stillen Datenverlust).
    window.addEventListener('beforeunload', (e) => {
      if (t.feedbackSaveController?.hasPending()) {
        t.feedbackSaveController.flushAll();
        e.preventDefault();
        e.returnValue = '';
      }
    }, { signal });

    container.addEventListener('change', async (e) => {
      // Custom Column Checkboxes, Selects und Date-Inputs
      if (e.target.classList.contains('custom-col-checkbox') || e.target.classList.contains('custom-col-select') || e.target.classList.contains('custom-col-date')) {
        await t.handleFieldUpdate(e.target);
        return;
      }
      if (e.target.classList.contains('grid-checkbox') || e.target.classList.contains('grid-select')) {
        if (e.target.classList.contains('grid-checkbox') && e.target.dataset.field === 'freigabe') {
          t.toggleVideoRowApproval(e.target.dataset.id, e.target.checked);
          const videoId = e.target.dataset.id;
          if (t.store) {
            t.store.updateVideo(videoId, { freigabe: e.target.checked });
          }
          t.updateTabCounts();
        }
        await t.handleFieldUpdate(e.target);

        if (e.target.dataset.field === 'freigabe') {
          if (t.activeFilterTab !== 'alle') {
            const koopRow = e.target.closest('[data-kooperation-id]');
            const koopId = koopRow?.dataset?.kooperationId || e.target.dataset.kooperationId;
            if (koopId) {
              const allApproved = t.areAllVideosApproved(koopId);
              const shouldBeVisible = t.activeFilterTab === 'offen' ? !allApproved : allApproved;
              if (!shouldBeVisible) {
                clearTimeout(t._refilterTimer);
                t._refilterTimer = setTimeout(() => t.refilter(), 600);
                return;
              }
            }
          }

          // GoLive-Sort: Freigabe ändert die effektive Sortier-Position →
          // immer refilter triggern (auch im "alle"-Tab)
          if (t._isGoLiveSortActive()) {
            clearTimeout(t._refilterTimer);
            t._refilterTimer = setTimeout(() => t.refilter(), 600);
          }
        }
      }
    }, { signal });

    t.initAutoResizeTextareas();

    container.addEventListener('click', (e) => {
      const uploadBtn = e.target.closest('.video-upload-btn');
      if (uploadBtn) {
        e.preventDefault();
        t._openUploadDrawer(uploadBtn.dataset.videoId, uploadBtn.dataset.kooperationId);
      }

      const customUploadBtn = e.target.closest('.custom-upload-btn');
      if (customUploadBtn) {
        e.preventDefault();
        t._openCustomUploadDrawer(customUploadBtn);
      }

      const nutzungsrechteBtn = e.target.closest('[data-action="open-nutzungsrechte"]');
      if (nutzungsrechteBtn) {
        e.preventDefault();
        nutzungsrechteModal.open(nutzungsrechteBtn.dataset.vertragId);
      }
    }, { signal });

    container.addEventListener('click', (e) => {
      const settingsBtn = e.target.closest('.video-settings-btn');
      if (settingsBtn) {
        e.preventDefault();
        t._openSettingsDrawer(settingsBtn);
      }
    }, { signal });

    container.addEventListener('click', (e) => {
      const playBtn = e.target.closest('[data-action="play-video"]');
      if (playBtn) {
        e.preventDefault();
        t._mediaViewer.openVideo(playBtn.dataset.videoId, playBtn.dataset.kooperationId);
        return;
      }
      const storysBtn = e.target.closest('[data-action="view-storys"]');
      if (storysBtn) {
        e.preventDefault();
        t._mediaViewer.openStory(storysBtn.dataset.videoId, storysBtn.dataset.kooperationId);
        return;
      }
      const bilderBtn = e.target.closest('[data-action="view-bilder"]');
      if (bilderBtn) {
        e.preventDefault();
        t._mediaViewer.openBilder(bilderBtn.dataset.kooperationId);
        return;
      }
    }, { signal });

    container.addEventListener('click', (e) => {
      const linkBtn = e.target.closest('[data-action="link-strategie-item"]');
      if (linkBtn) {
        e.preventDefault();
        t._openLinkStrategieDrawer(linkBtn);
      }
    }, { signal });

    container.addEventListener('click', (e) => {
      const trigger = e.target.closest('.status-select-trigger');
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        const wrapper = trigger.closest('.status-select-wrapper');
        const isOpen = wrapper?.classList.contains('open');
        t._closeStatusPortal();
        if (wrapper && !isOpen) {
          wrapper.classList.add('open');
          t._openStatusPortal(wrapper);
        }
        return;
      }
    }, { signal });

    // Item-Click an document, da Portal an document.body haengt (nicht im container)
    document.addEventListener('click', (e) => {
      const item = e.target.closest('.status-dropdown-portal .status-dropdown-item, .status-select-wrapper .status-dropdown-item');
      if (!item) return;
      // preventDefault: <a href="#"> wuerde sonst zum Seiten-Anfang scrollen
      e.preventDefault();
      e.stopPropagation();
      const portal = item.closest('.status-dropdown-portal');
      const wrapper = item.closest('.status-select-wrapper');
      const koopId = portal?.dataset.kooperationId || wrapper?.dataset.kooperationId;
      const newValue = item.dataset.value || null;
      t._closeStatusPortal();
      if (koopId) {
        t._handleStatusDropdownChange(koopId, newValue);
      }
    }, { signal });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.status-select-wrapper') || e.target.closest('.status-dropdown-portal')) return;
      t._closeStatusPortal();
    }, { signal });

    window.addEventListener('resize', () => t._closeStatusPortal(), { signal });
    window.addEventListener('scroll', () => t._closeStatusPortal(), { signal, capture: true });

    t.bindResizeEvents();
    t.bindDragToScroll();
    t.columnDragHandler.bind(container, signal);
  }
}
