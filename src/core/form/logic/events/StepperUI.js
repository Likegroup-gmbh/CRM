export function showAvailabilityInfo(inputElement, remaining, total, used, type) {
  hideAvailabilityInfo(inputElement);
  
  const infoDiv = document.createElement('div');
  infoDiv.className = 'availability-info';
  infoDiv.innerHTML = `
    <div class="availability-text">
      <span class="available">${remaining} ${type} verfügbar</span>
      <span class="total">von ${total} geplant (${used} bereits verplant)</span>
    </div>
    ${remaining === 0 ? '<div class="availability-warning">Keine weiteren verfügbar</div>' : ''}
  `;
  
  inputElement.parentNode.insertBefore(infoDiv, inputElement.nextSibling);
}

export function hideAvailabilityInfo(inputElement) {
  const existingInfo = inputElement.parentNode.querySelector('.availability-info');
  if (existingInfo) {
    existingInfo.remove();
  }
}

export function createStepperUI(inputElement, singularLabel, pluralLabel) {
  try { inputElement.type = 'hidden'; } catch (_) { inputElement.style.display = 'none'; }
  
  const container = document.createElement('div');
  container.className = 'number-stepper';

  const minusBtn = document.createElement('button');
  minusBtn.type = 'button';
  minusBtn.className = 'stepper-btn stepper-minus secondary-btn';
  minusBtn.textContent = '-';

  const plusBtn = document.createElement('button');
  plusBtn.type = 'button';
  plusBtn.className = 'stepper-btn stepper-plus secondary-btn';
  plusBtn.textContent = '+';

  const info = document.createElement('span');
  info.className = 'stepper-info';

  inputElement.parentNode.insertBefore(container, inputElement.nextSibling);
  container.appendChild(minusBtn);
  container.appendChild(plusBtn);
  container.appendChild(info);

  const getBounds = () => ({
    min: parseInt(inputElement.min || '0', 10) || 0,
    max: parseInt(inputElement.max || '0', 10) || 0
  });

  const clamp = (value) => {
    const n = parseInt(value, 10);
    if (isNaN(n)) return '';
    const { min, max } = getBounds();
    if (max === 0) return '';
    return String(Math.max(min, Math.min(n, max)));
  };

  const updateInfo = () => {
    const { max } = getBounds();
    const selected = parseInt(inputElement.value || '0', 10) || 0;
    const remainingAfter = Math.max(0, max - selected);
    const label = selected === 1 ? singularLabel : pluralLabel;
    
    info.textContent = max > 0 ? `${selected} ${label} | Rest: ${remainingAfter}` : `Bitte zuerst Auftrag wählen`;
    
    minusBtn.disabled = max === 0 || selected <= getBounds().min;
    plusBtn.disabled = max === 0 || selected >= max;
  };

  minusBtn.addEventListener('click', () => {
    const { min } = getBounds();
    const cur = parseInt(inputElement.value || '0', 10) || 0;
    const next = Math.max(min, cur - 1);
    inputElement.value = clamp(String(next));
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    updateInfo();
  });

  plusBtn.addEventListener('click', () => {
    const { max } = getBounds();
    const cur = parseInt(inputElement.value || '0', 10) || 0;
    const next = Math.min(max, cur + 1);
    inputElement.value = clamp(String(next));
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    updateInfo();
  });

  inputElement.addEventListener('input', () => {
    inputElement.value = clamp(inputElement.value);
    updateInfo();
  });

  updateInfo();
}

export function bindStepperEvents(container) {
  if (!container) return;
  
  const stepperButtons = container.querySelectorAll('.stepper-btn');
  
  stepperButtons.forEach(btn => {
    if (btn.dataset.eventsBound) return;
    btn.dataset.eventsBound = 'true';
    
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.dataset.target;
      const input = container.querySelector(`#${targetId}`);
      if (!input) return;
      
      const currentValue = parseInt(input.value || '0', 10) || 0;
      const min = parseInt(input.min || '0', 10) || 0;
      const max = parseInt(input.max || '999', 10) || 999;
      
      let newValue = currentValue;
      
      if (btn.classList.contains('stepper-minus')) {
        newValue = Math.max(min, currentValue - 1);
      } else if (btn.classList.contains('stepper-plus')) {
        newValue = Math.min(max, currentValue + 1);
      }
      
      input.value = newValue;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      const stepperContainer = btn.closest('.number-stepper');
      const infoSpan = stepperContainer?.querySelector('.stepper-info');
      if (infoSpan) {
        const singular = input.dataset.singular || '';
        const plural = input.dataset.plural || '';
        const label = newValue === 1 ? singular : plural;
        infoSpan.textContent = `${newValue} ${label}`;
      }
      
      const minusBtnEl = stepperContainer?.querySelector('.stepper-minus');
      const plusBtnEl = stepperContainer?.querySelector('.stepper-plus');
      if (minusBtnEl) minusBtnEl.disabled = newValue <= min;
      if (plusBtnEl) plusBtnEl.disabled = newValue >= max;
    });
  });
  
  container.querySelectorAll('.number-stepper').forEach(stepper => {
    const input = stepper.querySelector('input[type="hidden"]');
    const minusBtnEl = stepper.querySelector('.stepper-minus');
    if (input && minusBtnEl) {
      const val = parseInt(input.value || '0', 10) || 0;
      const min = parseInt(input.min || '0', 10) || 0;
      minusBtnEl.disabled = val <= min;
    }
  });
}

export function updateStepperUI(inputElement, singularLabel, pluralLabel, form) {
  const stepperInfo = inputElement.parentNode.querySelector('.stepper-info');
  const minusBtn = inputElement.parentNode.querySelector('.stepper-minus');
  const plusBtn = inputElement.parentNode.querySelector('.stepper-plus');
  
  if (!stepperInfo || !minusBtn || !plusBtn) return;
  
  const max = parseInt(inputElement.max || '0', 10) || 0;
  const min = parseInt(inputElement.min || '0', 10) || 0;
  const selected = parseInt(inputElement.value || '0', 10) || 0;
  const remainingAfter = Math.max(0, max - selected);
  const label = selected === 1 ? singularLabel : pluralLabel;
  
  const isKampagneEditMode = form?.dataset?.isEditMode === 'true' && form?.dataset?.entityType === 'kampagne';
  if (isKampagneEditMode && max === 0) {
    stepperInfo.textContent = `${selected} ${label} | Kein Auftrag zugeordnet`;
  } else {
    stepperInfo.textContent = max > 0 ? `${selected} ${label} | Rest: ${remainingAfter}` : 'Bitte zuerst Auftrag wählen';
  }
  
  minusBtn.disabled = max === 0 || selected <= min;
  plusBtn.disabled = max === 0 || selected >= max;
}
