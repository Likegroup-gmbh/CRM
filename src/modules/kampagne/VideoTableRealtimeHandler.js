// VideoTableRealtimeHandler.js
// Realtime-Subscriptions und Live-DOM-Updates fuer die Kampagnen-Video-Tabelle

import { checkAuftragBudgetStatus } from '../auftrag/logic/AuftragStatusUtils.js';
import {
  formatVideoFeedbackValue,
  getVideoFeedbackSlotByField,
  groupVideoFeedbackComments,
  isMissingFeedbackTypeError,
  VIDEO_FEEDBACK_FIELDS,
  VIDEO_FEEDBACK_LEGACY_SELECT,
  VIDEO_FEEDBACK_SELECT
} from '../../core/VideoFeedbackBuckets.js';

export class VideoTableRealtimeHandler {
  constructor(table) {
    this.table = table;
  }

  async _triggerBudgetCheck() {
    try {
      const { data } = await window.supabase
        .from('kampagne')
        .select('auftrag_id')
        .eq('id', this.table.kampagneId)
        .single();
      if (data?.auftrag_id) {
        checkAuftragBudgetStatus(data.auftrag_id);
      }
    } catch (e) {
      console.warn('⚠️ Budget-Check Trigger fehlgeschlagen:', e);
    }
  }

  initRealtimeSubscription() {
    if (this.table._realtimeChannel) return;

    if (!this.table.kooperationen || this.table.kooperationen.length === 0) {
      return;
    }

    this.table._realtimeChannel = window.supabase
      .channel(`kampagne-koops-videos-${this.table.kampagneId}`, {
        config: { broadcast: { self: false } }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'kooperation_videos'
      }, (payload) => {
        if (this.table.kooperationen.some(k => k.id === payload.new.kooperation_id)) {
          this.handleVideoUpdate(payload);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'kooperation_videos'
      }, (payload) => {
        if (this.table.kooperationen.some(k => k.id === payload.new.kooperation_id)) {
          this.handleNewVideo(payload);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'kooperationen'
      }, (payload) => {
        if (payload.new.kampagne_id === this.table.kampagneId) {
          this.handleNewKooperation(payload);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'kooperationen'
      }, (payload) => {
        if (payload.new.kampagne_id === this.table.kampagneId) {
          this.handleKooperationUpdate(payload);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'kooperationen'
      }, (payload) => {
        const deletedId = payload?.old?.id;
        const belongsByKampagne = payload?.old?.kampagne_id === this.table.kampagneId;
        const belongsByLocal = deletedId
          ? this.table.kooperationen.some(k => k.id === deletedId)
          : false;
        if (belongsByKampagne || belongsByLocal) {
          this.handleKooperationDelete(payload);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'kooperation_video_comment'
      }, (payload) => this.handleCommentChange(payload))
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'kooperation_video_comment'
      }, (payload) => this.handleCommentChange(payload))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'kooperation_video_comment'
      }, (payload) => this.handleCommentChange(payload))
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('REALTIME: Channel Error:', err);
          setTimeout(() => {
            this.cleanup();
            this.initRealtimeSubscription();
          }, 5000);
        }
      });
  }

  _isOwnUpdate() {
    return this.table._lastUpdateBy === window.currentUser?.id &&
      Date.now() - this.table._lastUpdateTime < 2000;
  }

  async handleVideoUpdate(payload) {
    if (this._isOwnUpdate()) return;

    const updatedVideo = payload.new;
    if (this.table.store) {
      this.table.store.updateVideo(updatedVideo.id, updatedVideo);
    } else {
      for (const koopId in this.table.videos) {
        const idx = this.table.videos[koopId].findIndex(v => v.id === updatedVideo.id);
        if (idx !== -1) {
          this.table.videos[koopId][idx] = { ...this.table.videos[koopId][idx], ...updatedVideo };
          break;
        }
      }
    }
    await this.updateVideoRow(updatedVideo.id);
    if ('verkaufspreis_netto' in updatedVideo) {
      this._triggerBudgetCheck();
    }
  }

  async handleNewVideo(payload) {
    if (this._isOwnUpdate()) return;

    const newVideo = payload.new;
    const koopId = newVideo.kooperation_id;
    if (this.table.store) {
      this.table.store.addVideo(koopId, newVideo);
    } else {
      if (!this.table.videos[koopId]) this.table.videos[koopId] = [];
      this.table.videos[koopId].push(newVideo);
    }
    this.table.refilter();
  }

  async handleNewKooperation() {
    if (this._isOwnUpdate()) return;
    this.table.refilter();
  }

  async handleKooperationUpdate(payload) {
    if (this._isOwnUpdate()) return;

    const updated = payload.new;
    const linkFields = ['bilder_folder_url', 'folder_url', 'story_folder_url'];

    let oldKoop = null;
    if (this.table.store) {
      oldKoop = this.table.store.kooperationen.find(k => k.id === updated.id);
    } else {
      oldKoop = this.table.kooperationen.find(k => k.id === updated.id);
    }
    const linkChanged = linkFields.some(f => (oldKoop?.[f] ?? null) !== (updated[f] ?? null));

    if (this.table.store) {
      const existing = this.table.store.kooperationen.find(k => k.id === updated.id);
      this.table.store.updateKooperation(updated.id, {
        ...updated,
        creator: existing?.creator,
        kampagne: existing?.kampagne
      });
    } else {
      const idx = this.table.kooperationen.findIndex(k => k.id === updated.id);
      if (idx !== -1) {
        this.table.kooperationen[idx] = {
          ...this.table.kooperationen[idx],
          ...updated,
          creator: this.table.kooperationen[idx].creator,
          kampagne: this.table.kooperationen[idx].kampagne
        };
      }
    }

    if (linkChanged) this.table.refilter();

    window.dispatchEvent(new CustomEvent('kooperationen-updated', {
      detail: { kampagneId: this.table.kampagneId }
    }));
  }

  async handleKooperationDelete(payload) {
    const deletedId = payload?.old?.id;
    if (deletedId) await this.handleKooperationDeletedById(deletedId, 'realtime');
  }

  async handleKooperationDeletedById(kooperationId, source = 'unknown') {
    if (!kooperationId) return;
    if (!this.table.kooperationen.some(k => k.id === kooperationId)) return;

    if (this.table.store) {
      this.table.store.removeKooperation(kooperationId);
    } else {
      const deletedVideos = this.table.videos[kooperationId] || [];
      const deletedVideoIds = deletedVideos.map(v => v.id);
      this.table.kooperationen = this.table.kooperationen.filter(k => k.id !== kooperationId);
      delete this.table.videos[kooperationId];
      deletedVideoIds.forEach(videoId => {
        delete this.table.videoComments[videoId];
        delete this.table.versandInfos[videoId];
      });
    }

    console.log(`Kooperation ${kooperationId} lokal entfernt (Quelle: ${source})`);
    this.table.refilter();
    this._triggerBudgetCheck();
  }

  async handleCommentChange(payload) {
    const comment = payload.new || payload.old;
    if (!comment?.video_id) return;
    if (this._isOwnUpdate()) return;

    const videoId = comment.video_id;

    let { data: comments, error } = await window.supabase
      .from('kooperation_video_comment')
      .select(VIDEO_FEEDBACK_SELECT)
      .eq('video_id', videoId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error && isMissingFeedbackTypeError(error)) {
      const legacyResult = await window.supabase
        .from('kooperation_video_comment')
        .select(VIDEO_FEEDBACK_LEGACY_SELECT)
        .eq('video_id', videoId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      comments = legacyResult.data || [];
      error = legacyResult.error;
    }

    if (error) {
      console.warn('Realtime-Kommentare konnten nicht geladen werden:', error);
      return;
    }

    const groupedComments = groupVideoFeedbackComments(comments);

    if (this.table.store) {
      this.table.store.updateVideoComments(videoId, groupedComments);
    } else {
      this.table.videoComments[videoId] = groupedComments;
    }

    this.updateVideoFeedbackFields(videoId);
  }

  updateVideoFeedbackFields(videoId) {
    VIDEO_FEEDBACK_FIELDS.forEach(slot => {
      const field = document.querySelector(`[data-entity="video"][data-id="${videoId}"][data-field="${slot.field}"]`);
      if (!field) return;
      field.value = formatVideoFeedbackValue(this.table.videoComments[videoId], slot.bucket);
      field.classList.add('field-updated');
      setTimeout(() => field.classList.remove('field-updated'), 2000);
    });
  }

  async updateVideoRow(videoId) {
    let video = null;
    for (const koopId in this.table.videos) {
      video = this.table.videos[koopId].find(v => v.id === videoId);
      if (video) break;
    }
    if (!video) return;
    this.updateVideoFieldsInDOM(videoId, video);
  }

  updateVideoFieldsInDOM(videoId, video) {
    const fields = document.querySelectorAll(`[data-entity="video"][data-id="${videoId}"]`);
    let anyUpdated = false;

    fields.forEach(field => {
      const fieldName = field.getAttribute('data-field');
      const feedbackSlot = getVideoFeedbackSlotByField(fieldName);
      let shouldUpdate = false;

      if (feedbackSlot) {
        const val = formatVideoFeedbackValue(this.table.videoComments[videoId], feedbackSlot.bucket);
        if (field.value !== val) { field.value = val; shouldUpdate = true; }
      } else switch (fieldName) {
        case 'freigabe': {
          const v = video.freigabe || false;
          if (field.checked !== v) {
            field.checked = v;
            shouldUpdate = true;
            this.toggleVideoRowApproval(videoId, v);
          }
          break;
        }
        case 'skript_freigegeben': {
          const v = video.skript_freigegeben || false;
          if (field.checked !== v) { field.checked = v; shouldUpdate = true; }
          break;
        }
        default: {
          const newVal = video[fieldName] || '';
          if (field.value !== undefined && field.value !== newVal) {
            field.value = newVal;
            shouldUpdate = true;
          }
          break;
        }
      }

      if (shouldUpdate) {
        field.classList.add('field-updated');
        setTimeout(() => field.classList.remove('field-updated'), 2000);
        anyUpdated = true;
      }
    });

    if (anyUpdated) {
      const row = document.querySelector(`tr:has([data-id="${videoId}"])`);
      if (row) {
        row.classList.add('realtime-updated');
        setTimeout(() => row.classList.remove('realtime-updated'), 2000);
      }
    }
  }

  toggleVideoRowApproval(videoId, isApproved) {
    const wrappers = document.querySelectorAll(`.video-field-wrapper[data-video-id="${videoId}"]`);
    wrappers.forEach(row => {
      if (isApproved) row.classList.add('video-field-wrapper--approved');
      else row.classList.remove('video-field-wrapper--approved');
    });
  }

  cleanup() {
    if (this.table._realtimeChannel) {
      window.supabase.removeChannel(this.table._realtimeChannel);
      this.table._realtimeChannel = null;
    }
  }
}
