import { describe, expect, it } from 'vitest';
import {
  buildKoopGroups,
  buildTree,
  creatorAnzahl,
  groupOfKoop,
  kooperationLabel,
  kooperationTitel,
  weitereKooperationen
} from '../modules/video-browser/videoBrowserLogic.js';

const linien = [{ id: 'b1', name: 'Nano-Influencer' }, { id: 'b2', name: 'UGC-Creator' }];

const raw = () => ({
  kooperationen: [
    { id: 'k1', name: 'Koop A', briefing_id: 'b2', created_at: '2026-01-02', creator: { id: 'c1', vorname: 'Ameli', nachname: 'Noubbigh' } },
    { id: 'k2', name: 'Koop B', briefing_id: 'b1', created_at: '2026-01-01', creator: { id: 'c1', vorname: 'Ameli', nachname: 'Noubbigh' } },
    { id: 'k3', name: 'Koop C', briefing_id: 'b2', created_at: '2026-01-03', creator: { id: 'c2', vorname: 'Dilara', nachname: 'Selek' } },
    { id: 'k4', name: 'Koop D', briefing_id: 'b1', created_at: '2026-01-04', creator: { id: 'c3', vorname: 'Ömer', nachname: 'Kösek' } },
    { id: 'k5', name: 'Altfall', briefing_id: null, created_at: '2026-01-05', creator: { vorname: 'Ameli', nachname: 'Noubbigh' } }
  ],
  linien,
  videos: [
    { id: 'v1', kooperation_id: 'k1', position: 1, titel: 'Hook', created_at: '2026-01-01' },
    { id: 'v2', kooperation_id: 'k2', position: 1, titel: 'Story', created_at: '2026-01-01' },
    { id: 'v3', kooperation_id: 'k2', position: 2, titel: 'Zweites', created_at: '2026-01-02' }
  ]
});

const tree = () => buildTree(raw(), { team: true });

describe('Baum: Felder für die Gruppierung', () => {
  it('Creator-Datensatz, Linie und Reihenfolge am Knoten', () => {
    const [k1, , , , k5] = tree().kooperationen;
    expect(k1.creatorId).toBe('c1');
    expect(k1.linieId).toBe('b2');
    expect(k1.linieName).toBe('UGC-Creator');
    expect(k1.linieOrder).toBe(1);
    expect(k1.createdAt).toBe('2026-01-02');
    expect(k5.creatorId).toBeNull();
    expect(k5.linieId).toBeNull();
    expect(k5.linieName).toBe('');
  });

  it('Produkte der Videoideen je Kooperation, einmalig und in Video-Reihenfolge', () => {
    const r = raw();
    r.videos[1].strategie_item_id = 'i2';
    r.videos[2].strategie_item_id = 'i1';
    r.videos.push({ id: 'v4', kooperation_id: 'k2', position: 3, strategie_item_id: 'i3', created_at: '2026-01-03' });
    r.ideen = [{ id: 'i1', produkt_id: 'p1' }, { id: 'i2', produkt_id: 'p2' }, { id: 'i3', produkt_id: 'p1' }];
    r.produkte = [{ id: 'p1', name: 'Serum' }, { id: 'p2', name: 'Creme' }];
    const k2 = buildTree(r, { team: true }).kooperationen[1];
    expect(k2.produkte).toEqual(['Creme', 'Serum']);
    const single = buildKoopGroups(buildTree(r, { team: true }).kooperationen, { grouped: true })
      .find(e => e.kind === 'group' && e.id === 'creator:c1').rows.find(x => x.koop.id === 'k2');
    expect(single.meta).toBe('Creme, Serum · Story · Zweites · 3 Videos');
  });
});

describe('buildKoopGroups', () => {
  it('ohne Gruppierung bleibt die Liste flach in der geladenen Reihenfolge', () => {
    const entries = buildKoopGroups(tree().kooperationen, { grouped: false });
    expect(entries.map(e => e.kind)).toEqual(['single', 'single', 'single', 'single', 'single']);
    expect(entries.map(e => e.koop.id)).toEqual(['k1', 'k2', 'k3', 'k4', 'k5']);
  });

  it('Creator: ein Kopf je Datensatz, Zeilen nach Linien-Reihenfolge, Einzelne ohne Kopf', () => {
    const entries = buildKoopGroups(tree().kooperationen, { grouped: true, zeigeLinie: true });
    const ameli = entries.find(e => e.kind === 'group');
    expect(ameli.id).toBe('creator:c1');
    expect(ameli.meta).toBe('2 Kooperationen');
    expect(ameli.rows.map(r => r.koop.id)).toEqual(['k2', 'k1']);
    expect(ameli.rows.map(r => r.title)).toEqual(['Nano-Influencer', 'UGC-Creator']);
    expect(ameli.rows[0].meta).toBe('Story · Zweites · 2 Videos');
    // Ohne Creator-Datensatz nie unter dem Kopf, auch bei gleichem Namen
    expect(entries.filter(e => e.kind === 'single').map(e => e.koop.id)).toEqual(expect.arrayContaining(['k3', 'k4', 'k5']));
    const dilara = entries.find(e => e.koop.id === 'k3');
    expect(dilara.title).toBe('Dilara Selek');
    expect(dilara.meta).toBe('UGC-Creator · 0 Videos');
  });

  it('Creator: alphabetisch nach deutscher Sortierung, Köpfe und Einzelne gemischt', () => {
    const entries = buildKoopGroups(tree().kooperationen, { grouped: true });
    expect(entries.map(e => e.kind === 'group' ? e.id : e.koop.id)).toEqual(['creator:c1', 'k5', 'k3', 'k4']);
  });

  it('gleicher Name, anderer Creator: Handle steht dabei', () => {
    const data = raw();
    data.kooperationen[0].creator.instagram = 'ameli.n';
    data.kooperationen[1].creator.instagram = 'ameli.n';
    data.kooperationen[4].creator.instagram = 'ameli.zwei';
    const entries = buildKoopGroups(buildTree(data, { team: true }).kooperationen, { grouped: true });
    expect(entries.find(e => e.kind === 'group').label).toBe('Ameli Noubbigh · @ameli.n');
    expect(entries.find(e => e.koop.id === 'k5').title).toBe('Ameli Noubbigh · @ameli.zwei');
    expect(entries.find(e => e.koop.id === 'k3').title).toBe('Dilara Selek');
  });

  it('gleiche Linie zweimal beim selben Creator: die Videotitel unterscheiden die Zeilen', () => {
    const data = raw();
    data.kooperationen[0].briefing_id = 'b1';
    const group = buildKoopGroups(buildTree(data, { team: true }).kooperationen, { grouped: true }).find(e => e.kind === 'group');
    expect(group.rows.map(r => [r.koop.id, r.title])).toEqual([['k2', 'Story · Zweites'], ['k1', 'Hook']]);
  });

  it('nichts unterscheidet die Zeilen (gleiche Linie, keine Titel): Nummer nach Anlage', () => {
    const data = raw();
    data.kooperationen[0].briefing_id = 'b1';
    data.kooperationen[0].name = data.kooperationen[1].name = 'Gleich';
    data.videos = [];
    const group = buildKoopGroups(buildTree(data, { team: true }).kooperationen, { grouped: true }).find(e => e.kind === 'group');
    expect(group.rows.map(r => [r.koop.id, r.title])).toEqual([['k2', 'Nano-Influencer · 1'], ['k1', 'Nano-Influencer · 2']]);
  });

  it('Kopf summiert die Zähler seiner Kooperationen', () => {
    const koops = tree().kooperationen.map(k => ({ ...k, offeneCount: k.creatorId === 'c1' ? 2 : 0 }));
    expect(buildKoopGroups(koops, { grouped: true }).find(e => e.kind === 'group').offeneCount).toBe(4);
  });

  it('Linie: Köpfe in Linien-Reihenfolge, Zeilen nach Creator, ohne Linie zuletzt', () => {
    const entries = buildKoopGroups(tree().kooperationen, { mode: 'linie', grouped: true });
    expect(entries.map(e => e.kind === 'group' ? e.id : e.koop.id)).toEqual(['linie:b1', 'linie:b2', 'k5']);
    const nano = entries[0];
    expect(nano.label).toBe('Nano-Influencer');
    expect(nano.rows.map(r => r.title)).toEqual(['Ameli Noubbigh', 'Ömer Kösek']);
    expect(entries[2].meta).toBe('Ohne Linie · 0 Videos');
  });

  it('Gruppe der gewählten Kooperation finden', () => {
    const entries = buildKoopGroups(tree().kooperationen, { grouped: true });
    expect(groupOfKoop(entries, 'k1')).toBe('creator:c1');
    expect(groupOfKoop(entries, 'k3')).toBeNull();
    expect(groupOfKoop(entries, null)).toBeNull();
  });
});

describe('Titel und Kontext', () => {
  it('kooperationLabel: Linie, sonst Kooperationsname; im Modus Linie der Creator', () => {
    const [k1, , , , k5] = tree().kooperationen;
    expect(kooperationLabel(k1)).toBe('UGC-Creator');
    expect(kooperationLabel(k5)).toBe('Altfall');
    expect(kooperationLabel({ name: 'X' })).toBe('Kooperation');
    expect(kooperationLabel(k1, 'linie')).toBe('Ameli Noubbigh');
  });

  it('kooperationTitel nennt die Linie nur, wenn mehrere Linien sichtbar sind', () => {
    const [k1, , , , k5] = tree().kooperationen;
    expect(kooperationTitel(k1, { zeigeLinie: true })).toBe('Ameli Noubbigh · UGC-Creator');
    expect(kooperationTitel(k1)).toBe('Ameli Noubbigh');
    expect(kooperationTitel(k5, { zeigeLinie: true })).toBe('Ameli Noubbigh');
  });

  it('weitere Kooperationen: nur derselbe Datensatz, in Linien-Reihenfolge', () => {
    const koops = tree().kooperationen;
    expect(weitereKooperationen(koops, koops[0]).map(k => k.id)).toEqual(['k2']);
    expect(weitereKooperationen(koops, koops[4])).toEqual([]);
  });

  it('Creator zählen: ohne Datensatz jede Kooperation einzeln', () => {
    expect(creatorAnzahl(tree().kooperationen)).toBe(4);
  });
});

describe('Produktion ohne Linien (Jahreskooperation)', () => {
  const creator = (id, vorname, nachname) => ({ id, vorname, nachname });
  const data = () => ({
    kooperationen: [
      { id: 'a', name: 'Carla  Birkmann 6/9', created_at: '2026-05-18', creator: creator('c1', 'Carla', 'Birkmann') },
      { id: 'b', name: 'Carla  Birkmann 20/40', created_at: '2026-10-07', creator: creator('c1', 'Carla', 'Birkmann') },
      { id: 'c', name: 'Michelle Kober 3/3', created_at: '2026-04-16', creator: creator('c2', 'Michelle', 'Kober') },
      { id: 'd', name: 'Michelle Kober 8/9', created_at: '2026-07-06', creator: creator('c2', 'Michelle', 'Kober') },
      { id: 'e', name: 'Dilara Selek 1/1', created_at: '2026-04-01', creator: creator('c3', 'Dilara', 'Selek') }
    ],
    linien: [],
    videos: [
      { id: '1', kooperation_id: 'a', position: 1, created_at: '1' },
      { id: '2', kooperation_id: 'a', position: 2, created_at: '2' },
      { id: '3', kooperation_id: 'a', position: 3, titel: 'Wassermelonen Eis', created_at: '3' },
      { id: '4', kooperation_id: 'a', position: 4, titel: 'Schwamm DIY', created_at: '4' },
      { id: '5', kooperation_id: 'a', position: 5, titel: 'Zusatz', created_at: '5' },
      { id: '6', kooperation_id: 'b', position: 1, titel: 'Teddy LE', created_at: '6' },
      { id: '7', kooperation_id: 'c', position: 1, titel: 'ISANA Ironie', created_at: '7' },
      { id: '8', kooperation_id: 'd', position: 1, created_at: '8' },
      { id: '9', kooperation_id: 'e', position: 1, titel: 'Hook', created_at: '9' }
    ]
  });
  const entries = (opts = {}) => buildKoopGroups(buildTree(data(), { team: true }).kooperationen, { grouped: true, ...opts });

  it('jeder Creator erscheint genau einmal als Zeilentitel, auch ohne Linie', () => {
    const titel = entries().map(e => (e.kind === 'group' ? e.label : e.title));
    expect(titel).toEqual(['Carla Birkmann', 'Dilara Selek', 'Michelle Kober']);
    expect(entries().filter(e => e.kind === 'group').map(e => e.meta)).toEqual(['2 Kooperationen', '2 Kooperationen']);
  });

  it('ohne Produkt und Linie werden die Videotitel zum Zeilentitel', () => {
    const carla = entries().find(e => e.id === 'creator:c1');
    expect(carla.rows.map(r => r.title)).toEqual(['Wassermelonen Eis · Schwamm DIY +1', 'Teddy LE']);
    expect(carla.rows[0].meta).toBe('5 Videos');
  });

  it('ohne Videotitel trägt der Zusatz im Kooperationsnamen', () => {
    const michelle = entries().find(e => e.id === 'creator:c2');
    expect(michelle.rows.map(r => r.title)).toEqual(['ISANA Ironie', 'Kooperation 8/9']);
  });

  it('Einzelzeile nennt die Videotitel in der Meta-Zeile', () => {
    const dilara = entries().find(e => e.koop.id === 'e');
    expect(dilara.meta).toBe('Hook · 1 Video');
  });

  it('Pfadleiste und Kontext unterscheiden die Kooperationen ohne Linie', () => {
    const koops = buildTree(data(), { team: true }).kooperationen;
    expect(kooperationTitel(koops[1], { kooperationen: koops })).toBe('Carla Birkmann · Teddy LE');
    expect(kooperationTitel(koops[4], { kooperationen: koops })).toBe('Dilara Selek');
    expect(kooperationLabel(koops[3], 'creator', koops.filter(k => k.creatorId === 'c2'))).toBe('Kooperation 8/9');
  });

  it('Produkt als Titel, die Videotitel stehen in der Meta-Zeile', () => {
    const d = data();
    d.videos[0].strategie_item_id = 'i1';
    d.videos[5].strategie_item_id = 'i2';
    d.ideen = [{ id: 'i1', produkt_id: 'p1' }, { id: 'i2', produkt_id: 'p2' }];
    d.produkte = [{ id: 'p1', name: 'Eis' }, { id: 'p2', name: 'Teddy' }];
    const carla = buildKoopGroups(buildTree(d, { team: true }).kooperationen, { grouped: true }).find(e => e.id === 'creator:c1');
    expect(carla.rows.map(r => r.title)).toEqual(['Eis', 'Teddy']);
    expect(carla.rows[0].meta).toBe('Wassermelonen Eis · Schwamm DIY +1 · 5 Videos');
  });
});
