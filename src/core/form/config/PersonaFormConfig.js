// Formular-Konfiguration fuer "persona"
// Reine Datendatei, wird von FormConfig.js eingesammelt.
// marke_id ist bewusst kein Feld: die Zuordnung kommt aus dem Kontext
// (Marke-Detailseite) und wird beim Speichern gesetzt.

export const personaConfig = {
  title: 'Neue Persona anlegen',
  fields: [
    // 1. Identitaet
    {
      name: 'oberbegriff',
      label: 'Oberbegriff',
      type: 'text',
      required: false,
      placeholder: "z.B. 'Sparsame Studentin'",
      helpText: 'Kategorie zur Zuordnung – wird überall mit angezeigt',
      section: 'identitaet',
      sectionTitle: 'Wer ist diese Persona?',
      sectionDescription: 'Eine Persona beschreibt einen Typ Mensch. Kampagnen, Briefings und Skripte greifen später auf diese Informationen zu.'
    },
    {
      name: 'name',
      label: 'Name / Kurzcharakter',
      type: 'text',
      required: true,
      validation: { type: 'text', minLength: 2 },
      placeholder: "z.B. 'Sarah'",
      section: 'identitaet'
    },

    // 2. Demografische Merkmale
    {
      name: 'alter_von',
      label: 'Alter von',
      type: 'number',
      required: false,
      validation: { type: 'number', min: 0, max: 120, step: 1 },
      row: 'alter',
      colSize: 'small',
      section: 'demografie',
      sectionTitle: 'Demografische Merkmale'
    },
    { name: 'alter_bis', label: 'Alter bis', type: 'number', required: false, validation: { type: 'number', min: 0, max: 120, step: 1 }, row: 'alter', colSize: 'small', section: 'demografie' },
    {
      name: 'geschlecht',
      label: 'Geschlecht',
      type: 'select',
      required: false,
      placeholder: 'Keine Angabe',
      options: [
        { value: 'Weiblich', label: 'Weiblich' },
        { value: 'Männlich', label: 'Männlich' },
        { value: 'Divers', label: 'Divers' },
        { value: 'Gemischt', label: 'Gemischt' }
      ],
      row: 'demo_1',
      section: 'demografie'
    },
    { name: 'wohnort_region', label: 'Wohnort / Region', type: 'text', required: false, placeholder: 'z.B. Großstadt Süddeutschland, ländlich NRW', row: 'demo_1', colSize: 'grow', section: 'demografie' },
    { name: 'beruf', label: 'Beruf', type: 'text', required: false, placeholder: 'z.B. Pflegefachkraft, Studentin BWL', row: 'demo_2', colSize: 'grow', section: 'demografie' },
    {
      name: 'budgetrahmen',
      label: 'Budgetrahmen (Einkommen)',
      type: 'select',
      required: false,
      placeholder: 'Keine Angabe',
      options: [
        { value: 'niedrig', label: 'Niedrig' },
        { value: 'mittel', label: 'Mittel' },
        { value: 'hoch', label: 'Hoch' }
      ],
      row: 'demo_2',
      section: 'demografie'
    },
    { name: 'bildungsstand', label: 'Bildungsstand', type: 'text', required: false, placeholder: 'z.B. Abitur, Studium, Ausbildung', row: 'demo_3', colSize: 'grow', section: 'demografie' },
    {
      name: 'lebenssituation',
      label: 'Lebenssituation',
      type: 'select',
      required: false,
      placeholder: 'Keine Angabe',
      options: [
        { value: 'Single', label: 'Single' },
        { value: 'Familie', label: 'Familie' },
        { value: 'Paar ohne Kinder', label: 'Paar ohne Kinder' },
        { value: 'Alleinerziehend', label: 'Alleinerziehend' },
        { value: 'Student/in', label: 'Student/in' },
        { value: 'Rentner/in', label: 'Rentner/in' },
        { value: 'Mensch mit Behinderung', label: 'Mensch mit Behinderung' },
        { value: 'WG / Wohngemeinschaft', label: 'WG / Wohngemeinschaft' }
      ],
      row: 'demo_3',
      section: 'demografie'
    },
    {
      name: 'branche_id',
      label: 'Branche',
      type: 'select',
      required: false,
      options: [],
      dynamic: true,
      searchable: true,
      placeholder: 'Branche suchen und auswählen...',
      table: 'branchen',
      displayField: 'name',
      valueField: 'id',
      section: 'demografie'
    },

    // 3. Lebensrealitaet
    {
      name: 'kontext',
      label: 'Situation / Alltag',
      type: 'textarea',
      required: false,
      rows: 3,
      placeholder: 'Alltag, Mediennutzung, Werte, was sie/ihn beschäftigt...',
      section: 'lebensrealitaet',
      sectionTitle: 'Lebensrealität'
    },
    { name: 'pain_points', label: 'Pain-Points / Probleme', type: 'textarea', required: false, rows: 3, placeholder: 'Konkrete Probleme und Frustrationen im Alltag...', section: 'lebensrealitaet' },
    { name: 'interessen', label: 'Interessen', type: 'textarea', required: false, rows: 2, placeholder: 'Hobbys, Themen, Communities, denen sie/er folgt...', section: 'lebensrealitaet' },
    { name: 'beduerfnisse', label: 'Bedürfnisse', type: 'textarea', required: false, rows: 2, placeholder: 'Was braucht diese Person wirklich? Wonach sucht sie?', section: 'lebensrealitaet' },

    // 4. Kaufverhalten
    {
      name: 'kaufmotive',
      label: 'Kaufmotive',
      type: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Was löst eine Kaufentscheidung aus? Preis, Status, Zeitersparnis, Sicherheit...',
      section: 'kaufverhalten',
      sectionTitle: 'Kaufverhalten'
    },
    { name: 'einwaende', label: 'Einwände', type: 'textarea', required: false, rows: 2, placeholder: 'Was hält sie/ihn vom Kauf ab? Zweifel, Bedenken, bisherige Enttäuschungen...', section: 'kaufverhalten' },
    { name: 'produkt_loesung', label: 'Was löst das Produkt für sie/ihn?', type: 'textarea', required: false, rows: 3, placeholder: 'Welches Problem verschwindet, was wird leichter?', section: 'kaufverhalten' },
    { name: 'produktvorteile', label: 'Relevante Produktvorteile', type: 'textarea', required: false, rows: 2, placeholder: 'Welche Vorteile zählen für diesen Typ Mensch wirklich?', section: 'kaufverhalten' },

    // 5. Ansprache
    {
      name: 'tonalitaet',
      label: 'Tonalität der Ansprache',
      type: 'text',
      required: false,
      placeholder: 'z.B. du, warm, augenzwinkernd',
      section: 'ansprache',
      sectionTitle: 'Sprache und Ansprache'
    },
    { name: 'plattformen', label: 'Relevante Plattformen', type: 'textarea', required: false, rows: 2, placeholder: 'Wo ist diese Person unterwegs? z.B. TikTok, Instagram Reels, YouTube Shorts...', section: 'ansprache' },
    { name: 'content_praeferenzen', label: 'Content-Präferenzen', type: 'textarea', required: false, rows: 2, placeholder: 'Welche Formate funktionieren? z.B. kurze Hooks, Vorher-Nachher, Storytelling, Tutorials...', section: 'ansprache' },

    // 6. Freitext
    {
      name: 'beschreibung',
      label: 'Beschreibung (frei)',
      type: 'textarea',
      required: false,
      rows: 3,
      placeholder: 'Alles, was sonst noch wichtig ist...',
      section: 'sonstiges',
      sectionTitle: 'Sonstiges'
    }
  ]
};
