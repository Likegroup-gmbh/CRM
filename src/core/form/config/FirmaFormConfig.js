// Formular-Konfiguration fuer "firma"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

export const firmaConfig = {
  title: 'Neue Firma anlegen',
  fields: [
    { name: 'firmenname', label: 'Firmenname', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, section: 'stammdaten', sectionTitle: 'Stammdaten' },
    { name: 'strasse', label: 'Straße', type: 'text', required: false, section: 'adresse', sectionTitle: 'Adresse', row: 'adresse1', colSize: 8 },
    { name: 'hausnummer', label: 'Nr.', type: 'text', required: false, section: 'adresse', row: 'adresse1', colSize: 4 },
    { name: 'plz', label: 'PLZ', type: 'text', required: false, section: 'adresse', row: 'adresse2', colSize: 4 },
    { name: 'stadt', label: 'Stadt', type: 'text', required: false, section: 'adresse', row: 'adresse2', colSize: 8 },
    { name: 'land', label: 'Land', type: 'text', required: false, defaultValue: 'Deutschland', section: 'adresse' }
  ]
};
