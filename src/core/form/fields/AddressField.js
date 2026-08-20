import { BaseField } from './BaseField.js';
import { icon } from '../../../core/icons/IconSystem.js';

export class AddressField extends BaseField {
  render() {
    const dependsOn = this.field.dependsOn ? `data-depends-on="${this.field.dependsOn}"` : '';
    const showWhen = this.field.showWhen ? `data-show-when="${this.field.showWhen}"` : '';
    
    return `
      <div class="form-field form-field-full" ${dependsOn} ${showWhen}>
        <label for="${this.fieldId}" class="addresses-label">${this.field.label}</label>
        <div class="addresses-container" id="${this.fieldId}">
          <div class="addresses-list">
            <!-- Adressen werden hier dynamisch hinzugefügt -->
          </div>
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm add-address-btn address-add-btn">
            ${icon('plus', { className: 'w-4 h-4 icon-16' })}
            Adresse hinzufügen
          </button>
        </div>
      </div>
    `;
  }

  // Neue Adresszeile hinzufügen
  addAddressRow(addressesList) {
    const addressId = `address-${Date.now()}`;
    const addressHtml = `
      <div class="address-item address-card" data-address-id="${addressId}">
        <div class="address-header">
          <h4>Adresse ${addressId}</h4>
          <button type="button" class="btn-remove-address address-remove-btn" onclick="this.closest('.address-item').remove()">
            Entfernen
          </button>
        </div>
        <div class="address-fields address-fields-grid">
          <div class="form-field grid-span-all">
            <label class="address-label">Adressname</label>
            <input type="text" name="adressname_${addressId}" placeholder="z.B. Hauptbüro, Filiale, etc."
                   class="address-input">
          </div>
          <div class="form-field">
            <label class="address-label">Straße</label>
            <input type="text" name="strasse_${addressId}" placeholder="Musterstraße"
                   class="address-input">
          </div>
          <div class="form-field">
            <label class="address-label">Hausnummer</label>
            <input type="text" name="hausnummer_${addressId}" placeholder="123"
                   class="address-input">
          </div>
          <div class="form-field">
            <label class="address-label">PLZ</label>
            <input type="text" name="plz_${addressId}" placeholder="12345"
                   class="address-input">
          </div>
          <div class="form-field">
            <label class="address-label">Stadt</label>
            <input type="text" name="stadt_${addressId}" placeholder="Musterstadt"
                   class="address-input">
          </div>
          <div class="form-field">
            <label class="address-label">Land</label>
            <input type="text" name="land_${addressId}" placeholder="Deutschland"
                   class="address-input">
          </div>
          <div class="form-field grid-span-all">
            <label class="address-label">Notiz</label>
            <textarea name="notiz_${addressId}" rows="2" placeholder="Zusätzliche Informationen"
                      class="address-input"></textarea>
          </div>
        </div>
      </div>
    `;
    
    addressesList.insertAdjacentHTML('beforeend', addressHtml);
  }

  // Adressen-Felder einrichten
  setupAddressesFields(form) {
    const addressesContainers = form.querySelectorAll('.addresses-container');
    
    addressesContainers.forEach(container => {
      const addBtn = container.querySelector('.add-address-btn');
      const addressesList = container.querySelector('.addresses-list');
      
      if (addBtn && addressesList) {
        addBtn.addEventListener('click', () => {
          this.addAddressRow(addressesList);
        });
      }
    });
  }

  // Adressen verarbeiten
  async handleKampagneAddresses(kampagneId, form) {
    try {
      const addressesContainer = form.querySelector('.addresses-list');
      if (!addressesContainer) return;

      const addressItems = addressesContainer.querySelectorAll('.address-item');
      const addresses = [];

      addressItems.forEach(item => {
        const addressId = item.dataset.addressId;
        const address = {
          kampagne_id: kampagneId,
          adressname: form.querySelector(`input[name="adressname_${addressId}"]`)?.value || '',
          strasse: form.querySelector(`input[name="strasse_${addressId}"]`)?.value || '',
          hausnummer: form.querySelector(`input[name="hausnummer_${addressId}"]`)?.value || '',
          plz: form.querySelector(`input[name="plz_${addressId}"]`)?.value || '',
          stadt: form.querySelector(`input[name="stadt_${addressId}"]`)?.value || '',
          land: form.querySelector(`input[name="land_${addressId}"]`)?.value || '',
          notiz: form.querySelector(`textarea[name="notiz_${addressId}"]`)?.value || ''
        };

        // Nur hinzufügen wenn mindestens Adressname vorhanden
        if (address.adressname.trim()) {
          addresses.push(address);
        }
      });

      if (addresses.length > 0) {
        // Bestehende Adressen löschen
        await window.supabase
          .from('kampagne_adressen')
          .delete()
          .eq('kampagne_id', kampagneId);

        // Neue Adressen einfügen
        const { error } = await window.supabase
          .from('kampagne_adressen')
          .insert(addresses);

        if (error) {
          console.error('❌ Fehler beim Speichern der Adressen:', error);
        } else {
          console.log(`✅ ${addresses.length} Adressen für Kampagne ${kampagneId} gespeichert`);
        }
      }

    } catch (error) {
      console.error('❌ Fehler beim Verarbeiten der Kampagnen-Adressen:', error);
    }
  }
} 