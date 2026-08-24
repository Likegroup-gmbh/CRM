-- Skript-Master-Regelwerk (aus Master.pdf) + Markdown-Ausgabe
--   skript_master: versionierte Docs (basis + 3 Briefing-Bereiche)
--   skripte.bereich / skripte.inhalt_md: neue Generator-Ausgabe
--   Dual-Mode: Alt-Skripte bleiben bei hook/hauptteil/cta

CREATE TABLE IF NOT EXISTS skript_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bereich varchar NOT NULL CHECK (bereich IN ('basis','owned_social','paid_creator_ads','influencer_marketing')),
  name varchar NOT NULL,
  version int NOT NULL DEFAULT 1,
  inhalt text NOT NULL,
  status varchar NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf','aktiv','archiviert')),
  freigegeben_von uuid,
  freigegeben_am timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skript_master_bereich_status ON skript_master(bereich, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skript_master_one_aktiv ON skript_master(bereich) WHERE status = 'aktiv';

CREATE TRIGGER skript_master_updated_at BEFORE UPDATE ON skript_master
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE skript_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY skript_master_select ON skript_master FOR SELECT USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_master_insert ON skript_master FOR INSERT WITH CHECK ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_master_update ON skript_master FOR UPDATE USING ((SELECT is_admin_or_mitarbeiter()));
CREATE POLICY skript_master_delete ON skript_master FOR DELETE USING ((SELECT is_admin_or_mitarbeiter()));

ALTER TABLE skripte
  ADD COLUMN IF NOT EXISTS bereich varchar CHECK (bereich IS NULL OR bereich IN ('owned_social','paid_creator_ads','influencer_marketing')),
  ADD COLUMN IF NOT EXISTS inhalt_md text;

ALTER TABLE skript_versionen
  ADD COLUMN IF NOT EXISTS inhalt_md text;

ALTER TABLE skript_feedback DROP CONSTRAINT IF EXISTS skript_feedback_sektion_check;
ALTER TABLE skript_chat_messages DROP CONSTRAINT IF EXISTS skript_chat_messages_sektion_check;

-- Seed v1 aus Master.pdf (idempotent)
INSERT INTO skript_master (bereich, name, version, inhalt, status)
SELECT 'basis',
  'Basis (übergreifend)',
  1,
  $master$
# Master-Learning-Dokument für Social-Video-Content

## Zweck und Systemgrenze

Dieses Dokument definiert die strategischen und kreativen Regeln für drei
unterschiedliche Ausgabesysteme:

1. **Owned Media / Organic Content:** Inhalte für die eigenen Social-Media-
Kanäle.
2. **Paid Ads:** Performance-Creatives für Upper-, Mid- und Low-Funnel.
3. **Influencer-Marketing:** creatorfähige Konzepte statt ausformulierter Wort-für-
Wort-Skripte.

Diese drei Systeme dürfen nicht vermischt werden. Ein organisches Video, eine Paid Ad
und ein Influencer-Konzept können dasselbe Produkt behandeln, verfolgen aber andere
Ziele, folgen anderen Bewertungslogiken und benötigen andere Outputs.

Vorgelagerte Eingabe- und Erfassungsprozesse sind nicht Bestandteil dieses
Dokuments. Der Generator verwendet den bereits vorhandenen strategischen Kontext
und darf fehlende Produktfakten, Claims, Preise, Angebote, Bewertungen oder
Eigenschaften niemals erfinden.

---

---

# Strategische Übergabe der Videoidee

## Zweck

Der Skriptgenerator erfindet die strategische Aufgabe eines Videos nicht neu. Er
übernimmt eine bereits entwickelte Videoidee und übersetzt sie in ein drehfähiges
Owned-Media-Skript, eine Paid Ad oder ein Influencer-Konzept.

Die Videoidee besitzt eine stabile strategische Kernidee. Die konkrete Umsetzung kann
anschließend mit oder ohne bereits zugewiesenen Creator entstehen.

## Zwei zulässige Entstehungswege

### Idee zuerst

```text
Strategische Videoidee
→ Creator zunächst offen
→ Creator später verknüpfen
→ Idee auf Creator adaptieren
→ Konzept oder Skript
```

### Creator zuerst

```text
Creator bereits zugewiesen
→ Videoidee aus Strategie und Creator-DNA entwickeln
→ Konzept oder Skript
```

Beide Wege sind gleichwertig. Der Generator darf nicht voraussetzen, dass bei jeder
Idee bereits ein Creator feststeht.

## Creator-Status einer Videoidee

Jede Videoidee hat genau einen Status:

- **Creator offen:** Die strategische Kernidee ist creatorunabhängig formuliert. Es wird
kein bestimmter Creator, keine persönliche Erfahrung und keine individuelle Creator-
DNA erfunden.
- **Creator zugewiesen:** Die Umsetzung wird auf den verknüpften Creator, seine
tatsächlichen Formate, seine Sprache, seine Community und seine realistisch
produzierbaren Settings angepasst.

Ein zusätzliches Creator-Suchprofil ist nicht Bestandteil der Skriptausgabe.

## Kernidee und Creator-Umsetzung trennen

### Stabile Kernidee

Diese Bestandteile bleiben bei einer späteren Creator-Verknüpfung grundsätzlich
erhalten:

- Produkt und relevante Persona,
- Owned, Paid oder Influencer,
- bei Paid: Funnel und Awareness-Level,
- offene Entscheidung beziehungsweise Kommunikationsaufgabe,
- Angle und Kernbotschaft,
- notwendiger Proof,
- bestätigte Claims,
- Kampagnenziel und erforderlicher CTA.

### Adaptive Creator-Umsetzung

Diese Bestandteile dürfen auf den Creator angepasst werden:

- Hook-Formulierung,
- Story und persönlicher Einstieg,
- Format,
- Tonalität und Sprachrhythmus,
- Humor und Energie,
- Setting und Alltagssituation,
- Creator-Handlungen,
- visuelle Inszenierung,
- natürliche Produktintegration.

Die Adaption darf die strategische Kernidee nicht unbemerkt verändern. Wenn ein
Creator nicht glaubwürdig zur Idee oder zum notwendigen Proof passt, muss der
Generator den Konflikt markieren, statt eine Erfahrung zu erfinden.

## Eine Idee, mehrere Creator-Umsetzungen

Eine strategische Videoidee kann mit mehreren Creatorn umgesetzt werden. Dafür wird
die Kernidee nicht dupliziert; es entstehen getrennte Creator-Umsetzungen:

```text
Kernidee
├── Umsetzung Creator A
├── Umsetzung Creator B
└── Umsetzung Creator C
```

Jede Umsetzung darf eine eigene Hook, Story, Sprache und Inszenierung besitzen.
Produktwahrheit, strategischer Zweck und bestätigte Claims bleiben konsistent.

## Adaption nach späterer Creator-Zuweisung

Wird einer offenen Idee später ein Creator zugewiesen, führt das System einen eigenen
Adaptionsschritt aus:

1. Kernidee und unveränderliche Bestandteile sichern.
2. tatsächliche Creator-DNA und Produktionsrealität berücksichtigen.
3. Creator-Fit und Proof-Fähigkeit prüfen.
4. Hook, Story, Setting, Sprache und visuelle Umsetzung anpassen.
5. neue Creator-Umsetzung als eigene Version speichern.
6. ursprüngliche offene Idee erhalten.

Die Funktion heißt in der Oberfläche sinngemäß:

> „Videoidee auf diesen Creator adaptieren“

## Modusspezifische Anwendung

### Owned Media

Bei offenem Creator-Status entsteht ein kanal- und markengerechtes Skript ohne
erfundene persönliche Biografie. Bei Zuweisung wird die Performance auf die reale
Person oder den realen Host angepasst.

### Paid Ads

Die strategische Paid-Logik bleibt unabhängig vom Darsteller stabil. Bei Creator-
Zuweisung werden Sprache, Setting und Performance angepasst; Funnel, offene
Entscheidung, Proof, Offer und Testlogik bleiben erhalten.

### Influencer-Marketing

Eine offene Idee kann als strategische Konzeptidee bestehen. Die finale Influencer-
Ausarbeitung erfolgt creatorbezogen. Erst nach Zuweisung dürfen Creator-Fit,
Community-Fit, persönliche Story und typische Formate konkret ausgearbeitet werden.

## Qualitätscheck der strategischen Übergabe

- Ist Creator offen oder zugewiesen eindeutig gekennzeichnet?
- Wird bei offenem Status keine Creator-DNA erfunden?
- Ist bei zugewiesenem Status der Creator-Fit konkret erkennbar?
- Bleibt die Kernidee bei der Adaption erhalten?
- Werden persönliche Erfahrungen nur verwendet, wenn sie bestätigt sind?
- Kann eine weitere Creator-Umsetzung entstehen, ohne die Kernidee zu duplizieren?
- Bleibt bei Paid die Funnel- und Testlogik stabil?
- Bleibt bei Influencer genügend Creator-Freiheit erhalten?

---

# Gemeinsame Schutzregeln

- Keine Produktfakten, Preise, Offers, Bewertungen oder Ergebnisse erfinden.
- Starke Claims benötigen starke Belege.
- Creator-Erfahrung nicht simulieren.
- Keine erfundene Knappheit, falscher Social Proof oder irreführende Dringlichkeit.
- Hook-Versprechen vollständig einlösen.
- Zuschauer- und Entscheidungsnutzen vor Creator- oder Markenego stellen.
- Gesprochenes, Text und Visuals auf eine Hauptbotschaft ausrichten.

- Compliance vor Produktion prüfen, besonders bei Gesundheit, Ernährung, Kosmetik,
Finanzen, Vorher/Nachher und Konkurrenzvergleichen.
- Annahmen kennzeichnen.
- Performance-Learnings nur mit Kontext, Confidence-Level und Gültigkeitsbereich
speichern.

---

# Kategorie-Übersetzungsschicht

## Warum ein universelles Framework eine Übersetzungsschicht braucht

Die Grundlogik aus Hook, Zuschauerwert, Story/Argumentation, Proof und nächster
Handlung funktioniert branchenübergreifend. Ihre konkrete Ausführung darf jedoch
nicht identisch sein.

Ein Versicherungsprodukt kann selten in drei Sekunden vollständig demonstriert
werden. Food kann häufig über sofortige Sinnlichkeit funktionieren. Gaming benötigt
echtes Gameplay oder Unterhaltung. Fashion verkauft neben Funktion vor allem Stil,
Identität und Kombination. Tech benötigt je nach Produkt sichtbare Demonstration,
Spezifikation oder Vergleich.

Deshalb wird vor der Anwendung von Owned-, Paid- oder Influencer-Regeln ein
Kategorieprofil bestimmt.

## Die fünf Kategorie-Dimensionen

### 1. Erklärungsbedarf

- **Niedrig:** Produkt und Nutzen werden unmittelbar verstanden, beispielsweise
Snack, Kleidung oder einfaches Haushaltsprodukt.

- **Mittel:** Funktionsweise oder Differenzierung benötigt Kontext, beispielsweise
Airfryer, Kosmetikroutine oder Fitnessgerät.
- **Hoch:** Produkt ist abstrakt, risikobehaftet oder mehrstufig, beispielsweise
Versicherung, Finanzprodukt, B2B-Software oder komplexe Dienstleistung.

Je höher der Erklärungsbedarf, desto wichtiger sind klare Auswahlkriterien, konkrete
Szenarien, Vereinfachung ohne Verfälschung und ein passender Zwischenschritt statt
eines vorschnellen Kauf-CTAs.

### 2. Primäre Beweisart

- **Sensorisch:** Aussehen, Geschmackserwartung, Textur, Sound oder Genuss.
- **Visuell-demonstrierbar:** Anwendung und Ergebnis sind direkt sichtbar.
- **Technisch/funktional:** Messwert, Spezifikation, Vergleich oder reales
Nutzungsszenario.
- **Erfahrungsbasiert:** glaubwürdige Nutzung über Zeit, Routine oder Testimonial.
- **Vertrauensbasiert:** Expertise, Transparenz, Prozess, Bedingungen oder
Risikoaufklärung.
- **Unterhaltungsbasiert:** Gameplay, Erlebnis, Humor oder kulturelle Beteiligung.

Der Generator wählt die Beweisform nach Produktrealität. Er darf keine visuelle
Sofortwirkung erfinden, wenn der Nutzen erst langfristig oder abstrakt entsteht.

### 3. Kaufzyklus und Risiko

- **Impuls:** geringer Preis und niedrige wahrgenommene Fehlentscheidung.
- **Vergleichskauf:** mehrere Optionen, mittleres Involvement.
- **Beratung/Lead:** hoher Erklärungsbedarf oder individuelles Angebot.
- **Langfristige Bindung:** Vertrag, Abo, Finanzierung oder hoher Wechselaufwand.

Je größer Risiko und Bindung, desto stärker müssen Qualifizierung, Transparenz,
Einwandbehandlung und ein realistischer CTA sein.

### 4. Emotionaler Haupttreiber

- Genuss,
- Bequemlichkeit,
- Identität und Status,
- Leistung und Fortschritt,
- Sicherheit und Kontrolle,
- Zugehörigkeit und Community,
- Unterhaltung und Eskapismus,
- Sparen oder Effizienz,
- Fürsorge und Vertrauen.

Der emotionale Treiber bestimmt Ton und Story. Er ersetzt keine sachliche
Produktwahrheit.

### 5. Regulierung und Sensibilität

- **Normal:** allgemeine Konsumprodukte ohne besondere Claim-Sensibilität.
- **Erhöht:** Beauty, Fitness, Nahrungsergänzung, Nachhaltigkeit, Kinder-
/Jugendansprache oder Alkohol.
- **Stark reguliert/sensibel:** Versicherung, Finanzen, Gesundheit/Medizin,
Glücksspiel, Politik, Wohnen, Beschäftigung oder andere plattformseitig eingeschränkte
Kategorien.

Bei sensiblen Kategorien prüft das System vor der kreativen Ausarbeitung aktuelle
Plattformregeln, Zielmarkt, erforderliche Zertifizierung, Targeting-Grenzen,
Pflichtangaben und zulässige Claims. Eine allgemeine Creative-Regel darf keine aktuelle
Rechts- oder Policy-Prüfung ersetzen.

## Praxiscluster und passende Creative-Logik

| Cluster | Beispiele | Primärer Creative-Hebel | Typischer Proof | Häufiges Risiko |
|---|---|---|---|---|
| Genuss und schneller Konsum | Food, Getränke, Restaurant | Sinnlichkeit, Anlass,
Rezept, Reaktion, Humor | Zubereitung, Textur, Geschmackssituation | nur hübsche
Bilder ohne Produktgrund |
| Stil und Identität | Fashion, Schmuck, Beauty, Lifestyle | Transformation, Styling,
Zugehörigkeit, Selbstbild | Try-on, Kombination, Anwendung, reales Ergebnis |
austauschbare Ästhetik oder unzulässige Wirkungsaussage |
| Funktion und Demonstration | Tech, Haushalt, Automotive, Tools | Problem-Lösung,
Test, Vergleich, überraschende Funktion | Live-Demo, Messwert, Use Case | Feature-
Liste ohne Alltagsnutzen |
| Leistung und Fortschritt | Fitness, Sport, Wellness | Routine, Motivation, Fortschritt,
Community | Anwendung, Training, dokumentierte Erfahrung | unrealistische
Transformation oder Health Claim |
| Entertainment und Erlebnis | Gaming, Apps, Medien, Events | Unterhaltung, Challenge,
Reaktion, Community-Code | echtes Gameplay, Feature, Erlebnis | inszeniertes
Gameplay oder Werbung ohne Unterhaltungswert |
| Vertrauen und Absicherung | Versicherung, Finanzen, Recht, Healthcare | Klarheit,
Szenario, Risikoaufklärung, Expertise | nachvollziehbares Beispiel, Bedingungen,
Prozess, Autorität | Vereinfachung bis zur Irreführung; fehlende Pflichtangaben |
| Komplexe Lösung und Lead Gen | B2B, SaaS, Bildung, Professional Services | konkreter
Pain, Workflow, Ergebnis, Case | Produktdemo, Prozess, Fallbeispiel, Zeitersparnis |
abstrakte Buzzwords und zu früher Sales-CTA |
| Ort und Buchung | Travel, Hospitality, Immobilien, lokale Services | Erlebnis,
Vorstellung, Vertrauen, Verfügbarkeit | Tour, echte Umgebung, Ablauf, Bewertung |
schöne Inspiration ohne Buchungsinformation |
| Handel und Sortiment | Retail, E-Commerce, Telekommunikation | Auswahl, Preis-
Leistung, Neuheit, Convenience | Sortiment, Vergleich, Offer, Verfügbarkeit |
Angebotsüberladung oder falsche Dringlichkeit |
| Gesellschaft und Mission | Non-Profit, Regierung, gesellschaftliche Themen |
Bedeutung, Wirkung, Beteiligung, Vertrauen | transparente Wirkung, reale Geschichte,
Daten | Emotionalisierung ohne klare Handlung oder Nachweis |

Diese Cluster sind kombinierbar. Ein Fitness-Abo kann gleichzeitig „Leistung“,
„komplexe Lösung“ und „langfristige Bindung“ sein. Der Generator wählt einen primären
und gegebenenfalls einen sekundären Cluster.

## Tonalität ist unabhängig von der Kategorie

Komplexe Kategorien müssen nicht automatisch trocken sein. Ein einfaches Produkt
muss nicht automatisch lustig sein. Die Tonalität wird separat gewählt:

- sachlich und vertrauensbildend,
- erklärend und vereinfachend,
- emotional und menschlich,
- aspirational und hochwertig,
- nativ und beiläufig,
- schnell, direkt und performanceorientiert,
- humorvoll, absurd oder bewusst „stumpf“,
- kontrovers oder meinungsstark,
- community-intern und referenzreich.

### Regeln für humorvollen oder „stumpfen“ Content

- Der Witz muss ohne lange Erklärung funktionieren.
- Das Produkt kann Requisite, Auslöser, Lösung oder Payoff sein.
- Audio-, Text- und Visual-Hook dürfen bewusst simpel sein.
- Marken- und Produktzuordnung dürfen trotz Humor nicht verloren gehen, besonders
bei Paid.
- Der Humor darf nicht auf Kosten sensibler Personengruppen, falscher
Produktbehauptungen oder regulatorischer Grenzen entstehen.

- Hohe Unterhaltung ist kein Conversion-Beweis; bei Paid muss mindestens
Produktverständnis oder klare Zuordnung bestehen.

### Regeln für komplexen Content

- Nur eine Entscheidung oder ein Teilproblem pro Video.
- Abstrakte Begriffe in konkrete Situationen übersetzen.
- Fachsprache nur verwenden, wenn die Zielgruppe sie versteht.
- Bedingungen und Einschränkungen nicht für eine stärkere Hook verstecken.
- CTA dem Entscheidungsrisiko anpassen: Rechner, Beratung, Vergleich oder weitere
Information können sinnvoller sein als „jetzt kaufen“.
- Komplexität reduzieren, ohne relevante Wahrheit zu entfernen.

## Category Routing vor jeder Ausgabe

Vor der Erstellung ordnet der Generator das Vorhaben intern ein:

1. primärer und sekundärer Praxiscluster,
2. Erklärungsbedarf,
3. notwendige Beweisart,
4. Kaufzyklus und wahrgenommenes Risiko,
5. emotionaler Haupttreiber,
6. Regulierung/Sensibilität,
7. geeignete Tonalität,
8. für diese Kategorie ungeeignete Creative-Abkürzungen.

Danach wird das passende System angewendet: Owned Media, Paid nach Funnel oder
Influencer-Konzept.

## Kategorie-Stresstest vor Freigabe

- Wird die reale Kauf- und Nutzungssituation dieser Kategorie verstanden?
- Passt die Beweisart zum tatsächlichen Nutzen?
- Ist die Tonalität passend, aber nicht klischeehaft?
- Funktioniert das Konzept auch bei einem abstrakten oder nicht sichtbaren Produkt?
- Ist bei visuellen Produkten das Ergebnis früh genug erkennbar?
- Ist bei Entertainment das Erlebnis selbst überzeugend?
- Ist bei Services der Prozess oder Outcome konkret genug?
- Ist bei hohem Risiko der CTA realistisch?
- Sind aktuelle Plattform-, Markt- und Claim-Grenzen geprüft?
- Bleibt die Marke bei humorvollen Konzepten zuordenbar?
- Wird bei komplexen Konzepten nur eine Hauptentscheidung bearbeitet?

## Urteil zur universellen Einsetzbarkeit

Das Framework ist nicht deshalb universell, weil jedes Video gleich aufgebaut wird. Es
ist universell, weil es je nach Kategorie andere Werte für Beweis, Ton, Risiko, Kaufzyklus
und CTA einsetzt.

Damit deckt es sowohl einfache, visuelle und humorvolle Produkte als auch
erklärungsbedürftige, abstrakte und regulierte Angebote ab. Eine vollständige Garantie
für „jede Kategorie“ wäre dennoch unseriös: Neue Plattformregeln, lokale Gesetze und
produktspezifische Einschränkungen müssen bei sensiblen Verticals jeweils aktuell
geprüft werden.
$master$,
  'aktiv'
WHERE NOT EXISTS (
  SELECT 1 FROM skript_master WHERE bereich = 'basis' AND version = 1
);

INSERT INTO skript_master (bereich, name, version, inhalt, status)
SELECT 'owned_social',
  'Owned Media / Organic Content',
  1,
  $master$
# Abschnitt 1: Owned Media / Organic Content

## 1.1 Ziel und Leitfrage

Owned Media baut auf den eigenen Kanälen Aufmerksamkeit, Relevanz,
Wiedererkennbarkeit, Community und Vertrauen auf. Der Zuschauer entscheidet
freiwillig, ob er bleibt.

> Warum würde die Zielgruppe dieses Video auch dann ansehen, wenn es nicht von der
Marke käme?

## 1.2 Primäre Wertmechanik

Jedes Video bestimmt eine dominierende Wertmechanik:

- **Entertainment:** lustig, überraschend, emotional, spannend, relatable oder
kulturell relevant.
- **Utility/Education:** Wissen, Anleitung, Einordnung, Problemlösung, Inspiration oder
Entscheidungshilfe.
- **Identität/Community:** Zugehörigkeit, geteilte Erfahrung, Haltung oder
Nischensprache.

Eine Kombination ist möglich. Trotzdem muss klar sein, weshalb die Person primär
zuschaut.

## 1.3 Zielgruppen- und Themenlogik

Themen entstehen aus Zielgruppeninteresse, nicht aus interner Markenlogik. Relevante
Quellen sind:

- Probleme und Alltagssituationen,
- Fragen und Missverständnisse,
- Wünsche, Erfahrungen und Transformationen,
- Kommentare, Suchverhalten und Community-Sprache,
- Nischentrends und kulturelle Momente,
- erfolgreiche Formate relevanter Creator,
- eigene Daten und Content-Learnings.

**Leitfrage:** Wie würde ein glaubwürdiger Nischencreator dieses Thema seiner
Community erzählen oder zeigen?

## 1.4 Die dreifache Hook

Die Hook besteht aus drei abgestimmten Ebenen:

1. **Audio-Hook:** erster gesprochener Gedanke, Sound oder Geräusch.
2. **Text-Hook:** schnell erfassbare Einordnung oder Nutzeninformation.
3. **Visual-Hook:** Gesicht, Bewegung, Konflikt, Ergebnis, Produkt, Transformation
oder unerwartete Situation.

Alle Ebenen verstärken dieselbe Erwartung. Der Einstieg beantwortet schnell:

- Worum geht es?
- Warum ist es relevant?
- Welchen Nutzen, Konflikt oder Payoff liefert das Video?

Zu vermeiden sind austauschbare Begrüßungen, Kontext vor Relevanz und künstliches
Clickbait. Schwache Einstiege sind beispielsweise „Heute möchte ich euch etwas
zeigen“ oder „Ich habe etwas entdeckt“.

## 1.5 Retention-Vertrag

Die Hook schließt einen inhaltlichen Vertrag. Der Hauptteil muss genau dieses
Versprechen erfüllen. Jeder Abschnitt muss mindestens eine Funktion erfüllen:

- neue Information liefern,
- Spannung sinnvoll weiterentwickeln,
- etwas sichtbar beweisen,

- emotionale Beteiligung erhöhen,
- die angekündigte Frage beantworten.

Der Payoff wird nicht künstlich hinausgezögert. Ein früher Teil-Payoff kann eine nächste
relevante Frage öffnen. Schnitt, Zoom, Text und Sound unterstützen inhaltlichen
Fortschritt, ersetzen ihn aber nicht.

## 1.6 Story statt Präsentation

Starker organischer Content zeigt konkrete Situationen:

- reales Erlebnis,
- beobachtbares Problem,
- Versuch oder Test,
- Entscheidung,
- Fehler und Folge,
- Vorher-nachher-Zustand,
- überraschende Erkenntnis.

Die Story dient dem Thema. Nicht jedes Video benötigt eine lange Vorgeschichte oder
Heldenreise.

## 1.7 Wiederholbare Formate

Owned Media wird nicht als Sammlung zufälliger Einzelvideos geplant. Wiederholbare
Format-Hypothesen sind beispielsweise:

- POV oder Storytime,
- Ranking oder Reaction,
- Experiment oder Tutorial,

- Kommentarantwort,
- Mythos gegen Demonstration,
- Test unter konstanten Bedingungen,
- „Für wen lohnt es sich?“,
- Vorher/Nachher mit Beleg.

Ein Format ist ein wiedererkennbarer Erwartungsrahmen, keine starre Hook-Schablone.

## 1.8 Interaktions- und Teilbarkeitslogik

Interaktion entsteht aus dem Inhalt:

- **Share:** Eine Person denkt unmittelbar an jemand anderen.
- **Save:** Der Inhalt bleibt als Anleitung, Referenz oder Liste nützlich.
- **Comment:** Es existiert eine echte Erfahrung, Wahl oder Meinungsdifferenz.
- **Rewatch:** Das Video enthält relevante Details oder verständlich verdichtete
Information.

Kontroverse darf eine reale Haltung schärfen. Sie darf nicht durch erfundene Empörung,
unnötige Angriffe oder falsche Gegensätze erzeugt werden.

## 1.9 Rolle von Marke und Produkt

Für Owned Media gilt keine starre Sekundenvorgabe:

- Marke oder Produkt dürfen von Beginn an natürlich sichtbar sein.
- Die explizite Nennung erfolgt, sobald sie für Verständnis, Erinnerung oder Story
notwendig ist.
- Eine künstliche Markenenthüllung ist kein Retention-Trick.

- Ein Logo-Intro ersetzt keinen inhaltlichen Einstieg.
- Produktcontent benötigt eigenständigen Zuschauerwert.

Vier Signale werden getrennt geplant: Kategorie-Cue, visuelle Produktpräsenz, Brand-
Cue wie Packaging oder Logo sowie explizite gesprochene oder geschriebene Nennung.

## 1.10 Natürliche Sprache und Produzierbarkeit

Das Skript wird für gesprochene Performance geschrieben:

- kurze, sprechbare Gedanken,
- Wortwahl des Kanals oder Creators,
- keine unnötigen Nebensätze,
- keine austauschbare Werbesprache,
- sichtbare Handlungen statt rein verbaler Beschreibung.

Vor Freigabe wird geprüft, ob die entscheidenden Szenen und Beweise produziert
werden können.

## 1.11 Organic-Sourcing und Lernen

Wöchentlich werden Nischencreator, überdurchschnittliche Nischenvideos,
Kommentare, Community-Fragen, wiederkehrende Formate sowie eigene Gewinner und
Verlierer analysiert.

Nicht Wortlaut oder unverwechselbare Inszenierung kopieren. Abstrahiert werden
Zielgruppen-Insight, Wertmechanik, Format, Spannungsstruktur, Beweisart und
Teilbarkeitsgrund. Ein virales Video ist ein Aufmerksamkeitssignal, aber kein
allgemeingültiger Erfolgsbeweis.

## 1.12 Owned-Media-Ausgabe

Der Generator liefert:

1. Zielgruppen-Insight,
2. Thema und primäre Wertmechanik,
3. Format,
4. Audio-, Text- und Visual-Hook,
5. ausformuliertes, sprechbares Skript,
6. Retention- und Payoff-Momente,
7. Shot-/Visual-Vorschläge,
8. natürlichen Interaktionsimpuls,
9. Varianten oder nächste Testhypothese.

## 1.13 Owned-Media-Qualitätscheck

- Gibt es sofort einen Grund weiterzuschauen?
- Entsteht das Thema aus Zielgruppeninteresse?
- Ist die Wertmechanik klar?
- Stimmen Audio, Text und Visual Hook überein?
- Erfüllt der Hauptteil das Hook-Versprechen?
- Liefert jeder Retention-Beat neuen Wert?
- Ist der Content konkret, natürlich und produzierbar?
- Gibt es einen echten sozialen Grund für Interaktion?
- Ist das Format wiederholbar, ohne austauschbar zu sein?
- Würde das Video freiwillig konsumiert?

## 1.14 Drehfertiger Aufbau eines Owned-Media-Skriptkonzepts

Das Ergebnis muss so konkret sein, dass Creator, Social-Team, Kamera und Schnitt
ohne zusätzliche strategische Übersetzung produzieren können. Trotzdem soll der
Creator natürlich sprechen dürfen.

### A. Produktionskopf

Der Produktionskopf schafft Orientierung vor dem Dreh:

- **Arbeitstitel:** kurze interne Bezeichnung.
- **Ziel des Videos:** gewünschte Wirkung in einem Satz.
- **Zielgruppe/Community-Situation:** für wen und in welchem Moment?
- **Kernbotschaft:** genau ein Satz, der hängen bleiben soll.
- **Wertmechanik:** Entertainment, Utility/Education oder Identität/Community.
- **Format:** beispielsweise POV, Tutorial, Storytime oder Experiment.
- **Plattform und Format:** etwa Instagram Reel, TikTok oder YouTube Short;
Hochformat 9:16.
- **Ziellänge:** realistische Zeitspanne.
- **Creator-Rolle:** Experte, Tester, Beobachter, Entertainer oder Betroffener.
- **Drehort und benötigte Assets:** Produkt, Requisiten, Screenshots,
Vergleichsobjekte oder B-Roll.
- **Interaktionsziel:** Share, Save, Comment oder Rewatch.

### B. Hook-Paket

Die Hook wird dreifach und drehbar beschrieben:

- **Audio-Hook:** der konkrete erste Satz oder eine natürlich sprechbare Variante.
- **Text-Hook:** kurze Texteinblendung.
- **Visual-Hook:** exakte erste Handlung oder erstes Bild.
- **Erster Frame:** Was muss noch vor dem ersten gesprochenen Wort sichtbar sein?

- **Hook-Payoff:** Was muss das Video später zwingend einlösen?

Optional werden zwei alternative Hooks geliefert, die mit demselben Hauptteil
funktionieren.

### C. Szenenplan

Jede Szene wird in dieser Form ausgegeben:

| Feld | Inhalt |
|---|---|
| Szene/Zeit | Reihenfolge und ungefähre Dauer |
| Funktion | Hook, Kontext, Beweis, Storybeat, Payoff oder Interaktion |
| Gesprochen | sprechbarer Wortlaut oder eng geführte Aussage |
| Creator-Handlung | was die Person konkret tut, zeigt oder demonstriert |
| Bild/Kamera | Einstellung, Perspektive, Bewegung oder Bildwechsel |
| On-Screen-Text | nur notwendiger, kurzer Bildschirmtext |
| B-Roll/Insert | zusätzlich benötigtes Bildmaterial |
| Schnitt/Sound | relevante Pause, Cut, Sound oder Übergang |

Für jede Szene gilt: Gesprochenes, Handlung und Bild dürfen nicht lediglich dieselbe
Information dreifach wiederholen. Das Bild soll zeigen, was Sprache allein nicht leisten
kann.

### D. Abschluss und Payoff

Der Schluss enthält:

- klare Antwort auf die Hook,

- letztes relevantes Bild oder Ergebnis,
- natürlichen Interaktionsimpuls,
- exakten On-Screen-Abschlusstext,
- optionalen Loop-Punkt, falls das Ende sinnvoll zum Anfang zurückführt.

### E. Dreh-Checkliste

- Welche A-Roll-Takes werden benötigt?
- Welche B-Roll- und Detailaufnahmen werden benötigt?
- Welche Ergebnisse oder Zustände müssen vorab vorbereitet werden?
- Welche Texteinblendungen, Screenshots oder Grafiken fehlen noch?
- Welche Aussagen müssen exakt sein und wo darf frei formuliert werden?
- Welche Aussprache, Produktbezeichnung oder Darstellung ist zu beachten?
- Welche Aufnahmen dürfen auf keinen Fall fehlen, damit Hook und Payoff
funktionieren?

### F. Owned-Media-Beispielstruktur

```text
ARBEITSTITEL: Drei Airfryer-Fehler
ZIEL: Saves durch konkrete Anwendungstipps
FORMAT: Schnelles Tutorial
LÄNGE: ca. 25–35 Sekunden

HOOK
Audio: „Diese drei Airfryer-Fehler machen dein Essen unnötig matschig.“
Text: „3 Airfryer-Fehler“
Visual: Creator zeigt direkt ein matschiges und ein knuspriges Ergebnis nebeneinander.
Payoff: Drei klar sichtbare Fehler plus korrigiertes Ergebnis.

SZENE 1 – FEHLER 1
Gesprochen: konkrete Erklärung in einem kurzen Gedanken.
Handlung: falsche Befüllung zeigen, danach richtige Befüllung.
Bild: Close-up von Korb und Luftzwischenräumen.
Text: „1. Zu voll“

SZENE 2 UND 3
Gleiche Logik: Fehler zeigen → kurz erklären → richtige Anwendung beweisen.

ABSCHLUSS
Gesprochen: kurzes Fazit plus natürlicher Save-Impuls.
Visual: fertiges Ergebnis aufbrechen oder probieren.
Text: „Für den nächsten Airfryer-Abend speichern“
```

---
$master$,
  'aktiv'
WHERE NOT EXISTS (
  SELECT 1 FROM skript_master WHERE bereich = 'owned_social' AND version = 1
);

INSERT INTO skript_master (bereich, name, version, inhalt, status)
SELECT 'paid_creator_ads',
  'Paid Ads nach Funnel-Stufen',
  1,
  $master$
# Abschnitt 2: Paid Ads nach Funnel-Stufen

## 2.1 Ziel von Paid Ads

Paid Ads müssen Aufmerksamkeit gewinnen und Verhalten auslösen. Sie verbinden
Aufmerksamkeit der richtigen Person, Retention, Produkt- und Markenverständnis,
glaubwürdigen Beweis, Conversion-Trigger und passenden Call to Action.

Eine Ad gewinnt nicht, weil sie viral ist. Sie gewinnt, wenn sie innerhalb ihres
Kampagnenziels wirtschaftlich relevante Wirkung erzeugt.

## 2.2 Funnel und Awareness

Die Funnel-Stufe beschreibt den Kommunikationsauftrag. Der Awareness-Level
beschreibt das Vorwissen.

| Awareness-Level | Vorwissen | Aufgabe |
|---|---|---|
| Unaware | Problem und Produkt sind nicht bewusst | Symptom, Wunsch oder Relevanz
sichtbar machen |
| Problem-aware | Problem ist bewusst | Lösungsrichtung eröffnen |
| Solution-aware | Lösungskategorie ist bekannt | Mechanismus und Auswahlkriterien
erklären |
| Product-aware | konkretes Produkt ist bekannt | Eignung, Unterschiede und Beweise
liefern |
| Most-aware | Produkt und Angebot sind bekannt | letzte Einwände und
Handlungsreibung reduzieren |

Upper entspricht häufig unaware/problem-aware, Mid häufig problem-/solution-aware
und Low häufig product-/most-aware. Das ist eine Orientierung, keine starre
Gleichsetzung.

## 2.3 Keine Funnel-Regression

Das Skript beginnt beim aktuellen Wissensstand. Es darf die Person nicht unnötig
zurücksetzen.

> „Brauche ich einen Airfryer? Ich habe es getestet.“

Diese Hook ist für Low-Funnel schwach, wenn die Person bereits den Ninja Double
Stack erwägt: Kategorie- statt Produktentscheidung, Creator- statt Zuschauerfokus, kein
Modell, keine Kaufbarriere und kein konkreter Entscheidungsnutzen.

Stärker:

> „Du überlegst, den Ninja Double Stack für zwei Personen zu kaufen? Dann entscheidet
vor allem eine Sache, ob sich der Aufpreis lohnt.“

## 2.4 Upper-Funnel Paid

**Ziel:** Aufmerksamkeit, Relevanz, Problem- oder Wunschbewusstsein und erste
Erinnerung.

**Offene Entscheidung:** „Ist dieses Thema für mich relevant?“

**Einstiege:** Alltagssymptom, Wunsch, Transformation, überraschende Erkenntnis,
emotionaler Konflikt, relatable Situation oder problemöffnende Demonstration.

**Produkt und Brand:** Produkt oder Brand-Cue dürfen ab Beginn natürlich sichtbar
sein. Auch kurze bezahlte Views sollen möglichst zuordenbar bleiben. Die Marke darf die
Hook nicht kontextlos besetzen.

**Beweis:** sichtbares Problem, plausible Erklärung, Transformation oder erste
Demonstration.

**CTA:** niedrigschwellig, etwa entdecken oder mehr erfahren.

**Nicht tun:** mit Detailvergleich, Rabatt oder Modellnummer beginnen, wenn die kalte
Zielgruppe deren Bedeutung noch nicht versteht.

## 2.5 Mid-Funnel Paid

**Ziel:** Lösungsverständnis, Vertrauen und Produktpräferenz.

**Offene Entscheidung:** „Welche Lösung passt zu mir und warum?“

**Einstiege:** Mechanismus, Demonstration, Kategorievergleich, Use Case,
Erfahrungslernen, Mythos oder Alternative.

**Produkt und Brand:** Produkt früh als Lösung oder Demo-Held zeigen. Kategorie und
Marke im Hook oder unmittelbar danach nennen. Modell nennen, wenn es die
Bewertung verändert. Nicht lange beim bekannten Problem bleiben.

**Beweis:** Demonstration, fairer Vergleich, Erfahrung, Spezifikation oder relevanter
Social Proof.

**CTA:** Produkt prüfen, Anwendung ansehen, Varianten vergleichen oder Details
ansehen.

**Nicht tun:** nur unterhalten, ohne Produktmechanismus und Differenzierung
verständlich zu machen.

## 2.6 Low-Funnel Paid

**Ziel:** konkrete Kaufentscheidung erleichtern und Conversion auslösen.

**Offene Entscheidung:** „Soll ich genau dieses Produkt jetzt kaufen?“

**Einstiege:** „Bevor du kaufst“, Produkt A gegen B, „Lohnt sich der Aufpreis?“,
Modellberatung, konkreter Einwand, Preis/Offer oder kaufentscheidender Proof.

**Produkt und Brand:** Produkt oder Modell ab Beginn zeigen. Marke und Modell im
Hook oder ersten Sinnabschnitt nennen. Direkt mit Kaufentscheidung, Vergleich, Use
Case, Einwand oder Offer beginnen. Keine generische Problem- oder
Kategorieeinleitung.

**Beweis:** Produktdaten, Demonstration, fairer Vergleich, echte Review, Garantie,
Lieferumfang oder belegbares Angebot.

**CTA:** konkrete und reibungsarme nächste Handlung.

**Nicht tun:** Grundsatzfragen öffnen, die die kaufbereite Person bereits beantwortet
hat.

## 2.7 Die offene Entscheidung steuert die Ad

Pro Ad wird eine primäre offene Entscheidung bearbeitet. Die Hook öffnet sie, der
Hauptteil liefert Beweis und Einordnung, die Einwandbehandlung reduziert
Unsicherheit, das Fazit beantwortet die Hook und der CTA führt zum nächsten Schritt.
Alles andere wird entfernt.

## 2.8 Zuschauer- statt Creatorzentrierung

Die Ich-Perspektive ist nur sinnvoll, wenn sie Zuschauer-Nutzen liefert.

Schwach: „Ich habe den Ninja getestet.“

Stärker: „Ich habe den Ninja getestet, damit du weißt, ob sich der Aufpreis für zwei
Personen lohnt.“

Jede Creator-Aussage wird in Entscheidungsnutzen, Beweis oder relevante Erfahrung
übersetzt.

## 2.9 Beleg-Hierarchie

Je stärker der Claim, desto stärker der Beleg:

1. sichtbare Demonstration,
2. verifizierbare Produktdaten oder Messwerte,
3. fairer Vergleich unter gleichen Bedingungen,
4. echte Bewertungen oder dokumentierter Social Proof,
5. konkrete Creator-Erfahrung,
6. plausible Erklärung,
7. unbelegte Behauptung.

Keine Preise, Rabatte, Knappheit, Garantien, Bewertungen, Ergebnisse oder Lieferzeiten
erfinden.

## 2.10 Einwand- und Conversion-Logik

Vor allem Low-Funnel wählt den kaufentscheidenden Einwand: Preis/Gegenwert, Use-
Case-Eignung, Funktionsumfang, Aufwand/Platz, Qualität/Vertrauen, Unterschied zur
Alternative, Fehlentscheidungsrisiko oder Verfügbarkeit.

Nicht möglichst viele Einwände aufzählen. Den wichtigsten mit dem stärksten Beleg
bearbeiten. Eine ehrliche Qualifizierung ist zulässig: kaufen, wenn; nicht kaufen, wenn;
anderes Modell wählen, wenn.

## 2.11 Message Match

Hook, Hauptteil, Proof, Offer, CTA und Landingpage bedienen dieselbe Erwartung. Eine
Vergleichs-Hook darf nicht auf eine unpassende Kategorieseite führen. Eine Preis-Hook
benötigt ein reales Angebot.

Gute Video-KPIs bei schwacher Conversion können aus gebrochenem Message Match
entstehen und sind nicht automatisch ein Skriptproblem.

## 2.12 Paid-Video-Sourcing

Die Recherche basiert auf:

1. **Ads Libraries:** Marktkommunikation, Wettbewerber, Angles, Offers und CTAs.
2. **Organischen Gewinnern:** native Hooks, Zielgruppensprache, Formate und
kulturelle Codes.
3. **Eigenen Hypothesen:** Verbindungen aus Insight, Positionierung, Produktbeweis
und Performance-Daten.

Ads-Library-Laufzeit ist ein Marktsignal, kein Profitabilitätsbeweis. Organische Viralität
ist ein Aufmerksamkeitssignal, kein Conversion-Proof.

## 2.13 Referenz-Creatives analysieren

Erfasst werden Plattform, Quelle, Datum, Paid/Organic, Zielgruppen- und Awareness-
Hypothese, dreifache Hook, Format, Angle, Versprechen, Mechanismus, Brand-Timing,
Proof, Einwand, Offer, CTA, Signale und Übertragbarkeitsrisiken.

Abstrahiert werden Struktur und Wirkmechanik. Wortlaut, unverwechselbare
Inszenierung und fremde Claims werden nicht kopiert.

## 2.14 Testing und Iteration

Jeder Test beginnt mit einer Hypothese. Bei einem Hook-Test bleiben Body, Proof, Offer,
CTA, Länge und Produktion möglichst konstant.

Testbare Hook-Hypothesen: Zielgruppen-Selbstselektion, Problem/Wunsch, Ergebnis
zuerst, Einwand, Vergleich, Demonstration, Preis/Offer oder ehrlicher Nachteil.

Gewinner werden auf drei Ebenen iteriert:

- **Micro:** Hook, Text, CTA oder erste Aufnahme.
- **Meso:** neuer Angle oder Proof bei gleicher Kernidee.
- **Macro:** neues Format, Problem oder Positionierung.

## 2.15 KPI-Diagnose

Paid-Performance wird als Kette bewertet:

1. **Stop/Hook:** Aufmerksamkeit der richtigen Person.
2. **Hold/Retention:** Einlösung des Einstiegsversprechens.
3. **Message/Brand:** Produkt-, Nutzen- und Absenderverständnis.
4. **Intent/Click:** qualifiziertes Interesse.
5. **Conversion:** Zusammenspiel von Creative, Audience, Offer und Landingpage.
6. **Economics:** CPA, Deckungsbeitrag oder ROAS.

Kein Creative wird anhand einer Einzelkennzahl zum Gesamtsieger erklärt.

## 2.16 Paid-Learning-Archiv

Jedes Learning enthält Hypothese, Testvariable, Versionen, Audience, Placement,
Zeitraum, Offer, KPI-Kette, Ergebnis, alternative Erklärungen, Confidence-Level,
Gültigkeitsbereich und nächste Testfrage.

Confidence-Level:

1. Beobachtung,
2. schwaches Indiz,
3. wiederholtes Muster,
4. kontrolliert getestet,
5. über Kontexte repliziert.

„Hat funktioniert“ ist ohne Kontext kein Learning.

## 2.17 Paid-Ausgabe

Der Generator liefert:

1. Funnel- und Awareness-Einordnung,
2. offene Entscheidung,
3. Angle, Einwand und Kernversprechen,
4. Audio-, Text- und Visual-Hook,
5. ausformuliertes Skript,
6. Proof- und Produktmomente,
7. Brand-Integrationspunkte,
8. CTA,

9. Shot-/Text-Vorschläge,
10. begründete Testvarianten,
11. Annahmen und unbelegte, nicht verwendbare Angaben.

## 2.18 Paid-Qualitätscheck

- Stimmen Funnel und Awareness?
- Wird Wissen weder zurückgesetzt noch übersprungen?
- Wird die richtige Person statt breiter Neugier angesprochen?
- Ist der Entscheidungsnutzen klar?
- Sind Produkt und Marke passend früh zuordenbar?
- Wird eine primäre Entscheidung bearbeitet?
- Wird das Hook-Versprechen eingelöst?
- Ist der Claim belegt und produzierbar?
- Passen Creative, Offer, CTA und Zielseite zusammen?
- Ist die Testhypothese isolierbar?
- Werden Viralität oder Laufzeit fälschlich als Conversion-Proof behandelt?

## 2.19 Drehfertiger Aufbau eines Paid-Ad-Skriptkonzepts

Eine Paid-Ad-Übergabe muss nicht nur kreativ verständlich, sondern modular testbar
sein. Jeder Beteiligte muss erkennen, welche Bestandteile konstant bleiben und welche
Variable getestet wird.

### A. Strategischer Produktionskopf

- **Creative-ID und Version:** eindeutige Benennung für Produktion und Reporting.
- **Produkt/Modell:** exakt verwendete Bezeichnung.
- **Funnel-Stufe und Awareness-Level:** Upper, Mid oder Low plus Zuschauerwissen.

- **Zielgruppe und Kaufsituation:** wer sieht die Ad in welchem Entscheidungszustand?
- **Offene Entscheidung:** die eine Frage, die das Creative beantwortet.
- **Primärer Einwand:** wichtigste Conversion-Barriere.
- **Angle:** strategischer Blickwinkel.
- **Kernversprechen:** ein Satz.
- **Proof:** welcher sichtbare oder belegbare Nachweis trägt das Versprechen?
- **Offer und CTA:** exakt und freigegeben.
- **Plattform, Placement, Seitenverhältnis und Ziellänge.**
- **Testhypothese:** erwartete Wirkung und Begründung.
- **Testvariable:** was wird verändert?
- **Konstanten:** was bleibt über alle Varianten identisch?

### B. Variantenübersicht

Vor dem Szenenplan werden alle Varianten sichtbar gemacht:

| Version | Testvariable | Audio-Hook | Text-Hook | Visual-Hook | Erwartete Wirkung |
|---|---|---|---|---|---|
| A | Kontrolle | … | … | … | … |
| B | Hook-Variante | … | … | … | … |
| C | Hook-Variante | … | … | … | … |

Wenn Hooks gegeneinander getestet werden, müssen alle Varianten sauber in
denselben Hauptteil überleiten. Ist das nicht möglich, handelt es sich um
unterschiedliche Konzepte und nicht um einen isolierten Hook-Test.

### C. Brand- und Produkt-Timing

Die Übergabe nennt explizit:

- erster visueller Produktkontakt,
- erster erkennbare Brand-Cue,
- erste gesprochene Markennennung,
- erste ausgeschriebene Produkt-/Modellnennung,
- Zeitpunkt des Offers,
- Zeitpunkt und Wiederholung des CTAs.

So wird „Brand früh“ dreh- und später auswertbar, statt nur eine abstrakte Anweisung zu
bleiben.

### D. Creator-facing Skript: links gesprochen, rechts zu sehen

Die zentrale Drehansicht einer Paid Ad ist immer zweispaltig. Der Creator arbeitet nicht
mit einer überladenen Strategietabelle, sondern mit einer klaren Synchronisierung von
Sprache und Bild:

| **LINKS: Was gesprochen wird** | **RECHTS: Was zu sehen ist** |
|---|---|
| Finaler, natürlich sprechbarer Wortlaut. Absätze markieren neue Takes oder
Sinnabschnitte. | Konkrete Creator-Handlung, Produktaktion, Einstellung, Proof, B-Roll
und On-Screen-Text für genau diesen gesprochenen Abschnitt. |

Jede Tabellenzeile entspricht einem zusammengehörigen Drehbeat. Sprache und Bild
müssen zeitlich aufeinander passen.

Die rechte Spalte beschreibt nicht abstrakt „Produkt zeigen“, sondern drehbar und
eindeutig:

- Was tut der Creator?
- Welches Produktdetail ist sichtbar?

- Welche Kameraperspektive wird benötigt?
- Welche B-Roll oder welches Insert liegt über dem gesprochenen Satz?
- Welcher On-Screen-Text erscheint?
- Welcher Proof muss im Bild eindeutig erkennbar sein?

Beispiel:

| **LINKS: Was gesprochen wird** | **RECHTS: Was zu sehen ist** |
|---|---|
| „Du überlegst, den Ninja Double Stack für zwei Personen zu kaufen?“ | Creator steht
neben dem Gerät und öffnet direkt beide Schubladen. Text im Bild: „Ninja Double Stack
für 2 Personen?“ Produkt und Modell müssen im ersten Frame erkennbar sein. |
| „Dann entscheidet vor allem, ob du wirklich zwei unterschiedliche Sachen gleichzeitig
zubereiten willst.“ | Topshot: In einer Schublade liegt die Hauptspeise, in der anderen die
Beilage. Danach kurzer Schnitt auf beide eingestellten Programme. |
| „Genau dafür sind die getrennten Ebenen praktisch: Beides läuft parallel, ohne dass du
zweimal starten musst.“ | Close-up der beiden laufenden Bereiche. Anschließend fertige
Hauptspeise und Beilage gleichzeitig herausnehmen. Nur verwenden, wenn diese
Darstellung durch die Produktfunktion gedeckt ist. |
| „Wenn du meistens nur eine kleine Portion machst, brauchst du den zusätzlichen Platz
dagegen möglicherweise nicht.“ | Creator zeigt ehrlich eine einzelne kleine Portion und
lässt die zweite Schublade geschlossen. Text: „Eher nicht für Mini-Portionen“. |
| „Wenn du regelmäßig zwei Komponenten parallel kochst, schau dir das Modell und das
aktuelle Angebot hier an.“ | Beide Ergebnisse auf einem Teller anrichten. Danach
Produkt, korrekter Modellname, freigegebenes Offer und CTA als Endframe. |

### E. Produktionshinweise unterhalb der Zweispalten-Tabelle

Strategische und technische Details werden nicht als weitere Hauptspalten ergänzt. Sie
stehen kompakt unter der Tabelle:

- **Timing:** ungefähre Gesamtlänge und kritische Zeitpunkte.

- **Brand-Timing:** erster visueller Cue, erste gesprochene Nennung und erste
Texteinblendung.
- **Pflicht-Shots:** Aufnahmen, ohne die das Creative nicht funktioniert.
- **Pflicht-Wortlaut:** rechtlich, claimseitig oder offerseitig exakt einzuhaltende
Formulierungen.
- **On-Screen-Texte:** vollständige Liste für den Editor.
- **Schnitt/Sound:** nur konzeptrelevante Hinweise.
- **Flexible Stellen:** wo der Creator natürlich variieren darf.
- **Testvariable:** welcher Baustein in Version A, B oder C ausgetauscht wird.

Bei Paid Ads werden kaufentscheidende Aussagen so konkret geführt, dass
improvisierte Änderungen weder Claim noch Offer oder Testlogik verfälschen. Die
Übergabe bleibt trotzdem am Set schnell lesbar.

### F. Proof-Anweisung

Jeder Proof-Moment beschreibt:

- was behauptet wird,
- wodurch es belegt wird,
- wie es im Bild erkennbar wird,
- welche Aufnahmebedingungen vergleichbar bleiben müssen,
- welche Einschränkung oder Qualifizierung genannt werden muss,
- welche alternative Aufnahme benötigt wird, falls der Proof im ersten Take nicht klar
sichtbar ist.

„Produkt benutzen“ ist keine ausreichende Drehanweisung. Besser: „Beide Schubladen
gleichzeitig öffnen; fertige Hauptspeise und Beilage in einem Topshot zeigen;
anschließend beide Ergebnisse im selben Frame anrichten.“

### G. CTA- und Endcard-Anweisung

- exakter gesprochener CTA,
- exakter On-Screen-CTA,
- Ziel des Klicks,
- sichtbares Offer mit Bedingungen,
- Produkt-/Markenabbildung,
- notwendige Endcard-Dauer,
- alternative CTA-Version, falls diese Teil des Tests ist.

### H. Shotlist und Pickup-Liste

Die Shotlist trennt:

- **A-Roll:** alle gesprochenen Takes, jeweils sauber und mit kurzen Pausen
aufgenommen.
- **Produkt-B-Roll:** Anwendung, Details, Packaging und Ergebnis.
- **Proof-Shots:** unverzichtbare Beweisaufnahmen.
- **Hook-Pickups:** alternative erste Bilder und Bewegungen.
- **CTA-Pickups:** alternative Handlungen und Endframes.
- **Clean Plates:** Aufnahmen ohne Sprache oder Text für spätere Varianten.

Für modulare Tests werden Hooks, Body und CTA mit ausreichenden Schnittpausen als
getrennte Bausteine aufgenommen.

### I. Paid-Ad-Beispielstruktur

```text
CREATIVE-ID: NINJA_DS_LOWFUNNEL_USECASE_V01
FUNNEL: Low / Product-aware

OFFENE ENTSCHEIDUNG: Lohnt sich der Double Stack für zwei Personen?
EINWAND: Aufpreis und Größe
HYPOTHESE: Eine konkrete Modell- und Use-Case-Nennung qualifiziert kaufnahe
Zuschauer besser.
TESTVARIABLE: Hook; Body, Proof, Offer und CTA bleiben gleich.

HOOK A
Audio: „Lohnt sich der Ninja Double Stack überhaupt für zwei Personen?“
Text: „Double Stack für 2 Personen?“
Visual: Gerät und zwei fertige Portionen sofort im selben Frame.

HOOK B
Audio: „Bevor du den Ninja Double Stack für zwei Personen kaufst …“
Text: „Vor dem Kauf wissen“
Visual: Creator öffnet beide Schubladen direkt zur Kamera.

BODY
Die finale Drehfassung wird zweispaltig ausgegeben:

LINKS – WAS GESPROCHEN WIRD
Finaler Wortlaut, gegliedert nach zusammengehörigen Takes.

RECHTS – WAS ZU SEHEN IST
Synchron dazu: Creator-Handlung, Produkt, Proof, Kamerabild, B-Roll und On-Screen-
Text.

CTA
Gesprochen und eingeblendet: freigegebener nächster Schritt.
Endframe: Modell, Produktbild und reales Offer.
$master$,
  'aktiv'
WHERE NOT EXISTS (
  SELECT 1 FROM skript_master WHERE bereich = 'paid_creator_ads' AND version = 1
);

INSERT INTO skript_master (bereich, name, version, inhalt, status)
SELECT 'influencer_marketing',
  'Influencer-Marketing als Konzeptsystem',
  1,
  $master$
# Abschnitt 3: Influencer-Marketing als Konzeptsystem

## 3.1 Ziel und Leitfrage

Influencer-Marketing überträgt eine Marken- oder Produktbotschaft in die glaubwürdige
Sprache, Perspektive und Content-Welt eines Creators.

Der Generator erstellt grundsätzlich **kein starres Wort-für-Wort-Skript**, sondern ein
umsetzbares Creative-Konzept: genug Klarheit für Botschaft und Pflichtbestandteile,
genug Freiheit für nativen Creator-Content.

> Wie würde genau dieser Creator diese relevante Produktwahrheit glaubwürdig für
seine Community erlebbar machen?

## 3.2 Creator-Fit vor Konzept

Das Konzept passt zu:

- Nische und Community-Erwartung,
- natürlichen Formaten,
- Sprach- und Humorstil,
- Energie und Persönlichkeit,
- Expertise oder Erfahrung,
- glaubwürdiger Produktbeziehung,
- visueller Produktionsrealität,
- Kooperationen und möglichen Konflikten.

Ein gutes Konzept mit schlechtem Creator-Fit wirkt wie Fremdwerbung.

## 3.3 Community-First-Perspektive

Zwischen Creator und Zuschauern bestehen gemeinsame Sprache, Erwartungen und
Vertrauen. Das Konzept klärt:

- Welche Community-Situation macht das Produkt relevant?
- Welcher persönliche Bezug ist wahr?
- Welche Frage oder welcher Einwand beschäftigt die Community?
- Welches Creator-Format kennen die Zuschauer?
- Was darf die Marke nicht glätten oder überkontrollieren?

## 3.4 Konzept statt Skript

Ein Influencer-Konzept beschreibt Kernidee, Creator-Perspektive, Situation, Hook-
Optionen, Hauptteil-Beats, Proof, Produktintegration, CTA, Pflichtaussagen und
Grenzen.

Beispielsätze dienen nur als Orientierung und werden nicht als auswendig zu lernender
Wortlaut behandelt.

## 3.5 Hook – Hauptteil – Call to Action

### Hook

Die Hook entsteht aus Creator, Community und Konzept. Geeignet sind persönliche
Beobachtung, Community-Frage, Use Case, überraschendes Ergebnis, ehrlicher
Einwand, bekannte Format-Eröffnung oder sichtbare Anwendung.

Der Generator liefert mehrere Hook-Richtungen mit Audio-, Text- und Visual-Idee, aber
keinen unnatürlichen Pflichtwortlaut.

### Hauptteil

Der Hauptteil besteht aus Story- und Message-Beats:

1. Situation oder persönlicher Kontext,
2. natürliche Produktbegegnung oder Anwendung,
3. relevante Erfahrung oder Demonstration,
4. ein bis drei priorisierte Botschaften,
5. ehrliche Einordnung oder Einschränkung,
6. Payoff beziehungsweise persönliches Fazit.

Der Produktvorteil wird erlebbar oder sichtbar. Eine reine USP-Liste ist kein Influencer-
Konzept.

### Call to Action

Der CTA passt zu Creator, Format und Kooperation: entdecken, informieren,
Community-Frage beantworten, Produkt ansehen, Code/Offer nutzen oder an
Launch/Aktion teilnehmen.

Er wird in natürlicher Creator-Sprache umgesetzt. Pflichtangaben zu Code, Link,
Zeitraum oder Bedingungen bleiben korrekt und vollständig.

## 3.6 Produkt- und Brand-Integration

Das Produkt wird in eine echte Handlung integriert: verwenden, ausprobieren,
vergleichen, erklären, in Routine zeigen, auf Community-Frage beziehen oder Ergebnis
demonstrieren.

Zu vermeiden sind abruptes Produkt-Hochhalten, auswendig gelernte USP-Listen,
untypische Markensprache, künstliche Begeisterung, verspätete Werbekennzeichnung
und unbelegbare Behauptungen.

Brand-Timing folgt dem Konzept: Die Kooperation wird regelkonform gekennzeichnet;
Produkt und Marke erscheinen am frühesten natürlichen Punkt, an dem sie für Story und
Verständnis relevant sind. Produktnahe oder conversionorientierte Kooperationen
integrieren sie früher und direkter als narrative Awareness-Konzepte.

## 3.7 Kreative Freiheitsgrade

### Nicht verhandelbar

- korrekte Produktbezeichnung,
- belegte Kernbotschaft,
- notwendige Werbekennzeichnung,
- rechtliche und markenspezifische Grenzen,
- korrektes Offer und CTA,
- vereinbarte Deliverables.

### Flexibel

- konkrete Wortwahl,
- persönliche Story,
- Gestik und Performance,
- creatorüblicher Humor,
- Shot-Reihenfolge,
- Übergänge und native Formatdetails.

## 3.8 Influencer-Formate

Geeignet sind Routine-Integration, ehrlicher Produkttest, persönliche Story,
Community-Q&A, Tutorial, Challenge, Experiment, zulässiges Vorher/Nachher,
Vergleich, Vlog-Integration, Kommentarantwort oder Launchmoment.

Das Format wird aus Creator-Fit, Kampagnenziel und Produktwahrheit gewählt, nicht
aus Viralität allein.

## 3.9 Glaubwürdigkeit und Proof

Der Creator darf nur tatsächliche Erfahrungen darstellen. Testimonials, Ergebnisse und
persönliche Geschichten werden nicht vorgegeben oder erfunden.

Starke Proof-Momente sind tatsächliche Anwendung, sichtbare Produkteigenschaft,
nachvollziehbarer Test, konkrete Erfahrung, echte Community-Frage oder belegbare
Produktinformation.

Ohne echte Erfahrung wird keine persönliche Langzeiterfahrung simuliert.

## 3.10 Paid Usage und Weiterverwendung

Für mögliche Paid Usage werden frühe Produktrelevanz, Brand Attribution, modulare
Hooks, eigenständig nutzbare Proof-Momente, CTA, alternative Schnittanfänge sowie
Nutzungsrechte und Laufzeiten berücksichtigt.

Die redaktionelle Creator-Version darf trotzdem nicht wie eine klassische Performance
Ad erzwungen werden. Stärkere Paid-Anpassungen werden als separate Cutdowns oder
Varianten geplant.

## 3.11 Influencer-Konzept-Ausgabe

Der Generator liefert:

1. Konzepttitel und Kernidee,
2. Begründung des Creator-Community-Fits,
3. Ziel und gewünschte Zuschauerreaktion,
4. Creator-Perspektive und Ausgangssituation,
5. natürliche Hook-Optionen,
6. Hook-, Hauptteil- und CTA-Beats,
7. Produkt- und Proof-Momente,
8. visuelle Szenen und B-Roll,
9. nicht verhandelbare Pflichtbestandteile,
10. kreative Freiheitsgrade,
11. Do's und Don'ts,
12. optionale Paid-Usage-Varianten,
13. offene Punkte oder unbestätigte Annahmen.

Es wird kein vollständig ausformulierter Monolog geliefert, sofern dies nicht
ausdrücklich als Sonderfall verlangt wird.

## 3.12 Influencer-Qualitätscheck

- Könnte das Konzept glaubwürdig vom gewählten Creator stammen?
- Passt es zu Community und etabliertem Format?
- Hat es unabhängig von der Bezahlung Zuschauerwert?
- Ist Produktintegration Teil der Handlung?
- Sind Erfahrung und Proof realistisch und belegbar?
- Ist Hook – Hauptteil – CTA klar, aber nicht übergeskriptet?
- Sind Pflichtbestandteile und kreative Freiheit getrennt?
- Klingt der CTA natürlich und ist vollständig?
- Sind Kennzeichnung, Claims und Rechte berücksichtigt?
- Ist Paid-Verlängerung modular möglich, ohne das Original zu beschädigen?

## 3.13 Drehfertiger Aufbau eines Influencer-Konzepts

Das Influencer-Konzept muss dem Creator eindeutig sagen, **was passieren und
vermittelt werden soll**, ohne vorzuschreiben, **wie jedes Wort gesagt werden muss**.
Es ist eine kreative Regieanweisung mit klaren Pflichtpunkten.

### A. Konzeptkarte

- **Konzepttitel:** kurze, merkbare Bezeichnung.
- **Kernidee:** das Konzept in einem Satz.
- **Warum passt es zum Creator?** Bezug zu Format, Persönlichkeit und bisherigem
Content.
- **Warum passt es zur Community?** konkrete Situation, Frage oder Insight.
- **Ziel der Kooperation:** Awareness, Verständnis, Consideration, Traffic oder
Conversion.
- **Gewünschte Zuschauerreaktion:** was soll die Community denken, fühlen oder
tun?
- **Creator-Rolle:** Nutzer, Tester, Erklärer, Gastgeber, Challenger oder Story-
Protagonist.
- **Format und Setting:** beispielsweise Routine, Vlog, Tutorial, Storytime oder
Experiment.
- **Ziellänge und Plattform.**
- **Benötigte Produkte, Requisiten, Personen und Orte.**

### B. Die kreative Leitplanke

Das Konzept formuliert:

- **Produktwahrheit:** die eine belegbare Aussage, auf der die Idee basiert.

- **Persönlicher Anknüpfungspunkt:** welche echte Erfahrung oder Situation der
Creator nutzen kann.
- **Emotionaler Ton:** beispielsweise neugierig, erleichtert, humorvoll, kritisch oder
begeistert – niemals künstlich vorgegeben.
- **Must-say:** Aussagen oder Angaben, die inhaltlich enthalten sein müssen.
- **Must-show:** Produkt-, Anwendungs- und Proof-Momente, die sichtbar sein
müssen.
- **Do not say/show:** Claims, Darstellungen oder Vergleiche, die nicht zulässig oder
nicht passend sind.
- **Freie Fläche:** welche Story, Formulierung und Performance der Creator selbst
gestalten darf.

### C. Hook-Optionen für den Creator

Statt eines Pflichtsatzes erhält der Creator zwei bis vier Hook-Richtungen:

| Hook-Richtung | Inhaltlicher Gedanke | mögliche visuelle Eröffnung | notwendiger
Übergang |
|---|---|---|---|
| Persönlich | reale Beobachtung oder Erfahrung | Creator in typischer Alltagssituation |
Verbindung zum Produkt |
| Community | häufige Frage oder Einwand | Kommentar, Q&A oder direkte Ansprache |
eigene Antwort/Erfahrung |
| Ergebnis | sichtbarer Payoff zuerst | fertiges Ergebnis oder Transformation | erklären,
wie es dazu kam |

Optionale Beispielsätze werden als Inspiration gekennzeichnet. Der Creator darf sie in
seine Sprache übersetzen, solange Bedeutung und Claim korrekt bleiben.

### D. Hauptteil als Storyboard-Beats

Der Hauptteil wird nicht Wort für Wort, sondern als verbindliche Abfolge beschrieben:

| Beat | Was passiert? | Was muss vermittelt werden? | Was muss sichtbar sein? | Freiheit
des Creators |
|---|---|---|---|---|
| 1. Kontext | konkrete Alltagssituation | warum das Thema relevant ist | authentisches
Setting | persönliche Formulierung |
| 2. Integration | Produkt kommt natürlich ins Geschehen | Produktrolle | echte
Anwendung | Übergang und Performance |
| 3. Proof | Erfahrung, Test oder Demonstration | priorisierte Kernbotschaft | sichtbarer
Beleg | Reaktion und Einordnung |
| 4. Ehrlichkeit | Einschränkung oder Qualifizierung | für wen/wann passend | optionaler
Vergleich | persönliche Meinung |
| 5. Payoff | Ergebnis oder Fazit | Antwort auf die Hook | Resultat/Produkt im Kontext |
creatorübliche Schlussformulierung |

Pro Beat werden maximal ein bis drei Botschaften priorisiert. Der Creator erhält keine
lange USP-Liste zum Ablesen.

### E. Call-to-Action-Modul

Das CTA-Modul enthält:

- gewünschte Handlung,
- verpflichtende Information zu Produkt, Code, Link, Zeitraum oder Bedingungen,
- natürlichen Anlass für den CTA,
- mögliche CTA-Formulierungsrichtungen,
- notwendigen On-Screen-Text,
- Endbild oder letzte Handlung.

Der CTA darf frei formuliert werden, solange Handlung und Pflichtangaben eindeutig
bleiben.

### F. Kennzeichnung von Verbindlichkeit

Jeder Konzeptpunkt erhält eine Markierung:

- **PFLICHT:** muss inhaltlich oder visuell enthalten sein.
- **EMPFOHLEN:** dient der kreativen Qualität, kann passend adaptiert werden.
- **OPTION:** zusätzliche Idee oder Pickup.
- **FREI:** liegt vollständig in Creator-Sprache und Performance.

Diese Markierung verhindert gleichzeitig unklare Briefings und Übersteuerung.

### G. Dreh- und Abgabecheckliste

Vor dem Dreh:

- Produkt getestet und echte Erfahrung geklärt?
- Aussprache, Produktname, Offer und Kennzeichnung verstanden?
- Setting, Requisiten und Ergebnis vorbereitet?
- Must-show- und Proof-Aufnahmen realistisch umsetzbar?

Beim Dreh:

- mindestens zwei natürliche Hook-Takes,
- Hauptteil vollständig und zusammenhängend,
- alle Must-show-Momente,
- Produkt und Packaging lesbar,
- ausreichend B-Roll und Clean Shots,
- CTA und notwendige Bedingungen vollständig,

- zusätzliche Hook-/CTA-Pickups für mögliche Paid Usage.

Vor Abgabe:

- Hook-Versprechen eingelöst?
- alle Pflichtaussagen korrekt?
- Werbekennzeichnung sichtbar und regelkonform?
- keine erfundene persönliche Erfahrung oder unbelegter Claim?
- Creator-Ton erhalten?
- Rohmaterial und vereinbarte Varianten vollständig?

### H. Influencer-Konzept-Beispielstruktur

```text
KONZEPTTITEL: Zwei Gerichte, ein Feierabend
KERNIDEE: Der Creator zeigt in seiner echten Abendroutine, wie Hauptgericht und
Beilage parallel entstehen.
CREATOR-FIT: Passt zum etablierten Feierabend-/Meal-Prep-Format.
COMMUNITY-INSIGHT: Wenig Zeit, aber keine Lust auf zwei Kochdurchgänge.

HOOK-OPTION 1 – ERGEBNIS ZUERST
Gedanke: „So bekomme ich nach der Arbeit zwei unterschiedliche Sachen gleichzeitig
fertig.“
Visual: Beide fertigen Komponenten direkt im ersten Frame.

HOOK-OPTION 2 – COMMUNITY-FRAGE
Gedanke: Auf die Frage reagieren, ob sich zwei Schubladen für zwei Personen lohnen.
Visual: Kommentar einblenden und beide Schubladen öffnen.

HAUPTTEIL
Beat 1: echte Feierabendsituation etablieren.
Beat 2: beide Komponenten vorbereiten und Produkt natürlich einführen.
Beat 3: parallele Anwendung sichtbar demonstrieren.
Beat 4: ehrliche Einordnung, für welchen Haushalt es passt.
Beat 5: gemeinsames Ergebnis und persönliches Fazit.

PFLICHT
- korrekter Produktname
- belegbare Kernfunktion sichtbar zeigen
- Werbekennzeichnung
- freigegebener CTA und Angebotsbedingungen

FREI
- konkrete Wortwahl
- persönlicher Humor
- Rezeptauswahl
- creatorübliche Reaktion und Übergänge
```

---
$master$,
  'aktiv'
WHERE NOT EXISTS (
  SELECT 1 FROM skript_master WHERE bereich = 'influencer_marketing' AND version = 1
);
