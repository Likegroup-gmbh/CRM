import { describe, expect, it } from 'vitest';
import {
  addressComplete,
  applyVertretenDurch,
  legacyFreitextName,
  matchManagement,
  matchPerson,
  pendingPersonComplete,
  preselectManagementId,
  preselectPersonId,
  vertretungGiltFuer,
  vertretungLuecken,
  vertretenDurchPayload
} from '../modules/vertrag/create/managementVertretung.js';

const managements = [
  { id: 'x', firmenname: 'Talent X' },
  { id: 'y', firmenname: 'Talent Y GmbH' }
];

describe('Management-Vertretung', () => {
  it('gilt für UGC, Influencer Kooperation und Contracting', () => {
    expect(vertretungGiltFuer('UGC')).toBe(true);
    expect(vertretungGiltFuer('Influencer Kooperation')).toBe(true);
    expect(vertretungGiltFuer('Contracting')).toBe(true);
    expect(vertretungGiltFuer('Videograph')).toBe(false);
    expect(vertretungGiltFuer('Model')).toBe(false);
  });

  it('wählt nur bei genau einem Management des Creators vor', () => {
    expect(preselectManagementId([{ id: 'x' }])).toBe('x');
    expect(preselectManagementId([])).toBe(null);
    expect(preselectManagementId([{ id: 'x' }, { id: 'y' }])).toBe(null);
  });

  it('trifft einen Namen exakt und zeigt ähnliche ohne zu blockieren', () => {
    expect(matchManagement('talent x', managements).exact.id).toBe('x');
    expect(matchManagement('Talent', managements).exact).toBe(null);
    expect(matchManagement('Talent', managements).similar.map((item) => item.id)).toEqual(['x', 'y']);
    expect(matchManagement('T', managements).similar).toEqual([]);
  });

  it('braucht Straße, PLZ und Stadt', () => {
    expect(addressComplete({ strasse: 'Weg', plz: '10115', stadt: 'Berlin' })).toBe(true);
    expect(addressComplete({ strasse: 'Weg', plz: '', stadt: 'Berlin' })).toBe(false);
  });

  it('wählt die einzige Betreuung dieses Managements vor', () => {
    const people = [{ id: 'b' }, { id: 'd' }];
    expect(preselectPersonId(people, ['d', 'fremd'])).toBe('d');
    expect(preselectPersonId(people, ['b', 'd'])).toBe(null);
    expect(preselectPersonId(people, [])).toBe(null);
  });

  it('erkennt dieselbe Person am Namen', () => {
    const people = [{ id: 'd', vorname: 'Dana', nachname: 'Kurz', email: 'd@talent.de' }];
    expect(matchPerson('dana', 'kurz', people).exact.id).toBe('d');
    expect(matchPerson('Dan', 'Kurz', people).exact).toBe(null);
    expect(matchPerson('Dan', 'Kurz', people).similar.map((item) => item.id)).toEqual(['d']);
  });

  it('meldet Adresse und Ansprechpartner zusammen', () => {
    expect(vertretungLuecken({
      managementId: 'x',
      address: { strasse: '', plz: '', stadt: '' },
      person: { vorname: '', nachname: '', email: '', telefon: '' }
    })).toEqual([
      'Straße, PLZ und Stadt am Management fehlen.',
      'Ansprechpartner wählen oder mit Vorname, Nachname und E-Mail anlegen.'
    ]);
  });

  it('lässt einen vollständigen neuen Ansprechpartner durch', () => {
    const person = { vorname: 'Dana', nachname: 'Kurz', email: 'd@talent.de', telefon: '' };
    expect(pendingPersonComplete(person)).toBe(true);
    expect(vertretungLuecken({
      managementId: 'x',
      address: { strasse: 'Weg', plz: '1', stadt: 'Berlin' },
      person
    })).toEqual([]);
  });

  it('verlangt die E-Mail an einer vorhandenen Person', () => {
    expect(vertretungLuecken({
      managementId: 'x',
      address: { strasse: 'Weg', plz: '1', stadt: 'Berlin' },
      ansprechpartnerId: 'd',
      personHasEmail: false,
      person: { vorname: '', nachname: '', email: '', telefon: '' }
    })).toEqual(['Dem Ansprechpartner fehlt die E-Mail.']);
  });

  it('blockiert Freitext ohne Stammdaten-Management', () => {
    expect(legacyFreitextName({
      influencer_agentur_vertreten: true,
      influencer_agentur_name: 'Alte Agentur'
    })).toBe('Alte Agentur');
    expect(vertretungLuecken({
      legacyName: 'Alte Agentur',
      person: {}
    })).toEqual(['Management aus den Stammdaten wählen oder neu anlegen.']);
  });

  it('ohne Management gibt es keine Lücke', () => {
    expect(vertretungLuecken({ person: {} })).toEqual([]);
  });

  it('merkt die noch nicht angelegte Person für den Entwurf', () => {
    const payload = vertretenDurchPayload({
      _management_id: 'x',
      _vertretung_vorname: 'Dana',
      _vertretung_nachname: 'Kurz',
      _vertretung_email: 'd@talent.de',
      _vertretung_telefon: '0170'
    });
    expect(payload.ansprechpartner_id).toBe(null);
    expect(applyVertretenDurch({}, payload)._vertretung_telefon).toBe('0170');
  });
});
