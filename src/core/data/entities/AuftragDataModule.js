export default {
  config: {
    table: 'auftrag',
    displayField: 'auftragsname',
    fields: {
      auftragsname: 'string',
      unternehmen_id: 'uuid',
      marke_id: 'uuid',
      status: 'string',
      ansprechpartner_id: 'uuid',
      auftragtype: 'string',
      titel: 'string',
      notiz: 'string',
      angebotsnummer: 'string',
      po: 'string',
      externe_po: 'string',
      zahlungsziel_tage: 'number',
      re_nr: 'string',
      re_faelligkeit: 'date',
      erwarteter_monat_zahlungseingang: 'date',
      kampagnenanzahl: 'number',
      start: 'date',
      ende: 'date',
      nettobetrag: 'number',
      ust_prozent: 'number',
      ust_betrag: 'number',
      bruttobetrag: 'number',
      rechnung_gestellt: 'boolean',
      rechnung_gestellt_am: 'date',
      ueberwiesen: 'boolean',
      ueberwiesen_am: 'date',
      created_by_id: 'uuid'
    },
    relations: {
      unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
      marke: { table: 'marke', foreignKey: 'marke_id', displayField: 'markenname' },
      ansprechpartner: { table: 'ansprechpartner', foreignKey: 'ansprechpartner_id', displayField: 'vorname' },
      created_by: { table: 'benutzer', foreignKey: 'created_by_id', displayField: 'name' }
    },
    manyToMany: {
      mitarbeiter: {
        table: 'benutzer',
        junctionTable: 'auftrag_mitarbeiter',
        localKey: 'auftrag_id',
        foreignKey: 'mitarbeiter_id',
        displayField: 'name'
      },
      cutter: {
        table: 'benutzer',
        junctionTable: 'auftrag_cutter',
        localKey: 'auftrag_id',
        foreignKey: 'mitarbeiter_id',
        displayField: 'name'
      },
      copywriter: {
        table: 'benutzer',
        junctionTable: 'auftrag_copywriter',
        localKey: 'auftrag_id',
        foreignKey: 'mitarbeiter_id',
        displayField: 'name'
      },
      kampagne_arten: {
        table: 'kampagne_art_typen',
        junctionTable: 'auftrag_kampagne_art',
        localKey: 'auftrag_id',
        foreignKey: 'kampagne_art_id',
        displayField: 'name'
      }
    },
    filters: ['auftragsname', 'status', 'unternehmen_id', 'marke_id', 'ansprechpartner_id'],
    sortBy: 'created_at',
    sortOrder: 'desc'
  },

  prepareForSupabase(data) {
    if (data && data.brutto_gesamt_budget && !data.bruttobetrag) {
      data.bruttobetrag = data.brutto_gesamt_budget;
    }
    return data;
  },

  skipFieldForSupabase(field, value) {
    if (field === 'art_der_kampagne' || field === 'art_der_kampagne[]') {
      console.log(`🏷️ Verarbeite ${field} für Auftrag:`, value);
      return true;
    }
    return false;
  }
};
