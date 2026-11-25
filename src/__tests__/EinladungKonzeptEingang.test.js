// EinladungKonzeptEingang.test.js
// Konzept-Einladung (ADR 0059): Eingang, Anlegen als Konzept, Creator-Sheet-Block.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { reviewUrl } from '../modules/einladung/einreichungService.js';
import { mountEinreichungInbox } from '../modules/einladung/EinreichungInbox.js';
import { konzeptSheetBloecke } from '../modules/einladung/konzeptSheet.js';
import { konzeptEinreichungFilter } from '../modules/einladung/konzeptEinreichungen.js';
import { buildKonzeptItemInsert } from '../modules/strategie/KonzeptEinreichungDrawer.js';

const ID = '11111111-1111-1111-1111-111111111111';

describe('Konzept-Einladung (ADR 0059)', () => {
  const sheet = {
    arbeitstitel: 'Morgenroutine',
    idee: 'Ich zeige meine Morgenroutine mit dem Serum.',
    hook: 'Drei Dinge, die ich morgens nie weglasse.',
    ablauf: '1. Aufstehen\n2. Serum\n3. Fazit mit CTA',
    marke_integration: 'Serum im Bad',
    eigenes_video_url: 'https://tiktok.com/@a/video/1',
    referenz_video_url: 'javascript:alert(1)',
    alternative_idee: 'Abendroutine'
  };

  const konzeptEinreichung = (extra = {}) => ({
    id: ID,
    absender_name: 'Mia',
    created_at: '2026-10-01T10:00:00Z',
    payload: { formData: sheet },
    einladung: {
      art: 'konzept',
      briefing_id: 'b1',
      creator_auswahl_item_id: 'ci1',
      briefing: { aktivierung_name: 'Linie A', produktion_id: 'p1' },
      ...extra
    }
  });

  describe('Eingang', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
      window.isInternal = () => true;
    });

    function fakeEinreichungen(zeilen) {
      const filter = [];
      window.supabase = {
        from: () => {
          const kette = {
            select: () => kette,
            eq: (s, w) => { filter.push(['eq', s, w]); return kette; },
            in: (s, w) => { filter.push(['in', s, w]); return kette; },
            order: () => kette,
            then: (resolve) => resolve({ data: zeilen, error: null })
          };
          return kette;
        }
      };
      return filter;
    }

    it('Filter: gewählte Linie, ohne Workflow oder Linien nichts', () => {
      const detail = { mode: 'workflow', linien: [{ id: 'b1' }, { id: 'b2' }], linieId: 'b1', linieAlle: false };
      expect(konzeptEinreichungFilter(detail)).toEqual({ briefingId: 'b1' });
      expect(konzeptEinreichungFilter({ ...detail, mode: 'entwurf' })).toBeNull();
      expect(konzeptEinreichungFilter({ mode: 'workflow', linien: [] })).toBeNull();
    });

    it('zeigt Idee und Zähler am Tab Konzepte und ruft onPruefen statt der Vollseite', async () => {
      const filter = fakeEinreichungen([konzeptEinreichung()]);
      document.body.innerHTML = '<button data-workflow-tab="konzepte">Konzepte</button><div id="host"></div>';
      const host = document.getElementById('host');
      const onPruefen = vi.fn();
      window.navigateTo = vi.fn();

      await mountEinreichungInbox({ art: 'konzept', host, filter: { briefingId: 'b1' }, tabBadge: true, onPruefen });

      expect(filter).toContainEqual(['eq', 'einladung.art', 'konzept']);
      expect(filter).toContainEqual(['eq', 'einladung.briefing_id', 'b1']);
      expect(host.querySelector('table.data-table')).not.toBeNull();
      expect([...host.querySelectorAll('th')].map((th) => th.textContent)).toEqual(
        ['Titel', 'Idee', 'Hook', 'Creator', 'Eingereicht', 'Aktionen']
      );
      expect(host.querySelector('.table-link').textContent).toBe('Morgenroutine');
      expect(host.textContent).toContain('Mia');
      expect(document.querySelector('[data-workflow-tab="konzepte"] [data-einreichung-count]').textContent).toBe('1');

      host.querySelector('[data-einreichung-pruefen]').click();
      expect(onPruefen).toHaveBeenCalledTimes(1);
      expect(onPruefen.mock.calls[0][0].id).toBe(ID);
      expect(window.navigateTo).not.toHaveBeenCalled();
    });

    it('bei „Alle Linien“ filtert die Liste nach allen Linien, ohne Linien bleibt sie leer', async () => {
      const filter = fakeEinreichungen([konzeptEinreichung()]);
      document.body.innerHTML = '<div id="host"></div>';
      const host = document.getElementById('host');
      await mountEinreichungInbox({ art: 'konzept', host, filter: { briefingIds: ['b1', 'b2'] } });
      expect(filter).toContainEqual(['in', 'einladung.briefing_id', ['b1', 'b2']]);

      // Bei „Alle Linien“ nennt die Tabelle die Linie der Idee.
      expect([...host.querySelectorAll('th')].map((th) => th.textContent)).toContain('Linie');
      expect(host.textContent).toContain('Linie A');

      await mountEinreichungInbox({ art: 'konzept', host, filter: { briefingIds: [] } });
      expect(host.hidden).toBe(true);
    });

    it('ohne Ideen zeigt leerHtml statt den Host zu verbergen und der Zähler im Switch verschwindet', async () => {
      fakeEinreichungen([]);
      document.body.innerHTML = '<span data-ideen-zaehler>3</span><div id="host"></div>';
      const host = document.getElementById('host');
      await mountEinreichungInbox({
        art: 'konzept', host, filter: { briefingId: 'b1' }, tabBadge: true, leerHtml: '<p>Keine offenen Ideen</p>'
      });
      expect(host.hidden).toBe(false);
      expect(host.textContent).toContain('Keine offenen Ideen');
      expect(document.querySelector('[data-ideen-zaehler]').style.display).toBe('none');
    });

    it('Zähler im Switch zeigt die Anzahl offener Ideen', async () => {
      fakeEinreichungen([konzeptEinreichung()]);
      document.body.innerHTML = '<span data-ideen-zaehler style="display:none"></span><div id="host"></div>';
      await mountEinreichungInbox({ art: 'konzept', host: document.getElementById('host'), filter: { briefingId: 'b1' }, tabBadge: true });
      const zaehler = document.querySelector('[data-ideen-zaehler]');
      expect(zaehler.textContent).toBe('1');
      expect(zaehler.style.display).toBe('');
    });

    it('weist auf einen entfallenen Casting-Eintrag hin', async () => {
      fakeEinreichungen([konzeptEinreichung({ creator_auswahl_item_id: null })]);
      document.body.innerHTML = '<div id="host"></div>';
      const host = document.getElementById('host');
      await mountEinreichungInbox({ art: 'konzept', host, filter: { briefingId: 'b1' }, onPruefen: vi.fn() });
      expect(host.textContent).toContain('Eintrag nicht mehr im Casting');
    });

    it('Prüfen und Verwerfen hängen an der Tabellenzeile', async () => {
      fakeEinreichungen([konzeptEinreichung()]);
      document.body.innerHTML = '<div id="host"></div>';
      const host = document.getElementById('host');
      await mountEinreichungInbox({ art: 'konzept', host, filter: { briefingId: 'b1' }, onPruefen: vi.fn() });
      const zeile = host.querySelector('tbody tr[data-einreichung-id]');
      expect(zeile.dataset.einreichungId).toBe(ID);
      expect(zeile.querySelector('[data-einreichung-pruefen]')).not.toBeNull();
      expect(zeile.querySelector('[data-einreichung-verwerfen]')).not.toBeNull();
    });

    it('Review-Link führt auf den Konzepte-Tab der Produktion', () => {
      expect(reviewUrl(konzeptEinreichung())).toBe('/produktion/p1?tab=konzepte');
    });
  });

  describe('Anlegen', () => {
    const eingabe = {
      titel: 'Morgenroutine',
      kurzbeschreibung: 'Ich zeige meine Morgenroutine.',
      hook: 'Drei Dinge morgens',
      ablauf: '1. Aufstehen\n2. Serum',
      eintragId: 'ci1',
      kategorie: 'Routine',
      funnelStufe: null,
      personaId: null,
      produktId: null,
      videolaenge: null
    };

    it('mappt Idee, Titel, Hook und Ablauf und hängt Casting-Eintrag und Einreichung an', () => {
      const insert = buildKonzeptItemInsert({ strategieId: 's1', sortierung: 4, eingabe, einreichungId: ID });
      expect(insert).toMatchObject({
        strategie_id: 's1',
        sortierung: 4,
        kurzbeschreibung: 'Ich zeige meine Morgenroutine.',
        teilbereich: 'Routine',
        video_link: null,
        plattform: null,
        verarbeitung_status: null,
        creator_auswahl_item_id: 'ci1',
        einreichung_id: ID,
        beschreibung_quelle: 'user'
      });
      expect(insert.beschreibung_struktur).toMatchObject({
        titel: 'Morgenroutine',
        hook: 'Drei Dinge morgens',
        hauptteil: '1. Aufstehen\n2. Serum'
      });
      expect(insert.beschreibung).toContain('Drei Dinge morgens');
    });

    it('ohne Casting-Eintrag bleibt die Zuordnung leer', () => {
      const insert = buildKonzeptItemInsert({ strategieId: 's1', sortierung: 0, eingabe: { ...eingabe, eintragId: null }, einreichungId: ID });
      expect(insert.creator_auswahl_item_id).toBeNull();
    });
  });

  describe('Creator-Sheet-Block', () => {
    it('zeigt nur gefüllte Felder in PDF-Reihenfolge, Links als Links', () => {
      const bloecke = konzeptSheetBloecke(sheet);
      expect(bloecke.map((b) => b.nr)).toEqual(['01', '02', '03', '04', '']);
      expect(bloecke[0].eintraege.map((e) => e.label)).toEqual(['Arbeitstitel', 'Deine Idee']);
      const beispiele = bloecke.at(-1).eintraege;
      expect(beispiele.find((e) => e.link)?.wert).toBe('https://tiktok.com/@a/video/1');
    });

    it('leeres Sheet ergibt keine Blöcke', () => {
      expect(konzeptSheetBloecke({})).toEqual([]);
      expect(konzeptSheetBloecke(null)).toEqual([]);
    });
  });
});
