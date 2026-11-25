// Kooperation Video Detail – lädt Video, Feedback (Runde 1/2 je Slot), Assets und erlaubt Statuswechsel + Feedback.
// Neue Varianten laufen über den VideoUploadDrawer (SharePoint), HTML: kooperationVideoDetailRender.js.
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import {
  getVideoFeedbackSlotByField,
  getVideoFeedbackBucket,
  isMissingFeedbackTypeError,
  VIDEO_FEEDBACK_LEGACY_SELECT
} from '../../core/VideoFeedbackBuckets.js';
import { saveVideoFeedbackSlot } from '../../core/videoFeedback/VideoFeedbackRepository.js';
import { VideoFeedbackSaveController } from '../../core/videoFeedback/VideoFeedbackSaveController.js';
import { VideoFeedbackBinding } from '../kampagne/VideoFeedbackBinding.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { mitAblage } from '../../core/ablage/ablageLink.js';
import { ablageLinkKlick } from '../../core/ablage/ablageOrdnerLink.js';
import { videoDetailHtml } from './kooperationVideoDetailRender.js';

export const kooperationVideoDetail = {
  videoId: null,
  video: null,
  kooperation: null,
  comments: [],
  assets: [],
  _abortController: null,
  _feedbackController: null,
  _feedbackBinding: null,
  _uploadDrawer: null,

  async init(id) {
    try {
      this.videoId = (id && id !== 'new') ? id : null;
      if (!this.videoId) {
        window.setHeadline('Video');
        window.content.innerHTML = renderEmptyState({ icon: 'info', title: 'Videos werden automatisch über die Kooperation erstellt' });
        return;
      }

      await this.loadData();
      
      // Breadcrumb aktualisieren
      if (window.breadcrumbSystem && this.video && this.kooperation) {
        window.breadcrumbSystem.updateDetailLabel(this.video.titel || 'Video');
      }
      
      this.render();
      this.bindEvents();
    } catch (error) {
      console.error('KooperationVideoDetail init error:', error);
    }
  },

  async loadData() {
    // Video + Basisdaten
    const { data: video, error } = await window.supabase
      .from('kooperation_videos')
      .select('id, kooperation_id, titel, thema, video_name, content_art, asset_url, link_content, folder_url, kommentar, status, position, created_at')
      .eq('id', this.videoId)
      .single();
    if (error) throw error;
    this.video = video;

    // Kooperation + Kampagne + Unternehmen + Marke + Creator (Breadcrumb, Upload-Metadaten)
    try {
      const { data: koop } = await window.supabase
        .from('kooperationen')
        .select(`id, name, creator:creator_id(vorname, nachname), kampagne:kampagne_id(id, kampagnenname, eigener_name, unternehmen:unternehmen_id(id, firmenname), marke:marke_id(id, markenname))`)
        .eq('id', video.kooperation_id)
        .single();
      this.kooperation = koop || null;
    } catch (_) {
      this.kooperation = null;
    }

    // Kommentare je Feedback-Slot - inklusive soft-deleted für Anzeige
    try {
      let { data: comments, error: commentsError } = await window.supabase
        .from('kooperation_video_comment')
        .select('id, video_id, runde, feedback_typ, text, author_name, author_benutzer_id, created_at, deleted_at, deleted_by_benutzer_id')
        .eq('video_id', this.videoId)
        .order('created_at', { ascending: true });
      if (commentsError && isMissingFeedbackTypeError(commentsError)) {
        const legacyResult = await window.supabase
          .from('kooperation_video_comment')
          .select(`${VIDEO_FEEDBACK_LEGACY_SELECT}, author_benutzer_id, deleted_at, deleted_by_benutzer_id`)
          .eq('video_id', this.videoId)
          .order('created_at', { ascending: true });
        comments = legacyResult.data || [];
        commentsError = legacyResult.error;
      }
      if (commentsError) throw commentsError;
      this.comments = comments || [];
    } catch (_) {
      this.comments = [];
    }

    // Assets (optional) - mit Versionsinformationen laden
    try {
      const { data: assets } = await window.supabase
        .from('kooperation_video_asset')
        .select(mitAblage('id, file_url, file_path, version_number, is_current, description, uploaded_by, created_at', 'ablage, etag'))
        .eq('video_id', this.videoId)
        .order('version_number', { ascending: false });
      this.assets = assets || [];
    } catch (_) {
      this.assets = [];
    }
  },

  render() {
    const v = this.video || {};
    const title = v.titel || `Video #${v.id}`;
    const safe = (s) => window.validatorSystem?.sanitizeHtml?.(s) ?? s;

    if (typeof window.setHeadline === 'function') {
      window.setHeadline(`Video: ${safe(title)}`);
    }

    const html = videoDetailHtml({
      video: v,
      comments: this.comments,
      assets: this.assets,
      videoId: this.videoId,
      canEdit: window.currentUser?.permissions?.kooperation?.can_edit || window.isAdmin(),
      canUpload: window.isInternal(),
    });
    window.setContentSafely(window.content, html);
  },

  bindEvents() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    // Tab-Switching
    document.addEventListener('click', (e) => {
      if (ablageLinkKlick(e)) return;
      if (e.target.classList.contains('tab-button')) {
        e.preventDefault();
        const tabName = e.target.dataset.tab;
        if (tabName) this.switchTab(tabName);
      }
    }, { signal });

    // Feedback-Slots: Autosave beim Tippen + sofort speichern beim Verlassen.
    // Gleiche Save-Steuerung (Debounce/Dedup/Status) wie Tabelle und Player.
    if (!this._feedbackController) {
      this._feedbackController = new VideoFeedbackSaveController({
        handleFieldUpdate: (field) => this._saveFeedbackField(field)
      });
      this._feedbackBinding = new VideoFeedbackBinding(this._feedbackController);
    }
    this._feedbackBinding.bind(document, signal);

    // Lokale Event-Listener die bei jedem Render neu gebunden werden müssen
    this.bindLocalEvents();

    // ActionsDropdown für Asset-Versionen initialisieren
    if (window.ActionsDropdown) {
      window.ActionsDropdown.init();
    }
  },

  bindLocalEvents() {

    // Zur Kooperation zurück
    document.getElementById('btn-back-kooperation')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.video?.kooperation_id) window.navigateTo(`/kooperation/${this.video.kooperation_id}`);
    });

    // Status speichern
    const saveBtn = document.getElementById('btn-save-status');
    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const select = document.getElementById('video-status');
          const value = select?.value || 'produktion';
          const { error } = await window.supabase
            .from('kooperation_videos')
            .update({ status: value, updated_at: new Date().toISOString() })
            .eq('id', this.videoId);
          if (error) throw error;
          // Refresh lokal + Info
          await this.loadData();
          this.render();
          this.bindLocalEvents();
          if (window.ActionsDropdown) {
            window.ActionsDropdown.init();
          }
          // Notify parent views
          window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kooperation_videos', action: 'updated', id: this.videoId, field: 'status', value } }));
        } catch (err) {
          console.error('Status speichern fehlgeschlagen', err);
          alert('Status konnte nicht gespeichert werden.');
        }
      });
    }

    document.getElementById('btn-video-upload')?.addEventListener('click', () => this._openUploadDrawer());

    // "Als aktuell markieren" Event-Handler
    document.querySelectorAll('.set-current-version').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const assetId = btn.dataset.assetId;
        if (!assetId || !confirm('Diese Version als aktuelle Version markieren?')) return;
        
        try {
          // Alle bisherigen als nicht-aktuell markieren
          await window.supabase
            .from('kooperation_video_asset')
            .update({ is_current: false })
            .eq('video_id', this.videoId);
          
          // Ausgewählte als aktuell markieren
          const { error } = await window.supabase
            .from('kooperation_video_asset')
            .update({ is_current: true })
            .eq('id', assetId);
          
          if (error) throw error;
          
          await this.loadData();
          this.render();
          this.bindLocalEvents();
          if (window.ActionsDropdown) {
            window.ActionsDropdown.init();
          }
        } catch (err) {
          console.error('Version aktualisieren fehlgeschlagen', err);
          alert('Version konnte nicht als aktuell markiert werden.');
        }
      });
    });

  },

  // Speichert genau einen Feedback-Slot ueber das gemeinsame Repository und
  // haelt den lokalen comments-State konsistent (eine aktive Zeile pro Slot).
  // Rueckgabe true/false steuert die Status-/Retry-Anzeige im Controller.
  async _saveFeedbackField(field) {
    const slot = getVideoFeedbackSlotByField(field.dataset.field);
    if (!slot) return false;
    try {
      const { row } = await saveVideoFeedbackSlot({
        videoId: this.videoId,
        slot,
        text: field.value,
        user: window.currentUser
      });
      // Aktive Zeile dieses Slots im lokalen State ersetzen.
      this.comments = (this.comments || [])
        .filter(c => !(getVideoFeedbackBucket(c) === slot.bucket && !c.deleted_at));
      if (row) this.comments.push(row);
      return true;
    } catch (err) {
      console.error('Feedback speichern fehlgeschlagen', err);
      window.ErrorHandler?.handle?.(err, 'KooperationVideoDetail._saveFeedbackField');
      return false;
    }
  },

  /** Upload-Metadaten wie in der Kampagnen-Tabelle (VideoTableDrawerActions.openUploadDrawer). */
  _uploadMetadaten() {
    const v = this.video || {};
    const koop = this.kooperation || {};
    const kampagne = koop.kampagne || {};
    return {
      kooperationId: v.kooperation_id,
      kooperationName: koop.name || 'Kooperation',
      videoTitel: v.thema || v.titel || 'Video',
      videoName: v.video_name || '',
      videoPosition: v.position || 1,
      videoThema: v.thema || '',
      unternehmen: kampagne.unternehmen?.firmenname || '',
      unternehmenId: kampagne.unternehmen?.id || null,
      marke: kampagne.marke?.markenname || '',
      kampagne: KampagneUtils.getDisplayName(kampagne) || '',
      creatorName: [koop.creator?.vorname, koop.creator?.nachname].filter(Boolean).join(' '),
      folderUrl: v.folder_url || '',
    };
  },

  async _openUploadDrawer() {
    if (!this._uploadDrawer) {
      const { VideoUploadDrawer } = await import('../kampagne/VideoUploadDrawer.js');
      this._uploadDrawer = new VideoUploadDrawer();
    }
    const neuLaden = async () => {
      if (!document.getElementById('tab-videos')) return;
      await this.loadData();
      this.render();
      this.bindLocalEvents();
      this.switchTab('videos');
      window.ActionsDropdown?.init();
    };
    await this._uploadDrawer.open(this.videoId, this._uploadMetadaten(), neuLaden, null, null, {
      onFinaleChanged: neuLaden,
      onVideoAssetDeleted: neuLaden,
    });
  },

  // Tab wechseln
  switchTab(tabName) {
    console.log('🔄 VIDEO-DETAIL: Wechsle zu Tab:', tabName);
    
    // Alle Tab-Buttons deaktivieren
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Alle Tab-Panes ausblenden
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    
    // Gewählten Tab aktivieren
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activePane = document.getElementById(`tab-${tabName}`);
    
    if (activeButton && activePane) {
      activeButton.classList.add('active');
      activePane.classList.add('active');
    }
  },

  destroy() {
    // Offene Feedback-Saves noch ausloesen, bevor Listener abgebaut werden.
    this._feedbackController?.flushAll();
    this._abortController?.abort();
    this._abortController = null;
    this._uploadDrawer?.destroy();
    this._uploadDrawer = null;
  }
};
