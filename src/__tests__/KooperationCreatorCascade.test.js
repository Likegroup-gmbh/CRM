// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { findStrategy } from '../core/form/logic/CascadeStrategies.js';

// Der Kooperation-Picker lud Creator mit einer Anfrage. PostgREST liefert
// hoechstens 1.000 Zeilen, alphabetisch nach Vorname. Zoe Bohnen steht
// dahinter und fehlte im Select, obwohl sie in der Creator-DB sichtbar ist.
function mockCreatorPages(pages) {
  const total = pages.reduce((sum, page) => sum + page.length, 0);
  return {
    from: vi.fn(() => {
      let fromIdx = 0;
      let ranged = false;
      const query = {
        select: vi.fn(() => query),
        order: vi.fn(() => query),
        eq: vi.fn(() => query),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        range(from) {
          ranged = true;
          fromIdx = from;
          return query;
        },
        then(resolve, reject) {
          const pageIdx = Math.floor(fromIdx / 1000);
          const data = ranged ? (pages[pageIdx] || []) : (pages[0] || []);
          return Promise.resolve({
            data,
            error: null,
            count: ranged ? total : null
          }).then(resolve, reject);
        }
      };
      return query;
    })
  };
}

describe('creator_id:kampagne_id cascade', () => {
  afterEach(() => {
    delete window.supabase;
  });

  it('nimmt Creator hinter der 1000-Zeilen-Grenze in den Picker auf', async () => {
    const page1 = [
      { id: 'schneider', vorname: 'Zoe', nachname: 'Schneider', instagram: null },
      ...Array.from({ length: 999 }, (_, i) => ({
        id: `c-${i}`,
        vorname: 'Aaron',
        nachname: String(i),
        instagram: null
      }))
    ];
    const zoeId = '8e94c941-b43b-460b-9538-22866844b1e2';
    const page2 = [{ id: zoeId, vorname: 'Zoe', nachname: 'Bohnen', instagram: null }];
    window.supabase = mockCreatorPages([page1, page2]);

    const field = document.createElement('select');
    const ctx = { updateDependentFieldOptions: vi.fn() };
    const strategy = findStrategy({ name: 'creator_id', dependsOn: 'kampagne_id' });

    await strategy('kampagne-1', document.createElement('form'), field, { name: 'creator_id' }, ctx);

    const options = ctx.updateDependentFieldOptions.mock.calls[0][2];
    const labels = options.map(option => option.label);
    expect(options.some(option => option.value === zoeId && option.label === 'Zoe Bohnen')).toBe(true);
    expect(labels.indexOf('Zoe Bohnen')).toBeLessThan(labels.indexOf('Zoe Schneider'));
    expect(field.disabled).toBe(false);
  });
});
