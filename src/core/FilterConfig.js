// FilterConfig.js (ES6-Modul)
// Zentrale Konfiguration für alle Filter

export const FILTER_CONFIGS = {
  creator: [
    {
      id: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Nach Namen suchen...'
    },
    {
      id: 'creator_type_id',
      label: 'Creator Typ',
      type: 'select',
      multiple: false,
      table: 'creator_type',
      displayField: 'name',
      valueField: 'id'
    },
    {
      id: 'sprache_id',
      label: 'Sprache',
      type: 'select',
      multiple: false,
      table: 'sprachen',
      displayField: 'name',
      valueField: 'id'
    },
    {
      id: 'branche_id',
      label: 'Branche',
      type: 'select',
      multiple: false,
      table: 'branchen_creator',
      displayField: 'name',
      valueField: 'id'
    }
  ],
  ansprechpartner: [
    {
      id: 'vorname',
      label: 'Vorname',
      type: 'text',
      placeholder: 'Nach Vorname suchen...'
    },
    {
      id: 'nachname',
      label: 'Nachname',
      type: 'text',
      placeholder: 'Nach Nachname suchen...'
    },
    {
      id: 'position_id',
      label: 'Position',
      type: 'select',
      multiple: false,
      dynamic: true,
      options: []
    },
    {
      id: 'unternehmen_id',
      label: 'Unternehmen',
      type: 'select',
      multiple: false,
      dynamic: true,
      options: []
    },
    {
      id: 'stadt',
      label: 'Stadt',
      type: 'text',
      placeholder: 'Nach Stadt suchen...'
    },
    {
      id: 'sprache_id',
      label: 'Sprache',
      type: 'select',
      multiple: false,
      dynamic: true,
      options: []
    }
  ],
  unternehmen: [
    {
      id: 'firmenname',
      label: 'Firmenname',
      type: 'text',
      placeholder: 'Nach Firmenname suchen...'
    },
    {
      id: 'branche',
      label: 'Branche',
      type: 'text',
      placeholder: 'Nach Branche suchen...'
    },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      multiple: false,
      options: [
        { value: 'Aktiv', label: 'Aktiv' },
        { value: 'Inaktiv', label: 'Inaktiv' },
        { value: 'Potentiell', label: 'Potentiell' }
      ]
    }
  ],
  kampagne: [
    {
      id: 'kampagnenname',
      label: 'Kampagnenname',
      type: 'text',
      placeholder: 'Nach Kampagnenname suchen...'
    },
    {
      id: 'unternehmen_id',
      label: 'Unternehmen',
      type: 'select',
      multiple: false,
      table: 'unternehmen',
      displayField: 'firmenname',
      valueField: 'id'
    },
    {
      id: 'marke_id',
      label: 'Marke',
      type: 'select',
      multiple: false,
      table: 'marke',
      displayField: 'markenname',
      valueField: 'id'
    },
    {
      id: 'art_der_kampagne',
      label: 'Art der Kampagne',
      type: 'select',
      multiple: true,
      options: [
        { value: 'UGC Pro Paid', label: 'UGC Pro Paid' },
        { value: 'UGC Pro Organic', label: 'UGC Pro Organic' },
        { value: 'UGC Video Paid', label: 'UGC Video Paid' },
        { value: 'UGC Video Organic', label: 'UGC Video Organic' },
        { value: 'Influencer Kampagne', label: 'Influencer Kampagne' },
        { value: 'Vor Ort Produktionen', label: 'Vor Ort Produktionen' }
      ]
    },
    {
      id: 'start',
      label: 'Startdatum',
      type: 'date'
    },
    {
      id: 'deadline_post_produktion',
      label: 'Deadline Post Produktion',
      type: 'date'
    }
  ],
  marke: [
    {
      id: 'markenname',
      label: 'Markenname',
      type: 'text',
      placeholder: 'Nach Markenname suchen...'
    },
    {
      id: 'unternehmen_id',
      label: 'Unternehmen',
      type: 'select',
      multiple: false,
      table: 'unternehmen',
      displayField: 'firmenname',
      valueField: 'id'
    },
    {
      id: 'branche',
      label: 'Branche',
      type: 'text',
      placeholder: 'Nach Branche suchen...'
    }
  ],
  kooperation: [
    {
      id: 'creator_id',
      label: 'Creator',
      type: 'select',
      multiple: false,
      table: 'creator',
      displayField: 'vorname',
      valueField: 'id',
      dynamic: true
    },
    {
      id: 'kampagne_id',
      label: 'Kampagne',
      type: 'select',
      multiple: false,
      table: 'kampagne',
      displayField: 'name',
      valueField: 'id',
      dynamic: true
    },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      multiple: false,
      options: [
        { value: 'Angefragt', label: 'Angefragt' },
        { value: 'Bestätigt', label: 'Bestätigt' },
        { value: 'In Bearbeitung', label: 'In Bearbeitung' },
        { value: 'Abgeschlossen', label: 'Abgeschlossen' },
        { value: 'Abgelehnt', label: 'Abgelehnt' }
      ]
    },
    {
      id: 'budget',
      label: 'Budget (min)',
      type: 'number',
      placeholder: 'Mindestbudget...'
    },
    {
      id: 'start_datum',
      label: 'Startdatum',
      type: 'date'
    },
    {
      id: 'end_datum',
      label: 'Enddatum',
      type: 'date'
    }
  ],
  auftrag: [
    {
      id: 'auftragsname',
      label: 'Auftragsname',
      type: 'text',
      placeholder: 'Nach Auftragsname suchen...'
    },
    {
      id: 'unternehmen_id',
      label: 'Unternehmen',
      type: 'select',
      multiple: false,
      table: 'unternehmen',
      displayField: 'firmenname',
      valueField: 'id'
    },
    {
      id: 'marke_id',
      label: 'Marke',
      type: 'select',
      multiple: false,
      table: 'marke',
      displayField: 'markenname',
      valueField: 'id'
    },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      multiple: false,
      options: [
        { value: 'Beauftragt', label: 'Beauftragt' },
        { value: 'in Produktion', label: 'In Produktion' },
        { value: 'Abgeschlossen', label: 'Abgeschlossen' },
        { value: 'Storniert', label: 'Storniert' }
      ]
    },
    {
      id: 'art_der_kampagne',
      label: 'Art der Kampagne',
      type: 'select',
      multiple: true,
      options: [
        { value: 'UGC Pro Paid', label: 'UGC Pro Paid' },
        { value: 'UGC Pro Organic', label: 'UGC Pro Organic' },
        { value: 'UGC Video Paid', label: 'UGC Video Paid' },
        { value: 'UGC Video Organic', label: 'UGC Video Organic' },
        { value: 'Influencer Kampagne', label: 'Influencer Kampagne' },
        { value: 'Vor Ort Produktionen', label: 'Vor Ort Produktionen' }
      ]
    },
    {
      id: 'gesamt_budget',
      label: 'Gesamtbudget (min)',
      type: 'number',
      placeholder: 'Mindestbudget...'
    }
  ]
};

// Verbessere Filter-Konfiguration mit dynamischen Daten
export async function enhanceFilterConfig(entityType, filterConfig) {
  try {
    console.log(`🔧 FILTERCONFIG: Verbessere Filter-Konfiguration für ${entityType}`);
    
    if (!filterConfig || !Array.isArray(filterConfig)) {
      console.warn(`⚠️ FILTERCONFIG: Ungültige filterConfig für ${entityType}:`, filterConfig);
      return [];
    }
    
    if (!window.dataService) {
      console.warn('⚠️ DataService nicht verfügbar');
      return filterConfig;
    }

    const enhancedConfig = [];
    
    for (const filter of filterConfig) {
      const enhancedFilter = { ...filter };
      
      // Lade dynamische Optionen für dynamische Filter
      if ((filter.dynamic || filter.table) && (!filter.options || filter.options.length === 0)) {
        try {
          const filterData = await window.dataService.extractFilterOptions(entityType);
          
          // Prüfe sowohl neue als auch alte Keys für Kompatibilität
          const newKey = filter.id;
          const oldKey = newKey.replace('_id', ''); // z.B. creator_type_id → creator_type
          
          const options = filterData[newKey] || filterData[oldKey] || [];
          
          if (options && options.length > 0) {
            enhancedFilter.options = options;
            console.log(`✅ FILTERCONFIG: ${options.length} Optionen für ${filter.id} geladen`);
          } else {
            console.warn(`⚠️ FILTERCONFIG: Keine Optionen für ${filter.id} gefunden`);
          }
        } catch (error) {
          console.error(`❌ FILTERCONFIG: Fehler beim Laden der Optionen für ${filter.id}:`, error);
        }
      }
      
      enhancedConfig.push(enhancedFilter);
    }
    
    return enhancedConfig;
    
  } catch (error) {
    console.error(`❌ FILTERCONFIG: Fehler beim Verbessern der Filter-Konfiguration für ${entityType}:`, error);
    return filterConfig;
  }
}