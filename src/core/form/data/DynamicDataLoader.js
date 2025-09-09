export class DynamicDataLoader {
  constructor() {
    this.dataService = window.dataService;
  }

  // DataService injizieren (wird vom FormSystem aufgerufen)
  setDataService(dataService) {
    this.dataService = dataService;
  }

  // Dynamische Formulardaten laden
  async loadDynamicFormData(entity, form) {
    try {
      const config = this.getFormConfig(entity);
      if (!config) return;

      const fields = config.fields || [];
      
      for (const field of fields) {
        if (field.dynamic) {
          await this.loadFieldOptions(entity, field, form);
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der dynamischen Formulardaten:', error);
    }
  }

  // Feldoptionen laden
  async loadFieldOptions(entity, field, form) {
    try {
      // Sicherheitsprüfung für DataService
      if (!this.dataService) {
        console.error('❌ DataService ist nicht verfügbar in DynamicDataLoader');
        this.dataService = window.dataService; // Fallback
      }
      
      // Prüfe ob das Feld abhängig ist - dann nicht automatisch laden
      if (field.dependsOn) {
        console.log(`⏭️ Überspringe automatisches Laden für abhängiges Feld: ${field.name} (abhängig von ${field.dependsOn})`);
        return;
      }
      
      let options = [];

      // Spezialfall: Rechnung -> Kooperationen ohne bestehende Rechnung
      if (entity === 'rechnung' && field.name === 'kooperation_id') {
        console.log('🔧 Lade Kooperationen ohne bestehende Rechnung für Rechnungsformular');
        options = await this.loadKooperationenOhneRechnung();
        console.log(`✅ kooperation_id Optionen (ohne Rechnung):`, options.length);
      }
      // Für Felder mit table-Konfiguration standardmäßig loadDirectQueryOptions verwenden
      else if (field.table) {
        console.log(`🔧 Lade Daten direkt aus Tabelle ${field.table} für ${field.name}`);
        options = await this.loadDirectQueryOptions(field, form);
        console.log(`✅ ${field.name} Optionen geladen:`, options.length, options.slice(0, 3));
      } else {
        // Fallback für spezielle Felder ohne table-Konfiguration
        switch (field.name) {
        case 'unternehmen_id':
          // Kontext-spezifisch laden
          if (!window.supabase) {
            const unternehmen = await this.dataService.loadEntities('unternehmen');
            options = unternehmen.map(u => ({ value: u.id, label: u.firmenname || 'Unbekanntes Unternehmen' }));
            break;
          }
          try {
            if (entity === 'kooperation') {
              // Nur Unternehmen mit vorhandenen Kampagnen (für Kooperation)
              const { data: kampUnternehmen, error: kampUError } = await window.supabase
                .from('kampagne')
                .select('unternehmen_id')
                .not('unternehmen_id', 'is', null);
              if (kampUError) {
                console.error('❌ Fehler beim Laden der Kampagnen-Unternehmen:', kampUError);
                break;
              }
              const uniqIds = Array.from(new Set((kampUnternehmen || []).map(row => row.unternehmen_id).filter(Boolean)));
              const { data: unternehmen2, error: uErr } = await window.supabase
                .from('unternehmen')
                .select('id, firmenname')
                .in('id', uniqIds)
                .order('firmenname');
              if (uErr) {
                console.error('❌ Fehler beim Laden der Unternehmen:', uErr);
                break;
              }
              options = (unternehmen2 || []).map(u => ({ value: u.id, label: u.firmenname || 'Unbekanntes Unternehmen' }));
            } else if (entity === 'kampagne') {
              // Für neue Kampagne: Nur Unternehmen mit mindestens einem Auftrag
              const { data: auftragUnternehmen, error: aErr } = await window.supabase
                .from('auftrag')
                .select('unternehmen_id')
                .not('unternehmen_id', 'is', null);
              if (aErr) {
                console.error('❌ Fehler beim Laden der Auftrag-Unternehmen:', aErr);
                break;
              }
              const uniqIds = Array.from(new Set((auftragUnternehmen || []).map(row => row.unternehmen_id).filter(Boolean)));
              const { data: unternehmen2, error: uErr } = await window.supabase
                .from('unternehmen')
                .select('id, firmenname')
                .in('id', uniqIds)
                .order('firmenname');
              if (uErr) {
                console.error('❌ Fehler beim Laden der Unternehmen:', uErr);
                break;
              }
              options = (unternehmen2 || []).map(u => ({ value: u.id, label: u.firmenname || 'Unbekanntes Unternehmen' }));
            } else if (entity === 'marke') {
              // Für Marke: Alle Unternehmen anzeigen
              const { data: unternehmenAll, error: allErr } = await window.supabase
                .from('unternehmen')
                .select('id, firmenname')
                .order('firmenname');
              if (allErr) {
                console.error('❌ Fehler beim Laden aller Unternehmen:', allErr);
                break;
              }
              options = (unternehmenAll || []).map(u => ({ value: u.id, label: u.firmenname || 'Unbekanntes Unternehmen' }));
            } else {
              // Default: Alle Unternehmen
              const { data: unternehmenAll, error: allErr } = await window.supabase
                .from('unternehmen')
                .select('id, firmenname')
                .order('firmenname');
              if (allErr) {
                console.error('❌ Fehler beim Laden aller Unternehmen:', allErr);
                break;
              }
              options = (unternehmenAll || []).map(u => ({ value: u.id, label: u.firmenname || 'Unbekanntes Unternehmen' }));
            }
          } catch (e) {
            console.error('❌ Fehler beim Laden der Unternehmen (kontext-spezifisch):', e);
          }
          break;
        
        // Entfernt - marke_ids wird jetzt über loadDirectQueryOptions verarbeitet
        
        case 'auftrag_id':
          // Aufträge laden - alle Aufträge
          const auftraege = await this.dataService.loadEntities('auftrag');
          options = auftraege.map(a => ({
            value: a.id,
            label: a.auftragsname || 'Unbekannter Auftrag'
          }));
          break;
        
        case 'creator_id':
          // Creator laden - alle Creator
          const creator = await this.dataService.loadEntities('creator');
          options = creator.map(c => ({
            value: c.id,
            label: `${c.vorname} ${c.nachname}` || 'Unbekannter Creator'
          }));
          break;
        
        case 'kampagne_id':
          // Kampagnen laden - alle Kampagnen
          const kampagnen = await this.dataService.loadEntities('kampagne');
          options = kampagnen.map(k => ({
            value: k.id,
            label: k.kampagnenname || 'Unbekannte Kampagne'
          }));
          break;
        
        case 'creator_type_id':
          // Creator-Typen direkt laden
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
        
        // Entfernt - sprachen_ids wird jetzt über loadDirectQueryOptions verarbeitet
        
        case 'branche_id':
          // Branchen direkt laden - verwende die zentrale branchen Tabelle für Unternehmen
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
        
        case 'assignee_id':
          // Benutzer/Mitarbeiter laden für Zuweisung
          const { data: benutzer, error: benError } = await window.supabase
            .from('benutzer')
            .select('id, name')
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
        
        case 'art_der_kampagne':
          // Kampagnen-Art-Typen laden
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
        
        case 'format_anpassung':
          // Format-Anpassungs-Typen laden
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
        
        default:
          // Keine spezielle Behandlung - wird über table-Konfiguration abgedeckt
          break;
        }
      }

      // Select-Element aktualisieren
      const selectElement = form.querySelector(`[name="${field.name}"]`);
      if (selectElement) {
        console.log(`🔧 Update Select für ${field.name} mit ${options.length} Optionen`);
        this.updateSelectOptions(selectElement, options, field);
      } else {
        console.log(`❌ Select-Element nicht gefunden für ${field.name}`);
      }

    } catch (error) {
      console.error(`❌ Fehler beim Laden der Optionen für ${field.name}:`, error);
    }
  }

  // Kooperationen ohne hinterlegte Rechnung laden
  async loadKooperationenOhneRechnung() {
    if (!window.supabase) return [];
    try {
      // 1) Alle kooperation_ids, die bereits in rechnung vorkommen
      const { data: rechnungen, error: rErr } = await window.supabase
        .from('rechnung')
        .select('kooperation_id')
        .not('kooperation_id', 'is', null);
      if (rErr) {
        console.error('❌ Fehler beim Laden vorhandener Rechnungen:', rErr);
        return [];
      }
      const excluded = Array.from(new Set((rechnungen || []).map(r => r.kooperation_id).filter(Boolean)));

      // 2) Kooperationen laden und jene ausschließen
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
      // Optional: Kampagnennamen ergänzen für Label
      let kampagneMap = {};
      try {
        const kampIds = Array.from(new Set((koops || []).map(k => k.kampagne_id).filter(Boolean)));
        if (kampIds.length > 0) {
          const { data: kamp } = await window.supabase
            .from('kampagne')
            .select('id, kampagnenname')
            .in('id', kampIds);
          kampagneMap = (kamp || []).reduce((acc, row) => { acc[row.id] = row.kampagnenname; return acc; }, {});
        }
      } catch (_) {}

      return (koops || []).map(k => ({
        value: k.id,
        label: k.name ? `${k.name} ${k.kampagne_id ? `— ${kampagneMap[k.kampagne_id] || 'Kampagne'}` : ''}` : (kampagneMap[k.kampagne_id] || k.id)
      }));
    } catch (e) {
      console.error('❌ Unerwarteter Fehler beim Laden der kooperation_id Optionen:', e);
      return [];
    }
  }

  // Optionen über direkte Supabase-Abfrage laden
  async loadDirectQueryOptions(field, form) {
    try {
      if (!field.table) {
        console.warn('⚠️ Keine Tabelle für direktes Laden definiert:', field.name);
        return [];
      }

      // Daten aus der angegebenen Tabelle laden
      const query = window.supabase
        .from(field.table)
        .select('*');

      // Filter anwenden, wenn vorhanden
      if (field.filter) {
        query.or(field.filter);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`❌ Fehler beim Laden der Daten aus ${field.table}:`, error);
        return [];
      }

      // Optionen aus den geladenen Daten erstellen
      const options = data.map(item => ({
        value: item[field.valueField || 'id'],
        label: item[field.displayField || 'name'] || 'Unbekannt',
        description: item.beschreibung || item.description
      }));

      // Edit-Modus: Bestehende Werte als "selected" markieren für einfache Select-Felder
      if (form.dataset.isEditMode === 'true') {
        console.log('🔍 DYNAMICDATALOADER: Edit-Modus erkannt für Feld:', field.name);
        
        // Für einfache Select-Felder (nicht multiselect/tagBased)
        if (field.name === 'unternehmen_id' && form.dataset.existingUnternehmenId) {
          const existingId = form.dataset.existingUnternehmenId;
          console.log('🏢 DYNAMICDATALOADER: Markiere bestehendes Unternehmen als selected:', existingId);
          
          options.forEach(option => {
            if (option.value === existingId) {
              option.selected = true;
              console.log('✅ DYNAMICDATALOADER: Unternehmen gefunden und markiert:', option.label);
            }
          });
        }
        
        if (field.name === 'branche_id' && form.dataset.existingBrancheId) {
          const existingId = form.dataset.existingBrancheId;
          console.log('🏷️ DYNAMICDATALOADER: Markiere bestehende Branche als selected:', existingId);
          
          options.forEach(option => {
            if (option.value === existingId) {
              option.selected = true;
              console.log('✅ DYNAMICDATALOADER: Branche gefunden und markiert:', option.label);
            }
          });
        }
        
        // Debug: Zeige selected Optionen
        const selectedOptions = options.filter(o => o.selected);
        if (selectedOptions.length > 0) {
          console.log('🎯 DYNAMICDATALOADER: Selected Optionen für', field.name, ':', selectedOptions.map(o => o.label));
        }
      }

      // Spezielle Behandlung für branche_id - bestehende Branchen aus Junction-Table laden
      if (field.name === 'branche_id' && form.dataset.entityId && (form.dataset.entityType === 'unternehmen' || form.dataset.entityType === 'marke')) {
        try {
          const entityId = form.dataset.entityId;
          console.log('🔍 DYNAMICDATALOADER: Lade bestehende Branchen für Unternehmen:', entityId);
          console.log('🔍 DYNAMICDATALOADER: Form Datasets verfügbar:', {
            entityId: form.dataset.entityId,
            isEditMode: form.dataset.isEditMode,
            editModeData: !!form.dataset.editModeData,
            existingBranchenIds: !!form.dataset.existingBranchenIds
          });
          
          // Prüfe ob Edit-Mode Daten bereits verfügbar sind
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
          
          // Fallback: Lade aus Junction Table wenn keine Edit-Mode Daten
          if (branchenIds.length === 0) {
            console.log('🔄 Lade Branchen-IDs aus Junction Table...');
            
            // Branchen aus Junction-Table laden (dynamisch je nach Entity-Typ)
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
          
          // Optionen als ausgewählt markieren
          if (branchenIds.length > 0) {
            
            // Alle entsprechenden Optionen als ausgewählt markieren
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
            console.log('📋 Final Options nach Branche-Markierung:', options.map(o => ({ value: o.value, label: o.label, selected: o.selected })));
          } else {
            console.log('ℹ️ Keine bestehenden Branchen für Unternehmen gefunden');
          }
        } catch (error) {
          console.error('❌ Fehler beim Laden der bestehenden Branchen:', error);
        }
      }
      
      // Bestehende Verknüpfungen laden (für Edit-Modus)
      else if (form.dataset.entityId && field.relationTable && field.relationField) {
        const entityId = form.dataset.entityId;
        // Korrekte Entity-Feld-Namen für verschiedene Verknüpfungstabellen
        let entityField;
        if (field.name === 'mitarbeiter_ids') {
          entityField = 'kampagne_id';
        } else if (field.name === 'plattform_ids') {
          entityField = 'kampagne_id';
        } else if (field.name === 'format_ids') {
          entityField = 'kampagne_id';
        } else {
          entityField = field.name.replace('_ids', '_id');
        }
        
        const { data: existingLinks, error: existingError } = await window.supabase
          .from(field.relationTable)
          .select(field.relationField)
          .eq(entityField, entityId);

        if (!existingError && existingLinks.length > 0) {
          const selectedIds = existingLinks.map(link => link[field.relationField]);
          options.forEach(option => {
            if (selectedIds.includes(option.value)) {
              option.selected = true;
            }
          });
        }
      }

      // Final Debug: Optionen mit Selected-Status ausgeben
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

  // Select-Optionen aktualisieren
  updateSelectOptions(selectElement, options, field) {
    console.log('🔧 Update Select-Optionen für:', field.name, 'mit', options.length, 'Optionen');
    
    // IMMER das versteckte Select-Element mit Optionen füllen
    selectElement.innerHTML = '';
    
    // Placeholder hinzufügen
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = field.placeholder || 'Bitte wählen...';
    selectElement.appendChild(placeholder);
    
    // Optionen hinzufügen
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      if (option.selected) {
        optionElement.selected = true;
      }
      selectElement.appendChild(optionElement);
    });
    
    // Prüfe ob es ein searchable Select ist
    if (selectElement.dataset.searchable === 'true') {
      console.log('🔧 Reinitialisiere Auto-Suggestion für:', field.name);
      // Für Multiselects die Optionen (value/label/selected) vollständig übergeben
      const normalized = options.map(o => ({ 
        value: o.value, 
        label: o.label, 
        selected: o.selected || false 
      }));
      
      // Debug: Zeige selected Optionen
      const selectedOptions = normalized.filter(o => o.selected);
      if (selectedOptions.length > 0) {
        console.log('🎯 DYNAMICDATALOADER: Übergebe selected Optionen an reinitializeSearchableSelect:', selectedOptions.map(o => o.label));
      }
      
      this.reinitializeSearchableSelect(selectElement, normalized, field);
      return;
    }
  }

  // Searchable Select reinitialisieren
  reinitializeSearchableSelect(selectElement, options, field) {
    console.log('🔧 Reinitialisiere Searchable Select für:', field.name, 'mit', options.length, 'Optionen');
    
    // Bestehende Auto-Suggestion Container entfernen
    const existingContainer = selectElement.parentNode.querySelector('.searchable-select-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    // WICHTIG: Ursprüngliches Select ausgeblendet lassen
    // Das verhindert doppelte Input-Felder bei Reinitialisierung
    selectElement.style.display = 'none';

    // Neue Auto-Suggestion erstellen
    this.createSearchableSelect(selectElement, options, field);
  }

  // Searchable Select erstellen
  createSearchableSelect(selectElement, options, field) {
    // Diese Methode wird von außen injiziert
    console.log('🔧 Searchable Select erstellen für:', field.name);
  }

  // Konfiguration abrufen (wird von außen injiziert)
  getFormConfig(entity) {
    // Diese Methode wird von außen überschrieben
    return null;
  }
} 