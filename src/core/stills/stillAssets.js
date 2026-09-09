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
  if (videoId == null) return [];
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

function stillSortKey(a) {
  const fromName = String(a.variant_name || '').match(/(\d+)\s*$/);
  if (fromName) return Number(fromName[1]);
  const fromFile = String(a.file_name || '').match(/_(\d+)(?:\.[^.]+)?$/);
  if (fromFile) return Number(fromFile[1]);
  return Infinity;
}

export function sortStills(images) {
  return [...(images || [])].sort((a, b) => {
    const ka = stillSortKey(a);
    const kb = stillSortKey(b);
    if (ka !== kb) return ka - kb;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });
}

export function stillsForVersion(images, version) {
  const list = version === 'final'
    ? finalStills(images)
    : loopStills(images).filter(a => (a.version_number || 1) === version);
  return sortStills(list);
}

/**
 * Aktuelles Asset aus einer Liste ableiten: hoechste version_number,
 * dann neuestes created_at. is_current ist nur Tiebreak, nie Quelle.
 */
export function pickLatestAsset(assets) {
  if (!assets?.length) return null;
  return [...assets].sort((a, b) => {
    const va = a.version_number || 1;
    const vb = b.version_number || 1;
    if (vb !== va) return vb - va;
    const ta = a.created_at || '';
    const tb = b.created_at || '';
    if (tb !== ta) return tb.localeCompare(ta);
    if (a.is_current && !b.is_current) return -1;
    if (!a.is_current && b.is_current) return 1;
    return 0;
  })[0];
}

export function pickStillAsset(images, version, assetId) {
  const variants = stillsForVersion(images, version);
  if (assetId) return variants.find(a => a.id === assetId) || variants[0] || null;
  return pickLatestAsset(variants);
}

export function defaultStillSelection(images, { preferFinal = false } = {}) {
  const finals = finalStills(images);
  if (preferFinal && finals.length > 0) {
    return { selectedVersion: 'final', selectedAssetId: pickLatestAsset(finals).id };
  }
  const versions = stillVersions(images);
  if (versions.length === 0) {
    if (finals.length > 0) {
      return { selectedVersion: 'final', selectedAssetId: pickLatestAsset(finals).id };
    }
    const first = (images || [])[0];
    return { selectedVersion: first?.is_final ? 'final' : (first?.version_number || 1), selectedAssetId: first?.id || null };
  }
  const selectedVersion = versions[versions.length - 1];
  const variants = stillsForVersion(images, selectedVersion);
  const current = pickLatestAsset(variants);
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
