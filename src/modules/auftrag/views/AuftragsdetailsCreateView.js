export class AuftragsdetailsCreateView {
  renderForm({ isEditMode, unternehmen, allKampagnenartTypen }) {
    return `
      <div class="form-page">
        <form id="auftragsdetails-form" data-entity="auftragsdetails">
          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="unternehmen_id">Unternehmen auswählen <span class="required">*</span></label>
              <select id="unternehmen_id" name="unternehmen_id" required data-searchable="true" data-placeholder="Unternehmen suchen...">
                ${unternehmen.length === 0
                  ? '<option value="">Keine Unternehmen zugeordnet</option>'
                  : '<option value="">Bitte wählen...</option>'
                }
              </select>
              ${unternehmen.length === 0
                ? '<small class="form-hint" style="color: var(--color-error);">Sie haben keine Unternehmen zugeordnet.</small>'
                : '<small class="form-hint">Wählen Sie zuerst ein Unternehmen, um die verfügbaren Aufträge zu sehen.</small>'
              }
            </div>

            <div class="form-field form-field--half">
              <label for="auftrag_id">Auftrag auswählen <span class="required">*</span></label>
              <select id="auftrag_id" name="auftrag_id" required disabled data-searchable="true" data-placeholder="Erst Unternehmen wählen...">
                <option value="">Erst Unternehmen wählen...</option>
              </select>
              <small class="form-hint" id="auftrag-hint">Aufträge werden nach Unternehmen-Auswahl geladen.</small>
            </div>
          </div>

          <div class="form-two-col">
            <div class="form-field form-field--half">
              <label for="kampagnenanzahl">Anzahl Kampagnen</label>
              <input type="number" id="kampagnenanzahl" name="kampagnenanzahl" min="0" placeholder="Wird aus Auftrag übernommen..." readonly>
              <small class="form-hint">Wird automatisch aus dem Auftrag übernommen</small>
            </div>
            <div class="form-field form-field--half"></div>
          </div>

          <div id="kampagnenart-selection-section" class="details-section" style="display: none;">
            <h3>Art der Kampagne</h3>
            <p class="form-hint">Wählen Sie die Kampagnenarten für diesen Auftrag aus und klicken Sie auf "Aktivieren".</p>
            <div class="form-field">
              <select id="kampagnenart-select"
                      name="art_der_kampagne"
                      multiple
                      data-searchable="true"
                      data-tag-based="true"
                      data-placeholder="Kampagnenart suchen und auswählen...">
              </select>
            </div>
            <div class="kampagnenart-activate-actions">
              <button type="button" id="activate-kampagnenarten-btn" class="primary-btn">
                Aktivieren
              </button>
            </div>
          </div>

          <div id="kampagnenart-sections-container">
            <div class="alert alert-info">
              <p>Bitte wählen Sie einen Auftrag aus, um die Kampagnenart-Auswahl anzuzeigen.</p>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="mdc-btn mdc-btn--cancel" onclick="window.navigateTo('/auftragsdetails')">
              <span class="mdc-btn__icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </span>
              <span class="mdc-btn__label">Abbrechen</span>
            </button>
            <button type="submit" class="mdc-btn ${isEditMode ? 'mdc-btn--save' : 'mdc-btn--create'}" id="submit-btn" data-variant="@create-prd.mdc" data-entity-label="Auftragsdetails" data-mode="${isEditMode ? 'edit' : 'create'}" disabled>
              <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
                </svg>
              </span>
              <span class="mdc-btn__spinner" aria-hidden="true">
                <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                  <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
                </svg>
              </span>
              <span class="mdc-btn__label">${isEditMode ? 'Speichern' : 'Erstellen'}</span>
            </button>
          </div>
        </form>
      </div>
    `;
  }

  setSelectOptions(selectElement, options = [], { placeholder = 'Bitte wählen...', emptyLabel = 'Keine Optionen verfügbar' } = {}) {
    if (!selectElement) return;
    selectElement.innerHTML = '';

    const firstOption = document.createElement('option');
    firstOption.value = '';
    firstOption.textContent = options.length === 0 ? emptyLabel : placeholder;
    selectElement.appendChild(firstOption);

    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      selectElement.appendChild(optionElement);
    });
  }

  populateUnternehmenOptions(unternehmen) {
    const unternehmenSelect = document.getElementById('unternehmen_id');
    if (!unternehmenSelect) return;
    this.setSelectOptions(
      unternehmenSelect,
      (unternehmen || []).map(u => ({ value: u.id, label: u.firmenname })),
      { placeholder: 'Bitte wählen...', emptyLabel: 'Keine Unternehmen zugeordnet' }
    );
  }

  populateKampagnenartOptions(allKampagnenartTypen) {
    const kampagnenartSelect = document.getElementById('kampagnenart-select');
    if (!kampagnenartSelect) return;
    kampagnenartSelect.innerHTML = '';
    (allKampagnenartTypen || []).forEach(typ => {
      const optionElement = document.createElement('option');
      optionElement.value = typ.id;
      optionElement.textContent = typ.name;
      kampagnenartSelect.appendChild(optionElement);
    });
  }
}

export const auftragsdetailsCreateView = new AuftragsdetailsCreateView();
