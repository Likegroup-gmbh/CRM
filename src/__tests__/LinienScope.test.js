import { describe, expect, it } from 'vitest';
import {
  ALLE, effectiveLinie, koopLinie, linieRueckkehr, renderLinienSwitch, resolveLinie, tabHatAlleLinien
} from '../modules/kampagne/linienScope.js';
import { findKooperationForCreator } from '../modules/kooperation/produktionStart.js';
import { getSwitcherConfig, loadSwitcherItems } from '../core/breadcrumbSwitcher.js';

const linien = [{ id: 'b1', name: 'Sommer' }, { id: 'b2', name: 'Winter' }];

describe('resolveLinie', () => {
  it('nimmt ?linie=, sonst die erste', () => {
    expect(resolveLinie(linien, null, '?linie=b2')).toEqual({ linieId: 'b2', alle: false });
    expect(resolveLinie(linien, null, '')).toEqual({ linieId: 'b1', alle: false });
    expect(resolveLinie(linien, null, '?linie=unbekannt')).toEqual({ linieId: 'b1', alle: false });
  });

  it('kennt "alle" und behält eine konkrete Linie als Rückfall', () => {
    expect(resolveLinie(linien, null, `?linie=${ALLE}`)).toEqual({ linieId: 'b1', alle: true });
  });

  it('liefert ohne Linien nichts', () => {
    expect(resolveLinie([], 'p1', '?linie=b1')).toEqual({ linieId: null, alle: false });
  });
});

describe('linieRueckkehr', () => {
  it('setzt Tab und Linie, wenn die Herkunft eine Produktion ist', () => {
    expect(linieRueckkehr('/produktion/p1', 'b9')).toBe('/produktion/p1?tab=briefing&linie=b9');
  });

  it('ersetzt Tab und alte Linie, behält andere Parameter', () => {
    expect(linieRueckkehr('/produktion/p1?tab=casting&linie=b1&x=1', 'b9'))
      .toBe('/produktion/p1?tab=briefing&linie=b9&x=1');
  });

  it('lässt andere Herkünfte unverändert', () => {
    expect(linieRueckkehr('/briefing', 'b9')).toBe('/briefing');
    expect(linieRueckkehr('/briefing/b9', 'b9')).toBe('/briefing/b9');
    expect(linieRueckkehr('/produktion/p1/edit', 'b9')).toBe('/produktion/p1/edit');
  });

  it('lässt die URL ohne Briefing-Id unverändert', () => {
    expect(linieRueckkehr('/produktion/p1', null)).toBe('/produktion/p1');
  });
});

describe('effectiveLinie / koopLinie', () => {
  const detail = { linien, linieId: 'b2', linieAlle: true };

  it('Alle Linien gilt nur in Produktion, Verträgen und Videos', () => {
    expect(tabHatAlleLinien('produktion')).toBe(true);
    expect(tabHatAlleLinien('casting')).toBe(false);
    expect(effectiveLinie(detail, 'produktion')).toBeNull();
    expect(effectiveLinie(detail, 'vertraege')).toBeNull();
    expect(effectiveLinie(detail, 'casting')).toBe('b2');
    expect(effectiveLinie(detail, 'konzepte')).toBe('b2');
  });

  it('Kooperationstabelle folgt dem Alle-Schalter', () => {
    expect(koopLinie(detail)).toBeNull();
    expect(koopLinie({ ...detail, linieAlle: false })).toBe('b2');
  });

  it('ohne Linien gibt es keinen Scope', () => {
    expect(effectiveLinie({ linien: [], linieId: null }, 'casting')).toBeNull();
    expect(koopLinie({ linien: [] })).toBeNull();
  });
});

describe('Kooperation pro Creator und Linie', () => {
  function client(rows) {
    const filters = {};
    const query = {
      select: () => query,
      eq: (col, val) => { filters[col] = val; return query; },
      limit: () => Promise.resolve({
        data: rows.filter(r => Object.entries(filters).every(([c, v]) => r[c] === v)),
        error: null
      })
    };
    return { from: () => query };
  }

  const rows = [{ id: 'k1', produktion_id: 'p1', creator_id: 'c1', briefing_id: 'b1' }];

  it('findet die Kooperation nur in derselben Linie', async () => {
    const args = { produktionId: 'p1', creatorId: 'c1' };
    expect(await findKooperationForCreator(client(rows), { ...args, briefingId: 'b1' })).toEqual(rows[0]);
    expect(await findKooperationForCreator(client(rows), { ...args, briefingId: 'b2' })).toBeNull();
  });
});

describe('Breadcrumb-Switcher Produktion', () => {
  it('ist für Produktionen konfiguriert und liefert nur Geschwister der Kampagne', async () => {
    expect(getSwitcherConfig('produktion')?.table).toBe('produktion');

    const calls = {};
    const query = {
      select: () => query,
      in: (col, ids) => { calls.in = [col, ids]; return query; },
      or: () => query,
      order: (field, opts) => { calls.order = [field, opts]; return query; },
      limit: () => Promise.resolve({ data: [{ id: 'p2', name: 'Serum – Produktion 2' }], error: null })
    };
    window.supabase = { from: () => query };
    window.canViewPage = () => true;
    window.isAdmin = () => true;

    const { items } = await loadSwitcherItems({
      segment: 'produktion',
      context: { segment: 'produktion', id: 'p1', kampagneId: 'k1' }
    });

    expect(calls.in).toEqual(['kampagne_id', ['k1']]);
    expect(calls.order).toEqual(['created_at', { ascending: true }]);
    expect(items).toEqual([{ id: 'p2', label: 'Serum – Produktion 2', route: '/produktion/p2' }]);
  });

  it('bleibt ohne Kampagne leer', async () => {
    window.supabase = { from: () => { throw new Error('nicht abfragen'); } };
    window.canViewPage = () => true;
    const { items } = await loadSwitcherItems({ segment: 'produktion', context: { id: 'p1' } });
    expect(items).toEqual([]);
  });
});

describe('renderLinienSwitch', () => {
  const detail = { linien: [...linien, { id: 'b3', name: 'Herbst', is_draft: true }], linieId: 'b2', linieAlle: false };

  it('zeigt die aktive Linie im Trigger und listet alle Linien', () => {
    window.canCreate = () => false;
    const html = renderLinienSwitch(detail, 'casting');
    expect(html).toContain('data-linien-toggle');
    expect(html).toMatch(/linien-switch__label">Winter</);
    expect(html).toContain('data-linie="b1"');
    expect(html).toContain('data-linie="b3"');
    expect(html).toContain('Entwurf');
  });

  it('"Alle Linien" nur in Produktion, Verträgen und Videos', () => {
    window.canCreate = () => false;
    const alle = { ...detail, linieAlle: true };
    expect(renderLinienSwitch(alle, 'casting')).not.toContain(`data-linie="${ALLE}"`);
    const html = renderLinienSwitch(alle, 'produktion');
    expect(html).toContain(`data-linie="${ALLE}"`);
    expect(html).toMatch(/linien-switch__label">Alle Linien</);
  });

  it('"+ Briefing" nur mit Recht, nichts ohne Linien', () => {
    window.canCreate = () => true;
    expect(renderLinienSwitch(detail, 'casting')).toContain('data-linie-neu');
    window.canCreate = () => false;
    expect(renderLinienSwitch(detail, 'casting')).not.toContain('data-linie-neu');
    expect(renderLinienSwitch({ linien: [] }, 'casting')).toBe('');
  });
});
