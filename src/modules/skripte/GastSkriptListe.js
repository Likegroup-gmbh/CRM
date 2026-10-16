// Liste hinter einem Skript-Paket-Zugang. Nr. und Titel, PDF je Zeile
// und eine Sammeldatei ab zwei Skripten.

import { loadGastPaketSkripte } from './skriptPaketApi.js';
import { downloadSkriptePdf, sanitizeSkriptFilename } from './skriptPdfDownload.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function gastListeTitel(name) {
  const text = String(name || '').trim();
  return text || 'Skripte';
}

export async function renderGastSkriptListe(container) {
  const titel = gastListeTitel(window.guestShare?.entityName);
  window.setHeadline?.(titel);
  window.breadcrumbSystem?.updateBreadcrumb([{ label: titel, clickable: false }]);
  container.innerHTML = '<div class="empty-state"><p>Skripte werden geladen …</p></div>';

  let skripte = [];
  try {
    skripte = await loadGastPaketSkripte();
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>${escapeHtml(err.message || 'Skripte konnten nicht geladen werden.')}</p></div>`;
    return;
  }

  if (!skripte.length) {
    container.innerHTML = renderEmptyState({
      icon: 'document',
      title: titel,
      text: 'In diesem Link liegen gerade keine Skripte.'
    });
    return;
  }

  container.innerHTML = `
    <div class="list-container gast-skript-liste">
      <div class="table-filter-wrapper">
        <div class="filter-bar"><div class="filter-left"><h2 class="table-section-title">${escapeHtml(titel)}</h2></div></div>
        <div class="table-actions">
          ${skripte.length >= 2 ? '<button type="button" id="gast-pdf-alle" class="mdc-btn mdc-btn--secondary">Alle als PDF</button>' : ''}
        </div>
      </div>
      <div class="table-container">
        <table class="data-table gast-skript-tabelle">
          <thead><tr><th class="gast-col-nr">Nr.</th><th class="gast-col-titel">Titel</th><th class="gast-col-pdf">PDF</th></tr></thead>
          <tbody>
            ${skripte.map((s) => `
              <tr class="table-row-clickable" data-id="${s.id}">
                <td class="gast-col-nr">${s.skript_nr ?? '–'}</td>
                <td class="gast-col-titel"><a href="#" class="table-link" data-id="${s.id}">${escapeHtml(s.titel || 'Ohne Titel')}</a></td>
                <td class="gast-col-pdf"><button type="button" class="mdc-btn mdc-btn--secondary" data-pdf="${s.id}">PDF</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  const oeffnen = (id) => window.moduleRegistry?.navigateTo(`/skripte/${id}`);
  container.querySelectorAll('tr[data-id], a[data-id]').forEach((row) => {
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
        await downloadSkriptePdf([skript], { dateiname: sanitizeSkriptFilename(skript.titel) });
      } catch (err) {
        window.toastSystem?.error(err.message || 'PDF konnte nicht erstellt werden.');
      }
    });
  });
  container.querySelector('#gast-pdf-alle')?.addEventListener('click', async () => {
    try {
      await downloadSkriptePdf(skripte, { dateiname: sanitizeSkriptFilename(titel) });
    } catch (err) {
      window.toastSystem?.error(err.message || 'PDF konnte nicht erstellt werden.');
    }
  });
}
