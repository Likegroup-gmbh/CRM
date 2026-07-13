// Formular-Konfiguration fuer Contracting-Rechnungen
// Reduziertes Feldset: kein Position-Select, keine Kooperation, Kampagne, Skonto, Zusatzkosten, Video
// Rechnung geht direkt auf den Contract (Auftrag). Unternehmen wird aus dem Contract abgeleitet.

export const rechnungContractingConfig = {
  title: 'Neue Contracting-Rechnung anlegen',
  fields: [
    {
      name: 'auftrag_id', label: 'Contract', type: 'select', required: true,
      options: [], dynamic: true, searchable: true,
      placeholder: 'Contract auswählen...',
      table: 'auftrag', displayField: 'auftragsname', valueField: 'id',
      filter: 'auftragtype.eq.Contracting'
    },
    {
      name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: false,
      options: [], dynamic: true, searchable: true,
      placeholder: 'Wird automatisch gesetzt', readonly: true,
      table: 'unternehmen', displayField: 'firmenname', valueField: 'id'
    },
    {
      name: 'creator_id', label: 'Creator', type: 'select', required: false,
      options: [], dynamic: true, searchable: true,
      placeholder: 'Creator auswählen...',
      table: 'creator', displayField: 'vorname,nachname', valueField: 'id'
    },
    { name: 'nettobetrag', label: 'Betrag (Netto)', type: 'number', required: true, validation: { type: 'number', min: 0 } },
    { name: 'nettobetrag_steuerfrei', label: 'Steuerfreier Betrag (0% USt)', type: 'number', required: false, validation: { type: 'number', min: 0 }, helpText: 'Für Anteile der Rechnung ohne Umsatzsteuer – wird zum Bruttobetrag addiert, aber nicht besteuert.' },
    { name: 'ust_aktiv', label: 'Umsatzsteuer berechnen', type: 'toggle', required: false, defaultValue: true, helpText: 'Ausschalten, wenn der Creator keine Umsatzsteuer ausweist' },
    { name: 'ust_prozent', label: 'Umsatzsteuer (%)', type: 'number', required: false, readonly: true, defaultValue: 19, suffix: '%' },
    { name: 'ust_betrag', label: 'Umsatzsteuerbetrag', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 } },
    { name: 'bruttobetrag', label: 'Betrag (Brutto)', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 } },
    { name: 'ksk_pflichtig', label: 'KSK-pflichtig', type: 'toggle', required: false, defaultValue: false, helpText: 'Künstlersozialabgabe wird abgeführt' },
    { name: 'status', label: 'Status', type: 'select', required: true, options: ['Offen', 'Rückfrage', 'Bezahlt', 'An Qonto gesendet'] },
    { name: 'gestellt_am', label: 'Gestellt am', type: 'date', required: true },
    { name: 'zahlungsziel', label: 'Zahlungsziel', type: 'date', required: true },
    { name: 'bezahlt_am', label: 'Bezahlt am', type: 'date', required: false },
    { name: 'land', label: 'Land', type: 'text', required: false, placeholder: 'z.B. Deutschland' },
    { name: 'pdf_file', label: 'Rechnungs-PDFs', type: 'custom', customType: 'uploader', accept: 'application/pdf', multiple: true, required: false, maxFileSize: 10 * 1024 * 1024 },
    { name: 'belege_files', label: 'Belege (mehrere Dateien)', type: 'custom', customType: 'uploader', accept: 'application/pdf,image/*', multiple: true, required: false, maxFileSize: 10 * 1024 * 1024 }
  ]
};
