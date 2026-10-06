// Konzept-Inhalte für die Kooperationstabelle.
// Anzeige only: umgesetzte Videoidee und ihr Skript hängen über den Creator,
// nicht über strategie_item_id / skript_id am Kooperationsvideo.

export function creatorIdOfIdee(idee) {
  return idee?.casting_eintrag?.creator_id || idee?.creator_id || null;
}

function vergleicheIdeen(a, b) {
  const ka = a.konzeptIndex ?? 0;
  const kb = b.konzeptIndex ?? 0;
  if (ka !== kb) return ka - kb;
  return (a.sortierung ?? 0) - (b.sortierung ?? 0);
}

function skriptIstNeuer(a, b) {
  const ta = a.created_at || '';
  const tb = b.created_at || '';
  if (ta !== tb) return ta > tb;
  return String(a.id) > String(b.id);
}

function displayIdee(idee) {
  return {
    id: idee.id,
    screenshot_url: idee.screenshot_url || null,
    beschreibung: idee.beschreibung || null,
    strategie_id: idee.strategie_id || null,
    video_link: idee.video_link || null,
    produkt: idee.produkt ? { id: idee.produkt.id, name: idee.produkt.name } : null
  };
}

function poolKey(creatorId, produktionId, briefingId = null) {
  const base = produktionId ? `${creatorId}:${produktionId}` : creatorId;
  return briefingId ? `${base}:${briefingId}` : base;
}

// Kooperation ohne Linie (Altbestand): nimmt den Pool ihrer Produktion, egal welche Linie.
function poolFuerKoop(pools, koop) {
  const exakt = poolKey(koop.creator_id, koop.produktion_id || null, koop.briefing_id || null);
  if (pools.has(exakt) || koop.briefing_id) return pools.get(exakt) || [];
  const prefix = `${poolKey(koop.creator_id, koop.produktion_id || null)}:`;
  for (const [key, pool] of pools) {
    if (key.startsWith(prefix) && pool.length) return pool;
  }
  return [];
}

function istZuordenbareIdee(idee) {
  return !!(idee && idee.ist_vorschlag !== true && idee.video_umgesetzt && creatorIdOfIdee(idee));
}

/**
 * Ordnet Videoideen und Skripte den Videos einer Kooperation zu.
 * Gespeicherte strategie_item_id / skript_id bleiben. Freie Slots bekommen
 * die nächsten noch nicht vergebenen Ideen des Creators in Konzept-Reihenfolge.
 * Mehr Videos als Ideen: übrige Slots bleiben leer.
 */
export function zuordnenKonzeptInhalte(kooperationen, videosByKoopId, ideen, skripte) {
  const videosByKoop = videosByKoopId || {};
  const consumed = new Set();
  for (const videos of Object.values(videosByKoop)) {
    for (const video of videos || []) {
      if (video?.strategie_item_id) consumed.add(video.strategie_item_id);
    }
  }

  const skriptByItem = new Map();
  for (const skript of skripte || []) {
    if (!skript?.strategie_item_id || !skript.id) continue;
    const prev = skriptByItem.get(skript.strategie_item_id);
    if (!prev || skriptIstNeuer(skript, prev)) skriptByItem.set(skript.strategie_item_id, skript);
  }

  const pools = new Map();
  const passende = (ideen || []).filter(istZuordenbareIdee).sort(vergleicheIdeen);
  for (const idee of passende) {
    if (consumed.has(idee.id)) continue;
    const key = poolKey(creatorIdOfIdee(idee), idee.produktion_id || null, idee.briefing_id || null);
    if (!pools.has(key)) pools.set(key, []);
    pools.get(key).push(idee);
  }

  const result = {};
  const seenKoops = new Set();

  for (const koop of kooperationen || []) {
    seenKoops.add(koop.id);
    const videos = [...(videosByKoop[koop.id] || [])].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );
    const pool = poolFuerKoop(pools, koop);
    let cursor = 0;

    result[koop.id] = videos.map(video => {
      const next = { ...video };
      let itemId = video.strategie_item_id || null;

      if (!itemId) {
        const idee = pool[cursor];
        if (idee) {
          cursor += 1;
          itemId = idee.id;
          next.strategie_item = displayIdee(idee);
          next._ideeAusKonzept = true;
        }
      }

      if (!video.skript_id && itemId) {
        const skript = skriptByItem.get(itemId);
        if (skript) {
          next.skript = { id: skript.id, titel: skript.titel, status: skript.status };
          next._skriptAusKonzept = true;
          // Virtuell verknüpft: die Freigabe-Checkbox spiegelt den
          // Skript-Status, die DB-Spalte des Videos bleibt unbeteiligt.
          next.skript_freigegeben = skript.status === 'freigegeben';
        }
      }

      return next;
    });

    if (cursor > 0) pool.splice(0, cursor);
  }

  for (const [koopId, videos] of Object.entries(videosByKoop)) {
    if (!seenKoops.has(koopId)) result[koopId] = videos;
  }
  return result;
}

export async function loadKonzeptInhalte(client, { kampagneId, produktionId = null, briefingId = null } = {}) {
  if (!client) return { ideen: [], skripte: [] };

  let query = client.from('strategie').select('id, produktion_id, briefing_id').order('created_at', { ascending: true });
  if (produktionId) query = query.eq('produktion_id', produktionId);
  else if (kampagneId) query = query.eq('kampagne_id', kampagneId);
  else return { ideen: [], skripte: [] };
  if (briefingId) query = query.eq('briefing_id', briefingId);

  const { data: strategien, error } = await query;
  if (error) throw new Error(error.message || 'Konzepte konnten nicht geladen werden');

  const liste = strategien || [];
  if (!liste.length) return { ideen: [], skripte: [] };

  const index = new Map(liste.map((s, i) => [s.id, i]));
  const produktionByStrategie = new Map(liste.map(s => [s.id, s.produktion_id || null]));
  const briefingByStrategie = new Map(liste.map(s => [s.id, s.briefing_id || null]));

  const { data: items, error: itemsError } = await client
    .from('strategie_items')
    .select('id, beschreibung, screenshot_url, video_link, strategie_id, sortierung, video_umgesetzt, ist_vorschlag, creator_id, produkt:produkt_id(id, name), casting_eintrag:creator_auswahl_item_id(creator_id)')
    .in('strategie_id', liste.map(s => s.id))
    .eq('video_umgesetzt', true)
    .order('sortierung', { ascending: true });
  if (itemsError) throw new Error(itemsError.message || 'Videoideen konnten nicht geladen werden');

  const ideen = (items || []).map(item => ({
    ...item,
    konzeptIndex: index.get(item.strategie_id) ?? 0,
    produktion_id: produktionByStrategie.get(item.strategie_id) || null,
    briefing_id: briefingByStrategie.get(item.strategie_id) || null
  }));

  const itemIds = ideen.map(item => item.id).filter(Boolean);
  if (!itemIds.length) return { ideen, skripte: [] };

  const { data: skripte, error: skriptError } = await client
    .from('skripte')
    .select('id, titel, status, strategie_item_id, created_at')
    .in('strategie_item_id', itemIds);
  if (skriptError) throw new Error(skriptError.message || 'Skripte konnten nicht geladen werden');

  return { ideen, skripte: skripte || [] };
}
