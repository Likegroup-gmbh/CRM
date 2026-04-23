// KooperationStepperBinder.js
// Bindet den Video-Stepper (+/- Buttons) und synchronisiert Video-Rows
// mit der gewählten videoanzahl. Ohne setTimeout-Kaskaden.

import { addVideoRow } from '../../core/form/logic/events/VideosFields.js';

export function makeRecalcAllPrices(form, videosList) {
  return () => {
    if (!videosList) return;
    let ekSum = 0, vkSum = 0;
    videosList.querySelectorAll('.video-ek-input').forEach(i => { ekSum += parseFloat(i.value) || 0; });
    videosList.querySelectorAll('.video-vk-input').forEach(i => { vkSum += parseFloat(i.value) || 0; });
    const ekField = form.querySelector('input[name="einkaufspreis_netto"]');
    if (ekField) {
      ekField.value = ekSum.toFixed(2);
      ekField.dispatchEvent(new Event('input', { bubbles: true }));
      ekField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const vkField = form.querySelector('input[name="verkaufspreis_netto"]');
    if (vkField) {
      vkField.value = vkSum.toFixed(2);
      vkField.dispatchEvent(new Event('input', { bubbles: true }));
      vkField.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
}

export function attachVideoStepper(form, { videoInput, videosList, contentArtOptions, kampagnenartenOptions, recalcAllPrices }) {
  if (!videoInput || videoInput.dataset.stepperAttached === 'true') return;
  try { videoInput.type = 'hidden'; } catch (_) { videoInput.style.display = 'none'; }

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
  videoInput.parentNode.insertBefore(container, videoInput.nextSibling);
  container.append(minusBtn, plusBtn, info);

  const getBounds = () => ({
    min: parseInt(videoInput.min || '0', 10) || 0,
    max: parseInt(videoInput.max || '0', 10) || 0
  });

  const updateInfo = () => {
    const { max, min } = getBounds();
    const selected = parseInt(videoInput.value || '0', 10) || 0;
    const remainingAfter = Math.max(0, max - selected);
    const sSel = selected === 1 ? 'Video' : 'Videos';
    info.textContent = max > 0 ? `${selected} ${sSel} | Rest: ${remainingAfter}` : 'Keine Videos verfügbar';
    minusBtn.disabled = max === 0 || selected <= min;
    plusBtn.disabled = max === 0 || selected >= max;
  };

  const syncVideosToCount = () => {
    if (!videosList) return;
    const desired = parseInt(videoInput.value || '0', 10) || 0;
    const current = videosList.querySelectorAll('.video-item').length;
    if (desired > current) {
      for (let i = 0; i < (desired - current); i++) {
        addVideoRow(videosList, contentArtOptions, {}, kampagnenartenOptions, recalcAllPrices);
      }
    } else if (desired < current) {
      for (let i = 0; i < (current - desired); i++) {
        const last = videosList.querySelector('.video-item:last-of-type');
        if (last) last.remove();
      }
      recalcAllPrices();
    }
  };

  const clamp = (v) => {
    const { min, max } = getBounds();
    const n = parseInt(v || '0', 10) || 0;
    if (!max) return '';
    return String(Math.max(min, Math.min(n, max)));
  };

  minusBtn.addEventListener('click', () => {
    const cur = parseInt(videoInput.value || '0', 10) || 0;
    videoInput.value = clamp(String(cur - 1));
    videoInput.dispatchEvent(new Event('change', { bubbles: true }));
    updateInfo();
    syncVideosToCount();
  });
  plusBtn.addEventListener('click', () => {
    const cur = parseInt(videoInput.value || '0', 10) || 0;
    videoInput.value = clamp(String(cur + 1));
    videoInput.dispatchEvent(new Event('change', { bubbles: true }));
    updateInfo();
    syncVideosToCount();
  });
  videoInput.addEventListener('input', () => {
    videoInput.value = clamp(videoInput.value);
    updateInfo();
    syncVideosToCount();
  });

  videoInput.dataset.stepperAttached = 'true';
  updateInfo();
}

export function refreshStepperUI(videoInput) {
  if (!videoInput) return;
  const stepperInfo = videoInput.parentNode.querySelector('.stepper-info');
  const minusBtn = videoInput.parentNode.querySelector('.stepper-minus');
  const plusBtn = videoInput.parentNode.querySelector('.stepper-plus');
  const max = parseInt(videoInput.max || '0', 10) || 0;
  const min = parseInt(videoInput.min || '0', 10) || 0;
  const selected = parseInt(videoInput.value || '0', 10) || 0;
  const remainingAfter = Math.max(0, max - selected);
  const sSel = selected === 1 ? 'Video' : 'Videos';
  if (stepperInfo) stepperInfo.textContent = max > 0 ? `${selected} ${sSel} | Rest: ${remainingAfter}` : 'Keine Videos verfügbar';
  if (minusBtn) minusBtn.disabled = max === 0 || selected <= min;
  if (plusBtn) plusBtn.disabled = max === 0 || selected >= max;
}
