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
    expect(mapped.kampagnenanzahl).toBe(1);
  });

  it('mapKampagnen uebernimmt Volumen und faellt bei Altbestand auf den Nettobetrag zurueck', () => {
    const mapped = loader.mapKampagnen(
      [{ id: 'k1', videoanzahl: 9, creatoranzahl: 3 }],
      { nettobetrag: 50000 }
    );
    expect(mapped).toEqual([
      { id: 'k1', kampagnen_nummer: 1, eigener_name: null, volumen: 50000, videoanzahl: 9, creatoranzahl: 3, campaign_blocks: [] }
    ]);
  });

  it('mapKampagnen uebernimmt eigener_name', () => {
    const mapped = loader.mapKampagnen(
      [{ id: 'k1', kampagnen_nummer: 1, volumen: 20000, eigener_name: 'Launch Q1' }],
      { nettobetrag: 20000 }
    );
    expect(mapped[0].eigener_name).toBe('Launch Q1');
  });

  it('gruppiert Blocks nach kampagne_id und haengt Altbestand ohne ID an die erste Kampagne', () => {
    const mapped = loader.mapKampagnen(
      [
        { id: 'k1', kampagnen_nummer: 1, volumen: 20000, videoanzahl: 0, creatoranzahl: 0 },
        { id: 'k2', kampagnen_nummer: 2, volumen: 30000, videoanzahl: 0, creatoranzahl: 0 }
      ],
      { nettobetrag: 50000 },
      [
        { id: 'b-unassigned', kampagne_id: null, campaign_type: 'ugc_paid', video_anzahl: 2, creator_anzahl: 1 },
        { id: 'b-k2', kampagne_id: 'k2', campaign_type: 'influencer', video_anzahl: 5, creator_anzahl: 2 }
      ]
    );

    expect(mapped[0].campaign_blocks.map(b => b.campaign_type)).toEqual(['ugc_paid']);
    expect(mapped[0].videoanzahl).toBe(2);
    expect(mapped[1].campaign_blocks.map(b => b.campaign_type)).toEqual(['influencer']);
    expect(mapped[1].videoanzahl).toBe(5);
  });
});
