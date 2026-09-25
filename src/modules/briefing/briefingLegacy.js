// Detail/PDF: FLOW-Felder, sonst v1-Prefix-Katalog. Nicht fuer Edit.

import { anzeigeWert } from './videolaenge.js';

const PREFIX = {
  influencer_marketing: 'im_',
  paid_creator_ads: 'pa_',
  owned_social: 'os_'
};

const FLOW_MARKERS = ['aufgabe', 'nischen', 'pflichtinhalte', 'setting', 'beschreibung'];

const FLOW_TO_SUFFIX = {
  aufgabe: 'umsetzung',
  setting: 'situationen',
  learnings_text: 'learnings_text',
  umsetzungsideen: 'ideen_text',
  produkt_erfahrung: 'voraussetzungen_custom',
  nischen: 'nischen',
  creator_groessen: 'creator_groessen',
  creator_merkmale: 'creator_merkmale',
  voraussetzungen: 'voraussetzungen'
};

const VALUE_LABELS = {
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
  alleine: 'Creator produziert alleine / eigenständig',
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
  cutdowns: 'Cutdowns / zusätzliche Edits',
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
  auto_fuehrerschein: 'Auto / Führerschein',
  kueche: 'Küche / Kochmöglichkeit',
  garten_outdoor: 'Garten / Outdoor-Fläche',
  instrument: 'Instrument',
  gaming_setup: 'Gaming Setup',
  sport_equipment: 'Sport-/Fitness-Equipment',
  location_wohnsituation: 'Bestimmte Location / Wohnsituation',
  weitere_personen: 'Weitere Person(en) verfügbar',
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
  follower_growth: 'Follower Growth',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  pinterest: 'Pinterest',
  meta: 'Meta',
  google: 'Google',
  reel: 'Reel',
  story: 'Story',
  feed_post: 'Feed Post',
  carousel: 'Carousel',
  live: 'Live',
  video: 'Video',
  short: 'YouTube Short',
  longform: 'YouTube Long-form',
  shorts: 'YouTube Shorts',
  instream: 'YouTube Long-form / In-Stream',
  performance_max: 'Performance Max',
  display: 'Display',
  demand_gen: 'Demand Gen'
};

export const LEGACY_MODULE_FIELDS = {
  influencer_marketing: [
    { name: 'im_funnel_stufen', label: 'Funnel-Stufe' },
    { name: 'im_kpis', label: 'Ziele / Benchmarks' },
    { name: 'im_keine_benchmarks', label: 'Keine Benchmarks definiert' },
    { name: 'im_creator_groessen', label: 'Creator-Größe / Typ' },
    { name: 'im_nischen', label: 'Nische / Content-Kategorie' },
    { name: 'im_creator_merkmale', label: 'Creator-Merkmale' },
    { name: 'im_voraussetzungen', label: 'Besondere Voraussetzungen' },
    { name: 'im_voraussetzungen_custom', label: 'Sonstige Voraussetzungen' },
    { name: 'im_channels', label: 'Kanäle & Formate' },
    { name: 'im_formatvorgaben', label: 'Formatvorgaben' },
    { name: 'im_learnings_vorhanden', label: 'Learnings vorhanden' },
    { name: 'im_learnings_text', label: 'Learnings' },
    { name: 'im_beispiele', label: 'Beispiele' },
    { name: 'im_ideen_status', label: 'Ideen-Status' },
    { name: 'im_ideen_text', label: 'Ideen' },
    { name: 'im_referenzen', label: 'Referenzen' },
    { name: 'im_ideen_verantwortlich', label: 'Ideen-Verantwortung' },
    { name: 'im_umsetzung', label: 'Konkrete Umsetzung' },
    { name: 'im_umsetzung_offen', label: 'Umsetzung noch offen' },
    { name: 'im_situationen', label: 'Situationen / Settings / Use Cases' },
    { name: 'im_production_setup', label: 'Produktion' },
    { name: 'im_vorort', label: 'Vor-Ort / Event-Details' },
    { name: 'im_versand_anforderungen', label: 'Versand-Anforderungen' },
    { name: 'im_veroeffentlichung', label: 'Veröffentlichung' },
    { name: 'im_zusaetzliche_nutzung', label: 'Zusätzliche Nutzung' },
    { name: 'im_nutzungslogik', label: 'Nutzungslogik' },
    { name: 'im_tracking', label: 'Tracking-Mechaniken' },
    { name: 'im_ziel_url', label: 'Ziel-URL / Deep Link' },
    { name: 'im_code', label: 'Code' },
    { name: 'im_code_spaeter', label: 'Code wird später vergeben' }
  ],
  paid_creator_ads: [
    { name: 'pa_funnel_stufen', label: 'Funnel-Stufe' },
    { name: 'pa_objectives', label: 'Paid Objective' },
    { name: 'pa_kpis', label: 'Ziele / Benchmarks' },
    { name: 'pa_keine_benchmarks', label: 'Keine Benchmarks definiert' },
    { name: 'pa_creator_groessen', label: 'Creator-Größe / Typ' },
    { name: 'pa_nischen', label: 'Nische / Content-Kategorie' },
    { name: 'pa_creator_merkmale', label: 'Creator-Merkmale' },
    { name: 'pa_voraussetzungen', label: 'Besondere Voraussetzungen' },
    { name: 'pa_voraussetzungen_custom', label: 'Sonstige Voraussetzungen' },
    { name: 'pa_channels', label: 'Paid-Kanäle' },
    { name: 'pa_learnings_vorhanden', label: 'Learnings vorhanden' },
    { name: 'pa_learnings_text', label: 'Learnings' },
    { name: 'pa_beispiele', label: 'Beispiele' },
    { name: 'pa_reporting', label: 'Reporting' },
    { name: 'pa_ideen_status', label: 'Ideen-Status' },
    { name: 'pa_ideen_text', label: 'Ideen' },
    { name: 'pa_referenzen', label: 'Referenzen' },
    { name: 'pa_ideen_verantwortlich', label: 'Ideen-Verantwortung' },
    { name: 'pa_umsetzung', label: 'Konkrete Umsetzung' },
    { name: 'pa_umsetzung_offen', label: 'Umsetzung noch offen' },
    { name: 'pa_situationen', label: 'Situationen / Settings / Use Cases' },
    { name: 'pa_production_setup', label: 'Produktion' },
    { name: 'pa_vorort', label: 'Vor-Ort-Details' },
    { name: 'pa_versand_anforderungen', label: 'Versand-Anforderungen' },
    { name: 'pa_videolaengen', label: 'Videolänge' },
    { name: 'pa_ratios', label: 'Format / Ratio' },
    { name: 'pa_zusaetzliche_versionen', label: 'Zusätzliche Versionen' },
    { name: 'pa_destination', label: 'Destination' },
    { name: 'pa_ziel_url', label: 'Ziel-URL / Deep Link' }
  ],
  owned_social: [
    { name: 'os_content_ziele', label: 'Organische Content-Ziele' },
    { name: 'os_kpis', label: 'Ziele / Benchmarks' },
    { name: 'os_keine_benchmarks', label: 'Keine Benchmarks definiert' },
    { name: 'os_creator_groessen', label: 'Creator-Größe / Typ' },
    { name: 'os_nischen', label: 'Nische / Content-Kategorie' },
    { name: 'os_creator_merkmale', label: 'Creator-Merkmale' },
    { name: 'os_voraussetzungen', label: 'Besondere Voraussetzungen' },
    { name: 'os_voraussetzungen_custom', label: 'Sonstige Voraussetzungen' },
    { name: 'os_channels', label: 'Marken-Kanäle & Formate' },
    { name: 'os_formatvorgaben', label: 'Formatvorgaben' },
    { name: 'os_learnings_vorhanden', label: 'Learnings vorhanden' },
    { name: 'os_learnings_text', label: 'Learnings' },
    { name: 'os_beispiele', label: 'Beispiele' },
    { name: 'os_reporting', label: 'Reporting' },
    { name: 'os_ideen_status', label: 'Ideen-Status' },
    { name: 'os_ideen_text', label: 'Ideen' },
    { name: 'os_referenzen', label: 'Referenzen' },
    { name: 'os_ideen_verantwortlich', label: 'Ideen-Verantwortung' },
    { name: 'os_umsetzung', label: 'Konkrete Umsetzung' },
    { name: 'os_umsetzung_offen', label: 'Umsetzung noch offen' },
    { name: 'os_situationen', label: 'Situationen / Settings / Use Cases' },
    { name: 'os_content_ansatz', label: 'Content-Ansatz' },
    { name: 'os_content_pillars', label: 'Content Pillars' },
    { name: 'os_production_setup', label: 'Produktion' },
    { name: 'os_vorort', label: 'Vor-Ort / Event-Details' },
    { name: 'os_versand_anforderungen', label: 'Versand-Anforderungen' },
    { name: 'os_zusatz_assets', label: 'Zusätzliche Assets' },
    { name: 'os_assets', label: 'Welche zusätzlichen Assets' },
    { name: 'os_assets_anforderungen', label: 'Asset-Anforderungen' }
  ]
};

function isEmpty(value) {
  if (value == null || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
    return true;
  }
  return false;
}

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

export function fmtBriefingValue(value) {
  if (value == null) return null;
  if (typeof value === 'boolean') return value ? 'Ja' : null;
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

function hasFlowContent(briefing) {
  return FLOW_MARKERS.some(name => !isEmpty(briefing?.[name]));
}

function hasPrefixContent(briefing) {
  const catalog = LEGACY_MODULE_FIELDS[briefing?.bereich] || [];
  return catalog.some(field => fmtBriefingValue(briefing?.[field.name]) != null);
}

export function isLegacyBriefing(briefing) {
  if (!briefing) return false;
  if (hasFlowContent(briefing)) return false;
  return hasPrefixContent(briefing);
}

export function resolveBriefingFieldValue(briefing, fieldName) {
  if (fieldName === 'videolaenge') return anzeigeWert(briefing);
  const current = briefing?.[fieldName];
  if (!isEmpty(current)) return current;

  const prefix = PREFIX[briefing?.bereich];

  if (fieldName === 'publish_channels') {
    if (briefing?.bereich === 'paid_creator_ads') return current ?? null;
    if (prefix) return briefing[`${prefix}channels`] ?? null;
    return briefing?.im_channels ?? briefing?.os_channels ?? null;
  }
  if (fieldName === 'ad_channels') return briefing?.pa_channels ?? null;
  if (fieldName === 'funnel_stufen') return briefing?.pa_funnel_stufen ?? null;
  if (fieldName === 'paid_objectives') return briefing?.pa_objectives ?? null;
  if (fieldName === 'videolaengen') return briefing?.pa_videolaengen ?? null;
  if (fieldName === 'ziel_url') return briefing?.pa_ziel_url ?? briefing?.im_ziel_url ?? null;
  if (fieldName === 'content_ziele') return briefing?.os_content_ziele ?? null;

  const suffix = FLOW_TO_SUFFIX[fieldName];
  if (!suffix || !prefix) return current ?? null;
  return briefing[`${prefix}${suffix}`] ?? null;
}

export function collectLegacyPresentation(briefing, escape = (s) => String(s ?? '')) {
  const catalog = LEGACY_MODULE_FIELDS[briefing?.bereich] || [];
  const prose = [];
  const specs = [];

  for (const field of catalog) {
    const value = briefing?.[field.name];
    const formatted = fmtBriefingValue(value);
    if (!formatted) continue;
    const html = escape(formatted);

    if (typeof value === 'string') {
      prose.push({
        title: field.label,
        items: [{
          field: { name: field.name, label: field.label, type: 'textarea' },
          formatted: html,
          value
        }]
      });
    } else {
      specs.push({ label: field.label, html });
    }
  }

  return { callout: [], prose, specs, creator: [], secondary: [] };
}
