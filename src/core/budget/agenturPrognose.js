// agenturPrognose.js
// Prognostizierter Agenturanteil der Kalkulation:
// bisher erkannt + Fee bis Kampagnenende + Spanne auf das offene Creator-Budget.
// Die Spanne kommt live aus den bepreisten Zeilen desselben Filters, je Gruppe.
// Gruppe folgt dem exklusiven Leistungsbereich der Seite.

import { collectEkVkPriceRows, isFilledPrice } from './EkVkAgencyFeeHelper.js';

const SPAN_GRUPPE = {
  influencer_marketing: 'influencer',
  ugc_paid: 'ugc',
  ugc_organic: 'ugc',
  gemischt: 'gemischt',
};

// Nur-Influencer, nur-UGC (Paid oder Organic) und Gemischt haben eigene
// Spannen. Vor-Ort, Whitelisting, Darkposting, Contracting und nicht
// zugeordnet teilen sich „sonst“.
export function spanGruppeForBereich(bereich) {
  return SPAN_GRUPPE[bereich] || 'sonst';
}

// Verkaufspreise aller Preiszeilen, plus VK und Marge nur dort, wo EK und VK
// beide gepflegt sind. Dieselbe Zeilenwahl wie die EK/VK-Differenz.
export function verkaufsstand(kooperationen, videos) {
  let vkAlle = 0;
  let vkVoll = 0;
  let marge = 0;

  collectEkVkPriceRows(kooperationen, videos).forEach(row => {
    const vk = parseFloat(row.vkNetto) || 0;
    const ek = parseFloat(row.ekNetto) || 0;
    vkAlle += vk;
    if (isFilledPrice(row.ekNetto) && isFilledPrice(row.vkNetto)) {
      vkVoll += vk;
      marge += vk - ek;
    }
  });

  return { vkAlle, vkVoll, marge };
}

// Creator-Budget minus eingetragene Verkaufspreise. Überschuss bleibt 0,
// damit eine Überbuchung die Prognose nicht senkt.
export function offenesCreatorBudget(creatorBudget, vkAlle) {
  return Math.max(0, (parseFloat(creatorBudget) || 0) - (vkAlle || 0));
}

function spanOrNull(marge, vkVoll) {
  if (!(vkVoll > 0)) return null;
  return marge / vkVoll;
}

// Offenes Budget je Gruppe mal deren Spanne. Eine Gruppe ohne bepreiste
// Zeilen nimmt die Spanne aller bepreisten Zeilen im Filter. Fehlt auch die,
// trägt die Gruppe nichts bei. Eine negative Spanne bleibt negativ.
export function erwarteteSpanne(beitraege) {
  const groups = new Map();
  let vkAlle = 0;
  let margeAlle = 0;

  (beitraege || []).forEach(b => {
    const g = groups.get(b.gruppe) || { vkVoll: 0, marge: 0, offen: 0 };
    g.vkVoll += b.vkVoll || 0;
    g.marge += b.marge || 0;
    g.offen += b.offen || 0;
    groups.set(b.gruppe, g);
    vkAlle += b.vkVoll || 0;
    margeAlle += b.marge || 0;
  });

  const gesamt = spanOrNull(margeAlle, vkAlle);
  let summe = 0;
  groups.forEach(g => {
    const eigene = spanOrNull(g.marge, g.vkVoll);
    const rate = eigene == null ? gesamt : eigene;
    if (rate == null) return;
    summe += g.offen * rate;
  });
  return summe;
}

export function agenturPrognose({ erkannt = 0, feeBisEnde = 0, beitraege = [] } = {}) {
  const ausOffenemBudget = erwarteteSpanne(beitraege);
  return {
    erkannt,
    feeBisEnde,
    ausOffenemBudget,
    summe: erkannt + feeBisEnde + ausOffenemBudget,
  };
}
