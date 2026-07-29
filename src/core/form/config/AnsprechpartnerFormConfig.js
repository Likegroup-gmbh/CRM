// Formular-Konfiguration fuer "ansprechpartner"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

export const ansprechpartnerConfig = {
  title: 'Neuen Ansprechpartner anlegen',
  fields: [
    // Section: Person - Persönliche Daten
    { name: 'vorname', label: 'Vorname', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, row: 'name', section: 'person' },
    { name: 'nachname', label: 'Nachname', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, row: 'name', section: 'person' },
    { name: 'profile_image_file', label: 'Profilbild', type: 'custom', customType: 'uploader', accept: 'image/png,image/jpeg,image/webp', multiple: false, required: false, maxFileSize: 500 * 1024, section: 'person' },
    { name: 'geburtsdatum', label: 'Geburtsdatum', type: 'date', required: false, section: 'person' },
    // Section: Zuordnung - Unternehmen/Marke/Position
    { 
      name: 'unternehmen_id', 
      label: 'Unternehmen', 
      type: 'select', 
      required: false, 
      options: [], 
      dynamic: true,
      searchable: true,
      placeholder: 'Unternehmen suchen und auswählen...',
      table: 'unternehmen',
      displayField: 'firmenname',
      valueField: 'id',
      directQuery: true,
      section: 'zuordnung'
    },
    { 
      name: 'management_id', 
      label: 'Management', 
      type: 'select', 
      required: false, 
      options: [], 
      dynamic: true,
      searchable: true,
      placeholder: 'Management suchen und auswählen...',
      table: 'management',
      displayField: 'firmenname',
      valueField: 'id',
      directQuery: true,
      section: 'zuordnung'
    },
    { 
      name: 'marke_ids', 
      label: 'Marken', 
      type: 'multiselect', 
      required: false, 
      options: [], 
      dynamic: true,
      searchable: true,
      tagBased: true,
      placeholder: 'Marken suchen und hinzufügen...',
      filterBy: 'unternehmen_id',
      table: 'marke',
      displayField: 'markenname',
      valueField: 'id',
      relationTable: 'ansprechpartner_marke',
      relationField: 'marke_id',
      section: 'zuordnung'
    },
    { 
      name: 'position_id', 
      label: 'Position', 
      type: 'select', 
      required: true, 
      options: [], 
      dynamic: true,
      searchable: true,
      allowCreate: true,
      placeholder: 'Position suchen oder erstellen...',
      table: 'positionen',
      displayField: 'name',
      valueField: 'id',
      directQuery: true,
      section: 'zuordnung'
    },
    { 
      name: 'sprachen_ids', 
      label: 'Sprachen', 
      type: 'multiselect', 
      required: false, 
      dynamic: true,
      searchable: true,
      tagBased: true,
      placeholder: 'Sprachen suchen und hinzufügen...',
      table: 'sprachen',
      displayField: 'name',
      valueField: 'id',
      relationTable: 'ansprechpartner_sprache',
      relationField: 'sprache_id',
      customField: true,
      section: 'zuordnung'
    },
    // Section: Kontakt - Kontaktdaten
    { name: 'email', label: 'E-Mail', type: 'email', required: false, validation: { type: 'email' }, section: 'kontakt' },
    { 
      name: 'telefonnummer',
      nameCountry: 'telefonnummer_land_id',
      label: 'Telefonnummer (mobil)', 
      type: 'phone', 
      phoneType: 'mobile',
      required: false,
      defaultCountry: 'Deutschland',
      table: 'eu_laender',
      displayField: 'name_de,vorwahl,iso_code',
      valueField: 'id',
      dynamic: true,
      section: 'kontakt'
    },
    { 
      name: 'telefonnummer_office',
      nameCountry: 'telefonnummer_office_land_id',
      label: 'Telefonnummer (Büro)', 
      type: 'phone', 
      phoneType: 'landline',
      required: false,
      defaultCountry: 'Deutschland',
      table: 'eu_laender',
      displayField: 'name_de,vorwahl,iso_code',
      valueField: 'id',
      dynamic: true,
      section: 'kontakt'
    },
    { name: 'linkedin', label: 'LinkedIn Profil', type: 'url', required: false, validation: { type: 'url' }, section: 'kontakt' },
    { name: 'stadt', label: 'Stadt', type: 'text', required: false, row: 'ort', colSize: 'grow', section: 'kontakt' },
    { 
      name: 'land_id', label: 'Land', type: 'country', 
      required: false, row: 'ort', section: 'kontakt',
      table: 'eu_laender', displayField: 'name_de,iso_code', 
      valueField: 'id', dynamic: true, searchable: true,
      placeholder: 'Land wählen...',
      defaultCountry: 'Deutschland'
    },
    // Ohne Section (am Ende) - Einwilligungen, Notizen
    { name: 'erlaubt_newsletter', label: 'Newsletter (1x/Monat)', type: 'toggle', required: false },
    { name: 'ist_rechnungsverantwortlich', label: 'Rechnungsverantwortlich', type: 'toggle', required: false },
    { name: 'notiz', label: 'Notizen', type: 'textarea', required: false, rows: 4 }
  ]
};
