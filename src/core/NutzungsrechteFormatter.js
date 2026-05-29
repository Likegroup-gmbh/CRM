/**
 * NutzungsrechteFormatter.js
 *
 * Wandelt die rohen Nutzungsrechte-Felder eines Vertrags (Tabelle `vertraege`)
 * in eine lesbare, typ-spezifische Struktur fuer das Nutzungsrechte-Modal um.
 *
 * Es werden NUR Nutzungsrechte-relevante Felder beruecksichtigt
 * (keine Produktions-/Logistikfelder wie model_call_time, videograf_v1_deadline,
 * contracting_veroeffentlichungsdatum etc.) und nur gesetzte/relevante Werte.
 *
 * Ausgabe:
 *   {
 *     typLabel: string,
 *     sections: [ { title: string, items: [ { label, value } ] } ]
 *   }
 *
 * Hinweis: Freitext-Werte werden NICHT escaped – das uebernimmt das Modal beim Rendern.
 */

const TYP_LABELS = {
  'UGC': 'UGC-Vertrag',
  'Influencer Kooperation': 'Influencer-Kooperation',
  'Videograph': 'Videograph-Vertrag',
  'Model': 'Model-Vertrag',
  'Contracting': 'Contracting-Vertrag',
};

// --- Shared Maps ---------------------------------------------------------
const NUTZUNGSDAUER_MAP = {
  unbegrenzt: 'Unbegrenzt',
  '12_monate': '12 Monate',
  '6_monate': '6 Monate',
  '3_monate': '3 Monate',
  individuell: 'Individuell',
};

const EINHEIT_MAP = {
  jahre: 'Jahre',
  monate: 'Monate',
  wochen: 'Wochen',
  tage: 'Tage',
};

const MEDIEN_MAP = {
  social_media: 'Social Media',
  website: 'Website',
  otv: 'Online-TV (OTV)',
};

// --- UGC -----------------------------------------------------------------
const NUTZUNGSART_MAP = {
  organisch: 'Organisch',
  paid: 'Paid',
  beides: 'Organisch & Paid',
};

// --- Influencer ----------------------------------------------------------
const PLATTFORMEN_MAP = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  sonstige: 'Sonstige',
};

const ORGANISCHE_VEROEFF_MAP = {
  influencer_only: 'Nur Influencer-Kanal',
  collab: 'Collab-Post (gemeinsam)',
  zusatz_unternehmen: 'Zusaetzlich Unternehmens-Kanal',
  keine_zusatz: 'Keine zusaetzliche Veroeffentlichung',
};

const MEDIA_BUYOUT_MAP = {
  organisch: 'Organisch',
  paid: 'Paid',
  beides: 'Organisch & Paid',
};

// --- Videograph ----------------------------------------------------------
const VIDEOGRAF_NUTZUNGSART_MAP = {
  organisch: 'Organisch',
  paid_ads: 'Paid Ads',
  alle_medien: 'Alle Medien',
};

// --- Model ---------------------------------------------------------------
const MODEL_NUTZUNGSARTEN_MAP = {
  ecommerce: 'E-Commerce',
  social_media: 'Social Media',
  paid_ads: 'Paid Ads',
  website: 'Website',
  ooh: 'Out of Home (OOH)',
  print: 'Print',
  tv_ctv: 'TV / CTV',
  pos: 'Point of Sale (POS)',
  pr: 'PR',
  kampagne: 'Kampagne',
};

const MODEL_TERRITORIUM_MAP = {
  dach: 'DACH',
  eu: 'EU',
  weltweit: 'Weltweit',
  beschraenkt: 'Beschraenkt',
};

const MODEL_NUTZUNGSDAUER_MAP = {
  '3_monate': '3 Monate',
  '6_monate': '6 Monate',
  '12_monate': '12 Monate',
  '24_monate': '24 Monate',
  unbegrenzt: 'Unbegrenzt',
};

const MODEL_EXKLUSIVITAET_ART_MAP = {
  keine: 'Keine',
  branche: 'Branche',
  wettbewerber: 'Wettbewerber',
};

const MODEL_KI_NUTZUNG_MAP = {
  ki_erlaubt: 'KI-Nutzung erlaubt',
  training_ausgeschlossen: 'KI-Training ausgeschlossen',
  deepfake_nein: 'Keine Deepfakes',
  nur_kampagne: 'Nur fuer diese Kampagne',
};

// --- Contracting ---------------------------------------------------------
const CONTRACTING_BUYOUT_PLATTFORMEN_MAP = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  andere: 'Andere',
};

const CONTRACTING_BUYOUT_ART_MAP = {
  whitelisting: 'Whitelisting',
  spark_ad: 'Spark Ad',
  werbeanzeigen: 'Werbeanzeigen',
  dark_ads: 'Dark Ads',
  sonstige: 'Sonstige',
};

const CONTRACTING_GEOGRAFISCH_MAP = {
  deutschland: 'Deutschland',
  dach: 'DACH',
  europa: 'Europa',
  global: 'Global',
};

// --- Value Helpers -------------------------------------------------------
function hasValue(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

function usableFreeText(t) {
  if (!hasValue(t)) return null;
  const s = String(t).trim();
  if (!s || s === '-' || s === '–') return null;
  return s;
}

function mapEnum(value, map) {
  if (!hasValue(value)) return null;
  return map[value] || String(value);
}

function mapArray(value, map) {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value.map(v => map[v] || String(v)).join(', ');
}

function formatBool(value) {
  return value === true ? 'Ja' : 'Nein';
}

function formatDate(value) {
  if (!hasValue(value)) return null;
  const date = new Date(String(value).length <= 10 ? value + 'T00:00:00' : value);
  if (isNaN(date)) return null;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  return num.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function formatNutzungsdauer(v) {
  if (!hasValue(v.nutzungsdauer)) return null;
  if (v.nutzungsdauer === 'individuell') {
    const wert = v.nutzungsdauer_custom_wert;
    const einheit = EINHEIT_MAP[v.nutzungsdauer_custom_einheit] || v.nutzungsdauer_custom_einheit;
    if (hasValue(wert) && hasValue(einheit)) return `${wert} ${einheit}`;
    return usableFreeText(v._koopNutzungsrechte) || 'Individuell';
  }
  return NUTZUNGSDAUER_MAP[v.nutzungsdauer] || String(v.nutzungsdauer);
}

function formatExklusivitaet(v) {
  if (v.exklusivitaet !== true) return null;
  const wert = v.exklusivitaet_monate;
  const einheit = EINHEIT_MAP[v.exklusivitaet_einheit] || v.exklusivitaet_einheit || 'Monate';
  if (hasValue(wert)) return `${wert} ${einheit}`;
  return 'Ja';
}

// --- Section Builder -----------------------------------------------------
function section(title, items) {
  const filtered = items.filter(it => it && hasValue(it.value));
  if (filtered.length === 0) return null;
  return { title, items: filtered };
}

function buildUgc(v) {
  return [
    section('Nutzungsrechte', [
      { label: 'Nutzungsart', value: mapEnum(v.nutzungsart, NUTZUNGSART_MAP) },
      { label: 'Medien', value: mapArray(v.medien, MEDIEN_MAP) },
      { label: 'Nutzungsdauer', value: formatNutzungsdauer(v) },
      { label: 'Exklusivitaet', value: formatExklusivitaet(v) },
    ]),
  ];
}

function buildInfluencer(v) {
  let plattformen = mapArray(v.plattformen, PLATTFORMEN_MAP);
  if (plattformen && Array.isArray(v.plattformen) && v.plattformen.includes('sonstige') && hasValue(v.plattformen_sonstige)) {
    plattformen = plattformen.replace('Sonstige', `Sonstige (${v.plattformen_sonstige})`);
  }
  return [
    section('Plattformen & Veroeffentlichung', [
      { label: 'Plattformen', value: plattformen },
      { label: 'Organische Veroeffentlichung', value: mapEnum(v.organische_veroeffentlichung, ORGANISCHE_VEROEFF_MAP) },
    ]),
    section('Media Buyout & Nutzung', [
      { label: 'Media Buyout', value: mapEnum(v.media_buyout, MEDIA_BUYOUT_MAP) },
      { label: 'Medien', value: mapArray(v.medien, MEDIEN_MAP) },
      { label: 'Nutzungsdauer', value: formatNutzungsdauer(v) },
      { label: 'Exklusivitaet', value: formatExklusivitaet(v) },
      { label: 'Reichweiten-Garantie', value: v.reichweiten_garantie === true ? (hasValue(v.reichweiten_garantie_wert) ? `${Number(v.reichweiten_garantie_wert).toLocaleString('de-DE')} Aufrufe` : 'Ja') : null },
    ]),
  ];
}

function buildVideograph(v) {
  return [
    section('Nutzungsrechte', [
      { label: 'Umfang', value: 'Ausschliessliche, zeitlich und raeumlich unbegrenzte Nutzungsrechte' },
      { label: 'Nutzungsart', value: mapArray(v.videograf_nutzungsart, VIDEOGRAF_NUTZUNGSART_MAP) },
    ]),
  ];
}

function buildModel(v) {
  let territorium = mapEnum(v.model_territorium, MODEL_TERRITORIUM_MAP);
  if (territorium && v.model_territorium === 'beschraenkt' && hasValue(v.model_territorium_beschraenkt)) {
    territorium = `Beschraenkt (${v.model_territorium_beschraenkt})`;
  }
  let exklusivitaet = mapEnum(v.model_exklusivitaet_art, MODEL_EXKLUSIVITAET_ART_MAP);
  if (exklusivitaet && v.model_exklusivitaet_art !== 'keine' && hasValue(v.model_exklusivitaet_dauer)) {
    exklusivitaet = `${exklusivitaet} (${v.model_exklusivitaet_dauer} Monate)`;
  }
  return [
    section('Nutzung & Territorium', [
      { label: 'Nutzungsarten', value: mapArray(v.model_nutzungsarten, MODEL_NUTZUNGSARTEN_MAP) },
      { label: 'Territorium', value: territorium },
      { label: 'Nutzungsdauer', value: mapEnum(v.model_nutzungsdauer, MODEL_NUTZUNGSDAUER_MAP) },
      { label: 'Nutzungsbeginn', value: formatDate(v.model_nutzungsbeginn) },
    ]),
    section('Exklusivitaet & KI', [
      { label: 'Exklusivitaet', value: exklusivitaet },
      { label: 'KI-Nutzung', value: mapArray(v.model_ki_nutzung, MODEL_KI_NUTZUNG_MAP) },
    ]),
    section('Buyout', [
      { label: 'Buyout inklusiv', value: v.model_buyout_inklusiv === true ? 'Ja' : null },
      { label: 'Buyout-Betrag', value: v.model_buyout_inklusiv === true ? null : formatCurrency(v.model_buyout_betrag) },
    ]),
  ];
}

function buildContracting(v) {
  let art = mapArray(v.contracting_buyout_art, CONTRACTING_BUYOUT_ART_MAP);
  if (art && Array.isArray(v.contracting_buyout_art) && v.contracting_buyout_art.includes('sonstige') && hasValue(v.contracting_buyout_art_sonstige)) {
    art = art.replace('Sonstige', `Sonstige (${v.contracting_buyout_art_sonstige})`);
  }
  let exklusivitaet = null;
  if (hasValue(v.contracting_exklusivitaet_bereich)) {
    const von = formatDate(v.contracting_exklusivitaet_von);
    const bis = formatDate(v.contracting_exklusivitaet_bis);
    const zeitraum = von || bis ? ` (${von || '?'} – ${bis || '?'})` : '';
    exklusivitaet = `${v.contracting_exklusivitaet_bereich}${zeitraum}`;
  }
  return [
    section('Media Buyout', [
      { label: 'Buyout aktiv', value: v.contracting_buyout_aktiv === true ? 'Ja' : null },
      { label: 'Plattformen', value: mapArray(v.contracting_buyout_plattformen, CONTRACTING_BUYOUT_PLATTFORMEN_MAP) },
      { label: 'Art', value: art },
      { label: 'Nutzungsdauer', value: hasValue(v.contracting_buyout_nutzungsdauer) ? v.contracting_buyout_nutzungsdauer : null },
      { label: 'Geografisch', value: mapEnum(v.contracting_buyout_geografisch, CONTRACTING_GEOGRAFISCH_MAP) },
      { label: 'Besonderheiten', value: hasValue(v.contracting_buyout_besonderheiten) ? v.contracting_buyout_besonderheiten : null },
    ]),
    section('Exklusivitaet', [
      { label: 'Bereich', value: exklusivitaet },
    ]),
  ];
}

const BUILDERS = {
  'UGC': buildUgc,
  'Influencer Kooperation': buildInfluencer,
  'Videograph': buildVideograph,
  'Model': buildModel,
  'Contracting': buildContracting,
};

/**
 * Spalten, die fuer das Modal aus `vertraege` geladen werden muessen.
 * Nur existierende Nutzungsrechte-relevante Spalten.
 */
export const NUTZUNGSRECHTE_SELECT = [
  'id', 'name', 'typ',
  'nutzungsdauer', 'nutzungsdauer_custom_wert', 'nutzungsdauer_custom_einheit',
  'exklusivitaet', 'exklusivitaet_monate', 'exklusivitaet_einheit',
  'medien', 'nutzungsart',
  'plattformen', 'plattformen_sonstige', 'organische_veroeffentlichung',
  'media_buyout', 'reichweiten_garantie', 'reichweiten_garantie_wert',
  'videograf_nutzungsart',
  'model_nutzungsarten', 'model_territorium', 'model_territorium_beschraenkt',
  'model_nutzungsdauer', 'model_nutzungsbeginn',
  'model_exklusivitaet_art', 'model_exklusivitaet_dauer', 'model_ki_nutzung',
  'model_buyout_inklusiv', 'model_buyout_betrag',
  'contracting_buyout_aktiv', 'contracting_buyout_plattformen', 'contracting_buyout_art',
  'contracting_buyout_art_sonstige', 'contracting_buyout_nutzungsdauer',
  'contracting_buyout_geografisch', 'contracting_buyout_besonderheiten',
  'contracting_exklusivitaet_bereich', 'contracting_exklusivitaet_von', 'contracting_exklusivitaet_bis',
].join(', ');

/**
 * Baut die strukturierte, lesbare Nutzungsrechte-Darstellung fuer einen Vertrag.
 * @param {object} vertrag - Datensatz aus `vertraege` (mit NUTZUNGSRECHTE_SELECT-Feldern)
 * @returns {{ typLabel: string, sections: Array<{title:string, items:Array<{label:string,value:string}>}> }}
 */
export function buildNutzungsrechte(vertrag) {
  if (!vertrag) return { typLabel: '', sections: [] };
  const builder = BUILDERS[vertrag.typ];
  const sections = builder ? builder(vertrag).filter(Boolean) : [];
  return {
    typLabel: TYP_LABELS[vertrag.typ] || vertrag.typ || 'Vertrag',
    sections,
  };
}
