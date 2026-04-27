export class FieldStateHelpers {

  static setFieldState(field, state, fieldConfig = {}) {
    const inputs = FieldStateHelpers._getSearchableInputs(field);

    for (const input of inputs) {
      switch (state) {
        case 'loading':
          input.disabled = true;
          input.placeholder = 'Lädt...';
          input.classList.add('loading');
          break;

        case 'loaded':
          input.classList.remove('loading');
          break;

        case 'error':
          input.placeholder = 'Fehler beim Laden';
          input.classList.add('error');
          setTimeout(() => {
            input.classList.remove('error');
            input.placeholder = fieldConfig.placeholder || 'Bitte wählen...';
          }, 3000);
          break;
      }
    }
  }

  static showLoadingState(field, fieldConfig) {
    FieldStateHelpers.setFieldState(field, 'loading', fieldConfig);
  }

  static hideLoadingState(field) {
    FieldStateHelpers.setFieldState(field, 'loaded');
  }

  static showErrorState(field, fieldConfig) {
    FieldStateHelpers.setFieldState(field, 'error', fieldConfig);
  }

  static setNoOptionsState(field, fieldConfig, message) {
    const container = field.closest('.searchable-select-container, .tag-based-select');
    if (container) {
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.value = '';
        input.placeholder = message;
        input.disabled = true;
      }
      const dropdown = container.querySelector('.searchable-select-dropdown');
      if (dropdown) {
        dropdown.innerHTML = `<div class="dropdown-item no-results">${message}</div>`;
      }
      const hiddenValue = document.getElementById(field.id + '_value');
      if (hiddenValue) {
        hiddenValue.value = '';
      }
    }
    field.innerHTML = `<option value="">${message}</option>`;
    field.value = '';
    field.disabled = true;
  }

  static enableSearchableField(field, fieldConfig) {
    field.disabled = false;
    const container = field.closest('.searchable-select-container, .tag-based-select');
    if (container) {
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.disabled = false;
        input.placeholder = fieldConfig.placeholder || 'Suchen...';
      }
      const dropdown = container.querySelector('.searchable-select-dropdown');
      if (dropdown) {
        dropdown.innerHTML = '';
      }
    }
  }

  static resetCascadeFields(form, fieldNames) {
    fieldNames.forEach(fieldName => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        field.value = '';
        field.disabled = true;

        const container = field.closest('.searchable-select-container, .tag-based-select');
        if (container) {
          const input = container.querySelector('.searchable-select-input');
          if (input) {
            input.value = '';
            input.placeholder = `Erst ${FieldStateHelpers.getFieldLabel(fieldName.replace('_id', ''))} auswählen...`;
          }

          const tagsContainer = container.querySelector('.tags-container');
          if (tagsContainer) {
            tagsContainer.innerHTML = '';
          }
        }

        const placeholder = `Erst ${FieldStateHelpers.getFieldLabel(fieldName.replace('_id', ''))} auswählen...`;
        field.innerHTML = `<option value="">${placeholder}</option>`;
      }
    });
  }

  static getFieldLabel(fieldName) {
    const labelMap = {
      'unternehmen': 'Unternehmen',
      'unternehmen_id': 'Unternehmen',
      'marke': 'Marke',
      'marke_id': 'Marke',
      'marke_ids': 'Marke',
      'auftrag': 'Auftrag',
      'auftrag_id': 'Auftrag',
      'kampagne': 'Kampagne',
      'kampagne_id': 'Kampagne'
    };
    return labelMap[fieldName] || fieldName;
  }

  static _getSearchableInputs(field) {
    const inputs = [];
    const sibling = field.nextElementSibling;
    if (sibling && sibling.classList.contains('searchable-select-container')) {
      const input = sibling.querySelector('.searchable-select-input');
      if (input) inputs.push(input);
    }
    const tagContainer = field.closest('.form-field')?.querySelector('.tag-based-select');
    if (tagContainer) {
      const input = tagContainer.querySelector('.searchable-select-input');
      if (input) inputs.push(input);
    }
    return inputs;
  }
}
