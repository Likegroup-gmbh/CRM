// EditModeDataSetter.js
// Edit-Mode Logik für abhängige Felder von Kampagne, Auftrag, Rechnung
// Sowie Marke-Vorausfüllung der Unternehmen-Mitarbeiter.
// Wird als Mixin in DynamicDataLoader verwendet.

// Verbesserte Kampagne Edit-Mode Behandlung
export async function loadKampagneDependentFieldsImproved(field, form, options) {
  try {
    const editModeData = form.dataset.editModeData ? JSON.parse(form.dataset.editModeData) : {};

    if (field.name === 'unternehmen_id' && editModeData.unternehmen_id) {
      console.log('🏢 DYNAMICDATALOADER: Markiere Unternehmen als selected:', editModeData.unternehmen_id);
      console.log('🏢 DYNAMICDATALOADER: Verfügbare Unternehmen-Optionen:', options.length, options);
      let found = false;
      options.forEach(option => {
        if (option.value === editModeData.unternehmen_id) {
          option.selected = true;
          found = true;
          console.log('✅ DYNAMICDATALOADER: Unternehmen gefunden und markiert:', option.label);
        }
      });
      if (!found) {
        console.log('❌ DYNAMICDATALOADER: Unternehmen NICHT in Optionen gefunden! Suche:', editModeData.unternehmen_id);
      }
    }

    if (field.name === 'marke_id' && editModeData.unternehmen_id) {
      console.log('🏢 DYNAMICDATALOADER: Lade Marken für Unternehmen im Kampagne Edit-Modus:', editModeData.unternehmen_id);

      const { data: marken, error } = await window.supabase
        .from('marke')
        .select('id, markenname')
        .eq('unternehmen_id', editModeData.unternehmen_id)
        .order('markenname');

      if (!error && marken) {
        options.length = 0;

        if (marken.length === 0) {
          options.push({
            value: '',
            label: 'Keine Marken für dieses Unternehmen verfügbar',
            selected: true,
            disabled: true,
            style: 'color: #6b7280; font-style: italic;'
          });
          console.log('ℹ️ DYNAMICDATALOADER: Keine Marken für Unternehmen gefunden');
        } else {
          options.push({ value: '', label: 'Marke auswählen...', selected: false });
          marken.forEach(marke => {
            options.push({
              value: marke.id,
              label: marke.markenname,
              selected: marke.id === editModeData.marke_id
            });
          });
          console.log('✅ DYNAMICDATALOADER: Marken-Optionen geladen:', options.length - 1);
        }
      }
    }

    if (field.name === 'auftrag_id' && (editModeData.marke_id || editModeData.unternehmen_id)) {
      let auftraege = [];
      let auftragsTyp = '';

      if (editModeData.marke_id) {
        console.log('🏷️ DYNAMICDATALOADER: Lade Aufträge für Marke im Kampagne Edit-Modus:', editModeData.marke_id);
        auftragsTyp = 'Marke';

        const { data, error } = await window.supabase
          .from('auftrag')
          .select('id, auftragsname')
          .eq('marke_id', editModeData.marke_id)
          .order('auftragsname');

        if (!error && data) auftraege = data;
      } else if (editModeData.unternehmen_id) {
        console.log('🏢 DYNAMICDATALOADER: Lade direkte Aufträge für Unternehmen (keine Marken):', editModeData.unternehmen_id);
        auftragsTyp = 'Unternehmen';

        const { data, error } = await window.supabase
          .from('auftrag')
          .select('id, auftragsname')
          .eq('unternehmen_id', editModeData.unternehmen_id)
          .is('marke_id', null)
          .order('auftragsname');

        if (!error && data) auftraege = data;
      }

      options.length = 0;

      if (auftraege.length === 0) {
        options.push({
          value: '',
          label: `Keine Aufträge für diese ${auftragsTyp} verfügbar`,
          selected: true,
          disabled: true,
          style: 'color: #6b7280; font-style: italic;'
        });
        console.log(`ℹ️ DYNAMICDATALOADER: Keine Aufträge für ${auftragsTyp} gefunden`);
      } else {
        options.push({ value: '', label: 'Auftrag auswählen...', selected: false });
        auftraege.forEach(auftrag => {
          options.push({
            value: auftrag.id,
            label: auftrag.auftragsname,
            selected: auftrag.id === editModeData.auftrag_id
          });
        });
        console.log(`✅ DYNAMICDATALOADER: ${auftragsTyp}-Auftrags-Optionen geladen:`, options.length - 1);
      }
    }

    if (field.name === 'ansprechpartner_id' && editModeData.unternehmen_id) {
      console.log('👤 DYNAMICDATALOADER: Lade Ansprechpartner für Unternehmen im Kampagne Edit-Modus:', editModeData.unternehmen_id);

      const { data: ansprechpartner, error } = await window.supabase
        .from('ansprechpartner')
        .select('id, name')
        .eq('unternehmen_id', editModeData.unternehmen_id)
        .order('name');

      if (!error && ansprechpartner) {
        options.length = 0;

        if (ansprechpartner.length === 0) {
          options.push({
            value: '',
            label: 'Keine Ansprechpartner für dieses Unternehmen verfügbar',
            selected: true,
            disabled: true,
            style: 'color: #6b7280; font-style: italic;'
          });
          console.log('ℹ️ DYNAMICDATALOADER: Keine Ansprechpartner für Unternehmen gefunden');
        } else {
          options.push({ value: '', label: 'Ansprechpartner auswählen...', selected: false });
          ansprechpartner.forEach(ap => {
            options.push({
              value: ap.id,
              label: ap.name,
              selected: ap.id === editModeData.ansprechpartner_id
            });
          });
          console.log('✅ DYNAMICDATALOADER: Ansprechpartner-Optionen geladen:', options.length - 1);
        }
      }
    }
  } catch (error) {
    console.error('❌ DYNAMICDATALOADER: Fehler beim Laden der verbesserten Kampagne-Felder:', error);
  }
}

// Setze Kampagne-Feld als readonly/fixiert
export function setKampagneFieldAsReadonly(field, form) {
  console.log('🔒 DYNAMICDATALOADER: Setze Feld als readonly:', field.name);

  try {
    const label = form.querySelector(`label[for="field-${field.name}"]`);
    if (label && !label.textContent.includes('(fixiert)')) {
      label.textContent += ' (fixiert)';
      label.style.color = '#6b7280';
    }

    const searchableContainer = form.querySelector(`.searchable-select-container[data-field="${field.name}"]`);
    if (searchableContainer) {
      const input = searchableContainer.querySelector('.searchable-select-input');
      if (input) {
        input.disabled = true;
        input.style.backgroundColor = '#f3f4f6';
        input.style.cursor = 'not-allowed';
        input.style.color = '#6b7280';
      }

      searchableContainer.style.opacity = '0.7';
      searchableContainer.style.pointerEvents = 'none';

      const dropdown = searchableContainer.querySelector('.searchable-select-dropdown');
      if (dropdown) {
        dropdown.classList.remove('show');
        dropdown.style.removeProperty('display');
      }
    }

    const select = form.querySelector(`select[name="${field.name}"]`);
    if (select) {
      select.disabled = true;
      select.style.backgroundColor = '#f3f4f6';
      select.style.cursor = 'not-allowed';
    }

    console.log('✅ DYNAMICDATALOADER: Feld als readonly gesetzt:', field.name);
  } catch (error) {
    console.error('❌ DYNAMICDATALOADER: Fehler beim Setzen als readonly:', error);
  }
}

// Lade abhängige Felder für Kampagne im Edit-Modus (alte Methode)
export async function loadKampagneDependentFields(field, form, options) {
  try {
    const editModeData = form.dataset.editModeData ? JSON.parse(form.dataset.editModeData) : {};

    if (field.name === 'marke_id' && editModeData.unternehmen_id) {
      console.log('🏢 DYNAMICDATALOADER: Lade Marken für Unternehmen im Kampagne Edit-Modus:', editModeData.unternehmen_id);

      const { data: marken, error } = await window.supabase
        .from('marke')
        .select('id, markenname')
        .eq('unternehmen_id', editModeData.unternehmen_id)
        .order('markenname');

      if (!error && marken) {
        options.length = 0;
        marken.forEach(marke => {
          options.push({
            value: marke.id,
            label: marke.markenname,
            selected: marke.id === editModeData.marke_id
          });
        });
        console.log('✅ DYNAMICDATALOADER: Marken-Optionen geladen:', options.length);
      }
    }

    if (field.name === 'auftrag_id' && editModeData.marke_id) {
      console.log('🏷️ DYNAMICDATALOADER: Lade Aufträge für Marke im Kampagne Edit-Modus:', editModeData.marke_id);

      const { data: auftraege, error } = await window.supabase
        .from('auftrag')
        .select('id, auftragsname')
        .eq('marke_id', editModeData.marke_id)
        .order('auftragsname');

      if (!error && auftraege) {
        options.length = 0;
        auftraege.forEach(auftrag => {
          options.push({
            value: auftrag.id,
            label: auftrag.auftragsname,
            selected: auftrag.id === editModeData.auftrag_id
          });
        });
        console.log('✅ DYNAMICDATALOADER: Auftrags-Optionen geladen:', options.length);
      }
    }
  } catch (error) {
    console.error('❌ DYNAMICDATALOADER: Fehler beim Laden der Kampagne-abhängigen Felder:', error);
  }
}

// Verbesserte Auftrag Edit-Mode Behandlung
export async function loadAuftragDependentFieldsImproved(field, form, options) {
  try {
    const editModeData = form.dataset.editModeData ? JSON.parse(form.dataset.editModeData) : {};

    if (field.name === 'unternehmen_id' && editModeData.unternehmen_id) {
      console.log('🏢 DYNAMICDATALOADER: Markiere Unternehmen als selected im Auftrag Edit-Modus:', editModeData.unternehmen_id);
      let found = false;
      options.forEach(option => {
        if (option.value === editModeData.unternehmen_id) {
          option.selected = true;
          found = true;
          console.log('✅ DYNAMICDATALOADER: Unternehmen gefunden und markiert:', option.label);
        }
      });
      if (!found) {
        console.warn('⚠️ DYNAMICDATALOADER: Unternehmen nicht in Optionen gefunden:', editModeData.unternehmen_id);
      }
    }

    if (field.name === 'marke_id' && editModeData.marke_id) {
      console.log('🏷️ DYNAMICDATALOADER: Markiere Marke als selected im Auftrag Edit-Modus:', editModeData.marke_id);
      let found = false;
      options.forEach(option => {
        if (option.value === editModeData.marke_id) {
          option.selected = true;
          found = true;
          console.log('✅ DYNAMICDATALOADER: Marke gefunden und markiert:', option.label);
        }
      });
      if (!found) {
        console.warn('⚠️ DYNAMICDATALOADER: Marke nicht in Optionen gefunden:', editModeData.marke_id);
      }
    }

    if (field.name === 'ansprechpartner_id' && editModeData.ansprechpartner_id) {
      console.log('👤 DYNAMICDATALOADER: Markiere Ansprechpartner als selected im Auftrag Edit-Modus:', editModeData.ansprechpartner_id);
      let found = false;
      options.forEach(option => {
        if (option.value === editModeData.ansprechpartner_id) {
          option.selected = true;
          found = true;
          console.log('✅ DYNAMICDATALOADER: Ansprechpartner gefunden und markiert:', option.label);
        }
      });
      if (!found) {
        console.warn('⚠️ DYNAMICDATALOADER: Ansprechpartner nicht in Optionen gefunden:', editModeData.ansprechpartner_id);
      }
    }
  } catch (error) {
    console.error('❌ DYNAMICDATALOADER: Fehler beim Laden der verbesserten Auftrag-Felder:', error);
  }
}

// Rechnung Edit-Mode: Abhängige Felder korrekt laden und vorausfüllen
export async function loadRechnungDependentFieldsImproved(field, form, options) {
  try {
    const editModeData = form.dataset.editModeData ? JSON.parse(form.dataset.editModeData) : {};

    const simpleMarkers = [
      { name: 'kooperation_id', key: 'kooperation_id', emoji: '📦' },
      { name: 'unternehmen_id', key: 'unternehmen_id', emoji: '🏢' },
      { name: 'auftrag_id', key: 'auftrag_id', emoji: '📋' },
      { name: 'kampagne_id', key: 'kampagne_id', emoji: '🎯' },
      { name: 'creator_id', key: 'creator_id', emoji: '👤' },
      { name: 'status', key: 'status', emoji: '📊' }
    ];

    for (const marker of simpleMarkers) {
      if (field.name === marker.name && editModeData[marker.key]) {
        console.log(`${marker.emoji} RECHNUNG EDIT: Markiere ${marker.name} als selected:`, editModeData[marker.key]);
        let found = false;
        options.forEach(option => {
          if (option.value === editModeData[marker.key]) {
            option.selected = true;
            found = true;
            console.log(`✅ RECHNUNG EDIT: ${marker.name} gefunden und markiert:`, option.label);
          }
        });
        if (!found) {
          console.warn(`⚠️ RECHNUNG EDIT: ${marker.name} nicht in Optionen gefunden:`, editModeData[marker.key]);
        }
      }
    }
  } catch (error) {
    console.error('❌ RECHNUNG EDIT: Fehler beim Laden der abhängigen Felder:', error);
  }
}

// Marke: Mitarbeiter vom Unternehmen vorausfüllen
export async function prefillMitarbeiterFromUnternehmen(form, unternehmenId) {
  if (!unternehmenId) return;

  console.log('🔄 DYNAMICDATALOADER: Lade Mitarbeiter vom Unternehmen für Marke:', unternehmenId);

  try {
    const { data: mitarbeiterRel, error } = await window.supabase
      .from('mitarbeiter_unternehmen')
      .select('mitarbeiter_id, role, benutzer:mitarbeiter_id(id, name)')
      .eq('unternehmen_id', unternehmenId);

    if (error) {
      console.error('❌ Fehler beim Laden der Unternehmen-Mitarbeiter:', error);
      return;
    }

    if (!mitarbeiterRel || mitarbeiterRel.length === 0) {
      console.log('ℹ️ Keine Mitarbeiter für Unternehmen gefunden');
      return;
    }

    const mitarbeiterIds = mitarbeiterRel
      .map(rel => rel.mitarbeiter_id)
      .filter(Boolean);

    console.log(`✅ ${mitarbeiterIds.length} Mitarbeiter vom Unternehmen geladen`);

    const mitarbeiterSelect = form.querySelector('[name="mitarbeiter_ids"]');
    if (!mitarbeiterSelect) {
      console.warn('⚠️ mitarbeiter_ids Feld nicht gefunden');
      return;
    }

    const tagContainer = mitarbeiterSelect.closest('.form-group')?.querySelector('.tag-input-container');

    if (tagContainer && window.formSystem?.optionsManager?.createTagBasedSelect) {
      const { data: allMitarbeiter } = await window.supabase
        .from('benutzer')
        .select('id, name')
        .neq('rolle', 'kunde')
        .order('name');

      const options = (allMitarbeiter || []).map(m => ({
        value: m.id,
        label: m.name,
        selected: mitarbeiterIds.includes(m.id)
      }));

      window.formSystem.optionsManager.createTagBasedSelect(mitarbeiterSelect, options, {
        name: 'mitarbeiter_ids',
        tagBased: true,
        placeholder: 'Mitarbeiter suchen...'
      });

      console.log('✅ Mitarbeiter-Feld vorausgefüllt mit', mitarbeiterIds.length, 'Mitarbeitern');
    }
  } catch (error) {
    console.error('❌ Fehler beim Vorausfüllen der Mitarbeiter:', error);
  }
}
