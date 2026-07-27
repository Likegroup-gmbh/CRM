// Formular-Konfiguration fuer "produkt"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

export const produktConfig = {
  title: 'Neues Produkt anlegen',
  fields: [
    { name: 'name', label: 'Produkt-Name', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
    { 
      name: 'unternehmen_id', 
      label: 'Unternehmen', 
      type: 'select', 
      required: true, 
      options: [], 
      dynamic: true, 
      searchable: true, 
      placeholder: 'Unternehmen suchen und auswählen...', 
      table: 'unternehmen', 
      displayField: 'firmenname', 
      valueField: 'id' 
    },
    { 
      name: 'marke_id', 
      label: 'Marke', 
      type: 'select', 
      required: false, 
      options: [], 
      dynamic: true, 
      searchable: true, 
      placeholder: 'Marke suchen und auswählen...', 
      dependsOn: 'unternehmen_id', 
      table: 'marke', 
      displayField: 'markenname', 
      valueField: 'id' 
    },
    { name: 'url', label: 'Produkt-URL / Referenz', type: 'url', required: true, validation: { type: 'url' }, placeholder: 'https://...' },
    { name: 'kernbotschaft', label: 'Kernbotschaft (1 Satz)', type: 'textarea', required: true, rows: 2, placeholder: 'Was soll hängen bleiben?' },
    { name: 'hauptproblem', label: 'Hauptproblem, das das Produkt löst', type: 'textarea', required: false, rows: 3 },
    { name: 'kernnutzen', label: 'Kernnutzen (größter Vorteil)', type: 'textarea', required: false, rows: 3 },
    // USPs als separate Felder
    { name: 'usp_1', label: 'USP / Schwerpunkt 1', type: 'text', required: false, row: 'usps', colSize: 'grow' },
    { name: 'usp_2', label: 'USP / Schwerpunkt 2', type: 'text', required: false, row: 'usps', colSize: 'grow' },
    { name: 'usp_3', label: 'USP / Schwerpunkt 3', type: 'text', required: false, row: 'usps', colSize: 'grow' },
    // Pflicht-Elemente als Tags
    {
      name: 'pflicht_elemente_ids',
      label: 'Pflicht-Elemente im Content',
      type: 'multiselect',
      required: false,
      options: [],
      dynamic: true,
      searchable: true,
      tagBased: true,
      allowCreate: true,
      placeholder: 'Pflicht-Elemente suchen oder erstellen...',
      table: 'pflicht_elemente_typen',
      displayField: 'name',
      valueField: 'id',
      relationTable: 'produkt_pflicht_elemente',
      relationField: 'pflicht_element_id',
      directQuery: true
    },
    // No-Gos als Tags
    {
      name: 'no_go_ids',
      label: 'No-Gos / Tabus',
      type: 'multiselect',
      required: false,
      options: [],
      dynamic: true,
      searchable: true,
      tagBased: true,
      allowCreate: true,
      placeholder: 'No-Gos suchen oder erstellen...',
      table: 'no_go_typen',
      displayField: 'name',
      valueField: 'id',
      relationTable: 'produkt_no_gos',
      relationField: 'no_go_id',
      directQuery: true
    },
    { name: 'kauf_conversion_trigger', label: 'Kauf- & Conversion-Trigger', type: 'textarea', required: false, rows: 3, placeholder: 'Warum jetzt kaufen?' },
    { name: 'zielnutzer_anwendungskontext', label: 'Zielnutzer / Anwendungskontext', type: 'textarea', required: false, rows: 3, placeholder: 'Wer nutzt es, wann?' }
  ]
};
