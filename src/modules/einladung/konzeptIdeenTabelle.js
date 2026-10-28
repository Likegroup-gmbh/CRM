// konzeptIdeenTabelle.js
// Creator-Ideen (Konzept-Einreichungen, ADR 0059) als Tabelle: gleiche Klassen wie die übrigen
// Listen (table-container, data-table). Gefüllt aus dem Creator-Sheet im Payload der Einreichung.

import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { einreichungDatum } from './einreichungService.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function kurz(text, max) {
  const flach = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flach.length > max ? `${flach.slice(0, max)}…` : flach;
}

/** Titel der Idee: Arbeitstitel, sonst der Anfang der Idee. */
export function ideeTitel(form) {
  return kurz(form?.arbeitstitel, 80) || kurz(form?.idee, 80) || 'Idee';
}

function renderCreator(einreichung) {
  const einladung = einreichung.einladung || {};
  const name = einreichung.absender_name || '-';
  const bubble = avatarBubbles.renderBubbles([{ name, label: name, type: 'person' }], { showLabel: true });
  const eintrag = einladung.eintrag?.name;
  let hinweis = '';
  if (!einladung.creator_auswahl_item_id) {
    hinweis = '<span class="text-muted">Eintrag nicht mehr im Casting</span>';
  } else if (eintrag && eintrag !== name) {
    hinweis = `<span class="text-muted">${esc(eintrag)}</span>`;
  }
  return `${bubble}${hinweis ? `<div class="ideen-tabelle__hinweis">${hinweis}</div>` : ''}`;
}

function renderZeile(einreichung, { zeigeLinie }) {
  const form = einreichung.payload?.formData || {};
  const einladung = einreichung.einladung || {};
  const linie = zeigeLinie && einladung.briefing_id ? einladung.briefing?.aktivierung_name || '' : '';

  return `
    <tr data-einreichung-id="${esc(einreichung.id)}">
      <td class="col-name">
        <a href="#" class="table-link" data-einreichung-pruefen>${esc(ideeTitel(form))}</a>
      </td>
      <td class="col-ideen-text"><div class="ideen-tabelle__text">${esc(form.idee) || '-'}</div></td>
      <td class="col-ideen-text"><div class="ideen-tabelle__text">${esc(form.hook) || '-'}</div></td>
      <td>${renderCreator(einreichung)}</td>
      ${zeigeLinie ? `<td>${linie ? esc(linie) : '-'}</td>` : ''}
      <td>${esc(einreichungDatum(einreichung))}</td>
      <td class="col-actions">
        <div class="einreichung-inbox__aktionen">
          <button type="button" class="mdc-btn" data-einreichung-pruefen>Prüfen</button>
          <button type="button" class="mdc-btn mdc-btn--secondary" data-einreichung-verwerfen>Verwerfen</button>
        </div>
      </td>
    </tr>`;
}

/**
 * Tabelle der offenen Creator-Ideen. `zeigeLinie`: Spalte „Linie“ nur dort, wo nicht schon
 * die Linie selbst gewählt ist („Alle Linien“).
 */
export function renderKonzeptIdeenTabelle(offen, { zeigeLinie = false } = {}) {
  return `
    <div class="table-container">
      <table class="data-table ideen-tabelle">
        <thead>
          <tr>
            <th class="col-name">Titel</th>
            <th>Idee</th>
            <th>Hook</th>
            <th>Creator</th>
            ${zeigeLinie ? '<th>Linie</th>' : ''}
            <th>Eingereicht</th>
            <th class="col-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${offen.map((e) => renderZeile(e, { zeigeLinie })).join('')}
        </tbody>
      </table>
    </div>`;
}
