// _shared/post-kennzahlen.js
// CommonJS-Kopie der Plattform-Felder aus src/modules/auswertung/auswertungKonfig.js für die
// Functions (KI-Schema, Feldfilter). auswertungKonfigSync.test.js hält beide gleich: wer hier oder
// dort ein Feld ändert, ändert beide Stellen.

const PLATTFORMEN = ['ig_reel', 'ig_story', 'ig_post', 'tiktok'];

const PLATTFORM_FELDER = {
  ig_reel: ['views', 'reach', 'likes', 'comments', 'shares', 'saves', 'avgWatchSec'],
  ig_story: ['views', 'reach', 'linkClicks', 'stickerTaps', 'likes', 'replies', 'shares', 'exits'],
  ig_post: ['views', 'reach', 'likes', 'comments', 'shares', 'saves'],
  tiktok: ['views', 'likes', 'comments', 'shares', 'saves', 'avgWatchSec', 'completionPct']
};

const KI_SCHWELLE = 0.8;

const felderDerPlattform = (plattform) => PLATTFORM_FELDER[plattform] || [];

module.exports = { PLATTFORMEN, PLATTFORM_FELDER, KI_SCHWELLE, felderDerPlattform };
