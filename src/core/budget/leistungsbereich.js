// leistungsbereich.js
// Einzige Quelle fuer die Zuordnung Kampagnenart -> Leistungsbereich
// (PRD Stakeholder Finanzuebersicht, Schritt 2). Die Monatsauswertung und die
// Tabs der Stakeholder Uebersicht leiten beide von hier ab, damit auf einer
// Seite nicht zwei Kategorisierungen nebeneinanderlaufen.
//
// Leistungsbereich ist groeber als Kampagnenart (CONTEXT.md): Kampagne, Story
// und Events bilden zusammen Influencer Marketing. Gemischt und Nicht
// zugeordnet sind bewusst sichtbare Sammelposten statt geratener Zuordnung.

const CAMPAIGN_TYPE_TO_BEREICH = {
  influencer: 'influencer_marketing',
  story: 'influencer_marketing',
  event: 'influencer_marketing',
  ugc_paid: 'ugc_paid',
  ugc_organic: 'ugc_organic',
  vorort_produktion: 'vorort_produktion',
  whitelisting: 'whitelisting',
  darkposting: 'darkposting',
};

// Darstellungsreihenfolge der Matrix. Gemischt und Nicht zugeordnet stehen
// bewusst am Ende: sie sind Sammelposten, keine Bereiche.
export const LEISTUNGSBEREICHE = [
  'influencer_marketing',
  'ugc_paid',
  'ugc_organic',
  'vorort_produktion',
  'whitelisting',
  'darkposting',
  'contracting',
  'gemischt',
  'nicht_zugeordnet',
];

export const LEISTUNGSBEREICH_LABELS = {
  influencer_marketing: 'Influencer Marketing',
  ugc_paid: 'UGC Paid',
  ugc_organic: 'UGC Organic',
  vorort_produktion: 'Vor-Ort-Produktion',
  whitelisting: 'Whitelisting',
  darkposting: 'Darkposting',
  contracting: 'Contracting',
  gemischt: 'Gemischt',
  nicht_zugeordnet: 'Nicht zugeordnet',
};

export function bereichForCampaignType(campaignType) {
  return CAMPAIGN_TYPE_TO_BEREICH[campaignType] || null;
}

export function isContracting(auftrag) {
  return typeof auftrag?.auftragtype === 'string'
    && auftrag.auftragtype.toLowerCase().includes('contracting');
}

// Dieselbe Zuordnung wie der PostgREST-Filter in Monatsblatt.applyAuftragMode.
// NULL ist kein Contracting und bleibt in der Kundenrechnungs-Liste.
export function gehoertZuAuftragMode(auftrag, mode) {
  const contracting = isContracting(auftrag);
  return mode === 'contracts' ? contracting : !contracting;
}

function bereicheOfBlocks(blocks) {
  const bereiche = new Set();
  (blocks || []).forEach(b => {
    const bereich = bereichForCampaignType(b?.campaign_type);
    if (bereich) bereiche.add(bereich);
  });
  return bereiche;
}

/**
 * Exklusiver Leistungsbereich eines Auftrags fuer die Monatsauswertung.
 * Jeder Auftrag landet in genau einer Zeile, damit die Summe der Bereiche
 * immer das Gesamt ergibt.
 *
 * @returns {'influencer_marketing'|'ugc_paid'|'ugc_organic'|'vorort_produktion'|'whitelisting'|'darkposting'|'contracting'|'gemischt'|'nicht_zugeordnet'}
 */
export function leistungsbereichForAuftrag(auftrag, blocks) {
  if (isContracting(auftrag)) return 'contracting';
  const bereiche = bereicheOfBlocks(blocks);
  if (bereiche.size === 0) return 'nicht_zugeordnet';
  if (bereiche.size === 1) return [...bereiche][0];
  return 'gemischt';
}

// Tab-Prioritaet der Kalkulationsansicht. Die dortigen Kennzahlen
// (zeitanteilige Fee, VK-basiertes Creator-Budget) gelten fuer Auftraege mit
// Influencer-Anteil, deshalb gewinnt Influencer Marketing vor den uebrigen.
const TAB_PRIORITAET = [
  'influencer_marketing',
  'ugc_paid',
  'ugc_organic',
  'vorort_produktion',
  'whitelisting',
  'darkposting',
];

/**
 * Primaerer Bereich eines Auftrags fuer die Kategorie-Tabs. Mehrbereichs-
 * Auftraege erscheinen im Tab ihres Schwerpunkt-Bereichs statt zu
 * verschwinden; ohne Block bleibt der Auftrag im Gesamt-Tab.
 */
export function primaerBereichForAuftrag(auftrag, blocks) {
  if (isContracting(auftrag)) return 'contracting';
  const bereiche = bereicheOfBlocks(blocks);
  for (const bereich of TAB_PRIORITAET) {
    if (bereiche.has(bereich)) return bereich;
  }
  return 'gesamt';
}
