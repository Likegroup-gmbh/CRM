export class FormConfig {
  getFormConfig(entity) {
    const configs = {
      creator: {
        title: 'Neuen Creator anlegen',
        fields: [
          // Name in einer Zeile
          { name: 'vorname', label: 'Vorname', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, row: 'name', colSize: 'grow' },
          { name: 'nachname', label: 'Nachname', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, row: 'name', colSize: 'grow' },
          // Lieferadresse gruppiert
          { name: 'lieferadresse_strasse', label: 'Straße', type: 'text', required: false, row: 'lieferadresse1', colSize: 'grow' },
          { name: 'lieferadresse_hausnummer', label: 'Nr.', type: 'text', required: false, row: 'lieferadresse1', colSize: 'small' },
          { name: 'lieferadresse_plz', label: 'PLZ', type: 'text', required: false, row: 'lieferadresse2', colSize: 'small' },
          { name: 'lieferadresse_stadt', label: 'Stadt', type: 'text', required: false, row: 'lieferadresse2', colSize: 'grow' },
          { name: 'lieferadresse_land', label: 'Land', type: 'text', required: false, defaultValue: 'Deutschland' },
          // Toggle: Rechnungsadresse abweichend
          { name: 'rechnungsadresse_abweichend', label: 'Rechnungsadresse abweichend von Lieferadresse', type: 'toggle', required: false },
          // Rechnungsadresse (nur wenn Toggle aktiv)
          { name: 'rechnungsadresse_strasse', label: 'Straße (Rechnung)', type: 'text', required: false, row: 'rechnungsadresse1', colSize: 'grow', dependsOn: 'rechnungsadresse_abweichend', showWhen: 'true' },
          { name: 'rechnungsadresse_hausnummer', label: 'Nr.', type: 'text', required: false, row: 'rechnungsadresse1', colSize: 'small', dependsOn: 'rechnungsadresse_abweichend', showWhen: 'true' },
          { name: 'rechnungsadresse_plz', label: 'PLZ', type: 'text', required: false, row: 'rechnungsadresse2', colSize: 'small', dependsOn: 'rechnungsadresse_abweichend', showWhen: 'true' },
          { name: 'rechnungsadresse_stadt', label: 'Stadt', type: 'text', required: false, row: 'rechnungsadresse2', colSize: 'grow', dependsOn: 'rechnungsadresse_abweichend', showWhen: 'true' },
          { name: 'rechnungsadresse_land', label: 'Land (Rechnung)', type: 'text', required: false, defaultValue: 'Deutschland', dependsOn: 'rechnungsadresse_abweichend', showWhen: 'true' },
          // Social Media
          { name: 'instagram', label: 'Instagram', type: 'text', required: false },
          { 
            name: 'instagram_follower', 
            label: 'Instagram Follower', 
            type: 'select', 
            required: false,
            options: [
              { value: '0-2500', label: '0 - 2.500' },
              { value: '2500-5000', label: '2.500 - 5.000' },
              { value: '5000-10000', label: '5.000 - 10.000' },
              { value: '10000-25000', label: '10.000 - 25.000' },
              { value: '25000-50000', label: '25.000 - 50.000' },
              { value: '50000-100000', label: '50.000 - 100.000' },
              { value: '100000-250000', label: '100.000 - 250.000' },
              { value: '250000-500000', label: '250.000 - 500.000' },
              { value: '500000-1000000', label: '500.000 - 1.000.000' },
              { value: '1000000+', label: '+ 1.000.000' }
            ]
          },
          { name: 'tiktok', label: 'TikTok', type: 'text', required: false },
          { 
            name: 'tiktok_follower', 
            label: 'TikTok Follower', 
            type: 'select', 
            required: false,
            options: [
              { value: '0-2500', label: '0 - 2.500' },
              { value: '2500-5000', label: '2.500 - 5.000' },
              { value: '5000-10000', label: '5.000 - 10.000' },
              { value: '10000-25000', label: '10.000 - 25.000' },
              { value: '25000-50000', label: '25.000 - 50.000' },
              { value: '50000-100000', label: '50.000 - 100.000' },
              { value: '100000-250000', label: '100.000 - 250.000' },
              { value: '250000-500000', label: '250.000 - 500.000' },
              { value: '500000-1000000', label: '500.000 - 1.000.000' },
              { value: '1000000+', label: '+ 1.000.000' }
            ]
          },
          {
            name: 'sprachen_ids',
            label: 'Sprachen',
            type: 'multiselect',
            required: false,
            options: [],
            dynamic: true,
            searchable: true,
            tagBased: true,
            placeholder: 'Sprachen suchen und hinzufügen...',
            table: 'sprachen',
            displayField: 'name',
            valueField: 'id',
            customField: true
          },
          {
            name: 'branche_ids',
            label: 'Branchen',
            type: 'multiselect',
            required: false,
            options: [],
            dynamic: true,
            searchable: true,
            tagBased: true,
            placeholder: 'Branchen suchen und hinzufügen...',
            table: 'branchen_creator',
            displayField: 'name',
            valueField: 'id',
            customField: true
          },
          {
            name: 'creator_type_ids',
            label: 'Creator-Typen',
            type: 'multiselect',
            required: false,
            options: [],
            dynamic: true,
            searchable: true,
            tagBased: true,
            placeholder: 'Creator-Typen suchen und hinzufügen...',
            table: 'creator_type',
            displayField: 'name',
            valueField: 'id',
            customField: true
          },
          // Persönliche Infos
          { 
            name: 'geschlecht', 
            label: 'Geschlecht', 
            type: 'select', 
            required: false,
            options: [
              { value: 'männlich', label: 'Männlich' },
              { value: 'weiblich', label: 'Weiblich' },
              { value: 'divers', label: 'Divers' }
            ]
          },
          { name: 'alter_jahre', label: 'Alter', type: 'number', required: false },
          // Haustier Toggle + Beschreibung
          { name: 'hat_haustier', label: 'Hat Haustier', type: 'toggle', required: false },
          { 
            name: 'haustier_beschreibung', 
            label: 'Haustier Beschreibung', 
            type: 'textarea', 
            required: false,
            dependsOn: 'hat_haustier',
            showWhen: 'true'
          },
          { name: 'telefonnummer', label: 'Telefonnummer', type: 'tel', required: false, validation: { type: 'phone' } },
          { name: 'mail', label: 'Email', type: 'email', required: false, validation: { type: 'email' } },
          { name: 'portfolio_link', label: 'Portfolio Link', type: 'url', required: false, validation: { type: 'url' } },
          { name: 'notiz', label: 'Notizen', type: 'textarea', required: false }
        ]
      },
      unternehmen: {
        title: 'Neues Unternehmen anlegen',
        fields: [
          { name: 'firmenname', label: 'Firmenname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          // Adressfelder direkt unter Firmenname, gruppiert
          { name: 'rechnungsadresse_strasse', label: 'Straße', type: 'text', required: false, row: 'adresse1', colSize: 'grow' },
          { name: 'rechnungsadresse_hausnummer', label: 'Nr.', type: 'text', required: false, row: 'adresse1', colSize: 'small' },
          { name: 'rechnungsadresse_plz', label: 'PLZ', type: 'text', required: false, row: 'adresse2', colSize: 'small' },
          { name: 'rechnungsadresse_stadt', label: 'Stadt', type: 'text', required: false, row: 'adresse2', colSize: 'grow' },
          { name: 'rechnungsadresse_land', label: 'Land', type: 'text', required: false, defaultValue: 'Deutschland' },
          { name: 'logo_file', label: 'Logo', type: 'custom', customType: 'uploader', accept: 'image/png,image/jpeg', multiple: false, required: false, maxFileSize: 200 * 1024 },
          { name: 'branche_id', label: 'Branchen', type: 'multiselect', required: false, dynamic: true, searchable: true, tagBased: true, placeholder: 'Branche suchen und hinzufügen...', table: 'branchen', displayField: 'name', valueField: 'id', relationTable: 'unternehmen_branchen', relationField: 'branche_id' },
          // Mitarbeiter-Zuordnungen nach Rolle
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
            filterNoKunden: true
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
            filterNoKunden: true
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
            filterNoKunden: true
          },
          { name: 'invoice_email', label: 'Rechnungs-Email', type: 'email', required: false, validation: { type: 'email' } },
          { name: 'status', label: 'Status', type: 'select', required: false, editOnly: true, options: ['Aktiv', 'Inaktiv', 'Prospekt'] },
          { name: 'steuernummer', label: 'Steuernummer', type: 'text', required: false },
          { name: 'ust_id', label: 'USt-IdNr.', type: 'text', required: false, placeholder: 'z.B. DE123456789' }
        ]
      },
      kampagne: {
        title: 'Neue Kampagne anlegen',
        fields: [
          { 
            name: 'kampagnenname', 
            label: 'Kampagnenname', 
            type: 'text', 
            required: false, // Nicht required da automatisch generiert
            validation: { type: 'text', minLength: 2, skipIfAutoGenerated: true },
            autoGenerate: true,
            dependsOn: 'auftrag_id',
            showWhen: 'any',
            readonly: true,
            placeholder: 'Wird automatisch generiert...'
          },
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...', table: 'unternehmen', displayField: 'firmenname', valueField: 'id' },
          { name: 'marke_id', label: 'Marke', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Marke suchen und auswählen...', dependsOn: 'unternehmen_id', table: 'marke', displayField: 'markenname', valueField: 'id' },
          { name: 'auftrag_id', label: 'Auftrag', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Auftrag suchen und auswählen...', dependsOn: 'unternehmen_id', table: 'auftrag', displayField: 'auftragsname', valueField: 'id', filterByMarke: true },
          { 
            name: 'art_der_kampagne', 
            label: 'Art der Kampagne', 
            type: 'multiselect', 
            required: false, 
            options: [], 
            dynamic: true, 
            searchable: true, 
            tagBased: true, 
            placeholder: 'Kampagnenarten suchen und auswählen...',
            table: 'kampagne_art_typen',
            displayField: 'name',
            valueField: 'id',
            directQuery: true
          },
          { 
            name: 'kampagne_typ', 
            label: 'Kampagne Typ', 
            type: 'select', 
            required: true, 
            searchable: true,
            placeholder: 'Kampagne-Typ auswählen...',
            options: [
              { value: 'paid', label: 'Paid' },
              { value: 'organic', label: 'Organic' },
              { value: 'influencer_posting', label: 'Influencer Posting' }
            ]
          },
          // Paid-Ziele (nur sichtbar wenn kampagne_typ = 'paid')
          {
            name: 'paid_ziele_ids',
            label: 'Paid Ziele',
            type: 'multiselect',
            required: false,
            options: [],
            dynamic: true,
            searchable: true,
            tagBased: true,
            placeholder: 'Paid-Ziele auswählen...',
            table: 'kampagne_paid_ziele_typen',
            displayField: 'name',
            valueField: 'id',
            relationTable: 'kampagne_paid_ziele',
            relationField: 'ziel_id',
            directQuery: true,
            dependsOn: 'kampagne_typ',
            showWhen: 'paid'
          },
          // Organic-Ziele (nur sichtbar wenn kampagne_typ = 'organic')
          {
            name: 'organic_ziele_ids',
            label: 'Organic Ziele',
            type: 'multiselect',
            required: false,
            options: [],
            dynamic: true,
            searchable: true,
            tagBased: true,
            placeholder: 'Organic-Ziele auswählen...',
            table: 'kampagne_organic_ziele_typen',
            displayField: 'name',
            valueField: 'id',
            relationTable: 'kampagne_organic_ziele',
            relationField: 'ziel_id',
            directQuery: true,
            dependsOn: 'kampagne_typ',
            showWhen: 'organic'
          },
          { name: 'start', label: 'Startdatum', type: 'date', required: false },
          // Deadline-Felder Gruppe (2x2 Grid)
          { name: 'deadline_strategie', label: 'Deadline Strategie', type: 'date', required: false, twoCol: true },
          { name: 'deadline_creator_sourcing', label: 'Deadline Sourcing', type: 'date', required: false, twoCol: true },
          { name: 'deadline_video_produktion', label: 'Deadline Video Produktion', type: 'date', required: false, twoCol: true },
          { name: 'deadline_post_produktion', label: 'Deadline Post Produktion', type: 'date', required: false, twoCol: true },
          { 
            name: 'drehort_typ_id', 
            label: 'Drehort', 
            type: 'select', 
            required: false, 
            options: [], 
            dynamic: true, 
            searchable: true, 
            placeholder: 'Drehort-Typ auswählen...',
            table: 'drehort_typen',
            displayField: 'name',
            valueField: 'id',
            directQuery: true
          },
          { 
            name: 'drehort_beschreibung', 
            label: 'Drehort Beschreibung', 
            type: 'textarea', 
            required: false,
            dependsOn: 'drehort_typ_id',
            showWhen: 'Vor Ort Produktion'
          },
          { 
            name: 'kampagne_adressen', 
            label: 'Adressen', 
            type: 'custom', 
            customType: 'addresses',
            required: false,
            dependsOn: 'drehort_typ_id',
            showWhen: 'Vor Ort Produktion'
          },
          {
            name: 'status_id',
            label: 'Status',
            type: 'select',
            required: false,
            options: [],
            dynamic: true,
            searchable: true,
            placeholder: 'Status auswählen...',
            table: 'kampagne_status',
            displayField: 'name',
            valueField: 'id',
            directQuery: true
          },
          {
            name: 'plattform_ids',
            label: 'Plattformen',
            type: 'multiselect',
            required: false,
            options: [],
            dynamic: true,
            searchable: true,
            tagBased: true,
            placeholder: 'Plattformen suchen und auswählen...',
            table: 'plattform_typen',
            displayField: 'name',
            valueField: 'id',
            relationTable: 'kampagne_plattformen',
            relationField: 'plattform_id',
            directQuery: true
          },
          {
            name: 'format_ids',
            label: 'Formate',
            type: 'multiselect',
            required: false,
            options: [],
            dynamic: true,
            searchable: true,
            tagBased: true,
            placeholder: 'Formate suchen und auswählen...',
            table: 'format_typen',
            displayField: 'name',
            valueField: 'id',
            relationTable: 'kampagne_formate',
            relationField: 'format_id',
            directQuery: true
          },
          // Dynamische Kampagnenart-Felder (Container wird durch FormEvents befüllt)
          {
            name: 'kampagnenart_felder_container',
            label: '',
            type: 'custom',
            customType: 'kampagnenart-felder',
            required: false,
            dependsOn: 'art_der_kampagne',
            showWhen: 'any'
          }
        ]
      },
      marke: {
        title: 'Neue Marke anlegen',
        fields: [
          { name: 'markenname', label: 'Markenname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          { name: 'logo_file', label: 'Logo', type: 'custom', customType: 'uploader', accept: 'image/png,image/jpeg', multiple: false, required: false, maxFileSize: 200 * 1024 },
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...', table: 'unternehmen', displayField: 'firmenname', valueField: 'id' },
          { name: 'webseite', label: 'Webseite', type: 'url', required: false, validation: { type: 'url' } },
          { name: 'branche_id', label: 'Branchen', type: 'multiselect', required: false, dynamic: true, searchable: true, tagBased: true, placeholder: 'Branchen suchen und hinzufügen...', table: 'branchen', displayField: 'name', valueField: 'id', relationTable: 'marke_branchen', relationField: 'branche_id' },
          // Mitarbeiter-Zuordnungen nach Rolle (wie bei Unternehmen)
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
            dependsOn: 'unternehmen_id',
            prefillFromUnternehmen: true,
            prefillRole: 'mitarbeiter',
            helpText: 'Wird vom Unternehmen vorausgefüllt'
          }
        ]
      },
      auftrag: {
        title: 'Neuen Auftrag anlegen',
        fields: [
          { name: 'auftragsname', label: 'Auftragsname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...' },
          { name: 'marke_id', label: 'Marke', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Marke suchen und auswählen...', dependsOn: 'unternehmen_id', table: 'marke', displayField: 'markenname', valueField: 'id' },
          { name: 'status', label: 'Status', type: 'select', required: false, options: ['Beauftragt', 'In Produktion', 'Abgeschlossen', 'Storniert'] },
          { name: 'ansprechpartner_id', label: 'Ansprechpartner', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Ansprechpartner auswählen...', table: 'ansprechpartner', displayField: 'vorname,nachname,email', valueField: 'id', dependsOn: 'unternehmen_id' },
          { 
            name: 'auftragtype', 
            label: 'Art des Auftrages', 
            type: 'select', 
            required: false, 
            placeholder: 'Auftragsart auswählen...',
            options: ['Pilotprojekt', 'Follow Up', 'Jahreskooperation', 'Bestandskunde, Projektbasiert']
          },
          { name: 'notiz', label: 'Beschreibung / Notiz', type: 'textarea', required: false, placeholder: 'Auftragsbeschreibung eingeben...' },
          { name: 'angebotsnummer', label: 'Angebotsnummer', type: 'text', required: false, readonly: true, placeholder: 'Wird automatisch generiert...' },
          { name: 're_nr', label: 'RE. Nr', type: 'text', required: false, placeholder: 'Rechnungsnummer...' },
          { name: 'po', label: 'PO', type: 'text', required: false, placeholder: 'Purchase Order Nummer...' },
          { 
            name: 'zahlungsziel_tage', 
            label: 'Zahlungsziel', 
            type: 'select', 
            required: false, 
            placeholder: 'Zahlungsziel auswählen...',
            options: [
              { value: '0', label: 'Sofort' },
              { value: '14', label: '14 Tage' },
              { value: '30', label: '30 Tage' },
              { value: '45', label: '45 Tage' },
              { value: '60', label: '60 Tage' }
            ]
          },
          { name: 're_faelligkeit', label: 'RE-Fälligkeit', type: 'date', required: false },
          { name: 'rechnung_gestellt', label: 'Rechnung gestellt', type: 'toggle', required: false },
          { name: 'rechnung_gestellt_am', label: 'Rechnung gestellt am', type: 'date', required: false, placeholder: 'Datum wann Rechnung gestellt wurde', dependsOn: 'rechnung_gestellt' },
          { name: 'ueberwiesen', label: 'Überwiesen', type: 'toggle', required: false },
          { name: 'ueberwiesen_am', label: 'Überwiesen am', type: 'date', required: false, placeholder: 'Datum wann Zahlung überwiesen wurde', dependsOn: 'ueberwiesen' },
          { name: 'kampagnenanzahl', label: 'Kampagnenanzahl', type: 'number', required: false, validation: { type: 'number', min: 1 } },
          { name: 'start', label: 'Startdatum', type: 'date', required: false },
          { name: 'ende', label: 'Enddatum', type: 'date', required: false },
          { name: 'nettobetrag', label: 'Nettobetrag', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'ust_prozent', label: 'USt (%)', type: 'number', required: false, validation: { type: 'number', min: 0, max: 100 }, readonly: true, defaultValue: 19 },
          { name: 'ust_betrag', label: 'USt Betrag', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['nettobetrag','ust_prozent'] },
          { name: 'bruttobetrag', label: 'Brutto Gesamtbudget', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['nettobetrag','ust_betrag'] }
        ]
      },
      kooperation: {
        title: 'Neue Kooperation anlegen',
        fields: [
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...' },
          { name: 'marke_id', label: 'Marke', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Marke auswählen (optional)...', dependsOn: 'unternehmen_id' },
          { name: 'kampagne_id', label: 'Kampagne', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Kampagne suchen und auswählen...', dependsOn: 'unternehmen_id' },
          { name: 'briefing_id', label: 'Briefing', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Briefing wählen...', dependsOn: 'kampagne_id', table: 'briefings', displayField: 'product_service_offer', valueField: 'id' },
          { name: 'creator_id', label: 'Creator', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Creator suchen und auswählen...', dependsOn: 'kampagne_id' },
          { 
            name: 'name', 
            label: 'Name', 
            type: 'text', 
            required: true, 
            validation: { type: 'text', minLength: 2 },
            autoGenerate: true,
            readonly: true,
            placeholder: 'Wird automatisch generiert...'
          },
          { name: 'skript_autor', label: 'Skript schreibt', type: 'select', required: false, options: ['Brand', 'Creator', 'Agentur'] },
          
          // Einkaufspreis
          { name: 'einkaufspreis_netto', label: 'Einkaufspreis Netto', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'einkaufspreis_zusatzkosten', label: 'Einkaufspreis Zusatzkosten', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'einkaufspreis_ust', label: 'Einkaufspreis USt (19%)', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['einkaufspreis_netto', 'einkaufspreis_zusatzkosten'] },
          { name: 'einkaufspreis_gesamt', label: 'Einkaufspreis Gesamt', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['einkaufspreis_netto', 'einkaufspreis_zusatzkosten', 'einkaufspreis_ust'] },
          
          // Verkaufspreis
          { name: 'verkaufspreis_netto', label: 'Verkaufspreis Netto', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'verkaufspreis_zusatzkosten', label: 'Verkaufspreis Zusatzkosten', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'verkaufspreis_ust', label: 'Verkaufspreis USt (19%)', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['verkaufspreis_netto', 'verkaufspreis_zusatzkosten'] },
          { name: 'verkaufspreis_gesamt', label: 'Verkaufspreis Gesamt', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['verkaufspreis_netto', 'verkaufspreis_zusatzkosten', 'verkaufspreis_ust'] },
          
          { name: 'vertrag_unterschrieben', label: 'Vertrag unterschrieben', type: 'checkbox', required: false },
          { name: 'vertrag_link', label: 'Vertrag Link', type: 'url', required: false, validation: { type: 'url' } },
          { name: 'videoanzahl', label: 'Video Anzahl', type: 'number', required: false, validation: { type: 'number', min: 1 } },
          { name: 'skript_deadline', label: 'Skript Deadline', type: 'date', required: false },
          { name: 'skript_link', label: 'Skript Link', type: 'url', required: false, validation: { type: 'url' } },
          { name: 'content_deadline', label: 'Content Deadline', type: 'date', required: false },
          { name: 'content_art', label: 'Content Art', type: 'select', required: true, options: ['Paid', 'Organisch', 'Influencer', 'Whitelisting', 'Spark-Ad'] },
          
          { name: 'status', label: 'Status', type: 'select', required: true, options: ['Todo', 'In progress', 'Done'] }
                ]
      },
      ansprechpartner: {
        title: 'Neuen Ansprechpartner anlegen',
        fields: [
          { name: 'vorname', label: 'Vorname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          { name: 'nachname', label: 'Nachname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          { name: 'profile_image_file', label: 'Profilbild', type: 'custom', customType: 'uploader', accept: 'image/png,image/jpeg', multiple: false, required: false, maxFileSize: 500 * 1024 },
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
            directQuery: true
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
            relationField: 'marke_id'
          },
          { 
            name: 'position_id', 
            label: 'Position', 
            type: 'select', 
            required: true, 
            options: [], 
            dynamic: true,
            searchable: true,
            placeholder: 'Position suchen und auswählen...',
            table: 'positionen',
            displayField: 'name',
            valueField: 'id',
            directQuery: true
          },
          { name: 'email', label: 'E-Mail', type: 'email', required: false, validation: { type: 'email' } },
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
            dynamic: true
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
            dynamic: true
          },
          { name: 'linkedin', label: 'LinkedIn Profil', type: 'url', required: false, validation: { type: 'url' } },
          { name: 'stadt', label: 'Stadt', type: 'text', required: false },
          { name: 'land', label: 'Land', type: 'text', required: false },
          { name: 'geburtsdatum', label: 'Geburtsdatum', type: 'date', required: false },
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
            customField: true
          },
          { name: 'notiz', label: 'Notizen', type: 'textarea', required: false, rows: 4 }
        ]
      },
      briefing: {
        title: 'Neues Briefing anlegen',
        fields: [
          { name: 'product_service_offer', label: 'Name des Briefings*', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, placeholder: 'Kurzbezeichnung des Briefings' },
          { name: 'produktseite_url', label: 'Produktseite URL', type: 'url', required: false, validation: { type: 'url' } },
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...', table: 'unternehmen', displayField: 'firmenname', valueField: 'id', directQuery: true },
          { name: 'marke_id', label: 'Marke', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Marke suchen und auswählen (optional)...', dependsOn: 'unternehmen_id', table: 'marke', displayField: 'markenname', valueField: 'id' },
          { name: 'kampagne_id', label: 'Kampagne', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Kampagne wählen...', dependsOn: 'unternehmen_id', table: 'kampagne', displayField: 'kampagnenname', valueField: 'id' },
          { name: 'assignee_id', label: 'Zugewiesen an', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Mitarbeiter auswählen...', table: 'benutzer', displayField: 'name', valueField: 'id', directQuery: true },
          { name: 'zielgruppe', label: 'Zielgruppe', type: 'textarea', required: false, rows: 3 },
          { name: 'zieldetails', label: 'Zieldetails', type: 'textarea', required: false, rows: 3 },
          { name: 'creator_aufgabe', label: 'Creator Aufgabe', type: 'textarea', required: false, rows: 4 },
          { name: 'usp', label: 'USPs', type: 'textarea', required: false, rows: 3, placeholder: 'Unique Selling Points, durch Komma getrennt oder als Fließtext' },
          { name: 'must_haves', label: 'Must Haves', type: 'textarea', required: false, rows: 4 },
          { name: 'rechtlicher_hinweis', label: 'Rechtlicher Hinweis', type: 'textarea', required: false, rows: 4 },
          { name: 'documents_files', label: 'Dokumente (PDFs, Bilder)', type: 'custom', customType: 'uploader', accept: 'application/pdf,image/*', multiple: true, required: false, maxFileSize: 10 * 1024 * 1024 }
        ]
      },
      rechnung: {
        title: 'Neue Rechnung anlegen',
        fields: [
          { name: 'rechnung_nr', label: 'Rechnungs-Nr', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          { name: 'po_nummer', label: 'Interne PO-Nummer', type: 'text', required: false, readonly: true, editOnly: true, placeholder: 'Wird automatisch vergeben' },
          { name: 'kooperation_id', label: 'Kooperation', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Kooperation wählen...', table: 'kooperationen', displayField: 'name', valueField: 'id' },
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen wird automatisch gesetzt', readonly: true, table: 'unternehmen', displayField: 'firmenname', valueField: 'id' },
          { name: 'auftrag_id', label: 'Auftrag', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Auftrag wird automatisch gesetzt', readonly: true, table: 'auftrag', displayField: 'auftragsname', valueField: 'id' },
          { name: 'kampagne_id', label: 'Kampagne', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Kampagne wird automatisch gesetzt', readonly: true, table: 'kampagne', displayField: 'kampagnenname', valueField: 'id' },
          { name: 'creator_id', label: 'Creator', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Creator wird automatisch gesetzt', readonly: true, table: 'creator', displayField: 'vorname', valueField: 'id' },
          { name: 'videoanzahl', label: 'Video Anzahl (aus Kooperation)', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'status', label: 'Status', type: 'select', required: true, options: ['Offen', 'Rückfrage', 'Bezahlt', 'An Qonto gesendet'] },
          { name: 'geprueft', label: 'Geprüft', type: 'toggle', required: false },
          { name: 'gestellt_am', label: 'Gestellt am', type: 'date', required: true },
          { name: 'zahlungsziel', label: 'Zahlungsziel', type: 'date', required: true },
          { name: 'bezahlt_am', label: 'Bezahlt am', type: 'date', required: false },
          { name: 'nettobetrag', label: 'Betrag (Netto)', type: 'number', required: true, validation: { type: 'number', min: 0 } },
          { name: 'zusatzkosten', label: 'Zusatzkosten', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'bruttobetrag', label: 'Betrag (Brutto)', type: 'number', required: true, validation: { type: 'number', min: 0 } },
          { name: 'pdf_file', label: 'Rechnungs-PDF', type: 'custom', customType: 'uploader', accept: 'application/pdf', multiple: false, required: false, maxFileSize: 10 * 1024 * 1024 },
          { name: 'belege_files', label: 'Belege (mehrere Dateien)', type: 'custom', customType: 'uploader', accept: 'application/pdf,image/*', multiple: true, required: false, maxFileSize: 10 * 1024 * 1024 }
        ]
      }
    };
    
    return configs[entity] || null;
  }
} 