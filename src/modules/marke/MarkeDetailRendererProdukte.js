// MarkeDetailRendererProdukte.js
// Produkte-Tab der Marke: Tabelle und Empty State. Anlegen und Bearbeiten
// passieren auf einer eigenen Seite, siehe MarkeProduktForm.js.

import { renderEmptyState, renderSectionHeader } from '../../core/components/EmptyState.js';
import { MarkeProduktService } from './services/MarkeProduktService.js';

const CREATE_BTN_HTML = '<button type="button" class="mdc-btn mdc-btn--create produkt-create-btn">Produkt anlegen</button>';

function renderThumb(detail, produkt) {
  const bild = MarkeProduktService.hauptbild(produkt);
  const url = bild ? MarkeProduktService.publicUrl(bild.storage_pfad) : null;
  if (!url) return '<span class="produkt-thumb produkt-thumb--empty" aria-hidden="true"></span>';
  return `<img class="produkt-thumb" src="${detail.sanitize(url)}" alt="" loading="lazy">`;
}

export function renderProdukte(detail) {
  const isKunde = window.isKunde?.();
  const produkte = detail.produkte || [];

  if (produkte.length === 0) {
    return renderEmptyState({
      icon: 'cube',
      title: 'Keine Produkte vorhanden',
      text: 'Produkte werden dauerhaft angelegt und bilden gemeinsam mit Marke, Persona und Briefing die Datenbasis für Strategie, Content und Creator Matching.',
      actionsHtml: isKunde ? '' : CREATE_BTN_HTML
    });
  }

  const rows = produkte.map(produkt => {
    const variantenAnzahl = (produkt.varianten || []).length;
    return `
    <tr>
      <td class="produkt-thumb-cell">${renderThumb(detail, produkt)}</td>
      <td>
        <a href="#" class="table-link produkt-row-open" data-produkt-id="${produkt.id}">
          ${detail.sanitize(produkt.name)}
        </a>
      </td>
      <td>${detail.sanitize(MarkeProduktService.preisLabel(produkt))}</td>
      <td>${variantenAnzahl > 0 ? variantenAnzahl : '-'}</td>
      <td>${detail.formatDate(produkt.created_at)}</td>
      <td>
        <button type="button" class="secondary-btn btn-sm produkt-row-open" data-produkt-id="${produkt.id}">Öffnen</button>
      </td>
    </tr>
  `;
  }).join('');

  return `
    ${renderSectionHeader({ title: 'Produkte', actionsHtml: isKunde ? '' : CREATE_BTN_HTML })}
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Bild</th>
            <th>Produkt</th>
            <th>Preis</th>
            <th>Varianten</th>
            <th>Erstellt</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

export function updateProdukteTab(detail) {
  const pane = document.getElementById('tab-produkte');
  if (!pane) return;
  pane.innerHTML = renderProdukte(detail);
}
