// RohmaterialService.js
// Rohmaterial einer Kampagne: laden, hochladen, loeschen.
//
// Rohmaterial ist der Creator-Intake (SharePoint: .../{Kooperation}/Rohmaterial/).
// Der Regelweg ist der tokenisierte Creator-Link; dieser Service deckt die
// interne Seite ab — Cutter sieht/laedt die Dateien, Mitarbeiter kann
// nachtraeglich selbst hochladen oder Fehlabgaben entfernen.
//
// Nur intern: RLS auf kooperation_rohmaterial_asset laesst Kunden gar nicht lesen.

import { ablageZielHolen, hochladenNachSharePoint, sharePointAssetFelder, uploadVerwerfen } from '../../core/ablage/ablageUpload.js';
import { ablageDateiLoeschen } from '../../core/ablage/ablageApi.js';
import { istSharePoint, mitAblage } from '../../core/ablage/ablageLink.js';
import { sanitizeFileName } from '../../core/videoFileNames.js';

// Endungen muessen mit EXT_BY_TYPE.rohmaterial in netlify/functions/_shared/creator-upload.js
// laufen; die Grenze ist die von ablage-upload-ziel (Creator haben eine eigene).
export const ROHMATERIAL_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm|zip|jpe?g|png|webp|heic|heif|gif|bmp|tiff?|avif)$/i;
export const MAX_ROHMATERIAL_SIZE = 20 * 1024 * 1024 * 1024;

/**
 * Rohmaterial behaelt den Originalnamen und ueberschreibt nie — bei Kollision
 * _2, _3, ... vor der Extension. Gleiche Regel wie resolveFileNameCollision im
 * Creator-Upload, hier aber clientseitig. Gegen Wettlaeufe mit einem gleichzeitigen
 * Creator-Upload benennt SharePoint bei Konflikt zusaetzlich selbst um.
 *
 * @param {string} fileName schon sanitisierter Name
 * @param {Set<string>} taken bereits belegte Dateinamen im Zielordner
 * @returns {string}
 */
export function resolveRohmaterialName(fileName, taken) {
  if (!taken.has(fileName)) return fileName;
  const dot = fileName.lastIndexOf('.');
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : '';
  for (let i = 2; i < 100; i++) {
    const candidate = `${stem}_${i}${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('Dateiname kollidiert zu oft');
}

export class RohmaterialService {
  /**
   * Alle Kooperationen der Kampagne mit ihrem Rohmaterial — auch leere, damit
   * der Cutter sieht wessen Abgabe noch fehlt.
   *
   * @param {string} kampagneId
   * @returns {Promise<Array<{id, name, creatorName, folderUrl, files}>>}
   */
  static async loadGroups(kampagneId) {
    if (!window.supabase || !kampagneId) return [];

    const { data: koops, error: koopErr } = await window.supabase
      .from('kooperationen')
      .select(`
        id, name,
        creator:creator_id (id, vorname, nachname)
      `)
      .eq('kampagne_id', kampagneId)
      .order('name', { ascending: true });

    if (koopErr) {
      console.error('❌ RohmaterialService.loadGroups (kooperationen):', koopErr);
      return [];
    }

    const koopList = koops || [];
    if (koopList.length === 0) return [];

    const { data: assets, error: assetErr } = await window.supabase
      .from('kooperation_rohmaterial_asset')
      .select(mitAblage('id, kooperation_id, file_name, file_path, file_url, file_size, folder_url, created_at', 'ablage'))
      .in('kooperation_id', koopList.map(k => k.id))
      .order('created_at', { ascending: false });

    if (assetErr) {
      console.error('❌ RohmaterialService.loadGroups (assets):', assetErr);
    }

    const filesByKoop = new Map();
    (assets || []).forEach(a => {
      if (!filesByKoop.has(a.kooperation_id)) filesByKoop.set(a.kooperation_id, []);
      filesByKoop.get(a.kooperation_id).push(a);
    });

    return koopList.map(k => {
      const files = filesByKoop.get(k.id) || [];
      return {
        id: k.id,
        name: k.name || '',
        creatorName: [k.creator?.vorname, k.creator?.nachname].filter(Boolean).join(' '),
        folderUrl: files.find(f => f.folder_url)?.folder_url || null,
        files,
      };
    });
  }

  /**
   * Prueft eine Datei gegen Endung und Groessen-Cap.
   * @returns {{ok: true} | {ok: false, error: string}}
   */
  static validateFile(file) {
    if (!ROHMATERIAL_EXTENSIONS.test(file.name || '')) {
      return { ok: false, error: `${file.name}: nur Videos, Bilder oder ZIP erlaubt` };
    }
    if (!file.size) {
      return { ok: false, error: `${file.name}: Datei ist leer` };
    }
    if (file.size > MAX_ROHMATERIAL_SIZE) {
      return { ok: false, error: `${file.name}: zu groß (max. 20 GB)` };
    }
    return { ok: true };
  }

  /**
   * Laedt Dateien in den Rohmaterial-Ordner der Kooperation und legt pro Datei
   * eine Asset-Zeile an. Originalnamen bleiben erhalten.
   *
   * Teil-Erfolg ist moeglich: jede Datei wird einzeln abgearbeitet, ein Fehler
   * stoppt die restlichen nicht. Der Aufrufer bekommt beides zurueck.
   *
   * @param {{id: string}} group
   * @param {File[]} files
   * @param {(done: number, total: number, name: string) => void} [onProgress]
   * @param {(index: number, bytes: {loaded: number, total: number}) => void} [onBytes]
   *        optionaler Byte-Fortschritt je Datei (echter Upload-Stand)
   * @returns {Promise<{uploaded: number, errors: string[]}>}
   */
  static async uploadFiles(group, files, onProgress, onBytes) {
    const errors = [];
    let uploaded = 0;

    const taken = await this.takenFileNames(group.id);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      onProgress?.(i, files.length, file.name);

      const check = this.validateFile(file);
      if (!check.ok) {
        errors.push(check.error);
        continue;
      }

      try {
        await this.uploadOne(group, file, taken, {
          onBytes: onBytes
            ? ({ loaded, total }) => onBytes(i, { loaded: loaded ?? 0, total: total || file.size })
            : undefined,
        });
        uploaded++;
      } catch (err) {
        console.error('❌ RohmaterialService.uploadFiles:', err);
        errors.push(`${file.name}: ${err.message || 'Upload fehlgeschlagen'}`);
      }
    }

    onProgress?.(files.length, files.length, '');
    return { uploaded, errors };
  }

  /**
   * Eine (schon validierte) Datei hochladen und ihre Asset-Zeile anlegen. Wirft bei Fehlern.
   *
   * @param {{id: string, ordnerItemId?: string}} group ordnerItemId: Unterordner im Rohmaterial,
   *        sonst die Wurzel
   * @param {File} file
   * @param {Set<string>} taken belegte Dateinamen der Kooperation, wird ergaenzt
   * @param {{ signal?: AbortSignal, onBytes?: (p: {loaded: number, total: number}) => void }} [opts]
   */
  static async uploadOne(group, file, taken, { signal, onBytes } = {}) {
    const fileName = resolveRohmaterialName(sanitizeFileName(file.name), taken);
    // Sofort belegen, damit zwei gleichnamige Dateien derselben Auswahl
    // nicht beide auf denselben Pfad zeigen.
    taken.add(fileName);

    const ziel = await ablageZielHolen({
      typ: 'roh', kooperation_id: group.id, file_name: fileName, file_size: file.size,
      ...(group.ordnerItemId ? { ordner_item_id: group.ordnerItemId } : {}),
    });
    const commit = await hochladenNachSharePoint({ ziel, file, signal, onProgress: onBytes });
    const felder = sharePointAssetFelder(commit);
    if (felder.file_name) taken.add(felder.file_name);

    const { error: insertErr } = await window.supabase
      .from('kooperation_rohmaterial_asset')
      .insert({
        kooperation_id: group.id,
        ...felder,
        file_name: felder.file_name || fileName,
        file_size: felder.file_size ?? file.size,
        folder_url: commit.folder_url || null,
        uploaded_by: window.currentUser?.id || null,
        created_at: new Date().toISOString(),
      });
    if (insertErr) {
      await uploadVerwerfen(ziel.upload_id);
      throw insertErr;
    }
  }

  static async takenFileNames(kooperationId) {
    const { data } = await window.supabase
      .from('kooperation_rohmaterial_asset')
      .select('file_name')
      .eq('kooperation_id', kooperationId);
    return new Set((data || []).map(r => r.file_name).filter(Boolean));
  }

  /**
   * Loescht ein Rohmaterial-Asset: SharePoint-Datei in den Papierkorb, dann die Zeile.
   * Altbestand ausserhalb von SharePoint ist nur ein Link, da verschwindet nur die Zeile.
   *
   * @param {{id: string, ablage?: string}} asset
   */
  static async deleteAsset(asset) {
    if (!asset?.id) return;

    if (istSharePoint(asset)) {
      await ablageDateiLoeschen('roh', asset.id);
    }

    const { error } = await window.supabase
      .from('kooperation_rohmaterial_asset')
      .delete()
      .eq('id', asset.id);
    if (error) throw error;
  }
}

export default RohmaterialService;
