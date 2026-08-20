import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SourcingBuchungDrawer } from '../modules/creator-auswahl/SourcingBuchungDrawer.js';
import { creatorAuswahlService, handleAusLink } from '../modules/creator-auswahl/CreatorAuswahlService.js';

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function detail(overrides = {}) {
  return {
    liste: {
      kampagne_id: 'kamp1',
      unternehmen_id: 'unt1',
      kampagne: { kampagnenname: 'Sommer 2026' }
    },
    rerenderTable: vi.fn(),
    ...overrides
  };
}

function body() {
  return document.getElementById('sourcing-buchung-drawer-body');
}

describe('handleAusLink', () => {
  it('zieht den Handle aus einer Profil-URL', () => {
    expect(handleAusLink('https://www.instagram.com/max.muster/')).toBe('max.muster');
    expect(handleAusLink('https://www.tiktok.com/@maxtt?lang=de')).toBe('maxtt');
    expect(handleAusLink('instagram.com/foo_bar')).toBe('foo_bar');
  });

  it('akzeptiert auch nackte Handles', () => {
    expect(handleAusLink('@foo')).toBe('foo');
    expect(handleAusLink('bar')).toBe('bar');
  });

  it('liefert null bei leeren oder unbrauchbaren Werten', () => {
    expect(handleAusLink(null)).toBeNull();
    expect(handleAusLink('')).toBeNull();
    expect(handleAusLink('https://www.instagram.com/')).toBeNull();
  });
});

describe('transferToCRM – Feld-Mapping', () => {
  beforeEach(() => {
    window.supabase = { from: vi.fn() };
  });

  afterEach(() => {
    delete window.supabase;
  });

  it('mappt die Sourcing-Links auf instagram/tiktok und nutzt die echten Creator-Spalten', async () => {
    const item = {
      id: 'i1',
      name: 'Max Muster',
      link_instagram: 'https://www.instagram.com/maxmuster/',
      link_tiktok: 'https://www.tiktok.com/@maxmuster',
      email: 'max@creator.de',
      telefon: '+49 170 1',
      wohnort: 'Berlin',
      notiz: 'Notiz',
      follower_instagram: 12000,
      follower_tiktok: 5000,
      profile_image_url: 'https://cdn.test/p.avif'
    };

    const itemChain = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn()
        .mockResolvedValueOnce({ data: item, error: null })
        .mockResolvedValueOnce({ data: { ...item, creator_id: 'c1' }, error: null })
    };
    const creatorChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'c1', name: 'Max Muster' }, error: null })
    };

    window.supabase.from.mockImplementation(table =>
      table === 'creator' ? creatorChain : itemChain
    );

    const creator = await creatorAuswahlService.transferToCRM('i1');

    expect(creator.id).toBe('c1');

    const payload = creatorChain.insert.mock.calls[0][0];
    expect(payload).toEqual({
      vorname: 'Max',
      nachname: 'Muster',
      instagram: 'maxmuster',
      tiktok: 'maxmuster',
      mail: 'max@creator.de',
      telefonnummer: '+49 170 1',
      instagram_follower: 12000,
      tiktok_follower: 5000,
      lieferadresse_stadt: 'Berlin',
      notiz: 'Notiz',
      profilbild_url: 'https://cdn.test/p.avif'
    });

    // Die Sourcing-Zeile wird mit dem neuen Creator verknuepft
    expect(itemChain.update.mock.calls[0][0]).toEqual({ creator_id: 'c1' });
  });
});

describe('SourcingBuchungDrawer', () => {
  let drawer;
  let spies;

  beforeEach(() => {
    window.toastSystem = { show: vi.fn() };
    window.navigateTo = vi.fn();

    spies = {
      transfer: vi.spyOn(creatorAuswahlService, 'transferToCRM'),
      getManagement: vi.spyOn(creatorAuswahlService, 'getAktivesManagement'),
      getManagements: vi.spyOn(creatorAuswahlService, 'getAlleManagements'),
      findKooperation: vi.spyOn(creatorAuswahlService, 'findKooperation'),
      createKooperation: vi.spyOn(creatorAuswahlService, 'createKooperation'),
      assignManagement: vi.spyOn(creatorAuswahlService, 'assignManagement')
    };
  });

  afterEach(() => {
    drawer?.remove();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function oeffnen(item, detailOverride) {
    drawer = new SourcingBuchungDrawer(detail(detailOverride));
    drawer.open({ id: 'i1', name: 'Max Muster', ...item });
    return drawer;
  }

  it('startet ohne CRM-Verknuepfung mit dem Uebernahme-Schritt und sperrt den Rest', async () => {
    oeffnen({});
    await flush();

    expect(body().querySelector('#btn-buchung-crm-transfer')).not.toBeNull();
    expect(body().textContent).toContain('Erst ins CRM übernehmen, dann folgt die Management-Info');
    expect(body().textContent).toContain('Erst ins CRM übernehmen, dann kann der Creator in die Kampagne „Sommer 2026“');
  });

  it('uebernimmt ins CRM und laedt danach Management und Kooperation nach', async () => {
    spies.transfer.mockResolvedValue({ id: 'c1' });
    spies.getManagement.mockResolvedValue(null);
    spies.getManagements.mockResolvedValue([{ id: 'm1', firmenname: 'Talent Agency' }]);
    spies.findKooperation.mockResolvedValue(null);

    oeffnen({});
    await flush();

    body().querySelector('#btn-buchung-crm-transfer').click();
    await flush();
    await flush();

    expect(spies.transfer).toHaveBeenCalledWith('i1');
    expect(drawer.item.creator_id).toBe('c1');
    expect(spies.getManagement).toHaveBeenCalledWith('c1');
    expect(spies.findKooperation).toHaveBeenCalledWith('kamp1', 'c1');
    expect(body().querySelector('#btn-buchung-crm-open')).not.toBeNull();
  });

  it('zeigt bei verknuepftem Creator das aktive Management mit Namen', async () => {
    spies.getManagement.mockResolvedValue({ management_id: 'm1', management: { firmenname: 'Talent Agency' } });
    spies.getManagements.mockResolvedValue([]);
    spies.findKooperation.mockResolvedValue({ id: 'koop1' });

    oeffnen({ creator_id: 'c1' });
    await flush();

    expect(body().textContent).toContain('Hat Management:');
    expect(body().textContent).toContain('Talent Agency');
    expect(body().textContent).toContain('Bereits in der Kampagne „Sommer 2026“');
    expect(body().querySelector('#btn-buchung-kooperation-create')).toBeNull();
  });

  it('weist ein Management ueber das Select zu', async () => {
    spies.getManagement.mockResolvedValue(null);
    spies.getManagements.mockResolvedValue([
      { id: 'm1', firmenname: 'Talent Agency' },
      { id: 'm2', firmenname: 'Creator GmbH' }
    ]);
    spies.findKooperation.mockResolvedValue({ id: 'koop1' });
    spies.assignManagement.mockResolvedValue({ management_id: 'm2', management: { firmenname: 'Creator GmbH' } });

    oeffnen({ creator_id: 'c1' });
    await flush();

    const select = body().querySelector('#buchung-management-select');
    expect(select).not.toBeNull();
    select.value = 'm2';
    body().querySelector('#btn-buchung-management-assign').click();
    await flush();

    expect(spies.assignManagement).toHaveBeenCalledWith('c1', 'm2');
    expect(body().textContent).toContain('Creator GmbH');
  });

  it('warnt, wenn ohne Auswahl zugewiesen werden soll', async () => {
    spies.getManagement.mockResolvedValue(null);
    spies.getManagements.mockResolvedValue([{ id: 'm1', firmenname: 'Talent Agency' }]);
    spies.findKooperation.mockResolvedValue({ id: 'koop1' });

    oeffnen({ creator_id: 'c1' });
    await flush();

    body().querySelector('#btn-buchung-management-assign').click();
    await flush();

    expect(spies.assignManagement).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith('Bitte ein Management auswählen', 'warning');
  });

  it('legt die Kooperation mit Kampagne, Unternehmen und Creator an', async () => {
    spies.getManagement.mockResolvedValue(null);
    spies.getManagements.mockResolvedValue([]);
    spies.findKooperation.mockResolvedValue(null);
    spies.createKooperation.mockResolvedValue({ id: 'koop1' });

    oeffnen({ creator_id: 'c1' });
    await flush();

    body().querySelector('#btn-buchung-kooperation-create').click();
    await flush();

    expect(spies.createKooperation).toHaveBeenCalledWith({
      name: 'Max Muster',
      kampagne_id: 'kamp1',
      creator_id: 'c1',
      unternehmen_id: 'unt1'
    });
    expect(body().textContent).toContain('Bereits in der Kampagne „Sommer 2026“');
  });

  it('ueberspringt den Insert, wenn die Kooperation beim Klick schon existiert', async () => {
    spies.getManagement.mockResolvedValue(null);
    spies.getManagements.mockResolvedValue([]);
    // Erster Check beim Oeffnen: keine Kooperation; zweiter beim Klick: inzwischen da
    spies.findKooperation
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'koop1' });

    oeffnen({ creator_id: 'c1' });
    await flush();

    body().querySelector('#btn-buchung-kooperation-create').click();
    await flush();

    expect(spies.createKooperation).not.toHaveBeenCalled();
    expect(body().textContent).toContain('Bereits in der Kampagne');
  });

  it('weist bei einer Liste ohne Kampagne nur darauf hin', async () => {
    spies.getManagement.mockResolvedValue(null);
    spies.getManagements.mockResolvedValue([]);

    oeffnen({ creator_id: 'c1' }, { liste: { kampagne_id: null, unternehmen_id: 'unt1' } });
    await flush();

    expect(spies.findKooperation).not.toHaveBeenCalled();
    expect(body().textContent).toContain('keiner Kampagne verknüpft');
    expect(body().querySelector('#btn-buchung-kooperation-create')).toBeNull();
  });

  it('schliesst ueber den Fertig-Button und raeumt das DOM auf', async () => {
    oeffnen({});
    await flush();

    body().querySelector('#btn-sourcing-buchung-fertig').click();
    await new Promise(resolve => setTimeout(resolve, 350));

    expect(document.getElementById('sourcing-buchung-drawer')).toBeNull();
    expect(document.getElementById('sourcing-buchung-drawer-overlay')).toBeNull();
  });
});
