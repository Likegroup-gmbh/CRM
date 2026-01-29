import { KampagneUtils } from '../../../modules/kampagne/KampagneUtils.js';

export class FormEvents {
  constructor(formSystem) {
    this.formSystem = formSystem;
  }

  /**
   * Normalisiert deutsche Zahlenformate in Standard-Dezimalzahlen
   * "13.000" → 13000
   * "13.000,50" → 13000.50
   * "13,50" → 13.50
   * "13000" → 13000
   * @param {string} value - Eingabewert
   * @returns {number|null} - Normalisierte Zahl oder null bei ungültiger Eingabe
   */
  parseGermanNumber(value) {
    if (!value || typeof value !== 'string') return null;
    
    // Leerzeichen entfernen
    let cleaned = value.trim();
    if (!cleaned) return null;
    
    // Prüfe ob deutsches Format (Punkt als Tausender, Komma als Dezimal)
    // Pattern: Hat Punkte gefolgt von genau 3 Ziffern (Tausendertrenner)
    const hasThousandSeparator = /\d{1,3}(\.\d{3})+/.test(cleaned);
    const hasGermanDecimal = /,\d{1,2}$/.test(cleaned);
    
    if (hasThousandSeparator || hasGermanDecimal) {
      // Deutsches Format: Punkte entfernen, Komma zu Punkt
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Bindet German Number Handler an alle number-Inputs im Formular
   * Ermöglicht Eingabe von "13.000" oder "13000" mit gleichem Ergebnis
   */
  bindGermanNumberInputs(form) {
    if (!form) return;
    
    const numberInputs = form.querySelectorAll('input[type="number"]');
    
    numberInputs.forEach(input => {
      // Vermeide Doppelbindung
      if (input.dataset.germanNumberBound) return;
      input.dataset.germanNumberBound = 'true';
      
      // Speichere originalen type
      const originalType = input.type;
      
      // Bei Focus: Temporär auf text umschalten für freie Eingabe
      input.addEventListener('focus', () => {
        input.type = 'text';
        input.dataset.originalValue = input.value;
      });
      
      // Bei Blur: Normalisiere und zurück zu number
      input.addEventListener('blur', () => {
        const rawValue = input.value;
        const parsed = this.parseGermanNumber(rawValue);
        
        if (parsed !== null) {
          input.value = parsed;
        } else if (rawValue === '') {
          input.value = '';
        }
        // Zurück zu number type
        input.type = originalType;
        
        // Trigger change event für Auto-Calculation
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    
    console.log(`✅ German Number Handler an ${numberInputs.length} Felder gebunden`);
  }

  // Formular-Events binden
  async bindFormEvents(entity, data) {
    const form = document.getElementById(`${entity}-form`);
    if (!form) return;
    
    // German Number Inputs binden (13.000 = 13000)
    this.bindGermanNumberInputs(form);

    // Entity-Attribut für abhängige Felder setzen
    form.dataset.entity = entity;

    // Edit-Mode Kontext für DynamicDataLoader setzen
    if (data && data._isEditMode) {
      console.log('🎯 FORMEVENTS: Edit-Mode erkannt, setze Kontext für DynamicDataLoader');
      console.log('📋 FORMEVENTS: Edit-Mode Daten:', {
        entityId: data._entityId,
        unternehmenId: data.unternehmen_id,
        brancheId: data.branche_id,
        totalFields: Object.keys(data).length
      });
      
      form.dataset.editModeData = JSON.stringify(data);
      form.dataset.isEditMode = 'true';
      form.dataset.entityType = entity;
      form.dataset.entityId = data._entityId;
      
      // Bestehende Werte für Auto-Suggestion verfügbar machen
      if (data.unternehmen_id) {
        form.dataset.existingUnternehmenId = data.unternehmen_id;
        console.log('🏢 FORMEVENTS: Unternehmen-ID für Edit-Mode gesetzt:', data.unternehmen_id);
      }
      if (data.branche_id) {
        form.dataset.existingBrancheId = data.branche_id;
        console.log('🏷️ FORMEVENTS: Branche-ID für Edit-Mode gesetzt:', data.branche_id);
      }
    } else {
      console.log('ℹ️ FORMEVENTS: Kein Edit-Mode erkannt oder keine Daten verfügbar');
    }
    
    // KOOPERATION PREFILL: Wenn Formular von Kampagne kommt, Prefill-Daten setzen
    if (entity === 'kooperation' && data && data._prefillFromKampagne) {
      console.log('🎯 FORMEVENTS: Kooperation-Prefill erkannt, setze Prefill-Kontext');
      form.dataset.prefillFromKampagne = 'true';
      form.dataset.prefillData = JSON.stringify(data);
      form.dataset.entityType = entity;
    }

    // Submit-Event mit UI-States (activate → waiting → activated)
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector('.mdc-btn.mdc-btn--create');
      if (!btn) {
        await this.formSystem.handleFormSubmit(entity, data, form);
        return;
      }

      // Guard: Mehrfachklick verhindern
      if (btn.dataset.locked === 'true') return;
      btn.dataset.locked = 'true';

      const initialLabel = btn.querySelector('.mdc-btn__label')?.textContent || '';
      const labelEl = btn.querySelector('.mdc-btn__label');
      const mode = btn.getAttribute('data-mode') || (data ? 'update' : 'create');
      const entityLabel = btn.getAttribute('data-entity-label') || 'Eintrag';

      // Set loading state
      btn.classList.add('is-loading');
      if (labelEl) labelEl.textContent = mode === 'update' ? 'Wird aktualisiert…' : 'Wird angelegt…';

      // Submit ausführen
      const before = Date.now();
      const result = await this.formSystem.handleFormSubmit(entity, data, form);
      const took = Date.now() - before;

      // Wenn handleFormSubmit bereits geschlossen hat und Event gefeuert ist, abbrechen
      if (!form.isConnected) return;

      if (result && result.success === false) {
        // Fehlerfall → State zurücksetzen
        btn.classList.remove('is-loading');
        btn.dataset.locked = 'false';
        if (labelEl) labelEl.textContent = initialLabel;
        return;
      }

      // Success UI
      btn.classList.remove('is-loading');
      btn.classList.add('is-success');
      if (labelEl) labelEl.textContent = mode === 'update' ? 'Aktualisiert' : `${entityLabel} angelegt`;

      // Kurze Verzögerung für Micro-Animation, dann normaler Flow (FormSystem schließt das Modal oder Seite navigiert)
      setTimeout(() => {
        btn.dataset.locked = 'false';
        // Falls das Modal noch offen ist, nichts weiter tun; FormSystem schließt und navigiert ohnehin
      }, Math.max(400, 900 - took));
    };

    // Close-Button Event
    const closeBtn = form.querySelector('.btn-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.formSystem.closeForm();
    }

    // Dynamische Daten für Formular laden (ZUERST!)
    await this.formSystem.dataLoader.loadDynamicFormData(entity, form);

    // Searchable Select-Felder initialisieren (DANACH!)
    this.initializeSearchableSelects(form);

    // Abhängige Felder einrichten
    this.formSystem.dependentFields.setupDependentFields(form);
    
    // KOOPERATION PREFILL: NACH allem anderen die Felder vorausfüllen!
    if (entity === 'kooperation' && form.dataset.prefillFromKampagne === 'true') {
      console.log('🎯 FORMEVENTS: Starte Kooperation-Prefill NACH DependentFields...');
      
      // DEBUG: Prüfe ob Methode existiert
      console.log('🔍 DEBUG: dataLoader vorhanden?', !!this.formSystem.dataLoader);
      console.log('🔍 DEBUG: handleKooperationPrefill Typ:', typeof this.formSystem.dataLoader?.handleKooperationPrefill);
      
      try {
        await this.formSystem.dataLoader.handleKooperationPrefill(form);
        console.log('✅ FORMEVENTS: handleKooperationPrefill abgeschlossen');
        
        // FIX: Nach Prefill change-Event auf kampagne_id dispatchen,
        // damit Video-Limits korrekt aktualisiert werden
        const kampagneSelect = form.querySelector('select[name="kampagne_id"]');
        if (kampagneSelect && kampagneSelect.value) {
          console.log('🔄 FORMEVENTS: Dispatche change-Event für kampagne_id nach Prefill:', kampagneSelect.value);
          // Kleiner Delay um sicherzustellen dass DOM stabil ist
          setTimeout(() => {
            kampagneSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }, 50);
        }
      } catch (error) {
        console.error('❌ FORMEVENTS: Fehler in handleKooperationPrefill:', error);
      }
    }

    // Adressen-Felder einrichten
    this.setupAddressesFields(form);

    // Videos-Felder einrichten
    this.setupVideosFields(form);

    // Auto-Generierung einrichten
    this.formSystem.autoGeneration.setupAutoGeneration(form);

    // Auto-Berechnung einrichten
    this.formSystem.autoCalculation.initializeAutoCalculation(form);

    // Spezielle Events für verschiedene Entity-Typen
    this.setupEntitySpecificEvents(entity, form);
  }

  // Entity-spezifische Events
  setupEntitySpecificEvents(entity, form) {
    switch (entity) {
      case 'auftrag':
        this.setupAuftragEvents(form);
        break;
      case 'kampagne':
        this.setupKampagneEvents(form);
        break;
      case 'kooperation':
        this.setupKooperationEvents(form);
        break;
      case 'rechnung':
        this.setupRechnungEvents(form);
        break;
      default:
        break;
    }
  }

  // Auftrag-spezifische Events
  setupAuftragEvents(form) {
    // Deckungsbeitrag-Berechnung
    const bruttobetragInput = form.querySelector('input[name="bruttobetrag"]');
    const deckungsbeitragProzentInput = form.querySelector('input[name="deckungsbeitrag_prozent"]');
    const deckungsbeitragBetragInput = form.querySelector('input[name="deckungsbeitrag_betrag"]');

    if (bruttobetragInput && deckungsbeitragProzentInput && deckungsbeitragBetragInput) {
      const calculateDeckungsbeitrag = () => {
        const bruttobetrag = parseFloat(bruttobetragInput.value) || 0;
        const prozent = parseFloat(deckungsbeitragProzentInput.value) || 0;
        const deckungsbeitrag = (bruttobetrag * prozent) / 100;
        deckungsbeitragBetragInput.value = deckungsbeitrag.toFixed(2);
      };

      bruttobetragInput.addEventListener('input', calculateDeckungsbeitrag);
      deckungsbeitragProzentInput.addEventListener('input', calculateDeckungsbeitrag);
    }

    // RE-Fälligkeit automatisch berechnen aus Rechnung gestellt am + Zahlungsziel
    const rechnungGestelltAm = form.querySelector('input[name="rechnung_gestellt_am"]');
    const zahlungszielTage = form.querySelector('select[name="zahlungsziel_tage"]');
    const reFaelligkeit = form.querySelector('input[name="re_faelligkeit"]');

    if (rechnungGestelltAm && zahlungszielTage && reFaelligkeit) {
      const calculateReFaelligkeit = () => {
        const datum = rechnungGestelltAm.value;
        const tage = parseInt(zahlungszielTage.value) || 0;
        if (datum && tage >= 0) {
          const date = new Date(datum);
          date.setDate(date.getDate() + tage);
          reFaelligkeit.value = date.toISOString().split('T')[0];
        } else if (!datum) {
          reFaelligkeit.value = '';
        }
      };
      rechnungGestelltAm.addEventListener('change', calculateReFaelligkeit);
      zahlungszielTage.addEventListener('change', calculateReFaelligkeit);
      // Initial berechnen falls Werte vorhanden
      calculateReFaelligkeit();
    }
  }

  // Kampagne-spezifische Events - Dynamische Felder basierend auf Kampagnenarten des Auftrags
  setupKampagneEvents(form) {
    console.log('🎯 FORMEVENTS: setupKampagneEvents gestartet');
    
    // Container für dynamische Kampagnenart-Felder finden oder erstellen
    let fieldsContainer = form.querySelector('#kampagnenart-felder-container');
    
    // Wenn kein Container existiert, nach dem kampagnenart_felder_container Feld suchen
    if (!fieldsContainer) {
      const customField = form.querySelector('.kampagnenart-felder-container');
      if (customField) {
        fieldsContainer = customField;
      }
    }
    
    // Fallback: Am Ende des Formulars einfügen (vor den Buttons)
    if (!fieldsContainer) {
      const actionsDiv = form.querySelector('.form-actions, .drawer-actions');
      fieldsContainer = document.createElement('div');
      fieldsContainer.id = 'kampagnenart-felder-container';
      fieldsContainer.className = 'kampagnenart-felder-container';
      if (actionsDiv) {
        actionsDiv.parentNode.insertBefore(fieldsContainer, actionsDiv);
      } else {
        form.appendChild(fieldsContainer);
      }
    }
    
    // Auftrag-Select finden (das ist der Trigger für die dynamischen Felder!)
    const auftragSelect = form.querySelector('select[name="auftrag_id"]');
    if (!auftragSelect) {
      console.log('⚠️ FORMEVENTS: auftrag_id Select nicht gefunden');
      return;
    }
    
    // Kampagnenarten-Mapping laden und Events binden
    const initDynamicFields = async () => {
      try {
        const { KAMPAGNENARTEN_MAPPING, generateFieldsHtml } = await import('../../../modules/auftrag/logic/KampagnenartenMapping.js');
        
        // Funktion zum Laden der Kampagnenarten eines Auftrags
        const loadKampagnenartenForAuftrag = async (auftragId) => {
          if (!auftragId || !window.supabase) return [];
          
          try {
            // Lade Kampagnenarten aus der auftrag_kampagne_art Junction-Tabelle
            const { data: auftragArten, error } = await window.supabase
              .from('auftrag_kampagne_art')
              .select(`
                kampagne_art_typen:kampagne_art_id(id, name)
              `)
              .eq('auftrag_id', auftragId);
            
            if (error) {
              console.error('❌ FORMEVENTS: Fehler beim Laden der Auftrag-Kampagnenarten:', error);
              return [];
            }
            
            const artenNamen = (auftragArten || [])
              .map(item => item.kampagne_art_typen?.name)
              .filter(Boolean);
            
            console.log('📋 FORMEVENTS: Kampagnenarten des Auftrags:', artenNamen);
            return artenNamen;
          } catch (error) {
            console.error('❌ FORMEVENTS: Fehler:', error);
            return [];
          }
        };
        
        // Funktion zum Rendern der dynamischen Felder
        const renderDynamicFields = async () => {
          const selectedAuftragId = auftragSelect.value;
          console.log('🔄 FORMEVENTS: Auftrag geändert:', selectedAuftragId);
          
          // Edit-Mode: Bestehende Werte aus form.dataset.editModeData laden
          let editModeValues = {};
          if (form.dataset.editModeData) {
            try {
              const editData = JSON.parse(form.dataset.editModeData);
              // Nur Kampagnenart-Felder extrahieren (enden auf _video_anzahl, _creator_anzahl, etc.)
              const kampagnenartSuffixes = ['_video_anzahl', '_creator_anzahl', '_bilder_anzahl', '_videographen_anzahl'];
              for (const [key, value] of Object.entries(editData)) {
                if (kampagnenartSuffixes.some(suffix => key.endsWith(suffix)) && value !== undefined && value !== null) {
                  editModeValues[key] = value;
                }
              }
              console.log('📋 FORMEVENTS: Edit-Mode-Werte für Kampagnenart-Felder:', editModeValues);
            } catch (e) {
              console.warn('⚠️ FORMEVENTS: Fehler beim Parsen von editModeData:', e);
            }
          }
          
          // Aktuelle Werte aus bestehenden Feldern sammeln (für Erhaltung bei Re-Render)
          // DOM-Werte haben Priorität über Edit-Mode-Werte (für Re-Render während Bearbeitung)
          const domValues = {};
          fieldsContainer.querySelectorAll('input, textarea').forEach(input => {
            if (input.name && input.value) {
              domValues[input.name] = input.value;
            }
          });
          
          // Merge: Edit-Mode-Werte als Basis, DOM-Werte überschreiben (falls vorhanden)
          const existingValues = { ...editModeValues, ...domValues };
          
          // Container leeren
          fieldsContainer.innerHTML = '';
          
          if (!selectedAuftragId) {
            fieldsContainer.innerHTML = '<p class="form-hint" style="padding: 1rem; color: var(--text-secondary); font-style: italic;">Bitte wählen Sie einen Auftrag aus, um die Produktionsdetails anzuzeigen.</p>';
            return;
          }
          
          // Loading-Anzeige
          fieldsContainer.innerHTML = '<p class="form-hint" style="padding: 1rem; color: var(--text-secondary);"><span class="loading-spinner" style="display: inline-block; width: 16px; height: 16px; border: 2px solid #ddd; border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px;"></span>Lade Produktionsdetails...</p>';
          
          // Kampagnenarten des Auftrags laden
          const artenNamen = await loadKampagnenartenForAuftrag(selectedAuftragId);
          
          if (artenNamen.length === 0) {
            fieldsContainer.innerHTML = '<p class="form-hint" style="padding: 1rem; color: var(--color-warning); background: rgba(255,193,7,0.1); border-radius: 8px;">Für diesen Auftrag wurden noch keine Kampagnenarten hinterlegt. Bitte zuerst im Auftrag die "Art der Kampagne" auswählen.</p>';
            return;
          }
          
          // Für jede Kampagnenart des Auftrags Felder generieren
          let fieldsHtml = '<div class="kampagnenart-fields-wrapper" style="margin-top: 1rem;">';
          fieldsHtml += '<h4 style="margin-bottom: 1rem; color: var(--text-primary); font-weight: 600;">Produktionsdetails</h4>';
          
          artenNamen.forEach(artName => {
            if (KAMPAGNENARTEN_MAPPING[artName]) {
              fieldsHtml += generateFieldsHtml(artName, existingValues, false);
            } else {
              console.log(`⚠️ FORMEVENTS: Unbekannte Kampagnenart: "${artName}"`);
            }
          });
          
          fieldsHtml += '</div>';
          fieldsContainer.innerHTML = fieldsHtml;
          
          // Stepper-Button Events binden
          this.bindStepperEvents(fieldsContainer);
          
          // CSS für Spinner Animation hinzufügen (falls nicht vorhanden)
          if (!document.getElementById('kampagnenart-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'kampagnenart-spinner-style';
            style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
          }
        };
        
        // Event-Listener auf Auftrag-Select
        auftragSelect.addEventListener('change', renderDynamicFields);
        
        // Initial rendern (falls bereits ein Auftrag ausgewählt ist, z.B. im Edit-Mode)
        if (auftragSelect.value) {
          setTimeout(renderDynamicFields, 200);
        } else {
          fieldsContainer.innerHTML = '<p class="form-hint" style="padding: 1rem; color: var(--text-secondary); font-style: italic;">Bitte wählen Sie einen Auftrag aus, um die Produktionsdetails anzuzeigen.</p>';
        }
        
      } catch (error) {
        console.error('❌ FORMEVENTS: Fehler beim Initialisieren der dynamischen Felder:', error);
      }
    };
    
    initDynamicFields();
  }

  // Rechnung-spezifische Events: Kooperation → fülle Unternehmen/Auftrag/Videoanzahl/Beträge
  async setupRechnungEvents(form) {
    const koopSelect = form.querySelector('select[name="kooperation_id"]');
    if (!koopSelect || !window.supabase) return;

    const unternehmenField = form.querySelector('select[name="unternehmen_id"]');
    const auftragField = form.querySelector('select[name="auftrag_id"]');
    const creatorField = form.querySelector('select[name="creator_id"]');
    const kampagneField = form.querySelector('select[name="kampagne_id"]');
    const videoInput = form.querySelector('input[name="videoanzahl"]');
    const nettoInput = form.querySelector('input[name="nettobetrag"]');
    const zusatzInput = form.querySelector('input[name="zusatzkosten"]');
    const ustInput = form.querySelector('input[name="ust"]');
    const bruttoInput = form.querySelector('input[name="bruttobetrag"]');

    // Original Placeholder speichern für Reset
    [unternehmenField, auftragField, creatorField, kampagneField].forEach(field => {
      if (field) {
        const container = field.parentNode.querySelector('.searchable-select-container');
        if (container) {
          const input = container.querySelector('.searchable-select-input');
          if (input && input.placeholder) {
            field.setAttribute('data-original-placeholder', input.placeholder);
          }
        }
      }
    });

    const fillSelect = (selectEl, value, label) => {
      if (!selectEl) return;
      
      // Original Select aktualisieren
      selectEl.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = value || '';
      opt.textContent = label || '—';
      selectEl.appendChild(opt);
      selectEl.value = value || '';
      selectEl.disabled = true;
      
      // Sichtbare Searchable-UI aktualisieren
      const container = selectEl.parentNode.querySelector('.searchable-select-container');
      if (container) {
        const input = container.querySelector('.searchable-select-input');
        if (input) {
          input.value = label || '';
          // Readonly-Zustand setzen
          if (selectEl.getAttribute('data-readonly') === 'true') {
            input.setAttribute('disabled', 'true');
            input.classList.add('is-disabled');
          }
          // Custom Validierung für required Felder aktualisieren
          if (input.hasAttribute('data-was-required')) {
            if (value && value.trim() !== '') {
              input.setCustomValidity(''); // Fehler löschen wenn Wert gesetzt
            } else {
              input.setCustomValidity('Dieses Feld ist erforderlich.');
            }
          }
        }
      }
      
      // Hidden mirror setzen, damit submitData den Wert enthält
      const hidden = document.getElementById(`${selectEl.id}-hidden`);
      if (hidden) hidden.value = value || '';
    };

    const onKoopChange = async () => {
      const koopId = koopSelect.value;
      if (!koopId) {
        // Wenn keine Kooperation ausgewählt ist, alle abhängigen Felder leeren (bleiben readonly!)
        const fieldsToReset = [
          { field: auftragField, placeholder: 'Auftrag wird automatisch gesetzt' },
          { field: unternehmenField, placeholder: 'Unternehmen wird automatisch gesetzt' },
          { field: kampagneField, placeholder: 'Kampagne wird automatisch gesetzt' },
          { field: creatorField, placeholder: 'Creator wird automatisch gesetzt' }
        ];
        
        fieldsToReset.forEach(({ field, placeholder }) => {
          if (field) {
            // Felder bleiben readonly/disabled - nur Werte leeren
            field.innerHTML = '<option value="">—</option>';
            field.value = '';
            
            // Searchable Select UI aktualisieren (bleibt disabled)
            const container = field.parentNode.querySelector('.searchable-select-container');
            if (container) {
              const input = container.querySelector('.searchable-select-input');
              if (input) {
                input.value = '';
                input.placeholder = placeholder;
              }
            }
            
            // Hidden mirror leeren
            const hidden = document.getElementById(`${field.id}-hidden`);
            if (hidden) hidden.value = '';
          }
        });
        
        // Felder leeren
        if (videoInput) videoInput.value = '';
        if (nettoInput) nettoInput.value = '';
        if (zusatzInput) zusatzInput.value = '';
        if (bruttoInput) bruttoInput.value = '';
        
        return;
      }
      // Hole Kooperation ohne FK-Expansions (robust gegen fehlende FK in Schema)
      const { data: koop, error } = await window.supabase
        .from('kooperationen')
        .select('id, name, unternehmen_id, kampagne_id, einkaufspreis_netto, einkaufspreis_gesamt, einkaufspreis_zusatzkosten, videoanzahl')
        .eq('id', koopId)
        .single();
      if (error) {
        console.error('❌ Fehler beim Laden der Kooperation:', error);
        return;
      }

      // Unternehmen-Namen laden
      let unternehmenLabel = '';
      if (koop?.unternehmen_id) {
        try {
          const { data: u } = await window.supabase
            .from('unternehmen')
            .select('id, firmenname')
            .eq('id', koop.unternehmen_id)
            .single();
          unternehmenLabel = u?.firmenname || '';
        } catch (err) {
          console.warn('⚠️ Fehler beim Laden des Unternehmens für Kooperation:', err?.message);
        }
      }
      fillSelect(unternehmenField, koop?.unternehmen_id || '', unternehmenLabel);

      // Auftrag und Kampagne über einen optimierten Query laden (statt 3 separate Queries)
      let auftragsId = null;
      let auftragsName = '';
      let kampName = '';

      if (koop?.kampagne_id) {
        try {
          // Optimierter Query: Kampagne mit Auftrag in einem Query laden
          const { data: kampagneData, error: kampError } = await window.supabase
            .from('kampagne')
            .select('id, kampagnenname, eigener_name, auftrag_id, auftrag:auftrag_id(id, auftragsname)')
            .eq('id', koop.kampagne_id)
            .single();
          
          if (kampError) {
            console.error('❌ Fehler beim Laden der Kampagne:', kampError);
          } else if (kampagneData) {
            console.log('📊 Kampagne geladen:', kampagneData);
            kampName = KampagneUtils.getDisplayName(kampagneData);
            auftragsId = kampagneData.auftrag_id || null;
            auftragsName = kampagneData.auftrag?.auftragsname || '';
          }
        } catch (e) {
          console.error('❌ Unerwarteter Fehler beim Laden der Kampagne/Auftrag:', e);
        }
      }

      // Kampagne setzen mit besserem Fallback (keine UUID mehr anzeigen)
      if (kampagneField) {
        const kampLabel = kampName || (koop?.kampagne_id ? 'Unbenannte Kampagne' : '');
        fillSelect(kampagneField, koop?.kampagne_id || '', kampLabel);
      }

      // Auftrag setzen mit besserem Fallback (keine UUID mehr anzeigen)
      fillSelect(auftragField, auftragsId, auftragsName || (auftragsId ? 'Unbenannter Auftrag' : ''));

      // Wenn kein Auftrag automatisch gesetzt werden konnte, Warnung anzeigen (Feld bleibt readonly!)
      if (!auftragsId && auftragField) {
        console.warn('⚠️ Auftrag konnte nicht automatisch gesetzt werden. Kampagne hat keinen verknüpften Auftrag.');
        // Feld bleibt readonly - zeige Hinweis im Placeholder
        const container = auftragField.parentNode.querySelector('.searchable-select-container');
        if (container) {
          const input = container.querySelector('.searchable-select-input');
          if (input) {
            input.value = '';
            input.placeholder = 'Kein Auftrag verknüpft - bitte Kampagne prüfen';
          }
        }
      }

      // Creator aus Kooperation laden (falls vorhanden)
      if (creatorField) {
        try {
          // Falls kooperation Creator referenziert
          const { data: koopCreator } = await window.supabase
            .from('kooperationen')
            .select('creator_id')
            .eq('id', koopId)
            .single();
          const creatorId = koopCreator?.creator_id || null;
          let creatorLabel = '';
          if (creatorId) {
            const { data: creator } = await window.supabase
              .from('creator')
              .select('id, vorname, nachname')
              .eq('id', creatorId)
              .single();
            creatorLabel = creator ? `${creator.vorname || ''} ${creator.nachname || ''}`.trim() : '';
          }
          fillSelect(creatorField, creatorId, creatorLabel);
        } catch (e) {
          console.warn('⚠️ Konnte Creator nicht laden:', e);
        }
      }

      // Videoanzahl aus Kooperation
      if (videoInput) videoInput.value = koop?.videoanzahl || '';

      // Beträge aus Kooperation: Netto, Zusatzkosten, USt, Brutto (Einkaufspreis!)
      const netto = parseFloat(koop?.einkaufspreis_netto || 0) || 0;
      const zusatz = parseFloat(koop?.einkaufspreis_zusatzkosten || 0) || 0;
      const brutto = (koop?.einkaufspreis_gesamt != null) ? koop.einkaufspreis_gesamt : (netto + zusatz);
      if (nettoInput) nettoInput.value = netto ? String(netto) : '';
      if (zusatzInput) zusatzInput.value = zusatz ? String(zusatz) : '';
      if (bruttoInput) bruttoInput.value = isNaN(brutto) ? '' : String(brutto);
    };

    koopSelect.addEventListener('change', onKoopChange);
    
    // === Live-Berechnung für UST, Skonto und Brutto ===
    const skontoToggle = form.querySelector('input[name="skonto"]');
    const nettoGesamtInput = form.querySelector('input[name="netto_gesamt"]');
    const bruttoVorSkontoInput = form.querySelector('input[name="brutto_vor_skonto"]');
    const skontoBetragInput = form.querySelector('input[name="skonto_betrag"]');
    const nettoNachSkontoInput = form.querySelector('input[name="netto_nach_skonto"]');
    const ustBetragInput = form.querySelector('input[name="ust_betrag"]');
    
    const berechneRechnung = () => {
      const netto = parseFloat(nettoInput?.value) || 0;
      const zusatz = parseFloat(zusatzInput?.value) || 0;
      const hatSkonto = skontoToggle?.checked || false;
      
      const nettoGesamt = netto + zusatz;
      const bruttoVorSkonto = nettoGesamt * 1.19;
      const skontoBetrag = hatSkonto ? nettoGesamt * 0.03 : 0;
      const nettoNachSkonto = nettoGesamt - skontoBetrag;
      const ustBetrag = nettoNachSkonto * 0.19;
      const brutto = nettoNachSkonto + ustBetrag;
      
      // Felder aktualisieren
      if (nettoGesamtInput) nettoGesamtInput.value = nettoGesamt.toFixed(2);
      if (bruttoVorSkontoInput) bruttoVorSkontoInput.value = bruttoVorSkonto.toFixed(2);
      if (skontoBetragInput) skontoBetragInput.value = skontoBetrag.toFixed(2);
      if (nettoNachSkontoInput) nettoNachSkontoInput.value = nettoNachSkonto.toFixed(2);
      if (ustBetragInput) ustBetragInput.value = ustBetrag.toFixed(2);
      if (bruttoInput) bruttoInput.value = brutto.toFixed(2);
    };
    
    // Event-Listener für Berechnung
    if (nettoInput) nettoInput.addEventListener('input', berechneRechnung);
    if (zusatzInput) zusatzInput.addEventListener('input', berechneRechnung);
    if (skontoToggle) skontoToggle.addEventListener('change', berechneRechnung);
    
    // Initial: Wenn keine Kooperation vorausgewählt ist, alle Felder für manuelle Eingabe freischalten
    if (!koopSelect.value) {
      setTimeout(() => onKoopChange(), 100); // Kurz warten bis das Formular vollständig geladen ist
    }
    
    // Initial bei Formularstart (falls vorausgewählt)
    onKoopChange();
    
    // Initiale Berechnung nach kurzer Verzögerung (wenn Werte aus Kooperation geladen wurden)
    setTimeout(berechneRechnung, 200);
  }

  // Kooperation-spezifische Events
  setupKooperationEvents(form) {
    // Videoanzahl dynamisch auf verbleibende Videos der Kampagne begrenzen
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

    // Stepper-UI aufbauen (einmalig) und Input verstecken
    const attachStepper = () => {
      if (videoInput.dataset.stepperAttached === 'true') return;
      // Kein sichtbares Input-Feld – als Hidden nutzen
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

      // Container einfügen: Input behalten (für Form-Wert), Stepper daneben
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
        info.textContent = max > 0 ? `${selected} ${sSel} | Rest: ${remainingAfter}` : 'Bitte zuerst Kampagne wählen';
        minusBtn.disabled = max === 0 || selected <= (parseInt(videoInput.min || '0', 10) || 0);
        plusBtn.disabled = max === 0 || selected >= max;
      };

      const syncVideosToCount = () => {
        if (!videosList) return;
        const desired = parseInt(videoInput.value || '0', 10) || 0;
        const current = videosList.querySelectorAll('.video-item').length;
        if (desired > current) {
          for (let i = 0; i < (desired - current); i++) {
            this.addVideoRow(videosList, contentArtOptions);
          }
        } else if (desired < current) {
          for (let i = 0; i < (current - desired); i++) {
            const last = videosList.querySelector('.video-item:last-of-type');
            if (last) last.remove();
          }
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

      // Sync, wenn Nutzer tippt
      videoInput.addEventListener('input', () => {
        videoInput.value = clamp(videoInput.value);
        updateInfo();
        syncVideosToCount();
      });

      videoInput.dataset.stepperAttached = 'true';
      // Erste Anzeige
      updateInfo();
    };

    attachStepper();

    // Hilfsfunktion: Stepper in Sync bringen (ohne Helper-Zeile)
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
        stepperInfo.textContent = max > 0 ? `${selected} ${sSel} | Rest: ${remainingAfter}` : 'Bitte zuerst Kampagne wählen';
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

    const updateVideoLimits = async () => {
      const kampagneId = kampagneSelect.value;
      if (!kampagneId) {
        videoInput.disabled = true;
        videoInput.removeAttribute('max');
        videoInput.removeAttribute('min');
        videoInput.value = '';
        refreshStepperUI();
        // Bei Reset auch Videos leeren
        if (videosList) videosList.innerHTML = '';
        return;
      }

      try {
        // Gesamtanzahl Videos aus der Kampagne laden (alle Video-Typen summieren)
        const { data: kampagne, error: kampagneError } = await window.supabase
          .from('kampagne')
          .select('videoanzahl, ugc_video_anzahl, igc_video_anzahl, influencer_video_anzahl, vor_ort_video_anzahl')
          .eq('id', kampagneId)
          .single();
        if (kampagneError) {
          console.error('❌ Fehler beim Laden der Kampagne (videoanzahl):', kampagneError);
          return;
        }
        // Nutze videoanzahl falls vorhanden, sonst Summe der einzelnen Typen
        const totalVideos = kampagne?.videoanzahl || (
          (parseInt(kampagne?.ugc_video_anzahl, 10) || 0) +
          (parseInt(kampagne?.igc_video_anzahl, 10) || 0) +
          (parseInt(kampagne?.influencer_video_anzahl, 10) || 0) +
          (parseInt(kampagne?.vor_ort_video_anzahl, 10) || 0)
        );
        console.log('📊 KOOPERATION: Kampagne Video-Anzahlen:', {
          videoanzahl: kampagne?.videoanzahl,
          ugc: kampagne?.ugc_video_anzahl,
          igc: kampagne?.igc_video_anzahl,
          influencer: kampagne?.influencer_video_anzahl,
          vor_ort: kampagne?.vor_ort_video_anzahl,
          total: totalVideos
        });

        // Bereits verplante Videos in Kooperationen summieren
        // Im Edit-Modus: Aktuelle Kooperation ausschließen (deren Videos sind ja verfügbar)
        const currentKoopId = form.dataset.entityId;
        let koopQuery = window.supabase
          .from('kooperationen')
          .select('id, videoanzahl')
          .eq('kampagne_id', kampagneId);
        
        // Im Edit-Modus die aktuelle Kooperation ausschließen
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
        
        console.log('📊 KOOPERATION: Video-Berechnung:', {
          totalVideos,
          usedVideos,
          remaining,
          currentKoopId,
          excludedFromCalc: !!currentKoopId
        });

        // Eingabefeld konfigurieren
        videoInput.disabled = remaining === 0;
        videoInput.min = remaining > 0 ? '1' : '0';
        videoInput.max = String(remaining);
        videoInput.step = '1';

        // Wert einklammern
        if (videoInput.value) {
          videoInput.value = clampValue(videoInput.value, 1, remaining);
        } else if (remaining > 0) {
          // Standardwert auf 1 setzen, wenn möglich
          videoInput.value = '1';
        }
        // Stepper aktualisieren (Info + Buttons)
        refreshStepperUI();
        // Nach Anpassung Anzahl → Items synchronisieren
        const desired = parseInt(videoInput.value || '0', 10) || 0;
        if (videosList) {
          const current = videosList.querySelectorAll('.video-item').length;
          if (desired !== current) {
            const diff = desired - current;
            if (diff > 0) {
              for (let i = 0; i < diff; i++) this.addVideoRow(videosList, contentArtOptions);
            } else {
              for (let i = 0; i < Math.abs(diff); i++) {
                const last = videosList.querySelector('.video-item:last-of-type');
                if (last) last.remove();
              }
            }
          }
        }

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
      // Sync Videos bei Änderung
      if (videosList) {
        const desired = parseInt(videoInput.value || '0', 10) || 0;
        const current = videosList.querySelectorAll('.video-item').length;
        if (desired !== current) {
          const diff = desired - current;
          if (diff > 0) {
            for (let i = 0; i < diff; i++) this.addVideoRow(videosList, contentArtOptions);
          } else {
            for (let i = 0; i < Math.abs(diff); i++) {
              const last = videosList.querySelector('.video-item:last-of-type');
              if (last) last.remove();
            }
          }
        }
      }
    });

    // Submit-Guard: sicherstellen, dass der Wert nicht über Remaining liegt
    form.addEventListener('submit', async (e) => {
      const kampagneId = kampagneSelect.value;
      if (!kampagneId) return;
      try {
        const { data: kampagne } = await window.supabase
          .from('kampagne')
          .select('videoanzahl, ugc_video_anzahl, igc_video_anzahl, influencer_video_anzahl, vor_ort_video_anzahl')
          .eq('id', kampagneId)
          .single();
        // Nutze videoanzahl falls vorhanden, sonst Summe der einzelnen Typen
        const totalVideos = kampagne?.videoanzahl || (
          (parseInt(kampagne?.ugc_video_anzahl, 10) || 0) +
          (parseInt(kampagne?.igc_video_anzahl, 10) || 0) +
          (parseInt(kampagne?.influencer_video_anzahl, 10) || 0) +
          (parseInt(kampagne?.vor_ort_video_anzahl, 10) || 0)
        );
        const { data: existingKoops } = await window.supabase
          .from('kooperationen')
          .select('videoanzahl')
          .eq('kampagne_id', kampagneId);
        const usedVideos = (existingKoops || []).reduce((sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 0);
        const remaining = Math.max(0, totalVideos - usedVideos);
        const desired = parseInt(videoInput.value || '0', 10) || 0;
        if (desired > remaining) {
          e.preventDefault();
          videoInput.value = clampValue(videoInput.value, remaining > 0 ? 1 : 0, remaining);
          alert('Die gewählte Video Anzahl überschreitet die verfügbaren Videos dieser Kampagne.');
          refreshStepperUI();
        }
      } catch (_) {
        // Ignorieren, falls offline / Fehler – Browser-Constraints greifen
      }
    });

    // Initial ausführen
    updateVideoLimits();
    
    // FIX: Bei prefilled Formularen oder Edit-Mode nochmal mit Delay aufrufen,
    // um sicherzustellen dass der DOM-Wert korrekt synchronisiert ist
    if (form.dataset.prefillFromKampagne === 'true' || form.dataset.isEditMode === 'true') {
      console.log('🔄 KOOPERATION: Warte auf DOM-Synchronisation für Video-Limits (prefill/edit)...');
      setTimeout(() => {
        console.log('🔄 KOOPERATION: Aktualisiere Video-Limits, kampagne_id:', kampagneSelect.value);
        updateVideoLimits();
      }, 300); // Etwas länger warten im Edit-Mode da DependentFields laden müssen
    }

    // Beim Edit: vorhandene Videos vorausfüllen
    (async () => {
      try {
        const koopId = form.dataset.entityId;
        if (!koopId || !window.supabase || !videosList) return;
        const { data: rows, error } = await window.supabase
          .from('kooperation_videos')
          .select('id, content_art, titel, asset_url, kommentar, position')
          .eq('kooperation_id', koopId)
          .order('position', { ascending: true });
        if (error) return;
        (rows || []).forEach(r => this.addVideoRow(videosList, contentArtOptions, r));
        // Anzahl synchronisieren und UI updaten
        videoInput.value = String((rows || []).length || '');
        refreshStepperUI();
      } catch (err) {
        console.warn('⚠️ Fehler beim Laden der Kooperations-Videos:', err?.message);
      }
      
      // Nochmal Video-Limits aktualisieren falls Kampagne inzwischen geladen
      setTimeout(() => {
        if (kampagneSelect.value && !videoInput.max) {
          console.log('🔄 KOOPERATION EDIT: Kampagne jetzt verfügbar, aktualisiere Limits');
          updateVideoLimits();
        }
      }, 500);
    })();
  }

  // Searchable Selects initialisieren
  initializeSearchableSelects(form) {
    // DEAKTIVIERT: Wird bereits vom Haupt-FormSystem erledigt
    // Das verhindert doppelte Multi-Select Felder
    console.log('⚠️ FormEvents.initializeSearchableSelects deaktiviert - wird vom Haupt-FormSystem übernommen');
    return;
    
    /*
    const searchableSelects = form.querySelectorAll('select[data-searchable="true"]');
    
    searchableSelects.forEach(select => {
      this.formSystem.createSearchableSelect(select, [], {});
    });
    */
  }

  // Adressen-Felder einrichten
  setupAddressesFields(form) {
    const addressesContainers = form.querySelectorAll('.addresses-container');
    
    addressesContainers.forEach(container => {
      const addBtn = container.querySelector('.add-address-btn');
      const addressesList = container.querySelector('.addresses-list');
      
      if (addBtn && addressesList) {
        addBtn.addEventListener('click', () => {
          this.addAddressRow(addressesList);
        });
      }
    });
  }

  // Videos-Felder einrichten
  setupVideosFields(form) {}

  addVideoRow(list, contentArtOptions = [], initial = {}) {
    const itemId = `video-${Date.now()}`;
    const optionsHtml = ['<option value="">Bitte wählen</option>']
      .concat(contentArtOptions.map(o => `<option value="${o}" ${initial.content_art === o ? 'selected' : ''}>${o}</option>`))
      .join('');
    const html = `
      <div class="video-item video-item-compact" data-video-id="${itemId}">
        <label class="sr-only">Content Art</label>
        <select name="video_content_art_${itemId}" class="video-content-select">
          ${optionsHtml}
        </select>
      </div>`;
    list.insertAdjacentHTML('beforeend', html);
  }

  // Neue Adresszeile hinzufügen
  addAddressRow(addressesList) {
    const addressId = `address-${Date.now()}`;
    const addressHtml = `
      <div class="address-item" data-address-id="${addressId}" style="
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        background: #f9fafb;
      ">
        <div class="address-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        ">
          <h4>Adresse ${addressId}</h4>
          <button type="button" class="btn-remove-address" onclick="this.closest('.address-item').remove()" style="
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
            Entfernen
          </button>
        </div>
        <div class="address-fields" style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        ">
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Adressname</label>
            <input type="text" name="adressname_${addressId}" placeholder="z.B. Hauptbüro, Filiale, etc." 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Straße</label>
            <input type="text" name="strasse_${addressId}" placeholder="Musterstraße" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Hausnummer</label>
            <input type="text" name="hausnummer_${addressId}" placeholder="123" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">PLZ</label>
            <input type="text" name="plz_${addressId}" placeholder="12345" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Stadt</label>
            <input type="text" name="stadt_${addressId}" placeholder="Musterstadt" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Land</label>
            <input type="text" name="land_${addressId}" placeholder="Deutschland" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Notiz</label>
            <textarea name="notiz_${addressId}" rows="2" placeholder="Zusätzliche Informationen" 
                      style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; resize: vertical;"></textarea>
          </div>
        </div>
      </div>
    `;
    
    addressesList.insertAdjacentHTML('beforeend', addressHtml);
  }

  // Hilfsfunktionen für Verfügbarkeits-Anzeige
  showAvailabilityInfo(inputElement, remaining, total, used, type) {
    // Entferne bestehende Info
    this.hideAvailabilityInfo(inputElement);
    
    // Erstelle Info-Element
    const infoDiv = document.createElement('div');
    infoDiv.className = 'availability-info';
    infoDiv.innerHTML = `
      <div class="availability-text">
        <span class="available">${remaining} ${type} verfügbar</span>
        <span class="total">von ${total} geplant (${used} bereits verplant)</span>
      </div>
      ${remaining === 0 ? '<div class="availability-warning">Keine weiteren verfügbar</div>' : ''}
    `;
    
    // Nach dem Input-Element einfügen
    inputElement.parentNode.insertBefore(infoDiv, inputElement.nextSibling);
  }

  hideAvailabilityInfo(inputElement) {
    const existingInfo = inputElement.parentNode.querySelector('.availability-info');
    if (existingInfo) {
      existingInfo.remove();
    }
  }

  // Generische Stepper-UI erstellen
  createStepperUI(inputElement, singularLabel, pluralLabel) {
    // Input verstecken
    try { inputElement.type = 'hidden'; } catch (_) { inputElement.style.display = 'none'; }
    
    // Container erstellen
    const container = document.createElement('div');
    container.className = 'number-stepper';

    // Minus-Button
    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.className = 'stepper-btn stepper-minus secondary-btn';
    minusBtn.textContent = '-';

    // Plus-Button  
    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'stepper-btn stepper-plus secondary-btn';
    plusBtn.textContent = '+';

    // Info-Anzeige
    const info = document.createElement('span');
    info.className = 'stepper-info';

    // Container zusammenbauen
    inputElement.parentNode.insertBefore(container, inputElement.nextSibling);
    container.appendChild(minusBtn);
    container.appendChild(plusBtn);
    container.appendChild(info);

    // Event-Handler
    const getBounds = () => ({
      min: parseInt(inputElement.min || '0', 10) || 0,
      max: parseInt(inputElement.max || '0', 10) || 0
    });

    const clamp = (value) => {
      const n = parseInt(value, 10);
      if (isNaN(n)) return '';
      const { min, max } = getBounds();
      if (max === 0) return '';
      return String(Math.max(min, Math.min(n, max)));
    };

    const updateInfo = () => {
      const { max } = getBounds();
      const selected = parseInt(inputElement.value || '0', 10) || 0;
      const remainingAfter = Math.max(0, max - selected);
      const label = selected === 1 ? singularLabel : pluralLabel;
      
      info.textContent = max > 0 ? `${selected} ${label} | Rest: ${remainingAfter}` : `Bitte zuerst Auftrag wählen`;
      
      minusBtn.disabled = max === 0 || selected <= getBounds().min;
      plusBtn.disabled = max === 0 || selected >= max;
    };

    // Button-Events
    minusBtn.addEventListener('click', () => {
      const { min } = getBounds();
      const cur = parseInt(inputElement.value || '0', 10) || 0;
      const next = Math.max(min, cur - 1);
      inputElement.value = clamp(String(next));
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      updateInfo();
    });

    plusBtn.addEventListener('click', () => {
      const { max } = getBounds();
      const cur = parseInt(inputElement.value || '0', 10) || 0;
      const next = Math.min(max, cur + 1);
      inputElement.value = clamp(String(next));
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      updateInfo();
    });

    // Input-Event für manuelle Eingabe
    inputElement.addEventListener('input', () => {
      inputElement.value = clamp(inputElement.value);
      updateInfo();
    });

    // Initial update
    updateInfo();
  }

  // Stepper-Events für dynamisch generierte Felder binden
  bindStepperEvents(container) {
    if (!container) return;
    
    // Alle Stepper-Buttons im Container finden
    const stepperButtons = container.querySelectorAll('.stepper-btn');
    
    stepperButtons.forEach(btn => {
      // Vermeide Doppelbindung
      if (btn.dataset.eventsBound) return;
      btn.dataset.eventsBound = 'true';
      
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.dataset.target;
        const input = container.querySelector(`#${targetId}`);
        if (!input) return;
        
        const currentValue = parseInt(input.value || '0', 10) || 0;
        const min = parseInt(input.min || '0', 10) || 0;
        const max = parseInt(input.max || '999', 10) || 999;
        
        let newValue = currentValue;
        
        if (btn.classList.contains('stepper-minus')) {
          newValue = Math.max(min, currentValue - 1);
        } else if (btn.classList.contains('stepper-plus')) {
          newValue = Math.min(max, currentValue + 1);
        }
        
        input.value = newValue;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Info-Text aktualisieren
        const stepperContainer = btn.closest('.number-stepper');
        const infoSpan = stepperContainer?.querySelector('.stepper-info');
        if (infoSpan) {
          const singular = input.dataset.singular || '';
          const plural = input.dataset.plural || '';
          const label = newValue === 1 ? singular : plural;
          infoSpan.textContent = `${newValue} ${label}`;
        }
        
        // Minus-Button deaktivieren wenn bei min
        const minusBtn = stepperContainer?.querySelector('.stepper-minus');
        const plusBtn = stepperContainer?.querySelector('.stepper-plus');
        if (minusBtn) minusBtn.disabled = newValue <= min;
        if (plusBtn) plusBtn.disabled = newValue >= max;
      });
    });
    
    // Initial alle Minus-Buttons prüfen (bei 0 deaktivieren)
    container.querySelectorAll('.number-stepper').forEach(stepper => {
      const input = stepper.querySelector('input[type="hidden"]');
      const minusBtn = stepper.querySelector('.stepper-minus');
      if (input && minusBtn) {
        const val = parseInt(input.value || '0', 10) || 0;
        const min = parseInt(input.min || '0', 10) || 0;
        minusBtn.disabled = val <= min;
      }
    });
    
    console.log(`✅ FORMEVENTS: Stepper-Events gebunden für ${stepperButtons.length} Buttons`);
  }

  // Stepper-UI aktualisieren
  updateStepperUI(inputElement, singularLabel, pluralLabel, form) {
    const stepperInfo = inputElement.parentNode.querySelector('.stepper-info');
    const minusBtn = inputElement.parentNode.querySelector('.stepper-minus');
    const plusBtn = inputElement.parentNode.querySelector('.stepper-plus');
    
    if (!stepperInfo || !minusBtn || !plusBtn) return;
    
    const max = parseInt(inputElement.max || '0', 10) || 0;
    const min = parseInt(inputElement.min || '0', 10) || 0;
    const selected = parseInt(inputElement.value || '0', 10) || 0;
    const remainingAfter = Math.max(0, max - selected);
    const label = selected === 1 ? singularLabel : pluralLabel;
    
    // Spezielle Behandlung für Kampagne Edit-Mode
    const isKampagneEditMode = form?.dataset?.isEditMode === 'true' && form?.dataset?.entityType === 'kampagne';
    if (isKampagneEditMode && max === 0) {
      stepperInfo.textContent = `${selected} ${label} | Kein Auftrag zugeordnet`;
    } else {
      stepperInfo.textContent = max > 0 ? `${selected} ${label} | Rest: ${remainingAfter}` : 'Bitte zuerst Auftrag wählen';
    }
    
    minusBtn.disabled = max === 0 || selected <= min;
    plusBtn.disabled = max === 0 || selected >= max;
  }
} 