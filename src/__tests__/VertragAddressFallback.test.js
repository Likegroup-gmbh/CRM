import { describe, expect, it } from 'vitest';
import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/SearchableSelects.js';

const creatorWithoutAddress = {
  id: 'creator-1',
  vorname: 'Max',
  nachname: 'Creator',
  lieferadresse_strasse: '',
  lieferadresse_hausnummer: '',
  lieferadresse_plz: '',
  lieferadresse_stadt: '',
  lieferadresse_land: ''
};

const creatorWithAddress = {
  ...creatorWithoutAddress,
  lieferadresse_strasse: 'Creatorstrasse',
  lieferadresse_hausnummer: '12',
  lieferadresse_plz: '60314',
  lieferadresse_stadt: 'Frankfurt',
  lieferadresse_land: 'Deutschland'
};

const agencyAddress = {
  influencer_agentur_vertreten: true,
  influencer_agentur_name: 'Creator Agency GmbH',
  influencer_agentur_strasse: 'Agenturweg',
  influencer_agentur_hausnummer: '7',
  influencer_agentur_plz: '10115',
  influencer_agentur_stadt: 'Berlin',
  influencer_agentur_land: 'Deutschland'
};

describe('Vertrag Creator-Adressfallback', () => {
  it('nutzt die Creator-Adresse, wenn sie vollständig ist', () => {
    const form = new VertraegeCreate();

    const resolved = form.getResolvedCreatorContractAddress(creatorWithAddress, agencyAddress);

    expect(resolved).toMatchObject({
      source: 'creator',
      strasse: 'Creatorstrasse',
      hausnummer: '12',
      plz: '60314',
      stadt: 'Frankfurt'
    });
  });

  it('nutzt die Agentur-Adresse, wenn die Creator-Adresse fehlt', () => {
    const form = new VertraegeCreate();

    const resolved = form.getResolvedCreatorContractAddress(creatorWithoutAddress, agencyAddress);

    expect(resolved).toMatchObject({
      source: 'agentur',
      name: 'Creator Agency GmbH',
      strasse: 'Agenturweg',
      hausnummer: '7',
      plz: '10115',
      stadt: 'Berlin'
    });
  });

  it('liefert keine Vertragsadresse, wenn Creator und Agentur unvollständig sind', () => {
    const form = new VertraegeCreate();

    const resolved = form.getResolvedCreatorContractAddress(creatorWithoutAddress, {
      ...agencyAddress,
      influencer_agentur_plz: ''
    });

    expect(resolved).toBeNull();
  });

  it('rendert einen Hinweis, wenn die Agentur-Adresse als Fallback verwendet wird', () => {
    const form = new VertraegeCreate();
    form.formData = agencyAddress;

    const html = form.renderCreatorAddressPreview(creatorWithoutAddress);

    expect(html).toContain('contract-address-fallback');
    expect(html).toContain('Agentur-Adresse verwendet');
    expect(form.creatorAddressMissing).toBe(true);
  });
});
