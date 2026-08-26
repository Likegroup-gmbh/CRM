export const STILL_FINAL_VARIANT = 'Still';

export const BILDER_ASSET_SELECT =
  'id, kooperation_id, video_id, file_url, file_path, file_name, file_size, version_number, is_current, is_final, variant_name, source_asset_id, created_at';

export function loopStills(images) {
  return (images || []).filter(a => !a.is_final);
}

export function finalStills(images) {
  return (images || []).filter(a => !!a.is_final);
}

export function stillsForVideo(images, videoId) {
  return (images || []).filter(a => a.video_id === videoId);
}

/** Stills in der Tabellen-Zelle: eigene des Videos, sonst unzugeordnete Altbilder. */
export function stillsForVideoCell(koop, video) {
  const all = Array.isArray(koop?._bilder) ? koop._bilder : [];
  const assigned = stillsForVideo(all, video.id);
  if (assigned.length) return assigned;
  return all.filter(b => b.video_id == null);
}

export function stillVersions(images) {
  return [...new Set(loopStills(images).map(a => a.version_number || 1))].sort((a, b) => a - b);
}

export function stillsForVersion(images, version) {
  if (version === 'final') return finalStills(images);
  return loopStills(images).filter(a => (a.version_number || 1) === version);
}

export function pickStillAsset(images, version, assetId) {
  const variants = stillsForVersion(images, version);
  if (assetId) return variants.find(a => a.id === assetId) || variants[0] || null;
  return variants.find(a => a.is_current) || variants[0] || null;
}

export function defaultStillSelection(images, { preferFinal = false } = {}) {
  const finals = finalStills(images);
  if (preferFinal && finals.length > 0) {
    return { selectedVersion: 'final', selectedAssetId: finals[0].id };
  }
  const versions = stillVersions(images);
  if (versions.length === 0) {
    if (finals.length > 0) {
      return { selectedVersion: 'final', selectedAssetId: finals[0].id };
    }
    const first = (images || [])[0];
    return { selectedVersion: first?.is_final ? 'final' : (first?.version_number || 1), selectedAssetId: first?.id || null };
  }
  const selectedVersion = versions[versions.length - 1];
  const variants = stillsForVersion(images, selectedVersion);
  const current = variants.find(a => a.is_current) || variants[0] || null;
  return { selectedVersion, selectedAssetId: current?.id || null };
}

export async function updateStillCurrentFlags(videoId) {
  if (!videoId || !window.supabase) return;
  const { data: assets } = await window.supabase
    .from('kooperation_bilder_asset')
    .select('id, version_number, is_final')
    .eq('video_id', videoId);

  const loop = (assets || []).filter(a => !a.is_final);
  if (loop.length === 0) return;
  const maxVersion = Math.max(...loop.map(a => a.version_number || 1));
  const nonCurrentIds = loop.filter(a => (a.version_number || 1) !== maxVersion).map(a => a.id);
  const currentIds = loop.filter(a => (a.version_number || 1) === maxVersion).map(a => a.id);

  if (nonCurrentIds.length > 0) {
    await window.supabase
      .from('kooperation_bilder_asset')
      .update({ is_current: false })
      .in('id', nonCurrentIds);
  }
  if (currentIds.length > 0) {
    await window.supabase
      .from('kooperation_bilder_asset')
      .update({ is_current: true })
      .in('id', currentIds);
  }
}
