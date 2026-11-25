// VideoTableEventBinder
// Buendelt das gesamte Event-Binding der Kampagnen-Video-Tabelle (Feld-Updates,
// Feedback-Autosave, Upload/Settings/Media-Buttons, Status-Select, Resize/Drag).
// Wird bei jedem (Re-)Render aufgerufen und nutzt einen frischen AbortController,
// damit alte Listener sauber getrennt werden. Haelt den Orchestrator schlank.

import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { VideoRowHeightSync } from './VideoRowHeightSync.js';
import { VideoFeedbackBinding } from './VideoFeedbackBinding.js';
import { getVideoFeedbackSlotByField } from '../../core/VideoFeedbackBuckets.js';
import { nutzungsrechteModal } from './NutzungsrechteModal.js';
import { COPY_ICON, CHECK_ICON } from './VideoTableRenderer.js';
import { KOOP_STATUS_FIELD } from './videoTableKoopCells.js';
import { bindTextBaseline, isGuardedTextField, rememberTextBaseline, shouldPersistTextField } from '../../core/table/textFieldBaseline.js';
import { openZeitkommentar } from './videoTableZeitkommentare.js';
import { ablageLinkKlick } from '../../core/ablage/ablageOrdnerLink.js';
import { oeffneCreatorSetzen } from '../kooperation/platzhalterSetzen.js';
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
    bindTextBaseline(container, { signal });

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
          if ((e.target.dataset.field === 'posting_datum' || e.target.dataset.field === 'content_deadline') && t._isVideoBasedSortActive()) {
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
      // Kommentar-Spalten (Typ "comment") nutzen denselben Controller.
      if (VideoFeedbackBinding.isCustomCommentField(e.target)) return;
      if (e.target.classList.contains('grid-input') || e.target.classList.contains('grid-textarea') || e.target.classList.contains('custom-col-input')) {
        if (isGuardedTextField(e.target) && !shouldPersistTextField(e.target)) return;
        if (isGuardedTextField(e.target)) rememberTextBaseline(e.target);
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

          // GoLive-/Content-Deadline-Sort: Freigabe ändert die effektive
          // Sortier-Position → immer refilter triggern (auch im "alle"-Tab)
          if (t._isVideoBasedSortActive()) {
            clearTimeout(t._refilterTimer);
            t._refilterTimer = setTimeout(() => t.refilter(), 600);
          }
        }
      }
    }, { signal });

    container.addEventListener('click', (e) => {
      const platzhalterBtn = e.target.closest('[data-action="platzhalter-creator"]');
      if (platzhalterBtn) {
        e.preventDefault();
        oeffneCreatorSetzen(platzhalterBtn, {
          koopId: platzhalterBtn.dataset.id,
          stand: t.deckenStand,
          onDone: () => window.kampagneDetail?.reloadKooperationTable?.()
        });
        return;
      }

      const uploadBtn = e.target.closest('.video-upload-btn');
      if (uploadBtn) {
        e.preventDefault();
        // Finale-Spalte: Video-Tab mit vorausgewaehlter "Finale Version" oeffnen
        const opts = uploadBtn.classList.contains('finale-upload-btn')
          ? { preselectFinal: true }
          : uploadBtn.classList.contains('stills-upload-btn')
            ? { initialTab: 'bilder' }
            : undefined;
        t._openUploadDrawer(uploadBtn.dataset.videoId, uploadBtn.dataset.kooperationId, opts);
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
      t._openSettingsDrawer(settingsBtn, settingsBtn.classList.contains('stills-settings-btn') ? { initialTab: 'bilder' } : undefined);
      }
    }, { signal });

    container.addEventListener('click', (e) => {
      if (ablageLinkKlick(e)) return;
      const zeitBtn = e.target.closest('[data-action="open-zeitkommentar"]');
      if (zeitBtn) {
        e.preventDefault();
        openZeitkommentar(t._detail, zeitBtn);
        return;
      }
      const playBtn = e.target.closest('[data-action="play-video"]');
      if (playBtn) {
        e.preventDefault();
        t._mediaViewer.openVideo(playBtn.dataset.videoId, playBtn.dataset.kooperationId);
        return;
      }
      const playFinalBtn = e.target.closest('[data-action="play-final"]');
      if (playFinalBtn) {
        e.preventDefault();
        t._mediaViewer.openVideoFinal(playFinalBtn.dataset.videoId, playFinalBtn.dataset.kooperationId, playFinalBtn.dataset.assetId);
        return;
      }
      const playFinalStillBtn = e.target.closest('[data-action="play-final-still"]');
      if (playFinalStillBtn) {
        e.preventDefault();
        t._mediaViewer.openStillFinal(playFinalStillBtn.dataset.videoId, playFinalStillBtn.dataset.kooperationId, playFinalStillBtn.dataset.assetId);
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
        t._mediaViewer.openBilder(bilderBtn.dataset.videoId, bilderBtn.dataset.kooperationId);
        return;
      }
    }, { signal });

    // Adresse in die Zwischenablage kopieren (Inline-Feedback: Icon -> Haken)
    container.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('[data-action="copy-address"]');
      if (!copyBtn) return;
      e.preventDefault();
      if (!navigator.clipboard) {
        window.toastSystem?.show('Adresse konnte nicht kopiert werden', 'error');
        return;
      }
      navigator.clipboard.writeText(copyBtn.dataset.address || '')
        .then(() => {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = CHECK_ICON;
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = COPY_ICON;
          }, 1500);
        })
        .catch(() => window.toastSystem?.show('Adresse konnte nicht kopiert werden', 'error'));
    }, { signal });

    container.addEventListener('click', (e) => {
      const openSkript = e.target.closest('[data-action="open-skript"]');
      if (openSkript) {
        e.preventDefault();
        const skriptId = openSkript.dataset.skriptId;
        const ziel = openSkript.getAttribute('href');
        if (ziel && ziel !== '#') window.navigateTo(ziel);
        else if (skriptId) window.navigateTo(`/skripte/${skriptId}`);
        return;
      }
      const linkSkript = e.target.closest('[data-action="link-skript"]');
      if (linkSkript) {
        e.preventDefault();
        t._openLinkSkriptDrawer(linkSkript);
      }
    }, { signal });

    // Status-Select (TableSelect): Oeffnen/Schliessen erledigt die Komponente,
    // die Optionsliste haengt als Portal an body -> Event kommt am document an.
    document.addEventListener('table-select-change', (e) => {
      const { field, itemId, value, element } = e.detail || {};
      if (field !== KOOP_STATUS_FIELD || !element?.closest('.kooperation-video-grid')) return;
      t._handleStatusDropdownChange(itemId, value || null);
    }, { signal });

    t._finalBulkDownload?.bind(container, signal);
    t._finalBulkDownload?.syncAfterRender();

    t.bindResizeEvents();
    t.columnDragHandler.bind(container, signal);
  }
}
