# Picker laden nur Finalisierte

Auto-Suggest und Searchable-Selects für Briefing, Vertrag und Auftrag zeigen nur Finalisierte. Der Filter sitzt zentral an der Query (`applyFinalisiertFilter`), nicht am Widget — Optionen sind dort schon `{value, label}`. Listen und der eigene Entwurf-Editor bleiben unberührt.

Die frühere Kooperation-Ausnahme (ADR 0004) fällt: Drafts im Picker stiften Verwirrung, egal welche Entity angelegt wird. Memberships an einem Entwurf (z.B. Personas am Briefing) gehören dem Entwurf-Editor; Speichern der anderen Entity fasst sie nicht an.
