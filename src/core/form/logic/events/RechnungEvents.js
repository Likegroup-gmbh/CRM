import { KampagneUtils } from '../../../../modules/kampagne/KampagneUtils.js';
import { findSignedVertragForKooperation } from '../../../../modules/rechnung/RechnungVertragZuordnung.js';

let _debounceTimer = null;

function debounce(fn, ms = 50) {
  return (...args) => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => fn(...args), ms);
  };
}

const VERTRAG_WARNING_ID = 'rechnung-vertrag-warning';
const DISABLED_WRAPPER_ID = 'rechnung-fields-wrapper';

// Searchable-Selects entfernen das name-Attribut vom <select>; Fallback auf id / data-field-name.
function findSelect(form, name) {
  return form.querySelector(`select[name="${name}"]`)
    || form.querySelector(`select#field-${name}`)
    || form.querySelector(`select[data-field-name="${name}"]`);
}

function showVertragWarning(form, message) {
  hideVertragWarning(form);

  const banner = document.createElement('div');
  banner.id = VERTRAG_WARNING_ID;
  banner.className = 'notice-box notice-info';
  banner.innerHTML = `
    <strong>Kein Vertrag vorhanden</strong>
    ${message}
  `;

  const koopField = findSelect(form, 'kooperation_id');
  const koopGroup = koopField?.closest('.form-field') || koopField?.closest('.form-row-group');
  if (koopGroup) {
    koopGroup.insertAdjacentElement('afterend', banner);
  } else {
    form.prepend(banner);
  }

  let wrapper = form.querySelector(`#${DISABLED_WRAPPER_ID}`);
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = DISABLED_WRAPPER_ID;

    const siblings = [];
    let foundKoop = false;
    for (const child of Array.from(form.children)) {
      if (child === koopGroup || child.id === VERTRAG_WARNING_ID) {
        foundKoop = true;
        continue;
      }
      if (foundKoop) siblings.push(child);
    }
    siblings.forEach(el => wrapper.appendChild(el));
    form.appendChild(wrapper);
  }
  wrapper.classList.add('rechnung-form-disabled');

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
}

function hideVertragWarning(form) {
  const existing = document.getElementById(VERTRAG_WARNING_ID);
  if (existing) existing.remove();

  const wrapper = form.querySelector(`#${DISABLED_WRAPPER_ID}`);
  if (wrapper) {
    wrapper.classList.remove('rechnung-form-disabled');
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = false;
}

// Wiederverwendbare Berechnungslogik fuer USt/Brutto — wird auch von RechnungContractingEvents importiert.
// zusatzBruttoToggle: optional, schaltet Zusatzkosten in den Brutto-Modus (durchlaufender Posten
// inkl. USt — es wird keine weitere USt auf die Zusatzkosten berechnet).
export function berechneRechnungFromInputs({ nettoInput, zusatzInput, skontoToggle, ustAktivToggle, ustProzentInput, zusatzBruttoToggle, nettoGesamtInput, bruttoVorSkontoInput, skontoBetragInput, nettoNachSkontoInput, ustBetragInput, bruttoInput }) {
  const netto = parseFloat(nettoInput?.value) || 0;
  const zusatz = parseFloat(zusatzInput?.value) || 0;
  const hatSkonto = skontoToggle?.checked || false;
  const zusatzIstBrutto = zusatzBruttoToggle?.checked || false;
  const ustAktiv = ustAktivToggle ? ustAktivToggle.checked : true;
  if (!ustAktiv && ustProzentInput) ustProzentInput.value = '0';
  else if (ustAktiv && ustProzentInput && (parseFloat(ustProzentInput.value) || 0) === 0) ustProzentInput.value = '19';
  const ustProzent = ustAktiv ? (parseFloat(ustProzentInput?.value) || 0) : 0;
  const ustRate = ustProzent / 100;

  let nettoGesamt, bruttoVorSkonto, skontoBetrag, nettoNachSkonto, ustBetrag, brutto;

  if (zusatzIstBrutto) {
    // Brutto-Modus: Zusatzkosten enthalten bereits USt, Rechnungs-USt nur auf die Leistung.
    // Skonto (3%) wirkt auf Leistung + Zusatzkosten.
    const skontoFaktor = hatSkonto ? 0.97 : 1;
    nettoGesamt = netto;
    bruttoVorSkonto = netto * (1 + ustRate) + zusatz;
    skontoBetrag = hatSkonto ? (netto + zusatz) * 0.03 : 0;
    const nettoLeistungNachSkonto = netto * skontoFaktor;
    const zusatzNachSkonto = zusatz * skontoFaktor;
    nettoNachSkonto = nettoLeistungNachSkonto;
    ustBetrag = nettoLeistungNachSkonto * ustRate;
    brutto = nettoLeistungNachSkonto + ustBetrag + zusatzNachSkonto;
  } else {
    // Netto-Modus (Standard): Zusatzkosten netto, USt auf die Gesamtsumme.
    nettoGesamt = netto + zusatz;
    bruttoVorSkonto = nettoGesamt * (1 + ustRate);
    skontoBetrag = hatSkonto ? nettoGesamt * 0.03 : 0;
    nettoNachSkonto = nettoGesamt - skontoBetrag;
    ustBetrag = nettoNachSkonto * ustRate;
    brutto = nettoNachSkonto + ustBetrag;
  }

  if (nettoGesamtInput) nettoGesamtInput.value = nettoGesamt.toFixed(2);
  if (bruttoVorSkontoInput) bruttoVorSkontoInput.value = bruttoVorSkonto.toFixed(2);
  if (skontoBetragInput) skontoBetragInput.value = skontoBetrag.toFixed(2);
  if (nettoNachSkontoInput) nettoNachSkontoInput.value = nettoNachSkonto.toFixed(2);
  if (ustBetragInput) ustBetragInput.value = ustBetrag.toFixed(2);
  if (bruttoInput) bruttoInput.value = brutto.toFixed(2);
}

/**
 * Finalisiert submitData vor dem Speichern einer Rechnung.
 * Stellt sicher, dass ust_prozent korrekt aus dem Toggle abgeleitet wird
 * und alle berechneten Felder konsistent sind.
 * Muss nach collectSubmitData/FormData-Auslesen aufgerufen werden.
 */
export function finalizeRechnungSubmitData(form, submitData) {
  const ustAktivToggle = form.querySelector('input[name="ust_aktiv"]');
  const ustProzentInput = form.querySelector('input[name="ust_prozent"]');
  const skontoToggle = form.querySelector('input[name="skonto"]');

  const ustAktiv = ustAktivToggle ? ustAktivToggle.checked : true;
  const rawProzent = parseFloat(ustProzentInput?.value);
  submitData.ust_prozent = ustAktiv ? (Number.isFinite(rawProzent) && rawProzent > 0 ? rawProzent : 19) : 0;

  // Berechnete Felder aus dem Formular übernehmen (berechneRechnung() lief bereits via Event-Listener)
  const readField = (name) => {
    const el = form.querySelector(`input[name="${name}"]`);
    const v = parseFloat(el?.value);
    return Number.isFinite(v) ? v : null;
  };
  submitData.ust_betrag = readField('ust_betrag');
  submitData.bruttobetrag = readField('bruttobetrag');

  // Checkboxen/Toggles die FormData evtl. nicht enthält (unchecked)
  if (skontoToggle) submitData.skonto = skontoToggle.checked;
  const geprueftToggle = form.querySelector('input[name="geprueft"]');
  if (geprueftToggle) submitData.geprueft = geprueftToggle.checked;
  const kskToggle = form.querySelector('input[name="ksk_pflichtig"]');
  if (kskToggle) submitData.ksk_pflichtig = kskToggle.checked;
  const zusatzBruttoToggle = form.querySelector('input[name="zusatzkosten_brutto"]');
  if (zusatzBruttoToggle) submitData.zusatzkosten_brutto = zusatzBruttoToggle.checked;

  // UI-only Feld entfernen
  delete submitData.ust_aktiv;

  // Safety-Net: Ein leeres Vertrag-Dropdown darf eine bestehende Verknuepfung nie
  // ueberschreiben. Leeres/null vertrag_id aus submitData entfernen, statt es auf null
  // zu setzen. Bewusstes Aendern auf einen anderen Vertrag bleibt moeglich (Wert != leer).
  if (submitData.vertrag_id === '' || submitData.vertrag_id === null || submitData.vertrag_id === undefined) {
    delete submitData.vertrag_id;
  }
}

export async function setup(form, ctx) {
  const koopSelect = findSelect(form, 'kooperation_id');
  if (!koopSelect || !window.supabase) return;

  const isEditMode = form.dataset.isEditMode === 'true';

  const unternehmenField = findSelect(form, 'unternehmen_id');
  const auftragField = findSelect(form, 'auftrag_id');
  const creatorField = findSelect(form, 'creator_id');
  const kampagneField = findSelect(form, 'kampagne_id');
  const videoInput = form.querySelector('input[name="videoanzahl"]');
  const nettoInput = form.querySelector('input[name="nettobetrag"]');
  const zusatzInput = form.querySelector('input[name="zusatzkosten"]');
  const ustProzentInput = form.querySelector('input[name="ust_prozent"]');
  const ustAktivToggle = form.querySelector('input[name="ust_aktiv"]');
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
      hideVertragWarning(form);
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
      if (ustAktivToggle) ustAktivToggle.checked = true;
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

    // Vertrag-Prefilter: prüfen ob finaler Vertrag vorhanden
    const vertragCheck = await findSignedVertragForKooperation(koopId);
    if (!vertragCheck.ok) {
      showVertragWarning(form, vertragCheck.message);
      return;
    }
    hideVertragWarning(form);

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
      const isUstPflichtig = creatorData?.umsatzsteuerpflichtig !== false;
      if (ustAktivToggle) {
        ustAktivToggle.checked = isUstPflichtig;
      }
      if (ustProzentInput) {
        ustProzentInput.value = String(isUstPflichtig ? 19 : 0);
      }
      fillSelect(creatorField, creatorId, creatorLabel);
    } else {
      if (ustAktivToggle) ustAktivToggle.checked = true;
      if (ustProzentInput) ustProzentInput.value = '19';
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
  const zusatzBruttoToggle = form.querySelector('input[name="zusatzkosten_brutto"]');
  const nettoGesamtInput = form.querySelector('input[name="netto_gesamt"]');
  const bruttoVorSkontoInput = form.querySelector('input[name="brutto_vor_skonto"]');
  const skontoBetragInput = form.querySelector('input[name="skonto_betrag"]');
  const nettoNachSkontoInput = form.querySelector('input[name="netto_nach_skonto"]');
  const ustBetragInput = form.querySelector('input[name="ust_betrag"]');

  const berechneRechnung = () => {
    berechneRechnungFromInputs({
      nettoInput, zusatzInput, skontoToggle,
      ustAktivToggle, ustProzentInput, zusatzBruttoToggle,
      nettoGesamtInput, bruttoVorSkontoInput,
      skontoBetragInput, nettoNachSkontoInput,
      ustBetragInput, bruttoInput
    });
  };

  const debouncedBerechne = debounce(berechneRechnung, 50);
  
  // Event-Listener für Berechnung (immer binden, auch im Edit-Mode)
  if (nettoInput) nettoInput.addEventListener('input', debouncedBerechne);
  if (zusatzInput) zusatzInput.addEventListener('input', debouncedBerechne);
  if (skontoToggle) skontoToggle.addEventListener('change', berechneRechnung);
  if (zusatzBruttoToggle) zusatzBruttoToggle.addEventListener('change', berechneRechnung);
  if (ustProzentInput) {
    ustProzentInput.addEventListener('input', debouncedBerechne);
    ustProzentInput.addEventListener('change', berechneRechnung);
  }
  if (ustAktivToggle) {
    ustAktivToggle.addEventListener('change', berechneRechnung);
  }

  // === BUG-FIX: Im Edit-Mode NICHT onKoopChange aufrufen (überschreibt Rechnungswerte) ===
  if (!isEditMode) {
    koopSelect.addEventListener('change', onKoopChange);
    
    if (!koopSelect.value) {
      setTimeout(() => onKoopChange(), 100);
    }
    onKoopChange();
  } else {
    // Edit-Mode: ust_aktiv Toggle aus gespeichertem ust_prozent ableiten (0 = aus, >0 = an)
    if (ustAktivToggle && ustProzentInput) {
      const gespeichertProzent = parseFloat(ustProzentInput.value) || 0;
      ustAktivToggle.checked = gespeichertProzent > 0;
    }
  }
  
  // Initiale Berechnung aus gespeicherten Werten (auch im Edit-Mode)
  setTimeout(berechneRechnung, 200);
}
