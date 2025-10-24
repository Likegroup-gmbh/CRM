// Kooperation Video Detail – lädt Video, Kommentare (Runde 1/2), Assets und erlaubt Statuswechsel + Kommentare
export const kooperationVideoDetail = {
  videoId: null,
  video: null,
  kooperation: null,
  comments: [],
  assets: [],

  async init(id) {
    try {
      const url = new URL(window.location.href);
      const koopId = url.searchParams.get('kooperation');
      this.videoId = (id && id !== 'new') ? id : null;
      const mode = (!this.videoId) ? 'new' : 'detail';
      if (!this.videoId && mode === 'new') {
        // Seite: Neues Video anlegen
        window.setHeadline('Neues Video');
        const canEdit = window.currentUser?.permissions?.kooperation?.can_edit || window.currentUser?.rolle === 'admin';
        if (!canEdit) {
          window.content.innerHTML = '<p class="empty-state">Keine Berechtigung.</p>';
          return;
        }
        const koopInfo = koopId ? await this.fetchKooperationInfo(koopId) : null;
        
        // Breadcrumb für "Neues Video" Seite
        if (window.breadcrumbSystem && koopInfo) {
          window.breadcrumbSystem.updateBreadcrumb([
            { label: 'Kooperation', url: '/kooperation', clickable: true },
            { label: koopInfo.name || 'Details', url: `/kooperation/${koopId}`, clickable: true },
            { label: 'Neues Video', url: '#', clickable: false }
          ]);
        }
        
        const videoLimit = parseInt(koopInfo?.videoanzahl, 10) || 0;
        const { data: existing } = koopId ? await window.supabase
          .from('kooperation_videos')
          .select('id')
          .eq('kooperation_id', koopId) : { data: [] };
        const uploaded = (existing || []).length;
        const limitReached = videoLimit > 0 && uploaded >= videoLimit;
        const koopName = koopInfo?.name || '-';
        const kampName = koopInfo?.kampagne?.kampagnenname || '-';
        const formHtml = `
          <div class="page-header">
            <div class="page-header-left">
              <h1>Neues Video</h1>
              <p>Kooperation: ${window.validatorSystem?.sanitizeHtml?.(koopName) || '-'} · Kampagne: ${window.validatorSystem?.sanitizeHtml?.(kampName) || '-'}</p>
            </div>
            <div class="page-header-right">
              ${koopId ? `<button id="btn-back-to-kooperation" class="secondary-btn">Zur Kooperation</button>` : ''}
            </div>
          </div>
          <div class="form-page">
            ${limitReached ? `<div class=\"alert alert-danger\">Videolimit erreicht (${uploaded}/${videoLimit}). Es können keine weiteren Videos angelegt werden.</div>` : ''}
            <form id="video-create-form" class="entity-form" data-entity="kooperation_videos">
              <div class="form-grid">
                <div class="form-field">
                  <label>Titel</label>
                  <input type="text" name="titel" class="form-input" placeholder="z. B. Hook/Intro" required />
                </div>
                <div class="form-field">
                  <label>Content Art</label>
                  <select name="content_art" class="form-input">
                    <option value="">– bitte wählen –</option>
                    <option value="Paid">Paid</option>
                    <option value="Organisch">Organisch</option>
                    <option value="Influencer">Influencer</option>
                    <option value="Videograph">Videograph</option>
                  </select>
                </div>
                <div class="form-field">
                  <label>Asset URL</label>
                  <input type="url" name="asset_url" class="form-input" placeholder="https://..." />
                </div>
                <input type="hidden" name="kooperation_id" value="${koopId || ''}" />
              </div>
              <div class="form-actions">
                <button type="submit" class="primary-btn mdc-btn" data-default-text="Video anlegen" data-success-text="Video angelegt" ${limitReached ? 'disabled' : ''}>Video anlegen</button>
                ${koopId ? `<button type="button" id="btn-cancel-create" class="secondary-btn">Abbrechen</button>` : ''}
              </div>
            </form>
          </div>`;
        window.setContentSafely(window.content, formHtml);
        this.bindCreateEvents(koopId);
        return;
      }

      await this.loadData();
      
      // Breadcrumb aktualisieren
      if (window.breadcrumbSystem && this.video && this.kooperation) {
        window.breadcrumbSystem.updateBreadcrumb([
          { label: 'Kooperation', url: '/kooperation', clickable: true },
          { label: this.kooperation.name || 'Details', url: `/kooperation/${this.kooperation.id}`, clickable: true },
          { label: this.video.titel || 'Video', url: `/video/${this.videoId}`, clickable: false }
        ]);
      }
      
      this.render();
      this.bindEvents();
    } catch (error) {
      console.error('KooperationVideoDetail init error:', error);
      window.notificationSystem?.error?.('Video-Detail konnte nicht geladen werden.');
    }
  },

  async fetchKooperationInfo(koopId) {
    try {
      const { data } = await window.supabase
        .from('kooperationen')
        .select('id, name, kampagne:kampagne_id(id, kampagnenname)')
        .eq('id', koopId)
        .single();
      return data || null;
    } catch (_) { return null; }
  },

  bindCreateEvents(koopId) {
    document.getElementById('btn-back-to-kooperation')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (koopId) window.navigateTo(`/kooperation/${koopId}`);
    });
    document.getElementById('btn-cancel-create')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (koopId) window.navigateTo(`/kooperation/${koopId}`);
    });
    const form = document.getElementById('video-create-form');
    if (form) {
      // Hidden Koop-ID sicherstellen
      const hiddenKoop = form.querySelector('input[name="kooperation_id"]');
      if (hiddenKoop && !hiddenKoop.value && koopId) hiddenKoop.value = koopId;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('.mdc-btn');
        const fd = new FormData(form);
        const payload = {
          kooperation_id: fd.get('kooperation_id') || koopId || null,
          titel: String(fd.get('titel') || '').trim() || null,
          content_art: String(fd.get('content_art') || '').trim() || null,
          asset_url: String(fd.get('asset_url') || '').trim() || null,
          status: 'produktion'
        };
        if (!payload.kooperation_id || !payload.titel) {
          alert('Bitte Kooperation und Titel angeben.');
          return;
        }
        try {
          // Micro-Animation aktivieren
          if (btn) {
            btn.disabled = true;
            btn.classList.add('is-loading');
          }
          // Nächste Position ermitteln (max(position)+1)
          let nextPos = 1;
          try {
            const { data: last } = await window.supabase
              .from('kooperation_videos')
              .select('position')
              .eq('kooperation_id', koopId)
              .order('position', { ascending: false })
              .limit(1);
            nextPos = ((last && last[0] && parseInt(last[0].position, 10)) || 0) + 1;
          } catch (_) {}
          const { data: insertedVideo, error } = await window.supabase
            .from('kooperation_videos')
            .insert({ ...payload, position: nextPos })
            .select('id')
            .single();
          if (error) throw error;
          
          // Asset mit Version 1 anlegen, wenn asset_url vorhanden ist
          if (insertedVideo && insertedVideo.id && payload.asset_url) {
            try {
              await window.supabase
                .from('kooperation_video_asset')
                .insert({
                  video_id: insertedVideo.id,
                  file_url: payload.asset_url,
                  file_path: payload.asset_url,
                  version_number: 1,
                  is_current: true,
                  description: 'Initiales Video',
                  uploaded_by: window.currentUser?.id || null,
                  created_at: new Date().toISOString()
                });
              console.log('✅ Initiales Asset (V1) erstellt für Video:', insertedVideo.id);
            } catch (assetError) {
              console.warn('⚠️ Asset V1 konnte nicht erstellt werden:', assetError);
            }
          }
          
          // Benachrichtigungen an Kunden senden
          try {
            await this.sendVideoUploadNotifications(insertedVideo.id, false);
          } catch (notifErr) {
            console.warn('⚠️ Video-Upload-Benachrichtigung konnte nicht versendet werden:', notifErr);
          }
          
          if (btn) {
            btn.classList.remove('is-loading');
            btn.classList.add('is-success');
            btn.textContent = btn.dataset.successText || 'Angelegt';
          }
          setTimeout(() => {
            window.navigateTo(`/kooperation/${koopId}`);
          }, 400);
        } catch (err) {
          console.error('Video anlegen fehlgeschlagen', err);
          if (btn) {
            btn.classList.remove('is-loading');
            btn.disabled = false;
          }
          alert('Video konnte nicht angelegt werden.');
        }
      });
    }
  },

  async loadData() {
    // Video + Basisdaten
    const { data: video, error } = await window.supabase
      .from('kooperation_videos')
      .select('id, kooperation_id, titel, content_art, asset_url, kommentar, status, position, created_at')
      .eq('id', this.videoId)
      .single();
    if (error) throw error;
    this.video = video;

    // Kooperation für Zurück-Link / Titel
    try {
      const { data: koop } = await window.supabase
        .from('kooperationen')
        .select('id, name, kampagne:kampagne_id(id, kampagnenname)')
        .eq('id', video.kooperation_id)
        .single();
      this.kooperation = koop || null;
    } catch (_) {
      this.kooperation = null;
    }

    // Kommentare (Runde 1/2) - inklusive soft-deleted für Anzeige
    try {
      const { data: comments } = await window.supabase
        .from('kooperation_video_comment')
        .select('id, video_id, runde, text, author_name, author_benutzer_id, created_at, deleted_at, deleted_by_benutzer_id')
        .eq('video_id', this.videoId)
        .order('created_at', { ascending: true });
      this.comments = comments || [];
    } catch (_) {
      this.comments = [];
    }

    // Assets (optional) - mit Versionsinformationen laden
    try {
      const { data: assets } = await window.supabase
        .from('kooperation_video_asset')
        .select('id, file_url, file_path, version_number, is_current, description, uploaded_by, created_at')
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
    const koopName = this.kooperation?.name || '-';
    const kampName = this.kooperation?.kampagne?.kampagnenname || '-';
    const safe = (s) => window.validatorSystem?.sanitizeHtml?.(s) ?? s;
    const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('de-DE') : '-');

    if (typeof window.setHeadline === 'function') {
      window.setHeadline(`Video: ${safe(title)}`);
    }

    const canEdit = window.currentUser?.permissions?.kooperation?.can_edit || window.currentUser?.rolle === 'admin';
    const canUpload = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle === 'mitarbeiter';

    // Aktuelle Version ermitteln
    const currentAsset = this.assets.find(a => a.is_current) || this.assets[0];
    
    // Player/Preview für aktuelle Version
    const url = currentAsset?.file_url || v.asset_url || '';
    const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(url);
    const mediaHtml = url
      ? (isVideo
          ? `<video src="${url}" controls style="width:100%;max-height:60vh;border-radius:8px;"></video>`
          : `<a href="${url}" target="_blank" rel="noopener" class="primary-btn">Asset öffnen</a>`)
      : '<p class="empty-state">Kein Asset hinterlegt.</p>';

    const grouped = { r1: [], r2: [] };
    (this.comments || []).forEach(c => {
      const r = (c.runde === 2 || c.runde === '2') ? 'r2' : 'r1';
      grouped[r].push(c);
    });

    // Asset-Versionen rendern
    const assetsHtml = this.renderAssetVersions(this.assets, safe, fmtDateTime, canEdit);

    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>${safe(title)}</h1>
          <p>Kooperation: ${safe(koopName)} · Kampagne: ${safe(kampName)}</p>
        </div>
        <div class="page-header-right">
          ${v.kooperation_id ? `<button id="btn-back-kooperation" class="secondary-btn">Zur Kooperation</button>` : ''}
        </div>
      </div>

      <!-- Tab-Navigation -->
      <div class="tab-navigation">
        <button class="tab-button active" data-tab="info">
          Informationen
        </button>
        <button class="tab-button" data-tab="videos">
          Videos & Feedback
        </button>
      </div>

      <div class="tab-content">
        <!-- Tab: Informationen -->
        <div class="tab-pane active" id="tab-info">
          <div class="detail-card">
            <h3>Informationen</h3>
            <div class="detail-grid-2">
              <div class="detail-item"><label>Content-Art</label><span>${safe(v.content_art || '-')}</span></div>
              <div class="detail-item"><label>Position</label><span>${v.position || '-'}</span></div>
              <div class="detail-item"><label>Status</label>
                <span class="status-badge status-${(v.status || 'produktion').toLowerCase()}">${v.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Produktion'}</span>
              </div>
              <div class="detail-item"><label>Erstellt</label><span>${fmtDateTime(v.created_at)}</span></div>
            </div>
            ${canEdit ? `
            <div class="form-inline" style="margin-top:var(--space-sm);gap:var(--space-xs);display:flex;align-items:center;">
              <label>Status ändern:</label>
              <select id="video-status" class="form-input" style="max-width:220px;">
                <option value="produktion" ${v.status !== 'abgeschlossen' ? 'selected' : ''}>Produktion</option>
                <option value="abgeschlossen" ${v.status === 'abgeschlossen' ? 'selected' : ''}>Abgeschlossen</option>
              </select>
              <button id="btn-save-status" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc">
                <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${window.formSystem?.formRenderer?.getCheckIcon?.() || '✔'}</span>
                <span class="mdc-btn__spinner" aria-hidden="true">${window.formSystem?.formRenderer?.getSpinnerIcon?.() || ''}</span>
                <span class="mdc-btn__label">Speichern</span>
              </button>
            </div>` : ''}
          </div>
        </div>

        <!-- Tab: Videos & Feedback -->
        <div class="tab-pane" id="tab-videos">
          <div class="detail-card">
            <h3>Video-Versionen</h3>
            ${assetsHtml}
            ${canUpload ? `
            <div class="asset-upload-section" style="margin-top:var(--space-md);padding-top:var(--space-md);border-top:var(--border-xs) solid var(--border-primary);">
              <h4 style="margin:0 0 var(--space-sm) 0;">Neue Video-Version hochladen</h4>
              <form id="asset-upload-form">
                <div class="detail-grid-2">
                  <div class="form-field" style="grid-column: span 2;">
                    <label>Asset URL</label>
                    <input type="url" name="file_url" class="form-input" placeholder="https://..." required />
                  </div>
                  <div class="form-field" style="grid-column: span 2;">
                    <label>Beschreibung (optional)</label>
                    <textarea name="description" class="form-input" rows="2" placeholder="z.B. Feedback aus Runde 1 eingearbeitet"></textarea>
                  </div>
                </div>
                <button type="submit" class="primary-btn" style="margin-top:var(--space-xs);">Version hochladen</button>
              </form>
            </div>` : ''}
          </div>

          <div class="detail-grid">
            <div class="detail-card">
              <h3>Feedback Runde 1</h3>
              <div id="comments-r1">${this.renderCommentsTable(grouped.r1)}</div>
            </div>
            <div class="detail-card">
              <h3>Feedback Runde 2</h3>
              <div id="comments-r2">${this.renderCommentsTable(grouped.r2)}</div>
            </div>
          </div>

          <div class="detail-card">
            <h3>Kommentar hinzufügen</h3>
            <form id="comment-form">
              <div class="detail-grid-2">
                <div class="form-field">
                  <label>Runde</label>
                  <select name="runde" class="form-input">
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </div>
                <div class="form-field" style="grid-column: span 2;">
                  <label>Text</label>
                  <textarea name="text" class="form-input" rows="3" placeholder="Kommentar eingeben..."></textarea>
                </div>
              </div>
              <div style="margin-top:var(--space-xs);">
                <button type="submit" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc" data-default-text="Speichern" data-success-text="Gespeichert">
                  <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${window.formSystem?.formRenderer?.getCheckIcon?.() || '✔'}</span>
                  <span class="mdc-btn__spinner" aria-hidden="true">${window.formSystem?.formRenderer?.getSpinnerIcon?.() || ''}</span>
                  <span class="mdc-btn__label">Speichern</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    window.setContentSafely(window.content, html);
  },

  async sendFeedbackNotifications(runde) {
    if (!this.video?.kooperation_id || !window.currentUser?.id) return;
    
    const isKunde = window.currentUser?.rolle === 'kunde';
    const isMitarbeiter = window.currentUser?.rolle === 'mitarbeiter' || window.currentUser?.rolle === 'admin';
    
    try {
      if (isMitarbeiter) {
        // Mitarbeiter gibt Feedback → Benachrichtige Kunden
        // Lade Kunden über kooperation → kampagne → marke → kunden_marken
        const { data: koopData } = await window.supabase
          .from('kooperationen')
          .select(`
            id,
            name,
            kampagne:kampagne_id(
              id,
              kampagnenname,
              marke:marke_id(
                id,
                markenname,
                kunden_marken!inner(kunde_id)
              )
            )
          `)
          .eq('id', this.video.kooperation_id)
          .single();
        
        if (koopData?.kampagne?.marke?.kunden_marken) {
          const kundenIds = koopData.kampagne.marke.kunden_marken.map(km => km.kunde_id).filter(Boolean);
          const videoTitle = this.video?.titel || `Video #${this.videoId}`;
          const koopName = koopData.name || 'Unbekannte Kooperation';
          
          // Batch-Insert für alle Kunden
          if (kundenIds.length > 0) {
            const notifications = kundenIds.map(kundeId => ({
              user_id: kundeId,
              type: 'feedback',
              entity: 'kooperation_videos',
              entity_id: this.videoId,
              title: 'Neues Video-Feedback',
              message: `Neues Feedback (Runde ${runde}) für Video "${videoTitle}" in Kooperation "${koopName}"`,
              created_at: new Date().toISOString()
            }));
            
            await window.supabase.from('notifications').insert(notifications);
            window.dispatchEvent(new Event('notificationsRefresh'));
          }
        }
      } else if (isKunde) {
        // Kunde gibt Feedback → Benachrichtige alle Kampagnen-Mitarbeiter
        const { data: koopData } = await window.supabase
          .from('kooperationen')
          .select(`
            id,
            name,
            kampagne:kampagne_id(
              id,
              kampagnenname,
              kampagne_mitarbeiter!inner(mitarbeiter_id)
            )
          `)
          .eq('id', this.video.kooperation_id)
          .single();
        
        if (koopData?.kampagne?.kampagne_mitarbeiter) {
          const mitarbeiterIds = koopData.kampagne.kampagne_mitarbeiter.map(km => km.mitarbeiter_id).filter(Boolean);
          const videoTitle = this.video?.titel || `Video #${this.videoId}`;
          const koopName = koopData.name || 'Unbekannte Kooperation';
          
          // Batch-Insert für alle Mitarbeiter
          if (mitarbeiterIds.length > 0) {
            const notifications = mitarbeiterIds.map(mitarbeiterId => ({
              user_id: mitarbeiterId,
              type: 'feedback',
              entity: 'kooperation_videos',
              entity_id: this.videoId,
              title: 'Kunden-Feedback erhalten',
              message: `Kunde hat Feedback (Runde ${runde}) für Video "${videoTitle}" in Kooperation "${koopName}" gegeben`,
              created_at: new Date().toISOString()
            }));
            
            await window.supabase.from('notifications').insert(notifications);
            window.dispatchEvent(new Event('notificationsRefresh'));
          }
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Versenden der Feedback-Benachrichtigungen:', error);
      // Fehler nicht nach oben propagieren, damit Feedback trotzdem gespeichert wird
    }
  },

  async sendVideoUploadNotifications(videoId, isNewVersion = false) {
    if (!videoId) return;
    
    const isMitarbeiter = window.currentUser?.rolle === 'mitarbeiter' || window.currentUser?.rolle === 'admin';
    if (!isMitarbeiter) return; // Nur Mitarbeiter/Admin laden Videos hoch
    
    try {
      // Lade Kooperations-Info und Kunden
      const { data: videoData } = await window.supabase
        .from('kooperation_videos')
        .select(`
          id,
          titel,
          kooperation:kooperation_id(
            id,
            name,
            kampagne:kampagne_id(
              id,
              kampagnenname,
              marke:marke_id(
                id,
                markenname,
                kunde_marke!inner(kunde_id)
              )
            )
          )
        `)
        .eq('id', videoId)
        .single();
      
      if (videoData?.kooperation?.kampagne?.marke?.kunde_marke) {
        const kundenIds = videoData.kooperation.kampagne.marke.kunde_marke.map(km => km.kunde_id).filter(Boolean);
        const videoTitle = videoData.titel || `Video #${videoId}`;
        const koopName = videoData.kooperation.name || 'Unbekannte Kooperation';
        
        // Batch-Insert für alle Kunden
        if (kundenIds.length > 0) {
          const notifications = kundenIds.map(kundeId => ({
            user_id: kundeId,
            type: 'video_upload',
            entity: 'kooperation_videos',
            entity_id: videoId,
            title: isNewVersion ? 'Neue Video-Version hochgeladen' : 'Neues Video hochgeladen',
            message: isNewVersion 
              ? `Eine neue Version von "${videoTitle}" wurde in Kooperation "${koopName}" hochgeladen`
              : `Ein neues Video "${videoTitle}" wurde in Kooperation "${koopName}" hochgeladen`,
            created_at: new Date().toISOString()
          }));
          
          await window.supabase.from('notifications').insert(notifications);
          window.dispatchEvent(new Event('notificationsRefresh'));
          console.log(`✅ Video-Upload-Benachrichtigungen versendet (${kundenIds.length} Kunden)`);
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Versenden der Video-Upload-Benachrichtigungen:', error);
      // Fehler nicht nach oben propagieren
    }
  },

  renderAssetVersions(assets, safe, fmtDateTime, canEdit) {
    if (!assets || assets.length === 0) {
      return '<p class="empty-state">Keine Assets vorhanden.</p>';
    }

    const sortedAssets = [...assets].sort((a, b) => 
      (b.version_number || 0) - (a.version_number || 0)
    );
    
    const rows = sortedAssets.map(asset => `
      <tr>
        <td>
          <span style="font-weight:600;color:var(--color-primary);">V${asset.version_number || 1}</span>
        </td>
        <td>${asset.description ? safe(asset.description) : '—'}</td>
        <td>${fmtDateTime(asset.created_at)}</td>
        <td>
          ${asset.is_current 
            ? '<span class="status-badge status-abgeschlossen">Aktuell</span>' 
            : '<span class="status-badge status-produktion">Archiv</span>'}
        </td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="kooperation_video_asset">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="${asset.file_url}" target="_blank" rel="noopener" class="action-item">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                Öffnen
              </a>
              ${!asset.is_current && canEdit ? `
              <a href="#" class="action-item set-current-version" data-asset-id="${asset.id}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Als aktuell markieren
              </a>
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
    `).join('');
    
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Beschreibung</th>
              <th>Hochgeladen am</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  renderCommentsTable(list) {
    const safe = (s) => window.validatorSystem?.sanitizeHtml?.(s) ?? s;
    const fDateTime = (d) => (d ? new Date(d).toLocaleString('de-DE') : '-');
    const currentUserId = window.currentUser?.id;
    
    if (!list || list.length === 0) {
      return '<p class="empty-state">Keine Kommentare vorhanden.</p>';
    }
    
    const rows = list.map(c => {
      const isDeleted = !!c.deleted_at;
      const isOwnComment = c.author_benutzer_id === currentUserId;
      const canDelete = isOwnComment && !isDeleted;
      
      // Styling für gelöschte Kommentare
      const rowStyle = isDeleted ? ' style="opacity: 0.5; background-color: #f9f9f9;"' : '';
      const textStyle = isDeleted ? ' style="text-decoration: line-through; color: #999;"' : '';
      
      return `
      <tr${rowStyle}>
        <td>${safe(c.author_name || '-')}</td>
        <td>${fDateTime(c.created_at)}</td>
        <td${textStyle}>
          ${safe(c.text || '')}
          ${isDeleted ? `<br><small style="color: #999;">Gelöscht am: ${fDateTime(c.deleted_at)}</small>` : ''}
        </td>
        <td>
          ${canDelete ? `
          <div class="actions-dropdown-container" data-entity-type="kooperation_video_comment">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item action-danger comment-delete" data-action="comment-delete" data-id="${c.id}">
                ${window.ActionsDropdown?.getHeroIcon ? window.ActionsDropdown.getHeroIcon('delete') : ''}
                Entfernen
              </a>
            </div>
          </div>
          ` : '—'}
        </td>
      </tr>
      `;
    }).join('');
    
    return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Datum</th>
              <th>Kommentar</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  bindEvents() {
    // Tab-Switching
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-button')) {
        e.preventDefault();
        const tabName = e.target.dataset.tab;
        if (tabName) this.switchTab(tabName);
      }
    });

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
          this.bindEvents();
          // Notify parent views
          window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kooperation_videos', action: 'updated', id: this.videoId, field: 'status', value } }));
        } catch (err) {
          console.error('Status speichern fehlgeschlagen', err);
          alert('Status konnte nicht gespeichert werden.');
        }
      });
    }

    // Asset-Upload-Event-Handler
    this.bindAssetUploadEvents();

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
          this.bindEvents();
        } catch (err) {
          console.error('Version aktualisieren fehlgeschlagen', err);
          alert('Version konnte nicht als aktuell markiert werden.');
        }
      });
    });

    // Kommentar-Submit
    const form = document.getElementById('comment-form');
    if (form) {
      const btn = form.querySelector('.mdc-btn');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const runde = parseInt(fd.get('runde') || '1', 10) === 2 ? 2 : 1;
        const text = String(fd.get('text') || '').trim();
        if (!text) return;
        try {
          if (btn) {
            btn.disabled = true;
            btn.classList.add('is-loading');
          }
          const payload = {
            video_id: this.videoId,
            runde,
            text,
            author_benutzer_id: window.currentUser?.id || null,
            author_name: window.currentUser?.name || null,
            created_at: new Date().toISOString()
          };
          const { error } = await window.supabase.from('kooperation_video_comment').insert(payload);
          if (error) throw error;
          
          // Benachrichtigungen versenden
          try {
            await this.sendFeedbackNotifications(runde);
          } catch (notifErr) {
            console.warn('⚠️ Benachrichtigung konnte nicht versendet werden:', notifErr);
          }
          
          form.reset();
          // Direkt lokal ergänzen für Live-Feeling
          this.comments = this.comments || [];
          this.comments.push({ ...payload });
          if (btn) {
            btn.classList.remove('is-loading');
            btn.classList.add('is-success');
            const label = btn.querySelector('.mdc-btn__label');
            if (label) label.textContent = btn.dataset.successText || 'Gespeichert';
            setTimeout(() => {
              btn.classList.remove('is-success');
              btn.disabled = false;
              if (label) label.textContent = btn.dataset.defaultText || 'Speichern';
            }, 600);
          }
          // UI Teilbereich aktualisieren
          const content = document.querySelector('#comments-' + (runde === 2 ? 'r2' : 'r1'));
          if (content) content.innerHTML = this.renderCommentsTable(runde === 2 ? [...(this.comments.filter(c=>c.runde===2))] : [...(this.comments.filter(c=>c.runde!==2))]);
        } catch (err) {
          console.error('Kommentar speichern fehlgeschlagen', err);
          if (btn) {
            btn.classList.remove('is-loading');
            btn.disabled = false;
          }
          alert('Kommentar konnte nicht gespeichert werden.');
        }
      });
    }

    // Kommentar löschen (Soft-Delete - Delegation innerhalb des Content-Bereichs)
    const contentSection = document.querySelector('.content-section');
    if (contentSection) {
      contentSection.addEventListener('click', async (e) => {
        const del = e.target.closest('.comment-delete');
        if (!del) return;
        e.preventDefault();
        const id = del.dataset.id;
        if (!id) return;
        if (!confirm('Kommentar wirklich entfernen?')) return;
        try {
          // Soft-Delete: Setze deleted_at und deleted_by
          const { error } = await window.supabase
            .from('kooperation_video_comment')
            .update({
              deleted_at: new Date().toISOString(),
              deleted_by_benutzer_id: window.currentUser?.id || null
            })
            .eq('id', id);
          if (error) throw error;
          await this.loadData();
          this.render();
          this.bindEvents();
        } catch (err) {
          console.error('Kommentar löschen fehlgeschlagen', err);
          alert('Kommentar konnte nicht gelöscht werden.');
        }
      });
    }

    // ActionsDropdown für Asset-Versionen initialisieren
    if (window.ActionsDropdown) {
      window.ActionsDropdown.init();
    }
  },

  bindAssetUploadEvents() {
    const form = document.getElementById('asset-upload-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const fileUrl = String(fd.get('file_url') || '').trim();
      
      if (!fileUrl) {
        alert('Bitte Asset-URL angeben.');
        return;
      }
      
      try {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Wird hochgeladen...';
        }
        
        // Nächste Versionsnummer ermitteln
        const maxVersion = this.assets.length > 0 
          ? Math.max(...this.assets.map(a => a.version_number || 0))
          : 0;
        const nextVersion = maxVersion + 1;
        
        // Alle bisherigen als nicht-aktuell markieren
        await window.supabase
          .from('kooperation_video_asset')
          .update({ is_current: false })
          .eq('video_id', this.videoId);
        
        // Neue Version einfügen
        const { error } = await window.supabase
          .from('kooperation_video_asset')
          .insert({
            video_id: this.videoId,
            file_url: fileUrl,
            file_path: fileUrl,
            version_number: nextVersion,
            is_current: true,
            description: fd.get('description') || null,
            uploaded_by: window.currentUser?.id || null,
            created_at: new Date().toISOString()
          });
        
        if (error) throw error;
        
        // Benachrichtigungen an Kunden senden (neue Version)
        try {
          await this.sendVideoUploadNotifications(this.videoId, true);
        } catch (notifErr) {
          console.warn('⚠️ Video-Version-Benachrichtigung konnte nicht versendet werden:', notifErr);
        }
        
        // UI aktualisieren
        await this.loadData();
        this.render();
        this.bindEvents();
        
        window.notificationSystem?.success?.(`Version ${nextVersion} erfolgreich hochgeladen.`);
      } catch (err) {
        console.error('Asset-Upload fehlgeschlagen', err);
        alert('Asset konnte nicht hochgeladen werden: ' + (err.message || ''));
        
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Version hochladen';
        }
      }
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
    // No-op; Event-Delegation global
  }
};
