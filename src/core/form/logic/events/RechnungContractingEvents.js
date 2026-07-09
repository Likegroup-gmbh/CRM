// Event-Logik fuer Contracting-Rechnungen
// Contract waehlen -> Unternehmen laden + Budget-Banner anzeigen
// Nettobetrag wird NICHT prefilled — Mitarbeiter gibt ihn manuell ein.
// Live-Check: warnt wenn verfuegbares Budget ueberschritten wird.

import { berechneRechnungFromInputs } from './RechnungEvents.js';

const BUDGET_BANNER_ID = 'contracting-budget-banner';

// Searchable-Selects entfernen das name-Attribut vom <select>; Fallback auf id / data-field-name.
function findSelect(form, name) {
  return form.querySelector(`select[name="${name}"]`)
    || form.querySelector(`select#field-${name}`)
    || form.querySelector(`select[data-field-name="${name}"]`);
}

let _debounceTimer = null;
function debounce(fn, ms = 50) {
  return (...args) => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => fn(...args), ms);
  };
}

function fmtCurrency(v) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v || 0);
}

function fillSelect(selectEl, value, label) {
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
    }
  }
  const hidden = document.getElementById(`${selectEl.id}-hidden`);
  if (hidden) hidden.value = value || '';
}

function renderBudgetBanner(form, budget, vergeben, verfuegbar) {
  let banner = document.getElementById(BUDGET_BANNER_ID);
  if (!banner) {
    banner = document.createElement('div');
    banner.id = BUDGET_BANNER_ID;
    banner.className = 'notice-box notice-info contracting-budget-banner';
    const nettoField = form.querySelector('input[name="nettobetrag"]')?.closest('.form-field');
    if (nettoField) {
      nettoField.insertAdjacentElement('beforebegin', banner);
    } else {
      form.prepend(banner);
    }
  }

  const isOver = verfuegbar < 0;
  banner.className = `notice-box ${isOver ? 'notice-warning' : 'notice-info'} contracting-budget-banner`;
  banner.innerHTML = `
    <div class="budget-banner-row">
      <span><strong>Contract-Budget:</strong> ${fmtCurrency(budget)}</span>
      <span><strong>Bereits vergeben:</strong> ${fmtCurrency(vergeben)}</span>
      <span><strong>Verfügbar:</strong> <span class="budget-verfuegbar ${isOver ? 'budget-over' : ''}">${fmtCurrency(verfuegbar)}</span></span>
    </div>
  `;
}

function removeBudgetBanner() {
  document.getElementById(BUDGET_BANNER_ID)?.remove();
}

function updateBudgetLiveCheck(form, contractBudget, bereitsVergeben, nettoInput) {
  const neuerBetrag = parseFloat(nettoInput?.value) || 0;
  const verfuegbar = contractBudget - bereitsVergeben - neuerBetrag;
  const banner = document.getElementById(BUDGET_BANNER_ID);
  if (!banner) return;

  const isOver = verfuegbar < 0;
  banner.className = `notice-box ${isOver ? 'notice-warning' : 'notice-info'} contracting-budget-banner`;
  const verfuegbarEl = banner.querySelector('.budget-verfuegbar');
  if (verfuegbarEl) {
    verfuegbarEl.textContent = fmtCurrency(verfuegbar);
    verfuegbarEl.classList.toggle('budget-over', isOver);
  }

  // Netto-Input visuell markieren
  if (nettoInput) {
    nettoInput.classList.toggle('input-error', isOver);
  }
}

async function loadBudgetData(auftragId) {
  const { data: rechnungen } = await window.supabase
    .from('rechnung')
    .select('nettobetrag')
    .eq('auftrag_id', auftragId)
    .eq('rechnungstyp', 'contracting');

  const vergeben = (rechnungen || []).reduce((sum, r) => sum + (parseFloat(r.nettobetrag) || 0), 0);
  return vergeben;
}

export async function setup(form, ctx) {
  const contractSelect = findSelect(form, 'auftrag_id');
  if (!contractSelect || !window.supabase) return;

  const isEditMode = form.dataset.isEditMode === 'true';
  const unternehmenField = findSelect(form, 'unternehmen_id');
  const creatorField = findSelect(form, 'creator_id');
  const nettoInput = form.querySelector('input[name="nettobetrag"]');
  const ustProzentInput = form.querySelector('input[name="ust_prozent"]');
  const ustAktivToggle = form.querySelector('input[name="ust_aktiv"]');
  const ustBetragInput = form.querySelector('input[name="ust_betrag"]');
  const bruttoInput = form.querySelector('input[name="bruttobetrag"]');

  let _contractBudget = 0;
  let _bereitsVergeben = 0;

  const berechne = () => {
    berechneRechnungFromInputs({
      nettoInput, zusatzInput: null, skontoToggle: null,
      ustAktivToggle, ustProzentInput,
      nettoGesamtInput: null, bruttoVorSkontoInput: null,
      skontoBetragInput: null, nettoNachSkontoInput: null,
      ustBetragInput, bruttoInput
    });
    if (_contractBudget > 0) {
      updateBudgetLiveCheck(form, _contractBudget, _bereitsVergeben, nettoInput);
    }
  };
  const debouncedBerechne = debounce(berechne, 50);

  if (nettoInput) nettoInput.addEventListener('input', debouncedBerechne);
  if (ustProzentInput) {
    ustProzentInput.addEventListener('input', debouncedBerechne);
    ustProzentInput.addEventListener('change', berechne);
  }
  if (ustAktivToggle) ustAktivToggle.addEventListener('change', berechne);

  if (isEditMode) {
    [contractSelect, unternehmenField].forEach(el => {
      if (!el) return;
      el.disabled = true;
      const container = el.parentNode.querySelector('.searchable-select-container');
      if (container) {
        const input = container.querySelector('.searchable-select-input');
        if (input) { input.setAttribute('disabled', 'true'); input.classList.add('is-disabled'); }
      }
    });
    if (ustAktivToggle && ustProzentInput) {
      ustAktivToggle.checked = (parseFloat(ustProzentInput.value) || 0) > 0;
    }
    setTimeout(berechne, 200);
    return;
  }

  // --- Create-Mode ---

  const onContractChange = async () => {
    const auftragId = contractSelect.value;
    if (!auftragId) {
      fillSelect(unternehmenField, '', '');
      removeBudgetBanner();
      _contractBudget = 0;
      _bereitsVergeben = 0;
      return;
    }

    const { data: auftrag, error } = await window.supabase
      .from('auftrag')
      .select('id, auftragsname, titel, nettobetrag, creator_budget, unternehmen_id, unternehmen:unternehmen_id(id, firmenname)')
      .eq('id', auftragId)
      .single();
    if (error || !auftrag) { console.error('❌ Contract laden fehlgeschlagen:', error); return; }

    fillSelect(unternehmenField, auftrag.unternehmen_id, auftrag.unternehmen?.firmenname || '—');

    // creator_budget = Netto abzüglich Agentur Fee/KSK; Fallback nettobetrag für Altbestände
    _contractBudget = parseFloat(auftrag.creator_budget ?? auftrag.nettobetrag) || 0;
    _bereitsVergeben = await loadBudgetData(auftragId);
    const verfuegbar = _contractBudget - _bereitsVergeben;

    renderBudgetBanner(form, _contractBudget, _bereitsVergeben, verfuegbar);

    // Speichere Budget-Daten am Form fuer den Submit-Check
    form.dataset.contractBudget = String(_contractBudget);
    form.dataset.bereitsVergeben = String(_bereitsVergeben);
  };

  contractSelect.addEventListener('change', onContractChange);

  // Creator-Wechsel: USt aus Creator ableiten
  if (creatorField) {
    creatorField.addEventListener('change', async () => {
      const creatorId = creatorField.value;
      if (!creatorId) return;
      const { data: creator } = await window.supabase
        .from('creator')
        .select('umsatzsteuerpflichtig')
        .eq('id', creatorId)
        .single();
      if (creator) {
        const isUstPflichtig = creator.umsatzsteuerpflichtig !== false;
        if (ustAktivToggle) ustAktivToggle.checked = isUstPflichtig;
        if (ustProzentInput) ustProzentInput.value = String(isUstPflichtig ? 19 : 0);
        berechne();
      }
    });
  }

  // URL-Param Prefill: ?type=contracting&contract=X
  const params = new URLSearchParams(window.location.search);
  const preContract = params.get('contract');

  if (preContract) {
    contractSelect.value = preContract;
    const container = contractSelect.parentNode.querySelector('.searchable-select-container');
    if (container) {
      const input = container.querySelector('.searchable-select-input');
      const opt = contractSelect.querySelector(`option[value="${preContract}"]`);
      if (input && opt) input.value = opt.textContent;
    }
    await onContractChange();
  }

  setTimeout(berechne, 200);
}
