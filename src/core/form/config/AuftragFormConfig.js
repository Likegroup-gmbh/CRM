// Formular-Konfiguration fuer "auftrag"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

export const auftragConfig = {
  title: 'Neuen Auftrag anlegen',
  fields: [
    // Header-Section: Auftragsname, Unternehmen, Marke, Art des Auftrags
    { 
      name: 'auftragsname', 
      label: 'Auftragsname', 
      type: 'text', 
      required: true, 
      autoGenerate: true,
      readonly: true,
      placeholder: 'Wird automatisch generiert...',
      section: 'header',
      validation: { type: 'text', minLength: 2 }
    },
    { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...', section: 'header' },
    { name: 'marke_id', label: 'Marke', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Marke suchen und auswählen...', dependsOn: 'unternehmen_id', table: 'marke', displayField: 'markenname', valueField: 'id', section: 'header' },
    { 
      name: 'auftragtype', 
      label: 'Art des Auftrages', 
      type: 'select', 
      required: true, 
      placeholder: 'Auftragsart auswählen...',
      section: 'header',
      options: ['Pilotprojekt', 'Einmalprojekt', 'Folgeprojekt', 'Retainer', 'Jahreskooperation', 'Performance-Modell', 'Rahmenvertrag']
    },
    // Section Ansprechpartner
    { 
      name: 'ansprechpartner_id', 
      label: 'Ansprechpartner', 
      type: 'select', 
      required: true, 
      options: [], 
      dynamic: true, 
      searchable: true, 
      placeholder: 'Ansprechpartner auswählen...', 
      dependsOn: 'unternehmen_id', 
      table: 'ansprechpartner', 
      displayField: 'vorname,nachname', 
      valueField: 'id', 
      section: 'ansprechpartner' 
    },
    // Section Nummern: Angebotsnummer, Rechnungsnummer, PO
    { name: 'angebotsnummer', label: 'Angebotsnummer', type: 'text', required: true, placeholder: 'Angebotsnummer eingeben...', row: 'nummern', section: 'nummern' },
    { name: 're_nr', label: 'Rechnungsnummer', type: 'text', required: false, placeholder: 'Rechnungsnummer eingeben...', row: 'nummern', section: 'nummern' },
    { name: 'po', label: 'Interne PO', type: 'text', required: false, readonly: true, placeholder: 'Wird automatisch generiert...', row: 'po', section: 'nummern' },
    { name: 'externe_po', label: 'Externe PO', type: 'text', required: false, placeholder: 'Externe PO-Nummer eingeben...', row: 'po', section: 'nummern' },
    // Section Details: Zahlung, Zeitraum
    { 
      name: 'zahlungsziel_tage', 
      label: 'Zahlungsziel', 
      type: 'select', 
      required: false, 
      placeholder: 'Zahlungsziel auswählen...',
      row: 'zahlung',
      section: 'details',
      options: [
        { value: '0', label: 'Sofort' },
        { value: '14', label: '14 Tage' },
        { value: '30', label: '30 Tage' },
        { value: '45', label: '45 Tage' },
        { value: '60', label: '60 Tage' }
      ]
    },
    { name: 'rechnung_gestellt', label: 'RE gestellt', type: 'toggle', required: false, row: 'zahlung', section: 'details' },
    { name: 'rechnung_gestellt_am', label: 'Datum', type: 'date', required: false, placeholder: 'Rechnungsdatum', dependsOn: 'rechnung_gestellt', row: 'zahlung', section: 'details' },
    { name: 're_faelligkeit', label: 'RE-Fälligkeit', type: 'date', required: false, section: 'details' },
    // Wird aus re_faelligkeit abgeleitet (siehe AuftragEvents) und nur fuer den Cashflow-Kalender gespeichert
    { name: 'erwarteter_monat_zahlungseingang', type: 'hidden', section: 'details' },
    { name: 'start', label: 'Startdatum', type: 'date', required: false, row: 'zeitraum', section: 'details' },
    { name: 'ende', label: 'Enddatum', type: 'date', required: false, row: 'zeitraum', section: 'details' },
    { name: 'titel', label: 'Titel', type: 'textarea', required: false, rows: 3, section: 'details' },
    // Section Kampagne
    { name: 'kampagnenanzahl', label: 'Kampagnenanzahl', type: 'number', required: false, validation: { type: 'number', min: 1 }, section: 'kampagne' },
    // Section Finanzen
    { name: 'nettobetrag', label: 'Nettobetrag', type: 'number', required: false, validation: { type: 'number', min: 0 }, section: 'finanzen' },
    { name: 'ust_prozent', label: 'USt (%)', type: 'number', required: false, validation: { type: 'number', min: 0, max: 100 }, readonly: true, defaultValue: 19, section: 'finanzen' },
    { name: 'ust_betrag', label: 'USt Betrag', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['nettobetrag','ust_prozent'], section: 'finanzen' },
    { name: 'bruttobetrag', label: 'Brutto Gesamtbudget', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['nettobetrag','ust_betrag'], section: 'finanzen' },
    // Überwiesen + Uploader ohne Section
    { name: 'ueberwiesen', label: 'Überwiesen', type: 'toggle', required: false },
    { name: 'ueberwiesen_am', label: 'Überwiesen am', type: 'date', required: false, placeholder: 'Datum wann Zahlung überwiesen wurde', dependsOn: 'ueberwiesen' },
    { name: 'auftragsbestaetigung_file', label: 'Auftragsbestätigung', type: 'custom', customType: 'uploader', accept: 'application/pdf,image/*', multiple: false, required: false, maxFileSize: 10 * 1024 * 1024 },
    // Toggle für Auftragsdetails Split-View
    { 
      name: 'create_auftragsdetails', 
      label: 'Auftragsdetails erstellen', 
      type: 'toggle', 
      required: false,
      section: 'auftragsdetails_toggle',
      helpText: 'Aktivieren um direkt Auftragsdetails zu erfassen'
    }
  ]
};
