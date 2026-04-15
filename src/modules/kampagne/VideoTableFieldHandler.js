export class VideoTableFieldHandler {
  constructor(table) {
    this.table = table;
  }

  _getStore() {
    return this.table.store || null;
  }

  async handleFieldUpdate(field) {
    const t = this.table;
    const store = this._getStore();
    const entity = field.getAttribute('data-entity');
    const id = field.getAttribute('data-id');
    const fieldName = field.getAttribute('data-field');
    const kooperationId = field.getAttribute('data-kooperation-id');
    
    let value;
    if (field.type === 'checkbox') {
      value = field.checked;
    } else {
      value = field.value;
    }

    console.log(`💾 Update ${entity}.${fieldName}:`, { id, value });

    try {
      if (entity === 'versand') {
        const videoId = field.getAttribute('data-video-id');
        
        if (id === 'new') {
          const { data, error } = await window.supabase
            .from('kooperation_versand')
            .insert({
              kooperation_id: kooperationId,
              video_id: videoId,
              [fieldName]: value
            })
            .select('id')
            .single();

          if (error) throw error;
          
          const versandFields = document.querySelectorAll(
            `[data-entity="versand"][data-video-id="${videoId}"][data-id="new"]`
          );
          versandFields.forEach(f => f.setAttribute('data-id', data.id));
          
          const versandEntry = { id: data.id, [fieldName]: value };
          if (store) {
            store.versandInfos[videoId] = versandEntry;
          } else {
            t.versandInfos[videoId] = versandEntry;
          }
          
          console.log('✅ Versand-Info erstellt:', data.id);
        } else {
          const { error } = await window.supabase
            .from('kooperation_versand')
            .update({ [fieldName]: value })
            .eq('id', id);

          if (error) throw error;

          const videoId = field.getAttribute('data-video-id');
          const existing = store ? store.versandInfos[videoId] : t.versandInfos[videoId];
          if (existing) existing[fieldName] = value;

          console.log('✅ Versand-Info aktualisiert');
        }
      } 
      else if (entity === 'video' && (fieldName === 'feedback_creatorjobs' || fieldName === 'feedback_ritzenhoff')) {
        const runde = fieldName === 'feedback_creatorjobs' ? 1 : 2;
        const videoId = id;
        const commentsSource = store ? store.videoComments : t.videoComments;
        
        const existingComments = commentsSource[videoId]?.[runde === 1 ? 'r1' : 'r2'] || [];
        if (existingComments.length > 0) {
          const commentIds = existingComments.map(c => c.id);
          await window.supabase
            .from('kooperation_video_comment')
            .delete()
            .in('id', commentIds);
        }
        
        if (value && value.trim()) {
          const currentUser = window.currentUser;
          const authorName = currentUser?.name || 'Unbekannt';
          
          const { data, error } = await window.supabase
            .from('kooperation_video_comment')
            .insert({
              video_id: videoId,
              runde: runde,
              text: value.trim(),
              author_benutzer_id: currentUser?.id || null,
              author_name: authorName,
              is_public: true
            })
            .select('id, video_id, text, runde, author_name, created_at')
            .single();

          if (error) throw error;
          
          const r1 = runde === 1 ? [data] : (commentsSource[videoId]?.r1 || []);
          const r2 = runde === 2 ? [data] : (commentsSource[videoId]?.r2 || []);
          if (store) {
            store.updateVideoComments(videoId, r1, r2);
          } else {
            if (!t.videoComments[videoId]) t.videoComments[videoId] = { r1: [], r2: [] };
            if (runde === 1) t.videoComments[videoId].r1 = [data];
            else t.videoComments[videoId].r2 = [data];
          }
          
          console.log(`✅ Feedback Runde ${runde} gespeichert als Kommentar von ${authorName}`);
        } else {
          const r1 = runde === 1 ? [] : (commentsSource[videoId]?.r1 || []);
          const r2 = runde === 2 ? [] : (commentsSource[videoId]?.r2 || []);
          if (store) {
            store.updateVideoComments(videoId, r1, r2);
          } else {
            if (!t.videoComments[videoId]) t.videoComments[videoId] = { r1: [], r2: [] };
            if (runde === 1) t.videoComments[videoId].r1 = [];
            else t.videoComments[videoId].r2 = [];
          }
          console.log(`✅ Feedback Runde ${runde} gelöscht`);
        }
      } 
      else {
        if (entity === 'kooperation' && fieldName === 'vertrag_unterschrieben') {
          console.warn('⚠️ Manuelle Änderung von vertrag_unterschrieben blockiert (system-managed)');
          return;
        }

        const tableName = entity === 'kooperation' ? 'kooperationen' : 'kooperation_videos';
        
        const { error } = await window.supabase
          .from(tableName)
          .update({ [fieldName]: value })
          .eq('id', id);

        if (error) throw error;

        if (store) {
          if (entity === 'video') {
            store.updateVideo(id, { [fieldName]: value });
          } else if (entity === 'kooperation') {
            store.updateKooperation(id, { [fieldName]: value });
          }
        }

        console.log(`✅ ${entity} aktualisiert`);
      }

      t._lastUpdateBy = window.currentUser?.id;
      t._lastUpdateTime = Date.now();

      field.classList.add('save-success');
      setTimeout(() => field.classList.remove('save-success'), 1000);

    } catch (error) {
      console.error(`❌ Fehler beim Speichern von ${entity}.${fieldName}:`, error);
      field.classList.add('save-error');
      setTimeout(() => field.classList.remove('save-error'), 2000);
      
      window.ErrorHandler?.handle(error, 'KampagneKooperationenVideoTable.handleFieldUpdate');
    }
  }
}
