// Formular-Konfiguration fuer "strategiebriefing_embedded"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

export const strategiebriefingEmbeddedConfig = {
  title: 'Strategiebriefing',
  fields: [
    {
      name: 'kampagnenart',
      label: 'Kampagnenart',
      type: 'select',
      required: true,
      placeholder: 'Kampagnenart...',
      options: [
        { value: 'influencer', label: 'Influencer' },
        { value: 'organic', label: 'Organic' },
        { value: 'paid', label: 'Paid' }
      ]
    },
    // Influencer-Felder
    {
      name: 'ziel_influencer',
      label: 'Ziel',
      type: 'select',
      required: false,
      placeholder: 'Ziel wählen...',
      options: [
        { value: 'awareness', label: 'Awareness' },
        { value: 'engagement', label: 'Engagement' },
        { value: 'sales', label: 'Sales' },
        { value: 'branding', label: 'Branding' },
        { value: 'community', label: 'Community' },
        { value: 'sonstiges', label: 'Sonstiges' }
      ],
      dependsOn: 'kampagnenart',
      showWhen: 'influencer'
    },
    {
      name: 'format_influencer',
      label: 'Format',
      type: 'select',
      required: false,
      placeholder: 'Format wählen...',
      options: [
        { value: 'reel', label: 'Reel' },
        { value: 'story', label: 'Story' },
        { value: 'tiktok', label: 'TikTok' },
        { value: 'multi_format', label: 'Multi-Format' }
      ],
      dependsOn: 'kampagnenart',
      showWhen: 'influencer'
    },
    // Paid-Felder
    {
      name: 'funnel',
      label: 'Funnel',
      type: 'select',
      required: false,
      placeholder: 'Funnel-Stufe wählen...',
      options: [
        { value: 'upper_funnel', label: 'Upper Funnel' },
        { value: 'mid_funnel', label: 'Mid Funnel' },
        { value: 'low_funnel', label: 'Low Funnel' }
      ],
      dependsOn: 'kampagnenart',
      showWhen: 'paid'
    },
    {
      name: 'ziel_paid',
      label: 'Ziel',
      type: 'select',
      required: false,
      placeholder: 'Ziel wählen...',
      options: [
        { value: 'roas', label: 'ROAS' },
        { value: 'ctr', label: 'CTR' },
        { value: 'leads', label: 'Leads' },
        { value: 'kaeufe', label: 'Käufe' },
        { value: 'testing', label: 'Testing' }
      ],
      dependsOn: 'kampagnenart',
      showWhen: 'paid'
    },
    // Organic-Felder
    {
      name: 'ziel_organic',
      label: 'Ziel',
      type: 'select',
      required: false,
      placeholder: 'Ziel wählen...',
      options: [
        { value: 'reichweite', label: 'Reichweite' },
        { value: 'engagement', label: 'Engagement' },
        { value: 'follower_wachstum', label: 'Follower Wachstum' },
        { value: 'branding', label: 'Branding' },
        { value: 'community_aufbau', label: 'Community Aufbau' }
      ],
      dependsOn: 'kampagnenart',
      showWhen: 'organic'
    },
    {
      name: 'format_organic',
      label: 'Format',
      type: 'select',
      required: false,
      placeholder: 'Format wählen...',
      options: [
        { value: 'unterhaltung', label: 'Unterhaltung' },
        { value: 'educational', label: 'Educational' },
        { value: 'serienformat', label: 'Serienformat' },
        { value: 'behind_the_scenes', label: 'Behind The Scenes' },
        { value: 'trends', label: 'Trends' }
      ],
      dependsOn: 'kampagnenart',
      showWhen: 'organic'
    },
    // Gemeinsame Felder – erst sichtbar nach Kampagnenart-Auswahl
    { name: 'kampagnen_zusammenfassung', label: 'Kampagnen-Zusammenfassung', type: 'textarea', required: true, rows: 4, placeholder: 'Worum geht es bei dieser Kampagne? (3–5 Sätze)', dependsOn: 'kampagnenart', section: 'zusammenfassung', sectionTitle: 'Kampagnen-Zusammenfassung' },
    {
      name: 'beworben_typ',
      label: 'Was wird beworben?',
      type: 'select',
      required: false,
      placeholder: 'Auswählen...',
      options: [
        { value: 'produkt', label: 'Produkt' },
        { value: 'dienstleistung', label: 'Dienstleistung' },
        { value: 'marke', label: 'Marke' },
        { value: 'app', label: 'App' },
        { value: 'sonstiges', label: 'Sonstiges' }
      ],
      dependsOn: 'kampagnenart',
      section: 'beworben', sectionTitle: 'Was wird beworben?'
    },
    { name: 'beworben_beschreibung', label: 'Beschreibung / Besonderheiten', type: 'textarea', required: false, rows: 2, placeholder: 'Wichtige Infos, spezielle Features, Fokus der Kampagne...', dependsOn: 'kampagnenart', section: 'beworben' },
    {
      name: 'plattformen',
      label: 'Plattformen',
      type: 'multiselect',
      required: false,
      searchable: false,
      options: [
        { value: 'tiktok', label: 'TikTok' },
        { value: 'instagram', label: 'Instagram' },
        { value: 'youtube', label: 'YouTube' },
        { value: 'meta_ads', label: 'Meta Ads' },
        { value: 'snapchat', label: 'Snapchat' },
        { value: 'linkedin', label: 'LinkedIn' }
      ],
      dependsOn: 'kampagnenart',
      section: 'plattformen', sectionTitle: 'Plattformen'
    },
    { name: 'creator_branche', label: 'Creator-Branche', type: 'text', required: false, placeholder: 'z.B. Fitness, Beauty, Comedy, Fashion, Food, Tech...', dependsOn: 'kampagnenart', section: 'creator', sectionTitle: 'Creator-Branche' },
    { name: 'drehort', label: 'Drehort', type: 'text', required: false, placeholder: 'z.B. Zuhause, Outdoor, Gym, Studio, Creator entscheidet...', dependsOn: 'kampagnenart', section: 'drehort', sectionTitle: 'Drehort' },
    { name: 'rechtliches', label: 'Rechtliches / Pflichtangaben', type: 'textarea', required: false, rows: 3, placeholder: 'Pflichtclaims, Verbote, Werbekennzeichnung, Musikrechte...', dependsOn: 'kampagnenart', section: 'rechtliches', sectionTitle: 'Rechtliches / Pflichtangaben' },
    { name: 'erfolgskriterien', label: 'Worauf kommt es wirklich an?', type: 'textarea', required: true, rows: 4, placeholder: 'Was entscheidet über Erfolg oder Misserfolg? z.B. Hook in 2 Sek, native Optik, nicht zu werblich...', dependsOn: 'kampagnenart', section: 'erfolg', sectionTitle: 'Erfolgskriterien' },
    { name: 'learnings', label: 'Learnings / Wichtig für Umsetzung', type: 'textarea', required: false, rows: 3, placeholder: 'Learnings aus alten Kampagnen, was funktioniert hat, was vermieden werden soll...', dependsOn: 'kampagnenart', section: 'learnings', sectionTitle: 'Learnings' }
  ]
};
