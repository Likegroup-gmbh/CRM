import { describe, it, expect, afterEach } from 'vitest';
import {
  eindeutigerCreator,
  findCreatorByInstagram,
  verknuepfungenFuerItems,
  verknuepfungsText
} from '../modules/creator-auswahl/castingCreatorVerknuepfung.js';

const max = {
  id: '8c29bfd0-a62e-444a-a2e8-2800ec1eef29',
  vorname: 'Maximilian',
  nachname: 'Becker',
  instagram: 'https://www.instagram.com/blackm2.g87/'
};

const zeile = {
  id: '667f2719-f9ac-48b4-8eb4-f5fbb5ca8fd2',
  name: 'Max',
  link_instagram: 'https://www.instagram.com/blackm2.g87/',
  creator_id: null,
  prio_1: true,
  zusage: true
};

describe('eindeutigerCreator', () => {
  it('trifft die volle Instagram-URL ueber den Handle', () => {
    expect(eindeutigerCreator([max], 'blackm2.g87')?.id).toBe(max.id);
    expect(eindeutigerCreator([max], 'https://www.instagram.com/blackm2.g87/')?.id).toBe(max.id);
  });

  it('verknuepft nicht, wenn zwei Creator denselben Handle haben', () => {
    expect(eindeutigerCreator([max, { ...max, id: 'andere' }], 'blackm2.g87')).toBeNull();
  });
});

describe('verknuepfungenFuerItems', () => {
  it('verknuepft Max, obwohl die Zeile nur den Namen und die URL traegt', () => {
    expect(verknuepfungenFuerItems([zeile], [max])).toEqual([{
      itemId: zeile.id,
      creatorId: max.id,
      name: 'Maximilian Becker'
    }]);
  });

  it('laesst eine Zeile mit creator_id und einen schon vergebenen Creator stehen', () => {
    expect(verknuepfungenFuerItems([{ ...zeile, creator_id: 'schon' }], [max])).toEqual([]);
    expect(verknuepfungenFuerItems(
      [{ id: 'andere', creator_id: max.id, link_instagram: null }, zeile],
      [max]
    )).toEqual([]);
  });

  it('nimmt bei zwei offenen Zeilen nur die erste', () => {
    const links = verknuepfungenFuerItems(
      [zeile, { ...zeile, id: 'zweite' }],
      [max]
    );
    expect(links.map(link => link.itemId)).toEqual([zeile.id]);
  });
});

describe('verknuepfungsText', () => {
  it('nennt den Creator, und bei mehreren nur die Anzahl', () => {
    expect(verknuepfungsText([{ name: 'Maximilian Becker' }]))
      .toBe('Maximilian Becker ist schon in der Datenbank und wurde verknüpft');
    expect(verknuepfungsText([{ name: 'A' }, { name: 'B' }]))
      .toBe('2 Creator waren schon in der Datenbank und wurden verknüpft');
    expect(verknuepfungsText([])).toBe('');
  });
});

describe('findCreatorByInstagram', () => {
  afterEach(() => {
    delete window.supabase;
  });

  it('sucht den Handle in der URL und nicht als exakten Feldwert', async () => {
    let pattern = '';
    window.supabase = {
      from: () => ({
        select: () => ({
          ilike: (_column, value) => {
            pattern = value;
            return {
              limit: async () => ({ data: [max], error: null })
            };
          }
        })
      })
    };

    const gefunden = await findCreatorByInstagram('https://www.instagram.com/blackm2.g87/');
    expect(pattern).toBe('%blackm2.g87%');
    expect(gefunden.id).toBe(max.id);
  });
});
