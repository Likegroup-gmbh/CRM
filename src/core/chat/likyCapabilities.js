// likyCapabilities.js
// Zentrale Schalter fuer Liky pro Seite/Entitaet. Eine neue Seite bekommt
// Liky, indem sie hier einen Eintrag anlegt und das Panel mountet -
// abgeschaltet ist ein Feature, indem das Flag umgelegt wird. Nichts davon
// wird in den Seiten selbst hardcodiert.
//
// extract:  'url'  -> Composer nimmt eine Webseiten-Adresse (Produkt-Pattern)
//           'pdf'  -> Composer nimmt ein PDF per Drag & Drop (Briefing)
//           null   -> kein Extract auf dieser Seite
// chat:     true   -> freier Chat nach dem Extract (Rueckfragen, Nachsteuern)
// specFrom: woher die Feld-Spec kommt ('fieldConfig' = clientseitig aus dem
//           Formular-Schema ableiten, 'server' = extract-specs.js)

export const LIKY_CAPABILITIES = {
  unternehmen: { extract: 'url', chat: false, specFrom: 'server' },
  marke: { extract: 'url', chat: false, specFrom: 'server' },
  produkt: { extract: 'url', chat: false, specFrom: 'server' },
  briefing: { extract: 'pdf', chat: true, specFrom: 'fieldConfig' }
};

export function likyCapability(entity) {
  return LIKY_CAPABILITIES[entity] || null;
}

export function likyCanExtractPdf(entity) {
  return likyCapability(entity)?.extract === 'pdf';
}

export function likyHasChat(entity) {
  return likyCapability(entity)?.chat === true;
}
