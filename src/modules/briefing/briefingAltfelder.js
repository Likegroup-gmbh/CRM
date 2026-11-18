// briefingAltfelder.js
// Felder, die das Formular seit dem Creator-Briefing nicht mehr abfragt (ADR 0073).
// Die Werte bleiben in der Datenbank. Das Team sieht sie als „Frühere Angaben“,
// Kunde und Creator-PDF nie. Die KI liest sie als Fallback, solange das neue Feld leer ist.

import { GESCHLECHT_OPTIONS } from '../../core/form/config/CreatorFormConfig.js';
import { optionWert } from './create/fieldConfig.js';
import { ideenListe } from './ideenSplit.js';

export const FRUEHERE_ANGABEN_TITEL = 'Frühere Angaben';

export const FUNNEL_STUFEN_OPTIONS = [
  { value: 'upper', label: 'Upper Funnel – Awareness' },
  { value: 'mid', label: 'Mid Funnel – Consideration' },
  { value: 'lower', label: 'Lower Funnel – Conversion' }
];

const NISCHEN_OPTIONS = [
  { value: 'beauty', label: 'Beauty / Skincare' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'food', label: 'Food / Cooking' },
  { value: 'fitness', label: 'Fitness / Sport' },
  { value: 'health', label: 'Health / Wellness' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'family', label: 'Family / Parenting' },
  { value: 'home', label: 'Home / Interior' },
  { value: 'diy', label: 'DIY' },
  { value: 'tech', label: 'Tech' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'travel', label: 'Travel' },
  { value: 'finance', label: 'Finance' },
  { value: 'business', label: 'Business / Career' },
  { value: 'education', label: 'Education' },
  { value: 'entertainment', label: 'Entertainment / Comedy' },
  { value: 'music', label: 'Music' },
  { value: 'art', label: 'Art / Creative' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'pets', label: 'Pets' },
  { value: 'sonstiges', label: 'Sonstiges' },
  { value: 'keine_vorgabe', label: 'Keine Vorgabe / Agenturempfehlung' }
];

const VORAUSSETZUNGEN_OPTIONS = [
  { value: 'kind_familie', label: 'Kind / Familie' },
  { value: 'haustier', label: 'Haustier' },
  { value: 'auto_fuehrerschein', label: 'Auto / Führerschein' },
  { value: 'kueche', label: 'Küche / Kochmöglichkeit' },
  { value: 'garten_outdoor', label: 'Garten / Outdoor-Fläche' },
  { value: 'instrument', label: 'Instrument' },
  { value: 'gaming_setup', label: 'Gaming Setup' },
  { value: 'sport_equipment', label: 'Sport-/Fitness-Equipment' },
  { value: 'location_wohnsituation', label: 'Bestimmte Location / Wohnsituation' },
  { value: 'weitere_personen', label: 'Weitere Person(en) verfügbar' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

const CREATOR_GROESSEN_OPTIONS = [
  { value: 'ugc_creator', label: 'UGC Creator (keine Zahl)' },
  { value: 'nano', label: 'Nano (0–10K)' },
  { value: 'micro', label: 'Micro (10K–100K)' },
  { value: 'mid_tier', label: 'Mid-Tier (100K–500K)' },
  { value: 'macro', label: 'Macro (500K–1Mio)' },
  { value: 'hero', label: 'Hero (1Mio+)' },
  { value: 'keine_vorgabe', label: 'Keine Vorgabe / Agenturempfehlung' }
];

export const CREATOR_ALTER_OPTIONS = [
  { value: '18-24', label: '18–24' },
  { value: '25-34', label: '25–34' },
  { value: '35-44', label: '35–44' },
  { value: '45-54', label: '45–54' },
  { value: '55+', label: '55+' }
];

const PAID_OBJECTIVES_OPTIONS = [
  { value: 'awareness', label: 'Awareness / Reach' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'video_views', label: 'Video Views' },
  { value: 'engagement', label: 'Engagement / Community Interaction' },
  { value: 'leads', label: 'Leads' },
  { value: 'app_promotion', label: 'App Promotion / App Installs' },
  { value: 'sales', label: 'Sales / Conversions' }
];

const OWNED_CONTENT_ZIELE_OPTIONS = [
  { value: 'reichweite', label: 'Reichweite / Views steigern' },
  { value: 'watch_time', label: 'Watch Time erhöhen' },
  { value: 'retention', label: 'Retention verbessern' },
  { value: 'engagement', label: 'Engagement steigern' },
  { value: 'shares', label: 'Shares erhöhen' },
  { value: 'saves', label: 'Saves erhöhen' },
  { value: 'community', label: 'Community Interaction steigern' },
  { value: 'follower_growth', label: 'Follower Growth unterstützen' },
  { value: 'consideration', label: 'Product / Brand Consideration stärken' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

const FORMATE = (...paare) => paare.map(([value, label]) => ({ value, label }));

const PUBLISH_CHANNELS = [
  { key: 'instagram', label: 'Instagram', formats: FORMATE(['reel', 'Reel'], ['story', 'Story'], ['feed_post', 'Feed Post'], ['carousel', 'Carousel'], ['live', 'Live']) },
  { key: 'tiktok', label: 'TikTok', formats: FORMATE(['video', 'TikTok Video'], ['story', 'TikTok Story'], ['live', 'LIVE']) },
  { key: 'youtube', label: 'YouTube', formats: FORMATE(['short', 'YouTube Short'], ['longform', 'YouTube Long-form'], ['live', 'YouTube Live']) },
  { key: 'facebook', label: 'Facebook', formats: null },
  { key: 'pinterest', label: 'Pinterest', formats: null }
];

const AD_CHANNELS = [
  { key: 'meta', label: 'Meta', formats: FORMATE(['instagram', 'Instagram'], ['facebook', 'Facebook']) },
  { key: 'tiktok', label: 'TikTok', formats: null },
  { key: 'youtube', label: 'YouTube', formats: FORMATE(['shorts', 'YouTube Shorts'], ['instream', 'YouTube Long-form / In-Stream']) },
  { key: 'google', label: 'Google', formats: FORMATE(['performance_max', 'Performance Max'], ['display', 'Display'], ['demand_gen', 'Demand Gen']) },
  { key: 'pinterest', label: 'Pinterest', formats: null }
];

/** Altfelder in Anzeigereihenfolge. Typen wie im alten Formular, damit formatValue sie darstellt. */
export const ALTFELDER = [
  { name: 'funnel_stufen', label: 'Funnel-Stufe', type: 'checkboxes', options: FUNNEL_STUFEN_OPTIONS },
  { name: 'videolaenge_funnel', label: 'Videolänge je Funnel-Stufe', type: 'funnelVideolaenge' },
  { name: 'paid_objectives', label: 'Paid Objective', type: 'checkboxes', options: PAID_OBJECTIVES_OPTIONS },
  { name: 'content_ziele', label: 'Organisches Content-Ziel', type: 'checkboxes', options: OWNED_CONTENT_ZIELE_OPTIONS },
  { name: 'plattformmechanik', label: 'Gewünschte Plattformmechanik', type: 'textarea' },
  { name: 'veroeffentlichungszeitraum', label: 'Veröffentlichungszeitraum (Text)', type: 'text' },
  { name: 'freigabeprozess', label: 'Freigabeprozess', type: 'textarea' },
  { name: 'tkp', label: 'TKP (€ pro 1.000 Views)', type: 'number' },
  { name: 'nischen', label: 'Nische / Content-Schwerpunkt', type: 'checkboxes', options: NISCHEN_OPTIONS },
  {
    name: 'creator_merkmale', label: 'Merkmale', type: 'group',
    fields: [
      { name: 'alter', label: 'Alter', type: 'tableSelect', options: CREATOR_ALTER_OPTIONS },
      { name: 'geschlecht', label: 'Geschlecht', type: 'tableSelect', options: GESCHLECHT_OPTIONS },
      { name: 'standort', label: 'Standort', type: 'text' }
    ]
  },
  { name: 'beteiligte_personen', label: 'Beteiligte Personen', type: 'textarea' },
  { name: 'creator_groessen', label: 'Creator-Größe', type: 'checkboxes', options: CREATOR_GROESSEN_OPTIONS },
  { name: 'voraussetzungen', label: 'Voraussetzungen', type: 'checkboxes', options: VORAUSSETZUNGEN_OPTIONS },
  { name: 'voraussetzungen_sonstiges', label: 'Sonstige Voraussetzungen', type: 'textarea' },
  { name: 'produkt_erfahrung', label: 'Produktspezifische Erfahrung', type: 'textarea' },
  { name: 'hauttyp', label: 'Hauttyp', type: 'text' },
  { name: 'haartyp', label: 'Haartyp', type: 'text' },
  { name: 'art_der_integration', label: 'Art der Integration', type: 'textarea' },
  { name: 'produktionsvoraussetzungen', label: 'Besondere Produktionsvoraussetzungen', type: 'textarea' },
  { name: 'referenzen', label: 'Referenzen und Beispiele', type: 'repeatableUpload' },
  { name: 'learnings_text', label: 'Learnings aus vergangenen Produktionen', type: 'textarea' },
  { name: 'wichtige_vorgaben', label: 'Do’s und Don’ts (alt)', type: 'textarea' },
  { name: 'ad_channels', label: 'Ad-Plattformen', type: 'channelGroup', channels: AD_CHANNELS },
  { name: 'publish_channels', label: 'Veröffentlichungs-Plattformen', type: 'channelGroup', channels: PUBLISH_CHANNELS },
  { name: 'cta', label: 'CTA', type: 'text' },
  { name: 'ziel_url', label: 'Ziel-Link / Landingpage', type: 'url' },
  { name: 'hook_vorgaben', label: 'Hook- oder Conversion-Vorgaben', type: 'textarea' },
  { name: 'unterschiedliche_hooks', label: 'Unterschiedliche Hooks', type: 'checkbox' },
  { name: 'hooks_anzahl', label: 'Anzahl der Hooks', type: 'text' },
  { name: 'trendkontext', label: 'Community- oder Trendkontext', type: 'textarea' },
  { name: 'posting_anforderungen', label: 'Posting-Anforderungen', type: 'textarea' },
  { name: 'nutzung_whitelisting', label: 'Whitelisting, Spark Ads oder Partnership Ads', type: 'checkbox' },
  { name: 'nutzungsdauer', label: 'Nutzungsdauer', type: 'text' },
  { name: 'rohmaterial', label: 'Rohmaterial erforderlich', type: 'radio', options: [{ value: 'ja', label: 'Ja' }, { value: 'nein', label: 'Nein' }] },
  { name: 'verhandlungshinweis', label: 'Verhandlungshinweis', type: 'textarea' }
];

export const ALTFELD_NAMEN = ALTFELDER.map(f => f.name);

function optionKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ');
}

function ersteZahl(text) {
  const m = String(text ?? '').match(/\d{1,3}/);
  return m ? Number(m[0]) : null;
}

function letzteZahl(text) {
  const m = String(text ?? '').match(/\d{1,3}/g);
  return m ? Number(m[m.length - 1]) : null;
}

/** Zwischenstand alter_von/alter_bis zu einer Spanne: gleiche Werte bleiben, sonst "18-44" bzw. "45+". */
function alterAusVonBis(von, bis) {
  const v = String(von ?? '').trim();
  const b = String(bis ?? '').trim();
  if (!v || !b || optionKey(v) === optionKey(b)) return v || b;
  const start = Math.min(...[ersteZahl(v), ersteZahl(b)].filter(n => n != null));
  if (!Number.isFinite(start)) return v;
  if (/\+\s*$/.test(v) || /\+\s*$/.test(b)) return `${start}+`;
  const ende = Math.max(...[letzteZahl(v), letzteZahl(b)].filter(n => n != null));
  return Number.isFinite(ende) && ende !== start ? `${start}-${ende}` : v;
}

/** creator_merkmale auf alter/geschlecht als Options-Wert bringen; Freitext bleibt unverändert. */
export function merkmaleAufNeuesFormat(value) {
  const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = { ...src };
  delete out.alter_von;
  delete out.alter_bis;
  let alter = String(src.alter ?? '').trim();
  if (!alter) alter = alterAusVonBis(src.alter_von, src.alter_bis);
  if (alter) out.alter = optionWert(CREATOR_ALTER_OPTIONS, alter) || alter;
  const geschlecht = optionWert(GESCHLECHT_OPTIONS, src.geschlecht);
  if (geschlecht) out.geschlecht = geschlecht;
  return out;
}

/** Anzeigezeilen einer Gruppe: Option-Label statt Rohwert. */
export function groupAnzeigeZeilen(field, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const src = field.name === 'creator_merkmale' ? merkmaleAufNeuesFormat(value) : value;
  const rows = [];
  for (const sub of field.fields || []) {
    const raw = String(src[sub.name] ?? '').trim();
    if (!raw) continue;
    const treffer = sub.options ? optionWert(sub.options, raw) : null;
    const text = treffer != null ? sub.options.find(o => o.value === treffer).label : raw;
    rows.push({ sub, label: sub.label, text });
  }
  return rows;
}

function kanalAktiv(wert) {
  if (wert === true) return true;
  if (Array.isArray(wert)) return wert.length > 0;
  return false;
}

/**
 * Plattformen eines älteren Briefings aus den Kanal-Spalten (publish_channels, ad_channels
 * und die Prefix-Spiegel). Nur die vier Plattformen des Creator-Briefings.
 */
export function plattformenAusAlt(briefing) {
  if (!briefing) return [];
  const publish = briefing.publish_channels || briefing.im_channels || briefing.os_channels || {};
  const ads = briefing.ad_channels || briefing.pa_channels || {};
  const meta = Array.isArray(ads.meta) ? ads.meta : [];
  const treffer = new Set();
  if (kanalAktiv(publish.instagram) || meta.includes('instagram')) treffer.add('instagram');
  if (kanalAktiv(publish.facebook) || meta.includes('facebook')) treffer.add('facebook');
  if (kanalAktiv(publish.tiktok) || kanalAktiv(ads.tiktok)) treffer.add('tiktok');
  if (kanalAktiv(publish.youtube) || kanalAktiv(ads.youtube)) treffer.add('youtube');
  return ['instagram', 'facebook', 'tiktok', 'youtube'].filter(p => treffer.has(p));
}

/** Plattformen des Briefings, bei älteren Briefings aus den Kanal-Spalten. */
export function briefingPlattformen(briefing) {
  const neu = Array.isArray(briefing?.plattformen) ? briefing.plattformen.filter(Boolean) : [];
  return neu.length ? neu : plattformenAusAlt(briefing);
}

function ideeEintrag(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const text = String(raw.text ?? '').trim();
    return text ? { text, verbindlich: raw.verbindlich === true } : null;
  }
  const text = String(raw ?? '').trim();
  return text ? { text, verbindlich: false } : null;
}

// Die Text-Spalte umsetzungsideen enthält je nach Schreiber Fließtext oder ein JSON-Array als Text.
function altIdeen(raw) {
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const liste = JSON.parse(raw);
      if (Array.isArray(liste)) return liste;
    } catch (_) { /* Fließtext */ }
  }
  return raw;
}

/**
 * Umsetzungsideen als [{ text, verbindlich }]. Fallback: die alte Spalte umsetzungsideen
 * (Text oder Liste, im_/pa_/os_ideen_text), alle als Inspiration.
 */
export function umsetzungsideenEintraege(briefing) {
  const neu = briefing?.umsetzungsideen_eintraege;
  if (Array.isArray(neu)) return neu.map(ideeEintrag).filter(Boolean);
  const prefix = { influencer_marketing: 'im_', paid_creator_ads: 'pa_', owned_social: 'os_' }[briefing?.bereich];
  const alt = altIdeen(briefing?.umsetzungsideen ?? (prefix ? briefing?.[`${prefix}ideen_text`] : null));
  return ideenListe(alt).map(ideeEintrag).filter(Boolean);
}
