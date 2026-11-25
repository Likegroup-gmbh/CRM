// _shared/creator-upload-ziel.js
// Was darf der Token-Inhaber hochladen? Laedt die aktuellen Kooperationen des Creators in der
// Kampagne und prueft ein Upload-Ziel dagegen (Video, Story, Bilder, Rohmaterial).

// ─── Live-Membership ────────────────────────────────────────
// Laedt die aktuellen Kooperationen des Creators in der Kampagne inkl. Slots
// und belegten Feedbackschleifen. Keine URLs, keine Pfade, keine Preise.

async function loadMembership(supabase, tokenRow) {
  const { data: koops, error: koopErr } = await supabase
    .from('kooperationen')
    .select('id, name, kampagne:kampagne_id(id, kampagnenname, eigener_name)')
    .eq('kampagne_id', tokenRow.kampagne_id)
    .eq('creator_id', tokenRow.creator_id)
    .order('created_at', { ascending: true });
  if (koopErr) throw koopErr;

  const koopList = koops || [];
  if (koopList.length === 0) {
    return { kampagne: '', kooperationen: [] };
  }

  const koopIds = koopList.map(k => k.id);

  const { data: videos, error: vidErr } = await supabase
    .from('kooperation_videos')
    .select('id, kooperation_id, position, thema, video_name')
    .in('kooperation_id', koopIds)
    .order('position', { ascending: true });
  if (vidErr) throw vidErr;

  const videoList = videos || [];
  const videoIds = videoList.map(v => v.id);

  const { data: storySlotRows, error: storyErr } = videoIds.length
    ? await supabase.from('kooperation_story').select('id, video_id, slot_index, slot_name').in('video_id', videoIds).order('slot_index', { ascending: true })
    : { data: [], error: null };
  if (storyErr) throw storyErr;

  const storySlots = storySlotRows || [];
  const storyIds = storySlots.map(s => s.id);

  const [videoAssetsRes, storyAssetsRes, bilderRes, rohmaterialRes] = await Promise.all([
    videoIds.length
      ? supabase.from('kooperation_video_asset').select('video_id, version_number').in('video_id', videoIds).eq('is_final', false)
      : Promise.resolve({ data: [], error: null }),
    storyIds.length
      ? supabase.from('kooperation_story_asset').select('story_id, version_number').in('story_id', storyIds).eq('is_final', false)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('kooperation_bilder_asset').select('kooperation_id').in('kooperation_id', koopIds),
    supabase
      .from('kooperation_rohmaterial_asset')
      .select('kooperation_id, file_name, file_size, created_at')
      .in('kooperation_id', koopIds)
      .order('created_at', { ascending: true }),
  ]);

  const storyAssets = storyAssetsRes.data || [];
  const videoAssets = videoAssetsRes.data || [];
  const bilderRows = bilderRes.data || [];
  const rohmaterialRows = rohmaterialRes.data || [];

  const fsByVideo = {};
  videoAssets.forEach(a => {
    if (!fsByVideo[a.video_id]) fsByVideo[a.video_id] = [];
    if (a.version_number != null) fsByVideo[a.video_id].push(a.version_number);
  });
  const fsByStory = {};
  storyAssets.forEach(a => {
    if (!fsByStory[a.story_id]) fsByStory[a.story_id] = [];
    if (a.version_number != null) fsByStory[a.story_id].push(a.version_number);
  });
  const bilderCountByKoop = {};
  bilderRows.forEach(b => {
    bilderCountByKoop[b.kooperation_id] = (bilderCountByKoop[b.kooperation_id] || 0) + 1;
  });

  // Nur Name/Groesse: der Creator soll sehen was angekommen ist, aber keine
  // Pfade oder Links.
  const rohmaterialByKoop = {};
  rohmaterialRows.forEach(r => {
    if (!rohmaterialByKoop[r.kooperation_id]) rohmaterialByKoop[r.kooperation_id] = [];
    rohmaterialByKoop[r.kooperation_id].push({
      name: r.file_name || '',
      size: r.file_size || 0,
    });
  });

  const storysByVideo = {};
  storySlots.forEach(s => {
    if (!storysByVideo[s.video_id]) storysByVideo[s.video_id] = [];
    storysByVideo[s.video_id].push({
      id: s.id,
      slotIndex: s.slot_index,
      slotName: s.slot_name || null,
      fs: (fsByStory[s.id] || []).sort((a, b) => a - b),
    });
  });

  const videosByKoop = {};
  videoList.forEach(v => {
    if (!videosByKoop[v.kooperation_id]) videosByKoop[v.kooperation_id] = [];
    videosByKoop[v.kooperation_id].push({
      id: v.id,
      position: v.position,
      thema: v.thema || null,
      titel: v.video_name || null,
      fs: (fsByVideo[v.id] || []).sort((a, b) => a - b),
      storys: storysByVideo[v.id] || [],
    });
  });

  const firstKamp = koopList[0].kampagne;
  return {
    kampagne: firstKamp ? (firstKamp.kampagnenname || firstKamp.eigener_name || '') : '',
    kooperationen: koopList.map(k => ({
      id: k.id,
      name: k.name || '',
      videos: videosByKoop[k.id] || [],
      bilderCount: bilderCountByKoop[k.id] || 0,
      rohmaterial: rohmaterialByKoop[k.id] || [],
    })),
  };
}

// ─── Ziel-Validierung gegen Membership ──────────────────────
// Gibt Kontext fuer Pfad/DB-Zeile zurueck oder null (Ziel gehoert nicht zum Token).

async function resolveTarget(supabase, tokenRow, targetType, targetId) {
  const membership = await loadMembership(supabase, tokenRow);
  const koopIds = membership.kooperationen.map(k => k.id);

  if (targetType === 'video') {
    for (const koop of membership.kooperationen) {
      const video = koop.videos.find(v => v.id === targetId);
      if (video) return { kind: 'video', koop, video, membership };
    }
    return null;
  }

  if (targetType === 'story') {
    for (const koop of membership.kooperationen) {
      for (const video of koop.videos) {
        const story = video.storys.find(s => s.id === targetId);
        if (story) return { kind: 'story', koop, video, story, membership };
      }
    }
    return null;
  }

  // bilder + rohmaterial haengen auf Kooperations-Ebene, nicht an einem Video-Slot
  if (targetType === 'bilder' || targetType === 'rohmaterial') {
    const koop = membership.kooperationen.find(k => k.id === targetId);
    if (koop && koopIds.includes(targetId)) return { kind: targetType, koop, membership };
    return null;
  }

  return null;
}

module.exports = { loadMembership, resolveTarget };
