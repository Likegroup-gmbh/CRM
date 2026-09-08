// Formular-Konfiguration fuer "persona"
// Reine Datendatei, wird von FormConfig.js eingesammelt.
// unternehmen_id ist im Nested-Flow ein Hidden-Feld aus dem Kontext. Im
// Standalone (/persona/new, /persona/:id) ist es ein sichtbares Select
// (docRole 'owner'). marke_ids rendert nur im Unternehmens-Kontext und im
// Standalone - aus einer Marke heraus ist die Zuordnung fix.
//
// Die Seite rendert als Worksheet ueber den geteilten Doc-Renderer
// (core/doc/DocPage.js - dort sind die doc*-Angaben dokumentiert). Produkte
// sind kein Formularfeld mehr: sie haengen als Karten-Band (Slot ganz unten)
// am Dokument, gepflegt vom PersonaProduktPanel - Persistenz ueber
// produkt_persona_vorschlag (ADR 0002).

export const personaConfig = {
  title: 'Neue Persona anlegen',
  fields: [
    // 1. Identitaet
    {
      name: 'name',
      label: 'Name / Kurzcharakter',
      type: 'text',
      required: true,
      validation: { type: 'text', minLength: 2 },
      placeholder: "z.B. 'Sarah'",
      docRole: 'title',
      docLabel: "Name der Persona, z.B. 'Sarah'",
      section: 'identitaet'
    },
    {
      name: 'unternehmen_id',
      label: 'Unternehmen',
      type: 'select',
      required: true,
      dynamic: true,
      searchable: true,
      placeholder: 'Unternehmen suchen und auswählen...',
      table: 'unternehmen',
      displayField: 'firmenname',
      valueField: 'id',
      docRole: 'owner',
      docLabel: 'Unternehmen',
      docGroup: 'identitaet',
      section: 'identitaet'
    },
    {
      name: 'oberbegriff',
      label: 'Oberbegriff',
      type: 'text',
      required: false,
      placeholder: "z.B. 'Sparsame Studentin'",
      helpText: 'Kategorie zur Zuordnung – wird überall mit angezeigt',
      docRole: 'inline',
      row: 'ident_1',
      docHint: 'Kategorie zur Zuordnung – wird überall mit angezeigt',
      docGroup: 'identitaet',
      section: 'identitaet',
      sectionTitle: 'Wer ist diese Persona?',
      sectionDescription: 'Eine Persona beschreibt einen Typ Mensch. Kampagnen, Briefings und Skripte greifen später auf diese Informationen zu.'
    },
    {
      name: 'marke_ids',
      label: 'Marken',
      type: 'multiselect',
      required: false,
      dynamic: true,
      searchable: true,
      tagBased: true,
      table: 'marke',
      displayField: 'markenname',
      valueField: 'id',
      filterBy: 'unternehmen_id',
      dependsOn: 'unternehmen_id',
      relationTable: 'persona_marke',
      relationField: 'marke_id',
      relationEntityField: 'persona_id',
      placeholder: 'Marken suchen und hinzufügen...',
      helpText: 'Optional. Ohne Marke gehört die Persona nur dem Unternehmen.',
      docRole: 'relations',
      docLabel: 'Marken',
      docHint: 'Optional. Ohne Marke gehört die Persona nur dem Unternehmen.',
      docGroup: 'identitaet',
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
      docRole: 'inline',
      docGroup: 'demografie',
      section: 'demografie',
      sectionTitle: 'Demografische Merkmale'
    },
    { name: 'alter_bis', label: 'Alter bis', type: 'number', required: false, validation: { type: 'number', min: 0, max: 120, step: 1 }, row: 'alter', colSize: 'small', docRole: 'inline', docGroup: 'demografie', section: 'demografie' },
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
      docRole: 'inline',
      docGroup: 'demografie',
      section: 'demografie'
    },
    { name: 'wohnort_region', label: 'Wohnort / Region', type: 'text', required: false, placeholder: 'z.B. Großstadt Süddeutschland, ländlich NRW', row: 'demo_1', colSize: 'grow', docRole: 'inline', docGroup: 'demografie', section: 'demografie' },
    { name: 'beruf', label: 'Beruf', type: 'text', required: false, placeholder: 'z.B. Pflegefachkraft, Studentin BWL', row: 'demo_2', colSize: 'grow', docRole: 'inline', docGroup: 'demografie', section: 'demografie' },
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
      docRole: 'inline',
      docGroup: 'demografie',
      section: 'demografie'
    },
    { name: 'bildungsstand', label: 'Bildungsstand', type: 'text', required: false, placeholder: 'z.B. Abitur, Studium, Ausbildung', row: 'demo_3', colSize: 'grow', docRole: 'inline', docGroup: 'demografie', section: 'demografie' },
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
      docRole: 'inline',
      docGroup: 'demografie',
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
      docRole: 'select',
      docGroup: 'demografie',
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
      docGroup: 'lebensrealitaet',
      section: 'lebensrealitaet',
      sectionTitle: 'Lebensrealität'
    },
    { name: 'pain_points', label: 'Pain-Points / Probleme', type: 'textarea', required: false, rows: 3, placeholder: 'Konkrete Probleme und Frustrationen im Alltag...', docList: true, docGroup: 'lebensrealitaet', section: 'lebensrealitaet' },
    { name: 'interessen', label: 'Interessen', type: 'textarea', required: false, rows: 2, placeholder: 'Hobbys, Themen, Communities, denen sie/er folgt...', docList: true, docGroup: 'lebensrealitaet', section: 'lebensrealitaet' },
    { name: 'beduerfnisse', label: 'Bedürfnisse', type: 'textarea', required: false, rows: 2, placeholder: 'Was braucht diese Person wirklich? Wonach sucht sie?', docList: true, docGroup: 'lebensrealitaet', section: 'lebensrealitaet' },

    // 4. Kaufverhalten
    {
      name: 'kaufmotive',
      label: 'Kaufmotive',
      type: 'textarea',
      required: false,
      rows: 2,
      placeholder: 'Was löst eine Kaufentscheidung aus? Preis, Status, Zeitersparnis, Sicherheit...',
      docList: true,
      docGroup: 'kaufverhalten',
      section: 'kaufverhalten',
      sectionTitle: 'Kaufverhalten'
    },
    { name: 'einwaende', label: 'Einwände', type: 'textarea', required: false, rows: 2, placeholder: 'Was hält sie/ihn vom Kauf ab? Zweifel, Bedenken, bisherige Enttäuschungen...', docList: true, docGroup: 'kaufverhalten', section: 'kaufverhalten' },
    { name: 'produkt_loesung', label: 'Was löst das Produkt für sie/ihn?', type: 'textarea', required: false, rows: 3, placeholder: 'Welches Problem verschwindet, was wird leichter?', docGroup: 'kaufverhalten', section: 'kaufverhalten' },
    { name: 'produktvorteile', label: 'Relevante Produktvorteile', type: 'textarea', required: false, rows: 2, placeholder: 'Welche Vorteile zählen für diesen Typ Mensch wirklich?', docList: true, docGroup: 'kaufverhalten', section: 'kaufverhalten' },

    // 5. Ansprache
    {
      name: 'tonalitaet',
      label: 'Tonalität der Ansprache',
      type: 'text',
      required: false,
      placeholder: 'z.B. du, warm, augenzwinkernd',
      docRole: 'inline',
      row: 'anspr_1',
      docGroup: 'ansprache',
      section: 'ansprache',
      sectionTitle: 'Sprache und Ansprache'
    },
    { name: 'plattformen', label: 'Relevante Plattformen', type: 'textarea', required: false, rows: 2, placeholder: 'Wo ist diese Person unterwegs? z.B. TikTok, Instagram Reels, YouTube Shorts...', docList: true, docGroup: 'ansprache', section: 'ansprache' },
    { name: 'content_praeferenzen', label: 'Content-Präferenzen', type: 'textarea', required: false, rows: 2, placeholder: 'Welche Formate funktionieren? z.B. kurze Hooks, Vorher-Nachher, Storytelling, Tutorials...', docList: true, docGroup: 'ansprache', section: 'ansprache' },

    // 6. Freitext
    {
      name: 'beschreibung',
      label: 'Beschreibung (frei)',
      type: 'textarea',
      required: false,
      rows: 3,
      placeholder: 'Alles, was sonst noch wichtig ist...',
      docGroup: 'sonstiges',
      section: 'sonstiges',
      sectionTitle: 'Sonstiges'
    },

    // Produkte als Karten-Band ganz unten - gefuellt vom PersonaProduktPanel.
    {
      name: '_slot_produkte',
      label: '',
      type: 'hidden',
      required: false,
      docRole: 'slot',
      slotId: 'persona-produkt-panel',
      docGroup: 'produkte',
      section: 'sonstiges'
    }
  ]
};
