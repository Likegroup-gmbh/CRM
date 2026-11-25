// AuftragsdetailsCreateEvents.js
// Events: Formular-Bindings, Kaskade Unternehmen -> Auftrag -> Kampagnenarten, Submit
// (Prototype-Mixin von AuftragsdetailsCreateController)

import { AuftragsdetailsCreateController } from './AuftragsdetailsCreateCore.js';
import { buildAuftragsdetailsPayload } from './logic/AuftragsdetailsPayload.js';
import { navigateBack } from '../../core/breadcrumbTrail.js';

const HINWEIS_UNTERNEHMEN_UND_AUFTRAG = 'Bitte wählen Sie ein Unternehmen und dann einen Auftrag aus.';
const HINWEIS_AUFTRAG = 'Bitte wählen Sie einen Auftrag aus, um die Kampagnenart-Auswahl anzuzeigen.';
const HINWEIS_KAMPAGNENARTEN_AKTIVIEREN =
  'Wählen Sie oben die Kampagnenarten aus und klicken Sie auf "Aktivieren", um die Budget-Felder anzuzeigen.';

function showInfoHinweis(container, text) {
  if (!container) return;
  container.innerHTML = `
    <div class="alert alert-info">
      <p>${text}</p>
    </div>
  `;
}

/**
 * Setzt die Kampagnenart-/Budget-Bereiche zurück (Kaskade-Reset):
 * Section ausblenden, Hinweis anzeigen, Submit deaktivieren, Kampagnenanzahl leeren.
 */
function resetKaskadeUi(hinweisText) {
  const selectionSection = document.getElementById('kampagnenart-selection-section');
  const container = document.getElementById('kampagnenart-sections-container');
  const submitBtn = document.getElementById('submit-btn');
  const kampagnenField = document.getElementById('kampagnenanzahl');

  if (selectionSection) selectionSection.style.display = 'none';
  showInfoHinweis(container, hinweisText);
  if (submitBtn) submitBtn.disabled = true;
  if (kampagnenField) {
    kampagnenField.value = '';
    kampagnenField.style.backgroundColor = '';
  }
}

Object.assign(AuftragsdetailsCreateController.prototype, {
  // Events binden
  bindFormEvents() {
    this.cleanupBindings();
    this._eventsBound = true;

    const form = document.getElementById('auftragsdetails-form');
    if (!form) return;

    // KASKADE: Unternehmen-Auswahl Listener
    this.bindUnternehmenChangeListener();

    // KASKADE: Auftrag-Auswahl Listener (Kampagnenart-Selection Section anzeigen)
    this.bindAuftragChangeListener();

    // Aktivieren-Button Event
    const activateBtn = document.getElementById('activate-kampagnenarten-btn');
    if (activateBtn) {
      this.addManagedListener(activateBtn, 'click', async () => {
        activateBtn.disabled = true;
        activateBtn.textContent = 'Aktiviere...';
        try {
          await this.activateKampagnenarten();
        } finally {
          activateBtn.disabled = false;
          activateBtn.textContent = 'Aktivieren';
        }
      });
    }

    // Submit Handler
    this.addManagedListener(form, 'submit', (e) => this.handleFormSubmit(e));
  },

  /**
   * Bindet einen Wert-Handler an ein (Searchable-)Select:
   * change auf dem Select sowie value-Änderungen/input auf dem Hidden Input `${selectId}_value`.
   */
  bindSelectValueChange(selectId, handler) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Event auf Original-Select (für Searchable Select)
    this.addManagedListener(select, 'change', (e) => handler(e.target.value));

    // Auch auf Hidden Input hören (falls FormSystem diesen verwendet)
    const hiddenInput = document.getElementById(`${selectId}_value`);
    if (!hiddenInput) return;

    const observer = new MutationObserver(() => handler(hiddenInput.value));
    observer.observe(hiddenInput, { attributes: true, attributeFilter: ['value'] });
    this.trackObserver(observer);

    this.addManagedListener(hiddenInput, 'input', (e) => handler(e.target.value));
  },

  /**
   * Event-Listener für Unternehmen-Auswahl (Kaskade Schritt 1)
   */
  bindUnternehmenChangeListener() {
    const handleUnternehmenChange = async (unternehmenId) => {
      console.log('🏢 Unternehmen geändert:', unternehmenId);

      if (!unternehmenId) {
        // Reset bei keiner Auswahl
        this.currentUnternehmenId = null;
        this.currentAuftragId = null;
        this.auftraege = [];

        this.updateAuftragSelect([]);
        const auftragSelect = document.getElementById('auftrag_id');
        if (auftragSelect) auftragSelect.disabled = true;
        resetKaskadeUi(HINWEIS_UNTERNEHMEN_UND_AUFTRAG);
        return;
      }

      this.currentUnternehmenId = unternehmenId;
      this.currentAuftragId = null;

      // Lade Aufträge für dieses Unternehmen und aktualisiere das Auftrag-Dropdown
      this.auftraege = await this.loadAuftraegeForUnternehmen(unternehmenId);
      this.updateAuftragSelect(this.auftraege);

      resetKaskadeUi(HINWEIS_AUFTRAG);
    };

    this.bindSelectValueChange('unternehmen_id', handleUnternehmenChange);
  },

  /**
   * Event-Listener für Auftrag-Auswahl (Kaskade Schritt 2)
   */
  bindAuftragChangeListener() {
    const handleAuftragChange = async (auftragId) => {
      console.log('📋 Auftrag geändert:', auftragId);

      if (!auftragId) {
        // Kein Auftrag ausgewählt - Reset
        this.currentAuftragId = null;
        resetKaskadeUi(HINWEIS_AUFTRAG);
        return;
      }

      this.currentAuftragId = auftragId;

      // Kampagnenanzahl vom Auftrag übernehmen
      const kampagnenField = document.getElementById('kampagnenanzahl');
      const selectedAuftrag = this.auftraege.find(a => a.id === auftragId);
      if (selectedAuftrag?.kampagnenanzahl && kampagnenField) {
        kampagnenField.value = selectedAuftrag.kampagnenanzahl;
        kampagnenField.style.backgroundColor = '#f5f5f5';
        console.log(`✅ Kampagnenanzahl ${selectedAuftrag.kampagnenanzahl} vom Auftrag übernommen`);
      } else if (kampagnenField) {
        kampagnenField.value = '';
        kampagnenField.style.backgroundColor = '';
      }

      // Lade bereits vorhandene Kampagnenarten für diesen Auftrag
      console.log('🔄 Lade Kampagnenarten für Auftrag:', auftragId);
      const kampagnenarten = await this.loadKampagnenartenForAuftrag(auftragId);
      this.currentKampagnenarten = kampagnenarten;

      // Zeige Kampagnenart-Selection Section
      const selectionSection = document.getElementById('kampagnenart-selection-section');
      if (selectionSection) {
        selectionSection.style.display = 'block';
      }

      // Initialisiere das TagBased-Multiselect
      await this.initKampagnenartSelect(kampagnenarten);

      if (kampagnenarten.length === 0) {
        // Hinweis, dass Kampagnenarten gewählt werden müssen
        showInfoHinweis(
          document.getElementById('kampagnenart-sections-container'),
          HINWEIS_KAMPAGNENARTEN_AKTIVIEREN
        );
        return;
      }

      // Bereits vorhandene Kampagnenarten: Budget-Sections mit bestehenden Werten zeigen
      let existingValues = {};
      try {
        existingValues = await this.repository.loadExistingValuesForAuftrag(auftragId);
      } catch (e) {
        console.warn('⚠️ Keine bestehenden auftrag_details gefunden');
      }

      this.renderDynamicSections(kampagnenarten, existingValues);

      // Aktiviere den Erstellen-Button
      const submitBtn = document.getElementById('submit-btn');
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    };

    this.bindSelectValueChange('auftrag_id', handleAuftragChange);
  },

  // Handle Form Submit
  async handleFormSubmit(e) {
    e.preventDefault();

    const resetSubmitBtn = (submitBtn) => {
      if (!submitBtn) return;
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
    };

    try {
      const submitBtn = document.querySelector('#auftragsdetails-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;
      }

      const form = document.getElementById('auftragsdetails-form');
      const data = buildAuftragsdetailsPayload(form);

      console.log('📤 Auftragsdetails-Daten vorbereitet:', Object.keys(data).length, 'Felder');

      // Validierung
      if (!data.auftrag_id) {
        resetSubmitBtn(submitBtn);
        return;
      }

      data.created_by_id = window.currentUser?.id || null;

      // Idempotent und race-safe speichern
      const result = await this.repository.upsertAuftragsdetails(data);
      console.log('✅ Auftragsdetails erfolgreich gespeichert');

      // Success-State für Button
      if (submitBtn) {
        submitBtn.classList.remove('is-loading');
        submitBtn.classList.add('is-success');
      }

      // Event auslösen für Listen-Update
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'auftrag_details', id: result.id, action: 'saved' }
      }));

      // Kurz warten damit Success-State sichtbar ist, dann navigieren
      this._navigateTimer = setTimeout(() => {
        navigateBack('/auftragsdetails');
      }, 400);

    } catch (error) {
      console.error('Fehler beim Erstellen:', error);
      window.ErrorHandler?.handle(error, 'AuftragsdetailsCreate.handleFormSubmit');

      resetSubmitBtn(document.querySelector('#auftragsdetails-form button[type="submit"]'));
    }
  }
});
