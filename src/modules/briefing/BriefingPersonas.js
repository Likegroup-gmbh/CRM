// BriefingPersonas.js
// Personas fuer die Briefing-Auswahl: alle des Unternehmens (Marke filtert),
// akzeptierte Produkt-Personas zuerst.

import { PersonaService } from '../persona/PersonaService.js';

function personaLabel(p) {
  if (!p) return '';
  return p.oberbegriff ? `${p.oberbegriff} (${p.name})` : (p.name || p.id);
}

function isAcceptedForProdukte(persona, produktIds) {
  if (!produktIds?.length) return false;
  const wanted = new Set(produktIds);
  return (persona.produkte || []).some(link =>
    wanted.has(link.produkt_id) && link.status === 'accepted'
  );
}

export async function loadPersonasForBriefing(unternehmenId, markeId = null, produktIds = []) {
  if (!unternehmenId || !window.supabase) return [];
  const rows = await PersonaService.loadForContext({ unternehmenId, markeId });
  const ids = [...new Set((produktIds || []).filter(Boolean))];
  return [...rows]
    .sort((a, b) => {
      const aHit = isAcceptedForProdukte(a, ids) ? 0 : 1;
      const bHit = isAcceptedForProdukte(b, ids) ? 0 : 1;
      if (aHit !== bHit) return aHit - bHit;
      return personaLabel(a).localeCompare(personaLabel(b), 'de');
    })
    .map(p => ({ id: p.id, label: personaLabel(p), name: p.name }));
}
