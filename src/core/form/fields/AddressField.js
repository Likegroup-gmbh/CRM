import { BaseField } from './BaseField.js';

export class AddressField extends BaseField {
  render() {
    const dependsOn = this.field.dependsOn ? `data-depends-on="${this.field.dependsOn}"` : '';
    const showWhen = this.field.showWhen ? `data-show-when="${this.field.showWhen}"` : '';
    
    return `
      <div class="form-field form-field-full" ${dependsOn} ${showWhen}>
        <label for="${this.fieldId}" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">${this.field.label}</label>
        <div class="addresses-container" id="${this.fieldId}">
          <div class="addresses-list" style="margin-bottom: 16px;">
            <!-- Adressen werden hier dynamisch hinzugefügt -->
          </div>
          <button type="button" class="btn btn-secondary btn-sm add-address-btn" style="
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#6b7280'">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
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
      <div class="address-item" data-address-id="${addressId}" style="
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        background: #f9fafb;
      ">
        <div class="address-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        ">
          <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #374151;">Adresse ${addressId}</h4>
          <button type="button" class="btn-remove-address" onclick="this.closest('.address-item').remove()" style="
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
            Entfernen
          </button>
        </div>
        <div class="address-fields" style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        ">
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Adressname</label>
            <input type="text" name="adressname_${addressId}" placeholder="z.B. Hauptbüro, Filiale, etc." 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Straße</label>
            <input type="text" name="strasse_${addressId}" placeholder="Musterstraße" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Hausnummer</label>
            <input type="text" name="hausnummer_${addressId}" placeholder="123" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">PLZ</label>
            <input type="text" name="plz_${addressId}" placeholder="12345" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Stadt</label>
            <input type="text" name="stadt_${addressId}" placeholder="Musterstadt" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Land</label>
            <input type="text" name="land_${addressId}" placeholder="Deutschland" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Notiz</label>
            <textarea name="notiz_${addressId}" rows="2" placeholder="Zusätzliche Informationen" 
                      style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; resize: vertical;"></textarea>
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