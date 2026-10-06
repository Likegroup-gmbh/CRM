# 0043 Formulare kehren zur Herkunft zurück

Nach Anlegen oder Bearbeiten landete man auf einer festen Route: der SubmitGuard schickte jedes `created` auf die Liste (`/${entity}`), Module navigierten hart auf Liste oder Detail, das Briefing immer in die Produktion. Wer aus einer Produktion oder Kampagne heraus etwas anlegte, verlor seinen Ort. Zudem leerte `nextTrail` den Klickpfad genau beim Anlegen (Liste → `/x/new`, `/projekt-erstellen` ohne ID), sodass `backTarget` nie greifen konnte.

## Entscheidung

- Formular-Routen (`isFormRoute`): Pfad mit Segment `new` oder `edit` hinter dem ersten Segment, plus `/projekt-erstellen`. Beim Navigieren dorthin hält `nextTrail` immer den Schnappschuss der verlassenen Seite (Liste inkl. Filter, Detail inkl. Tab).
- Speichern und Abbrechen laufen über `navigateBack(fallback)`: auf einer Formular-Route die letzte Pfad-Ebene, sonst der Fallback. Der Fallback ist das bisherige feste Ziel und greift nur ohne Pfad (neuer Tab, geteilter Link). Seiten, die selbst Formular sind (Persona, Produkt), nutzen `returnTo(backTarget(...))`.
- Der Rücksprung ersetzt den History-Eintrag (`window.navigateReplace`), damit Browser-Zurück nicht im ausgefüllten Formular landet.
- SubmitGuard navigiert nur noch auf Opt-in (`detail.redirect`) und nur auf Formular-Routen, für `created` und `updated`. FormSystem setzt das Flag bei Seitenformularen; Wizard, Drawer, Inline-Edits und Module mit eigener Navigation lösen keinen Sprung mehr aus.
- Inline-Templates (`onclick`) rufen `window.navigateBack(fallback)`.

## Ausnahmen

Skript-Stub, Tabelle, Casting-Liste und Konzept öffnen nach dem Anlegen das neue Detail, weil die Arbeit dort erst beginnt. Der Pfad bleibt erhalten, die Breadcrumb führt zur Herkunft zurück. Drawer und Modals, die direkt auf der Seite anlegen, navigieren nicht.

## Folgen

- Briefing aus der Produktion → zurück in die Produktion; aus Liste/Detail → zurück dorthin (Fallback: Briefing-Detail).
- Projekt bearbeiten aus der Kampagne → zurück in die Kampagne statt in den Auftrag.
- Doppelte Navigationen (Creator, Kampagne: Event + eigenes `navigateTo`; Wizard: SubmitGuard + eigenes Ziel) entfallen.
