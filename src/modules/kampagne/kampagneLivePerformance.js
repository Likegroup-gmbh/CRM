// kampagneLivePerformance.js
// Kachel „Live-Performance“ (ADR 0078): Summe der bestätigten Posts aus kooperation_post, nicht
// mehr stats_* am Video. Ein Video mit Reel und TikTok zählt mit beiden Posts. Kunden lesen
// kooperation_post nicht (RLS), für sie bleibt die Kachel weg. Ohne Imports, damit die Auswertung
// das Modul ohne Zyklus nutzen kann.

// video_id, plattform, account_handle, link und measured_at für Live Link und Zahlen in der Kooperationstabelle
export const LIVE_POST_SELECT = 'id, kooperation_id, video_id, plattform, account_handle, link, measured_at, metrics';

/** Bestätigte Posts der Kampagne; der Scope (Produktion, Linie, Tags) filtert später über die Kooperationen. */
export async function ladeLivePosts(kampagneId, { isKunde = false } = {}) {
  if (isKunde || !kampagneId) return [];
  const { data, error } = await window.supabase
    .from('kooperation_post')
    .select(LIVE_POST_SELECT)
    .eq('kampagne_id', kampagneId)
    .eq('status', 'confirmed');
  if (error) throw error;
  return data || [];
}

const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** @param {string[]|null} koopIds - null: alle Posts */
export function summiereLivePerformance(posts, koopIds = null) {
  const ids = koopIds ? new Set(koopIds) : null;
  return (posts || [])
    .filter(p => !ids || ids.has(p.kooperation_id))
    .reduce((s, p) => ({
      views: s.views + zahl(p.metrics?.views),
      likes: s.likes + zahl(p.metrics?.likes),
      comments: s.comments + zahl(p.metrics?.comments),
      posts: s.posts + 1
    }), { views: 0, likes: 0, comments: 0, posts: 0 });
}

/** Post aus der Auswertung einrechnen: bestätigt rein, Entwurf oder gelöscht raus. */
export function mitLivePost(posts, post, { weg = false } = {}) {
  const rest = (posts || []).filter(p => p.id !== post.id);
  if (weg || post.status !== 'confirmed') return rest;
  const [art, ankerId] = String(post.einheitId || '').split(':');
  return [...rest, {
    id: post.id,
    kooperation_id: post.kooperationId,
    video_id: art === 'video' && ankerId ? ankerId : null,
    plattform: post.plattform || null,
    account_handle: post.accountHandle || null,
    link: post.link || null,
    measured_at: post.measuredAt || null,
    metrics: post.metrics || {}
  }];
}
