// ProduktionBriefingDrawer.js
// Auf der Kampagne: Titel, dann Briefing-Anlage. Das Produkt entsteht danach.

import { KampagneUtils } from '../kampagne/KampagneUtils.js';

function esc(value) {
  return window.validatorSystem?.sanitizeHtml(String(value ?? '')) || '';
}

export async function openProduktionBriefingDrawer(detail, { produktionId = null } = {}) {
  const k = detail.kampagneData || {};
  const defaultTitel = detail.lineTitle || KampagneUtils.getDisplayName(k) || '';

  const modal = document.createElement('div');
  modal.className = 'modal overlay-modal';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Briefing anlegen</h3>
        <button type="button" class="modal-close" data-action="close">×</button>
      </div>
      <form class="modal-body" id="produktion-briefing-form">
        <div class="form-field">
          <label for="produktion-briefing-titel">Titel</label>
          <input id="produktion-briefing-titel" name="titel" class="form-input" value="${esc(defaultTitel)}" required>
        </div>
      </form>
      <div class="modal-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-action="cancel">Abbrechen</button>
        <button type="button" class="mdc-btn" data-action="confirm">Weiter zum Briefing</button>
      </div>
    </div>`;

  const close = () => modal.remove();
  modal.querySelector('[data-action="close"]').onclick = close;
  modal.querySelector('[data-action="cancel"]').onclick = close;
  modal.querySelector('[data-action="confirm"]').onclick = () => {
    const titel = modal.querySelector('[name="titel"]').value.trim();
    if (!titel) {
      window.toastSystem?.show('Titel ist Pflicht.', 'warning');
      return;
    }
    const params = new URLSearchParams({
      unternehmen: k.unternehmen_id || '',
      marke: k.marke_id || '',
      kampagne: detail.kampagneId || '',
      titel
    });
    if (produktionId) params.set('produktion', produktionId);
    if (detail.produktion?.produkt_id) params.set('produkt', detail.produktion.produkt_id);
    close();
    window.navigateTo(`/briefing/new?${params.toString()}`);
  };
  document.body.appendChild(modal);
}
