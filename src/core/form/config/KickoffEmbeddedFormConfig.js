// Formular-Konfiguration fuer "kickoff_embedded"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

export const kickoffEmbeddedConfig = {
  title: 'Strategiebriefing (Legacy)',
  fields: [
    { name: 'brand_essenz', label: 'Brand-Essenz (1 Satz)', type: 'text', required: true, validation: { type: 'text', minLength: 2, maxLength: 200 }, placeholder: 'Was macht die Marke einzigartig? (max. 200 Zeichen)', section: 'brand_essenz', sectionTitle: '1. Brand-Essenz' },
    { name: 'mission', label: 'Mission', type: 'textarea', required: true, rows: 3, placeholder: 'Warum existiert diese Marke? Was ist ihr Zweck?', section: 'mission', sectionTitle: '2. Mission / Zweck der Marke' },
    { 
      name: 'markenwerte_ids', 
      label: 'Markenwerte (max. 3)', 
      type: 'multiselect', 
      required: false, 
      options: [], 
      dynamic: true, 
      searchable: true, 
      tagBased: true, 
      allowCreate: true, 
      maxTags: 3,
      placeholder: 'Wert eingeben oder auswählen...', 
      table: 'markenwert_typen', 
      displayField: 'name', 
      valueField: 'id', 
      directQuery: true,
      section: 'markenwerte', 
      sectionTitle: '3. Markenwerte' 
    },
    { name: 'zielgruppe', label: 'Zielgruppe (Wer + Alter)', type: 'textarea', required: true, rows: 2, placeholder: 'z.B. Frauen 25-35, modebewusst, urban', section: 'zielgruppe', sectionTitle: '4. Zielgruppe' },
    { name: 'zielgruppen_mindset', label: 'Mindset der Zielgruppe', type: 'textarea', required: false, rows: 2, placeholder: 'Wie denkt und fühlt die Zielgruppe? Was motiviert sie?', section: 'mindset', sectionTitle: '5. Zielgruppen-Mindset' },
    { name: 'marken_usp', label: 'USP (Unternehmensebene)', type: 'textarea', required: true, rows: 2, placeholder: 'Was unterscheidet das Unternehmen von der Konkurrenz?', section: 'usp', sectionTitle: '6. Marken-USP' },
    { name: 'tonalitaet_sprachstil', label: 'Tonalität & Sprachstil', type: 'textarea', required: true, rows: 2, placeholder: 'z.B. locker, professionell, humorvoll, sachlich...', section: 'tonalitaet', sectionTitle: '7. Tonalität & Sprachstil' },
    { name: 'content_charakter', label: 'Look & Feel', type: 'textarea', required: false, rows: 2, placeholder: 'Visueller Stil, Farben, Bildsprache...', section: 'charakter', sectionTitle: '8. Content-Charakter' },
    { name: 'dos_donts', label: "Do's & Don'ts", type: 'textarea', required: false, rows: 3, placeholder: 'Was soll/soll nicht kommuniziert werden?', section: 'dos_donts', sectionTitle: "9. Marken-Do's & Don'ts" },
    { name: 'rechtliche_leitplanken', label: 'Leitplanken', type: 'textarea', required: false, rows: 3, placeholder: 'Rechtliche Einschränkungen, Claims die vermieden werden müssen...', section: 'leitplanken', sectionTitle: '10. Rechtliche & kommunikative Leitplanken' }
  ]
};
