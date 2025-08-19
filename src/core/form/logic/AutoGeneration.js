export class AutoGeneration {
  // Kampagnenname automatisch generieren
  async autoGenerateKampagnenname(form, auftragId) {
    try {
      if (!auftragId) return;

      console.log(`🔧 Generiere Kampagnenname für Auftrag: ${auftragId}`);

      // 1. Auftrag-Details laden
      const { data: auftrag, error: auftragError } = await window.supabase
        .from('auftrag')
        .select(`
          *,
          unternehmen:unternehmen_id(firmenname),
          marke:marke_id(markenname)
        `)
        .eq('id', auftragId)
        .single();

      if (auftragError || !auftrag) {
        console.error('❌ Fehler beim Laden des Auftrags:', auftragError);
        return;
      }

      // 2. Bestehende Kampagnen für diesen Auftrag zählen
      const { data: existingKampagnen, error: kampagnenError } = await window.supabase
        .from('kampagne')
        .select('id')
        .eq('auftrag_id', auftragId);

      if (kampagnenError) {
        console.error('❌ Fehler beim Zählen der Kampagnen:', kampagnenError);
        return;
      }

      const kampagnenCount = existingKampagnen.length;
      const currentKampagneNummer = kampagnenCount + 1;
      const maxKampagnen = auftrag.kampagnenanzahl || 1;

      // 3. Deadline aus dem Formular holen
      const deadlineInput = form.querySelector('input[name="deadline"]');
      const deadline = deadlineInput ? deadlineInput.value : '';

      // 4. Kampagnenname generieren
      const firmenname = auftrag.unternehmen?.firmenname || 'Unbekannte Firma';
      
      let kampagnenname = `${firmenname} - ${currentKampagneNummer}/${maxKampagnen}`;
      
      if (deadline) {
        const deadlineDate = new Date(deadline);
        const formattedDeadline = deadlineDate.toLocaleDateString('de-DE');
        kampagnenname += ` - ${formattedDeadline}`;
      }

      // 5. Kampagnenname-Feld aktualisieren
      const kampagnennameInput = form.querySelector('input[name="kampagnenname"]');
      if (kampagnennameInput) {
        kampagnennameInput.value = kampagnenname;
        
        // Event auslösen, damit das Formular-System den Wert erkennt
        kampagnennameInput.dispatchEvent(new Event('input', { bubbles: true }));
        kampagnennameInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Zusätzlich: Focus und Blur Events auslösen
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

      // Bestehende Kooperationen für diese Kampagne zählen
      const { data: existingKoops, error: koopError } = await window.supabase
        .from('kooperationen')
        .select('id')
        .eq('kampagne_id', kampagneId);

      if (koopError) {
        console.error('❌ Fehler beim Zählen der Kooperationen:', koopError);
        return;
      }

      const currentKoopNummer = (existingKoops?.length || 0) + 1;
      const maxKoops = kampagne.creatoranzahl || 1;

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

  // Auto-Generierung einrichten
  setupAutoGeneration(form) {
    // Deadline-Änderung überwachen (Kampagne)
    const deadlineInput = form.querySelector('input[name="deadline"]');
    if (deadlineInput) {
      deadlineInput.addEventListener('change', () => {
        const auftragSelect = form.querySelector('select[name="auftrag_id"]');
        if (auftragSelect && auftragSelect.value) {
          this.autoGenerateKampagnenname(form, auftragSelect.value);
        }
      });
    }

    // Auftrag-Änderung überwachen (Kampagne)
    const auftragSelect = form.querySelector('select[name="auftrag_id"]');
    if (auftragSelect) {
      auftragSelect.addEventListener('change', () => {
        if (auftragSelect.value) {
          this.autoGenerateKampagnenname(form, auftragSelect.value);
        }
      });
      
      // Sofort auslösen, wenn bereits ein Wert vorhanden ist
      if (auftragSelect.value) {
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
              this.autoGenerateKampagnenname(form, hiddenSelect.value);
            }
          }, 300);
        });
        
        // Sofort auslösen für searchable Selects, wenn bereits ein Wert vorhanden ist
        const hiddenSelect = auftragContainer.querySelector('select[style*="display: none"]');
        if (hiddenSelect && hiddenSelect.value) {
          this.autoGenerateKampagnenname(form, hiddenSelect.value);
        }
      }
    }

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
  }
} 