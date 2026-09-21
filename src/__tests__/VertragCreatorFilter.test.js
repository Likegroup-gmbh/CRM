import { describe, it, expect } from 'vitest';
import { vertragCreatorIds } from '../modules/vertrag/create/vertragCreatorFilter.js';

describe('vertragCreatorIds', () => {
  it('nimmt Zusage und Gebucht nur mit creator_id', () => {
    expect(vertragCreatorIds([
      { creator_id: 'c-zusage', zusage: true },
      { creator_id: 'c-gebucht', gebucht: true }
    ])).toEqual(['c-zusage', 'c-gebucht']);
  });

  it('laesst preis_zugesagt, Absage und Eintraege ohne creator_id raus', () => {
    expect(vertragCreatorIds([
      { creator_id: 'c-preis', preis_zugesagt: true },
      { creator_id: 'c-absage', absage: true },
      { zusage: true },
      { gebucht: true, creator_id: null }
    ])).toEqual([]);
  });

  it('vereinigt Casting mit Kooperationen und dedupliziert', () => {
    expect(vertragCreatorIds(
      [{ creator_id: 'c-cast', zusage: true }],
      [{ creator_id: 'c-koop' }, { creator_id: 'c-cast' }, { creator_id: null }]
    )).toEqual(['c-cast', 'c-koop']);
  });
});
