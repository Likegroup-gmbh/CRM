# PRD: Stakeholder Finanzübersicht und Datenqualitätsanzeige

## Problem Statement

Die Stakeholder Übersicht (`/stakeholder`) zeigt Zahlen, die die finanzielle Lage nicht korrekt abbilden. Drei Ursachen wurden nachgewiesen. Erstens fehlen ganze Datenmengen: `loadData` lädt acht Tabellen ohne Pagination, obwohl `kooperation_videos` 2.533 und `kooperationen` 1.141 Zeilen hat, und das `rechnung`-Select enthält kein einziges Datumsfeld. Kundenrechnungen werden gar nicht geladen, weder aus `auftrag` noch aus `auftrag_teilrechnung`. Zweitens verdeckt die Berechnung Fehler: an rund zehn Stellen klemmt `Math.max(0, …)` jede Budgetüberschreitung auf null, und `calculateEkVkTotals` zählt Zeilen mit nur einem gepflegten Preis in `ekSum` und `vkSum`, lässt sie in `marginSum` aber weg. Drittens gibt es keine Zeitachse: die Übersicht kennt weder vergangene noch kommende Monate.

Parallel dazu fehlt der Geschäftsführung ein Weg, Datenmängel zu erkennen. Auffälligkeiten werden heute zufällig beim Durchsehen einzelner Kampagnen entdeckt.

## Solution

Die Übersicht bekommt eine monatliche Auswertung von Umsatz und Fremdkosten je Leistungsbereich, in zwei Sichten nach [ADR 0006](adr/0006-zwei-periodisierungen.md): die Margensicht ordnet Fremdkosten dem Monat der Kundenrechnung zu, die Buchhaltungssicht jedem Beleg seinen eigenen Rechnungsmonat. Grundlage sind ausschließlich Rechnungen, nicht die Kalkulation — damit schlagen die bekannten EK/VK-Pflegemängel nicht auf die Auswertung durch.

Alle Beträge werden vorzeichenrichtig gezeigt, Lücken benannt statt geglättet ([ADR 0007](adr/0007-unplausible-zahlen-ausweisen-statt-glaetten.md)). Was sich nicht zuordnen lässt, bekommt einen sichtbaren Sammelposten, damit die Summe der Bereiche immer das Gesamt ergibt.

Ergänzend zur Periodisierung zeigt ein Status-Block den Zahlungsstand als Snapshot „Stand heute": je Seite (Kunden und Creator) gestellt, davon bezahlt, davon offen — mit überfälligem Teil — und noch nicht gestellt. Die Matrix beantwortet „wann wurde gebucht?", der Status-Block „wo stehen wir heute?".

Getrennt davon entsteht ein Adminbereich mit einer Datenqualitätsanzeige, die nach Kampagne gruppiert und nach betroffenem Geldvolumen sortiert zeigt, wo Zahlen unvollständig sind.

## User Stories

1. Als Geschäftsführer möchte ich pro Monat sehen, welcher Umsatz welchem Leistungsbereich zuzurechnen ist und welche Fremdkosten dem gegenüberstehen, damit ich das Investorenupdate ohne Handrechnung erstellen kann.
2. Als Geschäftsführer möchte ich Creator-Honorar, KSK und Zusatzkosten einzeln sehen, weil sie unterschiedlich entstehen und ich sie unterschiedlich beeinflussen kann.
3. Als Geschäftsführer möchte ich erkennen können, welcher Anteil eines Monats noch gar nicht fakturiert ist, damit ich eine Marge nicht für endgültig halte, die es nicht ist.
4. Als Geschäftsführer möchte ich zu jedem verschickten Update nachvollziehen können, auf welchem Stand es beruhte, auch wenn sich die Zahl seitdem verändert hat.
5. Als Geschäftsführer möchte ich auf einen Blick sehen, welche Kampagnen unvollständig gepflegt sind und wie viel Geld daran hängt, statt es zufällig beim Durchsehen zu entdecken.
6. Als Buchhaltung möchte ich dieselben Rechnungen nach ihrem eigenen Rechnungsdatum sehen, weil das die Sicht ist, die zu den Büchern passt.
7. Als Mitarbeiter möchte ich, dass ein überschrittenes Budget als Überschreitung erscheint und nicht als punktgenau ausgeschöpft, damit ich den Fehler überhaupt bemerke.
8. Als Nutzer der Übersicht möchte ich, dass die Summe der Leistungsbereiche immer dem Gesamtumsatz entspricht, damit ich der Aufteilung trauen kann.
9. Als Geschäftsführer möchte ich je Seite — Kunden und Creator — sehen, welcher Betrag bereits gestellt, davon bereits bezahlt und welcher noch gar nicht gestellt ist, damit ich den Zahlungsstand ohne Buchhaltungskenntnisse erfasse.

## Implementation Decisions

Die Schritte bauen aufeinander auf und sind in dieser Reihenfolge umzusetzen.

### Schritt 1 — Vorzeichen freilegen und Marge abstimmbar machen ✅ umgesetzt

Jede Fundstelle wurde einzeln eingeordnet, statt `Math.max(0, …)` pauschal zu entfernen. Es gibt drei Kategorien, und nur die erste wurde geändert.

**Entklemmt (Geldwerte in der Anzeige):** `calculateBudgetOverview.js` (`verfuegbaresBudgetRest`), `EkVkAgencyFeeHelper.js` (`calculateCreatorPaymentSummary.open`), `StakeholderOverviewPage.js` (`verfuegbar`, `verbrauchtPct`, `offenPct`, `influencerOffenesCreatorBudget`), `AuftragDetail.js` (`openBudget`), `AuftragsdetailsDetail.js` (`offenesBudget`), `KampagneDetailSummaryCards.js` (`openBudget`, beide Vorkommen), `ContractDetail.js` (`openBudget`).

**Bewusst geklemmt geblieben (Balkengeometrie):** die `width: …%`-Ausdrücke sowie `KampagneUtils.getProgressPercentage`. Ein Balken kann nicht negativ breit sein. In `AuftragDetail.js` wurden Wert und Geometrie über einen `barWidth`-Helfer getrennt, damit die Klemmung nicht mehr auf den Prozentwert durchschlägt.

**Bewusst geklemmt geblieben (persistierte Eingabewerte):** `AutoCalculation.js:262`, `ProjektErstellenPersistence.js:73` und `FeedbackCard.js:63`. Alle drei berechnen `creator_budget` aus `netto − KSK − Deckungsbeitrag` und schreiben das Ergebnis in ein Formularfeld, das gespeichert wird. Die Klemmung versteckt dort keinen bestehenden Fehler, sondern verhindert, dass ein negativer Wert überhaupt erst in die Datenbank gelangt. Das ist eine andere Frage als die Anzeigewahrheit und gehört in einen eigenen Schritt: sinnvoll wäre eine Validierung am Eingabefeld statt einer stillen Null.

**Marge abstimmbar:** `marginSum` behält seine Bedeutung — nur vollständig bepreiste Zeilen, denn bei fehlendem EK ist die Marge unbekannt, nicht null. Neu ist `incompleteSum` samt `incompleteRows` für den Saldo der halb bepreisten Zeilen. Damit gilt immer `vkSum − ekSum === marginSum + incompleteSum`, und die Lücke ist beziffert statt verschwunden. Das ist rückwärtskompatibel: keine bestehende Auswertung ändert ihr Ergebnis.

**Tests:** `src/__tests__/BudgetUeberschreitung.test.js` hält das neue Verhalten fest, inklusive der Identität oben. Zwei bestehende Tests kodierten die alte Klemmung und wurden umgedreht (`EkVkAgencyFeeHelper.test.js`, `ContractBudget.test.js`).

### Schritt 2 — Leistungsbereich aus einer Quelle

Neues Modul `src/core/budget/leistungsbereich.js` mit einer Funktion, die aus einem Auftrag seinen Leistungsbereich ableitet:

- `auftragtype` enthält „Contracting" → **Contracting**
- kein `auftrag_kampagnenart_blocks`-Eintrag → **Nicht zugeordnet**
- genau ein Bereich über alle Blöcke → dieser Bereich
- mehrere Bereiche → **Gemischt**

Die Zusammenfassung ist gröber als die Kampagnenart: `influencer`, `story` und `event` bilden gemeinsam **Influencer Marketing**. Genau diese Gruppierung reduziert „Nicht zugeordnet" von 39 auf 13 Aufträge, weil 25 davon Contracting sind.

Die bestehenden Tabs der Stakeholder Übersicht werden auf dieselbe Funktion umgestellt. Zwei verschiedene Kategorisierungen auf einer Seite wären der schlimmste Ausgang.

### Schritt 3 — Rechnungsbasierte Datenschicht

- `loadData` bekommt Pagination über `.range()`. `VideoTableDataLoader.batchInQuery` chunkt nur ID-Listen und greift hier nicht, weil die Selects ungefiltert sind.
- Das `rechnung`-Select wird um `gestellt_am`, `nettobetrag_steuerfrei`, `zusatzkosten` und `kooperation_id` erweitert.
- Kundenrechnungen werden neu geladen: `auftrag.rechnung_gestellt_am` plus `auftrag_teilrechnung`. Hat ein Auftrag Teilrechnungen, zählen ausschließlich diese, sonst der Auftrag selbst — sonst wird doppelt gezählt.
- Die drei Fremdkostenposten je Creatorrechnung: **Honorar** aus `nettobetrag` + `nettobetrag_steuerfrei`, **Zusatzkosten** aus `rechnung.zusatzkosten` (187 Rechnungen, 53.187 €; nicht `zusatzkosten_netto`, das leer ist), **KSK** als 4,9 % des Honorars gemäß `KSK_SATZ_PROZENT`. Die 3 Kooperationen mit `ksk_selbstzahler` sind ausgenommen, dort steckt der Aufschlag bereits im Honorar.
- Rechnungen mit `gestellt_am` vor 2020 werden nicht stillschweigend übersprungen, sondern separat ausgewiesen. Aktuell sind es vier mit zusammen 15.940 €.

### Schritt 4 — Monatsauswertung

Neue Ansicht auf `/stakeholder`, umschaltbar zur bestehenden Kalkulationsansicht. Matrix aus Monat und Leistungsbereich, umschaltbar zwischen Umsatz, Fremdkosten und Differenz sowie zwischen Margensicht und Buchhaltungssicht.

- **Margensicht:** die Fremdkosten eines Auftrags folgen seinem Umsatz anteilig über dessen Kundenrechnungsmonate. Bei einer einzigen Kundenrechnung ist das deren Monat; bei 50/50-Teilrechnungen trägt jeder Monat die Hälfte der Kosten — sonst stünden alle Kosten im ersten Monat, während der Erlös sich verteilt, und die Monatsmarge kippte genau bei den Raten-Aufträgen.
- **Buchhaltungssicht:** jeder Beleg in seinem eigenen Rechnungsmonat.
- Zwei getrennte Zeilen unterhalb der Matrix: **noch nicht fakturiert** (91.879 € kalkulierte Creatorkosten ohne Rechnung) und **ohne Kundenrechnung** (380.919 € Creatorkosten zu nie fakturierten Aufträgen). Beide haben in der Margensicht keinen Monat und dürfen deshalb nicht einfach verschwinden. Dazu kommt **Überfakturiert** (ADR 0007) und der Ausweis unmöglicher Rechnungsdaten.
- Im Kopf steht die Zuordnungsquote. Der Verweis auf die Datenqualitätsanzeige ist ein Hinweistext, bis Schritt 9 die Anzeige liefert.

### Schritt 5 — Rechnungsstatus-Snapshot

Status-Block auf `/stakeholder`, direkt oberhalb des View-Toggles, damit er in beiden Ansichten steht — der Snapshot ist ansichtsunabhängig. Zwei Zeilen (Kunden / Creator) mal vier Spalten: **Gestellt**, **Bezahlt**, **Offen**, **Noch nicht gestellt**. Im UI heißt es einheitlich „Bezahlt" (CONTEXT.md), auch wenn die Speicherung kundenseitig `ueberwiesen_am` und creatorseitig `status = 'Bezahlt'` heißt.

- **Kundenseitig:** gestellt = Summe gestellter Teilrechnungen plus Aufträge mit `rechnung_gestellt_am`; bezahlt = `ueberwiesen_am` gesetzt; noch nicht gestellt = `nettobetrag` minus Summe gestellter Teile (Restbetrag-Logik, Entwürfe ausgenommen). Wie in `PaymentRowStatus.js` sind die Datumsfelder maßgeblich, die Boolean-Flags (`rechnung_gestellt`, `ueberwiesen`) nur Fallback — sie können veraltet sein. Eine bezahlte, aber nicht als gestellt markierte Zeile zählt als beides, sonst bricht die Identität.
- **Creatorseitig:** gestellt = Summe der Creatorrechnungen mit derselben Betragsdefinition wie die Matrix (Honorar + KSK + Zusatzkosten); bezahlt = `status = 'Bezahlt'` (Fallback: `bezahlt_am` gesetzt, falls der Status nicht nachgezogen wurde); noch nicht gestellt = die bestehende Sonderzeile `nochNichtFakturiert` (Restbetrag je Kooperation).
- **Überfällig** ist eine rote Teilzahl innerhalb von „offen", keine eigene Spalte: kundenseitig `re_faelligkeit` überschritten und nicht überwiesen (Logik aus `PaymentRowStatus.js`), creatorseitig analog über `zahlungsziel`.
- Snapshot „Stand heute", bewusst ohne Zeitraumfilter.

### Schritt 6 — Visuelles Aufräumen der Stakeholder-Seite

Nur `/stakeholder`, CI (Farben, Typo) bleibt unangetastet. Alle Tabellen — zuerst „Kunden nach Umsatz", das bei kleineren Breiten über die Karte hinausschießt — bekommen horizontal scrollbare Container mit Mindestspaltenbreiten. Das Muster existiert bereits: `.stakeholder-scroll-x` bei der Monatsmatrix wird konsequent auf die Kalkulations-Tabellen angewendet, und zwar als Wrapper um die Tabelle, damit der Karten-Titel beim Scrollen stehen bleibt. Dazu Kartenhierarchie, Abstände und Toggle-Styling aufräumen sowie ein Zeilen-Hover auf den Tabellen — der Sinn des Schritts ist Scannbarkeit.

**Visual-Pass (beschlossen 2026-09-09):** Moderneres Erscheinungsbild ausschließlich über vorhandene Design-Tokens, kein CI-Umbau.

- **Brand-Pink sparsam aktivieren:** Die Seite nutzt überall `var(--color-primary, #e83e8c)`, doch `--color-primary` ist als `gray-900` definiert — das intendierte Pink greift nie. Reparatur auf die echte Brand-Farbe (`--color-brand`), nur an den Stellen, die heute schon Akzente tragen: aktiver Tab, Fortschrittsbalken, Accent-Kartenwerte. Die App bleibt monochrom, die Seite bekommt einen bewussten Akzent.
- **Elevation und Radien:** Karten bekommen `--shadow-xs`/`--shadow-sm` bei haarfarbenem Border und 12px Radius (`--radius-xl`), wie es `components.css` und `forms.css` bereits vormachen.
- **Typo-Hierarchie:** KPI-Werte deutlich größer (`--text-xxl`/`--text-xxxl`, tabular-nums), Labels kleiner und gedämpfter; mehr Weißraum zwischen den Sektionen.
- **Semantische Farben:** Differenz-Werte grün bei positiv, rot bei negativ (bisher nur rot). Sonderzeilen werden eine kompakte Warnleiste (`--amber-50`-Fläche) statt gestrichelter Karten.
- **Struktur:** Sticky Toolbar, damit der Ansicht-Umschalter beim Scrollen stehen bleibt; Tabellen-Zeilen verdichtet.
- **Bewusst nicht:** Delta-Badges gegenüber dem Vormonat. Die Monatswerte ändern sich rückwirkend durch nachlaufende Creatorrechnungen (ADR 0006); ein Δ-Chip suggerierte eine Endgültigkeit, die es nicht gibt. Kommt frühestens mit den Berichtsständen (Schritt 7), wo ein eingefrorener Stand verglichen werden darf.

### Schritt 7 — Berichtsstände ✅ umgesetzt

Neue Tabelle `berichtsstand` (Migration `20260909_berichtsstand`): `label`, `daten` (jsonb), `created_by`, `created_at`. RLS: lesen und sichern nur Admins — die Seite ist admin-only. Bewusst kein UPDATE/DELETE: ein Berichtsstand ist ein Beleg; fehlerhafte Stände werden durch einen neuen ersetzt, nicht korrigiert.

Der Payload (`src/modules/stakeholder/berichtsstandStore.js`) ist versioniert (`version: 1`) und enthält die vollständige Monatsauswertung (beide Sichten, alle Metriken) plus den Zahlungsstand — per JSON-Rundlauf garantiert serialisierbar. Die Ansicht rechnet immer live; der Snapshot hält fest, worauf ein verschicktes Update beruhte. Monate einzufrieren wurde verworfen, weil das Nachzügler in falsche Monate verschieben würde.

UI in der Monatsauswertung: eine Leiste mit Auswahl (Live-Ansicht plus gesicherte Stände), Bezeichnungsfeld (Default „Investorenupdate <Monat Jahr>") und Sichern-Button. Ein gewählter Stand ersetzt Matrix, Fremdkosten-Posten, Sonderzeilen und den Zahlungsstand-Block durch die eingefrorenen Werte; ein Banner nennt Datum und Label und weist darauf hin, dass die Live-Werte inzwischen abweichen können. Sicht- und Metrik-Umschalter funktionieren auch auf eingefrorenen Daten, weil beide Sichten im Payload liegen.

**Bewusst nicht:** Delta-Badges gegenüber einem Berichtsstand. Der eingefrorene Stand ist die technische Voraussetzung dafür, die Anzeige selbst ist ein eigener Schritt.

**Tests:** `src/__tests__/Berichtsstand.test.js` (Payload-Form, Sichern, Listen, Laden, Fehler) und drei Seitentests in `StakeholderOverviewPage.test.js` (Leiste sichtbar, Sichern mit versioniertem Payload, eingefrorenes Rendern inklusive Rückweg zur Live-Ansicht).

### Schritt 8 — Adminbereich

- Button in `index.html` innerhalb von `.header-actions`, **links vom** `.education-btn`.
- Route `/admin`, abgesichert über das vorhandene `permissionSystem.isAdmin`.
- Reduzierte Navigation: nur die Punkte, die für die Administration relevant sind.

### Schritt 9 — Datenqualitätsanzeige

Liste der Kampagnen mit einem Pflegegrad, aufklappbar zu den konkreten Mängeln, sortiert nach betroffenem Geldvolumen. Die erste Fassung prüft ausschließlich, was Finanzzahlen verfälscht:

| Prüfung | Stand bei Erstellung |
|---|---|
| Videos ohne Einkaufspreis | 312 |
| Videos ohne Verkaufspreis | 332 |
| Kooperationen mit Rechnung, aber kaum erfasstem Einkauf | 26 (52.166 € fakturiert gegen 9.500 € erfasst) |
| Videos ohne Kampagnenart in gemischten Aufträgen | 159 (387.720 €) |
| Aufträge ohne Kampagnenart-Block | 13 (2.232.163 € Umsatz) |
| Gemischte Aufträge ohne Block-Umsatz | 19 (1.513.891 € Umsatz) |
| Rechnungen mit unmöglichem Rechnungsdatum | 4 (15.940 €) |
| Kooperationen mit offenem Restbetrag | 38 (91.879 €) |

**Gleicher Ein- und Verkaufspreis ist ausdrücklich keine Prüfung.** Bei Influencer-Aufträgen verdient die Agentur über die Fee und reicht den Creatorpreis durch. Belegt über die Creatorrechnungen: Kooperationen mit durchgängig EK gleich VK haben 97,1 % ihres erfassten Einkaufspreises fakturiert, solche mit Spanne 99,5 % — wäre der EK ein kopierter VK, läge die erste Quote weit darunter. Eine solche Prüfung würde 475 Videos und 2,8 Mio. € als verdächtig melden und die Anzeige damit entwerten.

## Testing Decisions

Getestet wird das Ergebnis, nicht der Rechenweg.

1. **Leistungsbereich-Ableitung** — Unit-Test über alle vier Fälle: Contracting über `auftragtype`, kein Block, ein Bereich, mehrere Bereiche. Dazu der Fall, dass zwei Blöcke (`influencer` und `story`) zu **einem** Bereich zusammenfallen und nicht als „Gemischt" gelten dürfen.
2. **Periodisierung** — Integration-Test mit einem Auftrag, dessen Kundenrechnung im März und dessen Creatorrechnung im Juni liegt. Margensicht muss beide im März zeigen, Buchhaltungssicht getrennt in März und Juni.
3. **Vollständigkeit** — Kontrollsumme: die Summe aller Leistungsbereiche inklusive „Gemischt", „Nicht zugeordnet" und der beiden Sonderzeilen muss dem Gesamtumsatz beziehungsweise den Gesamtfremdkosten entsprechen.
4. **Keine Doppelzählung** — Auftrag mit Teilrechnungen darf nicht zusätzlich über `auftrag.nettobetrag` gezählt werden.
5. **Vorzeichen** — Auftrag mit überschrittenem Budget muss einen negativen Restwert liefern, nicht null.
6. **KSK** — Selbstzahler-Kooperation darf keine zusätzlichen 4,9 % erzeugen.
7. **Zahlungsstand** — Rechnung mit `ueberwiesen_am` zählt zu „bezahlt", nicht zu „offen"; überfällig nur bei überschrittener Fälligkeit ohne Zahlung. Die Identität „gestellt = bezahlt + offen" muss je Seite immer aufgehen. Kundenseitig gilt außerdem exakt „gestellt + noch nicht gestellt = Auftrags-Nettobetrag". Creatorseitig gilt das bewusst nur näherungsweise: „gestellt" enthält die volle Fremdkosten-Last inklusive berechneter KSK, der Restbetrag in „noch nicht gestellt" ist dagegen honorar-basiert (dieselbe Definition wie die Sonderzeile der Monatsauswertung) — die Summe weicht also um die KSK auf den Restbetrag ab. Zwei verschiedene Restbetrag-Definitionen auf einer Seite wären schlimmer als diese bewusste Asymmetrie.

### Prior Art

- `src/__tests__/StakeholderOverviewPage.test.js` — bestehende Tests der Übersicht
- `src/modules/auftrag/logic/InvoiceDisplayDate.js` — Datumskaskade für Kundenrechnungen
- `src/modules/auftrag/AuftragCashFlowCalendar.js` — monatliche Aggregation über `auftrag` und `auftrag_teilrechnung`, dieselbe Mechanik in kleinerem Rahmen
- `src/core/budget/kskSelbstzahler.js` — KSK-Satz und Selbstzahler-Logik
- Vitest, `vi.fn()` für Supabase-Mocks

## Out of Scope

- Teilrechnungen für Creatorrechnungen ([ADR 0004](adr/0004-teilrechnungen-ueber-restbetrag.md), [ADR 0005](adr/0005-teilrechnungen-kunde-geplant-creator-frei.md)) — eigenes Vorhaben, nicht Teil dieser Übersicht.
- Prozessmängel in der Datenqualitätsanzeige: fehlende Freigaben, überfällige Deadlines, fehlende Verträge. Kommen dazu, wenn die Teams die Anzeige mitbenutzen.
- Zugang der Teams zur Datenqualitätsanzeige. Zunächst nur Administration.
- Der vollständige Adminbereich mit allen heruntergebrochenen Seiten von Dashboard bis KI-Nutzung. Schritt 6 legt nur die Hülle und die Navigation an.
- Nachpflegen der Daten selbst. Die Anzeige benennt die Fälle, korrigiert werden sie von den Teams.

## Further Notes

- **Vorgemerkt — Cash-Sicht:** Eine dritte Sicht in der Monatsauswertung, die nach Zahlungseingang periodisiert (kundenseitig `ueberwiesen_am`, creatorseitig `bezahlt_am`, Zukunft nach `erwarteter_monat_zahlungseingang`), wurde bewusst verschoben. Der `AuftragCashFlowCalendar` bildet dieselbe Mechanik bereits ab; perspektivisch gehört er in die Stakeholder-Sicht integriert, statt ein zweites Cashflow-Modul daneben zu bauen.
- **Offen:** Ob die KSK auf jede Creatorrechnung anfällt, ist bei der Buchhaltung angefragt. Möglich sind Ausnahmen für Creator im Ausland, Agenturen statt Einzelpersonen oder Kleinunternehmer. Das Feld `rechnung.ksk_pflichtig` existiert, ist aber nur bei 2 von 772 Rechnungen gesetzt und taugt nicht als Filter. Bis zur Antwort rechnet die Auswertung mit der bekannten Regel (4,9 % aufs Honorar, die 3 Selbstzahler ausgenommen); meldet die Buchhaltung Ausnahmen, bekommt der Creator ein gepflegtes Merkmal und die Berechnung folgt ihm.
- Nur 52 % der `auftrag_kampagnenart_blocks` haben einen `umsatz_netto`. Solange das so bleibt, lassen sich gemischte Aufträge nicht anteilig aufteilen und landen im Sammelposten „Gemischt". Die Nachpflege betrifft 19 Aufträge.
- Die Felder `auftrag.influencer_preis`, `ugc_preis` und `vor_ort_preis` sind bei 0 von 157 Aufträgen befüllt. Sie kommen als Verteilschlüssel nicht in Frage und sind Kandidaten zum Entfernen.
- Ein Nachlauf ist der Normalfall, kein Sonderfall: nur 16,5 % des Einkaufsvolumens trifft im selben Monat ein wie die zugehörige Kundenrechnung, 77,4 % später.
