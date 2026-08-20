// ProduktTabRenderer.js
// Produkte-Tab: Tabelle und Empty State. Wird von der Marke- und von der
// Unternehmen-Detailseite genutzt - im Unternehmens-Kontext kommt eine Spalte
// mit den zugeordneten Marken dazu. Anlegen und Bearbeiten passieren auf einer
// eigenen Seite, siehe ProduktForm.js.

import { renderEmptyState, renderSectionHeader } from '../../core/components/EmptyState.js';
import { ProduktService } from './ProduktService.js';

const CREATE_BTN_HTML = '<button type="button" class="mdc-btn mdc-btn--create produkt-create-btn">Produkt anlegen</button>';

/** Ohne markeId sind wir auf der Unternehmensseite und zeigen die Marken-Spalte. */
function zeigtMarkenSpalte(detail) {
  return !detail.markeId;
}

function renderThumb(detail, produkt) {
  const bild = ProduktService.hauptbild(produkt);
  const url = bild ? ProduktService.publicUrl(bild.storage_pfad) : null;
  if (!url) return '-';
  return `<img src="${detail.sanitize(url)}" class="table-logo" width="24" height="24" alt="" loading="lazy">`;
}

function renderMarkenZellen(detail, produkt) {
  const namen = ProduktService.markenNamen(produkt);
  if (!namen.length) return '<span class="text-muted">Nur Unternehmen</span>';
  return namen.map(name => `<span class="status-badge">${detail.sanitize(name)}</span>`).join(' ');
}

export function renderProdukte(detail) {
  const isKunde = window.isKunde?.();
  const produkte = detail.produkte || [];
  const mitMarken = zeigtMarkenSpalte(detail);

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
      <td>${renderThumb(detail, produkt)}</td>
      <td>
        <a href="#" class="table-link produkt-row-open" data-produkt-id="${produkt.id}">
          ${detail.sanitize(produkt.name)}
        </a>
      </td>
      ${mitMarken ? `<td>${renderMarkenZellen(detail, produkt)}</td>` : ''}
      <td>${detail.sanitize(ProduktService.preisLabel(produkt))}</td>
      <td>${variantenAnzahl > 0 ? variantenAnzahl : '-'}</td>
      <td>${detail.formatDate(produkt.created_at)}</td>
      <td>
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm produkt-row-open" data-produkt-id="${produkt.id}">Öffnen</button>
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
            ${mitMarken ? '<th>Marken</th>' : ''}
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
