// Formular-Konfiguration fuer "produkt"
// Reine Datendatei, wird von FormConfig.js eingesammelt.
//
// Ein Produkt ist eine Kollektion: sie traegt die Substanz, die spaeter in
// Strategie, Skripte und Creator-Matching fliesst. Varianten (Farbe, Modell,
// abweichender Preis) haengen daran und werden im Panel rechts gepflegt,
// siehe ProduktVarianten.js.
//
// unternehmen_id kommt aus dem Kontext (Hidden) oder, auf /produkt/new, als
// sichtbares Select (docRole 'owner'). marke_ids rendert im Unternehmens-
// und Listen-Kontext - aus einer Marke heraus ist die Zuordnung fix.
//
// Die doc*-Angaben steuern das Worksheet-Layout in ProduktDoc.js:
//   docSlot   'side' holt das Feld aus dem Dokument in die rechte Spalte
//   docRole   'title' = Dokumenttitel, 'inline' = schmales Feld in einer Zeile,
//             'uploader' = Tabelle, 'relations' = Tag-Multiselect,
//             sonst frei beschreibbarer Textabschnitt
//   docLabel  kuerzere Ueberschrift fuers Dokument, falls label zu technisch ist
//   docHint   kurze Erlaeuterung unter dem Feld (nur bei docRole 'inline')
//   docList   ein Eintrag pro Zeile - setzt die Zeilen enger als Fliesstext
//   docGroup  buendelt Felder in eine Sektion (Hairline-Band; Abstand zwischen
//             Sektionen und innerhalb der Sektion sind getrennt steuerbar)
// Ohne diese Angaben rendert das klassische FormRenderer-Formular unveraendert.

export const produktConfig = {
  title: 'Neues Produkt anlegen',
  fields: [
    // 1. Auslesen - steht ganz oben, damit die Shop-URL vor dem manuellen
    // Tippen eingegeben wird und die Felder darunter fuellen kann.
    {
      name: 'url',
      label: 'Shop-URL',
      type: 'url',
      required: false,
      validation: { type: 'url' },
      placeholder: 'https://muster-shop.de/products/produktname',
      aiExtract: true,
      docSlot: 'side',
      section: 'auslesen',
      sectionTitle: 'Mit der Produktseite starten',
      sectionDescription: 'Adresse eintragen und "Auslesen" klicken: Beschreibung, USP, Preis und Produktbilder kommen aus der Shop-Seite. Nur leere Felder werden gefüllt, eigene Eingaben bleiben unangetastet.'
    },

    // 2. Was ist es
    {
      name: 'name',
      label: 'Produkt- / Kollektionsname',
      type: 'text',
      required: true,
      validation: { type: 'text', minLength: 2 },
      placeholder: "z.B. 'Clear Case Kollektion'",
      docRole: 'title',
      section: 'basis',
      sectionTitle: 'Was ist das Produkt?',
      sectionDescription: 'Die Kollektion trägt die gemeinsame Basis. Unterschiede wie Farbe oder Modell kommen als Varianten dazu.'
    },
    {
      name: 'unternehmen_id',
      label: 'Unternehmen',
      type: 'select',
      required: true,
      searchable: true,
      table: 'unternehmen',
      displayField: 'firmenname',
      valueField: 'id',
      placeholder: 'Unternehmen suchen und auswählen...',
      docRole: 'owner',
      docLabel: 'Unternehmen',
      docHint: 'Welchem Unternehmen gehört das Produkt?',
      docGroup: 'inhalt',
      section: 'basis'
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
      relationTable: 'produkt_marke',
      relationField: 'marke_id',
      relationEntityField: 'produkt_id',
      placeholder: 'Marken suchen und hinzufügen...',
      docRole: 'relations',
      docLabel: 'Marken',
      docHint: 'Optional. Ohne Marke gehört das Produkt nur dem Unternehmen.',
      docGroup: 'inhalt',
      section: 'basis'
    },
    {
      name: 'kurzbeschreibung',
      label: 'Kurzbeschreibung',
      type: 'textarea',
      required: false,
      rows: 3,
      docGroup: 'inhalt',
      section: 'basis'
    },

    // 3. Warum kauft man es
    {
      name: 'usp',
      label: 'USP',
      type: 'textarea',
      required: false,
      rows: 3,
      docList: true,
      docGroup: 'inhalt',
      section: 'nutzen',
      sectionTitle: 'Warum kauft man es?',
      sectionDescription: 'Diese Felder sind die Substanz für Skripte und Briefings. Ein Eintrag pro Zeile.'
    },
    {
      name: 'pain_points',
      label: 'Pain Points',
      type: 'textarea',
      required: false,
      rows: 3,
      docList: true,
      docGroup: 'inhalt',
      section: 'nutzen'
    },
    {
      name: 'loesung',
      label: 'Lösung, die es bietet',
      type: 'textarea',
      required: false,
      rows: 3,
      docGroup: 'inhalt',
      section: 'nutzen'
    },
    // einsatzsituation hat hier kein Feld mehr: Einsatzsituationen sind
    // strukturierte Kinder (produkt_use_case) und werden im Persona-Band
    // gepflegt. Der Extract liefert den Wert weiter als Seed fuer den
    // Persona-Job, die Spalte bleibt als Legacy-Lesefallback bestehen.

    // 4. Preis-Range der Kollektion
    {
      name: 'preis_von',
      label: 'Preis von (€)',
      type: 'number',
      required: false,
      validation: { type: 'number', min: 0, step: 0.01 },
      placeholder: '29.90',
      row: 'preis',
      colSize: 'small',
      docRole: 'inline',
      docLabel: 'von',
      docGroup: 'preis',
      section: 'preis',
      sectionTitle: 'Preis'
    },
    {
      name: 'preis_bis',
      label: 'Preis bis (€)',
      type: 'number',
      required: false,
      validation: { type: 'number', min: 0, step: 0.01 },
      placeholder: '49.90',
      row: 'preis',
      colSize: 'small',
      docRole: 'inline',
      docLabel: 'bis',
      docGroup: 'preis',
      section: 'preis'
    },
    {
      name: 'preis_uvp',
      label: 'UVP / regulärer Preis (€)',
      type: 'number',
      required: false,
      validation: { type: 'number', min: 0, step: 0.01 },
      placeholder: '399.00',
      row: 'preis',
      colSize: 'small',
      docRole: 'inline',
      docLabel: 'UVP',
      docHint: 'Nur bei Rabatt',
      docGroup: 'preis',
      section: 'preis'
    },

    // 5. Produkt-Assets
    {
      name: 'bilder_files',
      label: 'Produktbilder',
      type: 'custom',
      customType: 'uploader',
      accept: 'image/png,image/jpeg,image/webp,image/avif',
      multiple: true,
      required: false,
      maxFileSize: 2 * 1024 * 1024,
      // Ab hier meldet die Tabelle "Große Datei" und bietet Reduzieren an.
      // Deutlich unter maxFileSize: 200 KB reichen fuer ein Produktbild.
      warnFileSize: 200 * 1024,
      shrink: { maxWidth: 1200, maxHeight: 1200, quality: 0.6, format: 'image/avif', fallbackFormat: 'image/webp' },
      maxFiles: 5,
      sortable: true,
      primarySelectable: true,
      docRole: 'uploader',
      docLabel: 'Produktbilder',
      docGroup: 'bilder',
      section: 'assets',
      sectionTitle: 'Produkt-Assets',
      sectionDescription: 'Bis zu fünf Bilder. Beim Auslesen der Shop-URL werden Bilder automatisch vorgeschlagen und können einzeln verworfen werden.'
    },

    // 6. Compliance - relevant fuer Creator-Briefings
    {
      name: 'inhaltsstoffe',
      label: 'Inhaltsstoffe',
      type: 'textarea',
      required: false,
      rows: 3,
      docList: true,
      docGroup: 'compliance',
      section: 'compliance',
      sectionTitle: 'Rechtliches und Compliance',
      sectionDescription: 'Was der Creator sagen darf und was nicht. Fließt später direkt ins Briefing.'
    },
    {
      name: 'erlaubte_claims',
      label: 'Erlaubte Claims',
      type: 'textarea',
      required: false,
      rows: 3,
      docList: true,
      docGroup: 'compliance',
      section: 'compliance'
    },
    {
      name: 'verbotene_claims',
      label: 'Verbotene Claims',
      type: 'textarea',
      required: false,
      rows: 3,
      docList: true,
      docGroup: 'compliance',
      section: 'compliance'
    },
    {
      name: 'rechtliche_hinweise',
      label: 'Rechtliche Hinweise',
      type: 'textarea',
      required: false,
      rows: 3,
      docGroup: 'compliance',
      section: 'compliance'
    }
  ]
};
