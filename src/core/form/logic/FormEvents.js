export class FormEvents {
  constructor(formSystem) {
    this.formSystem = formSystem;
  }

  // Formular-Events binden
  async bindFormEvents(entity, data) {
    const form = document.getElementById(`${entity}-form`);
    if (!form) return;

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
  }

  // Kampagne-spezifische Events
  setupKampagneEvents(form) {
    const auftragSelect = form.querySelector('select[name="auftrag_id"]');
    const videoInput = form.querySelector('input[name="videoanzahl"]');
    const creatorInput = form.querySelector('input[name="creatoranzahl"]');
    if (!auftragSelect || !videoInput || !window.supabase) return;

    // Stepper-UI für Videos und Creator
    const attachStepper = () => {
      // Video-Stepper
      if (videoInput.dataset.stepperAttached !== 'true') {
        console.log('🎯 FORMEVENTS: Erstelle Video-Stepper');
        this.createStepperUI(videoInput, 'Video', 'Videos');
        videoInput.dataset.stepperAttached = 'true';
      }
      
      // Creator-Stepper
      if (creatorInput && creatorInput.dataset.stepperAttached !== 'true') {
        console.log('🎯 FORMEVENTS: Erstelle Creator-Stepper');
        this.createStepperUI(creatorInput, 'Creator', 'Creator');
        creatorInput.dataset.stepperAttached = 'true';
      }
    };

    attachStepper();

    const refreshStepperUI = () => {
      // Video-Stepper aktualisieren
      this.updateStepperUI(videoInput, 'Video', 'Videos', form);
      
      // Creator-Stepper aktualisieren (falls vorhanden)
      if (creatorInput) {
        this.updateStepperUI(creatorInput, 'Creator', 'Creator', form);
      }
    };

    const clampValue = (value, min, max) => {
      const n = parseInt(value, 10);
      if (isNaN(n)) return '';
      if (max === 0) return '';
      return String(Math.max(min, Math.min(n, max)));
    };

    const updateVideoLimits = async () => {
      const auftragId = auftragSelect.value;
      if (!auftragId) {
        videoInput.disabled = true;
        videoInput.removeAttribute('max');
        videoInput.removeAttribute('min');
        videoInput.value = '';
        refreshStepperUI();
        return;
      }

      try {
        // Gesamtanzahl Videos aus Auftrag und Auftragsdetails laden
        const { data: auftrag, error: aErr } = await window.supabase
          .from('auftrag')
          .select('id, gesamtanzahl_videos')
          .eq('id', auftragId)
          .single();
        if (aErr) {
          console.error('❌ Fehler beim Laden des Auftrags (gesamtanzahl_videos):', aErr);
          return;
        }
        
        // Auftragsdetails für erweiterte Informationen laden
        const { data: auftragsDetails, error: detailsErr } = await window.supabase
          .from('auftrag_details')
          .select('gesamt_videos, gesamt_creator')
          .eq('auftrag_id', auftragId)
          .maybeSingle();
        
        // Verwende Auftragsdetails falls verfügbar, sonst Fallback auf Auftrag
        const totalVideos = parseInt(auftragsDetails?.gesamt_videos || auftrag?.gesamtanzahl_videos, 10) || 0;

        // Bereits verplante Videos und Creator über alle Kampagnen dieses Auftrags
        let kampQuery = window.supabase
          .from('kampagne')
          .select('id, videoanzahl, creatoranzahl')
          .eq('auftrag_id', auftragId);
        const currentId = form.dataset.entityId || null;
        if (currentId) kampQuery = kampQuery.neq('id', currentId);
        const { data: kampagnen, error: kErr } = await kampQuery;
        if (kErr) {
          console.error('❌ Fehler beim Laden der Kampagnen (videoanzahl, creatoranzahl):', kErr);
          return;
        }
        const usedVideos = (kampagnen || []).reduce((sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 0);
        const usedCreators = (kampagnen || []).reduce((sum, k) => sum + (parseInt(k.creatoranzahl, 10) || 0), 0);
        const remainingVideos = Math.max(0, totalVideos - usedVideos);
        
        // Creator-Limits berechnen
        const totalCreators = parseInt(auftragsDetails?.gesamt_creator, 10) || 0;
        const remainingCreators = Math.max(0, totalCreators - usedCreators);

        // Video-Eingabefeld konfigurieren
        videoInput.disabled = remainingVideos === 0;
        videoInput.min = remainingVideos > 0 ? '1' : '0';
        videoInput.max = String(remainingVideos);
        videoInput.step = '1';

        // Video-Wert einklammern/Default
        if (videoInput.value) {
          videoInput.value = clampValue(videoInput.value, remainingVideos > 0 ? 1 : 0, remainingVideos);
        } else if (remainingVideos > 0) {
          videoInput.value = '1';
        }
        
        // Creator-Eingabefeld konfigurieren (falls vorhanden)
        if (creatorInput) {
          if (totalCreators > 0) {
            creatorInput.disabled = remainingCreators === 0;
            creatorInput.min = remainingCreators > 0 ? '1' : '0';
            creatorInput.max = String(remainingCreators);
            creatorInput.step = '1';
            
            // Creator-Wert einklammern/Default
            if (creatorInput.value) {
              creatorInput.value = clampValue(creatorInput.value, remainingCreators > 0 ? 1 : 0, remainingCreators);
            } else if (remainingCreators > 0) {
              creatorInput.value = '1';
            }
            
            // Hilfetext anzeigen
            this.showAvailabilityInfo(creatorInput, remainingCreators, totalCreators, usedCreators, 'Creator');
          } else {
            // Keine Auftragsdetails - Creator-Anzahl frei wählbar
            creatorInput.disabled = false;
            creatorInput.removeAttribute('max');
            creatorInput.removeAttribute('min');
            this.hideAvailabilityInfo(creatorInput);
          }
        }
        
        // Hilfetext für Videos anzeigen
        this.showAvailabilityInfo(videoInput, remainingVideos, totalVideos, usedVideos, 'Videos');
        
        refreshStepperUI();
      } catch (err) {
        console.error('❌ Fehler beim Aktualisieren der Kampagnen-Video-Limits:', err);
      }
    };

    auftragSelect.addEventListener('change', updateVideoLimits);
    videoInput.addEventListener('change', () => {
      const max = parseInt(videoInput.max || '0', 10) || 0;
      if (max > 0) videoInput.value = clampValue(videoInput.value, 1, max);
      refreshStepperUI();
    });

    // Submit-Guard: Hard-Limit prüfen - nutzt gleiche Logik wie updateVideoLimits
    form.addEventListener('submit', async (e) => {
      const auftragId = auftragSelect.value;
      if (!auftragId) return;
      try {
        // Gleiche Logik wie in updateVideoLimits verwenden
        const { data: auftrag } = await window.supabase
          .from('auftrag')
          .select('id, gesamtanzahl_videos')
          .eq('id', auftragId)
          .single();
        
        // Auftragsdetails für erweiterte Informationen laden
        const { data: auftragsDetails } = await window.supabase
          .from('auftrag_details')
          .select('gesamt_videos, gesamt_creator')
          .eq('auftrag_id', auftragId)
          .maybeSingle();
        
        // Verwende Auftragsdetails falls verfügbar, sonst Fallback auf Auftrag
        const totalVideos = parseInt(auftragsDetails?.gesamt_videos || auftrag?.gesamtanzahl_videos, 10) || 0;
        
        let kampQuery = window.supabase
          .from('kampagne')
          .select('videoanzahl')
          .eq('auftrag_id', auftragId);
        const currentId = form.dataset.entityId || null;
        if (currentId) kampQuery = kampQuery.neq('id', currentId);
        const { data: kampagnen } = await kampQuery;
        const usedVideos = (kampagnen || []).reduce((sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 0);
        const remaining = Math.max(0, totalVideos - usedVideos);
        const desired = parseInt(videoInput.value || '0', 10) || 0;
        
        console.log('🔍 Submit-Guard Validierung:', { 
          totalVideos, 
          usedVideos, 
          remaining, 
          desired, 
          auftragsDetails: !!auftragsDetails,
          source: auftragsDetails ? 'auftrag_details' : 'auftrag'
        });
        
        if (desired > remaining) {
          e.preventDefault();
          videoInput.value = clampValue(videoInput.value, remaining > 0 ? 1 : 0, remaining);
          alert(`Die gewählte Video Anzahl (${desired}) überschreitet die verfügbaren Videos (${remaining} von ${totalVideos} verfügbar).`);
          refreshStepperUI();
        }
      } catch (_) { /* ignore */ }
    });

    // Initial ausführen
    updateVideoLimits();
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
        // Wenn keine Kooperation ausgewählt ist, alle abhängigen Felder für manuelle Eingabe freischalten
        const fieldsToReset = [
          { field: auftragField, placeholder: 'Auftrag wählen...' },
          { field: unternehmenField, placeholder: 'Unternehmen wählen...' },
          { field: kampagneField, placeholder: 'Kampagne wählen...' },
          { field: creatorField, placeholder: 'Creator wählen...' }
        ];
        
        fieldsToReset.forEach(({ field, placeholder }) => {
          if (field) {
            field.disabled = false;
            field.setAttribute('data-readonly', 'false');
            field.innerHTML = '<option value="">Bitte wählen...</option>';
            
            // Searchable Select UI aktualisieren
            const container = field.parentNode.querySelector('.searchable-select-container');
            if (container) {
              const input = container.querySelector('.searchable-select-input');
              if (input) {
                input.removeAttribute('disabled');
                input.classList.remove('is-disabled');
                input.value = '';
                input.placeholder = placeholder;
                // Custom Validierung für required Felder
                if (input.hasAttribute('data-was-required')) {
                  input.setCustomValidity('Dieses Feld ist erforderlich.');
                }
              }
            }
            
            // Trigger reload der dynamischen Optionen wenn table-Konfiguration vorhanden
            const table = field.getAttribute('data-table');
            if (table && window.formSystem) {
              window.formSystem.loadDynamicOptions(field);
            }
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
        } catch (_) {}
      }
      fillSelect(unternehmenField, koop?.unternehmen_id || '', unternehmenLabel);

      // Auftrag über Kampagne ableiten
      let auftragsId = null;
      let auftragsName = '';
      if (koop?.kampagne_id) {
        try {
          const { data: kamp } = await window.supabase
            .from('kampagne')
            .select('auftrag_id')
            .eq('id', koop.kampagne_id)
            .single();
          auftragsId = kamp?.auftrag_id || null;
          // Kampagne ebenfalls setzen
          if (kampagneField) {
            // Kampagnenname laden
            let kampName = '';
            try {
              const { data: kamp2 } = await window.supabase
                .from('kampagne')
                .select('id, kampagnenname')
                .eq('id', koop.kampagne_id)
                .single();
              kampName = kamp2?.kampagnenname || '';
            } catch(_) {}
            fillSelect(kampagneField, koop.kampagne_id, kampName || `Kampagne ${koop.kampagne_id}`);
          }
          if (auftragsId) {
            const { data: auftrag } = await window.supabase
              .from('auftrag')
              .select('id, auftragsname')
              .eq('id', auftragsId)
              .single();
            auftragsName = auftrag?.auftragsname || '';
          }
        } catch (e) {
          console.warn('⚠️ Konnte Auftrag über Kampagne nicht laden:', e);
        }
      }
      fillSelect(auftragField, auftragsId, auftragsName || (auftragsId ? `Auftrag ${auftragsId}` : ''));
      
        // Validierung: Stelle sicher, dass auftrag_id gesetzt ist, da es in der DB required ist
        if (!auftragsId && auftragField) {
          console.warn('⚠️ Auftrag konnte nicht automatisch gesetzt werden. Feld wird für manuelle Auswahl freigeschaltet.');
          auftragField.disabled = false;
          auftragField.setAttribute('data-readonly', 'false');
          const container = auftragField.parentNode.querySelector('.searchable-select-container');
          if (container) {
            const input = container.querySelector('.searchable-select-input');
            if (input) {
              input.removeAttribute('disabled');
              input.classList.remove('is-disabled');
              input.placeholder = 'Auftrag wählen...';
              // Custom Validierung für required Felder
              if (input.hasAttribute('data-was-required')) {
                input.setCustomValidity('Dieses Feld ist erforderlich.');
              }
            }
          }
          // Dynamische Optionen laden
          const table = auftragField.getAttribute('data-table');
          if (table && window.formSystem) {
            window.formSystem.loadDynamicOptions(auftragField);
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
    
    // Initial: Wenn keine Kooperation vorausgewählt ist, alle Felder für manuelle Eingabe freischalten
    if (!koopSelect.value) {
      setTimeout(() => onKoopChange(), 100); // Kurz warten bis das Formular vollständig geladen ist
    }
    
    // Initial bei Formularstart (falls vorausgewählt)
    onKoopChange();
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
        // Gesamtanzahl Videos aus der Kampagne laden
        const { data: kampagne, error: kampagneError } = await window.supabase
          .from('kampagne')
          .select('videoanzahl')
          .eq('id', kampagneId)
          .single();
        if (kampagneError) {
          console.error('❌ Fehler beim Laden der Kampagne (videoanzahl):', kampagneError);
          return;
        }
        const totalVideos = kampagne?.videoanzahl || 0;

        // Bereits verplante Videos in Kooperationen summieren
        const { data: existingKoops, error: koopError } = await window.supabase
          .from('kooperationen')
          .select('videoanzahl')
          .eq('kampagne_id', kampagneId);
        if (koopError) {
          console.error('❌ Fehler beim Laden der Kooperationen (videoanzahl):', koopError);
          return;
        }
        const usedVideos = (existingKoops || []).reduce((sum, k) => sum + (parseInt(k.videoanzahl, 10) || 0), 0);
        const remaining = Math.max(0, totalVideos - usedVideos);

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
          .select('videoanzahl')
          .eq('id', kampagneId)
          .single();
        const totalVideos = kampagne?.videoanzahl || 0;
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
      } catch (_) {}
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