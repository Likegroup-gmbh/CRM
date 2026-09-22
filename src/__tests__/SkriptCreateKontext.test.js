import { describe, it, expect } from 'vitest';
import { pickProduktId, resolveSkriptCreatePayload } from '../modules/skripte/skriptCreateKontext.js';

function item(overrides = {}) {
  return {
    id: 'si-1',
    beschreibung: '  Glow Routine  ',
    creator_auswahl_item_id: 'ce-1',
    casting_eintrag: { id: 'ce-1', persona_id: 'p1', name: 'Anna' },
    strategie: {
      id: 'st-1',
      name: 'Sommer',
      unternehmen_id: 'u1',
      marke_id: 'm1',
      kampagne_id: 'k1',
      briefing_id: 'br-1',
      unternehmen: { id: 'u1', firmenname: 'Hautica', branche_id: 'b-u' },
      marke: { id: 'm1', markenname: 'Glow', branche_id: 'b-m' },
      kampagne: { id: 'k1', kampagnenname: 'Q3' },
      briefing: { id: 'br-1', aktivierung_name: 'Sommer', bereich: 'owned_social' }
    },
    ...overrides
  };
}

describe('pickProduktId', () => {
  it('0 oder leer → null', () => {
    expect(pickProduktId([])).toBeNull();
    expect(pickProduktId(null)).toBeNull();
    expect(pickProduktId([null, ''])).toBeNull();
  });

  it('genau eins → diese id', () => {
    expect(pickProduktId(['pr-1'])).toBe('pr-1');
    expect(pickProduktId(['pr-1', 'pr-1'])).toBe('pr-1');
  });

  it('n → null', () => {
    expect(pickProduktId(['pr-1', 'pr-2'])).toBeNull();
  });
});

describe('resolveSkriptCreatePayload', () => {
  it('zieht Unternehmen, Marke, Kampagne, Briefing, Bereich aus dem Konzept', () => {
    const payload = resolveSkriptCreatePayload(item());
    expect(payload.unternehmen_id).toBe('u1');
    expect(payload.marke_id).toBe('m1');
    expect(payload.kampagne_id).toBe('k1');
    expect(payload.briefing_id).toBe('br-1');
    expect(payload.bereich).toBe('owned_social');
    expect(payload.strategie_item_id).toBe('si-1');
    expect(payload.video_idee).toBe('Glow Routine');
    expect(payload.mit_dna).toBe(false);
    expect(payload.briefing.bereich).toBe('owned_social');
  });

  it('Branche: Marke vor Unternehmen', () => {
    expect(resolveSkriptCreatePayload(item()).branche_id).toBe('b-m');
    const ohneMarkeBranche = item();
    ohneMarkeBranche.strategie.marke.branche_id = null;
    expect(resolveSkriptCreatePayload(ohneMarkeBranche).branche_id).toBe('b-u');
  });

  it('Persona vom Casting-Eintrag, sonst null', () => {
    expect(resolveSkriptCreatePayload(item()).persona_id).toBe('p1');
    expect(resolveSkriptCreatePayload(item({ casting_eintrag: { id: 'ce-1' } })).persona_id).toBeNull();
  });

  it('Produkt 0/1/n', () => {
    expect(resolveSkriptCreatePayload(item(), { produktIds: [] }).produkt_id).toBeNull();
    expect(resolveSkriptCreatePayload(item(), { produktIds: ['pr-1'] }).produkt_id).toBe('pr-1');
    expect(resolveSkriptCreatePayload(item(), { produktIds: ['pr-1', 'pr-2'] }).produkt_id).toBeNull();
  });

  it('leeres Item bleibt null-sicher', () => {
    const payload = resolveSkriptCreatePayload(null);
    expect(payload.unternehmen_id).toBeNull();
    expect(payload.strategie_item_id).toBeNull();
    expect(payload.video_idee).toBeNull();
  });
});
