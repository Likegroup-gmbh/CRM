// ProduktionBriefingDrawer.js
// Auf der Produktion: Titel (Basis = Produktionsname, sonst Projektname, + optionaler Zusatz), dann Briefing-Anlage.
// Das Produkt entsteht danach.

import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { briefingBasis, briefingTitel } from './produktionNames.js';

function esc(value) {
  return window.validatorSystem?.sanitizeHtml(String(value ?? '')) || '';
}

export async function openProduktionBriefingDrawer(detail, { produktionId = null } = {}) {
  const k = detail.kampagneData || {};
  const produktionName = detail.produktion?.name || detail.lineTitle || '';
  const basis = briefingBasis(k, produktionName) || KampagneUtils.getDisplayName(k) || '';

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
          <label for="produktion-briefing-basis">Projektname</label>
          <input id="produktion-briefing-basis" name="basis" class="form-input" value="${esc(basis)}" readonly>
        </div>
        <div class="form-field">
          <label for="produktion-briefing-zusatz">Zusatz (optional)</label>
          <input id="produktion-briefing-zusatz" name="zusatz" class="form-input" placeholder="z.B. Serum Launch" autocomplete="off">
          <small class="form-hint" data-vorschau></small>
        </div>
      </form>
      <div class="modal-footer">
        <button type="button" class="mdc-btn mdc-btn--secondary" data-action="cancel">Abbrechen</button>
        <button type="button" class="mdc-btn" data-action="confirm">Weiter zum Briefing</button>
      </div>
    </div>`;

  const zusatzInput = modal.querySelector('[name="zusatz"]');
  const vorschau = modal.querySelector('[data-vorschau]');
  const aktuellerTitel = () => briefingTitel(basis, zusatzInput.value);
  const zeigeVorschau = () => {
    const titel = aktuellerTitel();
    vorschau.textContent = titel ? `Titel: ${titel}` : '';
  };
  zusatzInput.addEventListener('input', zeigeVorschau);
  zeigeVorschau();

  const close = () => modal.remove();
  modal.querySelector('[data-action="close"]').onclick = close;
  modal.querySelector('[data-action="cancel"]').onclick = close;
  modal.querySelector('[data-action="confirm"]').onclick = () => {
    const titel = aktuellerTitel();
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
    close();
    window.navigateTo(`/briefing/new?${params.toString()}`);
  };
  document.body.appendChild(modal);
}
