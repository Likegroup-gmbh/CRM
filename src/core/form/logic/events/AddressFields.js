export function setupAddressesFields(form) {
  const addressesContainers = form.querySelectorAll('.addresses-container');
  
  addressesContainers.forEach(container => {
    const addBtn = container.querySelector('.add-address-btn');
    const addressesList = container.querySelector('.addresses-list');
    
    if (addBtn && addressesList) {
      addBtn.addEventListener('click', () => {
        addAddressRow(addressesList);
      });
    }
  });
}

export function addAddressRow(addressesList) {
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
