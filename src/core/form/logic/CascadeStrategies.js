import { KampagneUtils } from '../../../modules/kampagne/KampagneUtils.js';

function getKampagneTotalVideosSimple(k) {
  const subfieldsSum =
    (parseInt(k.ugc_paid_video_anzahl, 10) || 0) +
    (parseInt(k.ugc_organic_video_anzahl, 10) || 0) +
    (parseInt(k.ugc_pro_paid_video_anzahl, 10) || 0) +
    (parseInt(k.ugc_pro_organic_video_anzahl, 10) || 0) +
    (parseInt(k.ugc_video_paid_video_anzahl, 10) || 0) +
    (parseInt(k.ugc_video_organic_video_anzahl, 10) || 0) +
    (parseInt(k.influencer_video_anzahl, 10) || 0) +
    (parseInt(k.story_video_anzahl, 10) || 0) +
    (parseInt(k.vor_ort_video_anzahl, 10) || 0);
  return subfieldsSum || (k.videoanzahl ?? 0);
}

function getKampagneTotalVideosFull(k) {
  const newSum =
    (parseInt(k.ugc_paid_video_anzahl, 10) || 0) +
    (parseInt(k.ugc_organic_video_anzahl, 10) || 0) +
    (parseInt(k.ugc_pro_paid_video_anzahl, 10) || 0) +
    (parseInt(k.ugc_pro_organic_video_anzahl, 10) || 0) +
    (parseInt(k.ugc_video_paid_video_anzahl, 10) || 0) +
    (parseInt(k.ugc_video_organic_video_anzahl, 10) || 0) +
    (parseInt(k.influencer_video_anzahl, 10) || 0) +
    (parseInt(k.story_video_anzahl, 10) || 0) +
    (parseInt(k.vor_ort_video_anzahl, 10) || 0);
  const legacySum =
    (parseInt(k.ugc_video_anzahl, 10) || 0) +
    (parseInt(k.igc_video_anzahl, 10) || 0) +
    (parseInt(k.influencer_video_anzahl, 10) || 0) +
    (parseInt(k.vor_ort_video_anzahl, 10) || 0);
  return newSum || legacySum || (k.videoanzahl ?? 0);
}

export const cascadeStrategies = {

  'marke_id:unternehmen_id': async (parentValue, form, field, fieldConfig, ctx) => {
    const { data: marken, error } = await window.supabase
      .from('marke')
      .select('id, markenname')
      .eq('unternehmen_id', parentValue)
      .order('markenname');

    if (error) {
      console.error('❌ Fehler beim Laden der Marken:', error);
      return;
    }

    const options = marken.map(marke => ({
      value: marke.id,
      label: marke.markenname
    }));

    if (options.length === 0) {
      const message = 'Dieses Unternehmen hat keine Marke.';
      ctx.setNoOptionsState(field, fieldConfig, message);
      await ctx.loadAuftraegeForUnternehmen(parentValue, form, { disableMarke: true, message });
      return;
    }

    field.disabled = false;
    if (fieldConfig.name === 'marke_ids' && fieldConfig.tagBased) {
      const container = field.closest('.form-field')?.querySelector('.tag-based-select');
      if (container) {
        const input = container.querySelector('.searchable-select-input');
        if (input) {
          input.disabled = false;
          input.placeholder = fieldConfig.placeholder || 'Marken suchen und hinzufügen...';
        }
        try { container.dataset.options = JSON.stringify(options); } catch (err) { /* ignore */ }
      }
      await ctx.updateTagBasedMultiSelectOptions(field, fieldConfig, options);
    } else {
      ctx.updateDependentFieldOptions(field, fieldConfig, options);
    }
  },

  'auftrag_id:marke_id': async (parentValue, form, field, fieldConfig, ctx) => {
    const { data: auftraege, error } = await window.supabase
      .from('auftrag')
      .select('id, auftragsname')
      .eq('marke_id', parentValue)
      .order('auftragsname');

    if (error) {
      console.error('❌ Fehler beim Laden der Aufträge:', error);
      return;
    }

    const options = auftraege.map(auftrag => ({
      value: auftrag.id,
      label: auftrag.auftragsname
    }));

    field.disabled = false;
    ctx.updateDependentFieldOptions(field, fieldConfig, options);
  },

  'auftrag_id:unternehmen_id': async (parentValue, form, field, fieldConfig, ctx) => {
    const markeField = form.querySelector('[name="marke_id"]');
    const markeValue = markeField?.value;

    const { data: alleAuftraege, error: checkError } = await window.supabase
      .from('auftrag')
      .select('id, auftragsname, marke_id')
      .eq('unternehmen_id', parentValue)
      .order('auftragsname');

    if (checkError) {
      console.error('❌ Fehler beim Prüfen der Aufträge:', checkError);
      return;
    }

    const auftraegeOhneMarke = alleAuftraege.filter(a => !a.marke_id);
    const auftraegeMitMarke = alleAuftraege.filter(a => a.marke_id);

    let auftraegeZuZeigen = [];

    if (markeValue) {
      auftraegeZuZeigen = alleAuftraege.filter(a => !a.marke_id || a.marke_id === markeValue);
    } else if (auftraegeOhneMarke.length > 0) {
      auftraegeZuZeigen = auftraegeOhneMarke;
    } else if (auftraegeMitMarke.length > 0) {
      field.disabled = true;
      ctx.updateDependentFieldOptions(field, fieldConfig, []);

      const container = field.nextElementSibling;
      if (container?.classList.contains('searchable-select-container')) {
        const input = container.querySelector('.searchable-select-input');
        if (input) {
          input.placeholder = 'Bitte erst eine Marke auswählen...';
        }
      }
      return;
    }

    const options = auftraegeZuZeigen.map(auftrag => ({
      value: auftrag.id,
      label: auftrag.auftragsname + (auftrag.marke_id ? '' : ' (ohne Marke)')
    }));

    field.disabled = false;

    const container = field.nextElementSibling;
    if (container?.classList.contains('searchable-select-container')) {
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.placeholder = fieldConfig.placeholder || 'Auftrag suchen und auswählen...';
      }
    }

    ctx.updateDependentFieldOptions(field, fieldConfig, options);
  },

  'kampagne_id:marke_id': async (parentValue, form, field, fieldConfig, ctx) => {
    const { data: kampagnen, error } = await window.supabase
      .from('kampagne')
      .select('id, kampagnenname, eigener_name, marke_id, videoanzahl, ugc_paid_video_anzahl, ugc_organic_video_anzahl, ugc_pro_paid_video_anzahl, ugc_pro_organic_video_anzahl, ugc_video_paid_video_anzahl, ugc_video_organic_video_anzahl, influencer_video_anzahl, story_video_anzahl, vor_ort_video_anzahl')
      .eq('marke_id', parentValue)
      .order('kampagnenname');

    if (error) {
      console.error('❌ Fehler beim Laden der Kampagnen für Marke:', error);
      return;
    }

    let filtered = kampagnen || [];
    try {
      const kampagneIds = filtered.map(k => k.id);
      if (kampagneIds.length > 0) {
        const { data: koops, error: koopErr } = await window.supabase
          .from('kooperationen')
          .select('kampagne_id, videoanzahl')
          .in('kampagne_id', kampagneIds);
        if (!koopErr && koops) {
          const usedMap = {};
          koops.forEach(row => {
            const key = row.kampagne_id;
            const val = parseInt(row.videoanzahl, 10) || 0;
            usedMap[key] = (usedMap[key] || 0) + val;
          });
          filtered = filtered.filter(k => {
            const total = getKampagneTotalVideosSimple(k);
            const used = usedMap[k.id] || 0;
            const remaining = Math.max(0, total - used);
            return remaining > 0;
          });
        }
      }
    } catch (e) {
      // Fehler beim Filtern ignorieren, zeige alle Kampagnen
    }

    const options = filtered.map(kampagne => ({
      value: kampagne.id,
      label: KampagneUtils.getDisplayName(kampagne)
    }));

    field.disabled = false;
    ctx.updateDependentFieldOptions(field, fieldConfig, options);
  },

  'kampagne_id:unternehmen_id': async (parentValue, form, field, fieldConfig, ctx) => {
    const isStrategieContext = form?.dataset?.entity === 'strategie' || form?.dataset?.entityType === 'strategie';
    const isSourcingContext = form?.dataset?.entity === 'sourcing' || form?.dataset?.entityType === 'sourcing';
    const markeField = form?.querySelector('[name="marke_id"]');
    const selectedMarkeId = markeField ? ctx.getFieldValue(markeField) : null;

    const { data: kampagnen, error } = await window.supabase
      .from('kampagne')
      .select('id, kampagnenname, eigener_name, unternehmen_id, marke_id, videoanzahl, ugc_paid_video_anzahl, ugc_organic_video_anzahl, ugc_pro_paid_video_anzahl, ugc_pro_organic_video_anzahl, ugc_video_paid_video_anzahl, ugc_video_organic_video_anzahl, influencer_video_anzahl, story_video_anzahl, vor_ort_video_anzahl, ugc_video_anzahl, igc_video_anzahl')
      .eq('unternehmen_id', parentValue)
      .order('kampagnenname');

    if (error) {
      console.error('❌ Fehler beim Laden der Kampagnen für Unternehmen:', error);
      return;
    }

    let currentKampagneId = null;
    if (form && form.dataset.isEditMode === 'true' && form.dataset.editModeData) {
      try {
        const editData = JSON.parse(form.dataset.editModeData);
        currentKampagneId = editData.kampagne_id;
      } catch (e) {
        // Fehler beim Parsen ignorieren
      }
    }

    let filtered = kampagnen || [];

    if (isStrategieContext || isSourcingContext) {
      if (selectedMarkeId) {
        filtered = filtered.filter(k => k.marke_id === selectedMarkeId);
      }

      const allowedKampagneIds = await KampagneUtils.loadAllowedKampagneIds();
      if (Array.isArray(allowedKampagneIds)) {
        const allowedSet = new Set(allowedKampagneIds);
        filtered = filtered.filter(k => allowedSet.has(k.id));
      }

      const options = filtered.map(k => ({ value: k.id, label: KampagneUtils.getDisplayName(k) }));
      field.disabled = false;
      ctx.updateDependentFieldOptions(field, fieldConfig, options);
      return;
    }

    try {
      const kampagneIds = filtered.map(k => k.id);
      if (kampagneIds.length > 0) {
        const { data: koops, error: koopErr } = await window.supabase
          .from('kooperationen')
          .select('kampagne_id, videoanzahl')
          .in('kampagne_id', kampagneIds);
        if (!koopErr && koops) {
          const usedMap = {};
          koops.forEach(row => {
            const key = row.kampagne_id;
            const val = parseInt(row.videoanzahl, 10) || 0;
            usedMap[key] = (usedMap[key] || 0) + val;
          });
          filtered = filtered.filter(k => {
            if (currentKampagneId && k.id === currentKampagneId) {
              return true;
            }
            const total = getKampagneTotalVideosFull(k);
            const used = usedMap[k.id] || 0;
            const remaining = Math.max(0, total - used);
            return remaining > 0;
          });
        }
      }
    } catch (e) {
      // Konnte belegte Videos nicht überprüfen, zeige alle Kampagnen
    }

    const options = filtered.map(k => ({ value: k.id, label: KampagneUtils.getDisplayName(k) }));
    field.disabled = false;
    ctx.updateDependentFieldOptions(field, fieldConfig, options);
  },

  'creator_id:kampagne_id': async (parentValue, form, field, fieldConfig, ctx) => {
    try {
      const { data: allCreators, error } = await window.supabase
        .from('creator')
        .select('id, vorname, nachname, instagram')
        .order('vorname');
      if (error) {
        console.error('❌ Fehler beim Laden aller Creator:', error);
        return;
      }
      const options = (allCreators || [])
        .map(creator => {
          const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim();
          const label = name || (creator.instagram ? `@${creator.instagram}` : `Creator ${creator.id}`);
          return { value: creator.id, label };
        });
      field.disabled = false;
      ctx.updateDependentFieldOptions(field, fieldConfig, options);

      if (!field._ustListenerAttached) {
        field._ustListenerAttached = true;
        field.addEventListener('change', async () => {
          const creatorId = field.value;
          const ustProzentField = form.querySelector('[name="einkaufspreis_ust_prozent"]');
          if (!ustProzentField) return;

          let ustProzent = 19;
          if (creatorId) {
            try {
              const { data: creator } = await window.supabase
                .from('creator')
                .select('umsatzsteuerpflichtig')
                .eq('id', creatorId)
                .single();
              ustProzent = creator?.umsatzsteuerpflichtig === false ? 0 : 19;
            } catch (e) {
              // Konnte Creator-USt-Status nicht laden
            }
          }

          ustProzentField.value = String(ustProzent);

          const ustLabel = form.querySelector('[name="einkaufspreis_ust"]')?.closest('.form-field')?.querySelector('label');
          if (ustLabel) ustLabel.textContent = `Einkaufspreis USt (${ustProzent}%)`;

          if (window.formSystem?.autoCalculation) {
            window.formSystem.autoCalculation.recalculateAllDependentFields(form);
          }
        });
      }
    } catch (e) {
      console.error('❌ Fehler beim Laden aller Creator:', e);
    }
  },

  'briefing_id:kampagne_id': async (parentValue, form, field, fieldConfig, ctx) => {
    try {
      const { data: briefings, error } = await window.supabase
        .from('briefings')
        .select('id, product_service_offer, kampagne_id')
        .eq('kampagne_id', parentValue)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('❌ Fehler beim Laden der Briefings für Kampagne:', error);
        return;
      }
      const options = (briefings || []).map(b => ({
        value: b.id,
        label: b.product_service_offer || `Briefing ${b.id.slice(0, 6)}`
      }));
      field.disabled = false;
      ctx.updateDependentFieldOptions(field, fieldConfig, options);
    } catch (e) {
      console.error('❌ Unerwarteter Fehler beim Laden der Briefings:', e);
    }
  },

  'prefillFromUnternehmen': async (parentValue, form, field, fieldConfig, ctx) => {
    const targetRole = fieldConfig.prefillRole;

    const { data: mitarbeiterRel, error } = await window.supabase
      .from('mitarbeiter_unternehmen')
      .select('mitarbeiter_id, role, benutzer:mitarbeiter_id(id, name)')
      .eq('unternehmen_id', parentValue)
      .eq('role', targetRole);

    if (error) {
      console.error(`❌ Fehler beim Laden der ${targetRole}-Mitarbeiter für Unternehmen:`, error);
      return;
    }

    const roleMitarbeiterIds = (mitarbeiterRel || [])
      .map(rel => rel.mitarbeiter_id)
      .filter(Boolean);

    let mitarbeiterQuery = window.supabase
      .from('benutzer')
      .select('id, name, vorname, nachname, rolle')
      .neq('rolle', 'kunde');

    if (fieldConfig.filterByKlasse) {
      const klasseNames = Array.isArray(fieldConfig.filterByKlasse)
        ? fieldConfig.filterByKlasse
        : [fieldConfig.filterByKlasse];

      const { data: klassenData, error: klassenError } = await window.supabase
        .from('mitarbeiter_klasse')
        .select('id')
        .in('name', klasseNames);

      if (!klassenError && klassenData && klassenData.length > 0) {
        const klassenIds = klassenData.map(k => k.id);
        mitarbeiterQuery = mitarbeiterQuery.or(`rolle.eq.admin,mitarbeiter_klasse_id.in.(${klassenIds.join(',')})`);
      } else {
        mitarbeiterQuery = mitarbeiterQuery.eq('rolle', 'admin');
      }
    }

    const { data: allMitarbeiter } = await mitarbeiterQuery.order('name');

    const options = (allMitarbeiter || []).map(m => {
      const displayName = (m.vorname && m.nachname) ? `${m.vorname} ${m.nachname}` : m.name;
      return {
        value: m.id,
        label: displayName,
        selected: roleMitarbeiterIds.includes(m.id)
      };
    });

    field.disabled = false;

    if (fieldConfig.tagBased && window.formSystem?.optionsManager) {
      window.formSystem.optionsManager.createTagBasedSelect(field, options, fieldConfig);
    } else {
      ctx.updateDependentFieldOptions(field, fieldConfig, options);
    }
  },

  'ansprechpartner_id:unternehmen_id': async (parentValue, form, field, fieldConfig, ctx) => {
    const { data: ansprechpartner, error } = await window.supabase
      .from('ansprechpartner')
      .select('id, vorname, nachname, email, unternehmen_id')
      .eq('unternehmen_id', parentValue)
      .order('nachname');

    if (error) {
      console.error('❌ Fehler beim Laden der Ansprechpartner für Unternehmen:', error);
      return;
    }

    const options = (ansprechpartner || []).map(ap => ({
      value: ap.id,
      label: [ap.vorname, ap.nachname, ap.email].filter(Boolean).join(' | ')
    }));

    if (options.length === 0) {
      ctx.setNoOptionsState(field, fieldConfig, 'Dieses Unternehmen hat keine Ansprechpartner.');
      return;
    }

    ctx.enableSearchableField(field, fieldConfig);
    ctx.updateDependentFieldOptions(field, fieldConfig, options);
  }
};

cascadeStrategies['marke_ids:unternehmen_id'] = cascadeStrategies['marke_id:unternehmen_id'];

export function findStrategy(fieldConfig) {
  if (fieldConfig.dependsOn === 'unternehmen_id' && fieldConfig.prefillFromUnternehmen && fieldConfig.prefillRole) {
    return cascadeStrategies['prefillFromUnternehmen'];
  }
  const key = `${fieldConfig.name}:${fieldConfig.dependsOn}`;
  return cascadeStrategies[key] || null;
}
