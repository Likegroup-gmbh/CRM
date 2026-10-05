// playerDownload
// Download des aktuell angezeigten Mediums. Quelle und Dateiname leiten sich aus
// dem aufgeloesten Medium ab (resolveItemMedia); fuer Videos greift derselbe
// Name wie beim Upload (inkl. Video-Nr).

import { downloadMediaAsset } from '../downloadMediaAsset.js';
import { buildAssetDownloadName } from '../../VideoUploadUtils.js';
import { resolveCurrentMedia } from './resolveItemMedia.js';

function buildVideoFilename(session, asset, video, lookup) {
  // Gleicher Name wie beim Upload (inkl. Video-Nr), damit der Kunde am
  // Dateinamen erkennt, um welches Video des Creators es sich handelt.
  const koop = session.current?.koop;
  const info = session.table?.kampagneInfo || {};
  const meta = {
    creatorName: `${koop?.creator?.vorname || ''} ${koop?.creator?.nachname || ''}`.trim(),
    unternehmen: info.unternehmen || '',
    kampagne: info.name || '',
  };
  const source = asset || { is_final: false, version_number: null, ...lookup };
  return buildAssetDownloadName(meta, video, source);
}

export function downloadCurrentMedia(session, assetLoader) {
  const item = session.current;
  const media = resolveCurrentMedia(session, assetLoader);
  if (!item || !media) return;

  // Ohne gewaehltes Asset (Legacy-Video) liefert der Lookup die Quelle.
  const source = media.asset || media.lookup;
  let filename;
  if (item.type === 'video') {
    filename = buildVideoFilename(session, media.asset, item.video, media.lookup);
  } else if (item.type === 'story') {
    filename = media.asset?.file_name || `${item.slot.slot_name || 'Story'}_v${session.story.version || 1}`;
  } else {
    filename = media.asset?.file_name || 'Still';
  }

  if (!source.file_path && !source.file_url) {
    window.toastSystem?.show('Kein Inhalt zum Herunterladen.', 'error');
    return;
  }
  downloadMediaAsset(source, filename);
}
