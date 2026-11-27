// _shared/tiktok/ergebnis.js
// Dataset-Items des Actors clockworks/tiktok-scraper (Admin-Seite TikTok-API, Profilabruf):
// Videos, Profile (aus authorMeta, je Username einmal) und Fehler-Items.

const zahlOderNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const textOderNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function videoZeile(item) {
  const autor = item.authorMeta || {};
  const meta = item.videoMeta || {};
  return {
    id: String(item.id || ''),
    url: textOderNull(item.webVideoUrl) || textOderNull(item.submittedVideoUrl),
    autor: textOderNull(autor.name),
    autorName: textOderNull(autor.nickName),
    text: typeof item.text === 'string' ? item.text : '',
    datum: textOderNull(item.createTimeISO),
    aufrufe: zahlOderNull(item.playCount),
    likes: zahlOderNull(item.diggCount),
    kommentare: zahlOderNull(item.commentCount),
    shares: zahlOderNull(item.shareCount),
    gespeichert: zahlOderNull(item.collectCount),
    dauer: zahlOderNull(meta.duration) || null,
    cover: textOderNull(meta.coverUrl) || textOderNull(meta.originalCoverUrl),
    werbung: Boolean(item.isAd || item.isSponsored),
    angepinnt: Boolean(item.isPinned),
    quelle: item.fromProfileSection ? 'profil' : 'link',
  };
}

function profilKarte(autor) {
  const name = textOderNull(autor.name);
  return {
    name,
    nickName: textOderNull(autor.nickName),
    url: textOderNull(autor.profileUrl) || `https://www.tiktok.com/@${name}`,
    follower: zahlOderNull(autor.fans),
    folgt: zahlOderNull(autor.following),
    likes: zahlOderNull(autor.heart),
    videos: zahlOderNull(autor.video),
    verifiziert: Boolean(autor.verified),
    privat: Boolean(autor.privateAccount),
    avatar: textOderNull(autor.avatar) || textOderNull(autor.originalAvatarUrl),
    bio: textOderNull(autor.signature),
    bioLink: textOderNull(autor.bioLink),
  };
}

// Manche Fehler-Items tragen nur error, ohne errorCode; ein Video hat immer eine id
const istFehlerItem = (item) => !!item.errorCode || (!!textOderNull(item.error) && !item.id);

function fehlerZeile(item) {
  const code = item.errorCode ? String(item.errorCode) : 'FEHLER';
  return {
    eingabe: textOderNull(item.input) || textOderNull(item.url),
    url: textOderNull(item.url),
    code,
    text: textOderNull(item.error) || code,
  };
}

/** @returns {{ videos: object[], profile: object[], fehler: object[] }} */
function auswerten(items) {
  const videos = [];
  const fehler = [];
  const profile = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (istFehlerItem(item)) {
      fehler.push(fehlerZeile(item));
      return;
    }
    videos.push(videoZeile(item));
    const name = textOderNull(item.authorMeta?.name)?.toLowerCase();
    if (name && !profile.has(name)) profile.set(name, profilKarte(item.authorMeta));
  });
  return { videos, profile: [...profile.values()], fehler };
}

module.exports = { videoZeile, profilKarte, fehlerZeile, auswerten };
