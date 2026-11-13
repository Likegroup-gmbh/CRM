import { describe, it, expect } from 'vitest';
import {
  leseMasterlisteLinks,
  eintragAusFormular,
  prefillOhneDatensatz,
  quickAddText,
  teileHandlesAuf,
  verknuepfbareMember
} from '../modules/creator/masterliste.js';

const crmMember = { memberId: 'm-1', hatDatensatz: true, igUsername: '', creator: { id: 'cr-1', instagram: 'https://instagram.com/ada' } };
const offenerMember = { memberId: 'm-2', hatDatensatz: false, igUsername: 'lina.k', creator: { id: null, instagram: 'lina.k' } };

describe('leseMasterlisteLinks', () => {
  it('liest mehrere Links mit gemischten Trennern', () => {
    const { handles, ungueltig } = leseMasterlisteLinks(
      'https://www.instagram.com/Ada/ instagram.com/lina.k?igsh=abc,\nhttps://instagram.com/max_m;'
    );
    expect(handles).toEqual(['ada', 'lina.k', 'max_m']);
    expect(ungueltig).toEqual([]);
  });

  it('nimmt jeden Handle nur einmal', () => {
    const { handles } = leseMasterlisteLinks('https://instagram.com/ada https://www.instagram.com/ADA/');
    expect(handles).toEqual(['ada']);
  });

  it('lehnt Reels, Posts und TikTok ab', () => {
    const { handles, ungueltig } = leseMasterlisteLinks([
      'https://www.instagram.com/reel/DABC123/',
      'https://www.instagram.com/p/XYZ/',
      'https://www.tiktok.com/@ada',
      'hallo',
      'https://instagram.com/ok'
    ].join(' '));
    expect(handles).toEqual(['ok']);
    expect(ungueltig).toHaveLength(4);
  });

  it('liefert für leere Eingabe nichts', () => {
    expect(leseMasterlisteLinks('  ')).toEqual({ handles: [], ungueltig: [] });
  });
});

describe('teileHandlesAuf', () => {
  const creators = [
    { id: 'cr-1', instagram: 'ada' },
    { id: 'cr-2', instagram: 'https://www.instagram.com/max_m/' },
    { id: 'cr-3', instagram: 'doppelt' },
    { id: 'cr-4', instagram: '@doppelt' }
  ];

  it('trennt Bestand, Stammdaten-Treffer und neue Handles', () => {
    const result = teileHandlesAuf(['ada', 'lina.k', 'max_m', 'neu', 'doppelt'], [crmMember, offenerMember], creators);
    expect(result.schonDabei).toEqual(['ada', 'lina.k']);
    expect(result.crmTreffer.map(t => [t.handle, t.creator.id])).toEqual([['max_m', 'cr-2']]);
    expect(result.neu).toEqual(['neu', 'doppelt']);
  });

  it('zählt einen Creator, der schon auf der Liste steht, als schon dabei', () => {
    const member = { memberId: 'm-9', hatDatensatz: true, igUsername: '', creator: { id: 'cr-2', instagram: '' } };
    expect(teileHandlesAuf(['max_m'], [member], creators).schonDabei).toEqual(['max_m']);
  });
});

describe('verknuepfbareMember', () => {
  it('verknüpft offene Einträge mit eindeutigem Creator, der noch fehlt', () => {
    const creators = [{ id: 'cr-7', instagram: 'lina.k' }];
    expect(verknuepfbareMember([crmMember, offenerMember], creators)).toEqual([{ memberId: 'm-2', creatorId: 'cr-7' }]);
  });

  it('lässt Einträge stehen, deren Creator schon auf der Liste ist', () => {
    const creators = [{ id: 'cr-1', instagram: 'lina.k' }];
    expect(verknuepfbareMember([crmMember, offenerMember], creators)).toEqual([]);
  });
});

describe('quickAddText', () => {
  it('fasst das Ergebnis zusammen', () => {
    expect(quickAddText({ hinzugefuegt: 3, verknuepft: 1, schonDabei: 2 }))
      .toBe('3 hinzugefügt, davon 1 aus den Stammdaten verknüpft, 2 schon auf der Liste');
    expect(quickAddText({ hinzugefuegt: 1, ungueltig: 1 })).toBe('1 hinzugefügt, 1 kein Instagram-Profil');
    expect(quickAddText({ schonDabei: 1 })).toBe('Dieser Creator steht schon auf der Liste');
  });
});

describe('prefillOhneDatensatz', () => {
  it('füllt das Creator-Formular aus dem Pool', () => {
    const prefill = prefillOhneDatensatz({
      igUsername: 'lina.k',
      pool: { name: 'Lina Kraus', email: 'lina@example.com', follower_instagram: 48000, wohnort: 'Graz', profile_image_url: 'https://cdn.example.com/l.jpg' }
    });
    expect(prefill).toEqual({
      vorname: 'Lina',
      nachname: 'Kraus',
      mail: 'lina@example.com',
      telefonnummer: '',
      instagram: 'lina.k',
      instagram_follower: '25000-50000',
      tiktok: '',
      tiktok_follower: '',
      lieferadresse_stadt: 'Graz',
      profilbild_url: 'https://cdn.example.com/l.jpg'
    });
  });

  it('nimmt von Hand eingetragene Werte vor dem Pool', () => {
    const prefill = prefillOhneDatensatz({
      igUsername: '',
      eigen: {
        name: 'Anna Maria Berg',
        email: 'anna@example.com',
        link_tiktok: 'https://www.tiktok.com/@anna.b',
        follower_tiktok: 12000,
        wohnort: 'Wien'
      },
      pool: null
    });
    expect(prefill).toMatchObject({
      vorname: 'Anna',
      nachname: 'Maria Berg',
      mail: 'anna@example.com',
      tiktok: 'anna.b',
      tiktok_follower: '10000-25000',
      lieferadresse_stadt: 'Wien'
    });
  });
});

describe('eintragAusFormular', () => {
  const erlaubteTypen = ['Influencer', 'Model'];

  it('verlangt Creator Art und Name', () => {
    expect(eintragAusFormular({ typ: '', name: 'Ada' }, { erlaubteTypen }).fehler).toBe('Bitte Creator Art und Name ausfüllen');
    expect(eintragAusFormular({ typ: 'Influencer', name: ' ' }, { erlaubteTypen }).fehler).toBe('Bitte Creator Art und Name ausfüllen');
    expect(eintragAusFormular({ typ: 'Hexe', name: 'Ada' }, { erlaubteTypen }).fehler).toBe('Ungültige Creator Art');
  });

  it('legt einen Eintrag ohne Instagram an', () => {
    const ergebnis = eintragAusFormular({
      typ: 'Model',
      name: ' Ada Lovelace ',
      link_instagram: '',
      follower_instagram: '',
      link_tiktok: '@Ada.L',
      follower_tiktok: '50.000',
      wohnort: 'Wien',
      email: '',
      telefon: '+43 1'
    }, { erlaubteTypen });
    expect(ergebnis.handle).toBeNull();
    expect(ergebnis.werte).toEqual({
      name: 'Ada Lovelace',
      typ: 'Model',
      follower_instagram: null,
      link_tiktok: 'https://www.tiktok.com/@ada.l',
      follower_tiktok: 50000,
      wohnort: 'Wien',
      email: null,
      telefon: '+43 1'
    });
  });

  it('liest den Instagram-Handle und lehnt Reels ab', () => {
    expect(eintragAusFormular({ typ: 'Influencer', name: 'Ada', link_instagram: 'https://www.instagram.com/Ada/' }, { erlaubteTypen }).handle).toBe('ada');
    expect(eintragAusFormular({ typ: 'Influencer', name: 'Ada', link_instagram: 'https://www.instagram.com/reel/XYZ/' }, { erlaubteTypen }).fehler)
      .toContain('Profil-Link');
  });
});
