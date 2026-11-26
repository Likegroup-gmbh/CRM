import { describe, it, expect } from 'vitest';
import {
  istFreigabeBereit,
  freigabeZustand,
  buildKooperationsName
} from '../modules/creator-auswahl/castingFreigabeLogik.js';
import { createSerienDaempfung } from '../core/animation/freigabePuls.js';
import { getVisibleColumnCount } from '../modules/creator-auswahl/sourcingSpaltenSichtbarkeit.js';
import { baueSourcingSpaltenfolge } from '../modules/creator-auswahl/sourcingSpaltenfolge.js';
import { rowDoc, tableDoc } from './sourcingTabelleTestKit.js';

const LISTE = { kampagne_id: 'k1', produktion_id: 'p1' };

describe('istFreigabeBereit', () => {
  it.each([
    [{ prio_1: true, zusage: true }, true],
    [{ prio_2: true, zusage: true }, true],
    [{ prio_1: true, gebucht: true }, true],
    [{ prio_2: true, gebucht: true }, true]
  ])('Prio 1/2 plus Zusage oder Gebucht: %o', (item, erwartet) => {
    expect(istFreigabeBereit(item)).toBe(erwartet);
  });

  it.each([
    [{}],
    [{ prio_1: true }],
    [{ zusage: true }],
    [{ prio_1: true, preis_zugesagt: true }],
    [{ prio_1: true, in_verhandlung: true }],
    [{ abgelehnt: true, zusage: true }],
    [{ prio_1: true, absage: true }]
  ])('sonst gesperrt: %o', (item) => {
    expect(istFreigabeBereit(item)).toBe(false);
  });

  it('folgt der Anzeige: Abgelehnt schlaegt eine alte Prio, Abgesagt schlaegt Gebucht', () => {
    expect(istFreigabeBereit({ prio_1: true, abgelehnt: true, zusage: true })).toBe(false);
    expect(istFreigabeBereit({ prio_1: true, gebucht: true, absage: true })).toBe(false);
  });

  it('Vorschlaege und null sind nie bereit', () => {
    expect(istFreigabeBereit({ prio_1: true, zusage: true, isVorschlag: true })).toBe(false);
    expect(istFreigabeBereit(null)).toBe(false);
  });
});

describe('freigabeZustand', () => {
  const bereit = { prio_1: true, zusage: true, creator_id: 'c1' };

  it('done, sobald der Creator in der Linie eine Kooperation hat, auch ohne Gate', () => {
    expect(freigabeZustand({ creator_id: 'c1' }, { freigegebeneCreatorIds: new Set(['c1']) })).toBe('done');
  });

  it('ready mit Gate und Produktion, locked ohne Produktion', () => {
    expect(freigabeZustand(bereit, { freigegebeneCreatorIds: new Set() })).toBe('ready');
    expect(freigabeZustand(bereit, { kontextOk: false })).toBe('locked');
  });

  it('ohne creator_id kann es nicht done sein, aber ready', () => {
    expect(freigabeZustand({ prio_2: true, gebucht: true }, { freigegebeneCreatorIds: new Set(['c1']) })).toBe('ready');
  });
});

describe('buildKooperationsName', () => {
  it('naechste Nummer nach der hoechsten vorhandenen', () => {
    expect(buildKooperationsName({ vorname: 'Lea', nachname: 'Berg' }, ['A 1/5', 'B 3/5'], 5)).toBe('Lea Berg 4/5');
  });

  it('ohne Nummern zaehlt die vorhandenen, ohne Namen der Handle', () => {
    expect(buildKooperationsName({ instagram: 'lea' }, ['frei'], 0)).toBe('@lea 2/1');
    expect(buildKooperationsName({}, [], 3)).toBe('Creator 1/3');
  });
});

describe('createSerienDaempfung', () => {
  function uhr() {
    let t = 0;
    return { jetzt: () => t, weiter: (ms) => { t += ms; } };
  }

  it('ab der dritten Freigabe innerhalb von 4 s ruhig', () => {
    const u = uhr();
    const d = createSerienDaempfung({ jetzt: u.jetzt });
    expect(d.naechsteIstRuhig()).toBe(false);
    u.weiter(500);
    expect(d.naechsteIstRuhig()).toBe(false);
    u.weiter(500);
    expect(d.naechsteIstRuhig()).toBe(true);
    u.weiter(500);
    expect(d.naechsteIstRuhig()).toBe(true);
  });

  it('nach mehr als 4 s Pause wieder mit Funken', () => {
    const u = uhr();
    const d = createSerienDaempfung({ jetzt: u.jetzt });
    d.naechsteIstRuhig();
    d.naechsteIstRuhig();
    expect(d.naechsteIstRuhig()).toBe(true);
    u.weiter(4001);
    expect(d.naechsteIstRuhig()).toBe(false);
  });

  it('Instanzen zaehlen getrennt (eine pro Tabelle)', () => {
    const u = uhr();
    const a = createSerienDaempfung({ jetzt: u.jetzt });
    const b = createSerienDaempfung({ jetzt: u.jetzt });
    a.naechsteIstRuhig();
    a.naechsteIstRuhig();
    expect(b.naechsteIstRuhig()).toBe(false);
  });
});

describe('Spalte Freigabe', () => {
  const mitRecht = { canCreateKooperation: true, liste: LISTE };

  it('steht direkt vor Aktionen, nur mit Recht auf Kooperation anlegen', () => {
    const kopf = [...tableDoc([{ id: 'i1' }], mitRecht).querySelectorAll('thead th')].map(th => th.className);
    expect(kopf.at(-2)).toBe('cp-col-freigabe');
    expect(kopf.at(-1)).toContain('cp-col-actions');

    expect(tableDoc([{ id: 'i1' }]).querySelector('.cp-col-freigabe')).toBeNull();
    expect(rowDoc({}, { ...mitRecht, isKunde: true }).querySelector('.cp-col-freigabe')).toBeNull();
  });

  it('Button ausgegraut mit Combo-Class, klickbar erst mit Gate', () => {
    const gesperrt = rowDoc({ prio_1: true }, mitRecht).querySelector('[data-freigabe-btn]');
    expect(gesperrt.classList.contains('mdc-btn--secondary')).toBe(true);
    expect(gesperrt.classList.contains('mdc-btn--disabled')).toBe(true);
    expect(gesperrt.disabled).toBe(true);
    expect(gesperrt.dataset.state).toBe('locked');

    const bereit = rowDoc({ prio_1: true, zusage: true }, mitRecht).querySelector('[data-freigabe-btn]');
    expect(bereit.classList.contains('mdc-btn--disabled')).toBe(false);
    expect(bereit.disabled).toBe(false);
    expect(bereit.dataset.state).toBe('ready');
    expect(bereit.querySelector('[data-freigabe-shackle]')).not.toBeNull();
    expect(bereit.parentElement.querySelector('[data-freigabe-ring]')).not.toBeNull();
  });

  it('ohne Produktion gesperrt, mit Kooperation abgehakt', () => {
    const ohne = rowDoc({ prio_1: true, zusage: true }, { canCreateKooperation: true, liste: {} });
    expect(ohne.querySelector('[data-freigabe-btn]').dataset.state).toBe('locked');

    const done = rowDoc({ prio_1: true, gebucht: true, creator_id: 'c1' }, {
      ...mitRecht, freigegebeneCreatorIds: new Set(['c1'])
    }).querySelector('[data-freigabe-btn]');
    expect(done.dataset.state).toBe('done');
    expect(done.disabled).toBe(true);
    expect(done.textContent).toContain('Freigegeben');
  });

  it('Vorschlaege bekommen eine leere Zelle', () => {
    const zelle = rowDoc({ isVorschlag: true, prio_1: true, zusage: true }, mitRecht).querySelector('td.cp-col-freigabe');
    expect(zelle).not.toBeNull();
    expect(zelle.querySelector('button')).toBeNull();
  });

  it('zaehlt im colspan und steht fest vor Aktionen in der Spaltenfolge', () => {
    expect(getVisibleColumnCount(false, [], { hasFreigabe: true }) - getVisibleColumnCount(false, [])).toBe(1);
    expect(getVisibleColumnCount(true, [], { hasFreigabe: true })).toBe(getVisibleColumnCount(true, []));
    expect(baueSourcingSpaltenfolge({ includeFreigabe: true }).slice(-2)).toEqual(['cp-col-freigabe', 'cp-col-actions']);
    expect(baueSourcingSpaltenfolge({ columnOrder: ['cp-col-vk', 'cp-col-link'], includeFreigabe: true }).slice(-2))
      .toEqual(['cp-col-freigabe', 'cp-col-actions']);
  });
});
