// Formular-Konfiguration fuer "creator"
// Reine Datendatei, wird von FormConfig.js eingesammelt.

// Auch von CreatorFilterConfig.js genutzt, damit Formular und Filter dieselben
// Werte anbieten. Paar/Familie/Tier bilden Accounts ab, hinter denen keine
// einzelne Person steht.
export const GESCHLECHT_OPTIONS = [
  { value: 'männlich', label: 'Männlich' },
  { value: 'weiblich', label: 'Weiblich' },
  { value: 'divers', label: 'Divers' },
  { value: 'paar', label: 'Paar' },
  { value: 'familie', label: 'Familie' },
  { value: 'tier', label: 'Tier-Account' }
];

export const creatorConfig = {
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
    { name: 'ksk_selbstzahler', label: 'KSK zahlt der Creator selbst', type: 'toggle', required: false, defaultValue: false, section: 'basis' },
    { name: 'management_ids', label: 'Management', type: 'multiselect', required: false, options: [], dynamic: true, searchable: true, tagBased: true, placeholder: 'Management suchen und hinzufügen...', table: 'management', displayField: 'firmenname', valueField: 'id', customField: true, section: 'basis' },
    { name: 'firma_ids', label: 'Firmen', type: 'multiselect', required: false, options: [], dynamic: true, searchable: true, tagBased: true, placeholder: 'Firma suchen und hinzufügen...', table: 'firma', displayField: 'firmenname', valueField: 'id', customField: true, section: 'basis' },
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
      options: GESCHLECHT_OPTIONS
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
    // Kinder Toggle + Beschreibung
    { name: 'hat_kinder', label: 'Hat Kinder', type: 'toggle', required: false, section: 'profil' },
    { 
      name: 'kinder_beschreibung', 
      label: 'Kinder Beschreibung', 
      type: 'textarea', 
      required: false,
      dependsOn: 'hat_kinder',
      showWhen: 'true',
      section: 'profil'
    },
    { name: 'telefonnummer', label: 'Telefonnummer', type: 'tel', required: false, validation: { type: 'phone' }, section: 'kontakt' },
    { name: 'mail', label: 'Email', type: 'email', required: false, validation: { type: 'email' }, section: 'kontakt' },
    { name: 'portfolio_link', label: 'Portfolio Link', type: 'url', required: false, validation: { type: 'url' }, section: 'kontakt' },
    { name: 'notiz', label: 'Notizen', type: 'textarea', required: false, section: 'kontakt' }
  ]
};
