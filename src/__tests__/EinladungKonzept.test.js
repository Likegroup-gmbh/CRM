// EinladungKonzept.test.js
// Konzept-Einladung (ADR 0059): Allowlist, Auslöser, Creator ohne Mail.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pruefeEinreichung } from '../../supabase/functions/einladung/felder.ts';
import {
  KONZEPT_PFLICHT,
  KONZEPT_TEXTFELDER,
  KONZEPT_URLFELDER,
  bereinigeKonzept
} from '../../supabase/functions/einladung/felder.ts';
import { KONZEPT_PFLICHT as SHEET_PFLICHT, konzeptFeldNamen } from '../modules/einladung/konzeptSheet.js';
import { konzeptEinladbar, konzeptEinladungKontext } from '../modules/einladung/kundeEinladen.js';
import {
  KonzeptEinladungDrawer,
  istKonzeptMail,
  konzeptMailziel,
  konzeptNachricht
} from '../modules/einladung/KonzeptEinladungDrawer.js';

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

  describe('Allowlist', () => {
    it('Formular und Edge Function kennen dieselben Felder', () => {
      const edge = [...KONZEPT_TEXTFELDER, ...KONZEPT_URLFELDER].sort();
      expect(konzeptFeldNamen().sort()).toEqual(edge);
      expect([...SHEET_PFLICHT].sort()).toEqual([...KONZEPT_PFLICHT].sort());
    });

    it('verwirft fremde Felder und Nicht-Links', () => {
      const { formData } = bereinigeKonzept({ ...sheet, tkp: 5, creator_auswahl_item_id: 'x', foo: 1 });
      expect(Object.keys(formData).sort()).not.toContain('tkp');
      expect(formData.creator_auswahl_item_id).toBeUndefined();
      expect(formData.foo).toBeUndefined();
      expect(formData.eigenes_video_url).toBe('https://tiktok.com/@a/video/1');
      expect(formData.referenz_video_url).toBeUndefined();
    });

    it('prüft die Pflichtfelder Idee, Hook und Ablauf', () => {
      expect(pruefeEinreichung('konzept', { idee: 'Eine Idee', hook: 'Ein Hook' })).toBeTruthy();
      expect(pruefeEinreichung('konzept', { idee: 'Eine Idee', hook: 'Ein Hook', ablauf: 'Ablauf' })).toBeNull();
    });
  });

  describe('Auslöser', () => {
    it('Casting-Eintrag ist nur einladbar, wenn er nicht abgesagt oder abgelehnt ist', () => {
      expect(konzeptEinladbar({ id: 'a' })).toBe(true);
      expect(konzeptEinladbar({ id: 'a', abgelehnt: true })).toBe(false);
      expect(konzeptEinladbar({ id: 'a', absage: true })).toBe(false);
      expect(konzeptEinladbar({ id: 'a', nicht_umsetzen: true })).toBe(false);
      expect(konzeptEinladbar({ id: 'a', kategorie: 'Nicht umsetzen' })).toBe(false);
      expect(konzeptEinladbar({ id: 'a', isVorschlag: true })).toBe(false);
    });

    it('Kontext zählt übersprungene Einträge, ohne einladbare gibt es keinen', () => {
      expect(konzeptEinladungKontext({ items: [{ id: 'a', absage: true }] })).toBeNull();
      expect(konzeptEinladungKontext({ items: [{ id: 'a' }, { id: 'b', abgelehnt: true }], kontextName: 'Casting 1' }))
        .toMatchObject({ art: 'konzept', itemIds: ['a'], uebersprungen: 1, kontextName: 'Casting 1' });
    });

    it('Mailziel: Creator-Mail, sonst aktives Management, sonst keins', () => {
      expect(konzeptMailziel({ mail: ' Mia@Test.de ' })).toBe('mia@test.de');
      expect(konzeptMailziel({
        mail: '',
        creator_management: [
          { ist_aktiv: false, management: { email: 'alt@agentur.de' } },
          { ist_aktiv: true, management: { email: 'Neu@Agentur.de' } }
        ]
      })).toBe('neu@agentur.de');
      // Mail im Casting-Eintrag (Spalte „E-Mail“) gewinnt, auch ohne Creator in der DB.
      expect(konzeptMailziel(null, ' Ivo@Test.de ')).toBe('ivo@test.de');
      expect(konzeptMailziel({ mail: 'mia@test.de' }, 'ivo@test.de')).toBe('ivo@test.de');
      // Ungültiger Eintrag-Text fällt auf den Creator zurück.
      expect(konzeptMailziel({ mail: 'mia@test.de' }, 'kein mail')).toBe('mia@test.de');
      expect(konzeptMailziel({ mail: null, creator_management: [] })).toBeNull();
      expect(konzeptMailziel(null)).toBeNull();
    });
  });

  describe('Creator ohne Mail im Drawer', () => {
    const fertig = () => new Promise((resolve) => setTimeout(resolve, 0));

    function mockDb(eintraege) {
      const invoke = vi.fn(async () => ({
        data: {
          einladungen: eintraege.map((e) => ({
            creatorAuswahlItemId: e.id, name: e.name, einladungId: `e-${e.id}`,
            link: `https://crm.test/einladung/${e.id}`, code: '123456', mailAn: null, gesendet: false
          }))
        },
        error: null
      }));
      window.supabase = {
        from: (tabelle) => {
          const kette = {
            select: () => kette, in: () => kette, eq: () => kette, is: () => kette,
            then: (resolve) => resolve({ data: tabelle === 'einladung' ? [] : eintraege, error: null })
          };
          return kette;
        },
        functions: { invoke }
      };
      window.isInternal = () => true;
      window.toastSystem = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
      return invoke;
    }

    const eintraege = [
      { id: 'c1', name: 'Mia Muster', creator: { mail: 'mia@test.de', creator_management: [] } },
      { id: 'c2', name: 'Insta Ivo', creator: null }
    ];

    beforeEach(() => { document.body.innerHTML = ''; });

    it('prüft Adressen wie die Edge Function, leer ist erlaubt', () => {
      expect(istKonzeptMail('')).toBe(true);
      expect(istKonzeptMail('  ivo@test.de ')).toBe(true);
      expect(istKonzeptMail('ivo@test')).toBe(false);
      expect(istKonzeptMail('kein mail')).toBe(false);
    });

    it('baut eine DM mit Vorname, Link und Code', () => {
      const text = konzeptNachricht({ name: 'Insta Ivo', link: 'https://crm.test/einladung/x', code: '654321' });
      expect(text).toContain('Hi Insta!');
      expect(text).toContain('https://crm.test/einladung/x');
      expect(text).toContain('Dein Code: 654321');
      expect(konzeptNachricht({ name: '', link: 'l', code: 'c' }).startsWith('Hi!')).toBe(true);
    });

    it('zeigt ein Mail-Feld nur bei Einträgen ohne Adresse und schickt sie mit', async () => {
      const invoke = mockDb(eintraege);
      const drawer = new KonzeptEinladungDrawer();
      drawer.open({ art: 'konzept', itemIds: ['c1', 'c2'] });
      await fertig();
      await fertig();

      expect(document.querySelector('[data-eintrag-id="c1"] [data-mail-override]')).toBeNull();
      const feld = document.querySelector('[data-eintrag-id="c2"] [data-mail-override]');
      expect(feld).not.toBeNull();
      expect(document.getElementById('konzept-einladung-submit').textContent).toBe('Einladungen erstellen und senden');

      feld.value = 'ivo@test.de';
      feld.dispatchEvent(new Event('input'));
      document.getElementById('konzept-einladung-submit').click();
      await fertig();
      await fertig();

      expect(invoke.mock.calls[0][1].body).toMatchObject({
        action: 'create', art: 'konzept', creatorAuswahlItemIds: ['c1', 'c2'], mailAdressen: { c2: 'ivo@test.de' }
      });
      expect(document.querySelector('#konzept-einladung-ergebnis').hidden).toBe(false);
      expect(document.querySelector('#konzept-einladung-ergebnis').textContent).toContain('Nachricht kopieren');
    });

    it('sendet bei ungültiger Adresse nichts', async () => {
      const invoke = mockDb(eintraege);
      const drawer = new KonzeptEinladungDrawer();
      drawer.open({ art: 'konzept', itemIds: ['c1', 'c2'] });
      await fertig();
      await fertig();
      const feld = document.querySelector('[data-eintrag-id="c2"] [data-mail-override]');
      feld.value = 'ivo@test';
      feld.dispatchEvent(new Event('input'));
      document.getElementById('konzept-einladung-submit').click();
      await fertig();
      expect(invoke).not.toHaveBeenCalled();
      expect(window.toastSystem.warning).toHaveBeenCalled();
    });
  });
});
