// VideoDataLoader.js
// Supabase-Queries fuer Video-Modul
// RLS filtert serverseitig - keine client-seitige Permission-Filterung

import { VideoFilterLogic } from './filters/VideoFilterLogic.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

export class VideoDataLoader {
  /**
   * Laedt Unternehmen-Ordner (Level 1) aggregiert aus kooperation_videos.
   * RLS beschraenkt automatisch auf sichtbare Videos.
   */
  static async loadUnternehmenFolders() {
    if (!window.supabase) return [];

    const { data, error } = await window.supabase
      .from('kooperation_videos')
      .select(`
        id,
        kooperation:kooperation_id (
          kampagne:kampagne_id (
            id,
            unternehmen:unternehmen_id (id, firmenname, logo_url),
            marke:marke_id (
              unternehmen:unternehmen_id (id, firmenname, logo_url)
            )
          )
        )
      `);

    if (error) {
      console.error('❌ VideoDataLoader.loadUnternehmenFolders:', error);
      return [];
    }

    const unternehmenMap = new Map();
    (data || []).forEach(video => {
      const kampagne = video.kooperation?.kampagne;
      const unternehmen = kampagne?.marke?.unternehmen || kampagne?.unternehmen;
      if (!unternehmen?.id) return;

      const existing = unternehmenMap.get(unternehmen.id);
      if (existing) {
        existing.count++;
      } else {
        unternehmenMap.set(unternehmen.id, {
          id: unternehmen.id,
          firmenname: unternehmen.firmenname,
          logo_url: unternehmen.logo_url,
          count: 1
        });
      }
    });

    return Array.from(unternehmenMap.values())
      .sort((a, b) => (a.firmenname || '').localeCompare(b.firmenname || '', 'de'));
  }

  /**
   * Laedt Kampagnen-Ordner (Level 2) fuer ein Unternehmen bzw. alle fuer Kunden.
   * RLS beschraenkt automatisch auf sichtbare Videos.
   */
  static async loadKampagnenFolders(unternehmenId, isKunde = false) {
    if (!window.supabase) return [];
    if (!isKunde && !unternehmenId) return [];

    const { data, error } = await window.supabase
      .from('kooperation_videos')
      .select(`
        id,
        kooperation:kooperation_id (
          kampagne:kampagne_id (
            id,
            kampagnenname,
            eigener_name,
            unternehmen:unternehmen_id (id),
            marke:marke_id (
              unternehmen:unternehmen_id (id)
            )
          )
        )
      `);

    if (error) {
      console.error('❌ VideoDataLoader.loadKampagnenFolders:', error);
      return [];
    }

    const kampagnenMap = new Map();
    (data || []).forEach(video => {
      const kampagne = video.kooperation?.kampagne;
      if (!kampagne?.id) return;

      // Bei Nicht-Kunden: Unternehmens-Filter anwenden (clientseitig, nur zur Ansichts-Eingrenzung)
      if (!isKunde) {
        const kampagneUnternehmenId = kampagne?.marke?.unternehmen?.id || kampagne?.unternehmen?.id;
        if (kampagneUnternehmenId !== unternehmenId) return;
      }

      const existing = kampagnenMap.get(kampagne.id);
      if (existing) {
        existing.count++;
      } else {
        kampagnenMap.set(kampagne.id, {
          id: kampagne.id,
          name: KampagneUtils.getDisplayName(kampagne),
          count: 1
        });
      }
    });

    return Array.from(kampagnenMap.values())
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
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
      id, kooperation_id, position, titel, content_art, status, posting_datum, thema, link_content, asset_url, folder_url,
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
