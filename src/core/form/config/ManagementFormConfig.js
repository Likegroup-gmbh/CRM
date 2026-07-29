// Formular-Konfiguration fuer "management"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

export const managementConfig = {
  title: 'Neues Management anlegen',
  fields: [
    { name: 'firmenname', label: 'Firmenname', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, section: 'stammdaten', sectionTitle: 'Stammdaten' },
    { name: 'email', label: 'E-Mail', type: 'email', required: false, section: 'stammdaten', row: 'kontakt', colSize: 6 },
    { name: 'telefonnummer', label: 'Telefon', type: 'tel', required: false, section: 'stammdaten', row: 'kontakt', colSize: 6 },
    { name: 'webseite', label: 'Webseite', type: 'url', required: false, section: 'stammdaten', row: 'links', colSize: 6 },
    { name: 'instagram', label: 'Instagram', type: 'text', required: false, placeholder: '@handle', section: 'stammdaten', row: 'links', colSize: 6 },
    { name: 'strasse', label: 'Straße', type: 'text', required: false, section: 'adresse', sectionTitle: 'Adresse', row: 'adresse1', colSize: 8 },
    { name: 'hausnummer', label: 'Hausnummer', type: 'text', required: false, section: 'adresse', row: 'adresse1', colSize: 4 },
    { name: 'plz', label: 'PLZ', type: 'text', required: false, section: 'adresse', row: 'adresse2', colSize: 4 },
    { name: 'stadt', label: 'Stadt', type: 'text', required: false, section: 'adresse', row: 'adresse2', colSize: 8 },
    { name: 'land', label: 'Land', type: 'text', required: false, section: 'adresse' },
    { name: 'creator_ids', label: 'Creator zuordnen', type: 'multiselect', required: false, options: [], dynamic: true, searchable: true, tagBased: true, placeholder: 'Creator suchen und hinzufügen...', table: 'creator', displayField: 'vorname,nachname', valueField: 'id', section: 'creator', sectionTitle: 'Creator' },
    { name: 'steuernummer', label: 'Steuernummer', type: 'text', required: false, section: 'finanzen', sectionTitle: 'Finanzen' },
    { name: 'ust_id', label: 'USt-IdNr.', type: 'text', required: false, section: 'finanzen' },
    { name: 'notiz', label: 'Notizen', type: 'textarea', required: false, section: 'sonstiges', sectionTitle: 'Sonstiges' }
  ]
};
