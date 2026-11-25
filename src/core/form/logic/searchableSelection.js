// searchableSelection.js
// Wert in ein Searchable-Select schreiben. PDF-Auslesung, Dropdown-Klick und
// Platzhalter-Reset teilen sich diesen Weg, damit die DOM-Struktur nur hier steht.

// Die Option mit leerem Wert ist der Platzhalter („– Marke wählen –“): ihr
// Label gehört in input.placeholder, nie in input.value, sonst filtert das
// Dropdown beim Öffnen nach dem Platzhaltertext.
export function isPlaceholderOption(option) {
  return String(option?.value ?? '') === '';
}

export function applySearchableSelection(selectEl, { value, label, optionLabel, dataset } = {}) {
  if (!selectEl || value == null) return false;

  let optionElement = Array.from(selectEl.options).find(opt => opt.value === value);
  if (!optionElement) {
    optionElement = document.createElement('option');
    optionElement.value = value;
    optionElement.textContent = optionLabel ?? label ?? '';
    selectEl.appendChild(optionElement);
  }
  if (dataset) {
    Object.entries(dataset).forEach(([key, val]) => {
      if (val != null && val !== '') optionElement.dataset[key] = val;
    });
  }

  selectEl.value = value;

  const container = selectEl.parentNode?.querySelector('.searchable-select-container');
  const hidden = document.getElementById(`${selectEl.id}_value`)
    || document.getElementById(`${selectEl.id}-hidden`)
    || container?.querySelector('input[type="hidden"]');
  if (hidden) hidden.value = value;

  const input = container?.querySelector('.searchable-select-input');
  if (input) {
    input.value = label ?? '';
    if (input.hasAttribute('data-was-required')) input.setCustomValidity('');
  }

  selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
