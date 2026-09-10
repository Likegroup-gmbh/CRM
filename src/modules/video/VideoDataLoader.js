// VideoDataLoader.js
// Video-Ordnerblatt + paginiertes Listenblatt. RLS filtert serverseitig.

import { VideoFilterLogic } from './filters/VideoFilterLogic.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export class VideoDataLoader {
  /**
   * Baut das Video-Ordnerblatt aus RPC-Zeilen (eine Zeile pro Kampagne).
   * @returns {{unternehmen: Array, kampagnen: Array}}
   */
  static buildOrdnerblatt(rows) {
    const unternehmenMap = new Map();
    const kampagnen = [];

    for (const row of rows || []) {
      if (!row?.kampagne_id || !row?.unternehmen_id) continue;
      const count = Number(row.video_count) || 0;

      kampagnen.push({
        id: row.kampagne_id,
        name: KampagneUtils.getDisplayName({
          eigener_name: row.eigener_name,
          kampagnenname: row.kampagnenname
        }),
        unternehmenId: row.unternehmen_id,
        count
      });

      const existing = unternehmenMap.get(row.unternehmen_id);
      if (existing) {
        existing.count += count;
      } else {
        unternehmenMap.set(row.unternehmen_id, {
          id: row.unternehmen_id,
          firmenname: row.firmenname,
          logo_url: row.logo_url,
          count
        });
      }
    }

    kampagnen.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
    const unternehmen = Array.from(unternehmenMap.values())
      .sort((a, b) => (a.firmenname || '').localeCompare(b.firmenname || '', 'de'));

    return { unternehmen, kampagnen };
  }

  static async loadOrdnerblatt() {
    if (!window.supabase) return { unternehmen: [], kampagnen: [] };

    const { data, error } = await window.supabase.rpc('get_video_ordnerblatt');
    if (error) {
      console.error('❌ VideoDataLoader.loadOrdnerblatt:', error);
      return { unternehmen: [], kampagnen: [] };
    }
    return this.buildOrdnerblatt(data);
  }

  static loadUnternehmenFolders(blatt) {
    return blatt?.unternehmen || [];
  }

  static loadKampagnenFolders(blatt, unternehmenId, isKunde = false) {
    const all = blatt?.kampagnen || [];
    if (isKunde) return all;
    if (!unternehmenId) return [];
    return all.filter(k => k.unternehmenId === unternehmenId);
  }

  /**
   * Laedt Videos (Level 3) mit Pagination + Filtern.
   * RLS beschraenkt automatisch - kein Client-Filter noetig.
   * @returns {Promise<{videos: Array, total: number}>}
   */
  static async loadVideos({ kampagneId, activeFilters, from, to }) {
    if (!window.supabase) return { videos: [], total: 0 };

    // Conditional inner join for kampagne filtering
    const koopJoin = kampagneId ? '!inner' : '';

    const selectFields = `
      id, kooperation_id, position, titel, content_art, status, posting_datum, thema, link_content, folder_url,
      strategie_item:strategie_item_id (id, screenshot_url),
      kooperation:kooperation_id${koopJoin} (
        id, name, kampagne_id,
        kampagne:kampagne_id (id, kampagnenname, eigener_name),
        creator:creator_id (id, vorname, nachname)
      )
    `;

    const countSelect = kampagneId
      ? 'id, kooperation:kooperation_id!inner(kampagne_id)'
      : '*';

    let countQuery = window.supabase
      .from('kooperation_videos')
      .select(countSelect, { count: 'exact', head: true });

    if (kampagneId) {
      countQuery = countQuery.eq('kooperation.kampagne_id', kampagneId);
    }
    countQuery = VideoFilterLogic.buildSupabaseQuery(countQuery, activeFilters);

    let videoQuery = window.supabase
      .from('kooperation_videos')
      .select(selectFields)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (kampagneId) {
      videoQuery = videoQuery.eq('kooperation.kampagne_id', kampagneId);
    }
    videoQuery = VideoFilterLogic.buildSupabaseQuery(videoQuery, activeFilters);

    const [countResult, videoResult] = await Promise.all([countQuery, videoQuery]);

    if (videoResult.error) {
      console.error('❌ VideoDataLoader.loadVideos:', videoResult.error);
      return { videos: [], total: 0 };
    }

    return {
      videos: videoResult.data || [],
      total: countResult.count || 0
    };
  }
}

export default VideoDataLoader;
