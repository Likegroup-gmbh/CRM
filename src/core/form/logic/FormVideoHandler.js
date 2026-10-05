import { deleteVideoFull } from '../../VideoDeleteHelper.js';

// Kapselt die gesamte Video-Logik für Kooperationen (Create, Edit-Merge, Validation).
// Wird von FormSystem per Delegation genutzt.
export class FormVideoHandler {
  // Gesamt-Videoanzahl einer Kampagne: Neue Einzelfelder > Legacy-Felder > fallback videoanzahl
  getKampagneTotalVideos(kampagne) {
    const newFieldsSum =
      (parseInt(kampagne?.ugc_paid_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.ugc_organic_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.influencer_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.story_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.vor_ort_video_anzahl, 10) || 0);

    const legacyFieldsSum =
      (parseInt(kampagne?.ugc_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.igc_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.influencer_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.vor_ort_video_anzahl, 10) || 0);

    return newFieldsSum || legacyFieldsSum || (kampagne?.videoanzahl ?? 0);
  }

  // Prüft ob die gewünschte Videoanzahl für eine neue/bearbeitete Kooperation
  // das Gesamtbudget der Kampagne nicht überschreitet.
  async validateKooperationVideoLimit(form, submitData, kooperationId = null) {
    try {
      if (!window.supabase) {
        return { isValid: true };
      }

      const kampagneId = submitData?.kampagne_id || form?.querySelector('[name="kampagne_id"]')?.value;
      if (!kampagneId) {
        return { isValid: true };
      }

      const desiredVideos = parseInt(submitData?.videoanzahl, 10) || 0;
      if (desiredVideos <= 0) {
        return { isValid: true };
      }

      const { data: kampagne, error: kampagneError } = await window.supabase
        .from('kampagne')
        .select('videoanzahl, auftrag_id, ugc_paid_video_anzahl, ugc_organic_video_anzahl, influencer_video_anzahl, story_video_anzahl, vor_ort_video_anzahl, ugc_video_anzahl, igc_video_anzahl')
        .eq('id', kampagneId)
        .single();

      if (kampagneError) {
        throw kampagneError;
      }

      let blockTotal = 0;
      if (kampagne?.auftrag_id) {
        try {
          const { data: blocks } = await window.supabase
            .from('auftrag_kampagnenart_blocks')
            .select('video_anzahl')
            .eq('auftrag_id', kampagne.auftrag_id);
          blockTotal = (blocks || []).reduce((sum, b) => sum + (parseInt(b.video_anzahl, 10) || 0), 0);
        } catch (_) { /* ignore */ }
      }

      let koopQuery = window.supabase
        .from('kooperationen')
        .select('id, videoanzahl')
        .eq('kampagne_id', kampagneId);

      if (kooperationId) {
        koopQuery = koopQuery.neq('id', kooperationId);
      }

      const { data: existingKoops, error: koopError } = await koopQuery;
      if (koopError) {
        throw koopError;
      }

      const totalVideos = blockTotal || this.getKampagneTotalVideos(kampagne);

      // Unlimited-Modus: Wenn die Kampagne kein Video-Kontingent definiert hat,
      // duerfen Kooperationen frei angelegt werden -- der Counter laeuft nach oben.
      if (totalVideos === 0) {
        return { isValid: true };
      }

      const usedVideos = (existingKoops || []).reduce((sum, koop) => sum + (parseInt(koop.videoanzahl, 10) || 0), 0);
      const remainingVideos = Math.max(0, totalVideos - usedVideos);

      if (desiredVideos > remainingVideos) {
        return {
          isValid: false,
          message: 'Die gewählte Video Anzahl überschreitet die verfügbaren Videos dieser Kampagne.'
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error('❌ FORMSYSTEM: Fehler bei Kooperations-Video-Limit-Prüfung:', error);
      return {
        isValid: false,
        message: 'Die verfügbare Video Anzahl konnte nicht geprüft werden. Bitte erneut versuchen.'
      };
    }
  }

  // Haupt-Einstiegspunkt: Videos anlegen (Create) oder mit Stepper-Daten mergen (Edit).
  async handleKooperationVideos(kooperationId, form) {
    try {
      if (!window.supabase) return { success: true };

      const videoanzahl = parseInt(form.querySelector('[name="videoanzahl"]')?.value || '0', 10);
      if (videoanzahl <= 0) return { success: true };

      const contentArtFallback = null;
      const isEditMode = !!form.dataset.entityId;

      const manualRows = this._collectStepperVideos(kooperationId, form);

      if (isEditMode) {
        await this._mergeKooperationVideos(kooperationId, videoanzahl, manualRows, contentArtFallback);
      } else {
        await this._createKooperationVideos(kooperationId, videoanzahl, manualRows, contentArtFallback);
      }
      return { success: true };
    } catch (error) {
      console.error('❌ Fehler in handleKooperationVideos:', error);
      return { success: false, error: error.message || 'Videos konnten nicht gespeichert werden' };
    }
  }

  // Stepper-Daten aus dem Formular auslesen
  _collectStepperVideos(kooperationId, form) {
    const list = form.querySelector('.videos-list');
    if (!list) return [];

    return Array.from(list.querySelectorAll('.video-item')).map((el, idx) => {
      const rawId = el.getAttribute('data-video-id');
      const id = rawId && !String(rawId).startsWith('video-') ? rawId : null;
      const fieldKey = rawId || '';
      const contentArt = form.querySelector(`select[name="video_content_art_${fieldKey}"]`)?.value || null;
      const kampagnenart = form.querySelector(`select[name="video_kampagnenart_${fieldKey}"]`)?.value || null;
      const ekRaw = form.querySelector(`input[name="video_ek_netto_${fieldKey}"]`)?.value;
      const einkaufspreis = (ekRaw !== null && ekRaw !== undefined && ekRaw !== '') ? parseFloat(ekRaw) : 0;
      const vkRaw = form.querySelector(`input[name="video_vk_netto_${fieldKey}"]`)?.value;
      const verkaufspreis = (vkRaw !== null && vkRaw !== undefined && vkRaw !== '') ? parseFloat(vkRaw) : 0;
      const skriptDeadlineRaw = form.querySelector(`input[name="video_skript_deadline_${fieldKey}"]`)?.value;
      const contentDeadlineRaw = form.querySelector(`input[name="video_content_deadline_${fieldKey}"]`)?.value;
      return {
        id,
        kooperation_id: kooperationId,
        content_art: contentArt,
        kampagnenart: kampagnenart,
        einkaufspreis_netto: einkaufspreis,
        verkaufspreis_netto: verkaufspreis,
        skript_deadline: skriptDeadlineRaw || null,
        content_deadline: contentDeadlineRaw || null,
        position: idx + 1
      };
    });
  }

  // Create-Mode: Alle Videos frisch anlegen
  async _createKooperationVideos(kooperationId, videoanzahl, manualRows, contentArtFallback) {
    const rows = [];
    for (let i = 0; i < videoanzahl; i++) {
      const manual = manualRows[i];
      rows.push({
        kooperation_id: kooperationId,
        content_art: manual?.content_art || contentArtFallback,
        kampagnenart: manual?.kampagnenart || null,
        einkaufspreis_netto: manual?.einkaufspreis_netto || 0,
        verkaufspreis_netto: manual?.verkaufspreis_netto || 0,
        skript_deadline: manual?.skript_deadline || null,
        content_deadline: manual?.content_deadline || null,
        titel: null,
        asset_url: null,
        kommentar: null,
        position: i + 1
      });
    }

    const { data: inserted, error } = await window.supabase
      .from('kooperation_videos')
      .insert(rows)
      .select('id, content_art, position');

    if (error) {
      throw new Error(error.message || 'Videos konnten nicht erstellt werden');
    }
    console.log(`✅ ${inserted?.length || 0} Videos für Kooperation ${kooperationId} erstellt`);
  }

  // Edit-Mode: bestehende Videos über ihre ID erhalten, neue anlegen, entfernte löschen.
  // Index-Zuordnung würde eine neue Zeile vorne mit dem ersten bestehenden Video verwechseln.
  async _mergeKooperationVideos(kooperationId, videoanzahl, manualRows, contentArtFallback) {
    const { data: existing, error: loadErr } = await window.supabase
      .from('kooperation_videos')
      .select('id, position, content_art, kampagnenart, einkaufspreis_netto, verkaufspreis_netto, skript_deadline, content_deadline')
      .eq('kooperation_id', kooperationId)
      .order('position', { ascending: true });

    if (loadErr) {
      throw new Error(loadErr.message || 'Bestehende Videos konnten nicht geladen werden');
    }

    const existingVideos = existing || [];
    const existingById = new Map(existingVideos.map(video => [String(video.id), video]));
    const persisted = [];
    const fresh = [];

    manualRows.forEach((manual, idx) => {
      const row = { ...manual, position: idx + 1 };
      if (row.id && existingById.has(String(row.id))) persisted.push(row);
      else fresh.push(row);
    });

    while (persisted.length + fresh.length < videoanzahl) {
      fresh.push({
        position: persisted.length + fresh.length + 1,
        content_art: contentArtFallback,
        kampagnenart: null,
        einkaufspreis_netto: 0,
        verkaufspreis_netto: 0,
        skript_deadline: null,
        content_deadline: null
      });
    }

    const updatePromises = persisted.map(manual => {
      const video = existingById.get(String(manual.id));
      const updates = {};
      if ((manual.content_art || null) !== (video.content_art || null)) {
        updates.content_art = manual.content_art || null;
      }
      if ((manual.kampagnenart || null) !== (video.kampagnenart || null)) {
        updates.kampagnenart = manual.kampagnenart || null;
      }
      if (manual.einkaufspreis_netto !== video.einkaufspreis_netto) {
        updates.einkaufspreis_netto = manual.einkaufspreis_netto;
      }
      if (manual.verkaufspreis_netto !== video.verkaufspreis_netto) {
        updates.verkaufspreis_netto = manual.verkaufspreis_netto;
      }
      if ((manual.skript_deadline || null) !== (video.skript_deadline || null)) {
        updates.skript_deadline = manual.skript_deadline || null;
      }
      if ((manual.content_deadline || null) !== (video.content_deadline || null)) {
        updates.content_deadline = manual.content_deadline || null;
      }
      updates.position = manual.position;

      if (Object.keys(updates).length === 1 && updates.position === video.position) return null;

      return window.supabase
        .from('kooperation_videos')
        .update(updates)
        .eq('id', video.id);
    }).filter(Boolean);

    if (updatePromises.length > 0) {
      const results = await Promise.all(updatePromises);
      const failedUpdate = results.find(result => result?.error);
      if (failedUpdate?.error) {
        throw new Error(failedUpdate.error.message || 'Bestehende Videos konnten nicht aktualisiert werden');
      }
      console.log(`✅ ${updatePromises.length} bestehende Videos aktualisiert`);
    }

    const keptIds = new Set(persisted.map(row => String(row.id)));
    const toRemove = existingVideos.filter(video => !keptIds.has(String(video.id))).map(video => video.id);
    if (toRemove.length > 0) {
      const results = await Promise.allSettled(toRemove.map(id => deleteVideoFull(id)));
      const failed = results.filter(result => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value?.success));
      if (failed.length > 0) {
        throw new Error(`${failed.length} von ${toRemove.length} Videos konnten nicht gelöscht werden`);
      }
      console.log(`✅ ${toRemove.length} überzählige Videos entfernt (inkl. Dropbox + Assets)`);
    }

    if (fresh.length > 0) {
      const newRows = fresh.map(manual => ({
        kooperation_id: kooperationId,
        content_art: manual.content_art || contentArtFallback,
        kampagnenart: manual.kampagnenart || null,
        einkaufspreis_netto: manual.einkaufspreis_netto || 0,
        verkaufspreis_netto: manual.verkaufspreis_netto || 0,
        skript_deadline: manual.skript_deadline || null,
        content_deadline: manual.content_deadline || null,
        titel: null,
        asset_url: null,
        kommentar: null,
        position: manual.position
      }));

      const { error: insErr } = await window.supabase
        .from('kooperation_videos')
        .insert(newRows)
        .select('id, content_art, position');

      if (insErr) {
        throw new Error(insErr.message || 'Neue Videos konnten nicht hinzugefügt werden');
      }
      console.log(`✅ ${newRows.length} neue Videos hinzugefügt`);
    }
  }
}
