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
        <h4>Adresse ${addressId}</h4>
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
