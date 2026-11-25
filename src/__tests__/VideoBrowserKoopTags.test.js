import { describe, expect, it } from 'vitest';
import { attachKoopTags, tagOptions } from '../modules/video-browser/videoBrowserTagLogic.js';
import { koopTagChipHtml, tagFieldHtml } from '../modules/video-browser/videoBrowserRenderTags.js';

const TYPEN = [
  { id: 'k1', name: 'Wichtig' },
  { id: 'k2', name: 'Anna' },
  { id: 'k3', name: 'TikTok' }
];

describe('attachKoopTags', () => {
  it('hängt die vergebenen Koop-Tags nach Namen sortiert an jede Kooperation', () => {
    const koops = [{ id: 'a' }, { id: 'b' }];
    attachKoopTags(koops, {
      koopTagTypen: TYPEN,
      koopTags: [
        { kooperation_id: 'a', tag_id: 'k1' },
        { kooperation_id: 'a', tag_id: 'k2' },
        { kooperation_id: 'a', tag_id: 'k2' },
        { kooperation_id: 'a', tag_id: 'unbekannt' }
      ]
    });
    expect(koops[0].tags.map(t => t.label)).toEqual(['Anna', 'Wichtig']);
    expect(koops[1].tags).toEqual([]);
  });

  it('kommt ohne Daten klar (Kunden bekommen keine Koop-Tags)', () => {
    const koops = [{ id: 'a' }];
    attachKoopTags(koops, {});
    expect(koops[0].tags).toEqual([]);
  });
});

describe('tagOptions mit Koop-Tags', () => {
  const catalog = [{ id: 't1', label: 'TikTok', gruppe: 'Plattform' }];
  const koop = { typen: TYPEN, assigned: [{ id: 'k1', label: 'Wichtig' }] };

  it('bietet Koop-Namen an, die es als Video-Tag nicht gibt und die nicht schon an der Koop hängen', () => {
    const { groups } = tagOptions(catalog, [], '', koop);
    const group = groups.find(g => g.group === 'Aus Kooperationen');
    expect(group.tags.map(t => t.label)).toEqual(['Anna']);
    expect(group.tags[0].id).toBe('koop:k2');
    expect(groups[groups.length - 1]).toBe(group);
  });

  it('filtert die Koop-Namen nach der Eingabe und verhindert "Neu anlegen" bei exaktem Treffer', () => {
    const hit = tagOptions(catalog, [], 'ann', koop);
    expect(hit.groups.find(g => g.group === 'Aus Kooperationen').tags).toHaveLength(1);
    expect(tagOptions(catalog, [], 'Anna', koop).create).toBeNull();
    expect(tagOptions(catalog, [], 'zzz', koop).create).toBe('zzz');
  });

  it('ohne Koop-Daten verhält es sich wie bisher', () => {
    expect(tagOptions(catalog, [], '').groups.map(g => g.group)).toEqual(['Plattform']);
  });
});

describe('tagFieldHtml mit Koop-Tags', () => {
  const item = { variantKey: 'videoA', tagIds: [] };
  const resolved = { koop: { tags: [{ id: 'k1', label: 'Wichtig <b>' }] } };

  it('zeigt die Koop-Tags als lesbare Chips, auch für Leser ohne eigene Tags', () => {
    const html = tagFieldHtml({ canUpload: false, tagCatalog: [], resolved }, item);
    expect(html).toContain('data-koop-tag-id="k1"');
    expect(html).toContain('Wichtig &lt;b&gt;');
    expect(html).not.toContain('data-vb-tag-remove');
  });

  it('ohne eigene und Koop-Tags bleibt die Zeile für Leser weg', () => {
    expect(tagFieldHtml({ canUpload: false, tagCatalog: [], resolved: { koop: { tags: [] } } }, item)).toBe('');
  });

  it('Chip ist nicht entfernbar', () => {
    expect(koopTagChipHtml({ id: 'k1', label: 'X' })).not.toContain('tag-remove');
  });
});
