import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderItemRow } from '../modules/creator-auswahl/castingItemRow.js';
import {
  hatKundenPrio,
  hatZusageOderGebucht,
  castingUmsetzungGate,
  castingCreatorBadge,
  CASTING_UMSETZUNG_GATE_ERROR,
  CASTING_CREATOR_PFLICHT_ERROR
} from '../modules/creator-auswahl/sourcingStatusOptions.js';
import { strategieService } from '../modules/strategie/StrategieService.js';

function menu(item, ctx = {}) {
  const html = renderItemRow(
    { isKunde: false, hiddenColumns: [], canCreate: true, canDelete: true, ...ctx },
    { id: 'i1', ...item },
    0
  );
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

describe('castingUmsetzungGate', () => {
  it('braucht Prio und Zusage oder Gebucht', () => {
    expect(hatKundenPrio({ prio_1: true })).toBe(true);
    expect(hatKundenPrio({ prio_2: true })).toBe(true);
    expect(hatKundenPrio({ abgelehnt: true })).toBe(false);
    expect(hatZusageOderGebucht({ gebucht: true })).toBe(true);
    expect(hatZusageOderGebucht({ zusage: true })).toBe(true);

    expect(castingUmsetzungGate({ prio_1: true, zusage: true })).toBe(true);
    expect(castingUmsetzungGate({ prio_2: true, gebucht: true })).toBe(true);
    expect(castingUmsetzungGate({ prio_1: true })).toBe(false);
    expect(castingUmsetzungGate({ zusage: true })).toBe(false);
    expect(castingUmsetzungGate({ gebucht: true })).toBe(false);
  });

  it('ist gruen bei creator_id, rot nur bei offenem Gate ohne Creator', () => {
    expect(castingCreatorBadge({ creator_id: 'c1' })).toBe('green');
    expect(castingCreatorBadge({ creator_id: 'c1', prio_1: false })).toBe('green');
    expect(castingCreatorBadge({ prio_1: true, zusage: true })).toBe('red');
    expect(castingCreatorBadge({ prio_1: true, gebucht: true })).toBe('red');
    expect(castingCreatorBadge({ zusage: true })).toBeNull();
    expect(castingCreatorBadge({})).toBeNull();
  });
});

describe('Casting-Aktionsmenue', () => {
  it('zeigt nur Creator anlegen, wenn das Gate offen und kein Creator da ist', () => {
    const doc = menu({ prio_1: true, zusage: true });
    expect(doc.querySelector('[data-action="create-creator"]')).not.toBeNull();
    expect(doc.querySelector('[data-action="create-videoidee"]')).toBeNull();
    expect(doc.querySelector('[data-action="connect-videoidee"]')).toBeNull();
  });

  it('zeigt Videoidee-Aktionen nach Creator, nicht mehr anlegen', () => {
    const doc = menu({ prio_2: true, gebucht: true, creator_id: 'c1' });
    expect(doc.querySelector('[data-action="create-creator"]')).toBeNull();
    expect(doc.querySelector('[data-action="create-videoidee"]')).not.toBeNull();
    expect(doc.querySelector('[data-action="connect-videoidee"]')).not.toBeNull();
  });

  it('zeigt ohne Prio oder ohne Zusage keine der drei Aktionen', () => {
    const ohnePrio = menu({ zusage: true, gebucht: false, creator_id: 'c1' });
    expect(ohnePrio.querySelector('[data-action="create-creator"]')).toBeNull();
    expect(ohnePrio.querySelector('[data-action="create-videoidee"]')).toBeNull();

    const ohneStatus = menu({ prio_1: true, creator_id: 'c1' });
    expect(ohneStatus.querySelector('[data-action="create-videoidee"]')).toBeNull();
    expect(ohneStatus.querySelector('[data-action="create-creator"]')).toBeNull();
  });
});

describe('StrategieService Casting-Gates', () => {
  afterEach(() => {
    delete window.supabase;
  });

  function fromQueue(byTable) {
    window.supabase = {
      from: vi.fn((table) => {
        const queue = byTable[table];
        const next = Array.isArray(queue) ? queue.shift() : queue;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue(next),
          update: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(next)
        };
      })
    };
  }

  it('laesst getZuordbareCastingItems nur Gate-Eintraege durch, auch ohne creator_id', async () => {
    fromQueue({
      strategie: { data: { id: 's1', creator_auswahl_id: 'cast1' }, error: null },
      creator_auswahl_items: {
        data: [
          { id: 'ok', zusage: true, prio_1: true, creator_id: null },
          { id: 'noprio', zusage: true, prio_1: false, prio_2: false },
          { id: 'gebucht', gebucht: true, prio_2: true, creator_id: 'c1' }
        ],
        error: null
      }
    });

    const result = await strategieService.getZuordbareCastingItems('s1');
    expect(result.items.map(i => i.id)).toEqual(['ok', 'gebucht']);
  });

  it('blockt assignCastingItem ohne Prio', async () => {
    fromQueue({
      strategie_items: { data: { id: 'i1', strategie_id: 's1', creator_auswahl_item_id: null, ist_vorschlag: false }, error: null },
      strategie: { data: { id: 's1', creator_auswahl_id: 'cast1' }, error: null },
      creator_auswahl_items: {
        data: { id: 'e1', creator_auswahl_id: 'cast1', zusage: true, gebucht: false, prio_1: false, prio_2: false, creator_id: 'c1' },
        error: null
      }
    });

    await expect(strategieService.assignCastingItem('i1', 'e1'))
      .rejects.toThrow(CASTING_UMSETZUNG_GATE_ERROR);
  });

  it('blockt assignCastingItem ohne creator_id', async () => {
    fromQueue({
      strategie_items: { data: { id: 'i1', strategie_id: 's1', creator_auswahl_item_id: null, ist_vorschlag: false }, error: null },
      strategie: { data: { id: 's1', creator_auswahl_id: 'cast1' }, error: null },
      creator_auswahl_items: {
        data: { id: 'e1', creator_auswahl_id: 'cast1', zusage: true, prio_1: true, creator_id: null },
        error: null
      }
    });

    await expect(strategieService.assignCastingItem('i1', 'e1'))
      .rejects.toThrow(CASTING_CREATOR_PFLICHT_ERROR);
  });
});
