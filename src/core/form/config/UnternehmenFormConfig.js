// Formular-Konfiguration fuer "unternehmen"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

export const unternehmenConfig = {
  title: 'Neues Unternehmen anlegen',
  fields: [
    // Section: Auslesen - steht bewusst ganz oben, damit die Webseite vor dem
    // manuellen Tippen eingegeben wird und die Felder darunter fuellen kann.
    {
      name: 'webseite',
      label: 'Webseite',
      type: 'url',
      required: false,
      placeholder: 'muster-gmbh.de',
      aiExtract: true,
      section: 'auslesen',
      sectionTitle: 'Mit der Webseite starten',
      sectionDescription: 'Adresse eintragen und "Auslesen" klicken: Firmenname, Anschrift und Logo kommen aus der Webseite und dem Impressum. Nur leere Felder werden gefüllt, eigene Eingaben bleiben unangetastet.'
    },
    // Section: Stammdaten - Firmenname, Kürzel, Adresse
    { name: 'firmenname', label: 'Firmenname', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, section: 'stammdaten' },
    { name: 'internes_kuerzel', label: 'Internes Kürzel', type: 'text', required: false, placeholder: 'z.B. ABC', section: 'stammdaten' },
    { name: 'rechnungsadresse_strasse', label: 'Straße', type: 'text', required: false, row: 'adresse1', colSize: 'grow', section: 'stammdaten' },
    { name: 'rechnungsadresse_hausnummer', label: 'Nr.', type: 'text', required: false, row: 'adresse1', colSize: 'small', section: 'stammdaten' },
    { name: 'rechnungsadresse_plz', label: 'PLZ', type: 'text', required: false, row: 'adresse2', colSize: 'small', section: 'stammdaten' },
    { name: 'rechnungsadresse_stadt', label: 'Stadt', type: 'text', required: false, row: 'adresse2', colSize: 'grow', section: 'stammdaten' },
    { name: 'rechnungsadresse_land', label: 'Land', type: 'text', required: false, defaultValue: 'Deutschland', section: 'stammdaten' },
    // Section: Online - Logo
    { name: 'logo_file', label: 'Logo', type: 'custom', customType: 'uploader', accept: 'image/png,image/jpeg,image/webp', multiple: false, required: false, maxFileSize: 200 * 1024, section: 'online' },
    // Section: Team - Branchen, Management, Lead-Mitarbeiter, Mitarbeiter
    { name: 'branche_id', label: 'Branchen', type: 'multiselect', required: false, dynamic: true, searchable: true, tagBased: true, placeholder: 'Branche suchen und hinzufügen...', table: 'branchen', displayField: 'name', valueField: 'id', relationTable: 'unternehmen_branchen', relationField: 'branche_id', section: 'team' },
    {
      name: 'management_ids',
      label: 'Management',
      type: 'multiselect',
      required: false,
      options: [],
      dynamic: true,
      searchable: true,
      tagBased: true,
      placeholder: 'Management-Mitarbeiter suchen...',
      table: 'benutzer',
      displayField: 'name',
      valueField: 'id',
      relationTable: 'mitarbeiter_unternehmen',
      relationField: 'mitarbeiter_id',
      roleValue: 'management',
      filterNoKunden: true,
      filterByKlasse: 'Management',
      section: 'team'
    },
    {
      name: 'lead_mitarbeiter_ids',
      label: 'Lead Mitarbeiter',
      type: 'multiselect',
      required: false,
      options: [],
      dynamic: true,
      searchable: true,
      tagBased: true,
      placeholder: 'Lead-Mitarbeiter suchen...',
      table: 'benutzer',
      displayField: 'name',
      valueField: 'id',
      relationTable: 'mitarbeiter_unternehmen',
      relationField: 'mitarbeiter_id',
      roleValue: 'lead_mitarbeiter',
      filterNoKunden: true,
      filterByKlasse: 'Lead',
      section: 'team'
    },
    {
      name: 'mitarbeiter_ids',
      label: 'Mitarbeiter',
      type: 'multiselect',
      required: false,
      options: [],
      dynamic: true,
      searchable: true,
      tagBased: true,
      placeholder: 'Mitarbeiter suchen...',
      table: 'benutzer',
      displayField: 'name',
      valueField: 'id',
      relationTable: 'mitarbeiter_unternehmen',
      relationField: 'mitarbeiter_id',
      roleValue: 'mitarbeiter',
      filterNoKunden: true,
      filterByKlasse: ['Projektmanagement', 'Strategie', 'Copywriter', 'Cutter'],
      section: 'team'
    },
    // Sonstige Felder ohne Section
    { name: 'invoice_email', label: 'Rechnungs-Email', type: 'email', required: false, validation: { type: 'email' } },
    { name: 'status', label: 'Status', type: 'select', required: false, editOnly: true, options: ['Aktiv', 'Inaktiv', 'Prospekt'] },
    { name: 'kein_dropbox', label: 'Content ohne Dropbox (nur externe Links)', type: 'toggle', required: false, section: 'online' }
  ]
};
