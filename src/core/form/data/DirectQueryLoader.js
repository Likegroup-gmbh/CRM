// DirectQueryLoader.js
// Haupt-Data-Loader für dynamische Felder mit `field.table`-Konfiguration.
// Lädt Daten aus Supabase (mit Cache-Support für statische Tabellen)
// und markiert Edit-Mode selected-Werte (via ausgelagerter Helpers).
// Wird als Mixin in DynamicDataLoader eingesetzt, `this` = DynamicDataLoader.

import {
  applyEditModeSelectedForDirectQuery,
  applyBrancheJunctionSelected,
  applyRelationTableSelected
} from './EditModeSelectedHelper.js';

export async function loadDirectQueryOptions(field, form) {
  try {
    if (!field.table) {
      console.warn('⚠️ Keine Tabelle für direktes Laden definiert:', field.name);
      return [];
    }

    const staticTables = [
      'eu_laender',
      'positionen',
      'sprachen',
      'branchen',
      'kampagne_status',
      'plattform_typen',
      'format_typen',
      'format_anpassung_typen',
      'kampagne_art_typen',
      'drehort_typen',
      'creator_type',
      'mitarbeiter_klasse',
      'kampagne_paid_ziele_typen',
      'kampagne_organic_ziele_typen'
    ];

    let data;

    if (field.filterBy) {
      data = await loadFilteredByParent(field, form);
      if (data === null) return [];
    }
    else if (staticTables.includes(field.table) && !field.filter) {
      data = await this.cache.get(field.table, '*', 'sort_order');
      console.log(`📦 ${field.table} aus Cache geladen (${data.length} Einträge)`);
    }
    else if (field.table === 'marke') {
      data = await loadMarkenWithAccessFilter(field);
    }
    else if (field.table === 'unternehmen') {
      data = await loadUnternehmenWithAccessFilter(field);
    }
    else {
      data = await loadGenericTable(field);
      if (data === null) return [];
    }

    const options = data.map(item => mapRowToOption(item, field));

    await applyEditModeSelectedForDirectQuery(field, form, options);

    if (field.name === 'branche_id' && form.dataset.entityId && (form.dataset.entityType === 'unternehmen' || form.dataset.entityType === 'marke')) {
      await applyBrancheJunctionSelected(field, form, options);
    } else if (form.dataset.entityId && field.relationTable && field.relationField) {
      await applyRelationTableSelected(field, form, options);
    }

    if (form.dataset.entityType === 'kampagne' && form.dataset.isEditMode === 'true') {
      await this.loadKampagneDependentFieldsImproved(field, form, options);

      if (['unternehmen_id', 'marke_id', 'auftrag_id', 'ansprechpartner_id'].includes(field.name)) {
        setTimeout(() => {
          this.setKampagneFieldAsReadonly(field, form);
        }, 200);
      }
    }

    if (form.dataset.entityType === 'auftrag' && form.dataset.isEditMode === 'true') {
      await this.loadAuftragDependentFieldsImproved(field, form, options);
    }

    if (form.dataset.entityType === 'rechnung' && form.dataset.isEditMode === 'true') {
      await this.loadRechnungDependentFieldsImproved(field, form, options);
    }

    if (field.type === 'phone' && field.defaultCountry && field.table === 'eu_laender') {
      const hasSelectedValue = options.some(o => o.selected);

      if (!hasSelectedValue) {
        const deutschlandOption = options.find(o =>
          o.label.includes('Deutschland') ||
          o.label.includes('Germany') ||
          o.label.includes('+49')
        );

        if (deutschlandOption) {
          deutschlandOption.selected = true;
          console.log(`✅ DYNAMICDATALOADER: Deutschland als Standard für ${field.name} ausgewählt`);
        }
      }
    }

    if (field.name === 'branche_id') {
      const selectedOptions = options.filter(o => o.selected);
      console.log('🎯 DYNAMICDATALOADER: Final branche_id Optionen:', {
        total: options.length,
        selected: selectedOptions.length,
        selectedValues: selectedOptions.map(o => ({ value: o.value, label: o.label }))
      });
    }

    return options;
  } catch (error) {
    console.error('❌ Fehler beim Laden der direkten Optionen:', error);
    return [];
  }
}

// Laden von Daten, die nach einem Parent-Feld gefiltert werden (field.filterBy)
// Gibt null zurück wenn kein Parent-Wert vorhanden (Caller soll [] zurückgeben).
async function loadFilteredByParent(field, form) {
  const parentField = form.querySelector(`[name="${field.filterBy}"]`);
  let parentValue = parentField?.value;

  if (!parentValue && form.dataset.isEditMode === 'true') {
    try {
      const editModeData = JSON.parse(form.dataset.editModeData || '{}');
      parentValue = editModeData[field.filterBy];
      if (parentValue) {
        console.log(`🔧 ${field.name}: Parent-Wert aus editModeData: ${field.filterBy}=${parentValue}`);
      }
    } catch (e) {
      console.warn('⚠️ Fehler beim Parsen von editModeData:', e);
    }
  }

  if (!parentValue) {
    console.log(`⏸️ ${field.name}: Kein ${field.filterBy} ausgewählt - zeige leere Optionen`);
    return null;
  }

  console.log(`🔍 ${field.name}: Filtere nach ${field.filterBy} = ${parentValue}`);

  let filteredQuery = window.supabase
    .from(field.table)
    .select('*')
    .eq(field.filterBy, parentValue);

  if (field.table === 'vertraege') {
    filteredQuery = filteredQuery.eq('is_draft', false);
  }

  const { data: filteredData, error } = await filteredQuery
    .order(field.displayField || 'name', { ascending: true });

  if (error) {
    console.error(`❌ Fehler beim Laden von ${field.table}:`, error);
    return [];
  }

  const data = filteredData || [];
  console.log(`✅ ${data.length} ${field.table} geladen für ${field.filterBy}=${parentValue}`);
  return data;
}

// Marke-Tabelle mit Mitarbeiter-Berechtigungs-Filterung laden
async function loadMarkenWithAccessFilter(field) {
  const allowedMarkenIds = await window.getAllowedMarkenIds?.();

  let query = window.supabase
    .from('marke')
    .select('*')
    .order(field.displayField || 'markenname', { ascending: true });

  if (allowedMarkenIds !== null) {
    if (allowedMarkenIds.length === 0) {
      console.log(`🔐 ${field.name}: Keine Marken-Zuordnungen für Mitarbeiter`);
      return [];
    }
    query = query.in('id', allowedMarkenIds);
    const result = await query;
    if (result.error) {
      console.error(`❌ Fehler beim Laden der Marken:`, result.error);
      return [];
    }
    console.log(`🔐 ${field.name}: ${(result.data || []).length} erlaubte Marken geladen`);
    return result.data || [];
  }

  const result = await query;
  if (result.error) {
    console.error(`❌ Fehler beim Laden der Marken:`, result.error);
    return [];
  }
  return result.data || [];
}

// Unternehmen-Tabelle mit Mitarbeiter-Berechtigungs-Filterung laden
async function loadUnternehmenWithAccessFilter(field) {
  const allowedUnternehmenIds = await window.getAllowedUnternehmenIds?.();

  let query = window.supabase
    .from('unternehmen')
    .select('*')
    .order(field.displayField || 'firmenname', { ascending: true });

  if (allowedUnternehmenIds !== null) {
    if (allowedUnternehmenIds.length === 0) {
      console.log(`🔐 ${field.name}: Keine Unternehmen-Zuordnungen für Mitarbeiter`);
      return [];
    }
    query = query.in('id', allowedUnternehmenIds);
    const result = await query;
    if (result.error) {
      console.error(`❌ Fehler beim Laden der Unternehmen:`, result.error);
      return [];
    }
    console.log(`🔐 ${field.name}: ${(result.data || []).length} erlaubte Unternehmen geladen`);
    return result.data || [];
  }

  const result = await query;
  if (result.error) {
    console.error(`❌ Fehler beim Laden der Unternehmen:`, result.error);
    return [];
  }
  return result.data || [];
}

// Generische Tabelle laden (inkl. Benutzer-Filter, filterByKlasse, field.filter)
// Gibt null zurück wenn Fehler (Caller soll [] zurückgeben)
async function loadGenericTable(field) {
  let query = window.supabase
    .from(field.table)
    .select('*');

  if (field.table === 'eu_laender') {
    query = query.order('sort_order', { ascending: true });
  }

  if (field.table === 'benutzer') {
    query = query.neq('rolle', 'kunde');
    console.log(`🚫 Filtere Kunden aus für ${field.name}`);

    if (field.filterByKlasse) {
      const klasseNames = Array.isArray(field.filterByKlasse)
        ? field.filterByKlasse
        : [field.filterByKlasse];

      const { data: klassenData, error: klassenError } = await window.supabase
        .from('mitarbeiter_klasse')
        .select('id')
        .in('name', klasseNames);

      if (!klassenError && klassenData && klassenData.length > 0) {
        const klassenIds = klassenData.map(k => k.id);
        query = query.or(`rolle.eq.admin,mitarbeiter_klasse_id.in.(${klassenIds.join(',')})`);
        console.log(`🎯 Filtere nach Klassen für ${field.name}:`, klasseNames, '(+ Admins)');
      } else {
        console.warn(`⚠️ Keine Mitarbeiter-Klassen gefunden für: ${klasseNames.join(', ')} - zeige nur Admins`);
        query = query.eq('rolle', 'admin');
      }
    }
  }

  if (field.filter) {
    query.or(field.filter);
  }

  const result = await query;

  if (result.error) {
    console.error(`❌ Fehler beim Laden der Daten aus ${field.table}:`, result.error);
    return null;
  }

  return result.data;
}

// Supabase-Row zu Option {value, label, description, isoCode?, vorwahl?} konvertieren
function mapRowToOption(item, field) {
  let label = 'Unbekannt';
  if (field.displayField) {
    if (field.displayField.includes(',')) {
      const fields = field.displayField.split(',').map(f => f.trim());
      const values = fields.map(f => item[f]).filter(Boolean);
      label = values.length > 0 ? values.join(' ') : 'Unbekannt';
    } else {
      label = item[field.displayField] || 'Unbekannt';
    }
  } else {
    label = item.name || 'Unbekannt';
  }

  const option = {
    value: item[field.valueField || 'id'],
    label: label,
    description: item.beschreibung || item.description
  };

  if (field.table === 'eu_laender') {
    option.isoCode = item.iso_code;
    option.vorwahl = item.vorwahl;
  }

  return option;
}
