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

    // Safety Net: Falls die Cascade die Searchable-Container fuer marke_id /
    // kampagne_id erst spaeter erstellt (DependencyMap-Loader), beobachten wir
    // das Form max. 2.5s lang und locken/labeln den Container nachtraeglich.
    setupPrefillObserver(form, [
      { name: 'marke_id', value: _hasMarke && marke_id ? marke_id : null, label: _markeName || 'Marke' },
      { name: 'kampagne_id', value: kampagne_id || null, label: _kampagneName || 'Kampagne' }
    ]);

    console.log('✅ KOOPERATION PREFILL: Vorausfüllung abgeschlossen');
  } catch (error) {
    console.error('❌ KOOPERATION PREFILL: Fehler bei Vorausfüllung:', error);
  }
}

// MutationObserver der einmalig fuer jedes Prefill-Feld den Lock setzt, wenn
// der Searchable-Container erst nach dem initialen Prefill auftaucht (z.B.
// durch Cascade-Reload nach unternehmen_id-change).
function setupPrefillObserver(form, targets) {
  if (!form || !Array.isArray(targets)) return;
  const pending = new Map();
  for (const t of targets) {
    if (t && t.name && t.value) pending.set(t.name, t);
  }
  if (pending.size === 0) return;

  const tryLock = (fieldName) => {
    const target = pending.get(fieldName);
    if (!target) return;

    const select = form.querySelector(`select[name="${fieldName}"]`)
      || form.querySelector(`select#${fieldName}`);
    if (!select) return;

    let container = null;
    if (select.previousElementSibling?.classList?.contains('searchable-select-container')) {
      container = select.previousElementSibling;
    } else if (select.nextElementSibling?.classList?.contains('searchable-select-container')) {
      container = select.nextElementSibling;
    } else if (select.parentNode) {
      container = select.parentNode.querySelector('.searchable-select-container');
    }
    if (!container) {
      const formField = select.closest('.form-field, .form-group');
      container = formField?.querySelector('.searchable-select-container');
    }
    if (!container) return;

    const input = container.querySelector('.searchable-select-input');
    if (input && (!input.value || input.value !== target.label)) {
      input.value = target.label;
      input.disabled = true;
      input.readOnly = true;
    }
    container.classList.add('prefilled-locked');

    const hiddenInput = container.querySelector(`input[type="hidden"][name="${fieldName}"]`)
      || form.querySelector(`input[type="hidden"][name="${fieldName}"]`);
    if (hiddenInput && hiddenInput.value !== target.value) {
      hiddenInput.value = target.value;
      hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const formField = container.closest('.form-field, .form-group')
      || select.closest('.form-field, .form-group');
    if (formField) {
      formField.classList.add('form-field--prefilled');
      const lbl = formField.querySelector('label');
      if (lbl && !lbl.querySelector('.prefill-badge')) {
        const badge = document.createElement('span');
        badge.className = 'prefill-badge';
        badge.textContent = ' (aus Kampagne)';
        lbl.appendChild(badge);
      }
    }

    pending.delete(fieldName);
  };

  // Erstmal sofort versuchen (falls Container schon da ist)
  for (const name of Array.from(pending.keys())) tryLock(name);
  if (pending.size === 0) return;

  const observer = new MutationObserver(() => {
    for (const name of Array.from(pending.keys())) tryLock(name);
    if (pending.size === 0) {
      observer.disconnect();
    }
  });
  observer.observe(form, { childList: true, subtree: true });

  setTimeout(() => observer.disconnect(), 2500);
}

// Feld vorausfüllen und sperren
export async function prefillAndLockField(form, fieldName, value, displayLabel) {
  console.log(`🔒 PREFILL: Sperre ${fieldName} mit Wert:`, value, displayLabel);

  // Searchable-Selects entfernen das `name`-Attribut vom <select> und legen
  // dafuer einen <input type="hidden" name="..."> an. Daher beide Varianten
  // suchen: per name-Attribut UND per ID (FormRenderer setzt id=field.name).
  let selectElement = form.querySelector(`select[name="${fieldName}"]`);
  if (!selectElement) {
    selectElement = form.querySelector(`select#${fieldName}`);
  }
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
    if (displayLabel) selectElement.dataset.prefilledLabel = displayLabel;

    console.log(`🔒 PREFILL: Select "${fieldName}" Wert gesetzt:`, selectElement.value);
  }

  // Hidden Input fuer Searchable-Selects: liefert beim Form-Submit den Wert.
  // Wenn das Searchable bereits initialisiert wurde, ist das hier der einzige
  // Weg, den Wert ins FormData zu bekommen.
  const hiddenInput = form.querySelector(`input[type="hidden"][name="${fieldName}"]`);
  if (hiddenInput) {
    hiddenInput.value = value;
    console.log(`🔒 PREFILL: Hidden input "${fieldName}" gesetzt auf:`, value);
  }

  // Form-Field finden (Wrapper-Klasse heisst `form-field`, alte Variante
  // `form-group` weiter als Fallback).
  const formField = selectElement?.closest('.form-field, .form-group')
    || hiddenInput?.closest('.form-field, .form-group')
    || form.querySelector(`label[for="${fieldName}"]`)?.closest('.form-field, .form-group');

  // Container suchen - Searchable-Container kann VOR oder NACH dem Select stehen.
  let container = null;
  if (selectElement?.previousElementSibling?.classList?.contains('searchable-select-container')) {
    container = selectElement.previousElementSibling;
  }
  if (!container && selectElement?.nextElementSibling?.classList?.contains('searchable-select-container')) {
    container = selectElement.nextElementSibling;
  }
  if (!container && selectElement?.parentNode) {
    container = selectElement.parentNode.querySelector('.searchable-select-container');
  }
  if (!container && formField) {
    container = formField.querySelector('.searchable-select-container');
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

  if (formField) {
    formField.classList.add('form-field--prefilled');

    const label = formField.querySelector('label');
    if (label && !label.querySelector('.prefill-badge')) {
      const badge = document.createElement('span');
      badge.className = 'prefill-badge';
      badge.textContent = ' (aus Kampagne)';
      label.appendChild(badge);
    }
  }

  // Aenderung explizit signalisieren, damit nachfolgende Cascades / Auto-Gen
  // (z.B. Kooperationsname) den neuen Wert aufgreifen.
  if (selectElement) {
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (hiddenInput) {
    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// Feld deaktivieren mit Hinweistext
export function disableFieldWithMessage(form, fieldName, message) {
  console.log(`⚠️ PREFILL: Deaktiviere ${fieldName} mit Nachricht:`, message);

  let selectElement = form.querySelector(`select[name="${fieldName}"]`);
  if (!selectElement) {
    selectElement = form.querySelector(`select#${fieldName}`);
  }
  if (selectElement) {
    selectElement.innerHTML = `<option value="">${message}</option>`;
    selectElement.value = '';
    selectElement.disabled = true;
  }

  const hiddenInput = form.querySelector(`input[type="hidden"][name="${fieldName}"]`);
  if (hiddenInput) {
    hiddenInput.value = '';
  }

  const formField = selectElement?.closest('.form-field, .form-group')
    || hiddenInput?.closest('.form-field, .form-group')
    || form.querySelector(`label[for="${fieldName}"]`)?.closest('.form-field, .form-group');

  let container = null;
  if (selectElement?.previousElementSibling?.classList?.contains('searchable-select-container')) {
    container = selectElement.previousElementSibling;
  }
  if (!container && selectElement?.nextElementSibling?.classList?.contains('searchable-select-container')) {
    container = selectElement.nextElementSibling;
  }
  if (!container && selectElement?.parentNode) {
    container = selectElement.parentNode.querySelector('.searchable-select-container');
  }
  if (!container && formField) {
    container = formField.querySelector('.searchable-select-container');
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

  if (formField) {
    formField.classList.add('form-field--no-marke');
  }
}
