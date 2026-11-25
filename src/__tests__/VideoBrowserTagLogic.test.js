import { describe, expect, it } from 'vitest';
import {
  activeFilterValue,
  attachTags,
  cleanTagLabel,
  findTagByLabel,
  folderFilters,
  groupTags,
  matchesFilter,
  tagHint,
  tagOptions,
  toggleFilter,
  variantKeyOf
} from '../modules/video-browser/videoBrowserTagLogic.js';
import { previewAdManagerStem, renamedFilePath, sanitizeAdManagerName } from '../core/videoFileNames.js';

const video = (id, variant, extra = {}) => ({ id, type: 'video', asset: { variant_name: variant }, ...extra });
const final = (id, ratio, sourceId) => ({ id, type: 'video', isFinal: true, ratio, asset: { variant_name: ratio, source_asset_id: sourceId } });

const CATALOG = [
  { id: 't1', label: 'Persona A', gruppe: 'Persona' },
  { id: 't2', label: 'TikTok', gruppe: 'Plattform' },
  { id: 't3', label: 'Eigenes', gruppe: 'Eigene' },
  { id: 't4', label: 'Persona B', gruppe: 'Persona' }
];

describe('variantKeyOf', () => {
  const row = { folders: [{ kind: 'schleife', items: [video('a1', 'A'), video('a2', 'B')] }] };

  it('baut den Schlüssel aus Art und Variante, unabhängig von der Version', () => {
    expect(variantKeyOf(video('a1', 'A'), row)).toBe('videoA');
    expect(variantKeyOf({ id: 's', type: 'story', asset: { story_id: 'st1', variant_name: '9:16' } }, row)).toBe('storyst1');
    expect(variantKeyOf({ id: 'b', type: 'still', asset: { variant_name: '3' } }, row)).toBe('still3');
  });

  it('finale Dateien erben den Schlüssel ihrer Quelle, ohne Quelle und Rohmaterial gibt es keinen', () => {
    expect(variantKeyOf(final('f1', '4:5', 'a2'), row)).toBe('videoB');
    expect(variantKeyOf(final('f2', '4:5', null), row)).toBeNull();
    expect(variantKeyOf({ id: 'r', type: 'roh', asset: {} }, row)).toBeNull();
  });

  it('tagHint nennt die Variante', () => {
    expect(tagHint(video('a1', 'A'))).toBe('Gilt für alle Versionen von Video A');
  });

  it('Dateien ohne Variantenbuchstaben tragen ihre Tags an der Datei selbst', () => {
    const lose = { id: 'x1', type: 'video', asset: { id: 'x1', variant_name: null } };
    const bild = { id: 'x2', type: 'still', asset: { id: 'x2', variant_name: null } };
    expect(variantKeyOf(lose, row)).toBe('dateix1');
    expect(variantKeyOf(bild, row)).toBe('dateix2');
    expect(tagHint(lose)).toBe('Gilt für diese Datei');
    // Finale erbt den Schlüssel der Quelldatei
    const r = { folders: [{ kind: 'schleife', items: [lose] }] };
    const fin = { id: 'f9', type: 'video', isFinal: true, asset: { variant_name: '9:16', source_asset_id: 'x1' } };
    expect(variantKeyOf(fin, r)).toBe('dateix1');
  });
});

describe('attachTags', () => {
  it('hängt Tags an die Variante, auch an ihre finale Datei, und merkt markierte Quellen', () => {
    const schleife = { kind: 'schleife', items: [video('a1', 'A'), video('a2', 'B')] };
    const finalFolder = { kind: 'final', items: [final('f1', '9:16', 'a1')] };
    const kooperationen = [{ rows: [{ id: 'v1', folders: [schleife, finalFolder] }] }];
    attachTags(kooperationen, {
      tagTypen: CATALOG,
      varianteTags: [
        { video_id: 'v1', variant_key: 'videoA', tag_typ_id: 't2', created_at: '2' },
        { video_id: 'v1', variant_key: 'videoA', tag_typ_id: 't1', created_at: '1' },
        { video_id: 'v1', variant_key: 'videoA', tag_typ_id: 'unbekannt', created_at: '3' }
      ]
    });
    expect(schleife.items[0].tagIds).toEqual(['t1', 't2']);
    expect(schleife.items[1].tagIds).toEqual([]);
    expect(finalFolder.items[0].tagIds).toEqual(['t1', 't2']);
    expect(schleife.items[0].finalMarked).toBe(true);
    expect(schleife.items[1].finalMarked).toBe(false);
  });
});

describe('Tag-Auswahl', () => {
  it('gruppiert in fester Reihenfolge, sortiert nach Label', () => {
    expect(groupTags(CATALOG).map(g => [g.group, g.tags.map(t => t.label)])).toEqual([
      ['Persona', ['Persona A', 'Persona B']],
      ['Plattform', ['TikTok']],
      ['Eigene', ['Eigenes']]
    ]);
  });

  it('blendet vergebene Tags aus, filtert nach Teilstring und bietet Neu anlegen ohne exakten Treffer', () => {
    const all = tagOptions(CATALOG, ['t1'], '');
    expect(all.groups.flatMap(g => g.tags.map(t => t.id))).toEqual(['t4', 't2', 't3']);
    expect(all.create).toBeNull();

    const hit = tagOptions(CATALOG, [], 'persona');
    expect(hit.groups.flatMap(g => g.tags.map(t => t.id))).toEqual(['t1', 't4']);
    expect(hit.create).toBe('persona');

    // Exakter Treffer (auch unter den vergebenen, ohne Beachtung der Schreibweise): kein Neu anlegen
    expect(tagOptions(CATALOG, ['t2'], ' tiktok ').create).toBeNull();
    expect(tagOptions(CATALOG, [], 'Neu').create).toBe('Neu');
  });

  it('bereinigt und findet Labels', () => {
    expect(cleanTagLabel('  zwei   Wörter  ')).toBe('zwei Wörter');
    expect(cleanTagLabel('x'.repeat(60))).toHaveLength(40);
    expect(findTagByLabel(CATALOG, 'TIKTOK').id).toBe('t2');
    expect(findTagByLabel(CATALOG, '')).toBeNull();
  });
});

describe('Filter', () => {
  const folder = {
    id: 's1',
    kind: 'schleife',
    items: [
      { id: 'a1', tagIds: ['t2', 't1'], finalMarked: true },
      { id: 'a2', tagIds: ['t2'], finalMarked: false },
      { id: 'a3', tagIds: [], finalMarked: false }
    ]
  };

  it('bietet Final (nur mit Markierung) und die vorkommenden Tags in der Reihenfolge des Auftretens', () => {
    expect(folderFilters(folder, CATALOG).map(c => c.id)).toEqual(['final', 't2', 't1']);
    expect(folderFilters({ ...folder, items: folder.items.map(i => ({ ...i, finalMarked: false })) }, CATALOG).map(c => c.id)).toEqual(['t2', 't1']);
  });

  it('kein Final-Chip im Ordner Finale Version, keine Chips bei weniger als zwei Inhalten', () => {
    expect(folderFilters({ ...folder, kind: 'final' }, CATALOG).map(c => c.id)).toEqual(['t2', 't1']);
    expect(folderFilters({ ...folder, items: [folder.items[0]] }, CATALOG)).toEqual([]);
  });

  it('matcht Tag und Final, Toggle gilt pro Ordner', () => {
    expect(folder.items.filter(i => matchesFilter(i, 't2')).map(i => i.id)).toEqual(['a1', 'a2']);
    expect(folder.items.filter(i => matchesFilter(i, 'final')).map(i => i.id)).toEqual(['a1']);
    expect(folder.items.filter(i => matchesFilter(i, null))).toHaveLength(3);

    const on = toggleFilter(null, 's1', 't2');
    expect(on).toEqual({ folderId: 's1', value: 't2' });
    expect(toggleFilter(on, 's1', 't2')).toBeNull();
    expect(toggleFilter(on, 's1', 't1')).toEqual({ folderId: 's1', value: 't1' });
    expect(activeFilterValue(on, 's1')).toBe('t2');
    expect(activeFilterValue(on, 's2')).toBeNull();
  });
});

describe('Ad-Manager-Dateiname', () => {
  it('ersetzt Umlaute, Leerzeichen und Sonderzeichen', () => {
    expect(sanitizeAdManagerName('Müller Größe & Söhne')).toBe('Mueller_Groesse_Soehne');
    expect(sanitizeAdManagerName('ÄÖÜ äöü ß')).toBe('AeOeUe_aeoeue_ss');
    expect(sanitizeAdManagerName('__a///b__c__')).toBe('ab_c');
    expect(sanitizeAdManagerName('!!!')).toBe('');
    expect(sanitizeAdManagerName('Spot-1_final')).toBe('Spot-1_final');
  });

  it('Vorschau meldet nur dann eine Änderung, wenn bereinigt wird, eine getippte Endung zählt nicht', () => {
    expect(previewAdManagerStem('Spot v2', '.mp4')).toEqual({ typed: 'Spot v2', stem: 'Spot_v2', changed: true });
    expect(previewAdManagerStem('Spot_v2.mp4', '.mp4')).toEqual({ typed: 'Spot_v2', stem: 'Spot_v2', changed: false });
    expect(previewAdManagerStem('äöü', '.mp4').stem).toBe('aeoeue');
  });

  it('renamedFilePath bereinigt nur mit adManager, sonst bleibt das Dropbox-Verhalten', () => {
    expect(renamedFilePath('/K/alt.mp4', 'Neuer Name ä', { adManager: true })).toBe('/K/Neuer_Name_ae.mp4');
    expect(renamedFilePath('/K/alt.mp4', 'Neuer Name ä')).toBe('/K/Neuer Name ä.mp4');
    expect(renamedFilePath('/K/alt.mp4', '!!!', { adManager: true })).toBeNull();
  });
});
