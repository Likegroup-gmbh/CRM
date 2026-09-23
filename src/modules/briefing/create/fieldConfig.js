// fieldConfig.js
// Briefing-Generator nach FLOW §7: Typ, A Grundlage, B Casting, C Aufgabe,
// D Konzepte, Vertrag. Typ-Extras sitzen in A–D. Eine gemeinsame Strecke,
// keine dreifache Kopie. DB-Werte fuer bereich bleiben (v1-kompatibel).

export const BEREICH_OPTIONS = [
  { value: 'paid_creator_ads', label: 'Paid', desc: 'Primär für Werbeanzeigen produziert.' },
  { value: 'owned_social', label: 'Organic', desc: 'Primär für die organischen Kanäle der Marke.' },
  { value: 'influencer_marketing', label: 'Influencer', desc: 'Primär zur Veröffentlichung auf dem Creator-Kanal.' }
];

export const BEREICH_LABELS = Object.fromEntries(BEREICH_OPTIONS.map(b => [b.value, b.label]));

export const ANSATZ_OPTIONS = [
  { value: 'kampagne', label: 'Kampagne' },
  { value: 'always_on', label: 'Always-on' }
];

export const MAERKTE_OPTIONS = [
  { value: 'deutschland', label: 'Deutschland' },
  { value: 'oesterreich', label: 'Österreich' },
  { value: 'schweiz', label: 'Schweiz' }
];

export const SPRACHEN_OPTIONS = [
  { value: 'deutsch', label: 'Deutsch' },
  { value: 'englisch', label: 'Englisch' }
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

export const VORAUSSETZUNGEN_KERN = [
  { value: 'kind_familie', label: 'Kind / Familie' },
  { value: 'haustier', label: 'Haustier' }
];

export const VORAUSSETZUNGEN_WEITER = [
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

export const VORAUSSETZUNGEN_OPTIONS = [
  ...VORAUSSETZUNGEN_KERN,
  ...VORAUSSETZUNGEN_WEITER
];

export const CREATOR_GROESSEN_IM = [
  { value: 'nano', label: 'Nano (0–10K)' },
  { value: 'micro', label: 'Micro (10K–100K)' },
  { value: 'mid_tier', label: 'Mid-Tier (100K–500K)' },
  { value: 'macro', label: 'Macro (500K–1Mio)' },
  { value: 'hero', label: 'Hero (1Mio+)' },
  { value: 'keine_vorgabe', label: 'Keine Vorgabe / Agenturempfehlung' }
];

export const CREATOR_GROESSEN_UGC = [
  { value: 'ugc_creator', label: 'UGC Creator (keine Zahl)' },
  ...CREATOR_GROESSEN_IM
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

export const ROHMATERIAL_OPTIONS = [
  { value: 'ja', label: 'Ja' },
  { value: 'nein', label: 'Nein' }
];

const SONSTIGE_PLATTFORMEN = 'Sonstige Plattformen';

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
  ]},
  { key: 'facebook', label: 'Facebook', formats: null },
  { key: 'pinterest', label: 'Pinterest', formats: null }
];

export const PAID_CHANNELS = [
  { key: 'meta', label: 'Meta', formats: [
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' }
  ]},
  { key: 'tiktok', label: 'TikTok', formats: null },
  { key: 'youtube', label: 'YouTube', formats: [
    { value: 'shorts', label: 'YouTube Shorts' },
    { value: 'instream', label: 'YouTube Long-form / In-Stream' }
  ]},
  { key: 'google', label: 'Google', formats: [
    { value: 'performance_max', label: 'Performance Max' },
    { value: 'display', label: 'Display' },
    { value: 'demand_gen', label: 'Demand Gen' }
  ]},
  { key: 'pinterest', label: 'Pinterest', formats: null }
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
  { key: 'pinterest', label: 'Pinterest', formats: null }
];

const PAID = { field: 'bereich', equals: 'paid_creator_ads' };
const ORGANIC = { field: 'bereich', equals: 'owned_social' };
const INFLUENCER = { field: 'bereich', equals: 'influencer_marketing' };
const ORGANIC_OR_INFLUENCER = { field: 'bereich', in: ['owned_social', 'influencer_marketing'] };

function fieldGroup(id, layout, fields) {
  return { type: 'fieldGroup', id, layout, persist: false, fields };
}

export const FLOW_STEPS = [
  {
    id: 'grundlage',
    label: 'Grundlage',
    sections: [
      {
        id: 'zuordnung',
        title: 'Zuordnung',
        fields: [
          fieldGroup('zuordnung-entities', 'stack', [
            { name: 'unternehmen_id', label: 'Unternehmen', type: 'entitySelect', table: 'unternehmen', displayField: 'firmenname', required: true, placeholder: 'Unternehmen auswählen...' },
            { name: 'marke_id', label: 'Marke (optional)', type: 'entitySelect', table: 'marke', displayField: 'markenname', dependsOn: 'unternehmen_id', placeholder: 'Marke auswählen...' },
            { name: 'kampagne_id', label: 'Kampagne', type: 'entitySelect', table: 'kampagne', displayField: 'label', dependsOn: 'unternehmen_id', scopeMarke: true, lockWithLinie: true, required: true, placeholder: 'Kampagne auswählen...' },
            { name: 'produkt_id', label: 'Produkt', type: 'entitySelect', table: 'produkt', displayField: 'name', dependsOn: 'unternehmen_id', lockWithLinie: true, required: true, placeholder: 'Produkt auswählen...' }
          ]),
          fieldGroup('zuordnung-titel', 'stack', [
            { name: 'aktivierung_name', label: 'Titel', type: 'text', required: true, placeholder: 'z.B. Make-up September' },
            { name: 'beschreibung', label: 'Schwerpunkt (optional)', type: 'textarea', rows: 2, placeholder: 'Worum geht es in diesem Briefing?' },
            {
              name: 'tkp',
              label: 'TKP (€ pro 1.000 Views)',
              type: 'number',
              required: true,
              defaultValue: 25,
              min: 0,
              step: '0.01',
              condition: INFLUENCER,
              placeholder: '25'
            }
          ])
        ]
      },
      {
        id: 'paid-zweck',
        title: 'Paid-Zweck',
        condition: PAID,
        fields: [
          fieldGroup('paid-ziele', 'stack', [
            { name: 'funnel_stufen', label: 'Funnel-Stufe', type: 'checkboxes', options: FUNNEL_STUFEN_OPTIONS },
            { name: 'paid_objectives', label: 'Paid Objective', type: 'checkboxes', options: PAID_OBJECTIVES_OPTIONS, compact: true }
          ]),
          fieldGroup('paid-termine', 'row', [
            { name: 'content_deadline', label: 'Content-Deadline', type: 'date' },
            { name: 'go_live', label: 'Go-Live', type: 'date' }
          ])
        ]
      },
      {
        id: 'organic-zweck',
        title: 'Organic-Zweck',
        condition: ORGANIC,
        fields: [
          fieldGroup('organic-ziele', 'stack', [
            { name: 'content_ziele', label: 'Organisches Content-Ziel', type: 'checkboxes', options: OWNED_CONTENT_ZIELE_OPTIONS, compact: true },
            { name: 'plattformmechanik', label: 'Gewünschte Plattformmechanik', type: 'textarea', rows: 2, placeholder: 'z.B. Duett, Stich, Serie, Trend-Sound' }
          ])
        ]
      },
      {
        id: 'zeitraum',
        title: 'Zeitraum',
        condition: INFLUENCER,
        fields: [
          fieldGroup('zeitraum-termine', 'row', [
            { name: 'veroeffentlichungszeitraum', label: 'Veröffentlichungszeitraum', type: 'text', placeholder: 'z.B. KW 40–42' },
            { name: 'content_deadline', label: 'Content-Deadline', type: 'date' },
            { name: 'go_live', label: 'Go-Live', type: 'date' }
          ]),
          fieldGroup('zeitraum-freigabe', 'stack', [
            { name: 'freigabeprozess', label: 'Freigabeprozess', type: 'textarea', rows: 2, placeholder: 'z.B. Freigabe durch den Kunden vor Veröffentlichung, 48 Stunden' }
          ])
        ]
      }
    ]
  },
  {
    id: 'casting',
    label: 'Casting',
    sections: [
      {
        id: 'casting-suche',
        title: 'Welche Creator suchen wir?',
        fields: [
          fieldGroup('casting-profil', 'stack', [
            { name: 'nischen', label: 'Nische / Content-Schwerpunkt', type: 'checkboxes', options: NISCHEN_OPTIONS, compact: true },
            {
              name: 'creator_merkmale', label: 'Merkmale', type: 'group',
              fields: [
                { name: 'alter', label: 'Alter / Altersspanne', type: 'text', placeholder: 'z.B. 25-34' },
                { name: 'geschlecht', label: 'Geschlecht', type: 'text', placeholder: 'z.B. weiblich, divers, keine Vorgabe' },
                { name: 'standort', label: 'Standort', type: 'text', placeholder: 'z.B. DACH, Berlin, keine Vorgabe' }
              ]
            },
            { name: 'creator_groessen', label: 'Creator-Größe (falls relevant)', type: 'checkboxes', options: CREATOR_GROESSEN_UGC }
          ]),
          fieldGroup('casting-voraussetzungen', 'stack', [
            { name: 'voraussetzungen', label: 'Voraussetzungen', type: 'checkboxes', options: VORAUSSETZUNGEN_OPTIONS, compact: true },
            { name: 'voraussetzungen_sonstiges', label: 'Sonstige Voraussetzungen', type: 'textarea', rows: 2, placeholder: 'z.B. Wohnung mit Balkon' },
            { name: 'produkt_erfahrung', label: 'Produktspezifische Erfahrung', type: 'textarea', rows: 2, placeholder: 'z.B. hat das Produkt schon selbst genutzt' },
            {
              type: 'disclosure',
              name: 'aussehen',
              persist: false,
              label: 'Aussehen',
              fields: [
                { name: 'hauttyp', label: 'Hauttyp', type: 'text', placeholder: 'z.B. Mischhaut, sensible Haut' },
                { name: 'haartyp', label: 'Haartyp', type: 'text', placeholder: 'z.B. lockig, coloriert' }
              ]
            }
          ])
        ]
      }
    ]
  },
  {
    id: 'aufgabe',
    label: 'Aufgabe',
    sections: [
      {
        id: 'aufgabe-umsetzung',
        title: 'Was sollen die Creator umsetzen?',
        fields: [
          fieldGroup('aufgabe-kern', 'stack', [
            { name: 'aufgabe', label: 'Konkrete Aufgabe und gewünschte Produktanwendung', type: 'textarea', rows: 4, placeholder: 'z.B. Produkt in der Abendroutine zeigen, Nutzen im Alltag glaubhaft einbauen' },
            {
              name: 'art_der_integration', label: 'Art der Integration', type: 'textarea', rows: 2,
              condition: INFLUENCER,
              placeholder: 'z.B. Dedicated Video, Integration in bestehende Formate, Mention'
            },
            { name: 'beteiligte_personen', label: 'Beteiligte Personen', type: 'textarea', rows: 2, placeholder: 'z.B. allein, mit Partner oder Kind' },
            { name: 'setting', label: 'Gewünschtes Setting', type: 'textarea', rows: 2, placeholder: 'z.B. Zuhause in der Küche, Tageslicht' }
          ]),
          fieldGroup('aufgabe-grenzen', 'stack', [
            { name: 'produktionsvoraussetzungen', label: 'Besondere Produktionsvoraussetzungen', type: 'textarea', rows: 2, placeholder: 'z.B. nur Indoor, kein Filialdreh ohne Absprache' },
            { name: 'vorgaben_ausschluesse', label: 'Wichtige Vorgaben und Ausschlüsse', type: 'textarea', rows: 3, placeholder: 'z.B. keine Konkurrenzprodukte, keine Kinder oder Tiere im Bild' }
          ])
        ]
      }
    ]
  },
  {
    id: 'konzepte',
    label: 'Konzepte',
    sections: [
      {
        id: 'kreative-umsetzung',
        title: 'Was ist bei der kreativen Umsetzung zu beachten?',
        fields: [
          fieldGroup('konzept-ideen', 'stack', [
            { name: 'umsetzungsideen', label: 'Vorhandene Umsetzungsideen', type: 'textarea', rows: 3, placeholder: 'z.B. Vorher-Nachher, Problem-Lösung in 20 Sekunden' },
            { name: 'referenzen', label: 'Referenzen und Beispiele', type: 'repeatableUpload', max: 3 },
            { name: 'learnings_text', label: 'Learnings aus vergangenen Produktionen', type: 'textarea', rows: 3, placeholder: 'z.B. Hook in den ersten zwei Sekunden, nicht zu werblich' }
          ]),
          fieldGroup('konzept-pflicht', 'stack', [
            { name: 'pflichtinhalte', label: 'Pflichtinhalte', type: 'textarea', rows: 3, placeholder: 'z.B. Produktname nennen, Benefit X zeigen, Disclaimer' },
            { name: 'dos_donts', label: 'Kommunikative Do’s und Don’ts', type: 'textarea', rows: 3, placeholder: 'z.B. Do: authentisch. Don’t: Scripted Sales Pitch' }
          ])
        ]
      },
      {
        id: 'kanaele',
        title: 'Kanäle',
        fields: [
          fieldGroup('kanaele-plattformen', 'stack', [
            {
              name: 'ad_channels', label: 'Ad-Plattformen', type: 'channelGroup', channels: PAID_CHANNELS,
              customLabel: SONSTIGE_PLATTFORMEN, customPlaceholder: 'z.B. Snapchat, Twitch...',
              condition: PAID
            },
            {
              name: 'publish_channels', label: 'Veröffentlichungs-Plattformen', type: 'channelGroup', channels: IM_CHANNELS,
              customLabel: SONSTIGE_PLATTFORMEN, customPlaceholder: 'z.B. Pinterest Pin, Twitch Stream...',
              condition: INFLUENCER
            },
            {
              name: 'publish_channels', label: 'Veröffentlichungs-Plattformen', type: 'channelGroup', channels: OWNED_CHANNELS,
              customLabel: SONSTIGE_PLATTFORMEN, customPlaceholder: 'z.B. Snapchat, Twitch...',
              condition: ORGANIC
            }
          ]),
          fieldGroup('kanaele-laenge', 'stack', [
            {
              name: 'videolaengen', label: 'Gewünschte Videolängen', type: 'checkboxes', options: VIDEOLAENGEN_OPTIONS, compact: true,
              condition: PAID
            },
            {
              name: 'videolaenge_text', label: 'Gewünschte Videolängen', type: 'text', placeholder: 'z.B. 30–60 Sek.',
              condition: ORGANIC_OR_INFLUENCER
            }
          ]),
          fieldGroup('kanaele-paid-cta', 'stack', [
            { name: 'cta', label: 'CTA', type: 'text', condition: PAID, placeholder: 'z.B. Jetzt entdecken, Shop-Link in Bio' },
            { name: 'ziel_url', label: 'Ziel-Link / Landingpage', type: 'url', placeholder: 'https://...', condition: PAID },
            { name: 'hook_vorgaben', label: 'Hook- oder Conversion-Vorgaben', type: 'textarea', rows: 2, condition: PAID, placeholder: 'z.B. Problem in Sekunde 1, Benefit vor Sekunde 3' },
            { name: 'unterschiedliche_hooks', label: 'Unterschiedliche Hooks', type: 'checkbox' },
            { name: 'hooks_anzahl', label: 'Anzahl der Hooks', type: 'text', placeholder: 'z.B. 3', condition: { field: 'unterschiedliche_hooks', equals: true } }
          ]),
          fieldGroup('kanaele-kontext', 'stack', [
            { name: 'trendkontext', label: 'Community- oder Trendkontext', type: 'textarea', rows: 2, condition: ORGANIC, placeholder: 'z.B. aktueller Sound, Community-Challenge' },
            { name: 'posting_anforderungen', label: 'Posting-Anforderungen', type: 'textarea', rows: 2, condition: INFLUENCER, placeholder: 'z.B. Reel + 3 Stories, Hashtag X, Markierung der Marke' }
          ])
        ]
      }
    ]
  },
  {
    id: 'vertrag',
    label: 'Vertrag',
    sections: [
      {
        id: 'nutzung',
        title: 'Zusätzliche Nutzung',
        fields: [
          fieldGroup('nutzung-flags', 'wrap', [
            { name: 'nutzung_markenkanal', label: 'Nutzung auf den Kanälen der Marke', type: 'checkbox' },
            { name: 'nutzung_paid_media', label: 'Paid-Media-Nutzung', type: 'checkbox' },
            { name: 'nutzung_creator_kanal', label: 'Veröffentlichung auf dem Kanal des Creators', type: 'checkbox' },
            { name: 'nutzung_whitelisting', label: 'Whitelisting, Spark Ads oder Partnership Ads', type: 'checkbox' }
          ]),
          fieldGroup('nutzung-details', 'stack', [
            { name: 'nutzungsdauer', label: 'Nutzungsdauer', type: 'text', placeholder: 'z.B. 6 Monate, Full Buyout' },
            { name: 'rohmaterial', label: 'Rohmaterial erforderlich', type: 'radio', options: ROHMATERIAL_OPTIONS }
          ])
        ]
      },
      {
        id: 'weitere-plattformen-paid',
        title: 'Weitere Plattformen',
        condition: {
          all: [
            PAID,
            { any: [
              { field: 'nutzung_markenkanal', equals: true },
              { field: 'nutzung_creator_kanal', equals: true }
            ] }
          ]
        },
        fields: [
          {
            name: 'publish_channels', label: 'Veröffentlichungs-Plattformen', type: 'channelGroup', channels: OWNED_CHANNELS,
            customLabel: SONSTIGE_PLATTFORMEN, customPlaceholder: 'z.B. Snapchat, Twitch...'
          }
        ]
      },
      {
        id: 'weitere-plattformen-organic',
        title: 'Weitere Plattformen',
        condition: {
          all: [
            ORGANIC_OR_INFLUENCER,
            { any: [
              { field: 'nutzung_paid_media', equals: true },
              { field: 'nutzung_whitelisting', equals: true }
            ] }
          ]
        },
        fields: [
          {
            name: 'ad_channels', label: 'Ad-Plattformen', type: 'channelGroup', channels: PAID_CHANNELS,
            customLabel: SONSTIGE_PLATTFORMEN, customPlaceholder: 'z.B. Snapchat, Twitch...'
          }
        ]
      },
      {
        id: 'verhandlung',
        title: 'Verhandlung',
        fields: [
          {
            name: 'verhandlungshinweis', label: 'Verhandlungshinweis', type: 'textarea', rows: 3,
            helper: 'Intern für den Vertrag, nicht im Creator-PDF. z.B. Nutzungsdauer, wenn Full Buyout nicht geht.',
            placeholder: 'z.B. Nutzungsdauer auf 6 Monate herunterhandeln'
          }
        ]
      }
    ]
  }
];

export const MASTER_STEPS = FLOW_STEPS;
export const MODULE_STEPS = {
  influencer_marketing: [],
  paid_creator_ads: [],
  owned_social: []
};

export function flattenFields(fields = []) {
  const out = [];
  for (const field of fields) {
    if (field.type === 'disclosure' || field.type === 'fieldGroup') {
      out.push(...flattenFields(field.fields || []));
    } else {
      out.push(field);
    }
  }
  return out;
}

export function getStepsForBereich(_bereich) {
  return FLOW_STEPS;
}

export function getAllFields() {
  const fields = [];
  for (const step of FLOW_STEPS) {
    for (const section of step.sections) {
      fields.push(...flattenFields(section.fields).filter(f => f.persist !== false));
    }
  }
  const seen = new Set();
  return fields.filter(f => {
    if (seen.has(f.name)) return false;
    seen.add(f.name);
    return true;
  });
}

export function isFieldActive(name, formData) {
  for (const step of FLOW_STEPS) {
    for (const section of step.sections) {
      if (section.condition && !evaluateCondition(section.condition, formData)) continue;
      for (const field of flattenFields(section.fields)) {
        if (field.name !== name) continue;
        if (!field.condition || evaluateCondition(field.condition, formData)) return true;
      }
    }
  }
  return false;
}

export function evaluateCondition(condition, formData) {
  if (!condition) return true;
  if (condition.all) return condition.all.every(c => evaluateCondition(c, formData));
  if (condition.any) return condition.any.some(c => evaluateCondition(c, formData));
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
