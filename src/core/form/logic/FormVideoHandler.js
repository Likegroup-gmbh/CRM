import { deleteVideoFull } from '../../VideoDeleteHelper.js';

// Kapselt die gesamte Video-Logik für Kooperationen (Create, Edit-Merge, Validation).
// Wird von FormSystem per Delegation genutzt.
export class FormVideoHandler {
  // Gesamt-Videoanzahl einer Kampagne: Neue Einzelfelder > Legacy-Felder > fallback videoanzahl
  getKampagneTotalVideos(kampagne) {
    const newFieldsSum =
      (parseInt(kampagne?.ugc_paid_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.ugc_organic_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.ugc_pro_paid_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.ugc_pro_organic_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.ugc_video_paid_video_anzahl, 10) || 0) +
      (parseInt(kampagne?.ugc_video_organic_video_anzahl, 10) || 0) +
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
        .select('videoanzahl, ugc_paid_video_anzahl, ugc_organic_video_anzahl, ugc_pro_paid_video_anzahl, ugc_pro_organic_video_anzahl, ugc_video_paid_video_anzahl, ugc_video_organic_video_anzahl, influencer_video_anzahl, story_video_anzahl, vor_ort_video_anzahl, ugc_video_anzahl, igc_video_anzahl')
        .eq('id', kampagneId)
        .single();

      if (kampagneError) {
        throw kampagneError;
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

      const totalVideos = this.getKampagneTotalVideos(kampagne);
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
      if (!window.supabase) return;

      const videoanzahl = parseInt(form.querySelector('[name="videoanzahl"]')?.value || '0', 10);
      if (videoanzahl <= 0) return;

      const contentArtFallback = null;
      const isEditMode = !!form.dataset.entityId;

      const manualRows = this._collectStepperVideos(kooperationId, form);

      if (isEditMode) {
        await this._mergeKooperationVideos(kooperationId, videoanzahl, manualRows, contentArtFallback);
      } else {
        await this._createKooperationVideos(kooperationId, videoanzahl, manualRows, contentArtFallback);
      }
    } catch (error) {
      console.error('❌ Fehler in handleKooperationVideos:', error);
    }
  }

  // Stepper-Daten aus dem Formular auslesen
  _collectStepperVideos(kooperationId, form) {
    const list = form.querySelector('.videos-list');
    if (!list) return [];

    return Array.from(list.querySelectorAll('.video-item')).map((el, idx) => {
      const id = el.getAttribute('data-video-id');
      const contentArt = form.querySelector(`select[name="video_content_art_${id}"]`)?.value || null;
      const kampagnenart = form.querySelector(`select[name="video_kampagnenart_${id}"]`)?.value || null;
      const ekRaw = form.querySelector(`input[name="video_ek_netto_${id}"]`)?.value;
      const einkaufspreis = (ekRaw !== null && ekRaw !== undefined && ekRaw !== '') ? parseFloat(ekRaw) : 0;
      const vkRaw = form.querySelector(`input[name="video_vk_netto_${id}"]`)?.value;
      const verkaufspreis = (vkRaw !== null && vkRaw !== undefined && vkRaw !== '') ? parseFloat(vkRaw) : 0;
      const skriptDeadlineRaw = form.querySelector(`input[name="video_skript_deadline_${id}"]`)?.value;
      const contentDeadlineRaw = form.querySelector(`input[name="video_content_deadline_${id}"]`)?.value;
      return {
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
      console.error('❌ Fehler beim Erstellen der Videos:', error);
    } else {
      console.log(`✅ ${inserted?.length || 0} Videos für Kooperation ${kooperationId} erstellt`);
    }
  }

  // Edit-Mode: Smart-Merge -- bestehende Videos erhalten, fehlende hinzufügen, überzählige entfernen
  async _mergeKooperationVideos(kooperationId, videoanzahl, manualRows, contentArtFallback) {
    const { data: existing, error: loadErr } = await window.supabase
      .from('kooperation_videos')
      .select('id, position, content_art, kampagnenart, einkaufspreis_netto, verkaufspreis_netto, skript_deadline, content_deadline')
      .eq('kooperation_id', kooperationId)
      .order('position', { ascending: true });

    if (loadErr) {
      console.error('❌ Fehler beim Laden bestehender Videos:', loadErr);
      return;
    }

    const existingVideos = existing || [];
    const currentCount = existingVideos.length;

    const updatePromises = existingVideos.slice(0, videoanzahl).map((video, idx) => {
      const manual = manualRows[idx];
      if (!manual) return null;

      const updates = {};
      if (manual.content_art) updates.content_art = manual.content_art;
      if (manual.kampagnenart) updates.kampagnenart = manual.kampagnenart;
      if (manual.einkaufspreis_netto > 0) updates.einkaufspreis_netto = manual.einkaufspreis_netto;
      if (manual.verkaufspreis_netto > 0) updates.verkaufspreis_netto = manual.verkaufspreis_netto;
      // Deadlines immer durchreichen (auch null, damit gezielt geleert werden kann)
      if ((manual.skript_deadline || null) !== (video.skript_deadline || null)) {
        updates.skript_deadline = manual.skript_deadline || null;
      }
      if ((manual.content_deadline || null) !== (video.content_deadline || null)) {
        updates.content_deadline = manual.content_deadline || null;
      }
      updates.position = idx + 1;

      if (Object.keys(updates).length === 1 && updates.position === video.position) return null;

      return window.supabase
        .from('kooperation_videos')
        .update(updates)
        .eq('id', video.id);
    }).filter(Boolean);

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(`✅ ${updatePromises.length} bestehende Videos aktualisiert`);
    }

    if (currentCount > videoanzahl) {
      const toRemove = existingVideos.slice(videoanzahl).map(v => v.id);
      const results = await Promise.allSettled(
        toRemove.map(id => deleteVideoFull(id))
      );
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.success));
      if (failed.length > 0) {
        console.error(`❌ ${failed.length} von ${toRemove.length} Videos konnten nicht vollständig gelöscht werden`);
      } else {
        console.log(`✅ ${toRemove.length} überzählige Videos entfernt (inkl. Dropbox + Assets)`);
      }
    }

    if (videoanzahl > currentCount) {
      const newRows = [];
      for (let i = currentCount; i < videoanzahl; i++) {
        const manual = manualRows[i];
        newRows.push({
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

      const { error: insErr } = await window.supabase
        .from('kooperation_videos')
        .insert(newRows)
        .select('id, content_art, position');

      if (insErr) {
        console.error('❌ Fehler beim Hinzufügen neuer Videos:', insErr);
      } else {
        console.log(`✅ ${newRows.length} neue Videos hinzugefügt (Position ${currentCount + 1}-${videoanzahl})`);
      }
    }
  }
}
