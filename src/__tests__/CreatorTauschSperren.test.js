import { describe, it, expect } from 'vitest';
import {
  ersatzSperre,
  datenSperre,
  tauschGrundText,
  tauschFehlerKey,
  TAUSCH_GRUENDE
} from '../modules/creator-tausch/creatorTauschSperren.js';

const alt = { id: 'a', creator_auswahl_id: 'L1', creator_id: 'c1' };
const gut = {
  id: 'b', creator_auswahl_id: 'L1', creator_id: 'c2', prio_1: true, zusage: true
};

describe('ersatzSperre', () => {
  it('laesst einen Ersatz mit erfuellten Gates durch', () => {
    expect(ersatzSperre(alt, gut)).toBeNull();
    expect(ersatzSperre(alt, { ...gut, prio_1: false, prio_2: true, zusage: false, gebucht: true })).toBeNull();
  });

  it('sperrt denselben Eintrag und andere Listen', () => {
    expect(ersatzSperre(alt, { ...gut, id: 'a' })).toBe('gleicher_eintrag');
    expect(ersatzSperre(alt, { ...gut, creator_auswahl_id: 'L2' })).toBe('andere_liste');
  });

  it('sperrt fehlende oder gleiche Creator', () => {
    expect(ersatzSperre({ ...alt, creator_id: null }, gut)).toBe('alter_ohne_creator');
    expect(ersatzSperre(alt, { ...gut, creator_id: null })).toBe('ersatz_ohne_creator');
    expect(ersatzSperre(alt, { ...gut, creator_id: 'c1' })).toBe('gleicher_creator');
  });

  it('sperrt abgesagte Ersatz-Eintraege', () => {
    expect(ersatzSperre(alt, { ...gut, absage: true })).toBe('ersatz_abgesagt');
  });

  it('sperrt ohne Prio oder ohne Zusage/Gebucht (ADR 0018)', () => {
    expect(ersatzSperre(alt, { ...gut, prio_1: false })).toBe('ersatz_gate');
    expect(ersatzSperre(alt, { ...gut, zusage: false })).toBe('ersatz_gate');
  });
});

describe('datenSperre', () => {
  it('ist ohne Daten frei', () => {
    expect(datenSperre({})).toBeNull();
    expect(datenSperre({ vertraege: [], rechnungen: [], videos: [] })).toBeNull();
  });

  it('sperrt bei unterschriebenem Vertrag, nicht bei offenem', () => {
    expect(datenSperre({ vertraege: [{ status: 'gesendet' }, { status: 'abgelehnt' }] })).toBeNull();
    expect(datenSperre({ vertraege: [{ status: 'unterschrieben' }] })).toBe('vertrag_unterschrieben');
    expect(datenSperre({ vertraege: [{ status: 'erstellt', dropbox_file_url: 'x' }] })).toBe('vertrag_unterschrieben');
    expect(datenSperre({ vertraege: [{ status: 'gesendet', unterschriebener_vertrag_url: 'y' }] })).toBe('vertrag_unterschrieben');
  });

  it('sperrt bei Rechnung', () => {
    expect(datenSperre({ rechnungen: [{ id: 'r' }] })).toBe('rechnung');
  });

  it('sperrt bei hochgeladenem Video, nicht bei leerem Asset', () => {
    expect(datenSperre({ videos: [{ asset_url: '' }, { asset_url: null }] })).toBeNull();
    expect(datenSperre({ videos: [{ asset_url: 'https://dropbox/x' }] })).toBe('upload');
  });

  it('nennt zuerst den Vertrag, dann Rechnung, dann Upload', () => {
    const alle = {
      vertraege: [{ status: 'unterschrieben' }], rechnungen: [{}], videos: [{ asset_url: 'x' }]
    };
    expect(datenSperre(alle)).toBe('vertrag_unterschrieben');
    expect(datenSperre({ ...alle, vertraege: [] })).toBe('rechnung');
  });
});

describe('Texte und Fehler', () => {
  it('hat zu jedem Grund einen Text', () => {
    for (const key of Object.keys(TAUSCH_GRUENDE)) {
      expect(tauschGrundText(key).length).toBeGreaterThan(5);
    }
    expect(tauschGrundText('unbekannt')).toMatch(/nicht m/i);
  });

  it('liest den Grund aus der RPC-Exception', () => {
    expect(tauschFehlerKey({ message: 'tausch_gesperrt:rechnung' })).toBe('rechnung');
    expect(tauschFehlerKey({ message: 'irgendwas' })).toBeNull();
    expect(tauschFehlerKey(null)).toBeNull();
  });
});
