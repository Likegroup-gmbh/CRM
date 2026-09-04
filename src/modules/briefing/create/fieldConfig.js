// fieldConfig.js
// Zentrale Feld-Definition fuer den Campaign-Briefing-Generator.
// Reine Datendatei: alle Fragen, Optionslisten und Conditional Rules.
// Wird von den Step-Renderern (steps/*.js) und dem FieldRenderer konsumiert.
// Spaeter auch Basis fuer PDF-/KI-Vorausfuellung (maschinenlesbares Schema).
//
// Feldtypen:
//   text | url | textarea | date | radio | checkboxes | customMulti
//   group (flache Sub-Felder -> jsonb-Spalte)
//   channelGroup (Plattform -> Formate -> jsonb-Spalte)
//   repeatableKpi ([{ kpi, zielwert }] -> jsonb)
//   repeatableText (["...", ...] -> jsonb)
//   repeatableUpload ([{ typ: 'url'|'upload', value, label? }] -> jsonb)
//
// Condition:
//   { field, equals } | { field, in: [...] } | { field, includes } (Array-Feld)
//   Bedingungen werden gegen formData ausgewertet.

// ---------------------------------------------------------------
// Bereich (Typ-Auswahl, Step 1)
// ---------------------------------------------------------------
export const BEREICH_OPTIONS = [
  { value: 'influencer_marketing', label: 'Influencer Marketing', desc: 'Creator veroeffentlichen Content auf eigenen Channels.' },
  { value: 'paid_creator_ads', label: 'Paid Creator Ads', desc: 'Creator-Content wird als Paid Ad ausgespielt.' },
  { value: 'owned_social', label: 'Owned Social', desc: 'Creator produzieren Content fuer Brand-Channels.' }
];

export const BEREICH_LABELS = Object.fromEntries(BEREICH_OPTIONS.map(b => [b.value, b.label]));

// ---------------------------------------------------------------
// Geteilte Optionslisten
// ---------------------------------------------------------------
export const ANSATZ_OPTIONS = [
  { value: 'kampagne', label: 'Kampagne' },
  { value: 'always_on', label: 'Always-on' }
];

export const KAMPAGNENTYPEN_OPTIONS = [
  { value: 'produktlaunch', label: 'Produktlaunch' },
  { value: 'saisonal', label: 'Saisonaler Anlass' },
  { value: 'promotion', label: 'Promotion / Sales Push' },
  { value: 'event', label: 'Event / Live Activation' },
  { value: 'brand', label: 'Brand Campaign' },
  { value: 'awareness', label: 'Awareness Initiative' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

export const ALWAYS_ON_BESTEHEND_OPTIONS = [
  { value: 'fortfuehren', label: 'Ja – soll fortgefuehrt werden' },
  { value: 'weiterentwickeln', label: 'Ja – soll weiterentwickelt werden' },
  { value: 'neu', label: 'Nein – soll neu entwickelt werden' }
];

export const MAERKTE_OPTIONS = [
  { value: 'deutschland', label: 'Deutschland' },
  { value: 'oesterreich', label: 'Oesterreich' },
  { value: 'schweiz', label: 'Schweiz' }
];

export const SPRACHEN_OPTIONS = [
  { value: 'deutsch', label: 'Deutsch' },
  { value: 'englisch', label: 'Englisch' }
];

export const SPRACHADAPTION_OPTIONS = [
  { value: 'untertitel', label: 'Untertitel' },
  { value: 'on_screen_text', label: 'Uebersetzter On-Screen-Text' },
  { value: 'voice_over', label: 'Voice-over' },
  { value: 'separate_version', label: 'Separate Content-Version' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

export const FUNNEL_STUFEN_OPTIONS = [
  { value: 'upper', label: 'Upper Funnel – Awareness' },
  { value: 'mid', label: 'Mid Funnel – Consideration' },
  { value: 'lower', label: 'Lower Funnel – Conversion' }
];

export const NISCHEN_OPTIONS = [
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

export const VORAUSSETZUNGEN_OPTIONS = [
  { value: 'haustier', label: 'Haustier' },
  { value: 'kind_familie', label: 'Kind / Familie' },
  { value: 'auto_fuehrerschein', label: 'Auto / Fuehrerschein' },
  { value: 'kueche', label: 'Kueche / Kochmoeglichkeit' },
  { value: 'garten_outdoor', label: 'Garten / Outdoor-Flaeche' },
  { value: 'instrument', label: 'Instrument' },
  { value: 'gaming_setup', label: 'Gaming Setup' },
  { value: 'sport_equipment', label: 'Sport-/Fitness-Equipment' },
  { value: 'location_wohnsituation', label: 'Bestimmte Location / Wohnsituation' },
  { value: 'weitere_personen', label: 'Weitere Person(en) verfuegbar' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

export const IDEEN_STATUS_OPTIONS = [
  { value: 'ja', label: 'Ja' },
  { value: 'teilweise', label: 'Teilweise' },
  { value: 'nein', label: 'Nein' }
];

export const IDEEN_VERANTWORTLICH_OPTIONS = [
  { value: 'kunde', label: 'Kunde' },
  { value: 'agentur', label: 'Agentur' },
  { value: 'creator', label: 'Creator' },
  { value: 'gemeinsam', label: 'Gemeinsam' }
];

export const PRODUCTION_SETUP_OPTIONS = [
  { value: 'alleine', label: 'Creator produziert alleine / eigenstaendig' },
  { value: 'mehrere_creator', label: 'Mehrere Creator gemeinsam' },
  { value: 'mit_personen', label: 'Creator + weitere Person(en)' },
  { value: 'videograf', label: 'Creator + Videograf / Produktionsteam' },
  { value: 'studio', label: 'Professionelle Produktion / Studio' },
  { value: 'vor_ort', label: 'Vor Ort / On-Location' },
  { value: 'event', label: 'Event-Produktion' },
  { value: 'kombination', label: 'Kombination' },
  { value: 'offen', label: 'Noch offen / Agenturempfehlung' }
];

// Paid: keine Event-Produktion laut Spec
export const PRODUCTION_SETUP_OPTIONS_PAID = PRODUCTION_SETUP_OPTIONS.filter(o => o.value !== 'event');

// ---------------------------------------------------------------
// Modul-spezifische Optionslisten
// ---------------------------------------------------------------
export const CREATOR_GROESSEN_IM = [
  { value: 'nano', label: 'Nano' },
  { value: 'micro', label: 'Micro' },
  { value: 'mid_tier', label: 'Mid-Tier' },
  { value: 'macro', label: 'Macro' },
  { value: 'hero', label: 'Hero' },
  { value: 'keine_vorgabe', label: 'Keine Vorgabe / Agenturempfehlung' }
];

export const CREATOR_GROESSEN_UGC = [
  { value: 'ugc_creator', label: 'UGC Creator' },
  ...CREATOR_GROESSEN_IM
];

export const KPI_OPTIONS_IM = [
  { value: 'reichweite', label: 'Reichweite' },
  { value: 'impressions', label: 'Impressions' },
  { value: 'views', label: 'Views' },
  { value: 'cpm', label: 'CPM / TKP' },
  { value: 'engagement_rate', label: 'Engagement Rate' },
  { value: 'cpe', label: 'CPE' },
  { value: 'klicks', label: 'Klicks' },
  { value: 'cpc', label: 'CPC' },
  { value: 'conversions', label: 'Conversions / Sales' },
  { value: 'cpa', label: 'CPA / CPO' },
  { value: 'roas', label: 'ROAS' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

export const KPI_OPTIONS_PAID = [
  { value: 'reach_impressions', label: 'Reach / Impressions' },
  { value: 'cpm', label: 'CPM' },
  { value: 'ctr', label: 'CTR' },
  { value: 'cpc', label: 'CPC' },
  { value: 'cpv', label: 'CPV' },
  { value: 'vtr', label: 'VTR' },
  { value: 'cpl', label: 'CPL' },
  { value: 'cpi', label: 'CPI / Cost per Install' },
  { value: 'cpa', label: 'CPA / CPO' },
  { value: 'cac', label: 'CAC' },
  { value: 'conversion_rate', label: 'Conversion Rate' },
  { value: 'roas', label: 'ROAS' },
  { value: 'umsatz', label: 'Umsatz' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

export const KPI_OPTIONS_OWNED = [
  { value: 'reach', label: 'Reach' },
  { value: 'impressions', label: 'Impressions' },
  { value: 'views', label: 'Views' },
  { value: 'watch_time', label: 'Watch Time' },
  { value: 'retention_rate', label: 'Retention Rate' },
  { value: 'engagement_rate', label: 'Engagement Rate' },
  { value: 'saves', label: 'Saves' },
  { value: 'shares', label: 'Shares' },
  { value: 'kommentare', label: 'Kommentare' },
  { value: 'follower_growth', label: 'Follower Growth' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

export const PAID_OBJECTIVES_OPTIONS = [
  { value: 'awareness', label: 'Awareness / Reach' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'video_views', label: 'Video Views' },
  { value: 'engagement', label: 'Engagement / Community Interaction' },
  { value: 'leads', label: 'Leads' },
  { value: 'app_promotion', label: 'App Promotion / App Installs' },
  { value: 'sales', label: 'Sales / Conversions' }
];

export const OWNED_CONTENT_ZIELE_OPTIONS = [
  { value: 'reichweite', label: 'Reichweite / Views steigern' },
  { value: 'watch_time', label: 'Watch Time erhoehen' },
  { value: 'retention', label: 'Retention verbessern' },
  { value: 'engagement', label: 'Engagement steigern' },
  { value: 'shares', label: 'Shares erhoehen' },
  { value: 'saves', label: 'Saves erhoehen' },
  { value: 'community', label: 'Community Interaction steigern' },
  { value: 'follower_growth', label: 'Follower Growth unterstuetzen' },
  { value: 'consideration', label: 'Product / Brand Consideration staerken' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

export const TRACKING_OPTIONS = [
  { value: 'landingpage', label: 'Landingpage' },
  { value: 'pdp', label: 'Product Detail Page' },
  { value: 'shop', label: 'Shop' },
  { value: 'app_deep_link', label: 'App / Deep Link' },
  { value: 'tracking_link', label: 'Tracking-Link' },
  { value: 'rabattcode', label: 'Rabattcode' },
  { value: 'affiliate', label: 'Affiliate-Code / Affiliate-Link' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

export const VEROEFFENTLICHUNG_OPTIONS = [
  { value: 'creator_channel', label: 'Creator Channel' },
  { value: 'co_author', label: 'Co-Author / Collab Post mit Brand' },
  { value: 'keine', label: 'Keine Veroeffentlichung auf Creator Channel' }
];

export const ZUSAETZLICHE_NUTZUNG_OPTIONS = [
  { value: 'paid_amplification', label: 'Paid Amplification' },
  { value: 'whitelisting', label: 'Partnership Ads / Whitelisting' },
  { value: 'brand_nutzung', label: 'Separate Nutzung durch die Brand' },
  { value: 'keine', label: 'Keine zusaetzliche Nutzung' },
  { value: 'offen', label: 'Noch offen / Agenturempfehlung' }
];

export const VIDEOLAENGEN_OPTIONS = [
  { value: '6s', label: '6 Sek.' },
  { value: '10s', label: '10 Sek.' },
  { value: '15s', label: '15 Sek.' },
  { value: '20s', label: '20 Sek.' },
  { value: '30s', label: '30 Sek.' },
  { value: '60s', label: '60 Sek.' },
  { value: 'individuell', label: 'Individuell' },
  { value: 'agenturempfehlung', label: 'Agenturempfehlung' }
];

export const RATIOS_OPTIONS = [
  { value: '9:16', label: '9:16' },
  { value: '4:5', label: '4:5' },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

export const DESTINATION_OPTIONS = [
  { value: 'website', label: 'Website / Landingpage' },
  { value: 'pdp', label: 'Product Detail Page' },
  { value: 'shop', label: 'Shop' },
  { value: 'lead_form', label: 'Lead Form' },
  { value: 'app_store', label: 'App Store' },
  { value: 'deep_link', label: 'App / Deep Link' },
  { value: 'social_profile', label: 'Social Profile / Community' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

export const CONTENT_ANSATZ_OPTIONS = [
  { value: 'wiederkehrend', label: 'Wiederkehrendes Format / gleiche Grundidee' },
  { value: 'unterschiedliche_ideen', label: 'Unterschiedliche Content-Ideen' },
  { value: 'pillars', label: 'Unterschiedliche Content Pillars / Serien' },
  { value: 'mischung', label: 'Mischung' },
  { value: 'offen', label: 'Noch offen / Agenturempfehlung' }
];

export const ZUSATZ_ASSETS_OPTIONS = [
  { value: 'nein', label: 'Nein' },
  { value: 'ja', label: 'Ja' },
  { value: 'offen', label: 'Noch offen / Agenturempfehlung' }
];

export const ASSETS_OPTIONS = [
  { value: 'produktaufnahmen', label: 'Produktaufnahmen' },
  { value: 'closeups', label: 'Detail- / Close-up-Shots' },
  { value: 'b_roll', label: 'B-Roll' },
  { value: 'stills', label: 'Stills / Fotos' },
  { value: 'mood', label: 'Mood Content' },
  { value: 'grafik', label: 'Grafik- / Textvarianten' },
  { value: 'cutdowns', label: 'Cutdowns / zusaetzliche Edits' },
  { value: 'sonstiges', label: 'Sonstiges' }
];

// Channel-Strukturen fuer channelGroup-Felder
export const IM_CHANNELS = [
  { key: 'instagram', label: 'Instagram', formats: [
    { value: 'reel', label: 'Reel' },
    { value: 'story', label: 'Story' },
    { value: 'feed_post', label: 'Feed Post' },
    { value: 'carousel', label: 'Carousel' },
    { value: 'live', label: 'Live' }
  ]},
  { key: 'tiktok', label: 'TikTok', formats: [
    { value: 'video', label: 'TikTok Video' },
    { value: 'story', label: 'TikTok Story' },
    { value: 'live', label: 'LIVE' }
  ]},
  { key: 'youtube', label: 'YouTube', formats: [
    { value: 'short', label: 'YouTube Short' },
    { value: 'longform', label: 'YouTube Long-form' },
    { value: 'live', label: 'YouTube Live' }
  ]}
];

export const PAID_CHANNELS = [
  { key: 'meta', label: 'Meta', formats: [
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' }
  ]},
  { key: 'tiktok', label: 'TikTok', formats: null }, // Toggle ohne Unterformate
  { key: 'youtube', label: 'YouTube', formats: [
    { value: 'shorts', label: 'YouTube Shorts' },
    { value: 'instream', label: 'YouTube Long-form / In-Stream' }
  ]},
  { key: 'google', label: 'Google', formats: [
    { value: 'performance_max', label: 'Performance Max' },
    { value: 'display', label: 'Display' },
    { value: 'demand_gen', label: 'Demand Gen' }
  ]},
  { key: 'pinterest', label: 'Pinterest', formats: null },
  { key: 'linkedin', label: 'LinkedIn', formats: null }
];

export const OWNED_CHANNELS = [
  { key: 'instagram', label: 'Instagram', formats: [
    { value: 'reel', label: 'Reel' },
    { value: 'story', label: 'Story' },
    { value: 'feed_post', label: 'Feed Post' },
    { value: 'carousel', label: 'Carousel' }
  ]},
  { key: 'tiktok', label: 'TikTok', formats: [
    { value: 'video', label: 'TikTok Video' }
  ]},
  { key: 'youtube', label: 'YouTube', formats: [
    { value: 'short', label: 'YouTube Short' },
    { value: 'longform', label: 'YouTube Long-form' }
  ]},
  { key: 'facebook', label: 'Facebook', formats: null },
  { key: 'linkedin', label: 'LinkedIn', formats: null },
  { key: 'pinterest', label: 'Pinterest', formats: null }
];

// ---------------------------------------------------------------
// Geteilte Feld-Bloecke (per Prefix vervielfaeltigt)
// ---------------------------------------------------------------

// 1.2 / 2.2 / 3.2 Creator-Anforderungen
function creatorFields(prefix, groessenOptions) {
  return [
    { name: `${prefix}_creator_groessen`, label: 'Creator-Groesse / Typ', type: 'checkboxes', options: groessenOptions },
    { name: `${prefix}_nischen`, label: 'Nische / Content-Kategorie', type: 'checkboxes', options: NISCHEN_OPTIONS, compact: true },
    {
      name: `${prefix}_creator_merkmale`, label: 'Creator-Merkmale (optional)', type: 'group',
      fields: [
        { name: 'alter', label: 'Alter / Altersspanne', type: 'text', placeholder: 'z.B. 25-34' },
        { name: 'geschlecht', label: 'Geschlecht', type: 'text' },
        { name: 'standort', label: 'Standort', type: 'text' },
        { name: 'expertise', label: 'Expertise / Skills', type: 'text' },
        { name: 'sonstiges', label: 'Sonstiges', type: 'text' }
      ]
    },
    { name: `${prefix}_voraussetzungen`, label: 'Besondere Voraussetzungen (optional)', type: 'checkboxes', options: VORAUSSETZUNGEN_OPTIONS, compact: true },
    { name: `${prefix}_voraussetzungen_custom`, label: 'Sonstige Voraussetzungen', type: 'text', condition: { field: `${prefix}_voraussetzungen`, includes: 'sonstiges' } }
  ];
}

// 1.4 / 2.4 / 3.4 Learnings
function learningsFields(prefix, { withReporting = false } = {}) {
  const fields = [
    {
      name: `${prefix}_learnings_vorhanden`, label: 'Gibt es Learnings aus vergleichbaren Aktivitaeten?', type: 'radio',
      options: [
        { value: 'true', label: 'Ja' },
        { value: 'false', label: 'Nein' }
      ]
    },
    {
      name: `${prefix}_learnings_text`, label: 'Was hat bisher besonders gut oder schlecht funktioniert?', type: 'textarea', rows: 3,
      condition: { field: `${prefix}_learnings_vorhanden`, equals: true }
    },
    {
      name: `${prefix}_beispiele`, label: 'Bitte 2-3 besonders gut performende Beispiele bereitstellen.', type: 'repeatableUpload', max: 3,
      condition: { field: `${prefix}_learnings_vorhanden`, equals: true }
    }
  ];
  if (withReporting) {
    fields.push({
      name: `${prefix}_reporting`, label: 'Performance-Daten / bestehendes Reporting (optional)', type: 'repeatableUpload', max: 2,
      condition: { field: `${prefix}_learnings_vorhanden`, equals: true }
    });
  }
  return fields;
}

// 1.5 / 2.5 / 3.5 Ideen
function ideenFields(prefix) {
  return [
    { name: `${prefix}_ideen_status`, label: 'Gibt es bereits konkrete Ideen fuer die Umsetzung?', type: 'radio', options: IDEEN_STATUS_OPTIONS },
    { name: `${prefix}_ideen_text`, label: 'Welche Ideen gibt es bereits?', type: 'textarea', rows: 3, condition: { field: `${prefix}_ideen_status`, in: ['ja', 'teilweise'] } },
    { name: `${prefix}_referenzen`, label: 'Referenzen / Moodboards / Beispiele (optional)', type: 'repeatableUpload', max: 3, condition: { field: `${prefix}_ideen_status`, in: ['ja', 'teilweise'] } },
    { name: `${prefix}_ideen_verantwortlich`, label: 'Wer soll die Ideen entwickeln?', type: 'checkboxes', options: IDEEN_VERANTWORTLICH_OPTIONS, condition: { field: `${prefix}_ideen_status`, in: ['ja', 'teilweise'] } }
  ];
}

// 1.6 / 2.6 / 3.6 Umsetzung
function umsetzungFields(prefix, umsetzungHelper) {
  return [
    { name: `${prefix}_umsetzung`, label: 'Was sollen die Creator konkret umsetzen?', type: 'textarea', rows: 4, helper: umsetzungHelper },
    { name: `${prefix}_umsetzung_offen`, label: 'Noch offen / Agentur bzw. Creator entwickelt Vorschlaege', type: 'checkbox' },
    { name: `${prefix}_situationen`, label: 'Gibt es bestimmte Situationen, Settings oder Use Cases? (optional)', type: 'textarea', rows: 3 }
  ];
}

// 1.7 / 2.7 / 3.7 Produktion
function produktionFields(prefix, setupOptions = PRODUCTION_SETUP_OPTIONS) {
  return [
    { name: `${prefix}_production_setup`, label: 'Wie soll der Content produziert werden?', type: 'checkboxes', options: setupOptions },
    {
      name: `${prefix}_vorort`, label: 'Vor-Ort / Event-Details', type: 'group',
      condition: { field: `${prefix}_production_setup`, includesAny: ['vor_ort', 'event'] },
      fields: [
        { name: 'ort', label: 'Ort', type: 'text' },
        { name: 'zeitraum', label: 'Datum / Zeitraum', type: 'text' },
        { name: 'infos', label: 'Zusaetzliche Informationen', type: 'textarea', rows: 2 }
      ]
    },
    { name: `${prefix}_versand_anforderungen`, label: 'Besondere Anforderungen an Produktversand / Produktverfuegbarkeit (optional)', type: 'textarea', rows: 2 }
  ];
}

// ---------------------------------------------------------------
// Step-Definitionen
// ---------------------------------------------------------------

// Master-Steps gelten fuer alle Bereiche (Step 2 und 3)
export const MASTER_STEPS = [
  {
    id: 'master',
    label: 'Master',
    sections: [
      {
        title: 'Zuordnung',
        description: 'Fuer welches Unternehmen, welche Marke und welche Produkte ist das Briefing?',
        fields: [
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'entitySelect', table: 'unternehmen', displayField: 'firmenname', required: true, placeholder: 'Unternehmen auswaehlen...' },
          { name: 'marke_id', label: 'Marke (optional)', type: 'entitySelect', table: 'marke', displayField: 'markenname', dependsOn: 'unternehmen_id', placeholder: 'Marke auswaehlen...' },
          { name: 'assignee_id', label: 'Zugewiesen an (optional)', type: 'entitySelect', table: 'benutzer', displayField: 'name', placeholder: 'Mitarbeiter auswaehlen...' },
          {
            name: 'produkt_ids', label: 'Produkte (optional)', type: 'entityMulti',
            table: 'produkt', displayField: 'name', persist: false, dependsOn: 'unternehmen_id',
            placeholder: 'Produkte suchen und hinzufügen...',
            helper: 'Ein oder mehrere Produkte, auf die sich das Briefing bezieht.'
          }
        ]
      },
      {
        title: 'Campaign Master',
        description: 'Grundlegendes zur Aktivierung.',
        fields: [
          { name: 'aktivierung_name', label: 'Wie heisst die Aktivierung?', type: 'text', required: true, placeholder: 'z.B. Summer Glow Launch 2026' },
          { name: 'ansatz', label: 'Handelt es sich um eine Kampagne oder einen Always-on-Ansatz?', type: 'radio', options: ANSATZ_OPTIONS },
          {
            name: 'kampagne_thema', label: 'Worum geht es in der Kampagne?', type: 'textarea', rows: 3,
            helper: 'Was ist der Anlass bzw. das Thema der Kampagne und was soll kommuniziert werden?',
            condition: { field: 'ansatz', equals: 'kampagne' }
          },
          {
            name: 'kampagnentypen', label: 'Anlass / Kampagnentyp (optional)', type: 'checkboxes', options: KAMPAGNENTYPEN_OPTIONS, compact: true,
            condition: { field: 'ansatz', equals: 'kampagne' }
          },
          {
            name: 'always_on_thema', label: 'Worum geht es im Always-on-Ansatz?', type: 'textarea', rows: 3,
            helper: 'Welche Themen, Produkte oder Kommunikationsbereiche sollen kontinuierlich mit Creator Content bespielt werden?',
            condition: { field: 'ansatz', equals: 'always_on' }
          },
          {
            name: 'always_on_bestehend', label: 'Gibt es bereits einen bestehenden Ansatz?', type: 'radio', options: ALWAYS_ON_BESTEHEND_OPTIONS,
            condition: { field: 'ansatz', equals: 'always_on' }
          }
        ]
      }
    ]
  },
  {
    id: 'rahmen',
    label: 'Setup',
    sections: [
      {
        title: 'Rolle der Creator',
        fields: [
          {
            name: 'creator_rolle', label: 'Welche Rolle sollen Creator innerhalb der Aktivierung uebernehmen?', type: 'textarea', rows: 3,
            helper: 'Beispiele: Produkt erklaeren, authentische Anwendung zeigen, Erfahrungen teilen, Aufmerksamkeit erzeugen, Entertainment schaffen, Performance Content produzieren oder kontinuierlich Content fuer Brand Channels erstellen.'
          },
          { name: 'creator_rolle_offen', label: 'Noch offen / Agenturempfehlung', type: 'checkbox' }
        ]
      },
      {
        title: 'Markt & Sprache',
        fields: [
          { name: 'maerkte', label: 'Markt', type: 'customMulti', options: MAERKTE_OPTIONS, customPlaceholder: 'Weitere Maerkte (kommagetrennt)...' },
          { name: 'sprachen', label: 'Content-Sprache', type: 'customMulti', options: SPRACHEN_OPTIONS, customPlaceholder: 'Weitere Sprachen (kommagetrennt)...' },
          {
            name: 'zusaetzliche_sprachen', label: 'Werden zusaetzliche Sprachversionen benoetigt?', type: 'radio',
            options: [
              { value: 'false', label: 'Nein' },
              { value: 'true', label: 'Ja' }
            ]
          },
          {
            name: 'weitere_sprachen', label: 'Weitere Sprache(n)', type: 'customMulti', options: [], customPlaceholder: 'Sprachen eintragen (kommagetrennt)...',
            condition: { field: 'zusaetzliche_sprachen', equals: true }
          },
          {
            name: 'sprachadaption', label: 'Wie sollen die zusaetzlichen Sprachversionen umgesetzt werden?', type: 'checkboxes', options: SPRACHADAPTION_OPTIONS,
            condition: { field: 'zusaetzliche_sprachen', equals: true }
          }
        ]
      },
      {
        title: 'Zentrale Termine',
        fields: [
          { name: 'content_deadline', label: 'Content Deadline', type: 'date' },
          { name: 'go_live', label: 'Go-live', type: 'date' },
          { name: 'embargo', label: 'Embargo / Sperrfrist (optional)', type: 'date' },
          { name: 'weitere_deadline_bezeichnung', label: 'Weitere zwingende Deadline – Bezeichnung (optional)', type: 'text' },
          { name: 'weitere_deadline', label: 'Weitere zwingende Deadline – Datum (optional)', type: 'date' }
        ]
      }
    ]
  }
];

// ---------------------------------------------------------------
// Modul-Steps je Bereich
// ---------------------------------------------------------------
export const MODULE_STEPS = {
  influencer_marketing: [
    {
      id: 'im_ziele',
      label: 'Ziele',
      sections: [
        {
          title: 'Was soll erreicht werden?',
          fields: [
            { name: 'im_funnel_stufen', label: 'Funnel-Stufe', type: 'checkboxes', options: FUNNEL_STUFEN_OPTIONS },
            { name: 'im_kpis', label: 'Welche konkreten Ziele / Benchmarks sollen erreicht werden?', type: 'repeatableKpi', kpiOptions: KPI_OPTIONS_IM },
            { name: 'im_keine_benchmarks', label: 'Noch keine Benchmarks definiert / Agenturempfehlung', type: 'checkbox' }
          ]
        }
      ]
    },
    {
      id: 'im_creator',
      label: 'Creator',
      sections: [
        { title: 'Welche Creator suchen wir?', fields: creatorFields('im', CREATOR_GROESSEN_IM) }
      ]
    },
    {
      id: 'im_channels',
      label: 'Channels',
      sections: [
        {
          title: 'Auf welchen Channels und in welchen Formaten sollen die Creator posten?',
          fields: [
            { name: 'im_channels', label: 'Channels', type: 'channelGroup', channels: IM_CHANNELS, customLabel: 'Weitere Plattform / Format', customPlaceholder: 'z.B. Pinterest Pin, Twitch Stream...' },
            {
              name: 'im_formatvorgaben', label: 'Besondere Formatvorgaben (optional)', type: 'group',
              fields: [
                { name: 'videolaenge', label: 'Gewuenschte / maximale Videolaenge', type: 'text', placeholder: 'z.B. 30-60 Sek.' },
                { name: 'ratios', label: 'Zusaetzliche Ratios / Versionen', type: 'text', placeholder: 'z.B. zusaetzlich 1:1' },
                { name: 'technische_anforderungen', label: 'Sonstige technische Anforderungen', type: 'textarea', rows: 2 }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'im_learnings_ideen',
      label: 'Learnings',
      sections: [
        { title: 'Learnings aus vergleichbaren Aktivitaeten', fields: learningsFields('im') },
        { title: 'Konkrete Ideen fuer die Umsetzung', fields: ideenFields('im') }
      ]
    },
    {
      id: 'im_umsetzung_produktion',
      label: 'Umsetzung',
      sections: [
        {
          title: 'Konkrete Umsetzung',
          fields: umsetzungFields('im', 'Was sollen die Creator im Content konkret zeigen, erzaehlen, erklaeren, demonstrieren oder erleben?')
        },
        { title: 'Produktion', fields: produktionFields('im') }
      ]
    },
    {
      id: 'im_veroeffentlichung_tracking',
      label: 'Publishing',
      sections: [
        {
          title: 'Wie soll der Content veroeffentlicht bzw. zusaetzlich genutzt werden?',
          fields: [
            { name: 'im_veroeffentlichung', label: 'Veroeffentlichung', type: 'checkboxes', options: VEROEFFENTLICHUNG_OPTIONS },
            { name: 'im_zusaetzliche_nutzung', label: 'Zusaetzliche Nutzung', type: 'checkboxes', options: ZUSAETZLICHE_NUTZUNG_OPTIONS },
            { name: 'im_nutzungslogik', label: 'Besondere Ausspiel- oder Nutzungslogik (optional)', type: 'textarea', rows: 2 }
          ]
        },
        {
          title: 'Wie soll Traffic bzw. Conversion erzeugt und gemessen werden?',
          condition: { field: 'im_funnel_stufen', includes: 'lower' },
          fields: [
            { name: 'im_tracking', label: 'Tracking-Mechaniken', type: 'checkboxes', options: TRACKING_OPTIONS, compact: true },
            { name: 'im_ziel_url', label: 'Ziel-URL / Deep Link', type: 'url', placeholder: 'https://...' },
            { name: 'im_code', label: 'Code (optional)', type: 'text' },
            { name: 'im_code_spaeter', label: 'Wird spaeter vergeben', type: 'checkbox' }
          ]
        }
      ]
    }
  ],

  paid_creator_ads: [
    {
      id: 'pa_ziele',
      label: 'Ziele',
      sections: [
        {
          title: 'Was soll erreicht werden?',
          fields: [
            { name: 'pa_funnel_stufen', label: 'Funnel-Stufe', type: 'checkboxes', options: FUNNEL_STUFEN_OPTIONS },
            { name: 'pa_objectives', label: 'Paid Objective', type: 'checkboxes', options: PAID_OBJECTIVES_OPTIONS, compact: true },
            { name: 'pa_kpis', label: 'Welche konkreten Ziele / Benchmarks sollen erreicht werden?', type: 'repeatableKpi', kpiOptions: KPI_OPTIONS_PAID },
            { name: 'pa_keine_benchmarks', label: 'Noch keine Benchmarks definiert / Agenturempfehlung', type: 'checkbox' }
          ]
        }
      ]
    },
    {
      id: 'pa_creator',
      label: 'Creator',
      sections: [
        { title: 'Welche Creator suchen wir?', fields: creatorFields('pa', CREATOR_GROESSEN_UGC) }
      ]
    },
    {
      id: 'pa_channels',
      label: 'Channels',
      sections: [
        {
          title: 'Auf welchen Channels sollen die Ads ausgespielt werden?',
          fields: [
            { name: 'pa_channels', label: 'Paid Channels', type: 'channelGroup', channels: PAID_CHANNELS, customLabel: 'Sonstiges', customPlaceholder: 'z.B. Snapchat, Twitch...' }
          ]
        }
      ]
    },
    {
      id: 'pa_learnings_ideen',
      label: 'Learnings',
      sections: [
        { title: 'Learnings aus vergleichbaren Aktivitaeten', fields: learningsFields('pa', { withReporting: true }) },
        { title: 'Konkrete Ideen fuer die Umsetzung', fields: ideenFields('pa') }
      ]
    },
    {
      id: 'pa_umsetzung_produktion',
      label: 'Umsetzung',
      sections: [
        {
          title: 'Konkrete Umsetzung',
          fields: umsetzungFields('pa', 'Was sollen die Creator im Content konkret zeigen, erzaehlen, erklaeren oder demonstrieren?')
        },
        { title: 'Produktion', fields: produktionFields('pa', PRODUCTION_SETUP_OPTIONS_PAID) }
      ]
    },
    {
      id: 'pa_deliverables_destination',
      label: 'Deliverables',
      sections: [
        {
          title: 'Welche Deliverables werden benoetigt?',
          fields: [
            { name: 'pa_videolaengen', label: 'Videolaenge', type: 'checkboxes', options: VIDEOLAENGEN_OPTIONS, compact: true },
            { name: 'pa_ratios', label: 'Format / Ratio', type: 'checkboxes', options: RATIOS_OPTIONS, compact: true },
            { name: 'pa_zusaetzliche_versionen', label: 'Zusaetzliche Versionen (optional)', type: 'textarea', rows: 2 }
          ]
        },
        {
          title: 'Wohin sollen die Ads fuehren?',
          fields: [
            { name: 'pa_destination', label: 'Destination', type: 'checkboxes', options: DESTINATION_OPTIONS, compact: true },
            { name: 'pa_ziel_url', label: 'Ziel-URL / Deep Link', type: 'url', placeholder: 'https://...' }
          ]
        }
      ]
    }
  ],

  owned_social: [
    {
      id: 'os_ziele',
      label: 'Ziele',
      sections: [
        {
          title: 'Was soll erreicht werden?',
          fields: [
            { name: 'os_content_ziele', label: 'Organische Content-Ziele', type: 'checkboxes', options: OWNED_CONTENT_ZIELE_OPTIONS, compact: true },
            { name: 'os_kpis', label: 'Welche konkreten Ziele / Benchmarks sollen erreicht werden?', type: 'repeatableKpi', kpiOptions: KPI_OPTIONS_OWNED },
            { name: 'os_keine_benchmarks', label: 'Noch keine Benchmarks definiert / Agenturempfehlung', type: 'checkbox' }
          ]
        }
      ]
    },
    {
      id: 'os_creator',
      label: 'Creator',
      sections: [
        { title: 'Welche Creator suchen wir?', fields: creatorFields('os', CREATOR_GROESSEN_UGC) }
      ]
    },
    {
      id: 'os_channels',
      label: 'Channels',
      sections: [
        {
          title: 'Fuer welche Brand Channels und Formate soll Content produziert werden?',
          fields: [
            { name: 'os_channels', label: 'Brand Channels & Formate', type: 'channelGroup', channels: OWNED_CHANNELS, customLabel: 'Sonstiges', customPlaceholder: 'z.B. Twitch, Snapchat...' },
            {
              name: 'os_formatvorgaben', label: 'Besondere Formatvorgaben (optional)', type: 'group',
              fields: [
                { name: 'videolaenge', label: 'Gewuenschte / maximale Videolaenge', type: 'text', placeholder: 'z.B. 30-60 Sek.' },
                { name: 'ratios', label: 'Zusaetzliche Ratios / Versionen', type: 'text' },
                { name: 'technische_anforderungen', label: 'Sonstige technische Anforderungen', type: 'textarea', rows: 2 }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'os_learnings_ideen',
      label: 'Learnings',
      sections: [
        { title: 'Learnings aus bisherigem bzw. vergleichbarem Content', fields: learningsFields('os', { withReporting: true }) },
        { title: 'Konkrete Ideen fuer die Umsetzung', fields: ideenFields('os') }
      ]
    },
    {
      id: 'os_umsetzung',
      label: 'Umsetzung',
      sections: [
        {
          title: 'Konkrete Umsetzung',
          fields: [
            ...umsetzungFields('os', 'Welche Themen, Inhalte, Situationen oder Use Cases sollen im Content umgesetzt werden? Was sollen die Creator konkret zeigen, erzaehlen, erklaeren oder demonstrieren?'),
            {
              name: 'os_content_ansatz', label: 'Wie soll der Content-Ansatz aufgebaut sein?', type: 'checkboxes', options: CONTENT_ANSATZ_OPTIONS,
              condition: { field: 'ansatz', equals: 'always_on' }
            },
            {
              name: 'os_content_pillars', label: 'Content Pillars / Themen / Serien (optional)', type: 'repeatableText', itemLabel: 'Pillar / Thema / Serie', max: 8,
              condition: { field: 'ansatz', equals: 'always_on' }
            }
          ]
        }
      ]
    },
    {
      id: 'os_produktion_assets',
      label: 'Produktion',
      sections: [
        { title: 'Produktion', fields: produktionFields('os') },
        {
          title: 'Zusaetzliche Assets',
          fields: [
            { name: 'os_zusatz_assets', label: 'Sollen zusaetzlich zum Creator Content weitere Assets erstellt werden?', type: 'radio', options: ZUSATZ_ASSETS_OPTIONS },
            { name: 'os_assets', label: 'Welche zusaetzlichen Assets?', type: 'checkboxes', options: ASSETS_OPTIONS, compact: true, condition: { field: 'os_zusatz_assets', equals: 'ja' } },
            { name: 'os_assets_anforderungen', label: 'Besondere Anforderungen (optional)', type: 'textarea', rows: 2, condition: { field: 'os_zusatz_assets', equals: 'ja' } }
          ]
        }
      ]
    }
  ]
};

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

// Alle Steps fuer einen Bereich (ohne Typ-Step)
export function getStepsForBereich(bereich) {
  return [...MASTER_STEPS, ...(MODULE_STEPS[bereich] || [])];
}

// Alle Feld-Definitionen flach (fuer Persistence / Validierung / Tests)
export function getAllFields() {
  const fields = [];
  for (const step of [...MASTER_STEPS, ...Object.values(MODULE_STEPS).flat()]) {
    for (const section of step.sections) {
      fields.push(...section.fields.filter(f => f.persist !== false));
    }
  }
  return fields;
}

// Condition-Auswertung gegen formData
export function evaluateCondition(condition, formData) {
  if (!condition) return true;
  const value = formData[condition.field];

  if (condition.equals !== undefined) {
    return value === condition.equals;
  }
  if (condition.in) {
    return condition.in.includes(value);
  }
  if (condition.includes !== undefined) {
    return Array.isArray(value) && value.includes(condition.includes);
  }
  if (condition.includesAny !== undefined) {
    return Array.isArray(value) && condition.includesAny.some(v => value.includes(v));
  }
  return true;
}
