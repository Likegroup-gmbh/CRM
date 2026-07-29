// Formular-Konfiguration fuer "strategie"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

export const strategieConfig = {
  title: 'Neue Strategie anlegen',
  fields: [
    { 
      name: 'name', 
      label: 'Name', 
      type: 'text', 
      required: true, 
      placeholder: 'Strategiename eingeben...',
      validation: { type: 'text', minLength: 2 }
    },
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
    { 
      name: 'kampagne_id', 
      label: 'Kampagne', 
      type: 'select', 
      required: true, 
      options: [], 
      dynamic: true, 
      searchable: true, 
      placeholder: 'Kampagne suchen und auswählen...', 
      dependsOn: 'unternehmen_id', 
      table: 'kampagne', 
      displayField: 'kampagnenname', 
      valueField: 'id',
      filterByMarke: true
    }
  ]
};
