# Kundenbriefing hängt an Marke/Unternehmen, nicht nur am Briefing

Das vom Kunden gelieferte PDF (Kundenbriefing) wird im Storage der Marke abgelegt, sonst des Unternehmens. Es ist 1:1 an das Briefing gebunden (`kundenbriefings.briefing_id` UNIQUE), aber die Datei liegt im Ordner der Entität, nicht in einem briefing-eigenen Bucket.

Das Briefing ist das ausgefüllte Formular; das Kundenbriefing ist die Quelle. Wenn das Mapping falsch ist, braucht man das Original am Kunden, nicht in einem temporären Upload-Ordner. Die Anzeige auf der Unternehmens-/Markenseite kommt später — heute gibt es dort keine Dateiliste.

## Considered Options

- **Nur am Briefing speichern** (`documents/campaign-briefings/...`): einfacher, aber die Datei verschwindet im Briefing-Kontext. Bei mehreren Briefings pro Kunde ist unklar, welches PDF zu welchem Kunden gehört.
- **Neuer Bucket**: mehr Setup, kein Gewinn — `documents` hat schon Staff-Policies.

## Consequences

- Storage-Pfad: `kundenbriefings/{marke|unternehmen}/{entityId}/{briefingId}_{ts}_{file}.pdf`.
- `kundenbriefings` hält `entity_type` + `entity_id`, damit die spätere Dateiliste an Marke/Unternehmen ohne Join auf `campaign_briefings` auskommt.
- Ersatz-Upload löscht das alte Storage-Object; es gibt keine Versionierung.
