import { describe, it, expect, afterEach } from 'vitest';
import { NutzungsrechteModal } from '../modules/kampagne/NutzungsrechteModal.js';

function mockSupabase(result) {
  const selects = [];
  const chain = {
    select(value) {
      selects.push(value);
      return chain;
    },
    eq() { return chain; },
    single: async () => result,
  };
  window.supabase = { from: () => chain };
  return selects;
}

describe('NutzungsrechteModal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.supabase;
  });

  it('laedt die Kooperation ueber die direkte Fremdschluessel-Beziehung', async () => {
    const selects = mockSupabase({
      data: {
        id: 'v1',
        typ: 'UGC',
        nutzungsdauer: 'unbegrenzt',
        nutzungsart: 'paid',
        medien: ['social_media'],
        kooperationen: { nutzungsrechte: 'unbegrenzt' },
      },
      error: null,
    });

    const modal = new NutzungsrechteModal();
    await modal.open('v1');

    expect(selects[0]).toContain('kooperationen!vertraege_kooperation_id_fkey(nutzungsrechte)');
    expect(document.body.textContent).toContain('Unbegrenzt');
    expect(document.body.textContent).toContain('Paid');
    modal._close();
  });

  it('zeigt den Ladefehler, wenn die Abfrage scheitert', async () => {
    mockSupabase({ data: null, error: { code: 'PGRST201' } });

    const modal = new NutzungsrechteModal();
    await modal.open('v1');

    expect(document.body.textContent).toContain('Nutzungsrechte konnten nicht geladen werden.');
    modal._close();
  });
});
