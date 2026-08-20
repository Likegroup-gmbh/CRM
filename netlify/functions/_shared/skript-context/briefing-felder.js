// skript-context/briefing-felder.js
// Campaign-Briefing: Feld-Config (Master + Module), Enum-Labels und der
// Formatter als Prompt-Sektion mit Token-Budget.

const { kuerzeTranskript } = require('./formatter');

const BRIEFING_MAX = 6000;

const BEREICH_LABELS = {
  influencer_marketing: 'Influencer Marketing',
  paid_creator_ads: 'Paid Creator Ads',
  owned_social: 'Owned Social'
};

// Bekannte Enum-Werte -> lesbare Labels (CJS-Kopie von fieldConfig, Drift-Guard im SchemaSync-Test)
const VALUE_LABELS = {
  kampagne: 'Kampagne',
  always_on: 'Always-on',
  produktlaunch: 'Produktlaunch',
  saisonal: 'Saisonaler Anlass',
  promotion: 'Promotion / Sales Push',
  event: 'Event / Live Activation',
  brand: 'Brand Campaign',
  awareness: 'Awareness Initiative',
  sonstiges: 'Sonstiges',
  fortfuehren: 'Ja – soll fortgefuehrt werden',
  weiterentwickeln: 'Ja – soll weiterentwickelt werden',
  neu: 'Nein – soll neu entwickelt werden',
  deutschland: 'Deutschland',
  oesterreich: 'Oesterreich',
  schweiz: 'Schweiz',
  deutsch: 'Deutsch',
  englisch: 'Englisch',
  untertitel: 'Untertitel',
  on_screen_text: 'Uebersetzter On-Screen-Text',
  voice_over: 'Voice-over',
  separate_version: 'Separate Content-Version',
  upper: 'Upper Funnel – Awareness',
  mid: 'Mid Funnel – Consideration',
  lower: 'Lower Funnel – Conversion',
  nano: 'Nano',
  micro: 'Micro',
  mid_tier: 'Mid-Tier',
  macro: 'Macro',
  hero: 'Hero',
  ugc_creator: 'UGC Creator',
  keine_vorgabe: 'Keine Vorgabe / Agenturempfehlung',
  ja: 'Ja',
  teilweise: 'Teilweise',
  nein: 'Nein',
  kunde: 'Kunde',
  agentur: 'Agentur',
  creator: 'Creator',
  gemeinsam: 'Gemeinsam',
  alleine: 'Creator produziert alleine / eigenstaendig',
  mehrere_creator: 'Mehrere Creator gemeinsam',
  mit_personen: 'Creator + weitere Person(en)',
  videograf: 'Creator + Videograf / Produktionsteam',
  studio: 'Professionelle Produktion / Studio',
  vor_ort: 'Vor Ort / On-Location',
  kombination: 'Kombination',
  offen: 'Noch offen / Agenturempfehlung',
  creator_channel: 'Creator Channel',
  co_author: 'Co-Author / Collab Post mit Brand',
  keine: 'Keine',
  paid_amplification: 'Paid Amplification',
  whitelisting: 'Partnership Ads / Whitelisting',
  brand_nutzung: 'Separate Nutzung durch die Brand',
  landingpage: 'Landingpage',
  pdp: 'Product Detail Page',
  shop: 'Shop',
  app_deep_link: 'App / Deep Link',
  tracking_link: 'Tracking-Link',
  rabattcode: 'Rabattcode',
  affiliate: 'Affiliate-Code / Affiliate-Link',
  website: 'Website / Landingpage',
  lead_form: 'Lead Form',
  app_store: 'App Store',
  deep_link: 'App / Deep Link',
  social_profile: 'Social Profile / Community',
  traffic: 'Traffic',
  video_views: 'Video Views',
  engagement: 'Engagement / Community Interaction',
  leads: 'Leads',
  app_promotion: 'App Promotion / App Installs',
  sales: 'Sales / Conversions',
  '6s': '6 Sek.',
  '10s': '10 Sek.',
  '15s': '15 Sek.',
  '20s': '20 Sek.',
  '30s': '30 Sek.',
  '60s': '60 Sek.',
  individuell: 'Individuell',
  agenturempfehlung: 'Agenturempfehlung',
  wiederkehrend: 'Wiederkehrendes Format / gleiche Grundidee',
  unterschiedliche_ideen: 'Unterschiedliche Content-Ideen',
  pillars: 'Unterschiedliche Content Pillars / Serien',
  mischung: 'Mischung',
  produktaufnahmen: 'Produktaufnahmen',
  closeups: 'Detail- / Close-up-Shots',
  b_roll: 'B-Roll',
  stills: 'Stills / Fotos',
  mood: 'Mood Content',
  grafik: 'Grafik- / Textvarianten',
  cutdowns: 'Cutdowns / zusaetzliche Edits',
  beauty: 'Beauty / Skincare',
  fashion: 'Fashion',
  food: 'Food / Cooking',
  fitness: 'Fitness / Sport',
  health: 'Health / Wellness',
  lifestyle: 'Lifestyle',
  family: 'Family / Parenting',
  home: 'Home / Interior',
  diy: 'DIY',
  tech: 'Tech',
  gaming: 'Gaming',
  automotive: 'Automotive',
  travel: 'Travel',
  finance: 'Finance',
  business: 'Business / Career',
  education: 'Education',
  entertainment: 'Entertainment / Comedy',
  music: 'Music',
  art: 'Art / Creative',
  outdoor: 'Outdoor',
  pets: 'Pets',
  haustier: 'Haustier',
  kind_familie: 'Kind / Familie',
  auto_fuehrerschein: 'Auto / Fuehrerschein',
  kueche: 'Kueche / Kochmoeglichkeit',
  garten_outdoor: 'Garten / Outdoor-Flaeche',
  instrument: 'Instrument',
  gaming_setup: 'Gaming Setup',
  sport_equipment: 'Sport-/Fitness-Equipment',
  location_wohnsituation: 'Bestimmte Location / Wohnsituation',
  weitere_personen: 'Weitere Person(en) verfuegbar',
  reichweite: 'Reichweite',
  impressions: 'Impressions',
  views: 'Views',
  cpm: 'CPM / TKP',
  engagement_rate: 'Engagement Rate',
  cpe: 'CPE',
  klicks: 'Klicks',
  cpc: 'CPC',
  conversions: 'Conversions / Sales',
  cpa: 'CPA / CPO',
  roas: 'ROAS',
  reach_impressions: 'Reach / Impressions',
  ctr: 'CTR',
  cpv: 'CPV',
  vtr: 'VTR',
  cpl: 'CPL',
  cpi: 'CPI / Cost per Install',
  cac: 'CAC',
  conversion_rate: 'Conversion Rate',
  umsatz: 'Umsatz',
  reach: 'Reach',
  watch_time: 'Watch Time',
  retention_rate: 'Retention Rate',
  saves: 'Saves',
  shares: 'Shares',
  kommentare: 'Kommentare',
  follower_growth: 'Follower Growth'
};

// prio 1 = zuerst behalten (Must-haves, CTA, Umsetzung), 3 = zuletzt (Learnings, Uploads)
const BRIEFING_MASTER_FIELDS = [
  { name: 'bereich', label: 'Bereich', prio: 1 },
  { name: 'aktivierung_name', label: 'Aktivierung', prio: 1 },
  { name: 'ansatz', label: 'Ansatz', prio: 1 },
  { name: 'kampagne_thema', label: 'Kampagnenthema', prio: 1 },
  { name: 'kampagnentypen', label: 'Kampagnentypen', prio: 2 },
  { name: 'always_on_thema', label: 'Always-on-Thema', prio: 1 },
  { name: 'always_on_bestehend', label: 'Bestehender Always-on-Ansatz', prio: 2 },
  { name: 'creator_rolle', label: 'Rolle der Creator', prio: 1 },
  { name: 'creator_rolle_offen', label: 'Rolle noch offen', prio: 1 },
  { name: 'maerkte', label: 'Maerkte', prio: 2 },
  { name: 'sprachen', label: 'Content-Sprache', prio: 1 },
  { name: 'zusaetzliche_sprachen', label: 'Zusaetzliche Sprachversionen', prio: 2 },
  { name: 'weitere_sprachen', label: 'Weitere Sprachen', prio: 2 },
  { name: 'sprachadaption', label: 'Sprachadaption', prio: 2 },
  { name: 'content_deadline', label: 'Content Deadline', prio: 2 },
  { name: 'go_live', label: 'Go-live', prio: 2 },
  { name: 'embargo', label: 'Embargo / Sperrfrist', prio: 2 },
  { name: 'weitere_deadline_bezeichnung', label: 'Weitere Deadline (Bezeichnung)', prio: 3 },
  { name: 'weitere_deadline', label: 'Weitere Deadline', prio: 3 }
];

const BRIEFING_MODULE_FIELDS = {
  influencer_marketing: [
    { name: 'im_funnel_stufen', label: 'Funnel-Stufe', prio: 1 },
    { name: 'im_kpis', label: 'Ziele / Benchmarks', prio: 2 },
    { name: 'im_keine_benchmarks', label: 'Keine Benchmarks definiert', prio: 3 },
    { name: 'im_creator_groessen', label: 'Creator-Groesse / Typ', prio: 2 },
    { name: 'im_nischen', label: 'Nische / Content-Kategorie', prio: 2 },
    { name: 'im_creator_merkmale', label: 'Creator-Merkmale', prio: 2 },
    { name: 'im_voraussetzungen', label: 'Besondere Voraussetzungen', prio: 2 },
    { name: 'im_voraussetzungen_custom', label: 'Sonstige Voraussetzungen', prio: 2 },
    { name: 'im_channels', label: 'Channels & Formate', prio: 2 },
    { name: 'im_formatvorgaben', label: 'Formatvorgaben', prio: 1 },
    { name: 'im_learnings_vorhanden', label: 'Learnings vorhanden', prio: 3 },
    { name: 'im_learnings_text', label: 'Learnings', prio: 3 },
    { name: 'im_beispiele', label: 'Beispiele', prio: 3 },
    { name: 'im_ideen_status', label: 'Ideen-Status', prio: 2 },
    { name: 'im_ideen_text', label: 'Ideen', prio: 2 },
    { name: 'im_referenzen', label: 'Referenzen', prio: 3 },
    { name: 'im_ideen_verantwortlich', label: 'Ideen-Verantwortung', prio: 3 },
    { name: 'im_umsetzung', label: 'Konkrete Umsetzung', prio: 1 },
    { name: 'im_umsetzung_offen', label: 'Umsetzung noch offen', prio: 1 },
    { name: 'im_situationen', label: 'Situationen / Settings / Use Cases', prio: 1 },
    { name: 'im_production_setup', label: 'Produktion', prio: 2 },
    { name: 'im_vorort', label: 'Vor-Ort / Event-Details', prio: 2 },
    { name: 'im_versand_anforderungen', label: 'Versand-Anforderungen', prio: 3 },
    { name: 'im_veroeffentlichung', label: 'Veroeffentlichung', prio: 2 },
    { name: 'im_zusaetzliche_nutzung', label: 'Zusaetzliche Nutzung', prio: 2 },
    { name: 'im_nutzungslogik', label: 'Nutzungslogik', prio: 3 },
    { name: 'im_tracking', label: 'Tracking-Mechaniken', prio: 1 },
    { name: 'im_ziel_url', label: 'Ziel-URL / Deep Link', prio: 1 },
    { name: 'im_code', label: 'Code', prio: 1 },
    { name: 'im_code_spaeter', label: 'Code wird spaeter vergeben', prio: 1 }
  ],
  paid_creator_ads: [
    { name: 'pa_funnel_stufen', label: 'Funnel-Stufe', prio: 1 },
    { name: 'pa_objectives', label: 'Paid Objective', prio: 2 },
    { name: 'pa_kpis', label: 'Ziele / Benchmarks', prio: 2 },
    { name: 'pa_keine_benchmarks', label: 'Keine Benchmarks definiert', prio: 3 },
    { name: 'pa_creator_groessen', label: 'Creator-Groesse / Typ', prio: 2 },
    { name: 'pa_nischen', label: 'Nische / Content-Kategorie', prio: 2 },
    { name: 'pa_creator_merkmale', label: 'Creator-Merkmale', prio: 2 },
    { name: 'pa_voraussetzungen', label: 'Besondere Voraussetzungen', prio: 2 },
    { name: 'pa_voraussetzungen_custom', label: 'Sonstige Voraussetzungen', prio: 2 },
    { name: 'pa_channels', label: 'Paid Channels', prio: 2 },
    { name: 'pa_learnings_vorhanden', label: 'Learnings vorhanden', prio: 3 },
    { name: 'pa_learnings_text', label: 'Learnings', prio: 3 },
    { name: 'pa_beispiele', label: 'Beispiele', prio: 3 },
    { name: 'pa_reporting', label: 'Reporting', prio: 3 },
    { name: 'pa_ideen_status', label: 'Ideen-Status', prio: 2 },
    { name: 'pa_ideen_text', label: 'Ideen', prio: 2 },
    { name: 'pa_referenzen', label: 'Referenzen', prio: 3 },
    { name: 'pa_ideen_verantwortlich', label: 'Ideen-Verantwortung', prio: 3 },
    { name: 'pa_umsetzung', label: 'Konkrete Umsetzung', prio: 1 },
    { name: 'pa_umsetzung_offen', label: 'Umsetzung noch offen', prio: 1 },
    { name: 'pa_situationen', label: 'Situationen / Settings / Use Cases', prio: 1 },
    { name: 'pa_production_setup', label: 'Produktion', prio: 2 },
    { name: 'pa_vorort', label: 'Vor-Ort-Details', prio: 2 },
    { name: 'pa_versand_anforderungen', label: 'Versand-Anforderungen', prio: 3 },
    { name: 'pa_videolaengen', label: 'Videolaenge', prio: 1 },
    { name: 'pa_ratios', label: 'Format / Ratio', prio: 1 },
    { name: 'pa_zusaetzliche_versionen', label: 'Zusaetzliche Versionen', prio: 3 },
    { name: 'pa_destination', label: 'Destination', prio: 1 },
    { name: 'pa_ziel_url', label: 'Ziel-URL / Deep Link', prio: 1 }
  ],
  owned_social: [
    { name: 'os_content_ziele', label: 'Organische Content-Ziele', prio: 1 },
    { name: 'os_kpis', label: 'Ziele / Benchmarks', prio: 2 },
    { name: 'os_keine_benchmarks', label: 'Keine Benchmarks definiert', prio: 3 },
    { name: 'os_creator_groessen', label: 'Creator-Groesse / Typ', prio: 2 },
    { name: 'os_nischen', label: 'Nische / Content-Kategorie', prio: 2 },
    { name: 'os_creator_merkmale', label: 'Creator-Merkmale', prio: 2 },
    { name: 'os_voraussetzungen', label: 'Besondere Voraussetzungen', prio: 2 },
    { name: 'os_voraussetzungen_custom', label: 'Sonstige Voraussetzungen', prio: 2 },
    { name: 'os_channels', label: 'Brand Channels & Formate', prio: 2 },
    { name: 'os_formatvorgaben', label: 'Formatvorgaben', prio: 1 },
    { name: 'os_learnings_vorhanden', label: 'Learnings vorhanden', prio: 3 },
    { name: 'os_learnings_text', label: 'Learnings', prio: 3 },
    { name: 'os_beispiele', label: 'Beispiele', prio: 3 },
    { name: 'os_reporting', label: 'Reporting', prio: 3 },
    { name: 'os_ideen_status', label: 'Ideen-Status', prio: 2 },
    { name: 'os_ideen_text', label: 'Ideen', prio: 2 },
    { name: 'os_referenzen', label: 'Referenzen', prio: 3 },
    { name: 'os_ideen_verantwortlich', label: 'Ideen-Verantwortung', prio: 3 },
    { name: 'os_umsetzung', label: 'Konkrete Umsetzung', prio: 1 },
    { name: 'os_umsetzung_offen', label: 'Umsetzung noch offen', prio: 1 },
    { name: 'os_situationen', label: 'Situationen / Settings / Use Cases', prio: 1 },
    { name: 'os_content_ansatz', label: 'Content-Ansatz', prio: 2 },
    { name: 'os_content_pillars', label: 'Content Pillars', prio: 2 },
    { name: 'os_production_setup', label: 'Produktion', prio: 2 },
    { name: 'os_vorort', label: 'Vor-Ort / Event-Details', prio: 2 },
    { name: 'os_versand_anforderungen', label: 'Versand-Anforderungen', prio: 3 },
    { name: 'os_zusatz_assets', label: 'Zusaetzliche Assets', prio: 3 },
    { name: 'os_assets', label: 'Welche zusaetzlichen Assets', prio: 3 },
    { name: 'os_assets_anforderungen', label: 'Asset-Anforderungen', prio: 3 }
  ]
};

const CAMPAIGN_BRIEFING_FIELD_NAMES = [
  ...BRIEFING_MASTER_FIELDS.map((f) => f.name),
  ...Object.values(BRIEFING_MODULE_FIELDS).flat().map((f) => f.name)
];

function labelValue(v) {
  if (v == null) return '';
  const key = String(v);
  return VALUE_LABELS[key] || key;
}

function fmtScalarList(arr) {
  return arr.map(labelValue).filter(Boolean).join(', ');
}

function fmtKpiList(arr) {
  return arr.map((row) => {
    const kpi = labelValue(row?.kpi);
    if (!kpi && !row?.zielwert) return null;
    return row?.zielwert ? `${kpi}: ${row.zielwert}` : kpi;
  }).filter(Boolean).join('; ');
}

function fmtUploadList(arr) {
  return arr.map((row) => row?.label || row?.value).filter(Boolean).join('; ');
}

function fmtPlainList(arr) {
  return arr.map((item) => (typeof item === 'string' ? item : item?.value || item?.label || '')).filter(Boolean).join('; ');
}

function fmtGroupObject(obj) {
  return Object.entries(obj)
    .filter(([, v]) => {
      if (v == null || v === '') return false;
      if (typeof v === 'boolean') return v === true;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    })
    .map(([k, v]) => {
      if (typeof v === 'boolean') return labelValue(k);
      if (Array.isArray(v)) return `${labelValue(k)}: ${fmtScalarList(v)}`;
      return `${labelValue(k)}: ${labelValue(v)}`;
    })
    .join('; ');
}

function fmtBriefingValue(value) {
  if (value == null) return null;
  if (typeof value === 'boolean') return value ? 'ja' : null;
  if (Array.isArray(value)) {
    if (!value.length) return null;
    if (typeof value[0] === 'object' && value[0] !== null) {
      if (value[0].kpi !== undefined) return fmtKpiList(value) || null;
      if (value[0].typ !== undefined || value[0].value !== undefined) return fmtUploadList(value) || null;
      return fmtPlainList(value) || null;
    }
    return fmtScalarList(value) || null;
  }
  if (typeof value === 'object') {
    const formatted = fmtGroupObject(value);
    return formatted || null;
  }
  const text = String(value).trim();
  return text ? (VALUE_LABELS[text] || text) : null;
}

function collectBriefingLines(briefing) {
  const fields = [...BRIEFING_MASTER_FIELDS];
  if (BRIEFING_MODULE_FIELDS[briefing.bereich]) {
    fields.push(...BRIEFING_MODULE_FIELDS[briefing.bereich]);
  }

  const lines = [];
  for (const field of fields) {
    let raw = briefing[field.name];
    if (field.name === 'bereich') raw = BEREICH_LABELS[briefing.bereich] || briefing.bereich;
    const formatted = fmtBriefingValue(raw);
    if (!formatted) continue;
    lines.push({ prio: field.prio, text: `- ${field.label}: ${formatted}` });
  }
  return lines;
}

/**
 * Campaign-Briefing als Prompt-Sektion. Master + nur das aktive Modul.
 * Leere Felder fallen raus. Bei Budget-Ueberschreitung bleiben Prio-1-Felder
 * (Umsetzung, CTA, Sprache) zuerst erhalten.
 */
function fmtCampaignBriefing(briefing, { max = BRIEFING_MAX } = {}) {
  if (!briefing) return '';
  const lines = collectBriefingLines(briefing);
  if (!lines.length) return '';

  lines.sort((a, b) => a.prio - b.prio || 0);

  const header = '\n# CAMPAIGN-BRIEFING (verbindliche Kampagnen- und Umsetzungsvorgaben)\n';
  let body = '';
  for (const line of lines) {
    const next = `${body}${line.text}\n`;
    if (header.length + next.length > max) {
      if (!body) {
        body = `${kuerzeTranskript(line.text, Math.max(80, max - header.length - 20))}\n`;
      }
      break;
    }
    body = next;
  }
  if (!body.trim()) return '';
  return header + body;
}

/** Sprache aus dem Briefing, wenn sie vom Deutsch-Default abweicht. */
function briefingSkriptSprache(briefing) {
  const langs = Array.isArray(briefing?.sprachen)
    ? briefing.sprachen.map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (!langs.length) return null;
  if (langs.every((s) => s.toLowerCase() === 'deutsch')) return null;
  return langs.map(labelValue).join(', ');
}

module.exports = {
  fmtCampaignBriefing, briefingSkriptSprache, BRIEFING_MAX, CAMPAIGN_BRIEFING_FIELD_NAMES
};
