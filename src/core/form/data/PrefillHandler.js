// PrefillHandler.js
// Vorausfüllung und Sperren von Feldern beim Öffnen einer Kooperation aus Kampagne-Kontext
// Wird als Mixin in DynamicDataLoader eingebunden.

// Kooperation Prefill: Felder aus Kampagne-Kontext vorausfüllen und sperren
export async function handleKooperationPrefill(form) {
  try {
    console.log('🎯 KOOPERATION PREFILL: Dataset Check:', {
      prefillFromKampagne: form.dataset.prefillFromKampagne,
      hasPrefillData: !!form.dataset.prefillData,
      rawData: form.dataset.prefillData?.substring(0, 200)
    });

    const prefillData = form.dataset.prefillData ? JSON.parse(form.dataset.prefillData) : {};
    console.log('🎯 KOOPERATION PREFILL: Parsed prefillData:', prefillData);

    const {
      unternehmen_id,
      marke_id,
      kampagne_id,
      _unternehmenName,
      _markeName,
      _kampagneName,
      _hasMarke
    } = prefillData;

    console.log('🎯 KOOPERATION PREFILL: Extrahierte Werte:', {
      unternehmen_id, marke_id, kampagne_id,
      _unternehmenName, _markeName, _kampagneName, _hasMarke
    });

    if (unternehmen_id) {
      await prefillAndLockField(form, 'unternehmen_id', unternehmen_id, _unternehmenName || 'Unternehmen');
    }

    if (_hasMarke && marke_id) {
      await prefillAndLockField(form, 'marke_id', marke_id, _markeName || 'Marke');
    } else {
      disableFieldWithMessage(form, 'marke_id', 'Keine Marke hinterlegt');
    }

    if (kampagne_id) {
      await prefillAndLockField(form, 'kampagne_id', kampagne_id, _kampagneName || 'Kampagne');
    }

    console.log('✅ KOOPERATION PREFILL: Vorausfüllung abgeschlossen');
  } catch (error) {
    console.error('❌ KOOPERATION PREFILL: Fehler bei Vorausfüllung:', error);
  }
}

// Feld vorausfüllen und sperren
export async function prefillAndLockField(form, fieldName, value, displayLabel) {
  console.log(`🔒 PREFILL: Sperre ${fieldName} mit Wert:`, value, displayLabel);

  const selectElement = form.querySelector(`select[name="${fieldName}"]`);
  console.log(`🔒 PREFILL: Select "${fieldName}" gefunden:`, !!selectElement);

  if (selectElement) {
    let optionElement = selectElement.querySelector(`option[value="${value}"]`);
    if (!optionElement) {
      console.log(`🔒 PREFILL: Option für "${value}" nicht gefunden, füge hinzu`);
      optionElement = document.createElement('option');
      optionElement.value = value;
      optionElement.textContent = displayLabel;
      selectElement.appendChild(optionElement);
    }

    optionElement.selected = true;
    selectElement.value = value;
    selectElement.disabled = true;

    selectElement.dataset.prefilled = 'true';
    selectElement.dataset.prefilledValue = value;

    console.log(`🔒 PREFILL: Select "${fieldName}" Wert gesetzt:`, selectElement.value);
  }

  const formGroup = selectElement?.closest('.form-group');
  let container = null;

  if (selectElement?.parentNode) {
    container = selectElement.parentNode.querySelector('.searchable-select-container');
  }
  if (!container && selectElement?.nextElementSibling?.classList.contains('searchable-select-container')) {
    container = selectElement.nextElementSibling;
  }
  if (!container && formGroup) {
    container = formGroup.querySelector('.searchable-select-container');
  }

  console.log(`🔒 PREFILL: Container für "${fieldName}" gefunden:`, !!container);

  if (container) {
    const input = container.querySelector('.searchable-select-input');
    if (input) {
      input.value = displayLabel;
      input.disabled = true;
      input.readOnly = true;
      console.log(`🔒 PREFILL: Input für "${fieldName}" auf "${displayLabel}" gesetzt`);
    }

    container.classList.add('prefilled-locked');
  }

  if (formGroup) {
    formGroup.classList.add('form-field--prefilled');

    const label = formGroup.querySelector('label');
    if (label && !label.querySelector('.prefill-badge')) {
      const badge = document.createElement('span');
      badge.className = 'prefill-badge';
      badge.textContent = ' (aus Kampagne)';
      label.appendChild(badge);
    }
  }
}

// Feld deaktivieren mit Hinweistext
export function disableFieldWithMessage(form, fieldName, message) {
  console.log(`⚠️ PREFILL: Deaktiviere ${fieldName} mit Nachricht:`, message);

  const selectElement = form.querySelector(`select[name="${fieldName}"]`);
  if (selectElement) {
    selectElement.innerHTML = `<option value="">${message}</option>`;
    selectElement.value = '';
    selectElement.disabled = true;
  }

  let container = null;
  if (selectElement?.parentNode) {
    container = selectElement.parentNode.querySelector('.searchable-select-container');
  }

  if (container) {
    const input = container.querySelector('.searchable-select-input');
    if (input) {
      input.value = '';
      input.placeholder = message;
      input.disabled = true;
      input.readOnly = true;
      console.log(`⚠️ PREFILL: Input für "${fieldName}" deaktiviert mit Nachricht`);
    }

    container.classList.add('prefilled-no-marke');

    const dropdown = container.querySelector('.searchable-select-dropdown');
    if (dropdown) {
      dropdown.innerHTML = `<div class="dropdown-item no-results">${message}</div>`;
    }
  }

  const formGroup = selectElement?.closest('.form-group');
  if (formGroup) {
    formGroup.classList.add('form-field--no-marke');
  }
}
