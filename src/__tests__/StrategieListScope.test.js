import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrategieService } from '../modules/strategie/StrategieService.js';

const DREXEL = 'cc058517-cf8d-4113-8bf7-44e5d2dfc633';

const drexelKonzept = {
  id: '6221c119-21f2-47f3-8110-278758c440de',
  name: 'Leber Aktiv',
  unternehmen_id: DREXEL,
  marke_id: null,
  kampagne_id: null,
  unternehmen: { id: DREXEL, firmenname: 'Bärbel Drexel GmbH' }
};

const fremdesKonzept = {
  id: 'other-1',
  name: 'Fremdes Konzept',
  unternehmen_id: 'other-u',
  marke_id: null,
  kampagne_id: 'kamp-1',
  unternehmen: { id: 'other-u', firmenname: 'Andere GmbH' }
};

describe('getAllStrategien – Mitarbeiter ohne Kampagne am Konzept', () => {
  let service;

  beforeEach(() => {
    service = new StrategieService();
    window.isAdmin = () => false;
    window.isInvestor = () => false;
    window.isKunde = () => false;
    window.isMitarbeiter = () => true;
    window.currentUser = { id: '39dfed99-daa4-4e88-906b-34b92154cb1a', rolle: 'mitarbeiter' };
    window.dataScopeService = {
      getAllowedUnternehmenIds: vi.fn(async () => [DREXEL])
    };
    vi.spyOn(service, '_fetchAllStrategien').mockResolvedValue([drexelKonzept, fremdesKonzept]);
    vi.spyOn(service, '_getAllowedKampagneIds').mockResolvedValue([]);
  });

  it('zeigt Drexel-Konzepte ohne kampagne_id in der linken Konzeptliste', async () => {
    const result = await service.getAllStrategien();

    expect(result.map((s) => s.name)).toEqual(['Leber Aktiv']);
  });

  it('behaelt Konzepte mit erlaubter Kampagne', async () => {
    service._getAllowedKampagneIds.mockResolvedValue(['kamp-1']);

    const result = await service.getAllStrategien();

    expect(result.map((s) => s.name).sort()).toEqual(['Fremdes Konzept', 'Leber Aktiv']);
  });
});
