export class FormConfig {
  getFormConfig(entity) {
    const configs = {
      creator: {
        title: 'Neuen Creator anlegen',
        fields: [
          // Name in einer Zeile
          { name: 'vorname', label: 'Vorname', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, row: 'name', colSize: 'grow', section: 'basis' },
          { name: 'nachname', label: 'Nachname', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, row: 'name', colSize: 'grow', section: 'basis' },
          // Lieferadresse gruppiert
          { name: 'lieferadresse_strasse', label: 'Straße', type: 'text', required: false, row: 'lieferadresse1', colSize: 'grow', section: 'basis' },
          { name: 'lieferadresse_hausnummer', label: 'Nr.', type: 'text', required: false, row: 'lieferadresse1', colSize: 'small', section: 'basis' },
          { name: 'lieferadresse_plz', label: 'PLZ', type: 'text', required: false, row: 'lieferadresse2', colSize: 'small', section: 'basis' },
          { name: 'lieferadresse_stadt', label: 'Stadt', type: 'text', required: false, row: 'lieferadresse2', colSize: 'grow', section: 'basis' },
          { name: 'lieferadresse_land', label: 'Land', type: 'text', required: false, defaultValue: 'Deutschland', section: 'basis' },
          // Toggle: Rechnungsadresse abweichend
          { name: 'rechnungsadresse_abweichend', label: 'Rechnungsadresse abweichend von Lieferadresse', type: 'toggle', required: false, section: 'basis' },
          // Rechnungsadresse (nur wenn Toggle aktiv)
          { name: 'rechnungsadresse_strasse', label: 'Straße (Rechnung)', type: 'text', required: false, row: 'rechnungsadresse1', colSize: 'grow', dependsOn: 'rechnungsadresse_abweichend', showWhen: 'true', section: 'basis' },
          { name: 'rechnungsadresse_hausnummer', label: 'Nr.', type: 'text', required: false, row: 'rechnungsadresse1', colSize: 'small', dependsOn: 'rechnungsadresse_abweichend', showWhen: 'true', section: 'basis' },
          { name: 'rechnungsadresse_plz', label: 'PLZ', type: 'text', required: false, row: 'rechnungsadresse2', colSize: 'small', dependsOn: 'rechnungsadresse_abweichend', showWhen: 'true', section: 'basis' },
          { name: 'rechnungsadresse_stadt', label: 'Stadt', type: 'text', required: false, row: 'rechnungsadresse2', colSize: 'grow', dependsOn: 'rechnungsadresse_abweichend', showWhen: 'true', section: 'basis' },
          { name: 'rechnungsadresse_land', label: 'Land (Rechnung)', type: 'text', required: false, defaultValue: 'Deutschland', dependsOn: 'rechnungsadresse_abweichend', showWhen: 'true', section: 'basis' },
          { name: 'umsatzsteuerpflichtig', label: 'Umsatzsteuerpflichtig', type: 'toggle', required: false, defaultValue: true, section: 'basis' },
          // Agentur-Vertretung
          { name: 'agentur_vertreten', label: 'Wird der Creator durch eine Agentur vertreten?', type: 'toggle', required: false, section: 'basis' },
          { name: 'agentur_name', label: 'Agenturname', type: 'text', required: false, dependsOn: 'agentur_vertreten', showWhen: 'true', placeholder: 'Name der Agentur', section: 'basis' },
          { name: 'agentur_adresse', label: 'Agenturadresse', type: 'text', required: false, dependsOn: 'agentur_vertreten', showWhen: 'true', placeholder: 'Straße, PLZ Stadt', section: 'basis' },
          { name: 'agentur_vertretung', label: 'Vertreten durch', type: 'text', required: false, dependsOn: 'agentur_vertreten', showWhen: 'true', placeholder: 'Name des Vertreters', section: 'basis' },
          // Social Media
          { name: 'instagram', label: 'Instagram', type: 'text', required: false, row: 'social_instagram', section: 'social' },
          { 
            name: 'instagram_follower', 
            label: 'Instagram Follower', 
            type: 'select', 
            required: false,
            row: 'social_instagram',
            section: 'social',
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
          { name: 'tiktok', label: 'TikTok', type: 'text', required: false, row: 'social_tiktok', section: 'social' },
          { 
            name: 'tiktok_follower', 
            label: 'TikTok Follower', 
            type: 'select', 
            required: false,
            row: 'social_tiktok',
            section: 'social',
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
            customField: true,
            section: 'profil'
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
            customField: true,
            section: 'profil'
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
            customField: true,
            section: 'profil'
          },
          // Persönliche Infos
          { 
            name: 'geschlecht', 
            label: 'Geschlecht', 
            type: 'select', 
            required: false,
            section: 'profil',
            options: [
              { value: 'männlich', label: 'Männlich' },
              { value: 'weiblich', label: 'Weiblich' },
              { value: 'divers', label: 'Divers' }
            ]
          },
          { name: 'alter_min', label: 'Alter von', type: 'number', required: false, row: 'alter', colSize: 'grow', section: 'profil' },
          { name: 'alter_max', label: 'Alter bis', type: 'number', required: false, row: 'alter', colSize: 'grow', section: 'profil' },
          // Haustier Toggle + Beschreibung
          { name: 'hat_haustier', label: 'Hat Haustier', type: 'toggle', required: false, section: 'profil' },
          { 
            name: 'haustier_beschreibung', 
            label: 'Haustier Beschreibung', 
            type: 'textarea', 
            required: false,
            dependsOn: 'hat_haustier',
            showWhen: 'true',
            section: 'profil'
          },
          { name: 'telefonnummer', label: 'Telefonnummer', type: 'tel', required: false, validation: { type: 'phone' }, section: 'kontakt' },
          { name: 'mail', label: 'Email', type: 'email', required: false, validation: { type: 'email' }, section: 'kontakt' },
          { name: 'portfolio_link', label: 'Portfolio Link', type: 'url', required: false, validation: { type: 'url' }, section: 'kontakt' },
          { name: 'notiz', label: 'Notizen', type: 'textarea', required: false, section: 'kontakt' }
        ]
      },
      unternehmen: {
        title: 'Neues Unternehmen anlegen',
        fields: [
          // Section: Stammdaten - Firmenname, Kürzel, Adresse
          { name: 'firmenname', label: 'Firmenname', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, section: 'stammdaten' },
          { name: 'internes_kuerzel', label: 'Internes Kürzel', type: 'text', required: false, placeholder: 'z.B. ABC', section: 'stammdaten' },
          { name: 'rechnungsadresse_strasse', label: 'Straße', type: 'text', required: false, row: 'adresse1', colSize: 'grow', section: 'stammdaten' },
          { name: 'rechnungsadresse_hausnummer', label: 'Nr.', type: 'text', required: false, row: 'adresse1', colSize: 'small', section: 'stammdaten' },
          { name: 'rechnungsadresse_plz', label: 'PLZ', type: 'text', required: false, row: 'adresse2', colSize: 'small', section: 'stammdaten' },
          { name: 'rechnungsadresse_stadt', label: 'Stadt', type: 'text', required: false, row: 'adresse2', colSize: 'grow', section: 'stammdaten' },
          { name: 'rechnungsadresse_land', label: 'Land', type: 'text', required: false, defaultValue: 'Deutschland', section: 'stammdaten' },
          // Section: Online - Webseite, Logo
          { name: 'webseite', label: 'Webseite', type: 'url', required: false, placeholder: 'https://...', section: 'online' },
          { name: 'logo_file', label: 'Logo', type: 'custom', customType: 'uploader', accept: 'image/png,image/jpeg', multiple: false, required: false, maxFileSize: 200 * 1024, section: 'online' },
          // Section: Team - Branchen, Management, Lead-Mitarbeiter, Mitarbeiter
          { name: 'branche_id', label: 'Branchen', type: 'multiselect', required: false, dynamic: true, searchable: true, tagBased: true, placeholder: 'Branche suchen und hinzufügen...', table: 'branchen', displayField: 'name', valueField: 'id', relationTable: 'unternehmen_branchen', relationField: 'branche_id', section: 'team' },
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
            filterNoKunden: true,
            filterByKlasse: 'Management',
            section: 'team'
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
            filterNoKunden: true,
            filterByKlasse: 'Lead',
            section: 'team'
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
            filterNoKunden: true,
            filterByKlasse: ['Projektmanagement', 'Strategie', 'Copywriter', 'Cutter'],
            section: 'team'
          },
          // Sonstige Felder ohne Section
          { name: 'invoice_email', label: 'Rechnungs-Email', type: 'email', required: false, validation: { type: 'email' } },
          { name: 'status', label: 'Status', type: 'select', required: false, editOnly: true, options: ['Aktiv', 'Inaktiv', 'Prospekt'] }
        ]
      },
      kampagne: {
        title: 'Neue Kampagne anlegen',
        fields: [
          { 
            name: 'eigener_name', 
            label: 'Eigener Name', 
            type: 'text', 
            required: false,
            placeholder: 'Optional: Eigenen Kampagnennamen eingeben...'
          },
          { 
            name: 'kampagnenname', 
            label: 'Auto-Kampagnenname', 
            type: 'text', 
            required: false, // Nicht required da automatisch generiert
            validation: { type: 'text', minLength: 2, skipIfAutoGenerated: true },
            autoGenerate: true,
            dependsOn: 'auftrag_id',
            showWhen: 'any',
            readonlyExceptEdit: true,
            placeholder: 'Wird automatisch generiert...'
          },
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...', table: 'unternehmen', displayField: 'firmenname', valueField: 'id' },
          { name: 'marke_id', label: 'Marke', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Marke suchen und auswählen...', dependsOn: 'unternehmen_id', table: 'marke', displayField: 'markenname', valueField: 'id' },
          { name: 'auftrag_id', label: 'Auftrag', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Auftrag suchen und auswählen...', dependsOn: 'unternehmen_id', table: 'auftrag', displayField: 'auftragsname', valueField: 'id', filterByMarke: true },
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
          // Deadline-Felder Gruppe (3x2 Grid)
          { name: 'deadline_briefing', label: 'Deadline Briefing', type: 'date', required: false, twoCol: true },
          { name: 'deadline_strategie', label: 'Deadline Strategie', type: 'date', required: false, twoCol: true },
          { name: 'deadline_skripte', label: 'Deadline Skripte', type: 'date', required: false, twoCol: true },
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
          // 1. Markenname
          { name: 'markenname', label: 'Markenname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          // 2. Unternehmen in eigener Section
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...', table: 'unternehmen', displayField: 'firmenname', valueField: 'id', section: 'unternehmen' },
          // 3. Logo und Webseite in Section
          { name: 'logo_file', label: 'Logo', type: 'custom', customType: 'uploader', accept: 'image/png,image/jpeg', multiple: false, required: false, maxFileSize: 200 * 1024, section: 'online' },
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
      },
      auftrag: {
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
          { name: 'erwarteter_monat_zahlungseingang', label: 'Erwarteter Zahlungseingang', type: 'date', required: true, placeholder: 'Erwartetes Datum des Zahlungseingangs', row: 'zahlung', section: 'details' },
          { name: 're_faelligkeit', label: 'RE-Fälligkeit', type: 'date', required: false, section: 'details' },
          { name: 'start', label: 'Startdatum', type: 'date', required: false, row: 'zeitraum', section: 'details' },
          { name: 'ende', label: 'Enddatum', type: 'date', required: false, row: 'zeitraum', section: 'details' },
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
          { name: 'einkaufspreis_ust_prozent', type: 'hidden', defaultValue: 19 },
          { name: 'einkaufspreis_ust', label: 'Einkaufspreis USt (19%)', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['einkaufspreis_netto', 'einkaufspreis_zusatzkosten', 'einkaufspreis_ust_prozent'] },
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
          // Section: Person - Persönliche Daten
          { name: 'vorname', label: 'Vorname', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, row: 'name', section: 'person' },
          { name: 'nachname', label: 'Nachname', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, row: 'name', section: 'person' },
          { name: 'profile_image_file', label: 'Profilbild', type: 'custom', customType: 'uploader', accept: 'image/png,image/jpeg', multiple: false, required: false, maxFileSize: 500 * 1024, section: 'person' },
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
          { name: 'land', label: 'Land', type: 'text', required: false, row: 'ort', section: 'kontakt' },
          // Ohne Section (am Ende) - Einwilligungen, Notizen
          { name: 'erlaubt_newsletter', label: 'Newsletter (1x/Monat)', type: 'toggle', required: false },
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
      produkt: {
        title: 'Neues Produkt anlegen',
        fields: [
          { name: 'name', label: 'Produkt-Name', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
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
            required: true, 
            options: [], 
            dynamic: true, 
            searchable: true, 
            placeholder: 'Marke suchen und auswählen...', 
            dependsOn: 'unternehmen_id', 
            table: 'marke', 
            displayField: 'markenname', 
            valueField: 'id' 
          },
          { name: 'url', label: 'Produkt-URL / Referenz', type: 'url', required: false, validation: { type: 'url' }, placeholder: 'https://...' },
          { name: 'kernbotschaft', label: 'Kernbotschaft (1 Satz)', type: 'textarea', required: true, rows: 2, placeholder: 'Was soll hängen bleiben?' },
          { name: 'hauptproblem', label: 'Hauptproblem, das das Produkt löst', type: 'textarea', required: true, rows: 3 },
          { name: 'kernnutzen', label: 'Kernnutzen (größter Vorteil)', type: 'textarea', required: false, rows: 3 },
          // USPs als separate Felder
          { name: 'usp_1', label: 'USP / Schwerpunkt 1', type: 'text', required: false, row: 'usps', colSize: 'grow' },
          { name: 'usp_2', label: 'USP / Schwerpunkt 2', type: 'text', required: false, row: 'usps', colSize: 'grow' },
          { name: 'usp_3', label: 'USP / Schwerpunkt 3', type: 'text', required: false, row: 'usps', colSize: 'grow' },
          // Pflicht-Elemente als Tags
          {
            name: 'pflicht_elemente_ids',
            label: 'Pflicht-Elemente im Content',
            type: 'multiselect',
            required: false,
            options: [],
            dynamic: true,
            searchable: true,
            tagBased: true,
            allowCreate: true,
            placeholder: 'Pflicht-Elemente suchen oder erstellen...',
            table: 'pflicht_elemente_typen',
            displayField: 'name',
            valueField: 'id',
            relationTable: 'produkt_pflicht_elemente',
            relationField: 'pflicht_element_id',
            directQuery: true
          },
          // No-Gos als Tags
          {
            name: 'no_go_ids',
            label: 'No-Gos / Tabus',
            type: 'multiselect',
            required: false,
            options: [],
            dynamic: true,
            searchable: true,
            tagBased: true,
            allowCreate: true,
            placeholder: 'No-Gos suchen oder erstellen...',
            table: 'no_go_typen',
            displayField: 'name',
            valueField: 'id',
            relationTable: 'produkt_no_gos',
            relationField: 'no_go_id',
            directQuery: true
          },
          { name: 'kauf_conversion_trigger', label: 'Kauf- & Conversion-Trigger', type: 'textarea', required: false, rows: 3, placeholder: 'Warum jetzt kaufen?' },
          { name: 'zielnutzer_anwendungskontext', label: 'Zielnutzer / Anwendungskontext', type: 'textarea', required: false, rows: 3, placeholder: 'Wer nutzt es, wann?' }
        ]
      },
      rechnung: {
        title: 'Neue Rechnung anlegen',
        fields: [
          { name: 'po_nummer', label: 'Interne PO-Nummer', type: 'text', required: false, readonly: true, editOnly: true, placeholder: 'Wird automatisch vergeben' },
          { name: 'externe_angebotsnummer', label: 'Externe Angebotsnummer', type: 'text', required: false, placeholder: 'Angebotsnummer aus Kundenangebot...' },
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
          // Eingabefelder
          { name: 'nettobetrag', label: 'Betrag (Netto)', type: 'number', required: true, validation: { type: 'number', min: 0 } },
          { name: 'zusatzkosten', label: 'Zusatzkosten (Netto)', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'ust_prozent', label: 'Umsatzsteuer (%)', type: 'number', required: false, readonly: true, defaultValue: 19, suffix: '%' },
          { name: 'skonto', label: '3% Skonto berücksichtigen', type: 'toggle', required: false },
          // Berechnete Ergebnis-Felder (readonly)
          { name: 'netto_gesamt', label: 'Netto gesamt (vor Skonto)', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 } },
          { name: 'brutto_vor_skonto', label: 'Brutto gesamt (vor Skonto)', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 } },
          { name: 'skonto_betrag', label: 'Skonto (3%)', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 } },
          { name: 'netto_nach_skonto', label: 'Netto nach Skonto', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 } },
          { name: 'ust_betrag', label: 'Umsatzsteuerbetrag', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 } },
          { name: 'bruttobetrag', label: 'Betrag (Brutto)', type: 'number', required: false, readonly: true, validation: { type: 'number', min: 0 } },
          { name: 'land', label: 'Land', type: 'text', required: false, placeholder: 'z.B. Deutschland' },
          // Uploads
          { name: 'pdf_file', label: 'Rechnungs-PDF', type: 'custom', customType: 'uploader', accept: 'application/pdf', multiple: false, required: false, maxFileSize: 10 * 1024 * 1024 },
          { name: 'belege_files', label: 'Belege (mehrere Dateien)', type: 'custom', customType: 'uploader', accept: 'application/pdf,image/*', multiple: true, required: false, maxFileSize: 10 * 1024 * 1024 }
        ]
      },
      sourcing: {
        title: 'Neue Creator-Auswahl anlegen',
        fields: [
          { 
            name: 'name', 
            label: 'Name', 
            type: 'text', 
            required: false, 
            autoGenerate: true,
            readonly: true,
            placeholder: 'Wird automatisch generiert...',
            validation: { type: 'text', minLength: 2, skipIfAutoGenerated: true }
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
      },
      strategie: {
        title: 'Neue Strategie anlegen',
        fields: [
          { 
            name: 'name', 
            label: 'Name', 
            type: 'text', 
            required: false, 
            autoGenerate: true,
            readonly: true,
            placeholder: 'Wird automatisch generiert...',
            validation: { type: 'text', minLength: 2, skipIfAutoGenerated: true }
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
      }
    };
    
    return configs[entity] || null;
  }
} 