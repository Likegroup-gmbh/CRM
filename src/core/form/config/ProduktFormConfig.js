// Formular-Konfiguration fuer "produkt"
// Reine Datendatei, wird von FormConfig.js eingesammelt.
//
// Ein Produkt ist eine Kollektion: sie traegt die Substanz, die spaeter in
// Strategie, Skripte und Creator-Matching fliesst. Varianten (Farbe, Modell,
// abweichender Preis) haengen daran und werden im Panel rechts gepflegt,
// siehe MarkeProduktVarianten.js.
//
// marke_id und unternehmen_id sind bewusst keine Felder: die Zuordnung kommt
// aus dem Kontext (Marke-Detailseite) und wird beim Speichern gesetzt.
//
// Die doc*-Angaben steuern das Worksheet-Layout in MarkeProduktDoc.js:
//   docSlot   'side' holt das Feld aus dem Dokument in die rechte Spalte
//   docRole   'title' = Dokumenttitel, 'inline' = schmales Feld in einer Zeile,
//             'uploader' = Tabelle, sonst frei beschreibbarer Textabschnitt
//   docLabel  kuerzere Ueberschrift fuers Dokument, falls label zu technisch ist
//   docHint   kurze Erlaeuterung unter dem Feld (nur bei docRole 'inline')
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
    {
      name: 'einsatzsituation',
      label: 'Einsatzsituation / Anwendungsfall',
      type: 'textarea',
      required: false,
      rows: 3,
      docGroup: 'inhalt',
      section: 'nutzen'
    },

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
      sectionTitle: 'Preis',
      sectionDescription: 'Spanne über alle Varianten. Bei einem einzelnen Preis nur "von" füllen. Der UVP ist der reguläre Preis, wenn das Angebot reduziert ist – also der durchgestrichene Betrag im Shop.'
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
      accept: 'image/png,image/jpeg,image/webp',
      multiple: true,
      required: false,
      maxFileSize: 2 * 1024 * 1024,
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
      docGroup: 'compliance',
      section: 'compliance'
    },
    {
      name: 'verbotene_claims',
      label: 'Verbotene Claims',
      type: 'textarea',
      required: false,
      rows: 3,
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
