// VideoAssetLoader
// Laedt Video-Assets (Feedbackschleifen/Versionen + Varianten) eines Videos und
// stellt die Auswahl-/Default-Logik bereit. Eigener Cache pro Player-Instanz.
//
// WICHTIG: ASSET_SELECT darf nur real existierende Spalten von
// kooperation_video_asset enthalten. 'file_name' existiert dort NICHT – eine
// frueher enthaltene Spalte liess die Query dauerhaft fehlschlagen, wodurch
// gar keine Versionen/Varianten geladen wurden (kein Auswahl-Select sichtbar).

import { normalizeVideoFeedbackComments, VIDEO_FEEDBACK_FIELDS } from '../VideoFeedbackBuckets.js';

const ASSET_SELECT = 'id, video_id, file_url, file_path, version_number, variant_name, description, is_current, is_final, created_at';

export class VideoAssetLoader {
  constructor() {
    this._cache = new Map();
  }

  has(videoId) {
    return this._cache.has(videoId);
  }

  get(videoId) {
    return this._cache.get(videoId);
  }

  async load(videoId) {
    if (this._cache.has(videoId)) return this._cache.get(videoId);
    let assets = [];
    try {
      const { data, error } = await window.supabase
        .from('kooperation_video_asset')
        .select(ASSET_SELECT)
        .eq('video_id', videoId)
        .order('version_number', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      assets = data || [];
    } catch (err) {
      console.warn('Video-Assets konnten nicht geladen werden:', err);
      assets = [];
    }
    this._cache.set(videoId, assets);
    return assets;
  }

  /** Nur Feedbackschleifen-Assets (ohne finale Versionen). */
  loopAssets(assets) {
    return (assets || []).filter(a => !a.is_final);
  }

  /** Finale-Version-Assets (is_final), z. B. Varianten 9:16 / 4:5. */
  finalVariants(assets) {
    return (assets || []).filter(a => !!a.is_final);
  }

  /** Versionsnummern aus den Feedbackschleifen-Assets (aufsteigend, dedupliziert). */
  versions(assets) {
    return [...new Set(this.loopAssets(assets).map(a => a.version_number || 1))].sort((a, b) => a - b);
  }

  /**
   * Feedbackschleifen-Versionen inkl. Runden, die nur Feedback (ohne eigenes
   * Asset) besitzen. So bleibt z. B. „Feedbackschleife 2" waehlbar, wenn Runde-2-
   * Feedback existiert, aber kein zweites Video hochgeladen wurde.
   * Finale-Assets (is_final) zaehlen nicht als Feedbackschleife.
   * @param {Array} assets
   * @param {object|null} comments - videoComments[videoId]
   */
  combinedVersions(assets, comments) {
    const set = new Set(this.versions(assets));
    const c = normalizeVideoFeedbackComments(comments);
    VIDEO_FEEDBACK_FIELDS.forEach(slot => {
      if ((c[slot.bucket] || []).length) set.add(slot.runde);
    });
    return [...set].sort((a, b) => a - b);
  }

  variantsForVersion(assets, version) {
    if (version === 'final') return this.finalVariants(assets);
    return this.loopAssets(assets).filter(a => (a.version_number || 1) === version);
  }

  selectedAsset(assets, selectedAssetId) {
    return (assets || []).find(a => a.id === selectedAssetId) || null;
  }

  /**
   * Default-Auswahl: hoechste Version, dort das aktuelle Asset (oder erstes).
   * Bei Versionen ohne Asset bleibt selectedAssetId null -> Quelle faellt auf
   * video.file_url zurueck. Gibt es nur finale Assets (keine Feedbackschleife),
   * wird die finale Version gewaehlt.
   * @returns {{ selectedVersion: number|string|null, selectedAssetId: string|null }}
   */
  applyDefaultSelection(assets, comments) {
    const versions = this.combinedVersions(assets, comments);
    if (versions.length === 0) {
      const finals = this.finalVariants(assets);
      if (finals.length > 0) {
        return { selectedVersion: 'final', selectedAssetId: finals[0].id };
      }
      return { selectedVersion: null, selectedAssetId: null };
    }
    const selectedVersion = versions[versions.length - 1];
    const variants = this.variantsForVersion(assets, selectedVersion);
    const currentAsset = variants.find(a => a.is_current) || variants[0] || null;
    return { selectedVersion, selectedAssetId: currentAsset?.id || null };
  }
}
