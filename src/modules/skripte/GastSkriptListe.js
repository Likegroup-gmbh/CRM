// Liste hinter einem Skript-Paket-Zugang. Nr. und Titel, PDF je Zeile
// und eine Sammeldatei ab zwei Skripten.

import { skripteService } from './SkripteService.js';
import { downloadSkriptPdf, downloadSkriptPaketPdf } from './skriptPdf.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderGastSkriptListe(container) {
  const kampagneName = window.guestShare?.entityName || 'Kampagne';
  window.setHeadline?.(kampagneName);
  window.breadcrumbSystem?.updateBreadcrumb([{ label: kampagneName, clickable: false }]);
  container.innerHTML = '<div class="empty-state"><p>Skripte werden geladen …</p></div>';

  let skripte = [];
  try {
    skripte = await skripteService.loadGastPaketSkripte();
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>${escapeHtml(err.message || 'Skripte konnten nicht geladen werden.')}</p></div>`;
    return;
  }

  if (!skripte.length) {
    container.innerHTML = renderEmptyState({
      icon: 'skripte',
      title: kampagneName,
      text: 'In diesem Link liegen gerade keine Skripte.'
    });
    return;
  }

  container.innerHTML = `
    <div class="list-container">
      <div class="table-filter-wrapper">
        <div class="filter-bar"><div class="filter-left"><h2 class="table-section-title">${escapeHtml(kampagneName)}</h2></div></div>
        <div class="table-actions">
          ${skripte.length >= 2 ? '<button type="button" id="gast-pdf-alle" class="mdc-btn mdc-btn--secondary">Alle als PDF</button>' : ''}
        </div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Nr.</th><th class="col-name">Titel</th><th class="col-actions">PDF</th></tr></thead>
          <tbody>
            ${skripte.map((s) => `
              <tr class="table-row-clickable" data-id="${s.id}">
                <td>${s.nr}</td>
                <td class="col-name"><a href="#" class="table-link" data-id="${s.id}">${escapeHtml(s.titel || 'Ohne Titel')}</a></td>
                <td class="col-actions"><button type="button" class="mdc-btn mdc-btn--secondary" data-pdf="${s.id}">PDF</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  const oeffnen = (id) => window.moduleRegistry?.navigateTo(`/skripte/${id}`);
  container.querySelectorAll('[data-id]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-pdf]')) return;
      e.preventDefault();
      oeffnen(row.dataset.id);
    });
  });
  container.querySelectorAll('[data-pdf]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const skript = skripte.find((s) => s.id === btn.dataset.pdf);
      if (!skript) return;
      try {
        await downloadSkriptPdf(skript, { nr: skript.nr });
      } catch (err) {
        window.toastSystem?.error(err.message || 'PDF konnte nicht erstellt werden.');
      }
    });
  });
  container.querySelector('#gast-pdf-alle')?.addEventListener('click', async () => {
    try {
      await downloadSkriptPaketPdf(skripte, kampagneName);
    } catch (err) {
      window.toastSystem?.error(err.message || 'PDF konnte nicht erstellt werden.');
    }
  });
}
