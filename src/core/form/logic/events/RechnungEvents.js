import { KampagneUtils } from '../../../../modules/kampagne/KampagneUtils.js';

let _debounceTimer = null;

function debounce(fn, ms = 50) {
  return (...args) => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => fn(...args), ms);
  };
}

export async function setup(form, ctx) {
  const koopSelect = form.querySelector('select[name="kooperation_id"]');
  if (!koopSelect || !window.supabase) return;

  const isEditMode = form.dataset.isEditMode === 'true';

  const unternehmenField = form.querySelector('select[name="unternehmen_id"]');
  const auftragField = form.querySelector('select[name="auftrag_id"]');
  const creatorField = form.querySelector('select[name="creator_id"]');
  const kampagneField = form.querySelector('select[name="kampagne_id"]');
  const videoInput = form.querySelector('input[name="videoanzahl"]');
  const nettoInput = form.querySelector('input[name="nettobetrag"]');
  const zusatzInput = form.querySelector('input[name="zusatzkosten"]');
  const ustProzentInput = form.querySelector('input[name="ust_prozent"]');
  const bruttoInput = form.querySelector('input[name="bruttobetrag"]');

  // Im Edit-Modus: Kooperation + abhängige Selects komplett sperren
  if (isEditMode) {
    const lockField = (selectEl) => {
      if (!selectEl) return;
      selectEl.disabled = true;
      const container = selectEl.parentNode.querySelector('.searchable-select-container');
      if (container) {
        const input = container.querySelector('.searchable-select-input');
        if (input) {
          input.setAttribute('disabled', 'true');
          input.classList.add('is-disabled');
        }
      }
    };
    lockField(koopSelect);
    lockField(unternehmenField);
    lockField(auftragField);
    lockField(creatorField);
    lockField(kampagneField);
  }

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
    
    selectEl.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = value || '';
    opt.textContent = label || '—';
    selectEl.appendChild(opt);
    selectEl.value = value || '';
    selectEl.disabled = true;
    
    const container = selectEl.parentNode.querySelector('.searchable-select-container');
    if (container) {
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.value = label || '';
        if (selectEl.getAttribute('data-readonly') === 'true') {
          input.setAttribute('disabled', 'true');
          input.classList.add('is-disabled');
        }
        if (input.hasAttribute('data-was-required')) {
          if (value && value.trim() !== '') {
            input.setCustomValidity('');
          } else {
            input.setCustomValidity('Dieses Feld ist erforderlich.');
          }
        }
      }
    }
    
    const hidden = document.getElementById(`${selectEl.id}-hidden`);
    if (hidden) hidden.value = value || '';
  };

  const onKoopChange = async () => {
    const koopId = koopSelect.value;
    if (!koopId) {
      const fieldsToReset = [
        { field: auftragField, placeholder: 'Auftrag wird automatisch gesetzt' },
        { field: unternehmenField, placeholder: 'Unternehmen wird automatisch gesetzt' },
        { field: kampagneField, placeholder: 'Kampagne wird automatisch gesetzt' },
        { field: creatorField, placeholder: 'Creator wird automatisch gesetzt' }
      ];
      
      fieldsToReset.forEach(({ field, placeholder }) => {
        if (field) {
          field.innerHTML = '<option value="">—</option>';
          field.value = '';
          const container = field.parentNode.querySelector('.searchable-select-container');
          if (container) {
            const input = container.querySelector('.searchable-select-input');
            if (input) {
              input.value = '';
              input.placeholder = placeholder;
            }
          }
          const hidden = document.getElementById(`${field.id}-hidden`);
          if (hidden) hidden.value = '';
        }
      });
      
      if (videoInput) videoInput.value = '';
      if (nettoInput) nettoInput.value = '';
      if (zusatzInput) zusatzInput.value = '';
      if (bruttoInput) bruttoInput.value = '';
      if (ustProzentInput) ustProzentInput.value = '19';
      
      return;
    }

    const { data: koop, error } = await window.supabase
      .from('kooperationen')
      .select('id, name, unternehmen_id, kampagne_id, einkaufspreis_netto, einkaufspreis_gesamt, einkaufspreis_zusatzkosten, videoanzahl, creator_id')
      .eq('id', koopId)
      .single();
    if (error) {
      console.error('❌ Fehler beim Laden der Kooperation:', error);
      return;
    }

    // Parallele Queries: Unternehmen, Kampagne+Auftrag, Creator
    const [unternehmenResult, kampagneResult, creatorResult] = await Promise.all([
      koop?.unternehmen_id
        ? window.supabase.from('unternehmen').select('id, firmenname').eq('id', koop.unternehmen_id).single()
        : Promise.resolve({ data: null }),
      koop?.kampagne_id
        ? window.supabase.from('kampagne').select('id, kampagnenname, eigener_name, auftrag_id, auftrag:auftrag_id(id, auftragsname)').eq('id', koop.kampagne_id).single()
        : Promise.resolve({ data: null }),
      koop?.creator_id
        ? window.supabase.from('creator').select('id, vorname, nachname, umsatzsteuerpflichtig').eq('id', koop.creator_id).single()
        : Promise.resolve({ data: null })
    ]);

    // Unternehmen setzen
    const unternehmenLabel = unternehmenResult.data?.firmenname || '';
    fillSelect(unternehmenField, koop?.unternehmen_id || '', unternehmenLabel);

    // Kampagne + Auftrag setzen
    let auftragsId = null;
    let auftragsName = '';
    let kampName = '';

    if (kampagneResult.data) {
      kampName = KampagneUtils.getDisplayName(kampagneResult.data);
      auftragsId = kampagneResult.data.auftrag_id || null;
      auftragsName = kampagneResult.data.auftrag?.auftragsname || '';
    }

    if (kampagneField) {
      const kampLabel = kampName || (koop?.kampagne_id ? 'Unbenannte Kampagne' : '');
      fillSelect(kampagneField, koop?.kampagne_id || '', kampLabel);
    }
    fillSelect(auftragField, auftragsId, auftragsName || (auftragsId ? 'Unbenannter Auftrag' : ''));

    if (!auftragsId && auftragField) {
      const container = auftragField.parentNode.querySelector('.searchable-select-container');
      if (container) {
        const input = container.querySelector('.searchable-select-input');
        if (input) {
          input.value = '';
          input.placeholder = 'Kein Auftrag verknüpft - bitte Kampagne prüfen';
        }
      }
    }

    // Creator setzen + USt-Satz ableiten
    if (creatorField) {
      const creatorData = creatorResult.data;
      const creatorId = creatorData?.id || null;
      const creatorLabel = creatorData ? `${creatorData.vorname || ''} ${creatorData.nachname || ''}`.trim() : '';
      if (ustProzentInput) {
        ustProzentInput.value = String(creatorData?.umsatzsteuerpflichtig === false ? 0 : 19);
      }
      fillSelect(creatorField, creatorId, creatorLabel);
    } else if (ustProzentInput) {
      ustProzentInput.value = '19';
    }

    // Videoanzahl + Beträge aus Kooperation
    if (videoInput) videoInput.value = koop?.videoanzahl || '';
    const netto = parseFloat(koop?.einkaufspreis_netto || 0) || 0;
    const zusatz = parseFloat(koop?.einkaufspreis_zusatzkosten || 0) || 0;
    const brutto = (koop?.einkaufspreis_gesamt != null) ? koop.einkaufspreis_gesamt : (netto + zusatz);
    if (nettoInput) nettoInput.value = netto ? String(netto) : '';
    if (zusatzInput) zusatzInput.value = zusatz ? String(zusatz) : '';
    if (bruttoInput) bruttoInput.value = isNaN(brutto) ? '' : String(brutto);
    berechneRechnung();
  };

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
    const ustProzent = parseFloat(ustProzentInput?.value) || 0;
    const ustRate = ustProzent / 100;
    
    const nettoGesamt = netto + zusatz;
    const bruttoVorSkonto = nettoGesamt * (1 + ustRate);
    const skontoBetrag = hatSkonto ? nettoGesamt * 0.03 : 0;
    const nettoNachSkonto = nettoGesamt - skontoBetrag;
    const ustBetrag = nettoNachSkonto * ustRate;
    const brutto = nettoNachSkonto + ustBetrag;
    
    if (nettoGesamtInput) nettoGesamtInput.value = nettoGesamt.toFixed(2);
    if (bruttoVorSkontoInput) bruttoVorSkontoInput.value = bruttoVorSkonto.toFixed(2);
    if (skontoBetragInput) skontoBetragInput.value = skontoBetrag.toFixed(2);
    if (nettoNachSkontoInput) nettoNachSkontoInput.value = nettoNachSkonto.toFixed(2);
    if (ustBetragInput) ustBetragInput.value = ustBetrag.toFixed(2);
    if (bruttoInput) bruttoInput.value = brutto.toFixed(2);
  };
  
  const debouncedBerechne = debounce(berechneRechnung, 50);
  
  // Event-Listener für Berechnung (immer binden, auch im Edit-Mode)
  if (nettoInput) nettoInput.addEventListener('input', debouncedBerechne);
  if (zusatzInput) zusatzInput.addEventListener('input', debouncedBerechne);
  if (skontoToggle) skontoToggle.addEventListener('change', berechneRechnung);
  if (ustProzentInput) {
    ustProzentInput.addEventListener('input', debouncedBerechne);
    ustProzentInput.addEventListener('change', berechneRechnung);
  }

  // === BUG-FIX: Im Edit-Mode NICHT onKoopChange aufrufen (überschreibt Rechnungswerte) ===
  if (!isEditMode) {
    koopSelect.addEventListener('change', onKoopChange);
    
    if (!koopSelect.value) {
      setTimeout(() => onKoopChange(), 100);
    }
    onKoopChange();
  }
  
  // Initiale Berechnung aus gespeicherten Werten (auch im Edit-Mode)
  setTimeout(berechneRechnung, 200);
}
