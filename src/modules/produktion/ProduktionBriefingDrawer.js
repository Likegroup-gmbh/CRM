// ProduktionBriefingDrawer.js
// Auf der Kampagne: Titel und Produkt, dann Briefing-Anlage. Die speichert die Produktion.

import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { loadProdukteForBriefing } from '../briefing/BriefingProdukte.js';

function esc(value) {
  return window.validatorSystem?.sanitizeHtml(String(value ?? '')) || '';
}

export async function openProduktionBriefingDrawer(detail, { produktionId = null } = {}) {
  const k = detail.kampagneData || {};
  const produkte = await loadProdukteForBriefing(k.unternehmen_id, k.marke_id);
  const defaultTitel = detail.lineTitle || KampagneUtils.getDisplayName(k) || '';
  const selectedProdukt = detail.produktion?.produkt_id || '';
  const options = produkte.map(p => {
    const selected = p.id === selectedProdukt ? ' selected' : '';
    return `<option value="${esc(p.id)}"${selected}>${esc(p.name)}</option>`;
  }).join('');

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
        <div class="form-field">
          <label for="produktion-briefing-produkt">Produkt</label>
          <select id="produktion-briefing-produkt" name="produkt" class="form-input" required>
            <option value="">Produkt wählen…</option>
            ${options}
          </select>
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
    const produkt = modal.querySelector('[name="produkt"]').value;
    if (!titel || !produkt) {
      window.toastSystem?.show('Titel und Produkt sind Pflicht.', 'warning');
      return;
    }
    const params = new URLSearchParams({
      unternehmen: k.unternehmen_id || '',
      marke: k.marke_id || '',
      kampagne: detail.kampagneId || '',
      produkt,
      titel
    });
    if (produktionId) params.set('produktion', produktionId);
    close();
    window.navigateTo(`/briefing/new?${params.toString()}`);
  };
  document.body.appendChild(modal);
}
