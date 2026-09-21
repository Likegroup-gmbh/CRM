// likyCapabilities.js
// Zentrale Schalter fuer Liky pro Seite/Entitaet. Eine neue Seite bekommt
// Liky, indem sie hier einen Eintrag anlegt und das Panel mountet -
// abgeschaltet ist ein Feature, indem das Flag umgelegt wird. Nichts davon
// wird in den Seiten selbst hardcodiert.
//
// extract:  'url' | 'pdf' | ['url','pdf'] | null
//           String oder Liste - Persona hat beides, Briefing nur PDF.
//           Abschalten: den Eintrag aus der Liste nehmen bzw. auf null setzen.
// chat:     true   -> freier Chat nach dem Extract (Rueckfragen, Nachsteuern)
// specFrom: woher die Feld-Spec kommt ('fieldConfig' = clientseitig aus dem
//           Formular-Schema ableiten, 'server' = extract-specs.js)

export const LIKY_CAPABILITIES = {
  unternehmen: { extract: 'url', chat: false, specFrom: 'server' },
  marke: { extract: 'url', chat: false, specFrom: 'server' },
  produkt: { extract: 'url', chat: false, specFrom: 'server' },
  persona: { extract: ['url', 'pdf'], chat: true, specFrom: 'server' },
  briefing: { extract: 'pdf', chat: true, specFrom: 'fieldConfig' }
};

export function likyCapability(entity) {
  return LIKY_CAPABILITIES[entity] || null;
}

function likyExtractModes(entity) {
  const raw = likyCapability(entity)?.extract;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export function likyCanExtractUrl(entity) {
  return likyExtractModes(entity).includes('url');
}

export function likyCanExtractPdf(entity) {
  return likyExtractModes(entity).includes('pdf');
}

export function likyHasChat(entity) {
  return likyCapability(entity)?.chat === true;
}
