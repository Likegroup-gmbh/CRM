import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../modules/creator-auswahl/CreatorAuswahlService.js', () => ({
  creatorAuswahlService: {
    createItem: vi.fn(async (item) => ({ id: 'item-1', ...item })),
    createListe: vi.fn()
  }
}));

import { creatorAuswahlService } from '../modules/creator-auswahl/CreatorAuswahlService.js';
import { letzteKampagne, merkeKampagne, openCastingPicker } from '../modules/creator/creatorCasting.js';

function fakeSupabase() {
  return {
    from: (table) => {
      const rows = {
        creator_auswahl: [{ id: 'liste-k1' }],
        creator_auswahl_items: [],
        kampagne: [{ id: 'k1', kampagnenname: 'Sommer' }, { id: 'k2', kampagnenname: 'Winter' }]
      }[table] || [];
      const q = {
        select: () => q,
        eq: () => q,
        ilike: () => q,
        order: () => q,
        limit: async () => ({ data: rows, error: null }),
        range: async () => ({ data: rows, error: null })
      };
      return q;
    }
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Ins Casting: zuletzt gewählte Kampagne', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.supabase = fakeSupabase();
    window.toastSystem = { show: vi.fn() };
    creatorAuswahlService.createItem.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.supabase;
    delete window.toastSystem;
  });

  it('merkt sich die Kampagne für die Sitzung', () => {
    expect(letzteKampagne()).toBeNull();
    merkeKampagne('k1', 'Sommer');
    expect(letzteKampagne()).toEqual({ id: 'k1', name: 'Sommer' });
  });

  it('ohne gemerkte Kampagne nur die Suche', async () => {
    await openCastingPicker({ id: 'c1', vorname: 'Anna' });
    await flush();
    expect(document.querySelector('[data-action="casting-letzte"]')).toBeNull();
  });

  it('nach dem ersten Hinzufügen steht die Kampagne beim nächsten Creator bereit', async () => {
    await openCastingPicker({ id: 'c1', vorname: 'Anna' });
    await flush();
    document.querySelector('[data-kampagne="k1"]').click();
    await vi.waitFor(() => expect(creatorAuswahlService.createItem).toHaveBeenCalledTimes(1));
    expect(letzteKampagne()).toEqual({ id: 'k1', name: 'Sommer' });

    await openCastingPicker({ id: 'c2', vorname: 'Ben' });
    await flush();
    const button = document.querySelector('[data-action="casting-letzte"]');
    expect(button.textContent).toBe('Zu „Sommer“ hinzufügen');
    expect(document.querySelector('[data-kampagne="k1"]').classList.contains('selected')).toBe(true);

    button.click();
    await vi.waitFor(() => expect(creatorAuswahlService.createItem).toHaveBeenCalledTimes(2));
    expect(creatorAuswahlService.createItem.mock.calls[1][0]).toMatchObject({ creator_auswahl_id: 'liste-k1', creator_id: 'c2' });
  });

  it('eine andere Kampagne ersetzt die gemerkte', async () => {
    merkeKampagne('k1', 'Sommer');
    await openCastingPicker({ id: 'c3', vorname: 'Cem' });
    await flush();
    document.querySelector('[data-kampagne="k2"]').click();
    await vi.waitFor(() => expect(letzteKampagne()).toEqual({ id: 'k2', name: 'Winter' }));
  });
});
