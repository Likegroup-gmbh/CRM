// ProduktTabRenderer.js
// Produkte-Tab: Tabelle und Empty State. Wird von der Marke- und von der
// Unternehmen-Detailseite genutzt - im Unternehmens-Kontext kommt eine Spalte
// mit den zugeordneten Marken dazu. Anlegen und Bearbeiten passieren auf einer
// eigenen Seite, siehe ProduktForm.js.

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { ProduktService } from './ProduktService.js';
import { renderTableIdentity } from '../../core/format/tableIdentity.js';
import { renderTabellenTag, renderMarkenBubbles } from '../../core/ui/tabellenZellen.js';

const CREATE_BTN_HTML = '<button type="button" class="mdc-btn mdc-btn--create produkt-create-btn">Produkt anlegen</button>';

/** Ohne markeId sind wir auf der Unternehmensseite und zeigen die Marken-Spalte. */
function zeigtMarkenSpalte(detail) {
  return !detail.markeId;
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
      <td class="col-name">
        ${renderTableIdentity({
          url: ProduktService.publicUrl(ProduktService.hauptbild(produkt)?.storage_pfad),
          name: produkt.name,
          nameHtml: `<a href="#" class="table-link produkt-row-open" data-produkt-id="${produkt.id}">${detail.sanitize(produkt.name)}</a>`
        })}
      </td>
      ${mitMarken ? `<td>${renderMarkenBubbles(produkt.marken)}</td>` : ''}
      <td>${renderTabellenTag(ProduktService.preisLabel(produkt), (t) => detail.sanitize(t))}</td>
      <td>${variantenAnzahl > 0 ? variantenAnzahl : '-'}</td>
      <td>${renderTabellenTag(detail.formatDate(produkt.created_at), (t) => detail.sanitize(t))}</td>
      <td class="col-actions">${actionBuilder.create('produkt', produkt.id)}</td>
    </tr>
  `;
  }).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-name">Produkt</th>
            ${mitMarken ? '<th>Marken</th>' : ''}
            <th>Preis</th>
            <th>Varianten</th>
            <th>Erstellt</th>
            <th class="col-actions">Aktionen</th>
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
