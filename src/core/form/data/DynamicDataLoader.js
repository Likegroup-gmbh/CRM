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
      
      // Prüfe ob das Feld abhängig ist - im Kampagne/Ansprechpartner Edit-Mode trotzdem laden
      if (field.dependsOn) {
        const isKampagneEditMode = form.dataset.entityType === 'kampagne' && form.dataset.isEditMode === 'true';
        const isAnsprechpartnerEditMode = form.dataset.entityType === 'ansprechpartner' && form.dataset.isEditMode === 'true';
        if (!isKampagneEditMode && !isAnsprechpartnerEditMode) {
          console.log(`⏭️ Überspringe automatisches Laden für abhängiges Feld: ${field.name} (abhängig von ${field.dependsOn})`);
          return;
        } else {
          console.log(`🎯 Edit-Mode (${form.dataset.entityType}): Lade abhängiges Feld trotzdem: ${field.name}`);
        }
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
        
        case 'mitarbeiter_ids':
          options = await this.loadBenutzerOptions();
          break;
        case 'cutter_ids':
          options = await this.loadBenutzerOptions({ role: 'cutter' });
          break;
        case 'copywriter_ids':
          options = await this.loadBenutzerOptions({ role: 'copywriter' });
          break;
        case 'ansprechpartner_id':
          options = await this.loadAnsprechpartnerOptions(field, form);
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
        
        // Spezielle Behandlung für Tag-basierte Multi-Selects
        if (selectElement.dataset.tagBased === 'true' && field.tagBased && selectElement.multiple) {
          console.log('🏷️ DYNAMICDATALOADER: Initialisiere Tag-basiertes Multi-Select:', field.name);
          
          // Optionen in das Select-Element laden (für Fallback)
          selectElement.innerHTML = '';
          selectElement.appendChild(new Option('', ''));
          options.forEach(option => {
            const optionElement = new Option(option.label, option.value, option.selected, option.selected);
            selectElement.appendChild(optionElement);
          });
          
          // Tag-basiertes System nur initialisieren wenn Optionen vorhanden sind
          if (options.length > 0 && window.formSystem?.optionsManager?.createTagBasedSelect) {
            console.log('🏷️ DYNAMICDATALOADER: Erstelle Tag-System mit', options.length, 'Optionen für:', field.name);
            window.formSystem.optionsManager.createTagBasedSelect(selectElement, options, field);
            console.log('✅ DYNAMICDATALOADER: Tag-basiertes Multi-Select initialisiert für:', field.name);
          } else if (options.length === 0) {
            console.log('⏭️ DYNAMICDATALOADER: Keine Optionen für Tag-System verfügbar:', field.name);
          } else {
            console.warn('⚠️ DYNAMICDATALOADER: OptionsManager nicht verfügbar für:', field.name);
          }
        } else {
          // Standard Select-Update
          this.updateSelectOptions(selectElement, options, field);
        }
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
      const options = data.map(item => {
        // DisplayField kann mehrere Felder enthalten (komma-separiert)
        let label = 'Unbekannt';
        if (field.displayField) {
          if (field.displayField.includes(',')) {
            // Mehrere Felder kombinieren
            const fields = field.displayField.split(',').map(f => f.trim());
            const values = fields.map(f => item[f]).filter(Boolean);
            label = values.length > 0 ? values.join(' ') : 'Unbekannt';
          } else {
            // Einzelnes Feld
            label = item[field.displayField] || 'Unbekannt';
          }
        } else {
          label = item.name || 'Unbekannt';
        }
        
        return {
          value: item[field.valueField || 'id'],
          label: label,
          description: item.beschreibung || item.description
        };
      });

      // Edit-Modus: Bestehende Werte als "selected" markieren für einfache Select-Felder
      if (form.dataset.isEditMode === 'true') {
        console.log('🔍 DYNAMICDATALOADER: Edit-Modus erkannt für Feld:', field.name);
        
        // WICHTIG: Kampagne Edit-Mode Behandlung ZUERST - auch für nicht-abhängige Felder!
        if (form.dataset.entityType === 'kampagne' && form.dataset.editModeData) {
          try {
            const editData = JSON.parse(form.dataset.editModeData);
            
            // Single-Select Felder für Kampagne - WICHTIGE REIHENFOLGE: Unternehmen -> Marke -> Auftrag -> Rest
            if (field.name === 'unternehmen_id' && editData.unternehmen_id) {
              options.forEach(option => {
                if (option.value === editData.unternehmen_id) {
                  option.selected = true;
                }
              });
              console.log(`✅ DYNAMICDATALOADER: Kampagne ${field.name} vorausgewählt:`, editData.unternehmen_id);
            }
            
            if (field.name === 'marke_id' && editData.marke_id) {
              options.forEach(option => {
                if (option.value === editData.marke_id) {
                  option.selected = true;
                }
              });
              console.log(`✅ DYNAMICDATALOADER: Kampagne ${field.name} vorausgewählt:`, editData.marke_id);
            }
            
            if (field.name === 'auftrag_id' && editData.auftrag_id) {
              options.forEach(option => {
                if (option.value === editData.auftrag_id) {
                  option.selected = true;
                }
              });
              console.log(`✅ DYNAMICDATALOADER: Kampagne ${field.name} vorausgewählt:`, editData.auftrag_id);
            }
            
            if (field.name === 'status_id' && editData.status_id) {
              options.forEach(option => {
                if (option.value === editData.status_id) {
                  option.selected = true;
                }
              });
              console.log(`✅ DYNAMICDATALOADER: Kampagne ${field.name} vorausgewählt:`, editData.status_id);
            }
            
            if (field.name === 'drehort_typ_id' && editData.drehort_typ_id) {
              options.forEach(option => {
                if (option.value === editData.drehort_typ_id) {
                  option.selected = true;
                }
              });
              console.log(`✅ DYNAMICDATALOADER: Kampagne ${field.name} vorausgewählt:`, editData.drehort_typ_id);
            }
            
            // Multi-Select Felder für Kampagne
            const multiSelectFields = {
              'ansprechpartner_ids': editData.ansprechpartner_ids || editData.ansprechpartner || [],
              'mitarbeiter_ids': editData.mitarbeiter_ids || editData.mitarbeiter || [],
              'pm_ids': editData.pm_ids || editData.projektmanager || [],
              'scripter_ids': editData.scripter_ids || editData.scripter || [],
              'cutter_ids': editData.cutter_ids || editData.cutter || [],
              'copywriter_ids': editData.copywriter_ids || editData.copywriter || [],
              'art_der_kampagne': editData.art_der_kampagne || editData.kampagnenarten || [],
              'plattform_ids': editData.plattform_ids || editData.plattformen || [],
              'format_ids': editData.format_ids || editData.formate || []
            };
            
            if (multiSelectFields[field.name]) {
              const existingIds = Array.isArray(multiSelectFields[field.name]) 
                ? multiSelectFields[field.name] 
                : [multiSelectFields[field.name]];
              
              // IDs extrahieren falls es Objekte sind
              const ids = existingIds.map(item => 
                typeof item === 'object' && item !== null ? item.id : item
              ).filter(Boolean);
              
              if (ids.length > 0) {
                options.forEach(option => {
                  if (ids.includes(option.value)) {
                    option.selected = true;
                  }
                });
                console.log(`✅ DYNAMICDATALOADER: Kampagne ${field.name} vorausgewählt:`, ids);
              }
            }
          } catch (e) {
            console.warn(`⚠️ DYNAMICDATALOADER: Fehler beim Laden der Kampagne Edit-Daten für ${field.name}:`, e);
          }
        }
        
        // Für einfache Select-Felder (nicht multiselect/tagBased)
        if (form.dataset.entityType === 'ansprechpartner') {
          // position_id direkt markieren
          if (field.name === 'position_id' && form.dataset.editModeData) {
            try {
              const editData = JSON.parse(form.dataset.editModeData);
              const existingId = editData.position_id;
              if (existingId) {
                options.forEach(option => { if (option.value === existingId) option.selected = true; });
                console.log('✅ DYNAMICDATALOADER: Position vorausgewählt:', existingId);
              }
            } catch (_) {}
          }
          // sprache_id (Single) direkt markieren
          if (field.name === 'sprache_id' && form.dataset.editModeData) {
            try {
              const editData = JSON.parse(form.dataset.editModeData);
              const existingId = editData.sprache_id;
              if (existingId) {
                options.forEach(option => { if (option.value === existingId) option.selected = true; });
                console.log('✅ DYNAMICDATALOADER: Einzel-Sprache vorausgewählt:', existingId);
              }
            } catch (_) {}
          }
        }
        
        // Creator Edit-Mode Behandlung
        if (form.dataset.entityType === 'creator' && form.dataset.editModeData) {
          try {
            const editData = JSON.parse(form.dataset.editModeData);
            
            // Multi-Select Felder für Creator
            const multiSelectFields = {
              'sprachen_ids': editData.sprachen_ids || editData.sprachen || [],
              'branchen_ids': editData.branchen_ids || editData.branchen || [],
              'creator_type_ids': editData.creator_type_ids || editData.creator_types || []
            };
            
            if (multiSelectFields[field.name]) {
              const existingIds = Array.isArray(multiSelectFields[field.name]) 
                ? multiSelectFields[field.name] 
                : [multiSelectFields[field.name]];
              
              // IDs extrahieren falls es Objekte sind
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
        
        // Alte doppelte Kampagne Edit-Mode Behandlung entfernt - wird jetzt oben behandelt
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
        
        // Kampagne Edit-Modus: Marke
        if (field.name === 'marke_id' && form.dataset.existingMarkeId) {
          const existingId = form.dataset.existingMarkeId;
          console.log('🏷️ DYNAMICDATALOADER: Markiere bestehende Marke als selected:', existingId);
          
          options.forEach(option => {
            if (option.value === existingId) {
              option.selected = true;
              console.log('✅ DYNAMICDATALOADER: Marke gefunden und markiert:', option.label);
            }
          });
        }
        
        // Kampagne Edit-Modus: Auftrag
        if (field.name === 'auftrag_id' && form.dataset.existingAuftragId) {
          const existingId = form.dataset.existingAuftragId;
          console.log('📋 DYNAMICDATALOADER: Markiere bestehenden Auftrag als selected:', existingId);
          
          options.forEach(option => {
            if (option.value === existingId) {
              option.selected = true;
              console.log('✅ DYNAMICDATALOADER: Auftrag gefunden und markiert:', option.label);
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
        } else if (form.dataset.entityType === 'ansprechpartner' && field.name === 'marke_ids') {
          entityField = 'ansprechpartner_id';
        } else if (form.dataset.entityType === 'ansprechpartner' && field.name === 'sprachen_ids') {
          entityField = 'ansprechpartner_id';
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
      
      // Spezielle Behandlung für Kampagne Edit-Modus: Abhängige Felder laden
      if (form.dataset.entityType === 'kampagne' && form.dataset.isEditMode === 'true') {
        await this.loadKampagneDependentFieldsImproved(field, form, options);
        
        // Felder als readonly/fixiert markieren
        if (['unternehmen_id', 'marke_id', 'auftrag_id', 'ansprechpartner_id'].includes(field.name)) {
          setTimeout(() => {
            this.setKampagneFieldAsReadonly(field, form);
          }, 200); // Länger warten
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

  // Verbesserte Kampagne Edit-Mode Behandlung
  async loadKampagneDependentFieldsImproved(field, form, options) {
    try {
      const editModeData = form.dataset.editModeData ? JSON.parse(form.dataset.editModeData) : {};
      
      // Unternehmen-Feld: Bestehenden Wert als selected markieren
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
      
      // Marken für das bestehende Unternehmen laden
      if (field.name === 'marke_id' && editModeData.unternehmen_id) {
        console.log('🏢 DYNAMICDATALOADER: Lade Marken für Unternehmen im Kampagne Edit-Modus:', editModeData.unternehmen_id);
        
        const { data: marken, error } = await window.supabase
          .from('marke')
          .select('id, markenname')
          .eq('unternehmen_id', editModeData.unternehmen_id)
          .order('markenname');
        
        if (!error && marken) {
          // Bestehende Optionen durch Marken ersetzen
          options.length = 0; // Array leeren
          
          if (marken.length === 0) {
            // Keine Marken für dieses Unternehmen
            options.push({ 
              value: '', 
              label: 'Keine Marken für dieses Unternehmen verfügbar', 
              selected: true,
              disabled: true,
              style: 'color: #6b7280; font-style: italic;'
            });
            console.log('ℹ️ DYNAMICDATALOADER: Keine Marken für Unternehmen gefunden');
          } else {
            // Placeholder Option
            options.push({ value: '', label: 'Marke auswählen...', selected: false });
            // Marken hinzufügen
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
      
      // Aufträge laden: Entweder für Marke oder direkt für Unternehmen (falls keine Marken)
      if (field.name === 'auftrag_id' && (editModeData.marke_id || editModeData.unternehmen_id)) {
        let auftraege = [];
        let auftragsTyp = '';
        
        if (editModeData.marke_id) {
          // Standard: Aufträge für die bestehende Marke laden
          console.log('🏷️ DYNAMICDATALOADER: Lade Aufträge für Marke im Kampagne Edit-Modus:', editModeData.marke_id);
          auftragsTyp = 'Marke';
          
          const { data, error } = await window.supabase
            .from('auftrag')
            .select('id, auftragsname')
            .eq('marke_id', editModeData.marke_id)
            .order('auftragsname');
          
          if (!error && data) auftraege = data;
        } else if (editModeData.unternehmen_id) {
          // Fallback: Direkte Unternehmens-Aufträge (wenn keine Marke verfügbar)
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
        
        // Optionen aufbauen
        options.length = 0; // Array leeren
        
        if (auftraege.length === 0) {
          // Keine Aufträge verfügbar
          options.push({ 
            value: '', 
            label: `Keine Aufträge für diese ${auftragsTyp} verfügbar`, 
            selected: true,
            disabled: true,
            style: 'color: #6b7280; font-style: italic;'
          });
          console.log(`ℹ️ DYNAMICDATALOADER: Keine Aufträge für ${auftragsTyp} gefunden`);
        } else {
          // Placeholder Option
          options.push({ value: '', label: 'Auftrag auswählen...', selected: false });
          // Aufträge hinzufügen
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
      
      // Ansprechpartner laden
      if (field.name === 'ansprechpartner_id' && editModeData.unternehmen_id) {
        console.log('👤 DYNAMICDATALOADER: Lade Ansprechpartner für Unternehmen im Kampagne Edit-Modus:', editModeData.unternehmen_id);
        
        const { data: ansprechpartner, error } = await window.supabase
          .from('ansprechpartner')
          .select('id, name')
          .eq('unternehmen_id', editModeData.unternehmen_id)
          .order('name');
        
        if (!error && ansprechpartner) {
          // Bestehende Optionen durch Ansprechpartner ersetzen
          options.length = 0; // Array leeren
          
          if (ansprechpartner.length === 0) {
            // Keine Ansprechpartner für dieses Unternehmen
            options.push({ 
              value: '', 
              label: 'Keine Ansprechpartner für dieses Unternehmen verfügbar', 
              selected: true,
              disabled: true,
              style: 'color: #6b7280; font-style: italic;'
            });
            console.log('ℹ️ DYNAMICDATALOADER: Keine Ansprechpartner für Unternehmen gefunden');
          } else {
            // Placeholder Option
            options.push({ value: '', label: 'Ansprechpartner auswählen...', selected: false });
            // Ansprechpartner hinzufügen
            ansprechpartner.forEach(ansprechpartner => {
              options.push({
                value: ansprechpartner.id,
                label: ansprechpartner.name,
                selected: ansprechpartner.id === editModeData.ansprechpartner_id
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
  setKampagneFieldAsReadonly(field, form) {
    console.log('🔒 DYNAMICDATALOADER: Setze Feld als readonly:', field.name);
    
    try {
      // Label als "fixiert" markieren
      const label = form.querySelector(`label[for="field-${field.name}"]`);
      if (label && !label.textContent.includes('(fixiert)')) {
        label.textContent += ' (fixiert)';
        label.style.color = '#6b7280';
      }
      
      // Searchable Select Container finden und deaktivieren
      const searchableContainer = form.querySelector(`.searchable-select-container[data-field="${field.name}"]`);
      if (searchableContainer) {
        // Input deaktivieren
        const input = searchableContainer.querySelector('.searchable-select-input');
        if (input) {
          input.disabled = true;
          input.style.backgroundColor = '#f3f4f6';
          input.style.cursor = 'not-allowed';
          input.style.color = '#6b7280';
        }
        
        // Container visuell deaktivieren
        searchableContainer.style.opacity = '0.7';
        searchableContainer.style.pointerEvents = 'none';
        
        // Dropdown verstecken
        const dropdown = searchableContainer.querySelector('.searchable-select-dropdown');
        if (dropdown) {
          dropdown.style.display = 'none';
        }
      }
      
      // Original Select-Element deaktivieren
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
  async loadKampagneDependentFields(field, form, options) {
    try {
      const editModeData = form.dataset.editModeData ? JSON.parse(form.dataset.editModeData) : {};
      
      // Marken für das bestehende Unternehmen laden
      if (field.name === 'marke_id' && editModeData.unternehmen_id) {
        console.log('🏢 DYNAMICDATALOADER: Lade Marken für Unternehmen im Kampagne Edit-Modus:', editModeData.unternehmen_id);
        
        const { data: marken, error } = await window.supabase
          .from('marke')
          .select('id, markenname')
          .eq('unternehmen_id', editModeData.unternehmen_id)
          .order('markenname');
        
        if (!error && marken) {
          // Bestehende Optionen durch Marken ersetzen
          options.length = 0; // Array leeren
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
      
      // Aufträge für die bestehende Marke laden
      if (field.name === 'auftrag_id' && editModeData.marke_id) {
        console.log('🏷️ DYNAMICDATALOADER: Lade Aufträge für Marke im Kampagne Edit-Modus:', editModeData.marke_id);
        
        const { data: auftraege, error } = await window.supabase
          .from('auftrag')
          .select('id, auftragsname')
          .eq('marke_id', editModeData.marke_id)
          .order('auftragsname');
        
        if (!error && auftraege) {
          // Bestehende Optionen durch Aufträge ersetzen
          options.length = 0; // Array leeren
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

  // Benutzeroptionen laden
  async loadBenutzerOptions(filter = {}) {
    if (!window.supabase) return [];
    try {
      let query = window.supabase
        .from('benutzer')
        .select('id, name, vorname, nachname, rolle')
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

  // Ansprechpartneroptionen laden
  async loadAnsprechpartnerOptions(field, form) {
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

  // Searchable Select reinitialisieren
  reinitializeSearchableSelect(selectElement, options, field) {
    console.log('🔧 Reinitialisiere Searchable Select für:', field.name, 'mit', options.length, 'Optionen');
    
    // Spezielle Behandlung für Tag-basierte Multi-Selects
    if (selectElement.dataset.tagBased === 'true' && field.tagBased) {
      console.log('🏷️ DYNAMICDATALOADER: Tag-basiertes Multi-Select erkannt:', field.name);
      
      // Verwende OptionsManager für Tag-basierte Selects
      if (window.formSystem?.optionsManager?.createTagBasedSelect) {
        window.formSystem.optionsManager.createTagBasedSelect(selectElement, options, field);
        console.log('✅ DYNAMICDATALOADER: Tag-basiertes Multi-Select reinitialisiert für:', field.name);
        return;
      } else {
        console.warn('⚠️ DYNAMICDATALOADER: OptionsManager nicht verfügbar für:', field.name);
      }
    }
    
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