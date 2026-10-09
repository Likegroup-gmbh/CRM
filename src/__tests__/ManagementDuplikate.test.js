import { describe, it, expect } from 'vitest';
import {
  zerlegeManagementName,
  managementKernname,
  findeNamensgleiche,
  normalisiereFeld,
  planeZusammenlegen
} from '../core/validation/ManagementDuplikate.js';

const m = (id, firmenname, extra = {}) => ({
  id,
  firmenname,
  created_at: '2025-01-01T00:00:00Z',
  ...extra
});

describe('Kernname', () => {
  it('Rechtsform, Gross/Klein, Leerzeichen und Satzzeichen fallen weg', () => {
    const kern = managementKernname('Company XY');
    expect(managementKernname('Company XY GmbH')).toBe(kern);
    expect(managementKernname('  company   xy  ')).toBe(kern);
    expect(managementKernname('Company-XY, GmbH')).toBe(kern);
    expect(managementKernname('COMPANY XY G.m.b.H.')).toBe(kern);
    expect(managementKernname('Company XY GmbH & Co. KG')).toBe(kern);
    expect(managementKernname('Company XY UG (haftungsbeschränkt)')).toBe(kern);
  });

  it('Management ist keine Rechtsform', () => {
    expect(managementKernname('Company XY Management')).not.toBe(managementKernname('Company XY'));
  });

  it('keine Tippfehler', () => {
    expect(managementKernname('Compny XY')).not.toBe(managementKernname('Company XY'));
  });

  it('Rechtsform nur als eigenes Wort am Ende', () => {
    expect(zerlegeManagementName('Mag').rechtsform).toBe(null);
    expect(zerlegeManagementName('Mag').kern).toBe('mag');
    expect(zerlegeManagementName('Hans AG').rechtsform).toBe('ag');
    expect(zerlegeManagementName('GmbH').kern).toBe('gmbh');
  });
});

describe('findeNamensgleiche', () => {
  const alle = [m('1', 'Company XY'), m('2', 'Andere Agentur'), m('3', 'Company XY Management')];

  it('findet GmbH-Variante, nicht die Management-Variante', () => {
    expect(findeNamensgleiche('Company XY GmbH', alle).map((x) => x.id)).toEqual(['1']);
  });

  it('schliesst die eigene ID aus', () => {
    expect(findeNamensgleiche('Company XY', alle, '1')).toEqual([]);
  });

  it('leerer Name trifft nichts', () => {
    expect(findeNamensgleiche('  ', alle)).toEqual([]);
  });
});

describe('Feldnormalisierung', () => {
  it('Mail nur anders geschrieben ist gleich', () => {
    expect(normalisiereFeld('email', ' Info@A.de ')).toBe(normalisiereFeld('email', 'info@a.de'));
  });
  it('Telefon ohne Leerzeichen und Striche', () => {
    expect(normalisiereFeld('telefonnummer', '+49 30 123-45')).toBe(normalisiereFeld('telefonnummer', '+493012345'));
  });
  it('Instagram ohne fuehrendes @', () => {
    expect(normalisiereFeld('instagram', '@agentur')).toBe(normalisiereFeld('instagram', 'agentur'));
  });
});

describe('planeZusammenlegen', () => {
  it('legt GmbH und Namen ohne Rechtsform zusammen und fuellt leere Felder', () => {
    const { zusammen, liegen } = planeZusammenlegen(
      [
        m('a', 'Company XY', { email: 'info@xy.de' }),
        m('b', 'Company XY GmbH', { telefonnummer: '030 1', created_at: '2025-02-01T00:00:00Z' })
      ],
      { a: 2, b: 0 }
    );
    expect(liegen).toEqual([]);
    expect(zusammen).toHaveLength(1);
    const g = zusammen[0];
    expect(g.behalte_id).toBe('a');
    expect(g.entfernen_ids).toEqual(['b']);
    expect(g.patch.telefonnummer).toBe('030 1');
    expect(g.patch.firmenname).toBe('Company XY GmbH');
    expect(g.name).toBe('Company XY GmbH');
  });

  it('zwei Mails: eine bleibt im Feld, die andere steht in der Notiz', () => {
    const { zusammen, liegen } = planeZusammenlegen(
      [
        m('a', 'Company XY', { email: 'a@xy.de', notiz: 'Alt' }),
        m('b', 'Company XY', { email: 'b@xy.de' }),
        m('c', 'Company XY', { email: 'c@xy.de' })
      ],
      { a: 2 }
    );
    expect(liegen).toEqual([]);
    expect(zusammen).toHaveLength(1);
    const g = zusammen[0];
    expect(g.patch.email).toBeUndefined(); // a@xy.de bleibt
    expect(g.zusatz.map((z) => z.wert)).toEqual(['b@xy.de', 'c@xy.de']);
    expect(g.patch.notiz).toBe(
      'Alt\n\nWeitere Angaben aus zusammengelegten Einträgen:\n- E-Mail: b@xy.de\n- E-Mail: c@xy.de'
    );
  });

  it('Schreibweisen derselben Adresse sind kein Konflikt (Straße, Köln/Cologne, Hausnummer im Strassenfeld)', () => {
    const { zusammen } = planeZusammenlegen(
      [
        m('a', 'Company XY', { strasse: 'Im Mediapark', stadt: 'Köln', land: 'Deutschland' }),
        m('b', 'Company XY', { strasse: 'Im MediaPark 6A', stadt: 'Cologne', land: 'Germany' })
      ],
      { a: 1 }
    );
    const g = zusammen[0];
    expect(g.zusatz).toEqual([]);
    expect(g.patch.strasse).toBe('Im MediaPark 6A');
    expect(g.patch.stadt).toBeUndefined();
    expect(g.patch.land).toBeUndefined();
  });

  it('Straße gegen Strasse und Str. ist gleich', () => {
    const { zusammen } = planeZusammenlegen([
      m('a', 'Company XY', { strasse: 'Köhlstraße' }),
      m('b', 'Company XY', { strasse: 'Koehlstrasse' }),
      m('c', 'Company XY', { strasse: 'Köhlstr.' })
    ]);
    expect(zusammen[0].zusatz.filter((z) => z.label === 'Weitere Adresse').length).toBe(1);
  });

  it('Vereinigtes Königreich ist United Kingdom', () => {
    const { zusammen } = planeZusammenlegen([
      m('a', 'HJ Partners LLP', { land: 'Vereinigtes Königreich' }),
      m('b', 'HJ Partners LLP', { land: 'UNITED KINGDOM' })
    ]);
    expect(zusammen[0].zusatz).toEqual([]);
  });

  it('echt verschiedene Adressen: die erste bleibt ganz, die andere steht in der Notiz', () => {
    const { zusammen, liegen } = planeZusammenlegen(
      [
        m('a', 'StudioHealth GmbH', { strasse: 'Sandstraße', hausnummer: '104', plz: '40789', stadt: 'Monheim am Rhein' }),
        m('b', 'StudioHealth GmbH', { strasse: 'Köhlstraße', hausnummer: '10b', plz: '50827', stadt: 'Köln', land: 'Deutschland' })
      ],
      { a: 1 }
    );
    expect(liegen).toEqual([]);
    const g = zusammen[0];
    // Keine Mischadresse: weder Land noch Stadt kommen von der anderen Adresse
    expect(g.patch.land).toBeUndefined();
    expect(g.patch.stadt).toBeUndefined();
    expect(g.zusatz).toEqual([{ label: 'Weitere Adresse', wert: 'Köhlstraße 10b, 50827 Köln, Deutschland' }]);
    expect(g.patch.notiz).toContain('- Weitere Adresse: Köhlstraße 10b, 50827 Köln, Deutschland');
  });

  it('gleiche Adresse nur einmal in der Notiz, auch bei mehreren Zeilen', () => {
    const { zusammen } = planeZusammenlegen([
      m('a', 'Studio One', { strasse: 'Sandstr.', plz: '40789' }),
      m('b', 'Studio One', { strasse: 'Köhlstr.', plz: '50827' }),
      m('c', 'Studio One', { strasse: 'Köhlstraße', plz: '50827' })
    ]);
    expect(zusammen[0].zusatz).toHaveLength(1);
  });

  it('leere Adressfelder werden gefüllt, wenn nichts widerspricht', () => {
    const { zusammen } = planeZusammenlegen(
      [m('a', 'Company XY', { strasse: 'Hauptstr.' }), m('b', 'Company XY', { stadt: 'Berlin', plz: '10115' })],
      { a: 1 }
    );
    expect(zusammen[0].patch).toMatchObject({ stadt: 'Berlin', plz: '10115' });
  });

  it('Instagram-URL und Handle sind dasselbe Profil', () => {
    const { zusammen } = planeZusammenlegen([
      m('a', 'Company XY', { instagram: '@josa.mgmt' }),
      m('b', 'Company XY', { instagram: 'https://www.instagram.com/josa.mgmt/' })
    ]);
    expect(zusammen[0].zusatz).toEqual([]);
  });

  it('Webseite mit und ohne https/www ist dieselbe', () => {
    const { zusammen } = planeZusammenlegen([
      m('a', 'Company XY', { webseite: 'https://www.xy.de/' }),
      m('b', 'Company XY', { webseite: 'xy.de' })
    ]);
    expect(zusammen[0].zusatz).toEqual([]);
  });

  it('Mail nur anders geschrieben ist kein Konflikt', () => {
    const { zusammen, liegen } = planeZusammenlegen([
      m('a', 'Company XY', { email: 'Info@xy.de' }),
      m('b', 'Company XY', { email: ' info@xy.de ' })
    ]);
    expect(liegen).toEqual([]);
    expect(zusammen).toHaveLength(1);
  });

  it('GmbH gegen AG ist ein Konflikt', () => {
    const { zusammen, liegen } = planeZusammenlegen([m('a', 'Company XY GmbH'), m('b', 'Company XY AG')]);
    expect(zusammen).toEqual([]);
    expect(liegen[0].grund).toBe('rechtsform');
  });

  it('GmbH gegen GmbH & Co. KG ist ein Konflikt', () => {
    const { liegen } = planeZusammenlegen([m('a', 'Company XY GmbH'), m('b', 'Company XY GmbH & Co. KG')]);
    expect(liegen[0].grund).toBe('rechtsform');
  });

  it('Company XY Management bleibt draussen', () => {
    const { zusammen, liegen } = planeZusammenlegen([m('a', 'Company XY'), m('b', 'Company XY Management')]);
    expect(zusammen).toEqual([]);
    expect(liegen).toEqual([]);
  });

  it('Notizen werden aneinandergehaengt, gleiche nur einmal', () => {
    const { zusammen } = planeZusammenlegen([
      m('a', 'Company XY', { notiz: 'Alt' }),
      m('b', 'Company XY', { notiz: 'Neu' }),
      m('c', 'Company XY', { notiz: 'Neu' })
    ]);
    expect(zusammen[0].patch.notiz).toBe('Alt\n\nNeu');
  });

  it('Notiz wird gefuellt, wenn nur der andere Datensatz eine hat', () => {
    const { zusammen } = planeZusammenlegen([
      m('a', 'Company XY'),
      m('b', 'Company XY', { notiz: 'Nur hier' })
    ], { a: 3 });
    expect(zusammen[0].patch.notiz).toBe('Nur hier');
  });

  it('behaelt den Datensatz mit den meisten Verknuepfungen', () => {
    const { zusammen } = planeZusammenlegen(
      [m('a', 'Company XY'), m('b', 'Company XY', { created_at: '2026-01-01T00:00:00Z' })],
      { a: 1, b: 5 }
    );
    expect(zusammen[0].behalte_id).toBe('b');
    expect(zusammen[0].entfernen_ids).toEqual(['a']);
  });

  it('Gleichstand: der aeltere bleibt', () => {
    const { zusammen } = planeZusammenlegen(
      [
        m('neu', 'Company XY', { created_at: '2026-06-01T00:00:00Z' }),
        m('alt', 'Company XY', { created_at: '2024-01-01T00:00:00Z' })
      ],
      { neu: 2, alt: 2 }
    );
    expect(zusammen[0].behalte_id).toBe('alt');
  });

  it('einzelne Namen erzeugen keine Gruppe', () => {
    const { zusammen, liegen } = planeZusammenlegen([m('a', 'Eins'), m('b', 'Zwei')]);
    expect(zusammen).toEqual([]);
    expect(liegen).toEqual([]);
  });
});
