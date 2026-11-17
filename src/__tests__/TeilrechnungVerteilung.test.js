import { describe, expect, it } from 'vitest';
import { verteilungsHinweis, verteilungsStand } from '../core/budget/teilrechnungVerteilung.js';

const NINJA_TRS = [
  { nettobetrag: 644978.39, rechnung_gestellt_am: '2026-10-31' },
  { nettobetrag: 617813.7, rechnung_gestellt_am: null }
];

describe('verteilungsStand', () => {
  it('ist ausgeglichen, wenn die Teilrechnungen das Netto ergeben', () => {
    const stand = verteilungsStand(1262792.09, NINJA_TRS);
    expect(stand).toMatchObject({ verteilt: 1262792.09, offen: 0, ueberschuss: 0, anzahl: 2 });
  });

  it('weist den nicht verteilten Rest aus (Ninja Q4)', () => {
    const stand = verteilungsStand(1322900.84, NINJA_TRS);
    expect(stand.offen).toBe(60108.75);
    expect(stand.ueberschuss).toBe(0);
    expect(stand.prozent).toBeCloseTo(95.456, 2);
  });

  it('weist einen Ueberschuss aus, wenn die Teilrechnungen mehr ergeben', () => {
    const stand = verteilungsStand(1000, [{ nettobetrag: 700 }, { nettobetrag: '500' }]);
    expect(stand).toMatchObject({ verteilt: 1200, offen: 0, ueberschuss: 200 });
  });

  it('ignoriert Rundungsdifferenzen bis 5 Cent', () => {
    const stand = verteilungsStand(1000, [{ nettobetrag: 333.33 }, { nettobetrag: 333.33 }, { nettobetrag: 333.33 }]);
    expect(stand.offen).toBe(0);
    expect(stand.ueberschuss).toBe(0);
  });

  it('zaehlt gestellte Teilrechnungen ueber Datum oder Flag', () => {
    const stand = verteilungsStand(3000, [
      { nettobetrag: 1000, rechnung_gestellt_am: '2026-01-01' },
      { nettobetrag: 1000, rechnung_gestellt: true },
      { nettobetrag: 1000 }
    ]);
    expect(stand.gestelltAnzahl).toBe(2);
    expect(stand.gestellt).toBe(2000);
  });
});

describe('verteilungsHinweis', () => {
  it('zeigt Prozent, verteilten Betrag und Rest', () => {
    const hinweis = verteilungsHinweis(verteilungsStand(1322900.84, NINJA_TRS));
    expect(hinweis.ton).toBe('info');
    expect(hinweis.text).toBe(
      '95,5 % (1.262.792,09 €) auf Teilrechnungen verteilt · 60.108,75 € noch offen · davon 1 von 2 gestellt (644.978,39 €)'
    );
  });

  it('zeigt einen kleinen Rest nicht als 100 %', () => {
    const hinweis = verteilungsHinweis(verteilungsStand(100000, [{ nettobetrag: 99990 }]));
    expect(hinweis.text).toMatch(/^99,9 % /);
  });

  it('meldet 100 %, wenn alles verteilt ist', () => {
    const hinweis = verteilungsHinweis(verteilungsStand(1000, [{ nettobetrag: 1000 }]));
    expect(hinweis.text).toBe('100 % auf Teilrechnungen verteilt');
  });

  it('warnt bei Ueberschuss', () => {
    const hinweis = verteilungsHinweis(verteilungsStand(1000, [{ nettobetrag: 1200 }]));
    expect(hinweis).toEqual({ ton: 'warnung', text: 'Teilrechnungen übersteigen das Angebotsnetto um 200,00 €' });
  });

  it('schweigt ohne Netto oder ohne Teilrechnungen', () => {
    expect(verteilungsHinweis(verteilungsStand(0, [{ nettobetrag: 100 }]))).toBeNull();
    expect(verteilungsHinweis(verteilungsStand(1000, []))).toBeNull();
  });
});
