export default {
  config: {
    table: 'rechnung',
    displayField: 'rechnung_nr',
    fields: {
      rechnung_nr: 'string',
      externe_angebotsnummer: 'string',
      kooperation_id: 'uuid',
      kampagne_id: 'uuid',
      creator_id: 'uuid',
      auftrag_id: 'uuid',
      unternehmen_id: 'uuid',
      videoanzahl: 'number',
      nettobetrag: 'number',
      zusatzkosten: 'number',
      ust_prozent: 'number',
      ust_betrag: 'number',
      bruttobetrag: 'number',
      gestellt_am: 'date',
      zahlungsziel: 'date',
      bezahlt_am: 'date',
      status: 'string',
      geprueft: 'boolean',
      skonto: 'boolean',
      land: 'string',
      pdf_url: 'string',
      pdf_path: 'string',
      vertrag_id: 'uuid',
      created_by_id: 'uuid',
      created_at: 'date',
      updated_at: 'date'
    },
    relations: {
      unternehmen: { table: 'unternehmen', foreignKey: 'unternehmen_id', displayField: 'firmenname' },
      auftrag: { table: 'auftrag', foreignKey: 'auftrag_id', displayField: 'auftragsname' },
      kooperation: { table: 'kooperationen', foreignKey: 'kooperation_id', displayField: 'name' },
      creator: { table: 'creator', foreignKey: 'creator_id', displayField: 'vorname' },
      kampagne: { table: 'kampagne', foreignKey: 'kampagne_id', displayField: 'kampagnenname' },
      created_by: { table: 'benutzer', foreignKey: 'created_by_id', displayField: 'name' },
      vertrag: { table: 'vertraege', foreignKey: 'vertrag_id', displayField: 'name' }
    },
    filters: ['rechnung_nr', 'kooperation_id', 'kampagne_id', 'unternehmen_id', 'auftrag_id', 'status', 'gestellt_am', 'zahlungsziel', 'bezahlt_am', 'nettobetrag', 'land'],
    sortBy: 'zahlungsziel',
    sortOrder: 'asc'
  },

  buildSelectClause(context) {
    return `*,
unternehmen:unternehmen_id (
  id,
  firmenname
),
auftrag:auftrag_id (
  id,
  auftragsname,
  auftrag_details (id)
),
creator:creator_id (
  id,
  vorname,
  nachname
),
kooperation:kooperation_id (
  id,
  name
),
created_by:created_by_id (
  id,
  name,
  profile_image_url
),
vertrag:vertrag_id (
  id,
  name,
  unterschriebener_vertrag_url,
  dropbox_file_url,
  datei_url
)`;
  },

  customOrder(query) {
    return query
      .order('zahlungsziel', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
  },

  transformResult(data) {
    if (!data) return data;
    data.sort((a, b) => {
      const aPaid = a.status === 'Bezahlt' ? 1 : 0;
      const bPaid = b.status === 'Bezahlt' ? 1 : 0;
      if (aPaid !== bPaid) return aPaid - bPaid;

      const aDate = a.zahlungsziel ? new Date(a.zahlungsziel) : new Date('9999-12-31');
      const bDate = b.zahlungsziel ? new Date(b.zahlungsziel) : new Date('9999-12-31');
      if (aDate.getTime() !== bDate.getTime()) return aDate - bDate;

      const aCreated = a.created_at ? new Date(a.created_at) : new Date(0);
      const bCreated = b.created_at ? new Date(b.created_at) : new Date(0);
      return bCreated - aCreated;
    });
    return data;
  }
};
