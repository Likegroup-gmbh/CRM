// Die letzten Reels für die Creator-Akte.
// Posts und Werbe-Kennzeichnungen bleiben draußen. Dieselbe Erkennung wie der CPM-Rechner.
// Meta liefert für fremde Profile keinen Co-Post.

const { istWerbePost } = require('./instagram-cpm');

const REEL_ANZEIGE_LIMIT = 15;

function waehleAnzeigeReels(posts) {
  const reels = [];
  for (const post of posts || []) {
    if (post?.media_type !== 'VIDEO') continue;
    if (istWerbePost(post.caption)) continue;
    reels.push(post);
    if (reels.length >= REEL_ANZEIGE_LIMIT) break;
  }
  return reels;
}

module.exports = {
  REEL_ANZEIGE_LIMIT,
  waehleAnzeigeReels
};
