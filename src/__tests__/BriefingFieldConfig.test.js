// BriefingFieldConfig.test.js
// Guard: das Formular fragt genau das Creator-Briefing-PDF ab (ADR 0073).

import { describe, it, expect } from 'vitest';
import {
  BEREICH_OPTIONS,
  FLOW_STEPS,
  SEKTIONEN,
  getStepsForBereich,
  getAllFields,
  inhaltsFelder,
  feldNachName,
  flattenFields,
  optionWert
} from '../modules/briefing/create/fieldConfig.js';
import { ALTFELD_NAMEN } from '../modules/briefing/briefingAltfelder.js';

const namenIn = (stepId) => FLOW_STEPS
  .find(s => s.id === stepId)
  .sections
  .flatMap(s => flattenFields(s.fields).map(f => f.name));

describe('Briefing fieldConfig Schema', () => {
  it('hat genau die drei Typen Paid, Organic, Influencer', () => {
    expect(BEREICH_OPTIONS.map(b => b.value)).toEqual([
      'paid_creator_ads',
      'owned_social',
      'influencer_marketing'
    ]);
    expect(BEREICH_OPTIONS.map(b => b.label)).toEqual(['Paid', 'Organic', 'Influencer']);
  });

  it('alle Feldnamen sind eindeutig', () => {
    const names = inhaltsFelder().map(f => f.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it('Schritte sind die drei PDF-Sektionen, für jeden Typ gleich', () => {
    expect(FLOW_STEPS.map(s => s.id)).toEqual(['rahmen', 'produkt', 'umsetzung']);
    expect(FLOW_STEPS.map(s => s.label)).toEqual(['Rahmen', 'Produkt & Idee', 'Umsetzung']);
    expect(SEKTIONEN.map(s => s.titel)).toEqual([
      'Kampagnenübersicht & Rahmen', 'Produkt & Kampagnenidee', 'Deine Aufgabe & Umsetzung'
    ]);
    for (const b of BEREICH_OPTIONS.map(x => x.value)) {
      expect(getStepsForBereich(b)).toBe(FLOW_STEPS);
    }
  });

  it('jede Section hat eine eindeutige id, die Zuordnung steht vor dem Rahmen', () => {
    const ids = FLOW_STEPS.flatMap(s => s.sections.map(sec => sec.id));
    expect(ids).toEqual(['zuordnung', 'rahmen', 'produkt', 'umsetzung']);
  });

  it('fragt die Felder in der Reihenfolge des PDFs', () => {
    expect(namenIn('rahmen')).toEqual([
      'unternehmen_id', 'marke_id', 'kampagne_id', 'produktion_id',
      'aktivierung_name',
      'nutzung_markenkanal', 'nutzung_paid_media', 'nutzung_creator_kanal',
      'plattformen', 'plattformen_weitere',
      'seitenverhaeltnisse', 'seitenverhaeltnis_weitere',
      'videolaenge', 'nutzungsrechte',
      'content_deadline', 'content_deadline_bis', 'go_live', 'go_live_bis'
    ]);
    expect(namenIn('produkt')).toEqual(['produkte', 'beschreibung', 'kernbotschaft']);
    expect(namenIn('umsetzung')).toEqual([
      'aufgabe', 'vorgabe_pflicht', 'setting', 'vorgabe_donts', 'vorgabe_dos', 'umsetzungsideen_eintraege'
    ]);
  });

  it('Pflicht sind nur Zuordnung und Kampagnentitel', () => {
    const required = flattenFields(FLOW_STEPS.flatMap(s => s.sections.flatMap(sec => sec.fields)))
      .filter(f => f.required)
      .map(f => f.name);
    expect(required).toEqual(['unternehmen_id', 'kampagne_id', 'produktion_id', 'aktivierung_name']);
    expect(feldNachName('aktivierung_name').label).toBe('Kampagnentitel');
  });

  it('blendet bekannte Zuordnung aus, die Produktion bleibt wählbar', () => {
    const zuordnung = FLOW_STEPS[0].sections[0];
    expect(zuordnung.hideWhenKnown).toBe(true);
    const felder = flattenFields(zuordnung.fields);
    expect(felder.filter(f => f.hideWhenKnown).map(f => f.name)).toEqual(['unternehmen_id', 'marke_id', 'kampagne_id']);
  });

  it('kein Feld außerhalb des PDFs, auch keine Altfelder', () => {
    const names = inhaltsFelder().map(f => f.name);
    for (const alt of [
      ...ALTFELD_NAMEN, 'tkp', 'verhandlungshinweis', 'produkt_id', 'produkt_ids', 'persona_ids', 'assignee_id',
      'funnel_stufen', 'publish_channels', 'ad_channels', 'cta', 'hook_vorgaben', 'wichtige_vorgaben', 'referenzen'
    ]) {
      expect(names, alt).not.toContain(alt);
    }
  });

  it('Produkte haben keine Spalte, stehen aber in den Inhaltsfeldern', () => {
    expect(getAllFields().map(f => f.name)).not.toContain('produkte');
    const produkte = inhaltsFelder().find(f => f.name === 'produkte');
    expect(produkte).toMatchObject({ type: 'produktListe', persist: false });
    expect(produkte.fields.map(f => f.name)).toEqual(['name', 'url', 'kurzbeschreibung', 'usp', 'loesung']);
  });

  it('jeder Typ sperrt genau sein Häkchen der Content-Verwendung', () => {
    const gesperrt = inhaltsFelder().filter(f => f.lockForBereich);
    expect(Object.fromEntries(gesperrt.map(f => [f.lockForBereich, f.name]))).toEqual({
      owned_social: 'nutzung_markenkanal',
      paid_creator_ads: 'nutzung_paid_media',
      influencer_marketing: 'nutzung_creator_kanal'
    });
  });

  it('jedes Bis-Datum hängt an seinem Von-Datum', () => {
    const bis = inhaltsFelder().filter(f => f.nachDatum);
    expect(bis.map(f => [f.name, f.nachDatum])).toEqual([
      ['content_deadline_bis', 'content_deadline'],
      ['go_live_bis', 'go_live']
    ]);
    for (const f of bis) expect(feldNachName(f.nachDatum).type).toBe('date');
  });

  it('Videolänge schreibt in die zwei Spalten', () => {
    expect(feldNachName('videolaenge')).toMatchObject({ columns: ['videolaenge_von', 'videolaenge_bis'], min: 1, max: 180 });
  });

  it('Optionslisten haben value + label', () => {
    for (const field of inhaltsFelder()) {
      for (const opt of field.options || []) {
        expect(opt.value, `Option ohne value bei ${field.name}`).toBeTruthy();
        expect(opt.label, `Option ohne label bei ${field.name}`).toBeTruthy();
      }
    }
  });
});

describe('optionWert', () => {
  const plattformen = feldNachName('plattformen').options;

  it('findet Wert und Label ohne Groß/klein', () => {
    expect(optionWert(plattformen, 'TikTok')).toBe('tiktok');
    expect(optionWert(plattformen, 'youtube')).toBe('youtube');
    expect(optionWert(feldNachName('seitenverhaeltnisse').options, '9:16 (Hochformat)')).toBe('9:16');
  });

  it('liefert null für Unbekanntes und leer', () => {
    expect(optionWert(plattformen, 'LinkedIn')).toBeNull();
    expect(optionWert(plattformen, '')).toBeNull();
    expect(optionWert(null, 'tiktok')).toBeNull();
  });
});
