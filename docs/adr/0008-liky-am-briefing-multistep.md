# Liky-Spalte am Briefing-Multistep, nicht am Doc-Worksheet

Das Briefing-Create bekommt eine feste Liky-Spalte rechts, in die das Kundenbriefing-PDF gezogen wird. Sie hängt am bestehenden Multistep-Generator (`src/modules/briefing/create/`), nicht am Doc-Worksheet aus ADR 0003.

Der Generator hat 109 Felder, drei Bereiche mit eigenen Modul-Steps und Conditional Logic. Ein Umzug auf `DocPage` würde das Formular neu erfinden, nur damit die Spalte kommt. Stattdessen bekommt `renderMultistep()` ab Step 2 eine zweite Spalte; Step 1 (Bereichswahl) bleibt single-column, weil Liky ohne Bereich nichts mappen kann.

## Considered Options

- **Briefing-Create auf DocPage umziehen**: konsistent mit Produkt/Persona, aber 109 Felder + Steps + Conditions müssten in `doc*`-Annotationen gegossen werden. Hoher Umbau, kein fachlicher Gewinn.
- **Liky nur als Button/Toggle**: widerspricht dem Produkt-Pattern (feste Spalte) und dem Ziel, dass das PDF-Drop immer sichtbar ist.

## Consequences

- `.doc-chat__*` aus `doc.css` wird auch am Multistep genutzt; kein eigenes Chat-CSS.
- Apply läuft gegen `formData`, nicht gegen das DOM — nur ein Step ist gerendert, Entity-Selects sind hidden, Repeatables haben kein `name`.
- Die Spalte ist erst ab Step 2 da; vorher gibt es keinen Upload.
