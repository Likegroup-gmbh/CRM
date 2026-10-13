import { describe, it, expect, afterEach, vi } from 'vitest';
import { strategieService } from '../modules/strategie/StrategieService.js';
import { AddItemDrawer } from '../modules/strategie/AddItemDrawer.js';

describe('processQueue – Trigger-Fehler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete window.toastSystem;
  });

  it('setzt das Item auf error, wenn die Verarbeitung nicht startet', async () => {
    vi.spyOn(strategieService, 'getStrategieItems').mockResolvedValue([]);
    vi.spyOn(strategieService, 'createStrategieItem').mockResolvedValue({ id: 'item-1' });
    vi.spyOn(strategieService, 'enqueueItemProcessing').mockRejectedValue(new Error('HTTP 404'));
    const update = vi.spyOn(strategieService, 'updateStrategieItem').mockResolvedValue({});
    const toasts = [];
    window.toastSystem = { show: (msg, type) => toasts.push({ msg, type }) };

    const drawer = new AddItemDrawer();
    drawer.strategieId = 's1';
    drawer.teilbereiche = [];
    drawer.queue = [{
      id: 'q1',
      url: 'https://tiktok.com/@x/video/1',
      kategorie: null,
      beschreibung: null,
      platform: 'tiktok',
      status: 'pending'
    }];

    await drawer.processQueue();

    expect(update).toHaveBeenCalledWith('item-1', {
      verarbeitung_status: 'error',
      verarbeitung_fehler: 'Verarbeitung konnte nicht gestartet werden (HTTP 404) – bitte neu verarbeiten'
    });
    expect(drawer.queue[0].status).toBe('done');
    expect(toasts).toEqual([{
      msg: 'Videoreferenz angelegt, Verarbeitung fehlgeschlagen – bitte neu verarbeiten',
      type: 'warning'
    }]);
  });
});

describe('AddItemDrawer – Sektionen und TableSelect', () => {
  const PAID = { bereich: 'paid_creator_ads', funnel_stufen: ['mid'] };

  async function oeffnen(strategie = { id: 's1' }, produkte = [], personas = []) {
    vi.spyOn(strategieService, 'getBriefingProdukte').mockResolvedValue(produkte);
    const drawer = new AddItemDrawer();
    await drawer.open(strategie, ['Reels', 'Stories'], personas);
    return drawer;
  }

  function waehle(feld, wert) {
    document.querySelector(`#add-item-drawer [data-field="${feld}"] .table-select__trigger`).click();
    document.querySelector(`.table-select__portal [data-value="${wert}"]`).click();
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll('.table-select__portal').forEach(p => p.remove());
    document.getElementById('add-item-drawer')?.remove();
    document.getElementById('add-item-drawer-overlay')?.remove();
  });

  it('gliedert in Inhalt, Einordnung und Queue, der Footer steht ausserhalb des Bodys', async () => {
    await oeffnen();

    const sektionen = [...document.querySelectorAll('#add-item-drawer [data-add-section]')]
      .map(el => el.dataset.addSection);
    expect(sektionen).toEqual(['inhalt', 'einordnung', 'queue']);
    expect(document.querySelector('#add-item-drawer-body .drawer-footer')).toBeNull();
    expect(document.querySelector('#add-item-drawer > .drawer-footer #btn-close-drawer')).toBeTruthy();
  });

  it('nutzt keine nativen Selects mehr', async () => {
    await oeffnen(PAID_STRATEGIE(), [{ id: 'p1', name: 'Serum' }], [{ value: 'a1', label: 'Anna' }]);

    expect(document.querySelector('#add-item-drawer select')).toBeNull();
    const felder = [...document.querySelectorAll('#add-item-drawer [data-table-select]')]
      .map(el => el.dataset.field);
    expect(felder).toEqual(['add_kategorie', 'add_funnel', 'add_persona', 'add_produkt']);
  });

  it('blendet Funnel, Persona und Produkt ohne Daten aus', async () => {
    await oeffnen();

    const felder = [...document.querySelectorAll('#add-item-drawer [data-table-select]')]
      .map(el => el.dataset.field);
    expect(felder).toEqual(['add_kategorie']);
  });

  it('belegt Funnel-Stufe und Produkt vor, wenn es genau eine gibt', async () => {
    await oeffnen(PAID_STRATEGIE(), [{ id: 'p1', name: 'Serum' }]);

    expect(document.querySelector('[name="funnel_stufe"]').value).toBe('mid');
    expect(document.querySelector('[name="produkt_id"]').value).toBe('p1');
    expect(document.querySelector('[name="kategorie"]').value).toBe('');
  });

  it('uebernimmt die gewaehlten Werte in den Queue-Eintrag', async () => {
    const drawer = await oeffnen({ id: 's1', briefing: { bereich: 'paid_creator_ads' } }, [
      { id: 'p1', name: 'Serum' },
      { id: 'p2', name: 'Creme' }
    ], [{ value: 'a1', label: 'Anna' }]);
    vi.spyOn(drawer, 'processQueue').mockResolvedValue();

    document.querySelector('[data-add-art="idee"]').click();
    document.getElementById('drawer-beschreibung').value = 'Morgenroutine';
    waehle('add_kategorie', 'Stories');
    waehle('add_funnel', 'lower');
    waehle('add_persona', 'a1');
    waehle('add_produkt', 'p2');
    document.getElementById('add-item-form').requestSubmit();

    expect(drawer.queue).toHaveLength(1);
    expect(drawer.queue[0]).toMatchObject({
      kategorie: 'Stories',
      funnelStufe: 'lower',
      personaId: 'a1',
      produktId: 'p2',
      produktName: 'Creme'
    });
  });

  function PAID_STRATEGIE() {
    return { id: 's1', briefing: PAID };
  }
});
