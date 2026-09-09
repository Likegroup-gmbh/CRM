import { describe, expect, it } from 'vitest';
import {
  EHG_UNTERNEHMEN_ID,
  ehgCreatorAnzeige,
  ehgKampagneAnzeige,
  ehgMarkeProduktAnzeige,
  isEhgKunde,
  mappedEhgKonzeption,
  mappedEhgLieferbestandteile
} from '../modules/vertrag/create/EhgVertragGating.js';
import { expandEhgFelder } from '../modules/vertrag/create/paragraphZusatz.js';
import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/EhgVertragGating.js';
import '../modules/vertrag/create/RenderShell.js';

describe('isEhgKunde', () => {
  const unternehmen = [
    { id: EHG_UNTERNEHMEN_ID, firmenname: 'EHG GmbH & Co. KG' },
    { id: 'other', firmenname: 'EHG Consulting GmbH' },
    { id: 'named', firmenname: 'EHG GmbH & Co. KG' }
  ];

  it('erkennt die feste Unternehmens-ID', () => {
    expect(isEhgKunde(unternehmen, EHG_UNTERNEHMEN_ID)).toBe(true);
  });

  it('erkennt den exakten Firmennamen unabhängig von der ID', () => {
    expect(isEhgKunde(unternehmen, 'named')).toBe(true);
  });

  it('lehnt Teilstring-Treffer wie EHG Consulting ab', () => {
    expect(isEhgKunde(unternehmen, 'other')).toBe(false);
  });

  it('lehnt fehlende Auswahl ab', () => {
    expect(isEhgKunde(unternehmen, '')).toBe(false);
  });
});

describe('EHG-Feld-Mapping', () => {
  it('mappt Konzeption aus den UGC-Radios', () => {
    expect(mappedEhgKonzeption('skript_fertig')).toEqual(['skript_gestellt']);
    expect(mappedEhgKonzeption('briefing_direkt')).toEqual(['umsetzung_briefing']);
    expect(mappedEhgKonzeption('briefing_skript')).toEqual(['creator_konzeption']);
    expect(mappedEhgKonzeption('eigenstaendig')).toEqual(['creator_konzeption']);
    expect(mappedEhgKonzeption(null)).toEqual([]);
  });

  it('mappt Lieferbestandteile und ergänzt Thumbnail', () => {
    expect(mappedEhgLieferbestandteile({
      lieferung_art: 'fertig_geschnitten',
      untertitel: true
    }, { lieferbestandteile: ['thumbnail'] })).toEqual([
      'finaler_schnitt',
      'untertitel',
      'thumbnail'
    ]);
  });

  it('expandiert ehg_felder zurück in Formularfelder', () => {
    const flat = expandEhgFelder({ marke_id: 'm-1', nutzungen: ['website'] });
    expect(flat.ehg_marke_id).toBe('m-1');
    expect(flat.ehg_nutzungen).toEqual(['website']);
  });

  it('spiegelt Kampagne, Creator und Marke/Produkt für die Anzeige', () => {
    expect(ehgKampagneAnzeige({ kampagnenname: 'EF UGC Q3' })).toBe('EF UGC Q3');
    expect(ehgCreatorAnzeige({ vorname: 'Anna', nachname: 'Creator', instagram: 'anna_ef' }, (v) => v)).toBe('Anna Creator @anna_ef');
    expect(ehgMarkeProduktAnzeige({ marke_name: 'ernsting\'s family', produkt_name: 'Basic Tee' })).toBe('ernsting\'s family / Basic Tee');
  });
});

describe('EHG-Projektblatt-Kopf', () => {
  it('zeigt Kampagne und Creator readonly und Marke/Ansprechpartner als Select', () => {
    const inst = new VertraegeCreate();
    inst.selectedTyp = 'UGC';
    inst.unternehmen = [{ id: 'u1', firmenname: 'EHG GmbH & Co. KG' }];
    inst.kampagnen = [{ id: 'k-1', kampagnenname: 'EF UGC Q3', marke: { id: 'm-1', markenname: 'ernsting\'s family' } }];
    inst.creators = [{ id: 'c-1', vorname: 'Anna', nachname: 'Creator', instagram: 'anna_ef' }];
    inst.ehgMarken = [{ id: 'm-1', markenname: 'ernsting\'s family' }];
    inst.ehgProdukte = [{ id: 'p-1', name: 'Basic Tee', marken: [{ marke_id: 'm-1' }] }];
    inst.ehgMitarbeiter = [{ id: 'u-lisa', name: 'Lisa PM' }];
    inst.formData = {
      kunde_unternehmen_id: 'u1',
      kampagne_id: 'k-1',
      creator_id: 'c-1',
      ehg_marke_id: 'm-1'
    };
    inst._extractHandle = (v) => String(v || '').replace(/^@/, '');

    const html = inst.renderEhgSection(2);
    expect(html).toContain('id="ehg_projekt_anzeige"');
    expect(html).toContain('readonly');
    expect(html).toContain('EF UGC Q3');
    expect(html).toContain('Anna Creator @anna_ef');
    expect(html).toContain('name="ehg_marke_id"');
    expect(html).toContain('name="ehg_produkt_id"');
    expect(html).toContain('name="ehg_ansprechpartner_id"');
    expect(html).toContain('Lisa PM');
    expect(html).not.toContain('name="ehg_projekt"');
    expect(html).not.toContain('name="ehg_creator_handle"');
  });
});

describe('Submit-Config', () => {
  it('bietet bei EHG Alter Vertrag plus EHG-Vertrag, ohne Neuer Vertrag', () => {
    const inst = new VertraegeCreate();
    inst.selectedTyp = 'UGC';
    inst.unternehmen = [{ id: 'u1', firmenname: 'EHG GmbH & Co. KG' }];
    inst.formData = { kunde_unternehmen_id: 'u1' };
    expect(inst.getSubmitConfigId()).toBe('ugc-contract-submit-ehg');
  });

  it('bleibt für andere UGC-Kunden beim Standard-Split', () => {
    const inst = new VertraegeCreate();
    inst.selectedTyp = 'UGC';
    inst.unternehmen = [{ id: 'u2', firmenname: 'Andere GmbH' }];
    inst.formData = { kunde_unternehmen_id: 'u2' };
    expect(inst.getSubmitConfigId()).toBe('ugc-contract-submit');
  });
});
