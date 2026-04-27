import { buildVideoSelectOptions, addVideoRow } from './VideosFields.js';
import { setup as setupKooperationTags } from './KooperationTagsEvents.js';

export async function setup(form, ctx) {
  const kampagneSelect = form.querySelector('select[name="kampagne_id"]');
  const videoInput = form.querySelector('input[name="videoanzahl"]');
  const videosContainer = form.querySelector('.videos-container');
  const videosList = form.querySelector('.videos-list');
  const contentArtOptions = (() => {
    try {
      return videosContainer?.dataset?.options ? JSON.parse(videosContainer.dataset.options) : [];
    } catch(_) { return []; }
  })();
  if (!kampagneSelect || !videoInput || !window.supabase) return;

  let kampagnenartenOptions = [];

  const recalcEkSum = () => {
    if (!videosList) return;
    const inputs = videosList.querySelectorAll('.video-ek-input');
    let sum = 0;
    inputs.forEach(inp => { sum += parseFloat(inp.value) || 0; });
    const ekField = form.querySelector('input[name="einkaufspreis_netto"]');
    if (ekField) {
      ekField.value = sum.toFixed(2);
      ekField.dispatchEvent(new Event('input', { bubbles: true }));
      ekField.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const recalcVkSum = () => {
    if (!videosList) return;
    const inputs = videosList.querySelectorAll('.video-vk-input');
    let sum = 0;
    inputs.forEach(inp => { sum += parseFloat(inp.value) || 0; });
    const vkField = form.querySelector('input[name="verkaufspreis_netto"]');
    if (vkField) {
      vkField.value = sum.toFixed(2);
      vkField.dispatchEvent(new Event('input', { bubbles: true }));
      vkField.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const recalcAllPrices = () => { recalcEkSum(); recalcVkSum(); };

  const attachStepper = () => {
    if (videoInput.dataset.stepperAttached === 'true') return;
    try { videoInput.type = 'hidden'; } catch (_) { videoInput.style.display = 'none'; }
    const container = document.createElement('div');
    container.className = 'number-stepper';

    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.className = 'stepper-btn stepper-minus secondary-btn';
    minusBtn.textContent = '-';

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'stepper-btn stepper-plus secondary-btn';
    plusBtn.textContent = '+';

    const info = document.createElement('span');
    info.className = 'stepper-info';
    info.textContent = '';

    videoInput.parentNode.insertBefore(container, videoInput.nextSibling);
    container.appendChild(minusBtn);
    container.appendChild(plusBtn);
    container.appendChild(info);

    const getBounds = () => ({
      min: parseInt(videoInput.min || '0', 10) || 0,
      max: parseInt(videoInput.max || '0', 10) || 0
    });

    const clamp = (v) => {
      const { min, max } = getBounds();
      const n = parseInt(v || '0', 10) || 0;
      if (!max) return '';
      return String(Math.max(min, Math.min(n, max)));
    };

    const updateInfo = () => {
      const { max } = getBounds();
      const selected = parseInt(videoInput.value || '0', 10) || 0;
      const remainingAfter = Math.max(0, max - selected);
      const sSel = selected === 1 ? 'Video' : 'Videos';
      info.textContent = max > 0 ? `${selected} ${sSel} | Rest: ${remainingAfter}` : (kampagneSelect.value ? 'Keine Videos verfügbar' : 'Bitte zuerst Kampagne wählen');
      minusBtn.disabled = max === 0 || selected <= (parseInt(videoInput.min || '0', 10) || 0);
      plusBtn.disabled = max === 0 || selected >= max;
    };

    const syncVideosToCount = () => {
      if (!videosList) return;
      const desired = parseInt(videoInput.value || '0', 10) || 0;
      const current = videosList.querySelectorAll('.video-item').length;
      if (desired > current) {
        for (let i = 0; i < (desired - current); i++) {
          addVideoRow(videosList, contentArtOptions, {}, kampagnenartenOptions, recalcAllPrices);
        }
      } else if (desired < current) {
        for (let i = 0; i < (current - desired); i++) {
          const last = videosList.querySelector('.video-item:last-of-type');
          if (last) last.remove();
        }
        recalcAllPrices();
      }
    };

    minusBtn.addEventListener('click', () => {
      const { min } = getBounds();
      const cur = parseInt(videoInput.value || '0', 10) || 0;
      const next = Math.max(min, cur - 1);
      videoInput.value = clamp(String(next));
      videoInput.dispatchEvent(new Event('input', { bubbles: true }));
      videoInput.dispatchEvent(new Event('change', { bubbles: true }));
      updateInfo();
      syncVideosToCount();
    });

    plusBtn.addEventListener('click', () => {
      const { max } = getBounds();
      const cur = parseInt(videoInput.value || '0', 10) || 0;
      const next = Math.min(max, cur + 1);
      videoInput.value = clamp(String(next));
      videoInput.dispatchEvent(new Event('input', { bubbles: true }));
      videoInput.dispatchEvent(new Event('change', { bubbles: true }));
      updateInfo();
      syncVideosToCount();
    });

    videoInput.addEventListener('input', () => {
      videoInput.value = clamp(videoInput.value);
      updateInfo();
      syncVideosToCount();
    });

    videoInput.dataset.stepperAttached = 'true';
    updateInfo();
  };

  attachStepper();

  const refreshStepperUI = () => {
    const stepperInfo = videoInput.parentNode.querySelector('.stepper-info');
    const minusBtn = videoInput.parentNode.querySelector('.stepper-minus');
    const plusBtn = videoInput.parentNode.querySelector('.stepper-plus');
    const max = parseInt(videoInput.max || '0', 10) || 0;
    const min = parseInt(videoInput.min || '0', 10) || 0;
    const selected = parseInt(videoInput.value || '0', 10) || 0;
    const remainingAfter = Math.max(0, max - selected);
    const sSel = selected === 1 ? 'Video' : 'Videos';
    if (stepperInfo) {
      stepperInfo.textContent = max > 0 ? `${selected} ${sSel} | Rest: ${remainingAfter}` : (kampagneSelect.value ? 'Keine Videos verfügbar' : 'Bitte zuerst Kampagne wählen');
    }
    if (minusBtn) minusBtn.disabled = max === 0 || selected <= min;
    if (plusBtn) plusBtn.disabled = max === 0 || selected >= max;
  };

  const clampValue = (value, min, max) => {
    const n = parseInt(value, 10);
    if (isNaN(n)) return '';
    if (max === 0) return '';
    return String(Math.max(min, Math.min(n, max)));
  };

  const refreshExistingVideoSelects = () => {
    if (!videosList || kampagnenartenOptions.length === 0) return;

    videosList.querySelectorAll('.video-kampagnenart-select').forEach(sel => {
      const selectedValue = sel.value || sel.dataset.initialValue || '';
      sel.innerHTML = buildVideoSelectOptions(kampagnenartenOptions, selectedValue);
      if (selectedValue) sel.value = selectedValue;
    });

    videosList.querySelectorAll('.video-content-select').forEach(sel => {
      const selectedValue = sel.value || sel.dataset.initialValue || '';
      if (selectedValue) sel.value = selectedValue;
    });
  };

  const updateVideoLimits = async () => {
    const kampagneId = kampagneSelect.value;
    if (!kampagneId) {
      videoInput.disabled = true;
      videoInput.removeAttribute('max');
      videoInput.removeAttribute('min');
      videoInput.value = '';
      refreshStepperUI();
      if (videosList) videosList.innerHTML = '';
      return;
    }

    try {
      const { data: kampagne, error: kampagneError } = await window.supabase
        .from('kampagne')
        .select('videoanzahl, auftrag_id, ugc_paid_video_anzahl, ugc_organic_video_anzahl, ugc_pro_paid_video_anzahl, ugc_pro_organic_video_anzahl, ugc_video_paid_video_anzahl, ugc_video_organic_video_anzahl, influencer_video_anzahl, story_video_anzahl, vor_ort_video_anzahl, ugc_video_anzahl, igc_video_anzahl')
        .eq('id', kampagneId)
        .single();
      if (kampagneError) {
        console.error('❌ Fehler beim Laden der Kampagne (videoanzahl):', kampagneError);
        return;
      }

      try {
        if (kampagne?.auftrag_id) {
          const { data: auftragArten, error: artError } = await window.supabase
            .from('auftrag_kampagne_art')
            .select('kampagne_art_id')
            .eq('auftrag_id', kampagne.auftrag_id);
          if (!artError && auftragArten && auftragArten.length > 0) {
            const artIds = auftragArten.map(a => a.kampagne_art_id).filter(Boolean);
            if (artIds.length > 0) {
              const { data: artTypen } = await window.supabase
                .from('kampagne_art_typen')
                .select('name')
                .in('id', artIds);
              kampagnenartenOptions = (artTypen || []).map(t => t.name).filter(Boolean);
            }
          }
        }
        if (kampagnenartenOptions.length === 0) {
          const { data: alleArten } = await window.supabase
            .from('kampagne_art_typen')
            .select('name')
            .order('sort_order', { ascending: true });
          kampagnenartenOptions = (alleArten || []).map(t => t.name).filter(Boolean);
        }
      } catch (e) {
        console.warn('⚠️ Kampagnenarten konnten nicht geladen werden:', e);
      }

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
      const totalVideos = newFieldsSum || legacyFieldsSum || (kampagne?.videoanzahl ?? 0);

      const currentKoopId = form.dataset.entityId;
      let koopQuery = window.supabase
        .from('kooperationen')
        .select('id, videoanzahl')
        .eq('kampagne_id', kampagneId);
      
      if (currentKoopId) {
        koopQuery = koopQuery.neq('id', currentKoopId);
      }
      
      const { data: existingKoops, error: koopError } = await koopQuery;
      if (koopError) {
        console.error('❌ Fehler beim Laden der Kooperationen (videoanzahl):', koopError);
        return;
      }
      const usedVideos = (existingKoops || []).reduce((sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 0);
      const remaining = Math.max(0, totalVideos - usedVideos);

      videoInput.disabled = remaining === 0;
      videoInput.min = remaining > 0 ? '1' : '0';
      videoInput.max = String(remaining);
      videoInput.step = '1';

      if (videoInput.value) {
        videoInput.value = clampValue(videoInput.value, 1, remaining);
      } else if (remaining > 0) {
        videoInput.value = '1';
      }
      refreshStepperUI();

      const desired = parseInt(videoInput.value || '0', 10) || 0;
      if (videosList) {
        const current = videosList.querySelectorAll('.video-item').length;
        if (desired !== current) {
          const diff = desired - current;
          if (diff > 0) {
            for (let i = 0; i < diff; i++) addVideoRow(videosList, contentArtOptions, {}, kampagnenartenOptions, recalcAllPrices);
          } else {
            for (let i = 0; i < Math.abs(diff); i++) {
              const last = videosList.querySelector('.video-item:last-of-type');
              if (last) last.remove();
            }
            recalcAllPrices();
          }
        }
      }

      refreshExistingVideoSelects();

    } catch (err) {
      console.error('❌ Fehler beim Aktualisieren der Video-Limits:', err);
    }
  };

  kampagneSelect.addEventListener('change', updateVideoLimits);
  videoInput.addEventListener('change', async () => {
    const max = parseInt(videoInput.max || '0', 10) || 0;
    if (max > 0) {
      videoInput.value = clampValue(videoInput.value, 1, max);
    }
    refreshStepperUI();
    if (videosList) {
      const desired = parseInt(videoInput.value || '0', 10) || 0;
      const current = videosList.querySelectorAll('.video-item').length;
      if (desired !== current) {
        const diff = desired - current;
        if (diff > 0) {
          for (let i = 0; i < diff; i++) addVideoRow(videosList, contentArtOptions, {}, kampagnenartenOptions, recalcAllPrices);
        } else {
          for (let i = 0; i < Math.abs(diff); i++) {
            const last = videosList.querySelector('.video-item:last-of-type');
            if (last) last.remove();
          }
          recalcAllPrices();
        }
      }
    }
  });

  if (videosList) {
    videosList.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.video-item-remove');
      if (!removeBtn) return;
      const item = removeBtn.closest('.video-item');
      if (item) {
        item.remove();
        const count = videosList.querySelectorAll('.video-item').length;
        videoInput.value = String(count || '');
        refreshStepperUI();
        recalcAllPrices();
        videosList.querySelectorAll('.video-item-number').forEach((el, i) => {
          el.textContent = `Video ${i + 1}`;
        });
      }
    });
  }

  updateVideoLimits();
  
  if (form.dataset.prefillFromKampagne === 'true' || form.dataset.isEditMode === 'true') {
    setTimeout(() => {
      updateVideoLimits();
    }, 300);
  }

  // Edit: vorhandene Videos vorausfüllen
  (async () => {
    try {
      const koopId = form.dataset.entityId;
      if (!koopId || !window.supabase || !videosList) return;
      const { data: rows, error } = await window.supabase
        .from('kooperation_videos')
        .select('id, content_art, kampagnenart, einkaufspreis_netto, verkaufspreis_netto, titel, asset_url, kommentar, position')
        .eq('kooperation_id', koopId)
        .order('position', { ascending: true });
      if (error) return;
      videosList.innerHTML = '';
      (rows || []).forEach(r => addVideoRow(videosList, contentArtOptions, r, kampagnenartenOptions, recalcAllPrices));
      refreshExistingVideoSelects();
      videoInput.value = String((rows || []).length || '');
      refreshStepperUI();
      recalcAllPrices();
    } catch (err) {
      console.warn('⚠️ Fehler beim Laden der Kooperations-Videos:', err?.message);
    }
    
    setTimeout(() => {
      if (kampagneSelect.value && !videoInput.max) {
        updateVideoLimits();
      }
    }, 500);
  })();

  await setupKooperationTags(form);
}
