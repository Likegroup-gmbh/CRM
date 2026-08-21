import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadReferenzVideo } = require('../../netlify/functions/_shared/skript-context/load-referenz.js');

function mockSupabase(item, error = null) {
  return {
    from: (table) => {
      if (table !== 'strategie_items') throw new Error(`unerwartete Tabelle ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: item, error })
          })
        })
      };
    }
  };
}

describe('loadReferenzVideo (strategie_item)', () => {
  it('liefert null ohne referenz_video', async () => {
    expect(await loadReferenzVideo({}, {})).toBeNull();
    expect(await loadReferenzVideo({}, { referenz_video: null })).toBeNull();
  });

  it('liefert null bei Strategie-Item ohne Transkript (weder DB noch Client)', async () => {
    const sb = mockSupabase({
      id: 'i1',
      video_link: 'https://t',
      plattform: 'tiktok',
      transkript: null,
      strategie: { id: 'st', kampagne_id: 'k1' }
    });
    expect(await loadReferenzVideo(sb, {
      kampagne_id: 'k1',
      referenz_video: {
        quelle: 'strategie_item',
        strategie_item_id: 'i1',
        transkript_verwendet: '  '
      }
    })).toBeNull();
  });

  it('wirft wenn das Item zu einer anderen Kampagne gehoert', async () => {
    const sb = mockSupabase({
      id: 'i1',
      video_link: 'https://www.tiktok.com/@u/video/1',
      plattform: 'tiktok',
      beschreibung: 'DB-Beschreibung',
      caption: 'DB-Caption',
      strategie: { id: 'st', kampagne_id: 'k-fremd' }
    });

    await expect(loadReferenzVideo(sb, {
      kampagne_id: 'k1',
      referenz_video: {
        quelle: 'strategie_item',
        strategie_item_id: 'i1',
        transkript_verwendet: 'Hook und Hauptteil aus der Vorlage.'
      }
    })).rejects.toThrow(/Kampagne/);
  });

  it('wirft ohne Kampagne am Payload', async () => {
    const sb = mockSupabase({
      id: 'i1',
      video_link: 'https://t',
      plattform: 'tiktok',
      strategie: { id: 'st', kampagne_id: 'k1' }
    });

    await expect(loadReferenzVideo(sb, {
      referenz_video: {
        quelle: 'strategie_item',
        strategie_item_id: 'i1',
        transkript_verwendet: 'Hook und Hauptteil aus der Vorlage.'
      }
    })).rejects.toThrow(/Kampagne/);
  });

  it('Transkript kommt aus der DB, Metadaten aus der Item-Row', async () => {
    const sb = mockSupabase({
      id: 'i1',
      video_link: 'https://www.tiktok.com/@u/video/1',
      plattform: 'tiktok',
      beschreibung: 'DB-Beschreibung',
      caption: 'DB-Caption',
      transkript: 'DB-Transkript der Vorlage.',
      strategie: { id: 'st', kampagne_id: 'k1' }
    });

    const ref = await loadReferenzVideo(sb, {
      kampagne_id: 'k1',
      referenz_video: {
        quelle: 'strategie_item',
        strategie_item_id: 'i1',
        transkript_verwendet: 'DB-Transkript der Vorlage.',
        beschreibung: 'Client-Beschreibung',
        caption: ''
      }
    });

    expect(ref.quelle).toBe('strategie_item');
    expect(ref.strategie_item_id).toBe('i1');
    expect(ref.url).toBe('https://www.tiktok.com/@u/video/1');
    expect(ref.platform).toBe('tiktok');
    expect(ref.transkript_verwendet).toBe('DB-Transkript der Vorlage.');
    expect(ref.beschreibung).toBe('Client-Beschreibung');
    expect(ref.caption).toBe('DB-Caption');
  });

  it('DB-Transkript schlaegt fehlenden Client-Text (kein Override noetig)', async () => {
    const sb = mockSupabase({
      id: 'i1',
      video_link: 'https://t',
      plattform: 'tiktok',
      transkript: 'Nur in der DB vorhandenes Transkript.',
      strategie: { id: 'st', kampagne_id: 'k1' }
    });

    const ref = await loadReferenzVideo(sb, {
      kampagne_id: 'k1',
      referenz_video: { quelle: 'strategie_item', strategie_item_id: 'i1' }
    });

    expect(ref.transkript_verwendet).toBe('Nur in der DB vorhandenes Transkript.');
  });

  it('abweichender Client-Text gilt als Override (manuell editiert)', async () => {
    const sb = mockSupabase({
      id: 'i1',
      video_link: 'https://t',
      plattform: 'tiktok',
      transkript: 'DB-Transkript.',
      strategie: { id: 'st', kampagne_id: 'k1' }
    });

    const ref = await loadReferenzVideo(sb, {
      kampagne_id: 'k1',
      referenz_video: {
        quelle: 'strategie_item',
        strategie_item_id: 'i1',
        transkript_verwendet: 'Vom User korrigiertes Transkript.'
      }
    });

    expect(ref.transkript_verwendet).toBe('Vom User korrigiertes Transkript.');
  });
});
