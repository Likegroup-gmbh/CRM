// ProduktFormActions.js
// Zusatz-Buttons in der Fussleiste der Produktseite (Bearbeiten-Modus):
// "Löschen" dockt links an, "Als PDF" sitzt vor Abbrechen/Aktualisieren.
// ProduktForm uebergibt nur Callbacks; was im PDF steht, liegt in
// ProduktPdfSnapshot (Daten), ProduktPdfModel (Inhalt) und ProduktPdf (Zeichnen).

import { icon } from '../../core/icons/IconSystem.js';
import { downloadBlob } from '../../core/downloadBlob.js';
import { collectProduktPdfSnapshot } from './ProduktPdfSnapshot.js';

function buttonHtml(iconName, label) {
  return `
    <span class="mdc-btn__icon" aria-hidden="true">${icon(iconName)}</span>
    <span class="mdc-btn__label">${label}</span>
  `;
}

function makeButton(className, iconName, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.innerHTML = buttonHtml(iconName, label);
  return btn;
}

/**
 * Stand der Seite als PDF herunterladen.
 * @param {HTMLFormElement} form
 * @param {() => Object} getPdfSource - { varianten, useCases, uploader, unternehmenId, markeIds }
 */
export async function downloadProduktPdf(form, getPdfSource) {
  const snapshot = await collectProduktPdfSnapshot({
    ...getPdfSource(),
    data: window.formSystem.collectSubmitData(form),
  });
  // jsPDF-Pfad erst beim Klick laden - die Seite braucht ihn sonst nie.
  const [{ buildProduktPdfModel }, { createProduktPdf }] = await Promise.all([
    import('./ProduktPdfModel.js'),
    import('./ProduktPdf.js'),
  ]);
  const { blob, dateiname } = await createProduktPdf(buildProduktPdfModel(snapshot));
  downloadBlob(blob, dateiname);
}

function bindPdfButton(btn, form, getPdfSource, opts) {
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    const label = btn.querySelector('.mdc-btn__label');
    label.textContent = 'PDF wird erstellt…';
    try {
      await downloadProduktPdf(form, getPdfSource);
    } catch (err) {
      console.error('Produkt-PDF fehlgeschlagen:', err);
      window.toastSystem?.error?.('PDF konnte nicht erstellt werden');
    } finally {
      btn.disabled = false;
      label.textContent = 'Als PDF';
    }
  }, opts);
}

/**
 * @param {HTMLFormElement} form
 * @param {Object} hooks
 * @param {() => void} hooks.onDelete
 * @param {() => Object} hooks.getPdfSource
 * @param {AbortSignal} [hooks.signal]
 */
export function injectFormActions(form, { onDelete, getPdfSource, signal }) {
  const actions = form.querySelector('.form-actions');
  if (!actions) return;
  const opts = signal ? { signal } : undefined;

  if (!actions.querySelector('.produkt-delete-btn')) {
    const del = makeButton('mdc-btn mdc-btn--delete produkt-delete-btn', 'trash-alt', 'Löschen');
    del.addEventListener('click', onDelete, opts);
    actions.insertBefore(del, actions.firstChild);
  }

  // Das PDF enthaelt Claims und rechtliche Hinweise - nur intern.
  if (window.isInternal?.() && !actions.querySelector('.produkt-pdf-btn')) {
    const pdf = makeButton('mdc-btn mdc-btn--secondary produkt-pdf-btn', 'pdf', 'Als PDF');
    pdf.title = 'Produktblatt als PDF herunterladen';
    bindPdfButton(pdf, form, getPdfSource, opts);
    actions.insertBefore(pdf, actions.querySelector('.mdc-btn--cancel') || null);
  }
}
