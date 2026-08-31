// RohmaterialService.js
// Rohmaterial einer Kampagne: laden, hochladen, loeschen.
//
// Rohmaterial ist der Creator-Intake (Dropbox: .../{Kooperation}/Rohmaterial/).
// Der Regelweg ist der tokenisierte Creator-Link; dieser Service deckt die
// interne Seite ab — Cutter sieht/laedt die Dateien, Mitarbeiter kann
// nachtraeglich selbst hochladen oder Fehlabgaben entfernen.
//
// Nur intern: RLS auf kooperation_rohmaterial_asset laesst Kunden gar nicht lesen.

import { uploadLargeFile } from '../../core/VideoUploadUtils.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';

const PREPARE_ENDPOINT = '/.netlify/functions/dropbox-upload-rohmaterial';

// Muss mit EXT_BY_TYPE/SIZE_CAPS.rohmaterial in
// netlify/functions/_shared/creator-upload.js laufen.
export const ROHMATERIAL_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm|zip)$/i;
export const MAX_ROHMATERIAL_SIZE = 10 * 1024 * 1024 * 1024;

/** Spiegelt sanitizePath aus netlify/functions/_shared/dropbox.js. */
export function sanitizeRohmaterialFileName(name) {
  if (!name) return '';
  return String(name)
    .replace(/[<>:"|?*\\/]/g, '-')
    .replace(/-{2,}/g, '-')
    .trim();
}

/**
 * Rohmaterial behaelt den Originalnamen und ueberschreibt nie — bei Kollision
 * _2, _3, ... vor der Extension. Gleiche Regel wie resolveFileNameCollision im
 * Creator-Upload, hier aber clientseitig: der Direct-Uploader committed mit
 * mode=overwrite, wuerde also stillschweigend die aeltere Datei ersetzen.
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
   * Der Dropbox-Pfadkontext (unternehmen/marke/kampagne/kooperation) wird pro
   * Gruppe mitgeliefert und muss zu loadPathContext() im Creator-Upload passen,
   * sonst landen Staff-Uploads in einem anderen Ordner als die Creator-Abgaben.
   *
   * @param {string} kampagneId
   * @returns {Promise<Array<{id, name, creatorName, folderUrl, files, pathContext}>>}
   */
  static async loadGroups(kampagneId) {
    if (!window.supabase || !kampagneId) return [];

    const { data: koops, error: koopErr } = await window.supabase
      .from('kooperationen')
      .select(`
        id, name,
        creator:creator_id (id, vorname, nachname),
        kampagne:kampagne_id (
          id, kampagnenname, eigener_name,
          unternehmen:unternehmen_id (id, firmenname),
          marke:marke_id (id, markenname)
        )
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
      .select('id, kooperation_id, file_name, file_path, file_url, file_size, folder_url, created_at')
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
      const kamp = k.kampagne || {};
      return {
        id: k.id,
        name: k.name || '',
        creatorName: [k.creator?.vorname, k.creator?.nachname].filter(Boolean).join(' '),
        folderUrl: files.find(f => f.folder_url)?.folder_url || null,
        files,
        pathContext: {
          unternehmen: kamp.unternehmen?.firmenname || '',
          marke: kamp.marke?.markenname || '',
          kampagne: KampagneUtils.getDisplayName(kamp),
          kooperation: k.name || '',
        },
      };
    });
  }

  /**
   * Prueft eine Datei gegen Endung und Groessen-Cap.
   * @returns {{ok: true} | {ok: false, error: string}}
   */
  static validateFile(file) {
    if (!ROHMATERIAL_EXTENSIONS.test(file.name || '')) {
      return { ok: false, error: `${file.name}: nur Video-Dateien oder ZIP erlaubt` };
    }
    if (!file.size) {
      return { ok: false, error: `${file.name}: Datei ist leer` };
    }
    if (file.size > MAX_ROHMATERIAL_SIZE) {
      return { ok: false, error: `${file.name}: zu groß (max. 10 GB)` };
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
   * @param {{id: string, pathContext: object}} group
   * @param {File[]} files
   * @param {(done: number, total: number, name: string) => void} [onProgress]
   * @returns {Promise<{uploaded: number, errors: string[]}>}
   */
  static async uploadFiles(group, files, onProgress) {
    const errors = [];
    let uploaded = 0;

    const taken = await this._takenFileNames(group.id);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      onProgress?.(i, files.length, file.name);

      const check = this.validateFile(file);
      if (!check.ok) {
        errors.push(check.error);
        continue;
      }

      try {
        const fileName = resolveRohmaterialName(
          sanitizeRohmaterialFileName(file.name), taken
        );
        // Sofort belegen, damit zwei gleichnamige Dateien derselben Auswahl
        // nicht beide auf denselben Pfad zeigen.
        taken.add(fileName);

        const prepare = await fetch(PREPARE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'prepare',
            ...group.pathContext,
            fileName,
          }),
        });
        if (!prepare.ok) {
          const errData = await prepare.json().catch(() => ({}));
          throw new Error(errData.error || `Vorbereitung fehlgeschlagen (${prepare.status})`);
        }
        const { token, dropboxPath, folderPath } = await prepare.json();

        await uploadLargeFile(file, dropboxPath, token);

        const [fileUrl, folderUrl] = await Promise.all([
          this._sharedLink(token, dropboxPath),
          this._sharedLink(token, folderPath),
        ]);

        const { error: insertErr } = await window.supabase
          .from('kooperation_rohmaterial_asset')
          .insert({
            kooperation_id: group.id,
            file_url: fileUrl,
            file_path: dropboxPath,
            file_name: fileName,
            file_size: file.size,
            folder_url: folderUrl,
            uploaded_by: window.currentUser?.id || null,
            created_at: new Date().toISOString(),
          });
        if (insertErr) throw insertErr;

        uploaded++;
      } catch (err) {
        console.error('❌ RohmaterialService.uploadFiles:', err);
        errors.push(`${file.name}: ${err.message || 'Upload fehlgeschlagen'}`);
      }
    }

    onProgress?.(files.length, files.length, '');
    return { uploaded, errors };
  }

  static async _takenFileNames(kooperationId) {
    const { data } = await window.supabase
      .from('kooperation_rohmaterial_asset')
      .select('file_name')
      .eq('kooperation_id', kooperationId);
    return new Set((data || []).map(r => r.file_name).filter(Boolean));
  }

  /**
   * Loescht ein Rohmaterial-Asset in Dropbox und in der Datenbank.
   * Ein fehlender Dropbox-Pfad (oder eine bereits geloeschte Datei) blockiert
   * das Entfernen der Zeile nicht — sonst bleiben Geister in der Liste.
   *
   * @param {{id: string, file_path?: string}} asset
   */
  static async deleteAsset(asset) {
    if (!asset?.id) return;

    if (asset.file_path) {
      try {
        await fetch('/.netlify/functions/dropbox-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: asset.file_path }),
        });
      } catch (err) {
        console.warn('Dropbox-Delete fehlgeschlagen:', err);
      }
    }

    const { error } = await window.supabase
      .from('kooperation_rohmaterial_asset')
      .delete()
      .eq('id', asset.id);
    if (error) throw error;
  }

  static async _sharedLink(token, path) {
    try {
      const resp = await fetch('/.netlify/functions/dropbox-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'shared-link', path, token }),
      });
      if (!resp.ok) return null;
      const { url } = await resp.json();
      return url ? url.replace(/([?&])dl=0\b/i, '$1raw=1') : null;
    } catch {
      return null;
    }
  }
}

export default RohmaterialService;
