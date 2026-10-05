import { describe, it, expect } from 'vitest';
import { DataPreparer } from '../core/data/DataPreparer.js';
import { EntityRegistry } from '../core/data/entities/index.js';

// Diese Felder werden von Formularen ueber createEntity/updateEntity gespeichert.
// Fehlen sie in der Registry, verwirft der DataPreparer sie stillschweigend.
describe('Registry kennt Formularfelder (DataPreparer verwirft sie nicht)', () => {
  const preparer = new DataPreparer();

  it('creator.hauptadresse_quelle', async () => {
    const result = await preparer.prepareDataForSupabase(
      { hauptadresse_quelle: 'management' },
      EntityRegistry.creator.fields,
      'creator'
    );
    expect(result.hauptadresse_quelle).toBe('management');
  });

  it('rechnung.ist_schlussrechnung', async () => {
    const result = await preparer.prepareDataForSupabase(
      { ist_schlussrechnung: true },
      EntityRegistry.rechnung.fields,
      'rechnung'
    );
    expect(result.ist_schlussrechnung).toBe(true);
  });

  it.each(['auftrag_details', 'auftragsdetails'])('%s.abrechnung_hinweis', async (entityType) => {
    const result = await preparer.prepareDataForSupabase(
      { abrechnung_hinweis: 'Bitte PO angeben' },
      EntityRegistry[entityType].fields,
      entityType
    );
    expect(result.abrechnung_hinweis).toBe('Bitte PO angeben');
  });
});
