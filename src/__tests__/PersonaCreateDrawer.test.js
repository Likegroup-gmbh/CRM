import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openPersonaCreateDrawer, closePersonaCreateDrawer } from '../modules/persona/PersonaCreateDrawer.js';
import { personaCreateRoute, readCreateScope } from '../modules/persona/personaCreateScope.js';

function thenable(rows) {
  const q = {
    eqs: [],
    select() { return q; },
    eq(col, val) { q.eqs.push([col, val]); return q; },
    in() { return q; },
    order() { return q; },
    maybeSingle() {
      return Promise.resolve({ data: Array.isArray(rows) ? (rows[0] || null) : rows, error: null });
    },
    then(resolve, reject) {
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    }
  };
  return q;
}

const tables = {
  unternehmen: [{ id: 'u1', firmenname: 'Hautica' }],
  marke: [{ id: 'm1', markenname: 'Clear' }],
  campaign_briefings: [{ id: 'b1', aktivierung_name: 'Sommer' }],
  produkt_marke: [
    { produkt: { id: 'p1', name: 'Case', unternehmen_id: 'u1' } },
    { produkt: { id: 'p-other', name: 'Fremd', unternehmen_id: 'u9' } }
  ]
};

const seen = [];

function installSupabase() {
  seen.length = 0;
  window.supabase = {
    from(table) {
      const q = thenable(tables[table] || []);
      seen.push({ table, q });
      return q;
    }
  };
}

async function waitForOptions(id, value) {
  await vi.waitFor(() => {
    const select = document.getElementById(id);
    expect(select).not.toBeNull();
    expect([...select.options].some((o) => o.value === value)).toBe(true);
  });
}

async function pick(id, value, until) {
  const select = document.getElementById(id);
  select.disabled = false;
  select.value = value;
  select.dispatchEvent(new Event('change'));
  await until();
}

describe('personaCreateRoute', () => {
  it('baut die drei Create-Routen', () => {
    const ids = { unternehmenId: 'u1', markeId: 'm1', briefingId: 'b1', produktId: 'p1' };
    expect(personaCreateRoute('liste', ids)).toBe('/persona/new?unternehmen=u1&marke=m1&briefing=b1&produkt=p1');
    expect(personaCreateRoute('unternehmen', ids)).toBe('/unternehmen/u1/persona?marke=m1&briefing=b1&produkt=p1');
    expect(personaCreateRoute('marke', ids)).toBe('/marke/m1/persona?briefing=b1&produkt=p1');
  });

  it('baut die Route auch ohne Produkt', () => {
    const ids = { unternehmenId: 'u1', markeId: 'm1', briefingId: 'b1', produktId: null };
    expect(personaCreateRoute('liste', ids)).toBe('/persona/new?unternehmen=u1&marke=m1&briefing=b1');
    expect(personaCreateRoute('unternehmen', ids)).toBe('/unternehmen/u1/persona?marke=m1&briefing=b1');
    expect(personaCreateRoute('marke', ids)).toBe('/marke/m1/persona?briefing=b1');
  });

  it('liest die Zuordnung ohne Produkt, aber nicht ohne Briefing', () => {
    expect(readCreateScope('?unternehmen=u1&marke=m1')).toBeNull();
    expect(readCreateScope('?unternehmen=u1&marke=m1&briefing=b1')).toEqual({
      unternehmenId: 'u1',
      markeId: 'm1',
      briefingId: 'b1',
      produktId: null
    });
    expect(readCreateScope('?unternehmen=u1&marke=m1&briefing=b1&produkt=p1')).toEqual({
      unternehmenId: 'u1',
      markeId: 'm1',
      briefingId: 'b1',
      produktId: 'p1'
    });
    expect(readCreateScope('?briefing=b1&produkt=p1', { unternehmenId: 'u1', markeId: 'm1' })).toEqual({
      unternehmenId: 'u1',
      markeId: 'm1',
      briefingId: 'b1',
      produktId: 'p1'
    });
  });
});

describe('PersonaCreateDrawer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.formSystem = undefined;
    window.navigateTo = vi.fn();
    window.toastSystem = { show: vi.fn() };
    window.getAllowedUnternehmenIds = async () => null;
    window.getAllowedMarkenIds = async () => null;
    tables.campaign_briefings = [{ id: 'b1', aktivierung_name: 'Sommer' }];
    installSupabase();
  });

  afterEach(() => {
    closePersonaCreateDrawer();
    document.getElementById('persona-create-drawer-overlay')?.remove();
    document.getElementById('persona-create-drawer')?.remove();
  });

  it('ohne Unternehmen, Marke und Briefing kein Submit', async () => {
    openPersonaCreateDrawer();
    await waitForOptions('pccreate-unternehmen', 'u1');

    expect(document.getElementById('pccreate-marke').disabled).toBe(true);
    expect(document.getElementById('pccreate-submit').disabled).toBe(true);

    document.getElementById('pccreate-form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(window.navigateTo).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalled();
  });

  it('lädt Marke, Briefing und Produkt abhängig von der Vorstufe', async () => {
    openPersonaCreateDrawer({ origin: 'liste' });
    await waitForOptions('pccreate-unternehmen', 'u1');

    await pick('pccreate-unternehmen', 'u1', () => waitForOptions('pccreate-marke', 'm1'));
    expect(seen.some((c) => c.table === 'marke' && c.q.eqs.some((e) => e[0] === 'unternehmen_id' && e[1] === 'u1'))).toBe(true);

    await pick('pccreate-marke', 'm1', () => waitForOptions('pccreate-briefing', 'b1'));
    const briefing = seen.filter((c) => c.table === 'campaign_briefings').at(-1);
    expect(briefing.q.eqs).toEqual(expect.arrayContaining([
      ['unternehmen_id', 'u1'],
      ['marke_id', 'm1'],
      ['is_draft', false]
    ]));

    await pick('pccreate-briefing', 'b1', () => waitForOptions('pccreate-produkt', 'p1'));
    expect(seen.some((c) => c.table === 'produkt_marke' && c.q.eqs.some((e) => e[0] === 'marke_id' && e[1] === 'm1'))).toBe(true);
    expect([...document.getElementById('pccreate-produkt').options].some((o) => o.value === 'p-other')).toBe(false);

    document.getElementById('pccreate-produkt').value = 'p1';
    document.getElementById('pccreate-produkt').dispatchEvent(new Event('change'));
    expect(document.getElementById('pccreate-submit').disabled).toBe(false);

    document.getElementById('pccreate-submit').click();
    expect(window.navigateTo).toHaveBeenCalledWith('/persona/new?unternehmen=u1&marke=m1&briefing=b1&produkt=p1');
  });

  it('Submit ohne Produkt lässt den Parameter weg', async () => {
    openPersonaCreateDrawer({ origin: 'liste' });
    await waitForOptions('pccreate-unternehmen', 'u1');
    await pick('pccreate-unternehmen', 'u1', () => waitForOptions('pccreate-marke', 'm1'));
    await pick('pccreate-marke', 'm1', () => waitForOptions('pccreate-briefing', 'b1'));
    await pick('pccreate-briefing', 'b1', () => waitForOptions('pccreate-produkt', 'p1'));

    expect(document.getElementById('pccreate-submit').disabled).toBe(false);
    document.getElementById('pccreate-submit').click();
    expect(window.navigateTo).toHaveBeenCalledWith('/persona/new?unternehmen=u1&marke=m1&briefing=b1');
  });

  it('leerer Briefing-Schnitt blockiert und verlinkt das Anlegen', async () => {
    tables.campaign_briefings = [];
    openPersonaCreateDrawer();
    await waitForOptions('pccreate-unternehmen', 'u1');
    await pick('pccreate-unternehmen', 'u1', () => waitForOptions('pccreate-marke', 'm1'));
    await pick('pccreate-marke', 'm1', async () => {
      await vi.waitFor(() => {
        expect(document.getElementById('pccreate-briefing-hint').hidden).toBe(false);
      });
    });

    const hint = document.getElementById('pccreate-briefing-hint');
    expect(hint.innerHTML).toContain('/briefing/new?unternehmen=u1&amp;marke=m1');
    expect(document.getElementById('pccreate-briefing').disabled).toBe(true);
    expect(document.getElementById('pccreate-produkt').disabled).toBe(true);
    expect(document.getElementById('pccreate-submit').disabled).toBe(true);
  });

  it('Prefill sperrt Unternehmen und Marke', async () => {
    openPersonaCreateDrawer({
      origin: 'unternehmen',
      unternehmen_id: 'u1',
      unternehmenName: 'Hautica',
      marke_id: 'm1',
      markeName: 'Clear'
    });

    await vi.waitFor(() => {
      expect(document.getElementById('pccreate-marke').value).toBe('m1');
      expect(document.getElementById('pccreate-marke').disabled).toBe(true);
    });
    expect(document.getElementById('pccreate-unternehmen').disabled).toBe(true);
    expect(document.getElementById('pccreate-unternehmen').value).toBe('u1');
    expect(document.getElementById('pccreate-briefing').disabled).toBe(false);
  });

  it('nur Unternehmen gesperrt lässt die Marke wählbar', async () => {
    openPersonaCreateDrawer({
      origin: 'liste',
      unternehmen_id: 'u1',
      unternehmenName: 'Hautica'
    });

    await vi.waitFor(() => {
      expect(document.getElementById('pccreate-unternehmen').disabled).toBe(true);
      expect(document.getElementById('pccreate-marke').disabled).toBe(false);
    });
    expect(document.getElementById('pccreate-marke').value).toBe('');
  });
});
