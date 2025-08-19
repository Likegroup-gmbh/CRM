export class FormConfig {
  getFormConfig(entity) {
    const configs = {
      creator: {
        title: 'Neuen Creator anlegen',
        fields: [
          { name: 'vorname', label: 'Vorname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          { name: 'nachname', label: 'Nachname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          { name: 'instagram', label: 'Instagram', type: 'text', required: false },
          { name: 'instagram_follower', label: 'Instagram Follower', type: 'number', required: false },
          { name: 'tiktok', label: 'TikTok', type: 'text', required: false },
          { name: 'tiktok_follower', label: 'TikTok Follower', type: 'number', required: false },
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
            name: 'branchen_ids',
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
          { name: 'telefonnummer', label: 'Telefonnummer', type: 'tel', required: false, validation: { type: 'phone' } },
          { name: 'mail', label: 'Email', type: 'email', required: false, validation: { type: 'email' } },
          { name: 'portfolio_link', label: 'Portfolio Link', type: 'url', required: false, validation: { type: 'url' } },
          { name: 'lieferadresse_strasse', label: 'Straße', type: 'text', required: false },
          { name: 'lieferadresse_hausnummer', label: 'Hausnummer', type: 'text', required: false },
          { name: 'lieferadresse_plz', label: 'PLZ', type: 'text', required: false },
          { name: 'lieferadresse_stadt', label: 'Stadt', type: 'text', required: false },
          { name: 'lieferadresse_land', label: 'Land', type: 'text', required: false },
          { name: 'notiz', label: 'Notizen', type: 'textarea', required: false }
        ]
      },
      unternehmen: {
        title: 'Neues Unternehmen anlegen',
        fields: [
          { name: 'firmenname', label: 'Firmenname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          { name: 'branchen_ids', label: 'Branchen', type: 'multiselect', required: false, dynamic: true, searchable: true, tagBased: true, placeholder: 'Branchen suchen und hinzufügen...', table: 'branchen', displayField: 'name', valueField: 'id', customField: true },
          { name: 'rechnungsadresse_strasse', label: 'Rechnungsadresse - Straße', type: 'text', required: false },
          { name: 'rechnungsadresse_hausnummer', label: 'Rechnungsadresse - Hausnummer', type: 'text', required: false },
          { name: 'rechnungsadresse_plz', label: 'Rechnungsadresse - PLZ', type: 'text', required: false },
          { name: 'rechnungsadresse_stadt', label: 'Rechnungsadresse - Stadt', type: 'text', required: false },
          { name: 'rechnungsadresse_land', label: 'Rechnungsadresse - Land', type: 'text', required: false },
          { name: 'invoice_email', label: 'Rechnungs-Email', type: 'email', required: false, validation: { type: 'email' } },
          { name: 'webseite', label: 'Webseite', type: 'url', required: false, validation: { type: 'url' } },
          { name: 'status', label: 'Status', type: 'select', required: false, options: ['Aktiv', 'Inaktiv', 'Prospekt'] }
        ]
      },
      kampagne: {
        title: 'Neue Kampagne anlegen',
        fields: [
          { 
            name: 'kampagnenname', 
            label: 'Kampagnenname', 
            type: 'text', 
            required: true, 
            validation: { type: 'text', minLength: 2 },
            autoGenerate: true,
            dependsOn: 'auftrag_id',
            showWhen: 'any',
            readonly: true,
            placeholder: 'Wird automatisch generiert...'
          },
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...' },
          { name: 'marke_id', label: 'Marke', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Marke suchen und auswählen...', dependsOn: 'unternehmen_id', table: 'marke', displayField: 'markenname', valueField: 'id' },
          { name: 'auftrag_id', label: 'Auftrag', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Auftrag suchen und auswählen...', dependsOn: 'marke_id', table: 'auftrag', displayField: 'auftragsname', valueField: 'id' },
          { 
            name: 'mitarbeiter_ids', 
            label: 'Zugehörige Mitarbeiter', 
            type: 'multiselect', 
            required: false, 
            options: [], 
            dynamic: true, 
            searchable: true, 
            tagBased: true, 
            placeholder: 'Mitarbeiter suchen und auswählen...', 
            table: 'benutzer',
            displayField: 'name',
            valueField: 'id',
            relationTable: 'kampagne_mitarbeiter',
            relationField: 'mitarbeiter_id',
            filter: "rolle.eq.Mitarbeiter,rolle.eq.mitarbeiter,rolle.eq.admin",
            directQuery: true
          },
          { 
            name: 'pm_ids', 
            label: 'Projektmanager', 
            type: 'multiselect', 
            required: false, 
            options: [], 
            dynamic: true, 
            searchable: true, 
            tagBased: true, 
            placeholder: 'Projektmanager suchen und auswählen...', 
            table: 'benutzer',
            displayField: 'name',
            valueField: 'id',
            filter: "rolle.eq.Mitarbeiter,rolle.eq.mitarbeiter,rolle.eq.admin",
            directQuery: true,
            customField: true
          },
          { 
            name: 'scripter_ids', 
            label: 'Scripter', 
            type: 'multiselect', 
            required: false, 
            options: [], 
            dynamic: true, 
            searchable: true, 
            tagBased: true, 
            placeholder: 'Scripter suchen und auswählen...', 
            table: 'benutzer',
            displayField: 'name',
            valueField: 'id',
            filter: "rolle.eq.Mitarbeiter,rolle.eq.mitarbeiter,rolle.eq.admin",
            directQuery: true,
            customField: true
          },
          { 
            name: 'cutter_ids', 
            label: 'Cutter', 
            type: 'multiselect', 
            required: false, 
            options: [], 
            dynamic: true, 
            searchable: true, 
            tagBased: true, 
            placeholder: 'Cutter suchen und auswählen...', 
            table: 'benutzer',
            displayField: 'name',
            valueField: 'id',
            filter: "rolle.eq.Mitarbeiter,rolle.eq.mitarbeiter,rolle.eq.admin",
            directQuery: true,
            customField: true
          },
          { name: 'ziele', label: 'Ziele', type: 'textarea', required: false },
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
          { name: 'start', label: 'Startdatum', type: 'date', required: false },
          { name: 'deadline', label: 'Deadline', type: 'date', required: false },
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
            name: 'status',
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
          { name: 'creatoranzahl', label: 'Creator Anzahl', type: 'number', required: false, validation: { type: 'number', min: 1 } },
          { name: 'videoanzahl', label: 'Video Anzahl', type: 'number', required: false, validation: { type: 'number', min: 1 } },
          { name: 'budget_info', label: 'Budget Info', type: 'textarea', required: false }
        ]
      },
      marke: {
        title: 'Neue Marke anlegen',
        fields: [
          { name: 'markenname', label: 'Markenname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...' },
          { name: 'webseite', label: 'Webseite', type: 'url', required: false, validation: { type: 'url' } },
          { name: 'branchen_ids', label: 'Branchen', type: 'multiselect', required: false, dynamic: true, searchable: true, tagBased: true, placeholder: 'Branchen suchen und hinzufügen...', table: 'branchen', displayField: 'name', valueField: 'id', customField: true }
        ]
      },
      auftrag: {
        title: 'Neuen Auftrag anlegen',
        fields: [
          { name: 'auftragsname', label: 'Auftragsname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...' },
          { name: 'marke_id', label: 'Marke', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Marke suchen und auswählen...', dependsOn: 'unternehmen_id', table: 'marke', displayField: 'markenname', valueField: 'id' },
          { name: 'status', label: 'Status', type: 'select', required: false, options: ['Beauftragt', 'In Produktion', 'Abgeschlossen', 'Storniert'] },
          
          // Neue Felder - Rechnungsdetails
          { name: 'po', label: 'PO', type: 'text', required: false, placeholder: 'Purchase Order Nummer...' },
          { name: 're_nr', label: 'RE. Nr', type: 'text', required: false, placeholder: 'Rechnungsnummer...' },
          { name: 're_faelligkeit', label: 'RE-Fälligkeit', type: 'date', required: false },
          
          // Kampagnendetails
          { name: 'kampagnenanzahl', label: 'Kampagnenanzahl', type: 'number', required: false, validation: { type: 'number', min: 1 } },
          { name: 'start', label: 'Startdatum', type: 'date', required: false },
          { name: 'ende', label: 'Enddatum', type: 'date', required: false },
          
          // Budget-Felder (in gewünschter Reihenfolge)
          { name: 'nettobetrag', label: 'Nettobetrag', type: 'number', required: false, validation: { type: 'number', min: 0 }, calculatedFrom: ['influencer','influencer_preis','ugc','ugc_preis','vor_ort_produktion','vor_ort_preis'] },
          { name: 'ust_prozent', label: 'USt (%)', type: 'number', required: false, validation: { type: 'number', min: 0, max: 100 }, readonly: true, defaultValue: 19 },
          { name: 'ust_betrag', label: 'USt Betrag', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['nettobetrag','ust_prozent'] },
          { name: 'brutto_gesamt_budget', label: 'Brutto Gesamtbudget', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['nettobetrag','ust_betrag'] },
          { name: 'deckungsbeitrag_prozent', label: 'Geplanter Deckungsbeitrag (%)', type: 'number', required: false, validation: { type: 'number', min: 0, max: 100 }, placeholder: 'z.B. 20', autoCalculate: true },
          { name: 'deckungsbeitrag_betrag', label: 'Geplanter Deckungsbeitrag (Betrag)', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['deckungsbeitrag_prozent', 'nettobetrag'] },
          { name: 'ksk_betrag', label: 'KSK (5% von Netto)', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['nettobetrag'] },
          { name: 'creator_budget', label: 'Creator Budget', type: 'number', required: false, validation: { type: 'number', min: 0 }, readonly: true, calculatedFrom: ['nettobetrag','ksk_betrag','deckungsbeitrag_betrag','deckungsbeitrag_prozent'] },
          { name: 'budgetverteilung', label: 'Budgetverteilung/Textfeld', type: 'textarea', required: false, placeholder: 'Beschreibung der Budgetverteilung...' },
          
          // Video-Felder – vereinheitlicht
          { name: 'gesamtanzahl_videos', label: 'Gesamtanzahl Videos', type: 'number', required: false, validation: { type: 'number', min: 1 } },
          { name: 'influencer', label: 'Influencer (Stückzahl)', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'influencer_preis', label: 'Influencer (Preis pro Stück, Netto)', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'ugc', label: 'UGC (Stückzahl)', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'ugc_preis', label: 'UGC (Preis pro Stück, Netto)', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'vor_ort_produktion', label: 'Vor Ort Produktion (Stückzahl)', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'vor_ort_preis', label: 'Vor Ort Produktion (Preis pro Stück, Netto)', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          
          // Toggle-Felder
          { name: 'rechnung_gestellt', label: 'Rechnung gestellt', type: 'toggle', required: false },
          { name: 'ueberwiesen', label: 'Überwiesen', type: 'toggle', required: false },
          
          // Mitarbeiter-Zuweisung mit Tag-basierter Mehrfachauswahl
          { name: 'assignee_id', label: 'Mitarbeiter zuweisen', type: 'multiselect', required: false, options: [], dynamic: true, searchable: true, tagBased: true, placeholder: 'Mitarbeiter suchen und auswählen...', table: 'benutzer', displayField: 'name', valueField: 'id' },
          
          // Tag-basierte Mehrfachauswahl
          { name: 'art_der_kampagne', label: 'Art der Kampagne', type: 'multiselect', required: false, options: [], dynamic: true, searchable: true, tagBased: true, table: 'kampagne_art_typen', displayField: 'name', valueField: 'id' },
          { name: 'format_anpassung', label: 'Format Anpassung', type: 'multiselect', required: false, options: [], dynamic: true, searchable: true, tagBased: true, table: 'format_anpassung_typen', displayField: 'name', valueField: 'id' }
        ]
      },
      kooperation: {
        title: 'Neue Kooperation anlegen',
        fields: [
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...' },
          { name: 'kampagne_id', label: 'Kampagne', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Kampagne suchen und auswählen...', dependsOn: 'unternehmen_id' },
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
          { name: 'content_art', label: 'Content Art', type: 'select', required: true, options: ['Paid', 'Organisch', 'Influencer'] },
          { name: 'skript_autor', label: 'Skript schreibt', type: 'select', required: false, options: ['Brand', 'Creator'] },
          { name: 'nettobetrag', label: 'Nettobetrag', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'zusatzkosten', label: 'Zusatzkosten', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'gesamtkosten', label: 'Gesamtkosten', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'vertrag_unterschrieben', label: 'Vertrag unterschrieben', type: 'checkbox', required: false },
          { name: 'vertrag_link', label: 'Vertrag Link', type: 'url', required: false, validation: { type: 'url' } },
          { name: 'videoanzahl', label: 'Video Anzahl', type: 'number', required: false, validation: { type: 'number', min: 1 } },
          { name: 'skript_deadline', label: 'Skript Deadline', type: 'date', required: false },
          { name: 'skript_link', label: 'Skript Link', type: 'url', required: false, validation: { type: 'url' } },
          { name: 'content_deadline', label: 'Content Deadline', type: 'date', required: false },
          
          { name: 'status', label: 'Status', type: 'select', required: true, options: ['Todo', 'In progress', 'Done'] }
                ]
      },
      ansprechpartner: {
        title: 'Neuen Ansprechpartner anlegen',
        fields: [
          { name: 'vorname', label: 'Vorname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          { name: 'nachname', label: 'Nachname', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
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
            dynamic: true,
            searchable: true,
            tagBased: true,
            placeholder: 'Marken suchen und hinzufügen...',
            table: 'marke',
            displayField: 'markenname',
            valueField: 'id',
            customField: true
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
          { name: 'telefonnummer', label: 'Telefonnummer (privat)', type: 'tel', required: false },
          { name: 'telefonnummer_office', label: 'Telefonnummer (Büro)', type: 'tel', required: false },
          { name: 'linkedin', label: 'LinkedIn Profil', type: 'url', required: false, validation: { type: 'url' } },
          { name: 'stadt', label: 'Stadt', type: 'text', required: false },
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
            customField: true
          },
          { name: 'notiz', label: 'Notizen', type: 'textarea', required: false, rows: 4 }
        ]
      },
      briefing: {
        title: 'Neues Briefing anlegen',
        fields: [
          { name: 'product_service_offer', label: 'Produkt/Service/Angebot', type: 'text', required: true, validation: { type: 'text', minLength: 2 }, placeholder: 'Kurzbezeichnung des Produkts/Angebots' },
          { name: 'produktseite_url', label: 'Produktseite URL', type: 'url', required: false, validation: { type: 'url' } },
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen suchen und auswählen...', table: 'unternehmen', displayField: 'firmenname', valueField: 'id', directQuery: true },
          { name: 'marke_id', label: 'Marke', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Marke suchen und auswählen...', dependsOn: 'unternehmen_id', table: 'marke', displayField: 'markenname', valueField: 'id' },
          { name: 'assignee_id', label: 'Zugewiesen an', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Mitarbeiter auswählen...', table: 'benutzer', displayField: 'name', valueField: 'id', directQuery: true },
          { name: 'status', label: 'Status', type: 'select', required: false, options: [ 'active', 'inactive', 'completed', 'cancelled' ] },
          { name: 'deadline', label: 'Deadline', type: 'date', required: false },
          { name: 'zielgruppe', label: 'Zielgruppe', type: 'textarea', required: false, rows: 3 },
          { name: 'zieldetails', label: 'Zieldetails', type: 'textarea', required: false, rows: 3 },
          { name: 'creator_aufgabe', label: 'Creator Aufgabe', type: 'textarea', required: false, rows: 4 },
          { name: 'usp', label: 'USPs', type: 'textarea', required: false, rows: 3, placeholder: 'Unique Selling Points, durch Komma getrennt oder als Fließtext' },
          { name: 'dos', label: 'Do’s', type: 'textarea', required: false, rows: 3 },
          { name: 'donts', label: 'Don’ts', type: 'textarea', required: false, rows: 3 },
          { name: 'rechtlicher_hinweis', label: 'Rechtlicher Hinweis', type: 'textarea', required: false, rows: 4 }
        ]
      },
      rechnung: {
        title: 'Neue Rechnung anlegen',
        fields: [
          { name: 'rechnung_nr', label: 'Rechnungs-Nr', type: 'text', required: true, validation: { type: 'text', minLength: 2 } },
          { name: 'kooperation_id', label: 'Kooperation', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Kooperation wählen...', table: 'kooperationen', displayField: 'name', valueField: 'id' },
          { name: 'unternehmen_id', label: 'Unternehmen', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Unternehmen wird automatisch gesetzt', readonly: true },
          { name: 'auftrag_id', label: 'Auftrag', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Auftrag wird automatisch gesetzt', readonly: true },
          { name: 'kampagne_id', label: 'Kampagne', type: 'select', required: true, options: [], dynamic: true, searchable: true, placeholder: 'Kampagne wird automatisch gesetzt', readonly: true },
          { name: 'creator_id', label: 'Creator', type: 'select', required: false, options: [], dynamic: true, searchable: true, placeholder: 'Creator wird automatisch gesetzt', readonly: true },
          { name: 'videoanzahl', label: 'Video Anzahl (aus Kooperation)', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'status', label: 'Status', type: 'select', required: true, options: ['Offen', 'Rückfrage', 'Bezahlt', 'An Qonto gesendet'] },
          { name: 'geprueft', label: 'Geprüft', type: 'toggle', required: false },
          { name: 'gestellt_am', label: 'Gestellt am', type: 'date', required: true },
          { name: 'zahlungsziel', label: 'Zahlungsziel', type: 'date', required: true },
          { name: 'bezahlt_am', label: 'Bezahlt am', type: 'date', required: false },
          { name: 'nettobetrag', label: 'Betrag (Netto)', type: 'number', required: true, validation: { type: 'number', min: 0 } },
          { name: 'zusatzkosten', label: 'Zusatzkosten', type: 'number', required: false, validation: { type: 'number', min: 0 } },
          { name: 'bruttobetrag', label: 'Betrag (Brutto)', type: 'number', required: true, validation: { type: 'number', min: 0 } },
          { name: 'pdf_file', label: 'Rechnungs-PDF', type: 'custom', customType: 'uploader', accept: 'application/pdf', multiple: false, required: false },
          { name: 'belege_files', label: 'Belege (mehrere Dateien)', type: 'custom', customType: 'uploader', accept: 'application/pdf,image/*', multiple: true, required: false }
        ]
      }
    };
    
    return configs[entity] || null;
  }
} 