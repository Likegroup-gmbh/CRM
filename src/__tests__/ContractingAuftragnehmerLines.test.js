import { describe, expect, it } from 'vitest';
import { buildContractingAuftragnehmerLines } from '../modules/vertrag/create/pdf/ContractingAuftragnehmerLines.js';

const creator = {
  vorname: 'Leonie',
  nachname: 'Weiß',
  lieferadresse_strasse: 'Imstiege',
  lieferadresse_hausnummer: '24',
  lieferadresse_plz: '48455',
  lieferadresse_stadt: 'Bad Bentheim',
  lieferadresse_land: 'Deutschland'
};

const creatorAddress = {
  source: 'creator',
  strasse: 'Imstiege',
  hausnummer: '24',
  plz: '48455',
  stadt: 'Bad Bentheim',
  land: 'Deutschland'
};

const managementAddress = {
  source: 'management',
  strasse: 'Köhlstraße',
  hausnummer: '10b',
  plz: '50827',
  stadt: 'Köln',
  land: 'Deutschland'
};

const vertragMitAgentur = {
  nur_management_adresse: false,
  influencer_agentur_vertreten: true,
  influencer_agentur_name: 'ALL IMPACT GmbH',
  influencer_agentur_strasse: 'Köhlstraße',
  influencer_agentur_hausnummer: '10b',
  influencer_agentur_plz: '50827',
  influencer_agentur_stadt: 'Köln',
  influencer_agentur_land: 'Deutschland'
};

describe('buildContractingAuftragnehmerLines', () => {
  it('Toggle AUS + Agentur: Influencer-Name+Adresse und Agenturname+Agenturadresse', () => {
    const lines = buildContractingAuftragnehmerLines({
      vertrag: vertragMitAgentur,
      creator,
      address: creatorAddress
    });

    expect(lines).toEqual([
      'Name: Leonie Weiß',
      'Imstiege 24',
      '48455 Bad Bentheim',
      'Deutschland',
      '',
      'Vertreten durch Agentur: ALL IMPACT GmbH',
      'Köhlstraße 10b',
      '50827 Köln',
      'Deutschland'
    ]);
    expect(lines.join('\n')).not.toContain('Für Influencer');
  });

  it('Toggle AUS ohne Agentur: Creator-Name + Creator-Adresse', () => {
    const lines = buildContractingAuftragnehmerLines({
      vertrag: {
        nur_management_adresse: false,
        influencer_agentur_vertreten: false
      },
      creator,
      address: creatorAddress
    });

    expect(lines).toEqual([
      'Name: Leonie Weiß',
      'Imstiege 24',
      '48455 Bad Bentheim',
      'Deutschland'
    ]);
  });

  it('Toggle AN: Agentur-Label, Adresse, Influencer-Zeile', () => {
    const lines = buildContractingAuftragnehmerLines({
      vertrag: {
        ...vertragMitAgentur,
        nur_management_adresse: true,
        influencer_agentur_vertretung: 'Max Manager'
      },
      creator,
      address: managementAddress
    });

    expect(lines).toEqual([
      'Agentur: ALL IMPACT GmbH',
      'Köhlstraße 10b',
      '50827 Köln',
      'Deutschland',
      'Vertreten durch: Max Manager',
      'Influencer: Leonie Weiß'
    ]);
  });

  it('Toggle AN ohne Vertreten-durch: Zeile weglassen', () => {
    const lines = buildContractingAuftragnehmerLines({
      vertrag: {
        ...vertragMitAgentur,
        nur_management_adresse: true,
        influencer_agentur_vertretung: ''
      },
      creator,
      address: managementAddress
    });

    expect(lines).toEqual([
      'Agentur: ALL IMPACT GmbH',
      'Köhlstraße 10b',
      '50827 Köln',
      'Deutschland',
      'Influencer: Leonie Weiß'
    ]);
    expect(lines.some((l) => l.startsWith('Vertreten durch'))).toBe(false);
  });

  it('Toggle AUS: Agentur wird auch ohne Vertretung-Flag gezeigt, wenn Agenturdaten vorhanden sind', () => {
    const lines = buildContractingAuftragnehmerLines({
      vertrag: {
        nur_management_adresse: false,
        influencer_agentur_vertreten: false,
        influencer_agentur_name: 'ALL IMPACT GmbH',
        influencer_agentur_strasse: 'Köhlstraße',
        influencer_agentur_hausnummer: '10b',
        influencer_agentur_plz: '50827',
        influencer_agentur_stadt: 'Köln',
        influencer_agentur_land: 'Deutschland'
      },
      creator,
      address: creatorAddress
    });

    expect(lines[0]).toBe('Name: Leonie Weiß');
    expect(lines).toContain('Imstiege 24');
    expect(lines).toContain('48455 Bad Bentheim');
    expect(lines).toContain('Vertreten durch Agentur: ALL IMPACT GmbH');
    expect(lines).toContain('Köhlstraße 10b');
    expect(lines).toContain('50827 Köln');
    expect(lines.some((l) => l.startsWith('Influencer:'))).toBe(false);
  });

  it('Toggle AN ohne Vertretung-Flag: nutzt Agenturdaten trotzdem', () => {
    const lines = buildContractingAuftragnehmerLines({
      vertrag: {
        ...vertragMitAgentur,
        nur_management_adresse: true,
        influencer_agentur_vertreten: false
      },
      creator,
      address: managementAddress
    });

    expect(lines[0]).toBe('Agentur: ALL IMPACT GmbH');
    expect(lines).toContain('Influencer: Leonie Weiß');
  });
});
