import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreatorAuswahlDetail } from '../modules/creator-auswahl/CreatorAuswahlDetail.js';

const BAR_ID = 'floating-scrollbar-creator-auswahl';

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

/** Instanz ohne Datenbank: Laden kontrollierbar, bindEvents baut nur die Scrollbar. */
function worksheet(root, ladeDaten) {
  const detail = new CreatorAuswahlDetail();
  detail._fetchDataStages = vi.fn(ladeDaten);
  detail._verknuepfeBekannteCreator = vi.fn(async () => {});
  detail._subscribeRealtime = vi.fn();
  detail.render = vi.fn(async () => {
    root.innerHTML = '<div class="table-container"><table></table></div>';
  });
  detail.bindEvents = vi.fn(function () { this.initFloatingScrollbar(); });
  return detail;
}

const daten = async () => ({ liste: { id: 'l1', teilbereich: '' }, items: [{ id: 'i1' }] });
const bars = () => document.querySelectorAll(`#${BAR_ID}`);

describe('Casting – Floating-Scrollbar beim Verlassen', () => {
  let root;

  beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('div');
    document.body.appendChild(root);
    window.isKunde = () => true;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.isKunde;
    vi.restoreAllMocks();
  });

  it('baut keine Bar, wenn destroy() mitten im Laden kommt', async () => {
    const laden = deferred();
    const detail = worksheet(root, () => laden.promise);

    const init = detail.init('l1', { root, embedded: true });
    detail.destroy();
    laden.resolve(await daten());
    await init;

    expect(detail.bindEvents).not.toHaveBeenCalled();
    expect(detail._subscribeRealtime).not.toHaveBeenCalled();
    expect(bars()).toHaveLength(0);
  });

  it('räumt die Bar auch beim zweiten Verlassen derselben Instanz ab', async () => {
    const detail = worksheet(root, daten);

    await detail.init('l1', { root, embedded: true });
    expect(bars()).toHaveLength(1);
    detail.destroy();
    expect(bars()).toHaveLength(0);

    await detail.init('l1', { root, embedded: true });
    expect(bars()).toHaveLength(1);
    detail.destroy();
    expect(bars()).toHaveLength(0);
  });

  it('lässt ein veraltetes init() nicht weiterlaufen, wenn schon ein neueres läuft', async () => {
    const erstesLaden = deferred();
    const detail = worksheet(root, () => erstesLaden.promise);

    const erstes = detail.init('alt', { root, embedded: true });
    detail.destroy();
    detail._fetchDataStages.mockImplementation(daten);
    await detail.init('l1', { root, embedded: true });

    erstesLaden.resolve(await daten());
    await erstes;

    expect(detail.bindEvents).toHaveBeenCalledTimes(1);
    expect(detail.listeId).toBe('l1');
    expect(bars()).toHaveLength(1);
  });

  it('eine zerstörte Instanz baut keine Bar und nimmt der lebenden ihre nicht weg', async () => {
    const alt = worksheet(root, daten);
    await alt.init('l1', { root, embedded: true });
    alt.destroy();

    const neu = worksheet(root, daten);
    await neu.init('l1', { root, embedded: true });
    const lebendeBar = document.getElementById(BAR_ID);

    alt.initFloatingScrollbar();

    expect(bars()).toHaveLength(1);
    expect(document.getElementById(BAR_ID)).toBe(lebendeBar);
    neu.destroy();
    expect(bars()).toHaveLength(0);
  });

  it('ersetzt eine verwaiste Bar, statt eine zweite daneben zu legen', async () => {
    const verwaist = document.createElement('div');
    verwaist.id = BAR_ID;
    verwaist.className = 'floating-scrollbar-kampagne visible';
    document.body.appendChild(verwaist);

    const detail = worksheet(root, daten);
    await detail.init('l1', { root, embedded: true });

    expect(bars()).toHaveLength(1);
    expect(document.getElementById(BAR_ID)).not.toBe(verwaist);
    detail.destroy();
    expect(bars()).toHaveLength(0);
  });
});
