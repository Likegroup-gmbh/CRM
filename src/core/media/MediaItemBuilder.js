// MediaItemBuilder
// Baut die durchgaengige, flache Item-Liste fuer den Video-Player auf.
// Reihenfolge pro Kooperation: je Video das Video selbst gefolgt von seinen
// eigenen Storys (nach slot_index), danach die Bilder der Kooperation.
//   Koop -> [V1, Storys(V1)..., V2, Storys(V2)..., ...] -> [Bilder] -> naechste Koop

export class MediaItemBuilder {
  /** @param {object} table - KampagneKooperationenVideoTable (Datenquelle) */
  constructor(table) {
    this.table = table;
  }

  hasUpload(video) {
    return !!(video.file_url || video.link_content || video.asset_url || video.currentAsset?.file_path);
  }

  // Bilder aller gefilterten Koops sicherstellen (Preload kann fehlen/leer sein),
  // damit die durchgaengige Liste auch Bilder enthaelt.
  async ensureBilderLoaded() {
    const koops = this.table.renderer.getFilteredKooperationen() || [];
    const missing = koops.filter(k => k.bilder_folder_url && !Array.isArray(k._bilder));
    if (missing.length === 0) return;

    try {
      const ids = missing.map(k => k.id);
      const { data, error } = await window.supabase
        .from('kooperation_bilder_asset')
        .select('id, kooperation_id, file_url, file_path, file_name, created_at')
        .in('kooperation_id', ids)
        .order('file_name', { ascending: true });
      if (error) throw error;

      const byKoop = {};
      for (const img of (data || [])) {
        if (!byKoop[img.kooperation_id]) byKoop[img.kooperation_id] = [];
        byKoop[img.kooperation_id].push(img);
      }
      for (const k of missing) k._bilder = byKoop[k.id] || [];
    } catch (err) {
      console.warn('Bilder konnten nicht geladen werden:', err);
      for (const k of missing) k._bilder = Array.isArray(k._bilder) ? k._bilder : [];
    }
  }

  /** @returns {Array<object>} flache Item-Liste (type: 'video' | 'story' | 'bild') */
  build() {
    const koops = this.table.renderer.getFilteredKooperationen() || [];
    const items = [];
    for (const koop of koops) {
      const videos = this.table.videos[koop.id] || [];
      for (const video of videos) {
        if (this.hasUpload(video)) items.push({ type: 'video', video, koop });
        // Storys direkt hinter ihr Video einreihen (vollstaendige Reihe pro Video)
        for (const slot of (video.story_slots || [])) {
          if ((slot.assets || []).length > 0) {
            items.push({ type: 'story', slot, video, koop });
          }
        }
      }
      for (const image of (koop._bilder || [])) {
        items.push({ type: 'bild', image, koop });
      }
    }
    return items;
  }
}
