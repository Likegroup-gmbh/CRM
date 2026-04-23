// EditModeSelectedHelper.js
// Generische Helpers zum Markieren von Optionen als selected im Edit-Mode.
// Werden aus DirectQueryLoader.js aufgerufen.

// Edit-Mode: Bestehende Werte als "selected" markieren (aus loadDirectQueryOptions extrahiert)
// Behandelt: Kampagne/Auftrag/Kooperation/Rechnung Single+Multi-Selects, Ansprechpartner, Creator,
// existingUnternehmenId/existingBrancheId/existingMarkeId/existingAuftragId datasets.
export async function applyEditModeSelectedForDirectQuery(field, form, options) {
  if (form.dataset.isEditMode !== 'true') return;

  console.log('🔍 DYNAMICDATALOADER: Edit-Modus erkannt für Feld:', field.name, {
    entityType: form.dataset.entityType,
    hasEditModeData: !!form.dataset.editModeData
  });

  const entityType = form.dataset.entityType;
  const coreEntities = ['kampagne', 'auftrag', 'kooperation', 'rechnung'];
  if (coreEntities.includes(entityType) && form.dataset.editModeData) {
    try {
      const editData = JSON.parse(form.dataset.editModeData);

      const simpleSingleSelectFields = [
        'unternehmen_id', 'marke_id', 'auftrag_id', 'status_id', 'drehort_typ_id',
        'kampagne_typ', 'ansprechpartner_id', 'status', 'kampagne_id',
        'briefing_id', 'creator_id', 'kooperation_id'
      ];

      if (simpleSingleSelectFields.includes(field.name) && editData[field.name]) {
        options.forEach(option => {
          if (option.value === editData[field.name]) {
            option.selected = true;
          }
        });
        console.log(`✅ DYNAMICDATALOADER: ${entityType} ${field.name} vorausgewählt:`, editData[field.name]);
      }

      if (field.name === 'creator_id' && editData.creator_id && entityType === 'kooperation') {
        try {
          const { data: creatorUst } = await window.supabase
            .from('creator')
            .select('umsatzsteuerpflichtig')
            .eq('id', editData.creator_id)
            .single();
          const ustProzent = creatorUst?.umsatzsteuerpflichtig === false ? 0 : 19;
          const ustProzentField = form.querySelector('[name="einkaufspreis_ust_prozent"]');
          if (ustProzentField) ustProzentField.value = String(ustProzent);
          const ustLabel = form.querySelector('[name="einkaufspreis_ust"]')?.closest('.form-field')?.querySelector('label');
          if (ustLabel) ustLabel.textContent = `Einkaufspreis USt (${ustProzent}%)`;
          if (window.formSystem?.autoCalculation) {
            window.formSystem.autoCalculation.recalculateAllDependentFields(form);
          }
        } catch (e) {
          console.warn('⚠️ Konnte Creator-USt-Status im Edit-Mode nicht laden:', e);
        }
      }

      const multiSelectFields = {
        'ansprechpartner_ids': editData.ansprechpartner_ids || editData.ansprechpartner || [],
        'mitarbeiter_ids': editData.mitarbeiter_ids || editData.mitarbeiter || [],
        'pm_ids': editData.pm_ids || editData.projektmanager || [],
        'scripter_ids': editData.scripter_ids || editData.scripter || [],
        'cutter_ids': editData.cutter_ids || editData.cutter || [],
        'copywriter_ids': editData.copywriter_ids || editData.copywriter || [],
        'strategie_ids': editData.strategie_ids || editData.strategie || [],
        'creator_sourcing_ids': editData.creator_sourcing_ids || editData.creator_sourcing || [],
        'art_der_kampagne': editData.art_der_kampagne || editData.kampagnenarten || [],
        'plattform_ids': editData.plattform_ids || editData.plattformen || [],
        'format_ids': editData.format_ids || editData.formate || [],
        'paid_ziele_ids': editData.paid_ziele_ids || editData.paid_ziele || [],
        'organic_ziele_ids': editData.organic_ziele_ids || editData.organic_ziele || []
      };

      console.log(`🔍 DYNAMICDATALOADER: Multi-Select Check für ${field.name}:`, {
        hasField: !!multiSelectFields[field.name],
        fieldData: multiSelectFields[field.name],
        editDataKey: field.name in editData ? editData[field.name] : 'nicht vorhanden'
      });

      if (multiSelectFields[field.name]) {
        const existingIds = Array.isArray(multiSelectFields[field.name])
          ? multiSelectFields[field.name]
          : [multiSelectFields[field.name]];

        const ids = existingIds.map(item =>
          typeof item === 'object' && item !== null ? item.id : item
        ).filter(Boolean);

        if (ids.length > 0) {
          options.forEach(option => {
            if (ids.includes(option.value)) {
              option.selected = true;
            }
          });
          console.log(`✅ DYNAMICDATALOADER: ${entityType} ${field.name} vorausgewählt:`, ids);
        }
      }
    } catch (e) {
      console.warn(`⚠️ DYNAMICDATALOADER: Fehler beim Laden der ${entityType} Edit-Daten für ${field.name}:`, e);
    }
  }

  if (entityType === 'ansprechpartner' && form.dataset.editModeData) {
    const singleMarkFields = ['position_id', 'sprache_id'];
    if (singleMarkFields.includes(field.name)) {
      try {
        const editData = JSON.parse(form.dataset.editModeData);
        const existingId = editData[field.name];
        if (existingId) {
          options.forEach(option => { if (option.value === existingId) option.selected = true; });
          console.log(`✅ DYNAMICDATALOADER: ${field.name} vorausgewählt:`, existingId);
        }
      } catch (err) {
        console.warn(`⚠️ ${field.name}-Vorauswahl fehlgeschlagen:`, err?.message);
      }
    }
  }

  if (entityType === 'creator' && form.dataset.editModeData) {
    try {
      const editData = JSON.parse(form.dataset.editModeData);

      const creatorMultiSelectFields = {
        'sprachen_ids': editData.sprachen_ids || editData.sprachen || [],
        'branche_ids': editData.branche_ids || editData.branchen || [],
        'creator_type_ids': editData.creator_type_ids || editData.creator_types || []
      };

      if (creatorMultiSelectFields[field.name]) {
        const existingIds = Array.isArray(creatorMultiSelectFields[field.name])
          ? creatorMultiSelectFields[field.name]
          : [creatorMultiSelectFields[field.name]];

        const ids = existingIds.map(item =>
          typeof item === 'object' && item !== null ? item.id : item
        ).filter(Boolean);

        if (ids.length > 0) {
          options.forEach(option => {
            if (ids.includes(option.value)) {
              option.selected = true;
            }
          });
          console.log(`✅ DYNAMICDATALOADER: Creator ${field.name} vorausgewählt:`, ids);
        }
      }
    } catch (e) {
      console.warn(`⚠️ DYNAMICDATALOADER: Fehler beim Laden der Creator Edit-Daten für ${field.name}:`, e);
    }
  }

  const existingMarkers = [
    { fieldName: 'unternehmen_id', datasetKey: 'existingUnternehmenId', emoji: '🏢', label: 'Unternehmen' },
    { fieldName: 'branche_id', datasetKey: 'existingBrancheId', emoji: '🏷️', label: 'Branche' },
    { fieldName: 'marke_id', datasetKey: 'existingMarkeId', emoji: '🏷️', label: 'Marke' },
    { fieldName: 'auftrag_id', datasetKey: 'existingAuftragId', emoji: '📋', label: 'Auftrag' }
  ];

  for (const marker of existingMarkers) {
    if (field.name === marker.fieldName && form.dataset[marker.datasetKey]) {
      const existingId = form.dataset[marker.datasetKey];
      console.log(`${marker.emoji} DYNAMICDATALOADER: Markiere bestehende ${marker.label} als selected:`, existingId);

      options.forEach(option => {
        if (option.value === existingId) {
          option.selected = true;
          console.log(`✅ DYNAMICDATALOADER: ${marker.label} gefunden und markiert:`, option.label);
        }
      });
    }
  }

  const selectedOptions = options.filter(o => o.selected);
  if (selectedOptions.length > 0) {
    console.log('🎯 DYNAMICDATALOADER: Selected Optionen für', field.name, ':', selectedOptions.map(o => o.label));
  }
}

// Branchen aus Junction-Table laden und als selected markieren (Unternehmen/Marke Edit-Mode)
export async function applyBrancheJunctionSelected(field, form, options) {
  if (field.name !== 'branche_id') return;
  if (!form.dataset.entityId) return;
  if (!['unternehmen', 'marke'].includes(form.dataset.entityType)) return;

  try {
    const entityId = form.dataset.entityId;
    console.log('🔍 DYNAMICDATALOADER: Lade bestehende Branchen für Unternehmen:', entityId);
    console.log('🔍 DYNAMICDATALOADER: Form Datasets verfügbar:', {
      entityId: form.dataset.entityId,
      isEditMode: form.dataset.isEditMode,
      editModeData: !!form.dataset.editModeData,
      existingBranchenIds: !!form.dataset.existingBranchenIds
    });

    let branchenIds = [];
    if (form.dataset.editModeData) {
      try {
        const editData = JSON.parse(form.dataset.editModeData);
        if (editData.branche_id && Array.isArray(editData.branche_id)) {
          branchenIds = editData.branche_id;
          console.log('📋 Verwende Branchen-IDs aus Edit-Mode Daten:', branchenIds);
        }
      } catch (parseError) {
        console.warn('⚠️ Fehler beim Parsen der Edit-Mode Daten:', parseError);
      }
    }

    if (branchenIds.length === 0) {
      console.log('🔄 Lade Branchen-IDs aus Junction Table...');

      const entityType = form.dataset.entityType;
      const tableName = entityType === 'marke' ? 'marke_branchen' : 'unternehmen_branchen';
      const entityIdField = entityType === 'marke' ? 'marke_id' : 'unternehmen_id';

      console.log('🔍 DYNAMICDATALOADER: Lade aus Junction Table:', tableName, 'mit', entityIdField, '=', entityId);

      const { data: branchenData, error } = await window.supabase
        .from(tableName)
        .select('branche_id')
        .eq(entityIdField, entityId);

      if (!error && branchenData && branchenData.length > 0) {
        branchenIds = branchenData.map(b => b.branche_id);
        console.log('📋 Bestehende Branchen-IDs aus Junction Table:', branchenIds);
      }
    }

    if (branchenIds.length > 0) {
      branchenIds.forEach(brancheId => {
        const option = options.find(opt => opt.value === brancheId);
        if (option) {
          option.selected = true;
          console.log('✅ Branche als ausgewählt markiert:', option.label, option.value);
        } else {
          console.warn('⚠️ Branche-Option nicht in verfügbaren Optionen gefunden:', brancheId);
        }
      });

      console.log('✅ Insgesamt', branchenIds.length, 'Branchen als ausgewählt markiert');
    } else {
      console.log('ℹ️ Keine bestehenden Branchen für Unternehmen gefunden');
    }
  } catch (error) {
    console.error('❌ Fehler beim Laden der bestehenden Branchen:', error);
  }
}

// Bestehende Verknüpfungen aus relationTable laden und markieren (Edit-Modus)
export async function applyRelationTableSelected(field, form, options) {
  if (!form.dataset.entityId || !field.relationTable || !field.relationField) return;

  const entityId = form.dataset.entityId;
  let entityField;

  if (form.dataset.entityType === 'unternehmen' && field.relationTable === 'mitarbeiter_unternehmen') {
    entityField = 'unternehmen_id';
  } else if (form.dataset.entityType === 'marke' && field.relationTable === 'marke_mitarbeiter') {
    entityField = 'marke_id';
  } else if (field.name === 'mitarbeiter_ids') {
    entityField = 'kampagne_id';
  } else if (field.name === 'plattform_ids') {
    entityField = 'kampagne_id';
  } else if (field.name === 'format_ids') {
    entityField = 'kampagne_id';
  } else if (form.dataset.entityType === 'ansprechpartner' && field.name === 'marke_ids') {
    entityField = 'ansprechpartner_id';
  } else if (form.dataset.entityType === 'ansprechpartner' && field.name === 'sprachen_ids') {
    entityField = 'ansprechpartner_id';
  } else {
    entityField = field.name.replace('_ids', '_id');
  }

  let query = window.supabase
    .from(field.relationTable)
    .select(field.relationField)
    .eq(entityField, entityId);

  if (field.roleValue) {
    query = query.eq('role', field.roleValue);
    console.log(`🔍 DYNAMICDATALOADER: Lade ${field.name} mit role=${field.roleValue} für ${form.dataset.entityType}:`, entityId);
  }

  const { data: existingLinks, error: existingError } = await query;

  if (!existingError && existingLinks && existingLinks.length > 0) {
    const selectedIds = existingLinks.map(link => link[field.relationField]);
    console.log(`✅ DYNAMICDATALOADER: Bestehende ${field.name} geladen:`, selectedIds);
    options.forEach(option => {
      if (selectedIds.includes(option.value)) {
        option.selected = true;
      }
    });
  } else if (existingError) {
    console.warn(`⚠️ DYNAMICDATALOADER: Fehler beim Laden von ${field.name}:`, existingError);
  }
}
