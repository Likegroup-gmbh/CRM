# Plan: Gruppierte Kooperationsliste im Videos-Tab (Etappe 1)

Spec: `docs/video-tab-kooperationen-gruppiert.md` (Entscheidungen in Abschnitt 17). Begriffe: **Kooperationszeile** und **Gruppenkopf** in `CONTEXT.md`.

## Ziel
Bei **Alle Linien** erscheint jeder Creator einmal als Gruppe, die Kooperationen darunter sind über die Linie unterscheidbar, und jede Kooperation ist mit einem Klick erreichbar. Bei einer einzelnen Linie bleibt die Liste flach wie heute.

## Festgelegt
- Kein DB-Feld, keine Migration, kein ADR.
- Gruppiert wird über `creator.id`. Ohne `creator.id` steht die Kooperation allein.
- Modi: **Creator** (Standard) und **Linie**. Der Modus **Linie** und der Umschalter gibt es nur für das Team (`canFeature('videoTeamSicht')`).
- Kunden (Q7b): nur Creator-Gruppierung, Linien-Namen wie im Team. Kein „Weitere Kooperationen von …“, keine Produktnamen (RLS, siehe Schritt 8).
- Speicher: `localStorage` je Produktion. URL: `?koopgruppe=creator|linie` (`?gruppe=` gehört dem Showcase).
- **Nicht in diesem Umbau:** Suche, Flip, Showcase-Gruppierung, Type-ahead, Virtualisierung.

## Schritte
Jeder Schritt ist für sich testbar und ein eigener Commit.

### 1. Reine Logik: `videoBrowserGroups.js` (neu) und Tests
- `kooperationLabel(koop, { mode, team })` mit Fallback-Tabelle aus Spec 3.3 und Kunden-Regel.
- `buildKoopGroups(kooperationen, { mode, team, alle })` liefert eine Liste aus `{ type: 'head' | 'row', … }`. Sortierung `localeCompare(…, 'de')`, Einzelzeile bei einer Kooperation oder ohne `creatorId`, Summe `offeneCount` je Gruppe, Handle bei gleichnamigen Creatorn (verschiedene `creatorId`).
- Export über `videoBrowserLogic.js` (`export *`), wie die übrigen Module.
- Tests in `VideoBrowserLogic.test.js`: eine Gruppe bei zwei Linien, Einzelzeile ohne `creatorId`, Eindeutigkeits-Suffix, Kundentitel, Sortierung mit Umlauten, Modus Linie.
- Abnahme: `npx vitest run src/__tests__/VideoBrowserLogic.test.js` grün.

### 2. Baum: `creatorId`, `linieId`, `linieName` (`videoBrowserTree.js`)
- Am Knoten ergänzen: `creatorId: k.creator?.id || null`, `linieId`, `linieName`. Kein neuer Query.
- Test: Baum enthält die Felder, `creator` ohne `id` ergibt `null`.

### 3. Spalte 0 rendern (`videoBrowserRenderColumns.js`, `videoBrowserRenderParts.js`, CSS)
- `colKooperationen` baut die Liste aus `buildKoopGroups`. Gruppen nur bei `ctx.zeigeLinie` (= Alle Linien, wie heute).
- `colShell` bekommt in dieser Spalte `toolbarHtml`: `segmentHtml({ id: 'koop-gruppe', options: Creator | Linie })` (nur Team) und `iconButton` „Alle ein-/ausklappen“.
- Gruppenkopf: `<li>` mit `<button class="vb-koopgroup__head" aria-expanded aria-controls>`, darunter `<ul>` der Kooperationszeilen. Avatar, Name, Anzahl, Summen-Badge (`countBadge`), Chevron (`icon('chevron-down')`, gedreht bei zu).
- Kooperationszeile: `rowButton` mit `extraClass: 'vb-row--nested'`, ohne Avatar, `title` mit vollem Text.
- Einzelzeile: wie heute.
- CSS in `assets/styles/video-browser.css`: `.vb-koopgroup__head` (sticky, `top: 0`, `min-width: 0`, Tokens `--space-*`, `--text-*`, `--gray-*`), `.vb-row--nested` (Einzug). Keine neuen Farben. Lücken mit `TODO(design)`.
- Klasse `vb-group__head` nicht anfassen (gehört Spalte 3).

### 4. Zustand und Speicher (`VideoBrowser.js`, `videoBrowserSelection.js`)
- `vb.koopGroup` (`creator` | `linie`), `vb.collapsed` (`Set` aus `creatorId` bzw. `linieId`).
- `groupFromSearch/groupToSearch` in `videoBrowserSelection.js` (Muster der Showcase-Helfer). `syncUrl` in `VideoBrowser.js` setzt `koopgruppe` zusätzlich. Fremde Parameter bleiben.
- `localStorage`-Schlüssel `crm.videoKoop.<produktionId>` mit `try/catch`, wie `linienScope.js`. Gespeichert werden Gruppierung und eingeklappte Gruppen. Die URL hat Vorrang vor `localStorage`.
- Klick auf Gruppenkopf: Zustand umschalten, nur diesen Teil neu rendern, **keine** Auswahl ändern.
- Liegt die gewählte Kooperation in einer eingeklappten Gruppe (Mount, Deep Link, Moduswechsel, `_select`), wird die Gruppe aufgeklappt und die Zeile per `scrollIntoView({ block: 'nearest' })` sichtbar gemacht.
- Test in `VideoBrowserController.test.js`: Kopf-Klick ändert `vb.sel` nicht, Deep Link in eingeklappte Gruppe klappt sie auf, Parameter in der URL.

### 5. Kontext rechts (`videoBrowserRenderColumns.js`, `videoBrowserRenderParts.js`, `videoBrowserRenderDetail.js`)
- `colVideos`: `title` Creator, `sub` `{Linie} · {n} Videos · @handle` (Team und Kunde, Q7b).
- `pfadSegmente`: zweites Segment `{Creator} · {Linie}` (Team und Kunde).
- `detailKooperation`: Linie im Kopf, nur Team: Liste „Weitere Kooperationen von {Vorname}“ mit `data-goto-koop` (nur Kooperationen derselben `creatorId`).
- „Was gerade ansteht“ (nur Team): Linie anhängen, wenn `ctx.zeigeLinie`.
- Tests: Pfadleiste, `colVideos`-Untertitel.

### 6. Tastatur (`videoBrowserEvents.js`)
- `onColsKey` kennt den Gruppenkopf (`data-vb-koopgroup`) und die Tabelle aus Spec 9 (`↑/↓` über Kopf und Zeilen, `→` auf-/ausklappen bzw. erste Zeile, `←` zum eigenen Kopf, `Enter/Space` klappt).
- Gruppenkopf zählt nicht als Auswahlzeile (`.vb-row[data-depth]` trifft ihn nicht).
- `E/F/T` bleiben unberührt.
- Test: Pfeiltasten über Kopf und Zeilen, `←` vom Kooperationszeilen zum Kopf.

### 7. Animation (`videoBrowserMotion.js`)
- `koopGroupOpen(body, chevron)` und `koopGroupClose(body, chevron)` in `createMotion()`, über `run()`, `d()`, `killRunning/trackRunning`, `clearProps: 'transform,opacity'`.
- „Alle ein-/ausklappen“ animiert max. 20 Gruppen, den Rest sofort.
- Der Moduswechsel Creator ↔ Linie ohne Flip, nur Spalte neu rendern.
- Keine Animation bei Daten-Re-Render (`patch: true`).
- `prefers-reduced-motion` greift über `d()`.

### 8. Produkt in der Meta-Zeile (optional, eigener Commit)
- Nur wenn Schritt 1 bis 7 grün sind: `strategie_item_id` in `VIDEO_SELECT`, Leseabfrage `strategie_items(id, produkt_id)` plus Produktnamen im Adapter (`readIn`, optional wie die übrigen). `koop.produkte` im Baum.
- Meta: `{Produkt(e)} · {n} Videos`.
- Test in `VideoBrowserAdapter.test.js`.
- **Geprüft (09.11.2026):** `strategie_items_select` lässt `kunde_editor` gar nicht und `kunde` nur bei freigegebener Strategie lesen. Deshalb nur Team: `strategie_item_id` nur in der Team-Abfrage, Kunden laden weder Videoidee noch Produkt.

### 9. Abschluss
- `npx vitest run` (ganze Suite) und `npm run build`.
- `ReadLints` auf allen geänderten Dateien.
- Manuell im Browser (Team und Kunde, Alle Linien und eine Linie): Klick auf Kooperation, Gruppe auf/zu, Deep Link in eingeklappte Gruppe, Modus-Wechsel, Tastatur, Reload behält Zustand, Reduced Motion.

## Betroffene Dateien
`src/modules/video-browser/`: `videoBrowserGroups.js` (neu), `videoBrowserLogic.js`, `videoBrowserTree.js`, `videoBrowserRenderColumns.js`, `videoBrowserRenderParts.js`, `videoBrowserRenderDetail.js`, `videoBrowserEvents.js`, `videoBrowserSelection.js`, `videoBrowserMotion.js`, `VideoBrowser.js`, optional `VideoBrowserAdapter.js`. Dazu `assets/styles/video-browser.css` und die Tests `VideoBrowserLogic`, `VideoBrowserController`, optional `VideoBrowserAdapter`.

## Risiken
- **URL-Parameter:** `showcaseToSearch` löscht `gruppe`, daher `koopgruppe`. Test, dass Showcase-Wechsel `koopgruppe` nicht entfernt.
- **Fokus nach Re-Render:** `_render` setzt den Fokus über `data-depth/id` zurück. Der Gruppenkopf braucht denselben Weg (`focus: { koopgroup: id }`), sonst springt der Fokus nach dem Klappen.
- **Kunden-RLS:** Linien-Namen sieht der Kunde schon im Linien-Wechsler (Q7b). Produktnamen sind für Kunden per RLS nicht durchgängig lesbar, deshalb nur Team.
- **Altbestand-Linien:** Ohne Briefing-Titel greift `kooperationName`. Das Altbestand-Badge im Modus Linie nur für das Team (`zeigeAltbestandBadge`).
- **Sticky Köpfe:** `position: sticky` im scrollenden `.vb-col__body`. Darf nicht mit der festen Toolbar kollidieren (Toolbar liegt außerhalb des Scrollbereichs).

## Nicht jetzt (Vormerkung)
Suche (Spec 6), Flip beim Umschalten und bei der Suche (Spec 11), Showcase-Gruppierung über `creator.id` (Spec 13), Type-ahead, Virtualisierung.
