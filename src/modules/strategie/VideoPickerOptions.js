// VideoPickerOptions.js
// Label-Builder und Optionen für gruppierte Video-Picker (Kooperation → Video)

function getCreatorName(koop) {
  if (!koop?.creator) return '';
  return `${koop.creator.vorname || ''} ${koop.creator.nachname || ''}`.trim();
}

function buildKooperationGroupLabel(koop) {
  const creatorName = getCreatorName(koop);
  const koopName = koop?.name || 'Kooperation';
  return creatorName ? `${koopName} (${creatorName})` : koopName;
}

export function buildVideoDisplayName(video, koop) {
  const name = video.video_name || video.thema || video.titel;
  const pos = video.position;
  const total = koop?.videoanzahl;
  const posLabel = total ? `Video ${pos}/${total}` : `Video ${pos}`;
  return name ? `${posLabel} · ${name}` : posLabel;
}

function buildVideoSubtitle(video) {
  return [video.content_art, video.kampagnenart].filter(Boolean).join(' · ');
}

export function buildVideoPickerOptions(kooperationen, videos) {
  const videosByKoop = new Map();

  (videos || []).forEach(video => {
    const koopId = video.kooperation_id;
    if (!videosByKoop.has(koopId)) videosByKoop.set(koopId, []);
    videosByKoop.get(koopId).push(video);
  });

  const options = [];

  (kooperationen || [])
    .filter(koop => videosByKoop.has(koop.id))
    .forEach(koop => {
      const group = buildKooperationGroupLabel(koop);
      const koopVideos = videosByKoop.get(koop.id) || [];

      koopVideos
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .forEach(video => {
          const subtitle = buildVideoSubtitle(video);
          options.push({
            value: video.id,
            label: buildVideoDisplayName(video, koop),
            group,
            ...(subtitle ? { subtitle } : {})
          });
        });
    });

  return options;
}
