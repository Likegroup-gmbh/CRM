export class AutoGeneration {
  static MONTH_NAMES_DE = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  static formatStartMonthYear(dateValue) {
    if (!dateValue) return null;
    try {
      const d = new Date(dateValue);
      if (isNaN(d)) return null;
      return `${AutoGeneration.MONTH_NAMES_DE[d.getMonth()]} ${d.getFullYear()}`;
    } catch (_) { return null; }
  }

  // Auftragsname automatisch generieren: "Kürzel - Monat Jahr - Auftragsart"
  async autoGenerateAuftragsname(form) {
    if (form.dataset?.isEditMode === 'true' && form.dataset?.entityType === 'auftrag') return;
    try {
      const unternehmenSelect = form.querySelector('select[name="unternehmen_id"]');
      const auftragTypeSelect = form.querySelector('select[name="auftragtype"]');
      const auftragnameInput = form.querySelector('input[name="auftragsname"]');
      const startInput = form.querySelector('input[name="start"]');
      
      if (!auftragnameInput) return;
      
      let unternehmenId = unternehmenSelect?.value;
      const auftragType = auftragTypeSelect?.value;
      
      if (!unternehmenId) {
        const hiddenUnternehmen = form.querySelector('input[name="unternehmen_id_value"]') || 
                                   form.querySelector('select[name="unternehmen_id"][style*="display: none"]');
        unternehmenId = hiddenUnternehmen?.value;
      }
      
      if (!unternehmenId) {
        console.log('🔧 Auftragsname: Warte auf Unternehmen');
        return;
      }
      
      console.log(`🔧 Generiere Auftragsname für Unternehmen: ${unternehmenId}, Art: ${auftragType}`);
      
      const { data: unternehmen, error: unternehmenError } = await window.supabase
        .from('unternehmen')
        .select('firmenname, internes_kuerzel')
        .eq('id', unternehmenId)
        .single();
      
      if (unternehmenError || !unternehmen) {
        console.error('❌ Fehler beim Laden des Unternehmens:', unternehmenError);
        return;
      }
      
      const displayName = unternehmen.internes_kuerzel || unternehmen.firmenname || 'Unbekannt';
      
      const parts = [displayName];
      
      const formatted = AutoGeneration.formatStartMonthYear(startInput?.value);
      if (formatted) parts.push(formatted);
      
      if (auftragType) {
        parts.push(auftragType);
      }
      
      const auftragsname = parts.join(' - ');
      
      auftragnameInput.value = auftragsname;
      auftragnameInput.dispatchEvent(new Event('input', { bubbles: true }));
      auftragnameInput.dispatchEvent(new Event('change', { bubbles: true }));
      auftragnameInput.focus();
      auftragnameInput.blur();
      
      console.log(`✅ Auftragsname generiert: ${auftragsname}`);
      
    } catch (error) {
      console.error('❌ Fehler beim Generieren des Auftragsnamens:', error);
    }
  }

  // Kampagnenname automatisch generieren: "Kürzel - Startdatum - Kampagnentyp"
  async autoGenerateKampagnenname(form, auftragId, excludeKampagneId = null) {
    try {
      if (!auftragId) return;

      console.log(`🔧 Generiere Kampagnenname für Auftrag: ${auftragId}${excludeKampagneId ? ` (exkl. Kampagne ${excludeKampagneId})` : ''}`);

      const { data: auftrag, error: auftragError } = await window.supabase
        .from('auftrag')
        .select(`
          *,
          unternehmen:unternehmen_id(firmenname, internes_kuerzel),
          marke:marke_id(markenname)
        `)
        .eq('id', auftragId)
        .single();

      if (auftragError || !auftrag) {
        console.error('❌ Fehler beim Laden des Auftrags:', auftragError);
        return;
      }

      const displayName = auftrag.unternehmen?.internes_kuerzel || auftrag.unternehmen?.firmenname || 'Unbekannte Firma';
      
      const parts = [displayName];
      
      // Startdatum als Monat + Jahr aus dem Formular holen
      const startInput = form.querySelector('input[name="start"]');
      const formatted = AutoGeneration.formatStartMonthYear(startInput?.value);
      if (formatted) parts.push(formatted);
      
      // Kampagnentyp aus dem Formular holen
      const kampagneTypSelect = form.querySelector('select[name="kampagne_typ"]');
      const kampagneTyp = kampagneTypSelect?.value;
      if (kampagneTyp) {
        const typLabels = { paid: 'Paid', organic: 'Organic', influencer_posting: 'Influencer Posting' };
        parts.push(typLabels[kampagneTyp] || kampagneTyp);
      }
      
      const kampagnenname = parts.join(' - ');

      const kampagnennameInput = form.querySelector('input[name="kampagnenname"]');
      if (kampagnennameInput) {
        kampagnennameInput.value = kampagnenname;
        
        kampagnennameInput.dispatchEvent(new Event('input', { bubbles: true }));
        kampagnennameInput.dispatchEvent(new Event('change', { bubbles: true }));
        kampagnennameInput.focus();
        kampagnennameInput.blur();
        
        console.log(`✅ Kampagnenname generiert: ${kampagnenname}`);
        console.log(`🔍 Feld-Wert nach Setzen: "${kampagnennameInput.value}"`);
      }

    } catch (error) {
      console.error('❌ Fehler beim Generieren des Kampagnennamens:', error);
    }
  }

  // Kooperationsname automatisch generieren: "Creator Vorname Nachname X/Y"
  async autoGenerateKooperationsname(form) {
    try {
      const kampagneSelect = form.querySelector('select[name="kampagne_id"]');
      const creatorSelect = form.querySelector('select[name="creator_id"]');
      const nameInput = form.querySelector('input[name="name"]');
      if (!kampagneSelect || !creatorSelect || !nameInput) return;

      const kampagneId = kampagneSelect.value;
      const creatorId = creatorSelect.value;
      if (!kampagneId || !creatorId) return;

      // Kampagne laden (für creatoranzahl)
      const { data: kampagne, error: kampagneError } = await window.supabase
        .from('kampagne')
        .select('id, creatoranzahl')
        .eq('id', kampagneId)
        .single();

      if (kampagneError || !kampagne) {
        console.error('❌ Fehler beim Laden der Kampagne für Kooperation:', kampagneError);
        return;
      }

      // Bestehende Kooperationen für diese Kampagne laden (inkl. Namen für Nummern-Extraktion)
      const { data: existingKoops, error: koopError } = await window.supabase
        .from('kooperationen')
        .select('id, name')
        .eq('kampagne_id', kampagneId);

      if (koopError) {
        console.error('❌ Fehler beim Zählen der Kooperationen:', koopError);
        return;
      }

      // Nächste verfügbare Nummer finden (um Dopplungen nach Löschen zu vermeiden)
      let currentKoopNummer = (existingKoops?.length || 0) + 1;
      const maxKoops = kampagne.creatoranzahl || 1;

      // Höchste existierende Nummer aus Kooperationsnamen extrahieren
      // Pattern: "Max Mustermann 2/5"
      const existingNumbers = (existingKoops || [])
        .map(k => {
          const match = k.name?.match(/(\d+)\/\d+$/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(n => n > 0);

      if (existingNumbers.length > 0) {
        currentKoopNummer = Math.max(...existingNumbers) + 1;
      }

      // Creator laden (für Namen)
      const { data: creator, error: creatorError } = await window.supabase
        .from('creator')
        .select('vorname, nachname, instagram')
        .eq('id', creatorId)
        .single();

      if (creatorError || !creator) {
        console.error('❌ Fehler beim Laden des Creators:', creatorError);
        return;
      }

      const creatorNameRaw = `${creator.vorname || ''} ${creator.nachname || ''}`.trim();
      const creatorName = creatorNameRaw || (creator.instagram ? `@${creator.instagram}` : 'Creator');

      const kooperationsname = `${creatorName} ${currentKoopNummer}/${maxKoops}`;

      nameInput.value = kooperationsname;
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
      nameInput.focus();
      nameInput.blur();

      console.log(`✅ Kooperationsname generiert: ${kooperationsname}`);
    } catch (error) {
      console.error('❌ Fehler beim Generieren des Kooperationsnamens:', error);
    }
  }

  // Sourcing-Name automatisch generieren: "Sourcing - Kampagnenname"
  // Akzeptiert entweder einen Kampagnennamen-String oder Kampagnen-ID zum Laden
  async autoGenerateSourcingName(kampagneIdOrName, markeId = null, unternehmenId = null) {
    try {
      let kampagnenname = null;
      
      // Wenn es eine UUID ist (Kampagnen-ID), lade den Namen aus der DB
      const isUuid = typeof kampagneIdOrName === 'string' && 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(kampagneIdOrName);
      
      if (isUuid) {
        console.log(`🔧 Lade Kampagnennamen für ID: ${kampagneIdOrName}`);
        
        const { data: kampagne, error } = await window.supabase
          .from('kampagne')
          .select('kampagnenname, eigener_name')
          .eq('id', kampagneIdOrName)
          .single();
        
        if (error || !kampagne) {
          console.error('❌ Fehler beim Laden der Kampagne:', error);
          // Fallback: Generiere einen Namen ohne Kampagne
          return this.generateFallbackSourcingName(markeId, unternehmenId);
        }
        
        // Eigener Name hat Priorität, dann Kampagnenname
        kampagnenname = kampagne.eigener_name || kampagne.kampagnenname;
      } else if (typeof kampagneIdOrName === 'string' && kampagneIdOrName.trim()) {
        // Es ist bereits ein Kampagnenname-String
        kampagnenname = kampagneIdOrName;
      }
      
      if (!kampagnenname) {
        // Fallback ohne Kampagnenname
        return this.generateFallbackSourcingName(markeId, unternehmenId);
      }
      
      const sourcingName = `Sourcing - ${kampagnenname}`;
      console.log(`✅ Sourcing-Name generiert: ${sourcingName}`);
      return sourcingName;
      
    } catch (error) {
      console.error('❌ Fehler beim Generieren des Sourcing-Namens:', error);
      return null;
    }
  }
  
  // Fallback Sourcing-Name ohne Kampagne
  async generateFallbackSourcingName(markeId, unternehmenId) {
    try {
      let displayName = 'Neue Liste';
      
      // Versuche Markennamen zu laden
      if (markeId) {
        const { data: marke } = await window.supabase
          .from('marke')
          .select('markenname')
          .eq('id', markeId)
          .single();
        
        if (marke?.markenname) {
          displayName = marke.markenname;
        }
      }
      // Fallback auf Unternehmensname
      else if (unternehmenId) {
        const { data: unternehmen } = await window.supabase
          .from('unternehmen')
          .select('firmenname, internes_kuerzel')
          .eq('id', unternehmenId)
          .single();
        
        if (unternehmen) {
          displayName = unternehmen.internes_kuerzel || unternehmen.firmenname;
        }
      }
      
      // Datum hinzufügen für Eindeutigkeit
      const today = new Date().toLocaleDateString('de-DE');
      const sourcingName = `Sourcing - ${displayName} - ${today}`;
      console.log(`✅ Fallback Sourcing-Name generiert: ${sourcingName}`);
      return sourcingName;
      
    } catch (error) {
      console.error('❌ Fehler beim Generieren des Fallback-Namens:', error);
      return `Sourcing - ${new Date().toLocaleDateString('de-DE')}`;
    }
  }

  // Strategie-Name automatisch generieren: "Strategie - Kampagnenname"
  // Akzeptiert entweder einen Kampagnennamen-String oder Kampagnen-ID zum Laden
  async autoGenerateStrategieName(kampagneIdOrName, markeId = null, unternehmenId = null) {
    try {
      let kampagnenname = null;
      
      // Wenn es eine UUID ist (Kampagnen-ID), lade den Namen aus der DB
      const isUuid = typeof kampagneIdOrName === 'string' && 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(kampagneIdOrName);
      
      if (isUuid) {
        console.log(`🔧 Lade Kampagnennamen für Strategie, ID: ${kampagneIdOrName}`);
        
        const { data: kampagne, error } = await window.supabase
          .from('kampagne')
          .select('kampagnenname, eigener_name')
          .eq('id', kampagneIdOrName)
          .single();
        
        if (error || !kampagne) {
          console.error('❌ Fehler beim Laden der Kampagne:', error);
          // Fallback: Generiere einen Namen ohne Kampagne
          return this.generateFallbackStrategieName(markeId, unternehmenId);
        }
        
        // Eigener Name hat Priorität, dann Kampagnenname
        kampagnenname = kampagne.eigener_name || kampagne.kampagnenname;
      } else if (typeof kampagneIdOrName === 'string' && kampagneIdOrName.trim()) {
        // Es ist bereits ein Kampagnenname-String
        kampagnenname = kampagneIdOrName;
      }
      
      if (!kampagnenname) {
        // Fallback ohne Kampagnenname
        return this.generateFallbackStrategieName(markeId, unternehmenId);
      }
      
      const strategieName = `Strategie ${kampagnenname}`;
      console.log(`✅ Strategie-Name generiert: ${strategieName}`);
      return strategieName;
      
    } catch (error) {
      console.error('❌ Fehler beim Generieren des Strategie-Namens:', error);
      return null;
    }
  }
  
  // Fallback Strategie-Name ohne Kampagne
  async generateFallbackStrategieName(markeId, unternehmenId) {
    try {
      let displayName = 'Neue Strategie';
      
      // Versuche Markennamen zu laden
      if (markeId) {
        const { data: marke } = await window.supabase
          .from('marke')
          .select('markenname')
          .eq('id', markeId)
          .single();
        
        if (marke?.markenname) {
          displayName = marke.markenname;
        }
      }
      // Fallback auf Unternehmensname
      else if (unternehmenId) {
        const { data: unternehmen } = await window.supabase
          .from('unternehmen')
          .select('firmenname, internes_kuerzel')
          .eq('id', unternehmenId)
          .single();
        
        if (unternehmen) {
          displayName = unternehmen.internes_kuerzel || unternehmen.firmenname;
        }
      }
      
      // Datum hinzufügen für Eindeutigkeit
      const today = new Date().toLocaleDateString('de-DE');
      const strategieName = `Strategie ${displayName} - ${today}`;
      console.log(`✅ Fallback Strategie-Name generiert: ${strategieName}`);
      return strategieName;
      
    } catch (error) {
      console.error('❌ Fehler beim Generieren des Fallback-Strategie-Namens:', error);
      return `Strategie - ${new Date().toLocaleDateString('de-DE')}`;
    }
  }

  // Auto-Generierung einrichten
  setupAutoGeneration(form) {
    // ========== AUFTRAGSNAME (für Auftrag-Formulare) ==========
    const isAuftragEditMode = form.dataset.isEditMode === 'true' && form.dataset.entityType === 'auftrag';
    if (isAuftragEditMode) {
      console.log('🔒 AUTOGENERATION: Auftrag Edit-Mode erkannt, überspringe Auto-Generierung für Auftragsname. Auftrag-ID:', form.dataset.entityId);
    }
    const auftragnameInput = form.querySelector('input[name="auftragsname"]');
    const unternehmenSelectForAuftrag = form.querySelector('select[name="unternehmen_id"]');
    const auftragTypeSelect = form.querySelector('select[name="auftragtype"]');
    
    if (!isAuftragEditMode && auftragnameInput && unternehmenSelectForAuftrag && auftragTypeSelect) {
      const triggerAuftragsname = () => this.autoGenerateAuftragsname(form);
      
      // Event-Listener für normale Selects
      unternehmenSelectForAuftrag.addEventListener('change', triggerAuftragsname);
      auftragTypeSelect.addEventListener('change', triggerAuftragsname);
      
      // Startdatum-Änderung überwachen
      const startInputForAuftrag = form.querySelector('input[name="start"]');
      if (startInputForAuftrag) {
        startInputForAuftrag.addEventListener('change', triggerAuftragsname);
      }
      
      // Searchable Select für Unternehmen
      const unternehmenField = unternehmenSelectForAuftrag.closest('.form-field');
      if (unternehmenField) {
        const searchableContainer = unternehmenField.querySelector('.searchable-select-container');
        if (searchableContainer) {
          const searchInput = searchableContainer.querySelector('.searchable-select-input');
          if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', () => {
              clearTimeout(timeout);
              timeout = setTimeout(triggerAuftragsname, 300);
            });
          }
        }
      }
      
      // Sofort generieren wenn Unternehmen vorhanden
      if (unternehmenSelectForAuftrag.value) {
        this.autoGenerateAuftragsname(form);
      }
      
      console.log('✅ Auto-Generierung für Auftragsname eingerichtet');
    }
    
    // ========== KAMPAGNENNAME (für Kampagne-Formulare) ==========
    const isKampagneEditMode = form.dataset.isEditMode === 'true' && form.dataset.entityType === 'kampagne';
    const editKampagneId = isKampagneEditMode ? form.dataset.entityId : null;

    if (isKampagneEditMode) {
      console.log('🔒 AUTOGENERATION: Kampagne Edit-Mode erkannt, überspringe initiale Auto-Generierung. Kampagne-ID:', editKampagneId);
    }

    // Startdatum-Änderung überwachen (Kampagne)
    const kampagneStartInput = form.querySelector('input[name="start"]');
    if (kampagneStartInput) {
      kampagneStartInput.addEventListener('change', () => {
        const auftragSelect = form.querySelector('select[name="auftrag_id"]');
        if (auftragSelect && auftragSelect.value) {
          this.autoGenerateKampagnenname(form, auftragSelect.value, editKampagneId);
        }
      });
    }

    // Kampagnentyp-Änderung überwachen (Kampagne)
    const kampagneTypSelect = form.querySelector('select[name="kampagne_typ"]');
    if (kampagneTypSelect) {
      kampagneTypSelect.addEventListener('change', () => {
        const auftragSelect = form.querySelector('select[name="auftrag_id"]');
        if (auftragSelect && auftragSelect.value) {
          this.autoGenerateKampagnenname(form, auftragSelect.value, editKampagneId);
        }
      });
    }

    // Auftrag-Änderung überwachen (Kampagne)
    const auftragSelect = form.querySelector('select[name="auftrag_id"]');
    if (auftragSelect) {
      auftragSelect.addEventListener('change', () => {
        if (auftragSelect.value) {
          this.autoGenerateKampagnenname(form, auftragSelect.value, editKampagneId);
        }
      });
      
      // Sofort auslösen NUR im Create-Mode (nicht im Edit-Mode)
      if (auftragSelect.value && !isKampagneEditMode) {
        this.autoGenerateKampagnenname(form, auftragSelect.value);
      }
    }

    // Auch für searchable Selects (Auftrag)
    const auftragContainer = form.querySelector('.searchable-select-container, .tag-based-select');
    if (auftragContainer) {
      const auftragInput = auftragContainer.querySelector('.searchable-select-input');
      if (auftragInput) {
        let timeout;
        auftragInput.addEventListener('input', () => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            const hiddenSelect = auftragContainer.querySelector('select[style*="display: none"]');
            if (hiddenSelect && hiddenSelect.value) {
              this.autoGenerateKampagnenname(form, hiddenSelect.value, editKampagneId);
            }
          }, 300);
        });
        
        // Sofort auslösen NUR im Create-Mode
        if (!isKampagneEditMode) {
          const hiddenSelect = auftragContainer.querySelector('select[style*="display: none"]');
          if (hiddenSelect && hiddenSelect.value) {
            this.autoGenerateKampagnenname(form, hiddenSelect.value);
          }
        }
      }
    }

    // ========== SOURCING-NAME (für Sourcing-Formulare) ==========
    const sourcingNameInput = form.querySelector('input[name="name"]');
    const kampagneSelectForSourcing = form.querySelector('select[name="kampagne_id"]');
    const sourcingForm = form.id === 'sourcing-form';
    
    if (sourcingForm && sourcingNameInput && kampagneSelectForSourcing) {
      const triggerSourcingName = async () => {
        const kampagneId = kampagneSelectForSourcing.value;
        if (kampagneId) {
          const markeSelect = form.querySelector('select[name="marke_id"]');
          const unternehmenSelect = form.querySelector('select[name="unternehmen_id"]');
          const generatedName = await this.autoGenerateSourcingName(
            kampagneId,
            markeSelect?.value,
            unternehmenSelect?.value
          );
          if (generatedName && sourcingNameInput) {
            sourcingNameInput.value = generatedName;
            sourcingNameInput.dispatchEvent(new Event('input', { bubbles: true }));
            sourcingNameInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      };
      
      // Event-Listener für Kampagnen-Auswahl
      kampagneSelectForSourcing.addEventListener('change', triggerSourcingName);
      
      // Searchable Select für Kampagne
      const kampagneField = kampagneSelectForSourcing.closest('.form-field');
      if (kampagneField) {
        const searchableContainer = kampagneField.querySelector('.searchable-select-container');
        if (searchableContainer) {
          const searchInput = searchableContainer.querySelector('.searchable-select-input');
          if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', () => {
              clearTimeout(timeout);
              timeout = setTimeout(triggerSourcingName, 300);
            });
          }
        }
      }
      
      // Sofort generieren wenn Kampagne bereits ausgewählt
      if (kampagneSelectForSourcing.value) {
        triggerSourcingName();
      }
      
      console.log('✅ Auto-Generierung für Sourcing-Name eingerichtet');
    }

    // ========== KOOPERATIONSNAME (für Kooperation-Formulare) ==========
    // Kooperationsname: auf Änderungen von Kampagne und Creator reagieren
    const kampagneSelect = form.querySelector('select[name="kampagne_id"]');
    const creatorSelect = form.querySelector('select[name="creator_id"]');
    if (kampagneSelect && creatorSelect) {
      const triggerKoopName = () => this.autoGenerateKooperationsname(form);
      kampagneSelect.addEventListener('change', triggerKoopName);
      creatorSelect.addEventListener('change', triggerKoopName);

      // Wenn beide Werte bereits vorhanden sind, sofort generieren
      if (kampagneSelect.value && creatorSelect.value) {
        this.autoGenerateKooperationsname(form);
      }

      // Searchable Selects (jeweils container direkt vor dem Select suchen)
      const wireSearchable = (selectEl) => {
        const container = selectEl.previousElementSibling;
        if (container && container.classList.contains('searchable-select-container')) {
          const input = container.querySelector('.searchable-select-input');
          if (input) {
            let timeout;
            input.addEventListener('input', () => {
              clearTimeout(timeout);
              timeout = setTimeout(() => this.autoGenerateKooperationsname(form), 300);
            });
          }
        }
      };
      wireSearchable(kampagneSelect);
      wireSearchable(creatorSelect);
    }

    // ========== STRATEGIENAME (für Strategie-Formulare) ==========
    const strategieNameInput = form.querySelector('input[name="name"]');
    const kampagneSelectForStrategie = form.querySelector('select[name="kampagne_id"]');
    const strategieForm = form.id === 'strategie-form';
    
    if (strategieForm && strategieNameInput && kampagneSelectForStrategie) {
      const triggerStrategieName = async () => {
        const kampagneId = kampagneSelectForStrategie.value;
        if (kampagneId) {
          const markeSelect = form.querySelector('select[name="marke_id"]');
          const unternehmenSelect = form.querySelector('select[name="unternehmen_id"]');
          const generatedName = await this.autoGenerateStrategieName(
            kampagneId,
            markeSelect?.value,
            unternehmenSelect?.value
          );
          if (generatedName && strategieNameInput) {
            strategieNameInput.value = generatedName;
            strategieNameInput.dispatchEvent(new Event('input', { bubbles: true }));
            strategieNameInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      };
      
      // Event-Listener für Kampagnen-Auswahl
      kampagneSelectForStrategie.addEventListener('change', triggerStrategieName);
      
      // Searchable Select für Kampagne
      const kampagneField = kampagneSelectForStrategie.closest('.form-field');
      if (kampagneField) {
        const searchableContainer = kampagneField.querySelector('.searchable-select-container');
        if (searchableContainer) {
          const searchInput = searchableContainer.querySelector('.searchable-select-input');
          if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', () => {
              clearTimeout(timeout);
              timeout = setTimeout(triggerStrategieName, 300);
            });
          }
        }
      }
      
      // Sofort generieren wenn Kampagne bereits ausgewählt
      if (kampagneSelectForStrategie.value) {
        triggerStrategieName();
      }
      
      console.log('✅ Auto-Generierung für Strategie-Name eingerichtet');
    }
  }
} 