// ListSearchConfig.js
// Zentrale Konfiguration der durchsuchbaren Felder pro Entity fuer die Listen-Suche.
// Nur Text/ID-Spalten — keine Daten, Betraege, Booleans, FK-IDs.

export const LIST_SEARCH_CONFIG = {
  unternehmen: {
    fields: ['firmenname', 'internes_kuerzel', 'webseite', 'invoice_email'],
    relations: [
      { table: 'marke', fk: 'unternehmen_id', fields: ['markenname'] }
    ]
  },
  auftrag: {
    fields: ['auftragsname', 'po', 'externe_po', 're_nr', 'angebotsnummer'],
    relations: [
      { table: 'unternehmen', via: 'unternehmen_id', fields: ['firmenname'] },
      { table: 'marke', via: 'marke_id', fields: ['markenname'] }
    ]
  },
  kampagne: {
    fields: ['kampagnenname', 'eigener_name', 'kampagne_typ']
  },
  creator: {
    fields: ['vorname', 'nachname', 'instagram', 'tiktok', 'mail']
  },
  marke: {
    fields: ['markenname', 'webseite'],
    relations: [
      { table: 'unternehmen', via: 'unternehmen_id', fields: ['firmenname'] }
    ]
  },
  ansprechpartner: {
    fields: ['vorname', 'nachname', 'email', 'telefonnummer', 'linkedin']
  },
  produkt: {
    fields: ['name', 'url', 'kernbotschaft']
  },
  contracts: {
    fields: ['auftragsname', 'angebotsnummer', 'po', 'externe_po'],
    relations: [
      { table: 'unternehmen', via: 'unternehmen_id', fields: ['firmenname'] },
      { table: 'marke', via: 'marke_id', fields: ['markenname'] }
    ]
  },
  auftragsdetails: {
    fields: ['po', 'externe_po'],
    relations: [
      { table: 'auftrag', via: 'auftrag_id', fields: ['auftragsname'] },
      { table: 'unternehmen', via: 'unternehmen_id', fields: ['firmenname'] },
      { table: 'marke', via: 'marke_id', fields: ['markenname'] }
    ]
  },
  rechnung: {
    fields: ['rechnung_nr', 'po_nummer'],
    relations: [
      { table: 'auftrag', via: 'auftrag_id', fields: ['auftragsname'] },
      { table: 'unternehmen', via: 'unternehmen_id', fields: ['firmenname'] }
    ]
  },
  management: {
    fields: ['firmenname', 'stadt', 'email']
  }
};

/**
 * Gibt die Such-Config fuer einen Entity-Typ zurueck.
 * Fallback auf ['name'] wenn kein Eintrag existiert.
 */
export function getSearchConfig(entityType) {
  return LIST_SEARCH_CONFIG[entityType] || { fields: ['name'] };
}
