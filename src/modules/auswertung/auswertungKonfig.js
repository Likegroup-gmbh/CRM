// auswertungKonfig.js
// Plattformen und Kennzahlen eines Posts (CONTEXT.md „Post“). Einzige Stelle, die festlegt,
// welche Kennzahl auf welcher Plattform erfasst wird: Tabelle, Detail-Panel, Formular, CSV und
// KI-Schema lesen von hier. Ein Feld, das die Plattform nicht hat, bleibt leer und ist nie 0.

export const PLATTFORMEN = {
  ig_reel: { label: 'Instagram-Reel', kurz: 'Reel', icon: 'instagram', basis: 'reach' },
  ig_story: { label: 'Instagram-Story', kurz: 'Story', icon: 'instagram', basis: 'reach' },
  ig_post: { label: 'Instagram-Post', kurz: 'Post', icon: 'instagram', basis: 'reach' },
  tiktok: { label: 'TikTok', kurz: 'TikTok', icon: 'tiktok', basis: 'views' }
};

// Aufrufe zählen jede Wiedergabe, Betrachter jedes Konto einmal (bei Instagram früher „Erreichte
// Konten“). Nie gegeneinander tauschen oder auffüllen.
export const KENNZAHLEN = {
  views: { label: 'Aufrufe' },
  reach: { label: 'Betrachter' },
  likes: { label: 'Likes' },
  comments: { label: 'Kommentare' },
  shares: { label: 'Geteilt' },
  saves: { label: 'Gespeichert' },
  replies: { label: 'Antworten' },
  linkClicks: { label: 'Link-Klicks' },
  stickerTaps: { label: 'Sticker-Taps' },
  exits: { label: 'Verlassen' },
  avgWatchSec: { label: 'Ø Wiedergabe', einheit: 'Sek.' },
  completionPct: { label: 'Komplett angesehen', einheit: '%' }
};

export const PLATTFORM_FELDER = {
  ig_reel: ['views', 'reach', 'likes', 'comments', 'shares', 'saves', 'avgWatchSec'],
  ig_story: ['views', 'reach', 'linkClicks', 'stickerTaps', 'likes', 'replies', 'shares', 'exits'],
  ig_post: ['views', 'reach', 'likes', 'comments', 'shares', 'saves'],
  tiktok: ['views', 'likes', 'comments', 'shares', 'saves', 'avgWatchSec', 'completionPct']
};

/** Unter dieser Konfidenz markiert das Formular einen von der KI gelesenen Wert mit „bitte prüfen“. */
export const KI_SCHWELLE = 0.8;

/** Felder, die zu den Interaktionen zählen. Fehlt eines am Post, zählt es 0. */
export const INTERAKTIONEN = ['likes', 'comments', 'shares', 'saves', 'replies'];

/** Plattform, die zu einer Einheit ohne Post vermutlich passt (Formular „Manuell eintragen“). */
export const STANDARD_PLATTFORM = { video: 'ig_reel', story: 'ig_story', still: 'ig_post' };

/**
 * Plattform aus dem Link eines Posts, null wenn der Link keine verrät. Instagram zeigt Reels auch
 * unter /p/; an einem Video (`art`) ist das ein Reel, sonst ein Bild-Post.
 */
export function plattformAusLink(url, art = null) {
  const text = String(url || '').toLowerCase();
  if (text.includes('tiktok.com')) return 'tiktok';
  if (!text.includes('instagram.com')) return null;
  if (text.includes('/stories/')) return 'ig_story';
  if (text.includes('/p/')) return art === 'video' ? 'ig_reel' : 'ig_post';
  return 'ig_reel';
}

/** Messregel in Tagen nach dem Post, bis die Kampagne eine eigene hat. */
export const MESSREGEL_TAGE = 7;

export function felderDerPlattform(plattform) {
  return PLATTFORM_FELDER[plattform] || [];
}
