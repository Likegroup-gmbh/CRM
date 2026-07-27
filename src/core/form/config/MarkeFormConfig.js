// Formular-Konfiguration fuer "marke"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

export const markeConfig = {
  title: 'Neue Marke anlegen',
  fields: [
    // 1. Markenname
    { name: 'markenname', label: 'Markenname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
    // 2. Unternehmen in eigener Section
    { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...', table: 'unternehmen', displayField: 'firmenname', valueField: 'id', section: 'unternehmen' },
    // 3. Logo und Webseite in Section
    { name: 'logo_file', label: 'Logo', type: 'custom', customType: 'uploader', accept: 'image/png,image/jpeg,image/webp', multiple: false, required: false, maxFileSize: 200 * 1024, section: 'online' },
    { name: 'webseite', label: 'Webseite', type: 'url', required: false, validation: { type: 'url' }, section: 'online' },
    // 4. Branchen + Mitarbeiter (letzte Inhalte, keine Section nötig)
    { name: 'branche_id', label: 'Branchen', type: 'multiselect', required: false, dynamic: true, searchable: true, tagBased: true, placeholder: 'Branchen suchen und hinzufügen...', table: 'branchen', displayField: 'name', valueField: 'id', relationTable: 'marke_branchen', relationField: 'branche_id' },
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
      relationTable: 'marke_mitarbeiter',
      relationField: 'mitarbeiter_id',
      roleValue: 'management',
      filterNoKunden: true,
      filterByKlasse: 'Management',
      dependsOn: 'unternehmen_id',
      prefillFromUnternehmen: true,
      prefillRole: 'management',
      helpText: 'Wird vom Unternehmen vorausgefüllt'
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
      relationTable: 'marke_mitarbeiter',
      relationField: 'mitarbeiter_id',
      roleValue: 'lead_mitarbeiter',
      filterNoKunden: true,
      filterByKlasse: 'Lead',
      dependsOn: 'unternehmen_id',
      prefillFromUnternehmen: true,
      prefillRole: 'lead_mitarbeiter',
      helpText: 'Wird vom Unternehmen vorausgefüllt'
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
      relationTable: 'marke_mitarbeiter',
      relationField: 'mitarbeiter_id',
      roleValue: 'mitarbeiter',
      filterNoKunden: true,
      filterByKlasse: ['Projektmanagement', 'Strategie', 'Copywriter', 'Cutter'],
      dependsOn: 'unternehmen_id',
      prefillFromUnternehmen: true,
      prefillRole: 'mitarbeiter',
      helpText: 'Wird vom Unternehmen vorausgefüllt'
    }
  ]
};
