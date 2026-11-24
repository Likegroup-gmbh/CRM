import { beforeEach, describe, expect, it, vi } from 'vitest';

const konzept = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock('../modules/kampagne/konzeptInhalte.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadKonzeptInhalte: konzept.load
}));

import { loadVerknuepfungen, verknuepfungenAusVideos } from '../modules/video-browser/videoBrowserVerknuepfungen.js';

const KOOPS = [{ id: 'k1', creator_id: 'c1', produktion_id: 'p1', briefing_id: null }];
const idee = (id, beschreibung) => ({
  id, beschreibung, strategie_id: 's1', creator_id: 'c1', produktion_id: 'p1', video_umgesetzt: true,
  produkt: { id: 'pr1', name: 'Serum' }
});

beforeEach(() => { konzept.load.mockReset(); });

describe('Verknüpfungen je Video', () => {
  it('gespeicherte Joins: Videoidee mit Konzept und Produkt, Skript mit Status', () => {
    const map = verknuepfungenAusVideos([{
      id: 'v1',
      strategie_item: { id: 'i1', beschreibung: 'Morgenroutine', strategie_id: 's1', produkt: { id: 'pr1', name: 'Serum' } },
      skript: { id: 'sk1', titel: 'Skript 1', status: 'freigegeben', briefing_id: 'b1' }
    }, { id: 'v2' }]);
    expect(map.v1).toEqual({
      idee: { id: 'i1', beschreibung: 'Morgenroutine', strategieId: 's1', produkt: { id: 'pr1', name: 'Serum' } },
      skript: { id: 'sk1', titel: 'Skript 1', status: 'freigegeben', briefingId: 'b1' },
      ideeVirtuell: false,
      skriptVirtuell: false
    });
    expect(map.v2).toEqual({ idee: null, skript: null, ideeVirtuell: false, skriptVirtuell: false });
  });

  it('Team: freie Videos bekommen die Ideen des Creators in Konzept-Reihenfolge, gespeicherte gewinnen', async () => {
    konzept.load.mockResolvedValue({
      ideen: [idee('i1', 'Erste'), idee('i2', 'Zweite')],
      skripte: [{ id: 'sk2', strategie_item_id: 'i2', titel: 'Skript zu Zweite', status: 'entwurf', briefing_id: null }]
    });
    const videos = [
      { id: 'v1', kooperation_id: 'k1', position: 1, strategie_item_id: 'i1', strategie_item: { id: 'i1', beschreibung: 'Erste', strategie_id: 's1' } },
      { id: 'v2', kooperation_id: 'k1', position: 2 }
    ];
    const map = await loadVerknuepfungen({ client: {}, kampagneId: 'ka1', produktionId: 'p1', kooperationen: KOOPS, videos, team: true });
    expect(konzept.load).toHaveBeenCalledWith({}, { kampagneId: 'ka1', produktionId: 'p1', briefingId: null });
    expect(map.v1).toMatchObject({ idee: { id: 'i1' }, ideeVirtuell: false });
    expect(map.v2).toMatchObject({
      idee: { id: 'i2', strategieId: 's1', produkt: { name: 'Serum' } },
      skript: { id: 'sk2', status: 'entwurf' },
      ideeVirtuell: true,
      skriptVirtuell: true
    });
  });

  it('Kunde lädt keine Ideen, ein Lesefehler fällt auf die gespeicherten zurück', async () => {
    const videos = [{ id: 'v1', kooperation_id: 'k1', skript: { id: 'sk1', titel: 'S', status: 'freigegeben' } }];
    const kunde = await loadVerknuepfungen({ client: {}, kampagneId: 'ka1', kooperationen: KOOPS, videos, team: false });
    expect(konzept.load).not.toHaveBeenCalled();
    expect(kunde.v1.skript.id).toBe('sk1');

    konzept.load.mockImplementation(async () => { throw new Error('rls'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const team = await loadVerknuepfungen({ client: {}, kampagneId: 'ka1', kooperationen: KOOPS, videos, team: true });
    expect(team.v1).toMatchObject({ skript: { id: 'sk1' }, idee: null });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
