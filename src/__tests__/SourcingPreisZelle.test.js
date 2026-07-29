import { describe, it, expect } from 'vitest';
import { renderItemRow } from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';

function renderCell(columnClass, item, ctx = {}) {
  const html = renderItemRow({ isKunde: false, hiddenColumns: [], ...ctx }, { id: 'i1', ...item }, 0);
  const doc = new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
  return doc.querySelector(`td.${columnClass}`);
}

describe('Sourcing – Preis-Zellen mit View-Basis', () => {
  it('zeigt Preis und View-Basis zweizeilig', () => {
    const cell = renderCell('cp-col-cpm-ig-8', { cpm_ig_8: 150.73, ig_views_8: 6029 });

    expect(cell.querySelector('.cpm-auto-price').textContent.trim()).toBe('150,73 €');
    expect(cell.querySelector('.cpm-auto-reach').textContent.trim()).toBe('Ø 6,0K Views');
  });

  it('formatiert die View-Basis unter 1.000, ab 1.000 und ab 1 Mio.', () => {
    const reach = (views) => renderCell('cp-col-cpm-ig-30', { cpm_ig_30: 10, ig_views_30: views })
      .querySelector('.cpm-auto-reach').textContent.trim();

    expect(reach(850)).toBe('Ø 850 Views');
    expect(reach(12200)).toBe('Ø 12,2K Views');
    expect(reach(1450000)).toBe('Ø 1,5M Views');
  });

  it('zeigt ohne View-Basis nur einen Strich und keine leere zweite Zeile', () => {
    const cell = renderCell('cp-col-cpm-ig-8', {});

    expect(cell.querySelector('.cpm-auto-price').textContent.trim()).toBe('-');
    expect(cell.querySelector('.cpm-auto-reach')).toBeNull();
  });

  it('zeigt auch fuer Preis Ø die getrimmte View-Basis', () => {
    const cell = renderCell('cp-col-cpm-ig-trimmed', { cpm_ig_trimmed: 99.5, ig_views_trimmed: 3980 });

    expect(cell.querySelector('.cpm-auto-price').textContent.trim()).toBe('99,50 €');
    expect(cell.querySelector('.cpm-auto-reach').textContent.trim()).toBe('Ø 4,0K Views');
    expect(cell.querySelector('.cpm-auto-value').title).toBe('3.980 Views im Schnitt');
  });

  it('laesst die manuelle Reichweiten-Spalte unveraendert', () => {
    const cell = renderCell('cp-col-reichweite-ig', { reichweite_instagram: '10K' });

    expect(cell.querySelector('input[data-field="reichweite_instagram"]').value).toBe('10K');
  });

  it('blurrt im Kunden-Call Preis und View-Basis gemeinsam', () => {
    const cell = renderCell(
      'cp-col-cpm-ig-8',
      { cpm_ig_8: 150.73, ig_views_8: 6029 },
      { kundenCallActive: true }
    );
    const wrapper = cell.querySelector('.cpm-auto-value');

    expect(wrapper.classList.contains('kunden-call-blur')).toBe(true);
    expect(wrapper.querySelector('.cpm-auto-price')).not.toBeNull();
    expect(wrapper.querySelector('.cpm-auto-reach')).not.toBeNull();
  });
});
