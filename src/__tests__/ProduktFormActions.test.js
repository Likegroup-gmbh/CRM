import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../core/downloadBlob.js', () => ({ downloadBlob: vi.fn() }));
vi.mock('../modules/produkt/ProduktPdf.js', () => ({
  createProduktPdf: vi.fn(async (model) => ({ blob: new Blob(['%PDF']), dateiname: model.dateiname })),
}));

import { injectFormActions } from '../modules/produkt/ProduktFormActions.js';
import { downloadBlob } from '../core/downloadBlob.js';
import { createProduktPdf } from '../modules/produkt/ProduktPdf.js';

function mountForm() {
  document.body.innerHTML = `
    <form id="produkt-form">
      <div class="form-actions">
        <button type="button" class="mdc-btn mdc-btn--cancel">Abbrechen</button>
        <button type="submit" class="mdc-btn mdc-btn--create">Aktualisieren</button>
      </div>
    </form>`;
  return document.getElementById('produkt-form');
}

const getPdfSource = () => ({
  varianten: [],
  useCases: [],
  uploader: null,
  unternehmenId: null,
  markeIds: [],
});

describe('injectFormActions', () => {
  beforeEach(() => {
    window.isInternal = () => true;
    window.formSystem = { collectSubmitData: () => ({ name: 'Clear Case', unternehmen_id: '' }) };
    window.toastSystem = { error: vi.fn() };
    vi.mocked(downloadBlob).mockClear();
    vi.mocked(createProduktPdf).mockClear();
  });

  it('legt Loeschen vorn und Als PDF vor Abbrechen', () => {
    const form = mountForm();
    injectFormActions(form, { onDelete: vi.fn(), getPdfSource });
    const labels = [...form.querySelectorAll('.form-actions button')]
      .map(b => b.textContent.replace(/\s+/g, ' ').trim());
    expect(labels).toEqual(['Löschen', 'Als PDF', 'Abbrechen', 'Aktualisieren']);
  });

  it('legt Buttons nicht doppelt an', () => {
    const form = mountForm();
    injectFormActions(form, { onDelete: vi.fn(), getPdfSource });
    injectFormActions(form, { onDelete: vi.fn(), getPdfSource });
    expect(form.querySelectorAll('.produkt-delete-btn')).toHaveLength(1);
    expect(form.querySelectorAll('.produkt-pdf-btn')).toHaveLength(1);
  });

  it('zeigt Als PDF nicht fuer externe Nutzer', () => {
    window.isInternal = () => false;
    const form = mountForm();
    injectFormActions(form, { onDelete: vi.fn(), getPdfSource });
    expect(form.querySelector('.produkt-pdf-btn')).toBeNull();
    expect(form.querySelector('.produkt-delete-btn')).not.toBeNull();
  });

  it('erstellt das PDF aus dem Live-Stand und laedt es herunter', async () => {
    const form = mountForm();
    injectFormActions(form, { onDelete: vi.fn(), getPdfSource });
    const btn = form.querySelector('.produkt-pdf-btn');

    btn.click();
    await vi.waitFor(() => expect(downloadBlob).toHaveBeenCalled());

    expect(createProduktPdf.mock.calls[0][0].title).toBe('Clear Case');
    expect(downloadBlob.mock.calls[0][1]).toBe('Clear Case.pdf');
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain('Als PDF');
  });

  it('meldet einen Fehler und gibt den Button wieder frei', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(createProduktPdf).mockRejectedValueOnce(new Error('kaputt'));
    const form = mountForm();
    injectFormActions(form, { onDelete: vi.fn(), getPdfSource });
    const btn = form.querySelector('.produkt-pdf-btn');

    btn.click();
    await vi.waitFor(() => expect(window.toastSystem.error).toHaveBeenCalled());

    expect(downloadBlob).not.toHaveBeenCalled();
    expect(btn.disabled).toBe(false);
    err.mockRestore();
  });
});
