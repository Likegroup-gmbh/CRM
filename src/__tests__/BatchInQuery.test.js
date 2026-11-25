import { describe, expect, it, vi } from 'vitest';
import { PostgrestClient } from '@supabase/postgrest-js';
import { batchInQuery } from '../modules/kampagne/videoTableQueries.js';

function clientMitAufzeichnung() {
  const urls = [];
  const fetch = vi.fn(async (url) => {
    urls.push(new URL(url));
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return { client: new PostgrestClient('https://example.test/rest/v1', { fetch }), urls };
}

describe('batchInQuery', () => {
  it('schickt pro Block nur dessen IDs, auch über 200 IDs hinaus', async () => {
    const { client, urls } = clientMitAufzeichnung();
    const ids = Array.from({ length: 240 }, (_, i) => `id-${i}`);

    await batchInQuery(client.from('kooperation_videos'), 'id, kooperation_id', 'kooperation_id', ids,
      q => q.order('position', { ascending: true }));

    expect(urls).toHaveLength(2);
    for (const url of urls) {
      expect(url.searchParams.getAll('kooperation_id')).toHaveLength(1);
      expect(url.searchParams.getAll('order')).toEqual(['position.asc']);
    }
    expect(urls[0].searchParams.get('kooperation_id')).toContain('id-0');
    expect(urls[0].searchParams.get('kooperation_id')).not.toContain('id-200');
    expect(urls[1].searchParams.get('kooperation_id')).toContain('id-200');
    expect(urls[1].searchParams.get('kooperation_id')).not.toContain('id-199,');
  });

  it('führt die Daten aller Blöcke zusammen', async () => {
    let n = 0;
    const fetch = vi.fn(async () => new Response(JSON.stringify([{ id: `v${n++}` }]), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    }));
    const client = new PostgrestClient('https://example.test/rest/v1', { fetch });
    const ids = Array.from({ length: 401 }, (_, i) => `id-${i}`);

    const result = await batchInQuery(client.from('kooperation_videos'), 'id', 'kooperation_id', ids);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: 'v0' }, { id: 'v1' }, { id: 'v2' }]);
  });
});
