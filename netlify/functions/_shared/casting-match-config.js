// casting-match-config.js
// Einzige Stelle fuer alle Gewichte, Quoten und Schwellen der
// Casting-Creator-Vorschlaege (ADR 0013). Die Function bekommt die Config als
// Argument, nie Literale in Formeln. Der Job speichert CONFIG_VERSION, damit
// alte Listen spaeter noch erklaerbar sind.

const CONFIG_VERSION = 1;

// bereich (campaign_briefings) -> Feld-Prefix + Casting-Typ
const BEREICH_PREFIX = {
  influencer_marketing: 'im',
  paid_creator_ads: 'pa',
  owned_social: 'os'
};

const BEREICH_TYP = {
  influencer_marketing: 'Influencer',
  paid_creator_ads: 'UGC Paid',
  owned_social: 'UGC Organic'
};

// Groessen-Band -> Follower-Fenster (eine Quelle: IG oder TT, je nach Kanal)
const GROESSEN_BAENDER = {
  nano: [0, 10000],
  micro: [10000, 50000],
  mid_tier: [50000, 250000],
  macro: [250000, 1000000],
  hero: [1000000, Infinity]
};

// Briefing-Nische -> Match-Tokens (lowercase, gegen branchen_creator,
// ig_brand_mentions und Bio verglichen). Lifestyle ist Fallback.
const NISCHE_TOKENS = {
  beauty: ['beauty', 'skincare', 'kosmetik', 'makeup', 'hautpflege'],
  fashion: ['fashion', 'mode', 'outfit', 'style'],
  food: ['food', 'kochen', 'cooking', 'rezept', 'ernährung', 'ernaehrung'],
  fitness: ['fitness', 'sport', 'gym', 'workout', 'training'],
  health: ['health', 'wellness', 'gesundheit'],
  lifestyle: ['lifestyle'],
  family: ['family', 'familie', 'parenting', 'mama', 'papa', 'eltern'],
  home: ['home', 'interior', 'wohnen', 'einrichtung'],
  diy: ['diy', 'handwerk', 'basteln'],
  tech: ['tech', 'technik', 'gadget'],
  gaming: ['gaming', 'game', 'gamer'],
  automotive: ['auto', 'automotive', 'car'],
  travel: ['travel', 'reisen', 'urlaub'],
  finance: ['finance', 'finanzen', 'geld', 'invest'],
  business: ['business', 'karriere', 'career'],
  education: ['education', 'bildung', 'lernen'],
  entertainment: ['entertainment', 'comedy', 'humor'],
  music: ['music', 'musik'],
  art: ['art', 'kunst', 'kreativ', 'design'],
  outdoor: ['outdoor', 'natur', 'wandern', 'camping'],
  pets: ['pets', 'haustier', 'hund', 'katze', 'tier']
};

// Nischen-Nachbarschaft fuer den Adjacent-Slot
const NISCHE_NACHBARN = {
  beauty: ['health', 'lifestyle', 'fashion'],
  health: ['beauty', 'fitness', 'lifestyle'],
  fitness: ['health', 'lifestyle', 'outdoor'],
  fashion: ['beauty', 'lifestyle', 'art'],
  food: ['health', 'family', 'lifestyle'],
  family: ['food', 'home', 'lifestyle'],
  home: ['diy', 'family', 'lifestyle'],
  tech: ['gaming', 'business', 'education'],
  gaming: ['tech', 'entertainment'],
  travel: ['outdoor', 'lifestyle', 'family']
};

// Briefing-Voraussetzung -> strukturiertes Creator-Feld. Nur diese drei
// duerfen hart gaten; der Rest (Kueche, Garten, Auto, ...) ist Soft-Bonus
// aus Bio/Notiz mit unverified-Flag.
const VORAUSSETZUNG_FELDER = {
  haustier: 'hat_haustier',
  kind_familie: 'hat_kinder',
  instrument: 'spielt_instrument'
};

// Accounts ohne einzelne Person: kein hartes Geschlecht-Gate
const GESCHLECHT_SONDER = ['paar', 'familie', 'tier'];

// Gewichte je Liste-Typ. mix nimmt pro Kandidat das Profil seines typ.
const PROFILES = {
  ugc: {
    fit: { nische: 28, persona: 26, voraussetzung: 16, groesse: 6, plattform: 8, mentions: 12, standort: 8, text: 8, preis: 0 },
    track: { prio: 30, buchung: 24, videos: 20, er: 8, kontakt: 8 },
    fresh: { marke_90d: 20, fingerprint: 25, vorgeschlagen3: 25, global: 15 }
  },
  influencer: {
    fit: { nische: 22, persona: 16, voraussetzung: 8, groesse: 18, plattform: 8, mentions: 12, standort: 8, text: 8, preis: 16 },
    track: { prio: 22, buchung: 18, videos: 10, er: 22, kontakt: 6 },
    fresh: { marke_90d: 40, fingerprint: 25, vorgeschlagen3: 25, global: 15 }
  }
};

// Schwellen
const SCHWELLEN = {
  provenFitMin: 55,
  tightFreshMin: 40,
  exploreFreshMin: 70,
  exploreFitMin: 40,
  exploreTrackMin: 50,
  adjacentFitAbzugMax: 15,
  wilsonMinN: 3,
  abgelehntMonate: 12,
  repeatTage: 90,
  globalVorschlaegeNorm: 8
};

// Anzahl: 2-3x offene Creator-Sollzahl, gedeckelt
const ANZAHL = { faktor: 2.5, min: 6, max: 20 };

// Explore-Default aus dem Briefing (kein UI-Regler in v1)
function exploreDefaultForBriefing({ ansatz, alwaysOnBestehend, kampagnentypen = [] } = {}) {
  if (ansatz === 'always_on' && alwaysOnBestehend === 'fortfuehren') return 0.25;
  if (ansatz === 'always_on') return 0.4;
  if ((kampagnentypen || []).includes('produktlaunch')) return 0.55;
  return 0.45;
}

const MAX_SHORTLIST_IM_PROMPT = 30;

module.exports = {
  CONFIG_VERSION,
  BEREICH_PREFIX,
  BEREICH_TYP,
  GROESSEN_BAENDER,
  NISCHE_TOKENS,
  NISCHE_NACHBARN,
  VORAUSSETZUNG_FELDER,
  GESCHLECHT_SONDER,
  PROFILES,
  SCHWELLEN,
  ANZAHL,
  MAX_SHORTLIST_IM_PROMPT,
  exploreDefaultForBriefing
};
