// Rechter Drawer: Kooperation anlegen aus einer Konzept-Zeile.
// Sichtbar sind Content und Preise. Zuordnung kommt versteckt mit.

import { restoreKontextFelder } from './produktionStart.js';

const DRAWER_ID = 'produktion-start-drawer';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function closeProduktionStartDrawer() {
  const overlay = document.getElementById(`${DRAWER_ID}-overlay`);
  const panel = document.getElementById(DRAWER_ID);
  if (panel) {
    panel.dataset.closed = 'true';
    panel.classList.remove('show');
    setTimeout(() => {
      overlay?.remove();
      panel?.remove();
    }, 300);
  } else {
    overlay?.remove();
  }
}

export async function openProduktionStartDrawer(kontext) {
  closeProduktionStartDrawer();

  if (!window.formSystem?.renderFormOnly || !window.formSystem?.bindFormEvents) {
    window.toastSystem?.show('Formular ist nicht bereit', 'error');
    return;
  }

  const subtitle = kontext?.creatorName ? `Für ${kontext.creatorName}` : 'Für diesen Creator';

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = `${DRAWER_ID}-overlay`;

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel drawer-panel--xwide';
  panel.id = DRAWER_ID;
  panel.innerHTML = `
    <div class="drawer-header">
      <div>
        <span class="drawer-title">Produktion starten</span>
        <p class="drawer-subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
    </div>
    <div class="drawer-body">
      ${window.formSystem.renderFormOnly('kooperation', kontext)}
    </div>
  `;

  overlay.addEventListener('click', () => closeProduktionStartDrawer());
  panel.querySelector('.drawer-close-btn').addEventListener('click', () => closeProduktionStartDrawer());

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  const form = panel.querySelector('#kooperation-form');
  const cancel = form?.querySelector('.mdc-btn--cancel');
  if (cancel) {
    cancel.removeAttribute('onclick');
    cancel.addEventListener('click', (e) => {
      e.preventDefault();
      closeProduktionStartDrawer();
    });
  }

  const submitBtn = form?.querySelector('.mdc-btn--create');
  const label = submitBtn?.querySelector('.mdc-btn__label');
  if (label) label.textContent = 'Anlegen';
  submitBtn?.setAttribute('data-mode', 'create');
  if (submitBtn) submitBtn.disabled = true;

  try {
    await window.formSystem.bindFormEvents('kooperation', kontext);
  } catch (error) {
    console.error('Produktion-starten-Formular:', error);
    window.toastSystem?.show('Formular konnte nicht geladen werden', 'error');
    closeProduktionStartDrawer();
    return;
  }
  if (!form?.isConnected || panel.dataset.closed === 'true') return;
  if (submitBtn) submitBtn.disabled = false;
  requestAnimationFrame(() => {
    if (!panel.isConnected || panel.dataset.closed === 'true') return;
    panel.classList.add('show');
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (submitBtn?.dataset.locked === 'true') return;
    if (submitBtn) submitBtn.dataset.locked = 'true';
    try {
      restoreKontextFelder(form, kontext);
      if (window.formSystem?.autoGeneration?.autoGenerateKooperationsname) {
        await window.formSystem.autoGeneration.autoGenerateKooperationsname(form);
      }
      const result = await window.formSystem.handleFormSubmit('kooperation', null, form);
      if (result?.success) closeProduktionStartDrawer();
    } finally {
      if (submitBtn?.isConnected) submitBtn.dataset.locked = 'false';
    }
  };
}
