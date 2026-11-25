// searchableSelectCreate.js
// allowCreate: getippten Wert als Lookup-Eintrag anlegen und direkt auswählen.

export function installSearchableCreate(proto) {
  Object.assign(proto, {
    async handleCreateNewOption(dropdown, options, newValue, field) {
      try {
        const newEntry = await this.createLookupEntry(field.table, field.displayField, newValue);

        const newOption = {
          value: newEntry[field.valueField],
          label: newEntry[field.displayField],
          selected: false
        };

        options.push(newOption);

        const selectElement = dropdown.parentNode.parentNode.querySelector('select');
        const input = dropdown.parentNode.querySelector('.searchable-select-input');
        const hiddenInput = dropdown.parentNode.querySelector('input[type="hidden"]');

        const optionElement = document.createElement('option');
        optionElement.value = newOption.value;
        optionElement.textContent = newOption.label;
        selectElement.appendChild(optionElement);

        selectElement.value = newOption.value;
        input.value = newOption.label;
        if (hiddenInput) {
          hiddenInput.value = newOption.value;
        }

        if (input.hasAttribute('data-was-required')) {
          input.setCustomValidity('');
        }

        selectElement.dispatchEvent(new Event('change', { bubbles: true }));

        dropdown.classList.remove('show');

        if (window.staticDataCache) {
          window.staticDataCache.invalidate(field.table);
        }

      } catch (error) {
        console.error('Fehler beim Erstellen der neuen Option:', error);
        alert(`Fehler beim Erstellen: ${error.message || 'Unbekannter Fehler'}`);
      }
    },

    // Neuen Lookup-Eintrag in DB erstellen
    async createLookupEntry(table, displayField, value) {
      try {
        const { data, error } = await window.supabase
          .from(table)
          .insert({ [displayField]: value })
          .select()
          .single();

        if (error) {
          console.error(`Fehler beim Erstellen in ${table}:`, error);
          throw error;
        }

        return data;
      } catch (err) {
        console.error(`createLookupEntry fehlgeschlagen:`, err);
        throw err;
      }
    }
  });
}
