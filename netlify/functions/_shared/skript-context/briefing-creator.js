// skript-context/briefing-creator.js
// Creator-Vorgaben aus den Altfeldern creator_merkmale / beteiligte_personen (ADR 0073:
// das Creator-Briefing fragt sie nicht mehr ab). Aeltere Briefings behalten sie als
// eigenen Block vor dem kuerzbaren Briefing-Body.

const { labelValue } = require('./briefing-katalog');

const BEREICH_PREFIX = {
  influencer_marketing: 'im_',
  paid_creator_ads: 'pa_',
  owned_social: 'os_'
};

const MERKMAL_LABELS = {
  alter: 'Alter',
  standort: 'Standort',
  expertise: 'Expertise',
  sonstiges: 'Sonstiges'
};

const HARTES_GESCHLECHT = /^(nur\s+)?(weiblich|männlich|divers)$/;

// Dropdown-Werte des Briefings (CJS-Kopie von CREATOR_ALTER_OPTIONS) mit Halbgeviertstrich.
// Alter Freitext ("25-35") bleibt im Wortlaut.
const ALTER_LABELS = {
  '18-24': '18–24',
  '25-34': '25–34',
  '35-44': '35–44',
  '45-54': '45–54',
  '55+': '55+'
};

function merkmaleGefuellt(obj) {
  if (!obj) return false;
  if (typeof obj !== 'object') return String(obj).trim() !== '';
  return Object.values(obj).some((v) => v != null && String(v).trim() !== '');
}

/** creator_merkmale, sonst der Spiegel zum Bereich - nie beide. */
function creatorMerkmale(briefing) {
  if (merkmaleGefuellt(briefing?.creator_merkmale)) return briefing.creator_merkmale;
  const prefix = BEREICH_PREFIX[briefing?.bereich];
  const spiegel = prefix ? briefing[`${prefix}creator_merkmale`] : null;
  return merkmaleGefuellt(spiegel) ? spiegel : null;
}

/** `alter` (Dropdown oder Freitext), sonst alter_von/alter_bis (Zwischenstand) als "18–24 bis 35–44". */
function fmtAlter(merkmale) {
  const klar = (v) => {
    const text = String(v ?? '').trim();
    return ALTER_LABELS[text] || text;
  };
  const alter = klar(merkmale.alter);
  if (alter) return alter;
  const von = klar(merkmale.alter_von);
  const bis = klar(merkmale.alter_bis);
  if (von && bis) return von === bis ? von : `${von} bis ${bis}`;
  return von || bis;
}

function istHartesGeschlecht(wert) {
  return HARTES_GESCHLECHT.test(String(wert || '').trim().toLowerCase().replace(/\s+/g, ' '));
}

function fmtCreatorVorgaben(briefing) {
  const merkmale = creatorMerkmale(briefing);
  const personen = String(briefing?.beteiligte_personen || '').trim();
  const zeilen = [];

  if (merkmale && typeof merkmale === 'object') {
    const geschlecht = String(merkmale.geschlecht || '').trim();
    if (geschlecht) {
      const zeile = `Creator-Geschlecht (nur die Person vor der Kamera, nicht die Zielgruppe): ${geschlecht}`;
      zeilen.push(istHartesGeschlecht(geschlecht) ? `- HART: ${zeile}` : `- ${zeile}`);
    }
    const alter = fmtAlter(merkmale);
    if (alter) zeilen.push(`- Alter: ${alter}`);
    for (const [key, value] of Object.entries(merkmale)) {
      if (key === 'geschlecht' || key === 'alter' || key === 'alter_von' || key === 'alter_bis') continue;
      if (value == null || String(value).trim() === '') continue;
      zeilen.push(`- ${MERKMAL_LABELS[key] || key}: ${labelValue(String(value).trim())}`);
    }
  } else if (merkmale) {
    zeilen.push(`- Creator-Merkmale: ${String(merkmale).trim()}`);
  }
  if (personen) zeilen.push(`- Beteiligte Personen: ${personen}`);

  if (!zeilen.length) return '';
  return '\n# CREATOR-VORGABEN (nicht kuerzen)\n' + zeilen.join('\n') + '\n';
}

module.exports = { fmtCreatorVorgaben, BEREICH_PREFIX };
