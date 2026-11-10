# Videos-Tab – Gruppierte Kooperationsliste (Spalte 0)

Angepasst an unseren Bestand (`src/modules/video-browser/*`, `CONTEXT.md`, ADR 0045/0063). Ergänzt `video-tab-grundgeruest.md` Abschnitt 7 und ersetzt dort die Beschreibung von **Spalte 0 „Kooperationen“**. Quelle der Vorlage: `~/Downloads/video-tab-kooperationen-gruppiert.md`.

**Status:** Entscheidungen Q1 bis Q9 getroffen (Abschnitt 17), Umsetzung nur **Etappe 1**. Abschnitte, die Suche, Flip, Showcase, Type-ahead oder Virtualisierung betreffen, sind **Vormerkung für später**. Wo „OFFEN (Qn)“ steht, gilt jetzt die Entscheidung aus Abschnitt 17. Der Plan: `PLAN-video-tab-kooperationen-gruppiert.md`.

---

## 0. Regeln

1. **Keine neue Optik.** Struktur, Verhalten, Animation stehen hier; Farben, Abstände und Schrift kommen aus `assets/styles/video-browser.css` (Tokens `--space-*`, `--text-*`, `--gray-*`). Keine neuen Hex-Werte, keine neuen Icons: nur `icon()` aus `core/icons/IconSystem.js`.
2. **Bestehende Bausteine nutzen**, keine neue Listen-Komponente:

   | Bedarf | Baustein (Bestand) |
   |---|---|
   | Zeile | `rowButton()` in `videoBrowserRenderParts.js` |
   | Spaltengerüst, Kopf, Toolbar-Slot | `colShell({ toolbarHtml, headExtra })` |
   | Avatar | `avatar(koop)` |
   | Zähler-Badge | `countBadge()` (Klasse `vb-count`) |
   | Status | `statusBadge()` / `.vb-dot` in der Meta-Zeile |
   | Umschalter | `segmentHtml()` auf Basis `ViewModeToggle` (gleitender Indikator über `motion.tabIndicator`) |
   | Suchfeld | `SearchInput` (`core/components/SearchInput.js`) |
   | Icon-Button | `iconButton()` |
   | Leerer Zustand | `empty()` / `filterEmptyHtml()` |
   | Tooltip | natives `title` (es gibt keine Tooltip-Komponente) |

3. **Die Kooperation bleibt die navigierbare Einheit.** Pfad, URL (`?k=`), Budget, Vertrag und Videos hängen an ihr. Es kommt **keine zusätzliche Spalte** dazu. Die Spalten bleiben `Kooperationen → Videos → Ordner → Dateien` (Ebenen 0 bis 3).
4. **Keine neuen Datenbankfelder**, solange nicht anders entschieden (siehe 3).
5. Rechte nur über `canFeature` (`videoTeamSicht`, `mediaUpload`, …), nie über Rollennamen.

---

## 1. Ist-Zustand und Problem

**Heute** (`colKooperationen` in `videoBrowserRenderColumns.js`): eine flache Liste, eine Zeile je Datensatz aus `kooperationen`. Titel = Creator-Name, Meta = `{n} Videos` und, nur bei **Alle Linien**, der Linien-Name (`zeigeLinie`). Sortierung kommt aus dem Query (`order('name')`), nicht aus dem Browser.

**Problem:** Bei **Alle Linien** erscheint derselbe Creator einmal je Linie (CONTEXT: „Dieselbe Person in einer zweiten Linie ist ein eigener Datensatz“). Die Zeilen sehen bis auf die Meta-Zeile gleich aus, und die Meta-Zeile zeigt nur den Linien-Namen. Der Showcase gruppiert nach `koop.id`, also zerfällt derselbe Creator dort ebenfalls in mehrere Abschnitte.

**Ziel:** Jede Kooperation ist **mit einem Klick** erreichbar und **auf einen Blick eindeutig**:
- Gruppierung nach Creator **innerhalb derselben Spalte**, mit Gruppenköpfen, die keine Navigationsebene sind.
- Die Zeile benennt, **wofür** die Kooperation gebucht ist (Linie, ggf. Produkt), statt den Namen zu wiederholen.
- **Suche** oben in der Spalte.
- Umschalter für die Gruppierung (Umfang: OFFEN Q3).

---

## 2. Begriffe: Vorlage → bei uns

Die Vorlage nennt „Produkt × Konzept“. Bei uns gilt (siehe `CONTEXT.md`):

| Vorlage | Bei uns |
|---|---|
| Kampagne | **Produktion** ist der Scope des Tabs (Tab unter Produktion). Die Kampagne ist darüber. |
| Kooperation (Creator pro Produkt × Konzept) | **Kooperation** = Creator-Buchung **in einer Linie** |
| Produkt × Konzept | **Linie** (Briefing + Casting + Konzept + Skripte + Kooperationen). Das **Konzept** ist 1:1 zum Casting der Linie. Das **Produkt** sitzt an der Linie und an der **Videoidee** (`strategie_items.produkt_id`), also pro Video, nicht pro Kooperation. |
| Kooperation-Titel „Leber Aktiv · Food-Koma“ | Linien-Name (`linien[].name`, Namenskette ADR 0041) und optional Produkt |
| „Creator“ | **Creator** (`creator.id`). Casting-Einträge ohne Datensatz sind kein Creator. |
| Ablauf-Schritt der Kooperation | **Status (Videos-Tab)**: abgeleitet aus Dateien, nicht von Hand gesetzt |
| Badge „offene Inhalte“ | Zähler = Dateien, die beim Kunden warten (Team) bzw. zu prüfen sind (Kunde), siehe `countBadge` |

Neue Begriffe, die in `CONTEXT.md` gehören, sobald bestätigt: **Gruppenkopf** (UI-Container ohne Navigation, nicht die Kooperation) und **Kooperationszeile**. Bis dahin steht nichts in `CONTEXT.md`.

---

## 3. Daten

### 3.1 Was schon da ist
- `loadVideoBrowserData` lädt `kooperationen` (`id, name, briefing_id, creator:creator_id(id, vorname, nachname, instagram, profilbild_*)`), `linien` (`{ id, name, … }`) und die `kooperation_videos`.
- `buildTree` erzeugt je Kooperation `{ id, name, kooperationName, handle, avatarUrl, linie, mode, videoCount, offeneCount, rows }`.
- `linie` ist je Kooperation bereits aufgelöst (`linien.get(k.briefing_id)`).

### 3.2 Was ergänzt wird (Arbeitsannahme, keine Migration)
Am Baumknoten `koop`:

```js
{
  // neu
  creatorId: k.creator?.id || null,   // Gruppierungsschlüssel. Nie der Name.
  linieId: k.briefing_id || null,
  linieName: linie?.name || '',
  produkte: [],                       // distinct Produktnamen der Videoideen der rows (OFFEN Q1)
}
```

`creator` ist im Select schon enthalten; `creatorId` kostet keine Query. Für `produkte` braucht der Adapter zusätzlich `strategie_item_id` in `VIDEO_SELECT` und eine Leseabfrage auf `strategie_items(id, produkt_id)` plus Produktnamen. Das ist optional und hängt an **OFFEN Q1**.

### 3.3 Fallback-Label (eine zentrale Funktion)
**Geändert am 09.11.2026:** Die Tabelle unten gilt nur, solange die Linie die Kooperationen eines Creators unterscheidet. `kooperationLabels()` nimmt je Kooperation das erste Merkmal der Kette **Linie → Produkt(e) → Videotitel → Zusatz im Kooperationsnamen** (`Kooperation 6/9`), das sie von den anderen Kooperationen desselben Creators **unterscheidet**. Ohne Produkt und Linie ist der Zeilentitel also „Wassermelonen Eis · Schwamm DIY +2“ (erste zwei Videotitel, Rest als Zähler). Steht ein anderes Merkmal im Titel, stehen die Videotitel in der Meta-Zeile. Die Gruppierung hängt nie an Linie oder Produkt. Bleibt nichts Unterscheidendes, hängt `· {n}` an.

Neue Datei `videoBrowserGroups.js` (reine Logik, kein DOM, kein Supabase) mit `kooperationLabel(koop, mode)`. Liste, Pfadleiste, Spaltenkopf, Detail und Showcase nutzen **nur** sie.

| Vorhanden | Zeilentitel (Modus Creator) |
|---|---|
| Linie + Produkt(e) | `{Linie}`; Meta `{Produkt} · {n} Videos` |
| nur Linie | `{Linie}`; Meta `{n} Videos` |
| nur Produkt | `{Produkt}` |
| nichts (Altbestand, Linie ohne Briefing-Titel) | `{kooperationName}`, sonst `Kooperation` |

Dieselbe Linie darf für denselben Creator nur einmal vorkommen. Falls doch (Altbestand), wird `· {n}` angehängt (Reihenfolge nach `created_at`), damit Zeilen eindeutig bleiben. **OFFEN Q1**: ob Produkt überhaupt in die Zeile kommt.

---

## 4. Aufbau der Spalte

```
┌──────────────────────────────────────┐
│ Kooperationen                        │  colShell: title
│ Produktion 1 · 15 Creator · 32 Koop. │  sub (Zähler zeigen beides)
│ [🔍 Creator, Linie, Video …      /]  │  toolbarHtml (SearchInput)
│ Gruppieren [Creator | Linie]   ⇕     │  segmentHtml + iconButton (alle ein-/ausklappen)
├──────────────────────────────────────┤
│ (AN) Ameli Noubbigh          2 ⌄  (4)│  Gruppenkopf (button, aria-expanded), Badge = Summe
│      Nano-Influencer          3 ›    │  Kooperationszeile (eingerückt, ohne Avatar)
│      UGC-Creator              3 ›    │
│ (DS) Dilara Selek                 ›  │  Einzel-Kooperation: EINE Zeile, kein Kopf
│      UGC-Creator · 1 Video           │
└──────────────────────────────────────┘
```

### 4.1 Wann sichtbar (Q2, geändert am 09.11.2026)
Die Gruppierung nach `creator.id` gilt **immer**, auch bei einer einzelnen Linie und in Produktionen ganz ohne Linien (z. B. Jahreskooperationen, `briefing_id` ist dort `null`). Dort hat ein Creator oft mehrere Kooperationen, die Liste darf ihn nicht mehrfach zeigen. Nur der Umschalter **Creator | Linie** gibt es weiterhin nur im Team bei **Alle Linien** (`zeigeLinie`).

### 4.2 Spaltenkopf
- `colShell` bekommt `toolbarHtml` für Suche und Umschalter. Der Kopf samt Toolbar bleibt fix, nur `[data-vb-body]` scrollt (so ist `.vb-col__body` heute schon gebaut).
- `sub`: `{Produktion} · {m} Creator · {n} Kooperationen`; bei aktiver Suche `{x} von {n} Kooperationen`. Der bestehende Zusatz „Dateien beim Kunden / zu prüfen“ (`zaehlerText`) bleibt.

### 4.3 Gruppenkopf (Creator mit ≥ 2 Kooperationen)
- Eigene Klasse `vb-koopgroup__head`, **nicht** `vb-group__head` (die Klasse gehört schon der Gruppierung in Spalte 3: Videos/Bilder/Stories).
- Inhalt: `avatar(koop)`, Creator-Name, Anzahl Kooperationen, Chevron-Icon, Summen-Badge.
- Summen-Badge = Summe `offeneCount` der Kooperationen der Gruppe, gleiche Zählweise und Beschriftung wie `countBadge`. Sichtbar auch eingeklappt.
- **Sticky** am oberen Rand von `.vb-col__body` (`position: sticky; top: 0`).
- `<button aria-expanded>`: Klick klappt, navigiert nicht, ändert die Auswahl nicht.
- Zwei Creator mit demselben Namen (verschiedene `creatorId`): Handle wird mitgezeigt.

### 4.4 Kooperationszeile in einer Gruppe
- `rowButton` mit Einzug (neue Klasse `vb-row--nested`), ohne `avatar`.
- Titel `kooperationLabel(koop, 'creator')`, einzeilig mit Ellipsis (`min-width: 0` wie im Rest), voller Text im `title`.
- Rechts: `countBadge` und Chevron, Videoanzahl in der Meta-Zeile. **Ein Klick** wählt die Kooperation (`depth: 0`, wie heute).

### 4.5 Einzel-Kooperation
Kein Kopf. Normale Zeile wie heute (Avatar, Creator-Name), Meta `{Linie} · {n} Videos` (bei Alle Linien, wie bisher `zeigeLinie`).

### 4.6 Reihenfolge
- Gruppen und Einzelzeilen **alphabetisch nach Creator-Name**, `localeCompare(…, 'de')`, gemischt in einer Reihenfolge.
- In einer Gruppe: nach Linien-Reihenfolge der Produktion (Reihenfolge von `detail.linien`, wie im Linien-Wechsler), dann `created_at`.

### 4.7 Creator ohne `creatorId`
Wird nie gruppiert, sondern ist eine eigene Einzelzeile mit `kooperationName` als Titel. **OFFEN Q4**: Alternative wäre Gruppierung über den Namen.

---

## 5. Gruppieren

Die Vorlage kennt „Creator | Produkt“. Unser Produkt hängt am Video, nicht an der Kooperation (siehe 2). Optionen für den zweiten Modus:

| Modus | Gruppenkopf | Zeile | Bemerkung |
|---|---|---|---|
| Creator | Creator (Avatar, Name) | Linie (+ Produkt) | Standard |
| Linie *(Arbeitsannahme)* | Linien-Name, Altbestand-Badge nur Team (`zeigeAltbestandBadge`) | Creator (Avatar, Name) | Entspricht dem Linien-Dropdown, aber ohne Filter: alles sichtbar, nur gruppiert |
| Produkt | – | – | **Entfällt** (Q3). Eine Kooperation kann mehrere Produkte haben. |

- Umschalter über `segmentHtml({ id: 'koop-gruppe', … })`, Zustand in `vb.koopGroup`.
- Bei unveränderter Auswahl wird sie beim Umschalten behalten, ihre Gruppe aufgeklappt und die Zeile per `scrollIntoView({ block: 'nearest' })` sichtbar gemacht.

---

## 6. Suche

### 6.1 Verhalten
- `SearchInput` im `toolbarHtml`. Platzhalter „Creator, Linie, Video …“, `aria-label="Kooperationen durchsuchen"`.
- **Taste `/`** setzt den Fokus ins Feld, wenn der Fokus nicht in einem Eingabefeld liegt. Die Prüfung nutzt `isTyping()` und `inScope()` aus `videoBrowserKeys.js` (nicht neu bauen). Aktuell belegt `videoBrowserKeys.js` die Tasten `E`, `F`, `T`; `/` ist frei. Im Showcase nicht aktiv (wie die anderen Kürzel).
- **Esc** leert das Feld, ein zweites Esc gibt den Fokus an die Liste.
- Durchsucht: Creator-Name, Handle, Linien-Name, Videotitel (`row.title`, `row.label`) und, falls Q1 es vorsieht, Produktname.
- Mehrere Wörter = **UND**. Groß-/Kleinschreibung, Akzente und Umlaute werden normalisiert (`NFD` und `ä→ae`), damit „koesek“ auch „Kösek“ findet. Die Normalisierung kommt in `videoBrowserGroups.js` und ist testbar.
- Debounce ca. 80 ms. Treffer im Titel mit `<mark>` (Stil aus dem Design-System, sonst `TODO(design)`).

### 6.2 Darstellung
- Gruppen ohne Treffer verschwinden. Gruppen mit Treffern sind aufgeklappt, unabhängig vom gespeicherten Klappzustand. Nach dem Leeren gilt der gespeicherte Zustand wieder.
- Trifft nur der Creator-Name, bleiben alle Kooperationen sichtbar. Trifft Linie, Video oder Produkt, nur die passenden.
- Ohne Treffer: `empty()` mit „Keine Kooperation zu „{Begriff}““ und Button „Suche leeren“ (Muster `filterEmptyHtml`).
- Das Filtern ändert **nicht** die Auswahl. Fällt die gewählte Kooperation aus dem Filter, bleibt sie gewählt, ist aber nicht sichtbar (kein `validateSelection`, die Suche ist Darstellung, nicht Daten).
- Trefferzahl über `aria-live="polite"` am `sub` ansagen.

### 6.3 Tastatur
- `↓` aus dem Feld springt auf die erste Kooperationszeile (Gruppenköpfe werden übersprungen).
- `Enter` im Feld wählt die erste Kooperationszeile.

---

## 7. Klappzustand

- Standard: alle Gruppen aufgeklappt.
- Zustand `collapsed: Set<creatorId | linieId>` je Produktion.
- Aktion „Alle einklappen / Alle aufklappen“ als `iconButton` neben dem Umschalter.
- Liegt die gewählte Kooperation in einer eingeklappten Gruppe (Deep Link, Reload), wird die Gruppe aufgeklappt und die Zeile sichtbar gemacht. Das passiert in `_select()` und beim Mount (`validateSelection` bleibt gleich).
- Speicherort: **OFFEN Q6**. Arbeitsannahme: `localStorage` je Produktion, Schlüssel nach dem Muster `crm.linie.<produktionId>` aus `linienScope.js`, z. B. `crm.videoKoop.<produktionId>`, mit `try/catch` (Komfort, kein Fehlerfall).

---

## 8. Kontext weiter rechts

Damit nach dem Klick klar ist, in welcher Kooperation man ist (alle über `kooperationLabel()`):

- **Spalte 1 (Videos)** `colVideos`: `title` = Creator-Name, `sub` = `{Linie} · {n} Videos · @handle` (heute `{n} Videos · @handle`).
- **Pfadleiste** `pfadSegmente()`: `Alle Kooperationen / {Creator} · {Linie} / Video {n} / …`. Bleibt `keep: 1`.
- **Detailbereich** `detailKooperation()`: Kopf mit Creator und Linie. Hat der Creator weitere Kooperationen in dieser Produktion, steht darunter eine Liste „Weitere Kooperationen von {Vorname}“ (`data-goto-koop`, die Delegation `gotoFromAttrs` kann das schon). Sichtbarkeit: nur Team (Q7b).
- **Was gerade ansteht** (`vb-todo__title`): `{Creator} · {Video}` bekommt die Linie dazu, wenn mehrere Linien sichtbar sind.

---

## 9. Tastatur in der Liste

Erweitert `onColsKey` in `videoBrowserEvents.js`. Heute sucht es `.vb-row[data-depth]`; der Gruppenkopf braucht ein eigenes Attribut (`data-vb-koopgroup`), damit er nicht als Auswahlzeile gilt.

| Taste | Kooperationszeile | Gruppenkopf |
|---|---|---|
| `↑` / `↓` | vorherige/nächste Zeile **oder Kopf** | wie links |
| `→` | wie heute: auswählen, dann Fokus in Spalte 1 | Gruppe aufklappen, sonst erste Zeile |
| `←` | Fokus auf den eigenen Gruppenkopf (nur wenn sie in einer Gruppe steht) | Gruppe einklappen |
| `Enter` / `Space` | auswählen (Klick) | ein-/ausklappen |
| `/` | Fokus ins Suchfeld | Fokus ins Suchfeld |

Type-ahead wie im Finder ist **nicht** Teil dieser Etappe (OFFEN Q5).

---

## 10. Barrierefreiheit

Der Rest des Tabs ist eine Folge von Spalten mit `<ul class="vb-rows">` aus `<button>`-Zeilen und `aria-current`. Die Vorlage schlägt einen Baum (`role="tree"`) vor oder, falls ein Muster schon existiert, die zweite Variante. **Arbeitsannahme: zweite Variante**, damit alle Spalten gleich bedienbar bleiben:

- Gruppe = `<li>` mit `<button aria-expanded aria-controls>` und darunter eine verschachtelte `<ul>` der Kooperationszeilen. Die Pfeiltasten laufen über die flache Reihenfolge der sichtbaren Buttons (wie bisher).
- Suchfeld: `aria-label="Kooperationen durchsuchen"`, `aria-controls` auf die Liste, Trefferzahl `aria-live="polite"`.
- Gekürzte Titel: voller Text im `title` **und** im `aria-label`.
- Status nie nur als Farbe (Badge hat Text, Dot hat Text daneben).

---

## 11. Animationen (GSAP)

GSAP kommt **nur** über `core/animation/gsap.js` (exportiert `gsap`, `Flip`, `prefersReducedMotion`, `killRunning`, `trackRunning`). Neue Effekte kommen als Methoden in `createMotion()` (`videoBrowserMotion.js`), laufen im vorhandenen `gsap.context`, nutzen `d()` für reduced motion und `clearProps: 'transform,opacity'`. `columnsIn` animiert `.vb-group__head` schon mit; dort kommt der neue Kopf dazu.

| Was | Auslöser | Methode (neu) | Umsetzung |
|---|---|---|---|
| Gruppe aufklappen | Klick/Taste | `koopGroupOpen(body, chevron)` | `fromTo(body, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: d(.28), ease: 'power2.out', clearProps })`, Zeilen `from({ x: 8, opacity: 0, stagger: d(.02) })`, Chevron zurück |
| Gruppe einklappen | Klick/Taste | `koopGroupClose(body, chevron)` | `to(body, { height: 0, opacity: 0, duration: d(.22), ease: 'power2.in' })`, danach ausblenden; nutzt `killRunning`/`trackRunning` gegen Doppelklick |
| Alle ein-/aufklappen | Aktion im Kopf | wie oben, gestaffelt | max. ca. 20 Gruppen animieren, der Rest sofort |
| Suche filtert | Eingabe | `filterRowsIn(rows)` (**gibt es**) | Bestand wiederverwenden. **Flip** nur, wenn es nach Prüfung einen Gewinn gibt (OFFEN Q5), bei > ca. 150 sichtbaren Zeilen nie |
| Umschalten Creator ↔ Linie | Segment | Flip über Zeilen (`data-flip-id = koop.id`) | Köpfe blenden in .2 s aus/ein. Erst Etappe 3 |
| Badge-Zahl ändert sich | Datenänderung | `badgeBump` (**gibt es**) | Gruppen-Badge nutzt dieselbe |

`prefers-reduced-motion`: nur Zustandswechsel. Beim Re-Render durch Daten (`reload`, `patch: true`) wird nichts animiert, nur bei echtem Navigations-/Gruppenwechsel (wie `animateFromDepth`).

---

## 12. Performance

- Eine Produktion hat typischerweise einstellig bis niedrig zweistellig viele Kooperationen. Normales Rendern genügt, **keine Virtualisierung** (nur sinnvoll > ca. 200; OFFEN Q5).
- Gruppierung, Sortierung und Suchindex werden aus dem Baum **einmal** je `reload()` berechnet (in `videoBrowserGroups.js`, z. B. `buildKoopGroups(tree, mode)`), nicht bei jedem Tastendruck. Die Suche filtert nur den vorberechneten Index.

---

## 13. Showcase

- `groupShowcase()` gruppiert bei `creator` nach `entry.koop.id`. Das wird `entry.koop.creatorId || entry.koop.id`, damit mehrere Kooperationen eines Creators **einen** Abschnitt bilden.
- Abschnittskopf: `{Creator} · {n} Kooperationen · {m} Inhalte` (heute nur Creator-Name).
- Kachel-Unterzeile ergänzt die Linie, wenn eine Gruppe mehrere Kooperationen hat: `{Creator} · {Linie} · Video {n}`.
- URL-Parameter `gruppe=creator|persona|keine` bleibt. Neuer Wert `linie` nur, wenn Q3 es vorsieht (`SHOWCASE_GROUPS` und `showcaseFromSearch` kennen dann den Wert; unbekannte Werte fallen auf den Standard).
- Gilt nur im Team (Showcase ist heute schon team-getrennt über `videoTeamSicht` im Detail; vor dem Bauen gegen `videoBrowserShowcase.js` prüfen, was Kunden sehen).

---

## 14. URL und Zustand

| Parameter | Bedeutung | Bestand |
|---|---|---|
| `?k=&v=&f=&i=` | Auswahl | ja (`videoBrowserSelection.js`) |
| `?linie=` | aktive Linie oder `alle` | ja (`linienScope.js`) |
| `?ansicht=showcase&…` | Showcase | ja |
| `?koopgruppe=creator\|linie` | **neu** (Q9): Gruppierung der Spalte 0. `?gruppe=` ist vom Showcase belegt und wird dort gelöscht, daher ein eigener Name. `selectionToSearch` lässt fremde Parameter stehen; ein Helfer `groupFromSearch/groupToSearch` in `videoBrowserSelection.js` folgt dem Muster der Showcase-Parameter. | neu |
| Klappzustand | nicht in die URL | localStorage (OFFEN Q6) |

---

## 15. Umsetzungsschnitt (Arbeitsannahme, OFFEN Q5)

1. **Etappe 1:** `videoBrowserGroups.js` (`kooperationLabel`, Gruppierung, Sortierung), `creatorId` im Baum, Gruppenköpfe und Einzelzeile in `colKooperationen`, Kontext in Spalte 1/Pfadleiste/Detail, Klappzustand, Tastatur, ARIA, Animation auf/zu.
2. **Etappe 2:** Suche (`/`, UND, Akzente, `<mark>`, Auto-Aufklappen).
3. **Etappe 3:** Flip beim Umschalten, Showcase-Gruppierung über `creatorId`.
4. **Nicht jetzt:** Virtualisierung, Type-ahead.

Betroffene Dateien: `videoBrowserTree.js`, `videoBrowserRenderColumns.js`, `videoBrowserRenderParts.js` (`colShell` bekommt die Toolbar, Pfadleiste), `videoBrowserRenderDetail.js`, `videoBrowserEvents.js`, `videoBrowserSelection.js`, `videoBrowserMotion.js`, `VideoBrowser.js` (`_ctx`, `_select`), `videoBrowserShowcaseLogic.js`, `assets/styles/video-browser.css`, neu `videoBrowserGroups.js`.

Tests im Bestand erweitern: `VideoBrowserLogic.test.js` (Gruppierung, Label, Suche, Akzente), `VideoBrowserController.test.js` (Klappen, Auswahl in eingeklappter Gruppe, `/`), `VideoBrowserShowcaseLogic.test.js` (Creator-Abschnitt über Linien).

---

## 16. Akzeptanzkriterien

- [ ] Spalte 0 gruppiert nach **`creator.id`**. Kein Name erscheint doppelt als Zeilentitel. Das gilt auch bei einer einzelnen Linie und ohne Linien (Q2).
- [ ] Creator mit ≥ 2 Kooperationen haben einen sticky, klappbaren Gruppenkopf mit Anzahl und summiertem Zähler. Creator mit einer Kooperation haben eine einfache Zeile ohne Kopf.
- [ ] Zeilentitel kommen aus `kooperationLabel()`, mit Fallback und Eindeutigkeits-Suffix.
- [ ] **Ein Klick** auf eine Kooperationszeile öffnet die Videos. Gruppenköpfe ändern die Auswahl nicht.
- [ ] Suche über Creator, Handle, Linie und Videotitel: UND, akzent- und umlautunabhängig, live, mit Hervorhebung und Auto-Aufklappen. `/`, Esc, `↓`, Enter funktionieren.
- [ ] Umschalter für die Gruppierung, Zustand in der URL, die Auswahl bleibt erhalten.
- [ ] Klappzustand je Produktion gespeichert. Die gewählte Kooperation liegt nie in einer eingeklappten Gruppe.
- [ ] Spalte 1, Pfadleiste und Detailbereich zeigen die Linie. Das Detail listet „Weitere Kooperationen von …“.
- [ ] Tastatur laut 9, ARIA laut 10, nichts davon bricht `E`/`F`/`T`.
- [ ] Animationen laut 11 über `createMotion`, `prefers-reduced-motion` respektiert, kein Animieren bei Daten-Re-Renders.
- [ ] Der Showcase gruppiert bei „Creator“ über `creator.id` über alle Kooperationen.
- [ ] Keine neuen Farben, Icons oder Komponenten. Lücken stehen mit `TODO(design)`.
- [ ] Tests laut 15 sind grün (`npm test`).

---

## 17. Entscheidungen (entschieden am 09.11.2026)

| | Entscheidung |
|---|---|
| Q1 | Linie als Titel, Produkt(e) aus den Videoideen optional in der Meta-Zeile. Keine neuen Felder an `kooperationen`. |
| Q2 | Gruppenköpfe gelten **immer** (auch bei einer Linie oder ohne Linien), geändert am 09.11.2026. Der Umschalter Creator \| Linie nur im Team bei **Alle Linien**. |
| Q3 | Zweiter Modus ist **Linie**. Kein Produkt-Modus. |
| Q4 | Kooperation ohne `creator.id` ist eine eigene Einzelzeile, nie gruppiert. |
| Q5 | Nur **Etappe 1**. Suche, Flip, Showcase-Gruppierung, Type-ahead und Virtualisierung sind **nicht** Teil dieses Umbaus (Abschnitte 6, 11 Flip, 13 bleiben als Vormerkung stehen). |
| Q6 | `localStorage` je Produktion für Klappzustand und Gruppierung. Die Gruppierung steht zusätzlich in der URL. |
| Q7 | Kunden sehen die Gruppierung nach Creator. „Weitere Kooperationen von …“ ist nur für das Team. |
| Q7b | Kunden sehen die **Linien-Namen** wie das Team (sie stehen für Kunden schon im Linien-Wechsler). Modus **Linie**, Umschalter und „Weitere Kooperationen von …“ nur im Team. |
| Q8 | `CONTEXT.md`: **Kooperationszeile** und **Gruppenkopf** sind aufgenommen. Kein ADR. |
| Q9 | URL-Parameter `?koopgruppe=creator\|linie` (`?gruppe=` gehört dem Showcase). |

Folgen aus Q7b: Kunden haben nur die Creator-Gruppierung, ein `?koopgruppe=` in der URL zählt für sie nicht. Ihr Zeilentitel unter dem Gruppenkopf ist die Linie wie im Team. Produktnamen in der Meta-Zeile gibt es nur im Team: `strategie_items` ist für `kunde_editor` per RLS gar nicht und für `kunde` nur bei freigegebener Strategie lesbar (geprüft am 09.11.2026).

Der Plan steht in `docs/PLAN-video-tab-kooperationen-gruppiert.md`.
