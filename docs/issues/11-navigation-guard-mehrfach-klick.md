# Navigation Guard: Mehrfach-Klick-Schutz

## Parent PRD

`docs/PRD-kampagne-performance-optimierung.md`

## What to build

Ein Lock-Mechanismus in `ModuleRegistry.navigateTo()` (src/main.js), der verhindert, dass mehrfaches Klicken auf einen Kampagnennamen (oder jeden anderen Navigationslink) das System aufhängt. Aktuell startet jeder Klick einen vollen `init()`-Zyklus des Zielmoduls, was bei 3-4 Klicks zu parallelen, konkurrierenden Initialisierungen führt.

End-to-end:
- `_isNavigating`-Flag in `ModuleRegistry.navigateTo()` einführen
- Wenn Flag gesetzt: weitere `navigateTo()`-Aufrufe sofort ignorieren (early return)
- Flag im `finally`-Block zurücksetzen (egal ob Erfolg oder Fehler)
- Visuelles Feedback beim Klick: CSS-Klasse auf das angeklickte Element setzen (z.B. reduzierte Opacity, `cursor: wait`), damit der User sieht "es passiert was"
- Test: `NavigationGuard.test.js`

## Acceptance criteria

- [ ] Zweiter `navigateTo()`-Aufruf während laufender Navigation wird ignoriert (kein doppelter `init()`)
- [ ] Nach Abschluss der Navigation funktioniert der nächste Klick normal
- [ ] Bei Fehler während Navigation wird das Flag korrekt zurückgesetzt
- [ ] Visuelles Feedback zeigt dem User sofort, dass die Navigation gestartet wurde
- [ ] Test `NavigationGuard.test.js` deckt alle drei Szenarien ab (Lock, Reset nach Erfolg, Reset nach Fehler)

## Blocked by

None - kann sofort starten.

## User stories addressed

- User Story 5: Sofortiges visuelles Feedback beim Klick auf Kampagnenname
- User Story 6: Mehrfaches Klicken hat keinen Effekt, System hängt nicht
