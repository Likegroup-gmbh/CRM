// briefingEinreichungen.js
// Briefing-Seite des zentralen Eingangs (EinreichungInbox, ADR 0055): offene Einreichungen
// stehen auf dem Briefing-Tab der Produktion, nicht in der Briefing-Liste. Der Zähler hängt am
// Tab "Briefing".

import { mountEinreichungInbox, syncEinreichungsZaehler } from './EinreichungInbox.js';

/** Filter des Briefing-Eingangs: die Produktion im Workflow-Modus, sonst nichts. */
export function briefingEinreichungFilter(detail) {
  if (detail?.mode !== 'workflow' || !detail.produktionId) return null;
  return { produktionId: detail.produktionId };
}

export function mountBriefingEinreichungen(detail, host) {
  return mountEinreichungInbox({
    art: 'briefing',
    host,
    filter: briefingEinreichungFilter(detail),
    reviewKontext: { kampagneId: detail.kampagneId },
    tabBadge: true
  });
}

/** Nur den Zähler aktualisieren (z. B. wenn der Briefing-Tab nicht offen ist). */
export function syncBriefingZaehler(detail) {
  return syncEinreichungsZaehler('briefing', briefingEinreichungFilter(detail));
}
