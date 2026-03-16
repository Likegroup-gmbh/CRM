// VideoTableRealtimeHandler.js
// Realtime-Subscriptions und Live-DOM-Updates fuer die Kampagnen-Video-Tabelle

export class VideoTableRealtimeHandler {
  constructor(table) {
    this.table = table;
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
    for (const koopId in this.table.videos) {
      const idx = this.table.videos[koopId].findIndex(v => v.id === updatedVideo.id);
      if (idx !== -1) {
        this.table.videos[koopId][idx] = { ...this.table.videos[koopId][idx], ...updatedVideo };
        await this.updateVideoRow(updatedVideo.id);
        break;
      }
    }
  }

  async handleNewVideo(payload) {
    if (this._isOwnUpdate()) return;

    const newVideo = payload.new;
    const koopId = newVideo.kooperation_id;
    if (!this.table.videos[koopId]) this.table.videos[koopId] = [];
    this.table.videos[koopId].push(newVideo);
    await this.table.refresh();
  }

  async handleNewKooperation() {
    if (this._isOwnUpdate()) return;
    await this.table.refresh();
  }

  async handleKooperationUpdate(payload) {
    if (this._isOwnUpdate()) return;

    const updated = payload.new;
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

  async handleKooperationDelete(payload) {
    const deletedId = payload?.old?.id;
    if (deletedId) await this.handleKooperationDeletedById(deletedId, 'realtime');
  }

  async handleKooperationDeletedById(kooperationId, source = 'unknown') {
    if (!kooperationId) return;
    if (!this.table.kooperationen.some(k => k.id === kooperationId)) return;

    const deletedVideos = this.table.videos[kooperationId] || [];
    const deletedVideoIds = deletedVideos.map(v => v.id);

    this.table.kooperationen = this.table.kooperationen.filter(k => k.id !== kooperationId);
    delete this.table.videos[kooperationId];
    deletedVideoIds.forEach(videoId => {
      delete this.table.videoComments[videoId];
      delete this.table.versandInfos[videoId];
    });

    console.log(`Kooperation ${kooperationId} lokal entfernt (Quelle: ${source})`);
    await this.table.refresh();
  }

  async handleCommentChange(payload) {
    const comment = payload.new || payload.old;
    if (!comment?.video_id) return;
    if (this._isOwnUpdate()) return;

    const videoId = comment.video_id;

    const { data: comments } = await window.supabase
      .from('kooperation_video_comment')
      .select('id, video_id, text, runde, author_name, created_at')
      .eq('video_id', videoId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (!this.table.videoComments[videoId]) {
      this.table.videoComments[videoId] = { r1: [], r2: [] };
    }
    this.table.videoComments[videoId].r1 = (comments || []).filter(c => c.runde === 1);
    this.table.videoComments[videoId].r2 = (comments || []).filter(c => c.runde === 2);

    this.updateVideoFeedbackFields(videoId);
  }

  updateVideoFeedbackFields(videoId) {
    const feedbackCJ = document.querySelector(`[data-entity="video"][data-id="${videoId}"][data-field="feedback_creatorjobs"]`);
    if (feedbackCJ) {
      const r1 = this.table.videoComments[videoId]?.r1 || [];
      feedbackCJ.value = r1.length > 0 ? r1.map(c => c.text).join('\n\n---\n\n') : '';
      feedbackCJ.classList.add('field-updated');
      setTimeout(() => feedbackCJ.classList.remove('field-updated'), 2000);
    }

    const feedbackRH = document.querySelector(`[data-entity="video"][data-id="${videoId}"][data-field="feedback_ritzenhoff"]`);
    if (feedbackRH) {
      const r2 = this.table.videoComments[videoId]?.r2 || [];
      feedbackRH.value = r2.length > 0 ? r2.map(c => c.text).join('\n\n---\n\n') : '';
      feedbackRH.classList.add('field-updated');
      setTimeout(() => feedbackRH.classList.remove('field-updated'), 2000);
    }
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
      let shouldUpdate = false;

      switch (fieldName) {
        case 'feedback_creatorjobs': {
          const r1 = this.table.videoComments[videoId]?.r1 || [];
          const val = r1.length > 0 ? r1.map(c => c.text).join('\n\n---\n\n') : '';
          if (field.value !== val) { field.value = val; shouldUpdate = true; }
          break;
        }
        case 'feedback_ritzenhoff': {
          const r2 = this.table.videoComments[videoId]?.r2 || [];
          const val = r2.length > 0 ? r2.map(c => c.text).join('\n\n---\n\n') : '';
          if (field.value !== val) { field.value = val; shouldUpdate = true; }
          break;
        }
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
