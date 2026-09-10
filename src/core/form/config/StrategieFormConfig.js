// Formular-Konfiguration fuer "strategie"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

export const strategieConfig = {
  title: 'Neues Konzept anlegen',
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
    },
    {
      // Briefing-Pflicht (Step 1): nur finalisierte Briefings des Unternehmens,
      // bei gesetzter Marke nur Briefings genau dieser Marke. Loader sitzt in
      // CascadeStrategies ('briefing_id:unternehmen_id'); Marke-Wechsel laedt
      // ueber reloadOnChange neu. Leerer Schnitt blockiert den Submit.
      name: 'briefing_id',
      label: 'Briefing',
      type: 'select',
      required: true,
      options: [],
      dynamic: true,
      searchable: true,
      placeholder: 'Briefing suchen und auswählen...',
      dependsOn: 'unternehmen_id',
      reloadOnChange: ['marke_id'],
      table: 'campaign_briefings',
      displayField: 'aktivierung_name',
      valueField: 'id'
    },
    {
      // Optionale 1:1-Verknuepfung (ADR 0010): nur unverknuepfte Castings
      // derselben Kampagne mit gleichem Briefing. Loader sitzt in
      // CascadeStrategies ('creator_auswahl_id:kampagne_id'); Briefing-Wechsel
      // laedt ueber reloadOnChange neu. Der Service verknuepft nach dem
      // Insert ueber linkCasting (beide Seiten), das Feld laeuft nie direkt
      // in den Insert.
      name: 'creator_auswahl_id',
      label: 'Casting (optional)',
      type: 'select',
      required: false,
      options: [],
      dynamic: true,
      searchable: true,
      placeholder: 'Casting suchen und auswählen...',
      dependsOn: 'kampagne_id',
      reloadOnChange: ['briefing_id'],
      table: 'creator_auswahl',
      displayField: 'name',
      valueField: 'id'
    }
  ]
};
