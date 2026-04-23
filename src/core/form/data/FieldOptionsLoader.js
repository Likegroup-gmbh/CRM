// FieldOptionsLoader.js
// Enthält die grossen Dispatcher-Funktionen zum Laden von Feld-Optionen.
// Alle Funktionen werden als Mixin in DynamicDataLoader eingesetzt und erwarten
// `this` als DynamicDataLoader-Instanz (für Zugriff auf cache, dataService, etc.).

import { KampagneUtils } from '../../../modules/kampagne/KampagneUtils.js';

// Feldoptionen laden - grosser Dispatcher je nach Feld-Typ
// `this` = DynamicDataLoader
export async function loadFieldOptions(entity, field, form) {
  try {
    console.log(`🔍 LOADFIELDOPTIONS DEBUG: field.name=${field.name}, field.type=${field.type}`);

    if (field.type === 'phone') {
      console.log(`⏭️ Überspringe Phone-Field ${field.name} in loadFieldOptions - wird von loadPhoneFieldCountries behandelt`);
      return;
    }
    if (field.type === 'country') {
      console.log(`⏭️ Überspringe Country-Field ${field.name} in loadFieldOptions - wird von loadCountryFieldCountries behandelt`);
      return;
    }

    console.log(`📋 LOADFIELDOPTIONS: Starte Laden für ${field.name} (entity: ${entity}, table: ${field.table}, dependsOn: ${field.dependsOn}, prefillFromUnternehmen: ${field.prefillFromUnternehmen})`);

    if (!this.dataService) {
      console.error('❌ DataService ist nicht verfügbar in DynamicDataLoader');
      this.dataService = window.dataService;
    }

    const alwaysLoadFields = ['paid_ziele_ids', 'organic_ziele_ids'];
    const shouldAlwaysLoad = alwaysLoadFields.includes(field.name) || field.prefillFromUnternehmen;

    if (field.dependsOn && !shouldAlwaysLoad) {
      const editEntities = ['kampagne', 'ansprechpartner', 'auftrag', 'kooperation', 'unternehmen', 'marke', 'rechnung'];
      const isEditModeForDependentEntity = form.dataset.isEditMode === 'true' && editEntities.includes(form.dataset.entityType);
      if (!isEditModeForDependentEntity) {
        console.log(`⏭️ Überspringe automatisches Laden für abhängiges Feld: ${field.name} (abhängig von ${field.dependsOn})`);
        return;
      } else {
        console.log(`🎯 Edit-Mode (${form.dataset.entityType}): Lade abhängiges Feld trotzdem: ${field.name}`);
      }
    } else if (shouldAlwaysLoad) {
      console.log(`🎯 Lade Feld ${field.name} immer (${field.prefillFromUnternehmen ? 'prefillFromUnternehmen' : 'statische Lookup-Tabelle'})`);
    }

    let options = [];

    if (entity === 'rechnung' && field.name === 'kooperation_id') {
      options = await loadKooperationIdOptionsForRechnung.call(this, form);
    }
    else if (field.options && Array.isArray(field.options) && !field.dynamic) {
      console.log(`🔧 Verwende statische Optionen für ${field.name}`);
      options = field.options.map(opt => {
        if (typeof opt === 'string') {
          return { value: opt, label: opt };
        } else if (opt && typeof opt === 'object') {
          return { value: opt.value, label: opt.label || opt.value };
        }
        return null;
      }).filter(Boolean);
      console.log(`✅ ${field.name} statische Optionen:`, options.length);
    }
    else if (field.name === 'paid_ziele_ids') {
      console.log(`🎯 Lade Paid-Ziele (immer, unabhängig von dependsOn)`);
      options = await loadZieleOptions('kampagne_paid_ziele_typen');
    }
    else if (field.name === 'organic_ziele_ids') {
      console.log(`🎯 Lade Organic-Ziele (immer, unabhängig von dependsOn)`);
      options = await loadZieleOptions('kampagne_organic_ziele_typen');
    }
    else if (field.table) {
      console.log(`🔧 Lade Daten direkt aus Tabelle ${field.table} für ${field.name}`);
      options = await this.loadDirectQueryOptions(field, form);
      console.log(`✅ ${field.name} Optionen geladen:`, options.length, options.slice(0, 3));
    } else {
      options = await loadSwitchCaseOptions.call(this, entity, field, form);
    }

    if (form.dataset.entityType === 'auftrag' && form.dataset.isEditMode === 'true') {
      await this.loadAuftragDependentFieldsImproved(field, form, options);
    }

    if (form.dataset.entityType === 'rechnung' && form.dataset.isEditMode === 'true') {
      await this.loadRechnungDependentFieldsImproved(field, form, options);
    }

    const selectElement = form.querySelector(`[name="${field.name}"]`);
    if (selectElement) {
      console.log(`🔧 Update Select für ${field.name} mit ${options.length} Optionen`);

      if (selectElement.dataset.tagBased === 'true' && field.tagBased && selectElement.multiple) {
        console.log('🏷️ DYNAMICDATALOADER: Initialisiere Tag-basiertes Multi-Select:', field.name);

        selectElement.innerHTML = '';
        selectElement.appendChild(new Option('', ''));
        options.forEach(option => {
          const optionElement = new Option(option.label, option.value, option.selected, option.selected);
          selectElement.appendChild(optionElement);
        });

        if (window.formSystem?.optionsManager?.createTagBasedSelect) {
          console.log('🏷️ DYNAMICDATALOADER: Erstelle Tag-System mit', options.length, 'Optionen für:', field.name);
          const selectedOptions = options.filter(o => o.selected);
          console.log(`🎯 DYNAMICDATALOADER: Übergebe ${selectedOptions.length} selected Optionen an createTagBasedSelect:`, selectedOptions.map(o => `${o.label} (${o.value})`));
          window.formSystem.optionsManager.createTagBasedSelect(selectElement, options, field);
          console.log('✅ DYNAMICDATALOADER: Tag-basiertes Multi-Select initialisiert für:', field.name);
        } else {
          console.warn('⚠️ DYNAMICDATALOADER: OptionsManager nicht verfügbar für:', field.name);
        }
      } else {
        this.updateSelectOptions(selectElement, options, field);
      }
    } else {
      console.log(`❌ Select-Element nicht gefunden für ${field.name}`);
    }
  } catch (error) {
    console.error(`❌ Fehler beim Laden der Optionen für ${field.name}:`, error);
  }
}

// Rechnung -> Kooperationen ohne bestehende Rechnung (Create + Edit Mode)
async function loadKooperationIdOptionsForRechnung(form) {
  const isEditMode = form.dataset.isEditMode === 'true';
  let options = [];

  if (isEditMode && form.dataset.editModeData) {
    console.log('🔧 Edit-Mode: Lade Kooperationen inkl. aktuelle Kooperation');
    const editData = JSON.parse(form.dataset.editModeData);
    const currentKoopId = editData.kooperation_id;

    options = await this.loadKooperationenOhneRechnung();

    const hasCurrentKoop = options.some(o => o.value === currentKoopId);

    if (!hasCurrentKoop && currentKoopId) {
      console.log('🔧 Aktuelle Kooperation nicht in Liste, lade separat:', currentKoopId);
      const { data: currentKoop } = await window.supabase
        .from('kooperationen')
        .select('id, name, kampagne_id, kampagne:kampagne_id(kampagnenname, eigener_name)')
        .eq('id', currentKoopId)
        .single();

      if (currentKoop) {
        const label = currentKoop.name
          ? `${currentKoop.name} — ${KampagneUtils.getDisplayName(currentKoop.kampagne)}`
          : (KampagneUtils.getDisplayName(currentKoop.kampagne) !== 'Unbenannte Kampagne' ? KampagneUtils.getDisplayName(currentKoop.kampagne) : currentKoop.id);

        options.unshift({
          value: currentKoop.id,
          label: label,
          selected: true
        });
        console.log('✅ Aktuelle Kooperation hinzugefügt:', label);
      }
    } else if (hasCurrentKoop) {
      options.forEach(o => {
        if (o.value === currentKoopId) o.selected = true;
      });
    }
  } else {
    console.log('🔧 Create-Mode: Lade Kooperationen ohne bestehende Rechnung');
    options = await this.loadKooperationenOhneRechnung();
  }
  console.log(`✅ kooperation_id Optionen:`, options.length);
  return options;
}

// Switch-Case Fallback fuer spezielle Felder ohne table-Konfiguration
// `this` = DynamicDataLoader
async function loadSwitchCaseOptions(entity, field, form) {
  let options = [];
  switch (field.name) {
    case 'unternehmen_id': {
      if (!window.supabase) {
        const unternehmen = await this.dataService.loadEntities('unternehmen');
        options = unternehmen.map(u => ({ value: u.id, label: u.firmenname || 'Unbekanntes Unternehmen' }));
        break;
      }
      try {
        const allowedIds = await window.getAllowedUnternehmenIds?.();

        const buildFilteredQuery = async (baseIds = null) => {
          let query = window.supabase
            .from('unternehmen')
            .select('id, firmenname')
            .order('firmenname');

          if (baseIds && baseIds.length > 0) {
            if (allowedIds !== null && allowedIds.length > 0) {
              const intersection = baseIds.filter(id => allowedIds.includes(id));
              if (intersection.length === 0) return [];
              query = query.in('id', intersection);
            } else if (allowedIds !== null && allowedIds.length === 0) {
              return [];
            } else {
              query = query.in('id', baseIds);
            }
          } else if (allowedIds !== null) {
            if (allowedIds.length === 0) return [];
            query = query.in('id', allowedIds);
          }

          const { data, error } = await query;
          if (error) {
            console.error('❌ Fehler beim Laden der Unternehmen:', error);
            return [];
          }
          return (data || []).map(u => ({ value: u.id, label: u.firmenname || 'Unbekanntes Unternehmen' }));
        };

        if (entity === 'kooperation') {
          const { data: kampUnternehmen, error: kampUError } = await window.supabase
            .from('kampagne')
            .select('unternehmen_id')
            .not('unternehmen_id', 'is', null);
          if (kampUError) {
            console.error('❌ Fehler beim Laden der Kampagnen-Unternehmen:', kampUError);
            break;
          }
          const uniqIds = Array.from(new Set((kampUnternehmen || []).map(row => row.unternehmen_id).filter(Boolean)));
          options = await buildFilteredQuery(uniqIds);
        } else if (entity === 'kampagne') {
          const { data: auftragUnternehmen, error: aErr } = await window.supabase
            .from('auftrag')
            .select('unternehmen_id')
            .not('unternehmen_id', 'is', null);
          if (aErr) {
            console.error('❌ Fehler beim Laden der Auftrag-Unternehmen:', aErr);
            break;
          }
          const uniqIds = Array.from(new Set((auftragUnternehmen || []).map(row => row.unternehmen_id).filter(Boolean)));
          options = await buildFilteredQuery(uniqIds);
        } else {
          options = await buildFilteredQuery();
        }
      } catch (e) {
        console.error('❌ Fehler beim Laden der Unternehmen (kontext-spezifisch):', e);
      }
      break;
    }

    case 'auftrag_id': {
      const auftraege = await this.dataService.loadEntities('auftrag');
      options = auftraege.map(a => ({
        value: a.id,
        label: a.auftragsname || 'Unbekannter Auftrag'
      }));
      break;
    }

    case 'creator_id': {
      const creator = await this.dataService.loadEntities('creator');
      options = creator.map(c => ({
        value: c.id,
        label: `${c.vorname} ${c.nachname}` || 'Unbekannter Creator'
      }));
      break;
    }

    case 'kampagne_id': {
      const kampagnen = await this.dataService.loadEntities('kampagne');
      options = kampagnen.map(k => ({
        value: k.id,
        label: KampagneUtils.getDisplayName(k)
      }));
      break;
    }

    case 'creator_type_id': {
      const { data: creatorTypes, error: ctError } = await window.supabase
        .from('creator_type')
        .select('id, name')
        .order('name');

      if (!ctError && creatorTypes) {
        options = creatorTypes.map(ct => ({
          value: ct.id,
          label: ct.name || 'Unbekannter Typ'
        }));
        console.log('✅ Creator Types geladen:', options.length);
      }
      break;
    }

    case 'branche_id': {
      const { data: branchen, error: brError } = await window.supabase
        .from('branchen')
        .select('id, name, beschreibung')
        .order('name');

      if (!brError && branchen) {
        options = branchen.map(s => ({
          value: s.id,
          label: s.name || 'Unbekannte Branche',
          description: s.beschreibung
        }));
        console.log('✅ Branchen geladen:', options.length);
      }
      break;
    }

    case 'assignee_id': {
      const { data: benutzer, error: benError } = await window.supabase
        .from('benutzer')
        .select('id, name')
        .neq('rolle', 'kunde')
        .order('name');

      if (benError) {
        console.error('❌ Fehler beim Laden der Benutzer:', benError);
      } else if (benutzer) {
        options = benutzer.map(b => ({
          value: b.id,
          label: b.name || 'Unbekannter Benutzer'
        }));
        console.log('✅ Benutzer geladen:', options.length, options);
      } else {
        console.warn('⚠️ Keine Benutzer gefunden');
      }
      break;
    }

    case 'art_der_kampagne': {
      const { data: kampagneArtTypen, error: katError } = await window.supabase
        .from('kampagne_art_typen')
        .select('id, name')
        .order('sort_order, name');

      if (!katError && kampagneArtTypen) {
        options = kampagneArtTypen.map(kat => ({
          value: kat.id,
          label: kat.name || 'Unbekannte Art'
        }));
        console.log('✅ Kampagne Art Typen geladen:', options.length);
      }
      break;
    }

    case 'format_anpassung': {
      const { data: formatAnpassungTypen, error: fatError } = await window.supabase
        .from('format_anpassung_typen')
        .select('id, name')
        .order('sort_order, name');

      if (!fatError && formatAnpassungTypen) {
        options = formatAnpassungTypen.map(fat => ({
          value: fat.id,
          label: fat.name || 'Unbekanntes Format'
        }));
        console.log('✅ Format Anpassung Typen geladen:', options.length);
      }
      break;
    }

    case 'mitarbeiter_ids':
    case 'cutter_ids':
    case 'copywriter_ids':
    case 'strategie_ids':
    case 'creator_sourcing_ids': {
      options = await this.loadBenutzerOptions();
      break;
    }

    case 'ansprechpartner_id': {
      options = await this.loadAnsprechpartnerOptions(field, form);
      break;
    }

    default:
      break;
  }
  return options;
}

// Kooperationen ohne hinterlegte Rechnung laden (mit Mitarbeiter-Filterung)
export async function loadKooperationenOhneRechnung() {
  if (!window.supabase) return [];
  try {
    const allowedUnternehmenIds = await window.getAllowedUnternehmenIds?.();
    const isAdmin = allowedUnternehmenIds === null;

    if (!isAdmin && (!allowedUnternehmenIds || allowedUnternehmenIds.length === 0)) {
      console.log('🔐 Keine Unternehmen zugeordnet - keine Kooperationen verfügbar');
      return [];
    }

    const { data: rechnungen, error: rErr } = await window.supabase
      .from('rechnung')
      .select('kooperation_id')
      .not('kooperation_id', 'is', null);
    if (rErr) {
      console.error('❌ Fehler beim Laden vorhandener Rechnungen:', rErr);
      return [];
    }
    const excluded = Array.from(new Set((rechnungen || []).map(r => r.kooperation_id).filter(Boolean)));

    let query = window.supabase
      .from('kooperationen')
      .select('id, name, kampagne_id')
      .order('created_at', { ascending: false });
    if (excluded.length > 0) {
      query = query.not('id', 'in', `(${excluded.join(',')})`);
    }
    const { data: koops, error: kErr } = await query;
    if (kErr) {
      console.error('❌ Fehler beim Laden der Kooperationen (ohne Rechnung):', kErr);
      return [];
    }

    let kampagneMap = {};
    let kampagneUnternehmenMap = {};
    try {
      const kampIds = Array.from(new Set((koops || []).map(k => k.kampagne_id).filter(Boolean)));
      if (kampIds.length > 0) {
        const { data: kamp } = await window.supabase
          .from('kampagne')
          .select('id, kampagnenname, eigener_name, unternehmen_id')
          .in('id', kampIds);
        kampagneMap = (kamp || []).reduce((acc, row) => { acc[row.id] = KampagneUtils.getDisplayName(row); return acc; }, {});
        kampagneUnternehmenMap = (kamp || []).reduce((acc, row) => { acc[row.id] = row.unternehmen_id; return acc; }, {});
      }
    } catch (err) {
      console.warn('⚠️ Fehler beim Laden der Kampagnen-Namen für Kooperationen:', err?.message);
    }

    let filteredKoops = koops || [];
    if (!isAdmin && allowedUnternehmenIds && allowedUnternehmenIds.length > 0) {
      filteredKoops = filteredKoops.filter(k => {
        const unternehmenId = kampagneUnternehmenMap[k.kampagne_id];
        return unternehmenId && allowedUnternehmenIds.includes(unternehmenId);
      });
      console.log(`🔐 Kooperationen gefiltert: ${koops.length} → ${filteredKoops.length} (für ${allowedUnternehmenIds.length} Unternehmen)`);
    }

    return filteredKoops.map(k => ({
      value: k.id,
      label: k.name ? `${k.name} ${k.kampagne_id ? `— ${kampagneMap[k.kampagne_id] || 'Kampagne'}` : ''}` : (kampagneMap[k.kampagne_id] || k.id)
    }));
  } catch (e) {
    console.error('❌ Unerwarteter Fehler beim Laden der kooperation_id Optionen:', e);
    return [];
  }
}

// Benutzeroptionen laden (Mitarbeiter, keine Kunden)
export async function loadBenutzerOptions(filter = {}) {
  if (!window.supabase) return [];
  try {
    let query = window.supabase
      .from('benutzer')
      .select('id, name, vorname, nachname, rolle')
      .neq('rolle', 'kunde')
      .order('name');

    if (filter.role) {
      query = query.eq('rolle', filter.role);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Fehler beim Laden der Benutzer:', error);
      return [];
    }

    return (data || []).map(benutzer => ({
      value: benutzer.id,
      label: `${benutzer.vorname} ${benutzer.nachname} (${benutzer.rolle})`
    }));
  } catch (e) {
    console.error('❌ Unerwarteter Fehler beim Laden der Benutzer-Optionen:', e);
    return [];
  }
}

// Ziele-Optionen aus Lookup-Tabelle laden (statisch, kein Filter)
export async function loadZieleOptions(tableName) {
  if (!window.supabase) return [];
  try {
    const { data, error } = await window.supabase
      .from(tableName)
      .select('id, name')
      .order('sort_order');

    if (error) {
      console.error(`❌ Fehler beim Laden der Ziele aus ${tableName}:`, error);
      return [];
    }

    console.log(`✅ ${(data || []).length} Ziele aus ${tableName} geladen`);
    return (data || []).map(ziel => ({
      value: ziel.id,
      label: ziel.name
    }));
  } catch (e) {
    console.error(`❌ Unerwarteter Fehler beim Laden der Ziele aus ${tableName}:`, e);
    return [];
  }
}

// Ansprechpartneroptionen fuer das aktuell gewaehlte Unternehmen laden
export async function loadAnsprechpartnerOptions(field, form) {
  try {
    const unternehmenSelect = form?.querySelector('select[name="unternehmen_id"]');
    const unternehmenId = unternehmenSelect?.value || null;

    if (!unternehmenId) {
      return [];
    }

    const hiddenSelect = unternehmenSelect.parentNode?.querySelector('select[style*="display: none"]');
    const effectiveUnternehmenId = hiddenSelect && hiddenSelect !== unternehmenSelect
      ? hiddenSelect.value
      : unternehmenId;

    let query = window.supabase
      .from('ansprechpartner')
      .select('id, vorname, nachname, email, unternehmen_id')
      .eq('unternehmen_id', effectiveUnternehmenId)
      .order('nachname');

    const { data, error } = await query;
    if (error) {
      console.error('❌ Fehler beim Laden der Ansprechpartner:', error);
      return [];
    }

    const selectedValue = field?.value || field?.dataset?.value || null;

    return (data || []).map(ap => ({
      value: ap.id,
      label: [ap.vorname, ap.nachname, ap.email].filter(Boolean).join(' | '),
      selected: selectedValue && selectedValue === ap.id
    }));
  } catch (error) {
    console.error('❌ Unerwarteter Fehler beim Laden der Ansprechpartner:', error);
    return [];
  }
}

