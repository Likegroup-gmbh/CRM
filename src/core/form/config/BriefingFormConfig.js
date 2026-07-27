// Formular-Konfiguration fuer "briefing"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

export const briefingConfig = {
  title: 'Neues Briefing anlegen',
  fields: [
    { name: 'product_service_offer', label: 'Name des Briefings*', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, placeholder: 'Kurzbezeichnung des Briefings' },
    { name: 'produktseite_url', label: 'Produktseite URL', type: 'url', required: false, validation: { type: 'url' } },
    { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...', table: 'unternehmen', displayField: 'firmenname', valueField: 'id', directQuery: true },
    { name: 'marke_id', label: 'Marke', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Marke suchen und auswählen (optional)...', dependsOn: 'unternehmen_id', table: 'marke', displayField: 'markenname', valueField: 'id' },
    { name: 'kampagne_id', label: 'Kampagne', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Kampagne wählen...', dependsOn: 'unternehmen_id', table: 'kampagne', displayField: 'kampagnenname', valueField: 'id' },
    { name: 'assignee_id', label: 'Zugewiesen an', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Mitarbeiter auswählen...', table: 'benutzer', displayField: 'name', valueField: 'id', directQuery: true },
    { name: 'zielgruppe', label: 'Zielgruppe', type: 'textarea', required: false, rows: 3 },
    { name: 'zieldetails', label: 'Zieldetails', type: 'textarea', required: false, rows: 3 },
    { name: 'creator_aufgabe', label: 'Creator Aufgabe', type: 'textarea', required: false, rows: 4 },
    { name: 'usp', label: 'USPs', type: 'textarea', required: false, rows: 3, placeholder: 'Unique Selling Points, durch Komma getrennt oder als Fließtext' },
    { name: 'must_haves', label: 'Must Haves', type: 'textarea', required: false, rows: 4 },
    { name: 'rechtlicher_hinweis', label: 'Rechtlicher Hinweis', type: 'textarea', required: false, rows: 4 },
    { name: 'documents_files', label: 'Dokumente (PDFs, Bilder)', type: 'custom', customType: 'uploader', accept: 'application/pdf,image/*', multiple: true, required: false, maxFileSize: 10 * 1024 * 1024 }
  ]
};
