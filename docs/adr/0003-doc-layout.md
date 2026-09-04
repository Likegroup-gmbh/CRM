# Geteiltes Doc-Layout für Detail-Formulare

Persona- und Produkt-Detailseite rendern über denselben Worksheet-Renderer (`src/core/doc/DocPage.js`): mittig ein Schreibdokument mit festen Überschriften und frei beschreibbaren Abschnitten, rechts die Liky-Spalte. Vorher war das Worksheet produkt-exklusiv (`ProduktDoc.js`), die Persona nutzte das klassische Box-Formular – zwei Looks, zwei Verhaltensweisen, und die Produkt-Verknüpfung an der Persona (Tag-Multiselect mitten im Formular) wich von der Karten-UI am Produkt ab.

Die Feld-Configs steuern das Layout über `doc*`-Annotationen (`docRole`, `docGroup`, `docSlot`, `docLabel`, `docHint`, `docUnit`, `docList`). Panel-Slots (Einsatzsituationen, Varianten, Personas am Produkt; Produkte an der Persona) stehen als Pseudo-Felder mit `docRole: 'slot'` in der Feldreihenfolge – so ist auch ihre Position config-gesteuert. Verknüpfungen pflegen beide Seiten über dasselbe Karten-Panel-Muster (`.rel-*` in `doc.css`) mit Inline-Suche (`EntitySearchInput`); die Persistenz bleibt unverändert bei `produkt_persona_vorschlag` (ADR 0002).

## Consequences

- Neue Detail-Formulare bekommen das Worksheet, indem sie ihre Config mit `doc*`-Angaben versehen – kein eigenes Seiten-Markup mehr.
- `produkt_ids` ist kein Formularfeld mehr; das Persona-Formular speichert die Produkt-Zuordnung aus dem Panel-Stand via `ProduktPersonaService.saveForPersona` (Diff, unverändert).
- Am Produkt lassen sich Personas jetzt auch manuell anhängen (Inline-Suche neben der KI-Generierung); manuell angehängte Karten laufen als sofort akzeptierte `match`-Karten durch denselben `flushKarte`-Pfad inkl. Marken-Attach.
- CSS ist geteilt: `doc.css` trägt Shell, Sektionen, Inline-Karten, Chat-Spalte und Relation-Karten (`.doc__*`, `.doc-chat__*`, `.rel-*`); `produkt-doc.css` behält nur Produkt-Reste (Einsatzsituationen, Drawer, Read-only-Profil).
- Der Liky-Slot an der Persona ist vorerst strukturell (Composer deaktiviert); die KI-Befüllung der Persona-Felder ist ein eigener Folgeschritt mit Job und Background-Function.
