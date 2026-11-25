import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DuplicateChecker } from '../core/validation/DuplicateChecker.js';
import { bindDuplicateCheck } from '../core/validation/DuplicateCheckBinding.js';

const MANAGEMENTS = [
  { id: 'm1', firmenname: 'Company XY', logo_url: null },
  { id: 'm2', firmenname: 'Company XY Management', logo_url: null },
  { id: 'm3', firmenname: 'Ganz Anders', logo_url: null }
];

function mockSupabase(rows) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ order: vi.fn(async () => ({ data: rows, error: null })) }))
    }))
  };
}

describe('DuplicateChecker.checkManagement', () => {
  beforeEach(() => { window.supabase = mockSupabase(MANAGEMENTS); });
  afterEach(() => { delete window.supabase; });

  it('GmbH-Variante ist namensgleich (exact)', async () => {
    const r = await new DuplicateChecker().checkManagement('Company XY GmbH');
    expect(r.exact).toBe(true);
    expect(r.similar.map((x) => x.id)).toContain('m1');
  });

  it('Management-Variante ist nur ähnlich, nicht exact', async () => {
    const r = await new DuplicateChecker().checkManagement('Company XY Management GmbH');
    // Kern = companyxymanagement -> m2 ist namensgleich
    expect(r.exact).toBe(true);
    const r2 = await new DuplicateChecker().checkManagement('Company XY Mgmt');
    expect(r2.exact).toBe(false);
  });

  it('eigene ID wird ausgeschlossen', async () => {
    const r = await new DuplicateChecker().checkManagement('Company XY', 'm1');
    expect(r.exact).toBe(false);
  });

  it('zu kurzer Name prüft nichts', async () => {
    expect(await new DuplicateChecker().checkManagement('A')).toEqual({ exact: false, similar: [] });
  });

  it('frisch umgeht den Cache', async () => {
    const dc = new DuplicateChecker();
    await dc.checkManagement('Company XY');
    await dc.checkManagement('Company XY');
    expect(window.supabase.from).toHaveBeenCalledTimes(1);
    await dc.checkManagement('Company XY', null, { frisch: true });
    expect(window.supabase.from).toHaveBeenCalledTimes(2);
  });
});

describe('bindDuplicateCheck (management)', () => {
  let form;

  beforeEach(() => {
    window.supabase = mockSupabase(MANAGEMENTS);
    window.duplicateChecker = new DuplicateChecker();
    document.body.innerHTML = `
      <form id="management-form">
        <div class="form-field"><input id="firmenname" name="firmenname" /></div>
        <button type="submit">Speichern</button>
      </form>`;
    form = document.getElementById('management-form');
  });

  afterEach(() => {
    delete window.supabase;
    delete window.duplicateChecker;
    document.body.innerHTML = '';
  });

  it('sperrt Speichern bei Namensgleich und zeigt den Treffer', async () => {
    const check = bindDuplicateCheck('management', form);
    form.querySelector('#firmenname').value = 'Company XY GmbH';
    const darf = await check.pruefe();
    expect(darf).toBe(false);
    expect(form.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(form.querySelector('.duplicate-error')).not.toBeNull();
    expect(form.querySelector('.duplicate-link').dataset.entityId).toBe('m1');
  });

  it('warnt nur bei ähnlichem Namen', async () => {
    const check = bindDuplicateCheck('management', form);
    form.querySelector('#firmenname').value = 'Company XY Mgmt';
    const darf = await check.pruefe();
    expect(darf).toBe(true);
    expect(form.querySelector('button[type="submit"]').disabled).toBe(false);
    expect(form.querySelector('.duplicate-warning')).not.toBeNull();
  });

  it('Tippen räumt Meldung und Sperre weg', async () => {
    const check = bindDuplicateCheck('management', form);
    const feld = form.querySelector('#firmenname');
    feld.value = 'Company XY';
    await check.pruefe();
    feld.dispatchEvent(new Event('input'));
    expect(form.querySelector('.duplicate-message-container').innerHTML).toBe('');
    expect(form.querySelector('button[type="submit"]').disabled).toBe(false);
  });

  it('Treffer-Klick geht an onSelect', async () => {
    const onSelect = vi.fn();
    const check = bindDuplicateCheck('management', form, { onSelect });
    form.querySelector('#firmenname').value = 'Company XY';
    await check.pruefe();
    form.querySelector('.duplicate-link').click();
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledWith('m1');
  });

  it('maskiert HTML im Namen', async () => {
    window.supabase = mockSupabase([{ id: 'x', firmenname: '<img src=x onerror=alert(1)> Evil', logo_url: null }]);
    window.duplicateChecker = new DuplicateChecker();
    const check = bindDuplicateCheck('management', form);
    form.querySelector('#firmenname').value = '<img src=x onerror=alert(1)> Evil';
    await check.pruefe();
    expect(form.querySelector('.duplicate-name img')).toBeNull();
  });

  it('gibt null zurück, wenn das Feld fehlt', () => {
    document.body.innerHTML = '<form id="f"><button type="submit"></button></form>';
    expect(bindDuplicateCheck('management', document.getElementById('f'))).toBeNull();
  });
});

describe('bindDuplicateCheck (creator, zwei Felder)', () => {
  it('prüft erst, wenn Vor- und Nachname gefüllt sind', async () => {
    document.body.innerHTML = `
      <form id="f">
        <div><input id="vorname" name="vorname" /></div>
        <div><input id="nachname" name="nachname" /></div>
        <button type="submit"></button>
      </form>`;
    const checkCreator = vi.fn(async () => ({ exact: true, similar: [{ id: 'c1', vorname: 'A', nachname: 'B' }] }));
    window.duplicateChecker = { checkCreator };
    const check = bindDuplicateCheck('creator', document.getElementById('f'));

    document.getElementById('vorname').value = 'A';
    expect(await check.pruefe()).toBe(true);
    expect(checkCreator).not.toHaveBeenCalled();

    document.getElementById('nachname').value = 'B';
    expect(await check.pruefe()).toBe(false);
    expect(checkCreator).toHaveBeenCalledWith('A', 'B', null);
    delete window.duplicateChecker;
  });
});
