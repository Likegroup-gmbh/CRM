// KooperationEditLoader.js
// Entity-spezifischer Loader für den Edit-Flow von Kooperationen.
// Lädt ALLE notwendigen Daten parallel (Promise.all) statt sequentiell (Waterfall).
// Rendert Unternehmen/Marke/Kampagne als readonly disabled-Selects mit Hidden Inputs.
// Bindet Stepper-/Video-Events ohne setTimeout-Kaskaden.

import { addVideoRow, buildVideoSelectOptions } from '../../core/form/logic/events/VideosFields.js';
import { setup as setupKooperationTags } from '../../core/form/logic/events/KooperationTagsEvents.js';
import { makeRecalcAllPrices, attachVideoStepper, refreshStepperUI } from './KooperationStepperBinder.js';

export class KooperationEditLoader {
  // Einstiegspunkt: alle Daten parallel laden + Felder befüllen
  async load(form, data) {
    const kampagneId = data?.kampagne_id;
    const unternehmenId = data?.unternehmen_id;
    const markeId = data?.marke_id || null;
    const kooperationId = data?.id || data?._entityId;
    const creatorId = data?.creator_id || null;

    if (!kampagneId) {
      console.warn('⚠️ KooperationEditLoader: kampagne_id fehlt, Fallback auf Standard-Flow');
      return { success: false };
    }

    console.log('🚀 KooperationEditLoader: Starte paralleles Laden für Kooperation', kooperationId);
    const t0 = performance.now();

    const [
      unternehmen,
      marke,
      kampagne,
      briefings,
      creators,
      currentCreator,
      auftragArten,
      alleKampagneArtTypen,
      andereKooperationen,
      kooperationVideos,
      tagTypen,
      koopTags
    ] = await Promise.all([
      this._loadUnternehmen(unternehmenId),
      this._loadMarke(markeId),
      this._loadKampagne(kampagneId),
      this._loadBriefings(kampagneId),
      this._loadCreators(),
      this._loadCurrentCreator(creatorId),
      this._loadAuftragKampagneArt(kampagneId),
      this._loadAlleKampagneArtTypen(),
      this._loadAndereKooperationen(kampagneId, kooperationId),
      this._loadKooperationVideos(kooperationId),
      this._loadTagTypen(),
      this._loadKoopTags(kooperationId)
    ]);

    const t1 = performance.now();
    console.log(`✅ KooperationEditLoader: Alle Daten geladen in ${Math.round(t1 - t0)}ms`);

    const kampagnenartenOptions = this._resolveKampagnenartenOptions(auftragArten, alleKampagneArtTypen);

    const readonlyLabels = {
      unternehmen: unternehmen?.firmenname || 'Unternehmen',
      marke: marke?.markenname || 'Keine Marke',
      kampagne: kampagne?.kampagnenname || kampagne?.eigener_name || 'Kampagne'
    };
    this._setReadonlyField(form, 'unternehmen_id', unternehmenId, readonlyLabels.unternehmen);
    this._setReadonlyField(form, 'marke_id', markeId, readonlyLabels.marke, !markeId);
    this._setReadonlyField(form, 'kampagne_id', kampagneId, readonlyLabels.kampagne);

    this._fillSelectField(form, 'briefing_id', briefings, data?.briefing_id, { displayField: 'product_service_offer' });
    this._fillCreatorField(form, creators, creatorId, currentCreator);

    const totalVideos = this._getKampagneTotalVideos(kampagne);
    const usedVideos = (andereKooperationen || []).reduce((sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 0);
    const remainingVideos = Math.max(0, totalVideos - usedVideos + (parseInt(data?.videoanzahl, 10) || 0));

    this._initVideoStepper(form, data?.videoanzahl, remainingVideos);

    this._renderVideos(form, kooperationVideos, kampagnenartenOptions);

    this._storeContextOnForm(form, {
      kampagnenartenOptions,
      remainingVideos,
      tagTypen,
      koopTags,
      readonlyLabels
    });

    return { success: true, loadTimeMs: Math.round(t1 - t0) };
  }

  // Events binden (Stepper + Video-Rows + Tags + Preise)
  async bindEvents(form, data) {
    const ctx = form._kooperationEditCtx || {};
    const kampagnenartenOptions = ctx.kampagnenartenOptions || [];

    // Readonly auf searchable-select-Container anwenden (Container existiert jetzt erst)
    this._applyReadonlyToSearchableContainer(form, 'unternehmen_id', ctx.readonlyLabels?.unternehmen);
    this._applyReadonlyToSearchableContainer(form, 'marke_id', ctx.readonlyLabels?.marke, !data?.marke_id);
    this._applyReadonlyToSearchableContainer(form, 'kampagne_id', ctx.readonlyLabels?.kampagne);

    // Für die normalen Edit-Selects (briefing_id, creator_id) den searchable-Container mit dem
    // aktuellen Wert synchronisieren. initializeSearchableSelects setzt Hidden+Label nicht zuverlässig,
    // wenn der select-slice(1)-Trick Options ohne selected-Flag überträgt.
    this._syncSearchableContainerValue(form, 'briefing_id');
    this._syncSearchableContainerValue(form, 'creator_id');

    const videoInput = form.querySelector('input[name="videoanzahl"]');
    const videosList = form.querySelector('.videos-list');
    const videosContainer = form.querySelector('.videos-container');
    const contentArtOptions = (() => {
      try {
        return videosContainer?.dataset?.options ? JSON.parse(videosContainer.dataset.options) : [];
      } catch (_) { return []; }
    })();

    const recalcAllPrices = makeRecalcAllPrices(form, videosList);

    videosList?.querySelectorAll('.video-item').forEach(el => {
      el.querySelector('.video-ek-input')?.addEventListener('input', recalcAllPrices);
      el.querySelector('.video-vk-input')?.addEventListener('input', recalcAllPrices);
    });
    // Initialen Recalc NICHT triggern — DB-Werte sind bereits korrekt in den Feldern,
    // und AutoCalculation feuert sonst 4 Durchläufe (sichtbares Flicker).

    attachVideoStepper(form, { videoInput, videosList, contentArtOptions, kampagnenartenOptions, recalcAllPrices });

    if (videosList) {
      videosList.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.video-item-remove');
        if (!removeBtn) return;
        const item = removeBtn.closest('.video-item');
        if (item) {
          item.remove();
          const count = videosList.querySelectorAll('.video-item').length;
          videoInput.value = String(count || '');
          refreshStepperUI(videoInput);
          recalcAllPrices();
          videosList.querySelectorAll('.video-item-number').forEach((el, i) => {
            el.textContent = `Video ${i + 1}`;
          });
        }
      });
    }

    // Tags mit bereits geladenen Daten initialisieren — spart 2 redundante Queries
    const selectedTags = (ctx.koopTags || [])
      .map(kt => {
        const typ = (ctx.tagTypen || []).find(t => String(t.id) === String(kt.tag_id));
        return typ ? { id: typ.id, name: typ.name } : null;
      })
      .filter(Boolean);
    await setupKooperationTags(form, {
      allTags: ctx.tagTypen || [],
      selectedTags
    });
  }

  // ===== Private Daten-Loader (parallel via Promise.all) =====

  async _loadUnternehmen(unternehmenId) {
    if (!unternehmenId || !window.supabase) return null;
    const { data } = await window.supabase
      .from('unternehmen')
      .select('id, firmenname')
      .eq('id', unternehmenId)
      .single();
    return data;
  }

  async _loadMarke(markeId) {
    if (!markeId || !window.supabase) return null;
    const { data } = await window.supabase
      .from('marke')
      .select('id, markenname')
      .eq('id', markeId)
      .single();
    return data;
  }

  async _loadKampagne(kampagneId) {
    if (!kampagneId || !window.supabase) return null;
    const { data } = await window.supabase
      .from('kampagne')
      .select('id, kampagnenname, eigener_name, auftrag_id, videoanzahl, ugc_pro_paid_video_anzahl, ugc_pro_organic_video_anzahl, ugc_video_paid_video_anzahl, ugc_video_organic_video_anzahl, influencer_video_anzahl, vor_ort_video_anzahl, ugc_video_anzahl, igc_video_anzahl')
      .eq('id', kampagneId)
      .single();
    return data;
  }

  async _loadBriefings(kampagneId) {
    if (!kampagneId || !window.supabase) return [];
    const { data } = await window.supabase
      .from('briefings')
      .select('id, product_service_offer')
      .eq('kampagne_id', kampagneId)
      .order('product_service_offer');
    return data || [];
  }

  async _loadCreators() {
    if (!window.supabase) return [];
    const { data } = await window.supabase
      .from('creator')
      .select('id, vorname, nachname, umsatzsteuerpflichtig')
      .order('nachname');
    return data || [];
  }

  async _loadCurrentCreator(creatorId) {
    if (!creatorId || !window.supabase) return null;
    const { data } = await window.supabase
      .from('creator')
      .select('id, vorname, nachname, umsatzsteuerpflichtig')
      .eq('id', creatorId)
      .single();
    return data;
  }

  async _loadAuftragKampagneArt(kampagneId) {
    if (!kampagneId || !window.supabase) return [];
    const { data } = await window.supabase
      .from('kampagne')
      .select('auftrag_id')
      .eq('id', kampagneId)
      .single();
    const auftragId = data?.auftrag_id;
    if (!auftragId) return [];
    const { data: arten } = await window.supabase
      .from('auftrag_kampagne_art')
      .select('kampagne_art_id, kampagne_art_typen:kampagne_art_id(name)')
      .eq('auftrag_id', auftragId);
    return arten || [];
  }

  async _loadAlleKampagneArtTypen() {
    if (!window.supabase) return [];
    const { data } = await window.supabase
      .from('kampagne_art_typen')
      .select('id, name')
      .order('sort_order', { ascending: true });
    return data || [];
  }

  async _loadAndereKooperationen(kampagneId, currentKoopId) {
    if (!kampagneId || !window.supabase) return [];
    let query = window.supabase
      .from('kooperationen')
      .select('id, videoanzahl')
      .eq('kampagne_id', kampagneId);
    if (currentKoopId) query = query.neq('id', currentKoopId);
    const { data } = await query;
    return data || [];
  }

  async _loadKooperationVideos(koopId) {
    if (!koopId || !window.supabase) return [];
    const { data } = await window.supabase
      .from('kooperation_videos')
      .select('id, content_art, kampagnenart, einkaufspreis_netto, verkaufspreis_netto, titel, asset_url, kommentar, position')
      .eq('kooperation_id', koopId)
      .order('position', { ascending: true });
    return data || [];
  }

  async _loadTagTypen() {
    if (!window.supabase) return [];
    const { data } = await window.supabase
      .from('kooperation_tag_typen')
      .select('id, name')
      .order('name');
    return data || [];
  }

  async _loadKoopTags(koopId) {
    if (!koopId || !window.supabase) return [];
    const { data } = await window.supabase
      .from('kooperation_tags')
      .select('tag_id')
      .eq('kooperation_id', koopId);
    return data || [];
  }

  // ===== Felder befüllen =====

  // Unternehmen/Marke/Kampagne als readonly disabled-Select + Hidden Input darstellen.
  // WICHTIG: Der searchable-select-Container existiert hier noch nicht — der Readonly-Replace
  // passiert später in bindEvents() nach initializeSearchableSelects().
  _setReadonlyField(form, fieldName, value, label, isEmpty = false) {
    const select = form.querySelector(`select[name="${fieldName}"]`);
    if (!select) return;

    // Platzhalter als erste Option (wird vom searchable-select via slice(1) übersprungen)
    // DANACH die eigentliche (selected) Option
    if (isEmpty) {
      select.innerHTML = `<option value="">${label}</option>`;
    } else {
      select.innerHTML = `<option value="">Bitte wählen...</option><option value="${value}" selected>${label}</option>`;
      select.value = value;
    }
    // Select NICHT disablen (disabled Selects werden nicht submittet).
    // Stattdessen readonly-Markierung + Hidden-Input für Submit.
    select.dataset.readonly = 'true';
    select.dataset.readonlyValue = isEmpty ? '' : value;

    let hidden = select.parentNode.querySelector(`input[type="hidden"][name="${fieldName}"]`);
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = fieldName;
      select.parentNode.insertBefore(hidden, select);
    }
    hidden.value = isEmpty ? '' : value;

    // Select unsichtbar (Hidden-Input übernimmt Submit, Searchable-Container-Display bleibt sichtbar)
    select.style.display = 'none';

    const formGroup = select.closest('.form-group');
    if (formGroup) {
      formGroup.classList.add('form-field--readonly');
      const lbl = formGroup.querySelector('label');
      if (lbl && !lbl.textContent.includes('(fixiert)')) {
        lbl.textContent += ' (fixiert)';
      }
    }
  }

  // Nach initializeSearchableSelects: den searchable-Container readonly schalten.
  _applyReadonlyToSearchableContainer(form, fieldName, label, isEmpty = false) {
    const select = form.querySelector(`select[name="${fieldName}"]`);
    if (!select) return;
    const container = select.parentNode.querySelector('.searchable-select-container');
    if (!container) return;

    const input = container.querySelector('.searchable-select-input');
    if (input) {
      input.value = isEmpty ? '' : (label || '');
      input.placeholder = isEmpty ? (label || '') : '';
      input.disabled = true;
      input.readOnly = true;
      input.classList.add('is-disabled');
    }
    const dropdown = container.querySelector('.searchable-select-dropdown');
    if (dropdown) dropdown.classList.remove('show');
    container.classList.add('readonly-locked');
    container.style.pointerEvents = 'none';
    container.style.opacity = '0.7';

    // WICHTIG: Das Searchable-Select legt selbst einen Hidden-Input mit gleichem Namen an.
    // Dieser könnte unseren Submit-Wert überschreiben. Stelle sicher, dass er den richtigen Wert hat.
    const searchableHidden = container.querySelector(`input[type="hidden"][name="${fieldName}"]`);
    if (searchableHidden) {
      const correctValue = select.dataset.readonlyValue || '';
      searchableHidden.value = correctValue;
      // Entferne den äußeren Hidden-Input (den ich in _setReadonlyField eingefügt habe),
      // damit es keine Doppel-Submits gibt.
      const outerHidden = Array.from(select.parentNode.querySelectorAll(`input[type="hidden"][name="${fieldName}"]`))
        .find(el => el !== searchableHidden);
      if (outerHidden) outerHidden.remove();
    }
  }

  // Normales Select-Feld (z.B. briefing_id) mit Optionen befüllen
  _fillSelectField(form, fieldName, rows, selectedValue, { displayField = 'name', valueField = 'id' } = {}) {
    const select = form.querySelector(`select[name="${fieldName}"]`);
    if (!select) return;

    select.innerHTML = '<option value="">Bitte wählen...</option>';
    rows.forEach(row => {
      const opt = document.createElement('option');
      opt.value = row[valueField];
      opt.textContent = row[displayField] || 'Unbenannt';
      if (row[valueField] === selectedValue) opt.selected = true;
      select.appendChild(opt);
    });
    if (selectedValue) select.value = selectedValue;

    const container = select.parentNode.querySelector('.searchable-select-container');
    if (container) {
      const input = container.querySelector('.searchable-select-input');
      const selectedOpt = rows.find(r => r[valueField] === selectedValue);
      if (input && selectedOpt) input.value = selectedOpt[displayField] || '';
      const hiddenInput = container.querySelector('input[type="hidden"]');
      if (hiddenInput) hiddenInput.value = selectedValue || '';
    }
  }

  // Creator-Feld befüllen + EK-USt-Satz anhand currentCreator setzen
  _fillCreatorField(form, creators, selectedValue, currentCreator) {
    const select = form.querySelector('select[name="creator_id"]');
    if (!select) return;

    select.innerHTML = '<option value="">Bitte wählen...</option>';
    creators.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.vorname || ''} ${c.nachname || ''}`.trim() || 'Unbekannt';
      if (c.id === selectedValue) opt.selected = true;
      select.appendChild(opt);
    });
    if (selectedValue) select.value = selectedValue;

    const container = select.parentNode.querySelector('.searchable-select-container');
    if (container) {
      const input = container.querySelector('.searchable-select-input');
      const selected = creators.find(c => c.id === selectedValue);
      if (input && selected) input.value = `${selected.vorname || ''} ${selected.nachname || ''}`.trim();
      const hiddenInput = container.querySelector('input[type="hidden"]');
      if (hiddenInput) hiddenInput.value = selectedValue || '';
    }

    if (currentCreator) {
      const ustProzent = currentCreator.umsatzsteuerpflichtig === false ? 0 : 19;
      const ustProzentField = form.querySelector('[name="einkaufspreis_ust_prozent"]');
      if (ustProzentField) ustProzentField.value = String(ustProzent);
      const ustLabel = form.querySelector('[name="einkaufspreis_ust"]')?.closest('.form-field')?.querySelector('label');
      if (ustLabel) ustLabel.textContent = `Einkaufspreis USt (${ustProzent}%)`;
    }
  }

  // ===== Video-Logik (ohne Kaskade) =====

  _getKampagneTotalVideos(kampagne) {
    if (!kampagne) return 0;
    const newSum =
      (parseInt(kampagne.ugc_pro_paid_video_anzahl, 10) || 0) +
      (parseInt(kampagne.ugc_pro_organic_video_anzahl, 10) || 0) +
      (parseInt(kampagne.ugc_video_paid_video_anzahl, 10) || 0) +
      (parseInt(kampagne.ugc_video_organic_video_anzahl, 10) || 0) +
      (parseInt(kampagne.influencer_video_anzahl, 10) || 0) +
      (parseInt(kampagne.vor_ort_video_anzahl, 10) || 0);
    const legacy =
      (parseInt(kampagne.ugc_video_anzahl, 10) || 0) +
      (parseInt(kampagne.igc_video_anzahl, 10) || 0) +
      (parseInt(kampagne.influencer_video_anzahl, 10) || 0) +
      (parseInt(kampagne.vor_ort_video_anzahl, 10) || 0);
    return newSum || legacy || (kampagne.videoanzahl ?? 0);
  }

  // Kampagnenarten-Options aus auftrag_kampagne_art oder Fallback auf alle
  _resolveKampagnenartenOptions(auftragArten, alleTypen) {
    if (auftragArten && auftragArten.length > 0) {
      const namen = auftragArten
        .map(a => a.kampagne_art_typen?.name)
        .filter(Boolean);
      if (namen.length > 0) return namen;
    }
    return (alleTypen || []).map(t => t.name).filter(Boolean);
  }

  _initVideoStepper(form, currentValue, remaining) {
    const videoInput = form.querySelector('input[name="videoanzahl"]');
    if (!videoInput) return;
    videoInput.disabled = remaining === 0;
    videoInput.min = remaining > 0 ? '1' : '0';
    videoInput.max = String(remaining);
    videoInput.step = '1';
    if (currentValue !== undefined && currentValue !== null) {
      videoInput.value = String(currentValue);
    }
  }

  // Bestehende Videos direkt rendern (keine setTimeout-Kaskade)
  _renderVideos(form, videos, kampagnenartenOptions) {
    const videosList = form.querySelector('.videos-list');
    const videosContainer = form.querySelector('.videos-container');
    if (!videosList) return;

    const contentArtOptions = (() => {
      try {
        return videosContainer?.dataset?.options ? JSON.parse(videosContainer.dataset.options) : [];
      } catch (_) { return []; }
    })();

    videosList.innerHTML = '';
    (videos || []).forEach(v => addVideoRow(videosList, contentArtOptions, v, kampagnenartenOptions, null));

    videosList.querySelectorAll('.video-kampagnenart-select').forEach(sel => {
      const selectedValue = sel.dataset.initialValue || '';
      sel.innerHTML = buildVideoSelectOptions(kampagnenartenOptions, selectedValue);
      if (selectedValue) sel.value = selectedValue;
    });
  }

  // Synct den searchable-Container (Input-Label + Hidden-Input) mit dem aktuellen Select-Value.
  _syncSearchableContainerValue(form, fieldName) {
    const select = form.querySelector(`select[name="${fieldName}"]`);
    if (!select) return;
    const container = select.parentNode.querySelector('.searchable-select-container');
    if (!container) return;

    const currentValue = select.value || '';
    const currentOption = Array.from(select.options).find(o => o.value === currentValue);
    const currentLabel = currentOption ? currentOption.textContent : '';

    const input = container.querySelector('.searchable-select-input');
    if (input && currentValue) input.value = currentLabel;

    const hiddenInput = container.querySelector(`input[type="hidden"][name="${fieldName}"]`);
    if (hiddenInput) hiddenInput.value = currentValue;
  }

  _storeContextOnForm(form, ctx) {
    form._kooperationEditCtx = ctx;
  }
}
