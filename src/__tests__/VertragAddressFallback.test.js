import { describe, expect, it } from 'vitest';
import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/SearchableSelects.js';
import '../modules/vertrag/create/CreatorAddressResolver.js';

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

const managementAddress = {
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

    const resolved = form.getResolvedCreatorContractAddress(creatorWithAddress, managementAddress);

    expect(resolved).toMatchObject({
      source: 'creator',
      strasse: 'Creatorstrasse',
      hausnummer: '12',
      plz: '60314',
      stadt: 'Frankfurt'
    });
  });

  it('nutzt die Management-Adresse, wenn die Creator-Adresse fehlt', () => {
    const form = new VertraegeCreate();

    const resolved = form.getResolvedCreatorContractAddress(creatorWithoutAddress, managementAddress);

    expect(resolved).toMatchObject({
      source: 'management',
      name: 'Creator Agency GmbH',
      strasse: 'Agenturweg',
      hausnummer: '7',
      plz: '10115',
      stadt: 'Berlin'
    });
  });

  it('liefert keine Vertragsadresse, wenn Creator und Management unvollständig sind', () => {
    const form = new VertraegeCreate();

    const resolved = form.getResolvedCreatorContractAddress(creatorWithoutAddress, {
      ...managementAddress,
      influencer_agentur_plz: ''
    });

    expect(resolved).toBeNull();
  });

  it('rendert einen Hinweis, wenn die Management-Adresse als Fallback verwendet wird', () => {
    const form = new VertraegeCreate();
    form.formData = managementAddress;

    const html = form.renderCreatorAddressPreview(creatorWithoutAddress);

    expect(html).toContain('contract-address-fallback');
    expect(html).toContain('Management-Adresse verwendet');
    expect(form.creatorAddressMissing).toBe(true);
  });

  it('erzwingt die Management-Adresse, wenn "nur_management_adresse" aktiv ist (Creator-Adresse ignoriert)', () => {
    const form = new VertraegeCreate();

    const resolved = form.getResolvedCreatorContractAddress(creatorWithAddress, {
      ...managementAddress,
      nur_management_adresse: true
    });

    expect(resolved).toMatchObject({
      source: 'management',
      strasse: 'Agenturweg',
      plz: '10115',
      stadt: 'Berlin'
    });
  });

  it('liefert null, wenn "nur_management_adresse" aktiv ist aber das Management keine gültige Adresse hat', () => {
    const form = new VertraegeCreate();

    const resolved = form.getResolvedCreatorContractAddress(creatorWithAddress, {
      ...managementAddress,
      nur_management_adresse: true,
      influencer_agentur_plz: ''
    });

    expect(resolved).toBeNull();
  });

  it('rendert einen klaren Hinweis, wenn nur die Management-Adresse verwendet wird', () => {
    const form = new VertraegeCreate();
    form.formData = { ...managementAddress, nur_management_adresse: true };

    const html = form.renderCreatorAddressPreview(creatorWithAddress);

    expect(html).toContain('ausschliesslich die Management-Adresse');
  });
});

describe('Vertrag Mehrfach-Management', () => {
  const managements = [
    { id: 'm1', firmenname: 'Agentur Eins', strasse: 'Weg 1', hausnummer: '1', plz: '10115', stadt: 'Berlin', land: 'Deutschland' },
    { id: 'm2', firmenname: 'Agentur Zwei', strasse: 'Weg 2', hausnummer: '2', plz: '80331', stadt: 'München', land: 'Deutschland' }
  ];

  it('übernimmt das gewählte Management in die influencer_agentur_*-Felder', () => {
    const form = new VertraegeCreate();
    form.creatorManagements = managements;
    form.creators = [];

    form._applySelectedManagement('m2');

    expect(form.formData.influencer_agentur_vertreten).toBe(true);
    expect(form.formData.influencer_agentur_name).toBe('Agentur Zwei');
    expect(form.formData.influencer_agentur_stadt).toBe('München');
    expect(form.formData._management_id).toBe('m2');
  });

  it('selectVertragManagement wechselt die Auswahl und aktualisiert die Adresse', () => {
    const form = new VertraegeCreate();
    form.creatorManagements = managements;
    form.creators = [];
    form.formData.creator_id = null;

    form.selectVertragManagement('m1');
    expect(form.formData._management_id).toBe('m1');
    expect(form.formData.influencer_agentur_plz).toBe('10115');

    form.selectVertragManagement('m2');
    expect(form.formData._management_id).toBe('m2');
    expect(form.formData.influencer_agentur_plz).toBe('80331');
  });
});
