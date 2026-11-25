// Skript-Anschreiben: welche Creator an einem Skript haengen, wer im Pool adressierbar ist
// und welche Skripte ein Empfaenger (Creator, Management, Ansprechpartner) bekommt.

function profileOf(creator) {
  if (!creator?.id) return null;
  return {
    id: creator.id,
    vorname: creator.vorname || '',
    nachname: creator.nachname || '',
    mail: creator.mail || '',
    profilbild_url: creator.profilbild_url || '',
    profilbild_thumb_url: creator.profilbild_thumb_url || '',
    instagram: creator.instagram || '',
    tiktok: creator.tiktok || '',
  };
}

/** Kooperation-Video schlägt die Videoidee, sobald ein Video einen Creator hat. */
export function creatorProfileFuerSkript(skript, verknuepfungen) {
  let videoHatCreator = false;
  const fromVideo = [];
  const seen = new Set();
  for (const row of verknuepfungen || []) {
    const creator = row?.kooperation?.creator;
    if (!creator) continue;
    videoHatCreator = true;
    const profil = profileOf(creator);
    if (!profil || seen.has(profil.id)) continue;
    seen.add(profil.id);
    fromVideo.push(profil);
  }
  if (videoHatCreator) return fromVideo;
  const konzept = profileOf(skript?.strategie_item?.casting_eintrag?.creator);
  return konzept ? [konzept] : [];
}

export function creatorIdsImPool(items) {
  const ids = [];
  const seen = new Set();
  for (const item of items || []) {
    for (const id of item.creatorIds || []) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function poolCreators(items) {
  const byId = new Map();
  let skipped = 0;
  for (const item of items || []) {
    for (const profil of item.creators || []) {
      if (!profil?.id || byId.has(profil.id)) continue;
      const email = String(profil.mail || '').trim();
      if (!email) {
        skipped += 1;
        byId.set(profil.id, null);
        continue;
      }
      const name = [profil.vorname, profil.nachname].filter(Boolean).join(' ') || email;
      byId.set(profil.id, {
        id: profil.id,
        email,
        name,
        vorname: profil.vorname || '',
      });
    }
  }
  return { creators: [...byId.values()].filter(Boolean), skipped };
}

function anzeigeFuer(profil, fallback) {
  const name = [profil?.vorname, profil?.nachname].filter(Boolean).join(' ') || fallback?.name || '';
  if (!name && !profil) return fallback || null;
  return {
    name: name || 'Creator',
    bildUrl: profil?.profilbild_url || profil?.profilbild_thumb_url || fallback?.bildUrl || '',
    instagram: profil?.instagram || fallback?.instagram || '',
  };
}

export function skripteFuerEmpfaenger(items, empfaenger, managementCreators = {}) {
  const list = items || [];
  if (empfaenger?.typ === 'ansprechpartner') return list;
  if (empfaenger?.typ === 'creator') {
    return list
      .filter((item) => (item.creatorIds || []).includes(empfaenger.id))
      .map((item) => {
        const profil = (item.creators || []).find((c) => c.id === empfaenger.id);
        const andererCreator = Boolean(item.creatorId) && item.creatorId !== empfaenger.id;
        if (!andererCreator) return { ...item, creator: anzeigeFuer(profil, item.creator) };
        const creator = anzeigeFuer(profil, null);
        return { ...item, creator, instagram: creator?.instagram || '', tiktok: profil?.tiktok || '' };
      });
  }
  if (empfaenger?.typ === 'management') {
    const ids = new Set(managementCreators[empfaenger.id] || []);
    return list.filter((item) => (item.creatorIds || []).some((id) => ids.has(id)));
  }
  return [];
}

export async function loadManagementScope(db, creatorIds) {
  if (!creatorIds?.length) return [];
  const { data, error } = await db
    .from('creator_management')
    .select('creator_id, management:management_id(id, firmenname, email)')
    .in('creator_id', creatorIds)
    .eq('ist_aktiv', true);
  if (error) throw error;
  const byId = new Map();
  for (const row of data || []) {
    const management = row.management;
    const email = String(management?.email || '').trim();
    if (!management?.id || !email || !row.creator_id) continue;
    const prev = byId.get(management.id) || {
      id: management.id,
      email,
      name: management.firmenname || email,
      vorname: '',
      creatorIds: [],
    };
    if (!prev.creatorIds.includes(row.creator_id)) prev.creatorIds.push(row.creator_id);
    byId.set(management.id, prev);
  }
  return [...byId.values()];
}
