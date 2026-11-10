// agenturPrognose.js
// Prognostizierter Agenturanteil der Kalkulation:
// bisher erkannt + Fee bis Kampagnenende + Spanne auf das offene Creator-Budget.
// Die Spanne gilt je Auftrag und kommt aus dessen eigenen bepreisten Zeilen.
// Beendete Kampagnen und Aufträge ohne gepflegte Preise tragen nichts bei:
// eine fremde Spanne wäre geraten (ADR 0007).

import { collectEkVkPriceRows, isFilledPrice } from './EkVkAgencyFeeHelper.js';

function isoDatum(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const t = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${t}`;
}

// Der Endtag selbst zählt noch als laufend. Ohne Ende läuft der Auftrag.
export function istBeendet(ende, today = new Date()) {
  if (!ende) return false;
  return String(ende).slice(0, 10) < isoDatum(today);
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

// Offenes Budget je laufendem Auftrag mal dessen eigene Spanne. Eine
// negative Spanne bleibt negativ.
export function erwarteteSpanne(beitraege) {
  return (beitraege || []).reduce((summe, b) => {
    if (b.beendet || !(b.vkVoll > 0)) return summe;
    return summe + (b.offen || 0) * ((b.marge || 0) / b.vkVoll);
  }, 0);
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
