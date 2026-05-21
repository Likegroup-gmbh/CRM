import { describe, expect, it } from 'vitest';
import { ProjektErstellenEditLoader } from '../modules/projekt-erstellen/services/ProjektErstellenEditLoader.js';

describe('ProjektErstellenEditLoader', () => {
  const loader = new ProjektErstellenEditLoader();

  it('mapAuftrag übernimmt anzahl_teilrechnungen aus der Datenbank', () => {
    const mapped = loader.mapAuftrag({
      id: 'auftrag-1',
      titel: 'Test',
      anzahl_teilrechnungen: 4
    });

    expect(mapped.anzahl_teilrechnungen).toBe(4);
  });

  it('mapAuftrag setzt Default 1 wenn anzahl_teilrechnungen fehlt', () => {
    const mapped = loader.mapAuftrag({
      id: 'auftrag-1',
      titel: 'Test'
    });

    expect(mapped.anzahl_teilrechnungen).toBe(1);
  });
});
