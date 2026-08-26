// Formular-Konfiguration fuer "rechnung"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

export const rechnungConfig = {
  title: 'Neue Rechnung anlegen',
  fields: [
    // Nummern (kooperation_id bewusst OHNE section/row: das Vertrag-Gate in
    // RechnungEvents.js erwartet das Feld als direktes form-Kind)
    { name: 'po_nummer', label: 'Interne PO-Nummer', type: 'text', required: false, readonly: true, editOnly: true, placeholder: 'Wird automatisch vergeben', row: 'nummern' },
    { name: 'externe_angebotsnummer', label: 'Externe Angebotsnummer', type: 'text', required: false, placeholder: 'Angebotsnummer aus Kundenangebot...', row: 'nummern' },
    { name: 'kooperation_id', label: 'Kooperation', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Kooperation wählen...', table: 'kooperationen', displayField: 'name', valueField: 'id' },
    // Zuordnung (auto-befuellt aus Kooperation)
    { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen wird automatisch gesetzt', readonly: true, table: 'unternehmen', displayField: 'firmenname', valueField: 'id', section: 'zuordnung' },
    { name: 'auftrag_id', label: 'Auftrag', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Auftrag wird automatisch gesetzt', readonly: true, table: 'auftrag', displayField: 'auftragsname', valueField: 'id', section: 'zuordnung' },
    { name: 'kampagne_id', label: 'Kampagne', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Kampagne wird automatisch gesetzt', readonly: true, table: 'kampagne', displayField: 'kampagnenname', valueField: 'id', section: 'zuordnung' },
    { name: 'creator_id', label: 'Creator', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Creator wird automatisch gesetzt', readonly: true, table: 'creator', displayField: 'vorname', valueField: 'id', section: 'zuordnung' },
    { name: 'vertrag_id', label: 'Vertrag', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Vertrag wählen...', editOnly: true, dependsOn: 'kooperation_id', filterBy: 'kooperation_id', table: 'vertraege', displayField: 'name', valueField: 'id', section: 'zuordnung' },
    { name: 'videoanzahl', label: 'Video Anzahl (aus Kooperation)', type: 'number', required: false, validation: { type: 'number', min: 0 }, section: 'zuordnung' },
    // Status & Datum
    { name: 'status', label: 'Status', type: 'select', required: true, options: ['Offen', 'Rückfrage', 'Bezahlt', 'An Qonto gesendet', 'Marc an Qonto gesendet'], section: 'status', row: 'statusrow' },
    { name: 'geprueft', label: 'Geprüft', type: 'toggle', required: false, section: 'status', row: 'statusrow' },
    { name: 'gestellt_am', label: 'Gestellt am', type: 'date', required: true, section: 'status', row: 'datumrow' },
    { name: 'zahlungsziel', label: 'Zahlungsziel', type: 'date', required: true, section: 'status', row: 'datumrow' },
    { name: 'bezahlt_am', label: 'Bezahlt am', type: 'date', required: false, section: 'status' },
    // Eingabefelder
    { name: 'nettobetrag', label: 'Betrag (Netto)', type: 'number', required: true, validation: { type: 'number', min: 0 }, section: 'betraege', row: 'betragrow' },
    { name: 'zusatzkosten', label: 'Zusatzkosten', type: 'number', required: false, validation: { type: 'number', min: 0 }, section: 'betraege', row: 'betragrow' },
    { name: 'ksk_betrag', label: 'KSK-Aufschlag (Selbstzahler)', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 }, helpText: 'Aus der Kooperation übernommen – der Creator zahlt die KSK selbst. Teil der USt-Basis.', section: 'betraege' },
    { name: 'nettobetrag_steuerfrei', label: 'Steuerfreier Betrag (0% USt)', type: 'number', required: false, validation: { type: 'number', min: 0 }, helpText: 'Für Anteile der Rechnung ohne Umsatzsteuer – wird zum Bruttobetrag addiert, aber nicht besteuert.', section: 'betraege', row: 'steuerfreirow' },
    { name: 'zusatzkosten_brutto', label: 'Zusatzkosten als Brutto (inkl. USt)', type: 'toggle', required: false, defaultValue: false, helpText: 'Aktivieren, wenn die Zusatzkosten bereits die USt enthalten (durchlaufender Posten)', section: 'betraege', row: 'togglerow' },
    { name: 'ust_aktiv', label: 'Umsatzsteuer berechnen', type: 'toggle', required: false, defaultValue: true, helpText: 'Ausschalten, wenn der Creator keine Umsatzsteuer ausweist', section: 'betraege', row: 'togglerow' },
    { name: 'ust_prozent', label: 'Umsatzsteuer (%)', type: 'number', required: false, readonly: true, defaultValue: 19, suffix: '%', section: 'betraege', row: 'ustrow' },
    { name: 'skonto', label: '3% Skonto berücksichtigen', type: 'toggle', required: false, section: 'betraege', row: 'ustrow' },
    // Berechnete Ergebnis-Felder (readonly)
    { name: 'netto_gesamt', label: 'Netto gesamt (vor Skonto)', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 }, section: 'summen', row: 'sum1' },
    { name: 'brutto_vor_skonto', label: 'Brutto gesamt (vor Skonto)', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 }, section: 'summen', row: 'sum1' },
    { name: 'skonto_betrag', label: 'Skonto (3%)', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 }, section: 'summen', row: 'sum2' },
    { name: 'netto_nach_skonto', label: 'Netto nach Skonto', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 }, section: 'summen', row: 'sum2' },
    { name: 'ust_betrag', label: 'Umsatzsteuerbetrag', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 }, section: 'summen', row: 'sum3' },
    { name: 'bruttobetrag', label: 'Betrag (Brutto)', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 }, section: 'summen', row: 'sum3' },
    // Sonstiges & Uploads
    { name: 'land', label: 'Land', type: 'text', required: false, placeholder: 'z.B. Deutschland', section: 'abschluss' },
    { name: 'pdf_file', label: 'Rechnungs-PDFs', type: 'custom', customType: 'uploader', accept: 'application/pdf', multiple: true, required: false, maxFileSize: 10 * 1024 * 1024, section: 'abschluss' },
    { name: 'belege_files', label: 'Belege (mehrere Dateien)', type: 'custom', customType: 'uploader', accept: 'application/pdf,image/*', multiple: true, required: false, maxFileSize: 10 * 1024 * 1024, section: 'abschluss' }
  ]
};
