# CRM

Stammdaten und operative Arbeit rund um Firmen, ihre Marken und die Kampagnen dazwischen.

## Language

**Unternehmen**:
Die juristische oder organisatorische Einheit, Parent von Marken. Kann ohne Marke existieren.
_Avoid_: Firma, Company, Account

**Marke**:
Eine Marke unter genau einem Unternehmen. Hat keine eigene Rechnungsadresse.
_Avoid_: Brand, Label

**Neuigkeit**:
Kurzmitteilung über eine Produkt-Änderung an Mitarbeiter (titel + kurztext, Du-Form).
Wird automatisch aus Commits generiert und erscheint nur als Card auf dem Dashboard.
Es gibt keine Detail-Seite, kein Archiv und keine Screenshots.
_Avoid_: Report, News, Update-Post, Release-Notes

**Persona**:
Typ Mensch auf Unternehmensebene, optional mehreren Marken und Produkten zugeordnet.
Der produkt-spezifische Fit (warum, welche Use Cases) sitzt nicht an der Persona, sondern an der Zuordnung.
_Avoid_: Zielgruppe, Buyer-Persona, Kunde

**Produkt**:
Angebot eines Unternehmens, optional mehreren Marken zugeordnet.
Personas hängen über die Zuordnung, nicht als Eigentum des Produkts.
_Avoid_: Artikel, SKU, Offer

**Liky**:
Der KI-Assistent. Liest Shop-URLs und Kundenbriefings aus, schlägt Personas und Creator für ein Casting vor und schreibt im Skript-Editor.
Sitzt in der rechten Spalte der Detail-Worksheets (Produkt, Persona).
_Avoid_: Bot, Chatbot, Copilot

**Vertrag**:
Rechtliches Dokument zwischen Parteien, wird als PDF generiert. Hat genau einen Vertragstyp.
_Avoid_: Agreement, Kontrakt

**Vertragstyp**:
Art des Vertrags: UGC, Influencer Kooperation, Videograph, Model oder Contracting.
_Avoid_: Template (das ist das Vertragstemplate)

**Vertragstemplate**:
Die PDF-Variante innerhalb eines Vertragstyps. Bei Influencer Kooperation: Standard oder Direktvertrag.
Bei UGC: Alter Vertrag, Neuer Vertrag oder EHG-Vertrag. Bei EHG GmbH & Co. KG entfällt Neuer Vertrag.
_Avoid_: Vertragstyp, Layout

**Direktvertrag**:
Vertragstemplate der Influencer Kooperation, bei dem der Kunde (z.B. BURGA, UAB Hautica) direkt
Vertragspartei des Influencers ist. LikeGroup tritt nicht als Vertragspartei auf.
Wird nur bei diesen Kunden angeboten. Hat einen Anhang pro gebuchter Plattform (Anhang A, B, ...).
_Avoid_: Awareness-Vertrag, BURGA-Vertrag, EHG-Vertrag

**EHG-Vertrag**:
UGC-Vertragstemplate nur für EHG GmbH & Co. KG. Vertragsparteien sind Agentur und Creator;
EHG ist Drittbegünstigte. Das Deckblatt folgt dem UGC-Standard plus Block Drittbegünstigte;
Vertragstext und Projektblatt folgen der EHG-Vorlage, einsprachig DE oder EN.
_Avoid_: Direktvertrag, Ernstings-Vertrag, UTC-Vertrag, Kundenvertrag

**Drittbegünstigte**:
Partei, die aus dem EHG-Vertrag eigene Rechte erwirbt, ohne Vertragspartei zu sein. Immer
EHG GmbH & Co. KG. Steht auf dem Deckblatt zusätzlich zu den Kundendaten.
_Avoid_: Kunde, Dritte

**Projektblatt**:
Anlage zum EHG-Vertrag. Legt Leistung, Nutzung, Gebiet, Dauer und Vergütung fest; bei Abweichungen
geht es dem Vertragstext vor.
_Avoid_: Anhang, Briefing

**Briefing**:
Das Aktivierungsdokument eines Unternehmens, optional einer Marke. Verbindliche Grundlage
für Casting und Konzept. Hängt nicht an einer Kampagne.
_Avoid_: Kampagnen-Briefing (das ist die Tabelle `campaign_briefings`), Kundenbriefing

**Kundenbriefing**:
Das vom Kunden gelieferte PDF als Vorlage für ein Briefing. Genau eines pro Briefing.
Liegt im Storage der Marke, sonst des Unternehmens.
Nicht das Briefing selbst.
_Avoid_: Briefing, Quelldokument, Kundendokument

**Casting**:
Die Creator-Auswahlliste einer Kampagne. Unverknüpft oder 1:1 mit einem Konzept.
_Avoid_: Sourcing (außer Code/Route), Creator-Liste

**Konzept**:
Das Strategie-Dokument einer Kampagne. Sammlung von Videoideen. Unverknüpft oder 1:1 mit einem Casting.
_Avoid_: Strategie (außer Tabelle `strategie`), Strategie-Doc

**Casting-Eintrag**:
Eine Person auf einem Casting. Nicht der CRM-Creator; die Stammdaten-Identität kann später entstehen.
Darf an mehreren Videoideen des verknüpften Konzepts hängen.
_Avoid_: Casting-Item, Kandidat, Sourcing-Creator

**Creator**:
Stammdaten-Entity einer Person (Tabelle `creator`), mit Mail (`mail`) und Management-Zuordnung.
Nicht der Casting-Eintrag; der kann später zum Creator werden.
_Avoid_: Casting-Eintrag, Influencer, Kandidat

**Bedarf**:
Das gesuchte Creator-Profil eines Castings, abgeleitet aus Briefing, Produkt und akzeptierten Personas.
_Avoid_: Suche, Zielgruppe, Filter

**Buchungsbild**:
Die historisch gebuchten bzw. bewerteten Creator zu Marke und Kampagnenart.
Dient als Wiederholungs- und Ablehnungsfilter (Gates) und liefert die Historie für Track.
_Avoid_: Qualitätsurteil, Proven-Slot

**Casting-Vorschlag**:
Ein für ein Casting vorgeschlagener Creator. Wird durch Aktivieren zum Casting-Eintrag.
Auswahl und Reihenfolge folgen streng dem Matching, höchster Match oben.
_Avoid_: Casting-Eintrag, Kategorie „Vorschläge“, Kandidat, Slot-Portfolio

**Fit**:
Briefing-Passung eines Creators (0-100): Nische, Persona, Voraussetzungen, Größe,
Plattform, Mentions, Standort, Text. Unbelegte Dimensionen geben 0 Punkte –
bewusster Anreiz, Creator-Profile vollständig zu pflegen.
_Avoid_: Fit Score als eigenständige Kennzahl (ist Bestandteil von Matching)

**Track**:
Erfolgs-Historie eines Creators im eigenen System (0-100): Prio-Platzierungen,
Buchungsquote aus Anfragen, Videos, Engagement-Rate, Erreichbarkeit; Absagen ziehen ab.
_Avoid_: Qualitätsurteil, Erfahrung allgemein

**Fresh**:
Nicht-Abnutzung eines Creators (0-100): startet bei 100, Abzüge für
Marken-Wiederholung in 90 Tagen (gestaffelt, die erste ist frei), gleiche Suche
und kürzliche Vorschläge.
_Avoid_: Neuheitsbonus, Frische als positives Signal

**Matching**:
Der eine finale Score eines Casting-Vorschlags (0-100):
0.80 Fit + 0.15 Track + 0.05 Fresh. Ohne Casting-Historie (Cold-Start) geht das
Track-Gewicht auf Fit, statt mit ~0 einzugehen. Es gibt keine andere Kennzahl;
Teil-Scores erscheinen nur im Hover.
_Avoid_: Fit Score, LLM-Ranking, position als Sortierung

**Aktivieren**:
Einen Casting-Vorschlag zum Casting-Eintrag mit `creator_id` machen.

**Management**:
Die Talent-Agentur als Stammdaten-Entity (Tabelle `management`), n:m zu Creator über `creator_management`.
Nicht die Mitarbeiter-Rolle `management`.
_Avoid_: Agentur-Rolle, Mitarbeiter-Klasse Management

**Videoidee**:
Eintrag in einem Konzept: verlinkte Videoidee oder reine Idee. Genau eine Umsetzung, nicht
eine Kernidee mit mehreren Creatorn. Höchstens ein Casting-Eintrag aus dem verknüpften Casting;
zuordenbar einem Kooperationsvideo.
_Avoid_: Idee/Strategie, Referenzvideo, Kernidee

**Skript-Freigabe**:
Ausdrückliche Freigabe einer Videoidee für die Skripterstellung. Voraussetzung: zugeordneter
Casting-Eintrag und nicht „Nicht umsetzen“. Gate nur für Neuanlage, nicht für bestehende Skripte.
_Avoid_: Freigabe (alleinstehend – Kollision mit Video-Freigabe am Kooperationsvideo)

**Kooperationsvideo**:
Das hochgeladene Videofile in einer Kooperation (Dropbox-Asset), wird in der
VideoPlayerLightbox abgespielt. Nicht zu verwechseln mit der Videoidee.
_Avoid_: Upload, Videodatei

**Kooperationstabelle**:
Tabelle auf der Kampagne mit Kooperationen und Video-Stacks.
_Avoid_: Kampagnen-Tabelle

**Eigene Spalte**:
User-definierte Spalte in der Kooperationstabelle.
_Avoid_: Custom Column (in der UI)

**Anschreiben**:
E-Mail mit Dokumentanhang (z.B. Briefing-PDF) an adressierbare Empfänger. Kein CRM-Login,
kein Link. Pro Empfänger eine eigene Mail.
_Avoid_: Versand (das ist der Paketversand an Kooperationen), Teilen, Einladen

**Empfänger**:
Wer ein Anschreiben bekommt: CRM-Creator (`creator.mail`) oder Management (`management.email`),
jeweils mit ID und Mail. Kein Casting-Eintrag ohne CRM, keine freie Adresse ohne Datensatz.
_Avoid_: Casting-Eintrag, freie E-Mail

**Mailvorlage**:
Gespeicherter Betreff und Body mit Platzhaltern für ein Anschreiben. Ein Standard für alle;
weitere sind privat, optional „für alle nutzbar“.
_Avoid_: Template (Kollision mit Vertragstemplate), E-Mail-Template

**Zugang**:
Gast-Link plus Code auf eine geteilte Liste (`list_shares`). Live-Sicht im CRM, kein Anhang.
_Avoid_: Anschreiben, Teilen

**Rechnung**:
Eingangsrechnung eines Creators. Der Monat sitzt am Rechnungsdatum.
_Avoid_: Eingangsrechnung, Invoice, Beleg (das ist die PDF)

**Kundenrechnung**:
Ausgangsrechnung an den Kunden. Eine Zeile ist ein Auftrag × Teilrechnung, nicht der Auftrag selbst.
_Avoid_: Ausgangsrechnung, Auftrag-Rechnung

**Monatsblatt**:
Der Jahr/Monat-Schnitt einer Rechnungsliste: sichtbare Zeilen plus Counts für die Tabs.
Gesetzte Suche hebt den Monatsschnitt auf (Treffer über den Bestand, kein Auto-Sprung auf Alle).
Counts sind Tab-Badges, kein Full-Scan der Zeilen.
_Avoid_: Monatsfilter, Invoice sheet

**Video-Ordnerblatt**:
Die Unternehmen-/Kampagnen-Hierarchie der Videos-Nav. Zählt Kooperationsvideos, lädt sie nicht.
_Avoid_: Video-Liste (das ist die paginierte Tabelle), Kooperationstabelle (sitzt auf der Kampagne)

### Rechnungswesen

**Teilrechnung**:
Eine von mehreren Rechnungen zum selben Auftrag oder zur selben Kooperation.
Derselbe Begriff gilt in beide Richtungen; die Richtung ergibt sich aus Kundenrechnung oder Creatorrechnung.
_Avoid_: Abschlagsrechnung, Anzahlung, Rate

**Restbetrag**:
Sollbetrag minus Summe der bereits gestellten Rechnungen. Beziffert, was noch abgerechnet werden darf,
und ist damit die einzige Bedingung dafür, ob eine weitere Teilrechnung möglich ist.
_Avoid_: Offener Posten, Differenz, Rest

**Schlussrechnung**:
Die als letzte markierte Teilrechnung einer Kooperation. Nur nötig, wenn ein Restbetrag offen bleibt:
geht er auf null, gilt die Kooperation ohne Markierung als abgerechnet.
_Avoid_: Endabrechnung, finale Rechnung

**Minderabrechnung**:
Der Restbetrag einer per Schlussrechnung abgeschlossenen Kooperation. Wirtschaftlich eine Ersparnis
gegenueber dem vereinbarten Einkaufspreis, keine offene Verbindlichkeit.
_Avoid_: Rabatt, Nachlass, Differenz

**Kampagnenart**:
Die Leistungsform eines Auftragsblocks: UGC Paid, UGC Organic, Influencer Kampagne, Influencer Story,
Influencer Events, Vor-Ort-Produktion, Whitelisting oder Darkposting.
_Avoid_: Kampagnentyp, Format, Chip

**Leistungsbereich**:
Die Achse, nach der Umsatz und Fremdkosten ausgewertet werden. Groeber als die Kampagnenart – Kampagne,
Story und Events bilden zusammen Influencer Marketing – und ergaenzt um Contracting sowie einen
Sammelposten fuer Nicht zugeordnetes.
_Avoid_: Kategorie, Segment, Geschaeftsbereich

**Fremdkosten**:
Sammelbegriff fuer Creator-Honorar, KSK-Abgabe und Zusatzkosten. Kein eigener Posten: die drei bleiben
in jeder Auswertung einzeln sichtbar.
_Avoid_: Direkte Kosten, Creator-Kosten, COGS

**Bezahlt**:
Eine gestellte Rechnung, deren Zahlung eingegangen ist. Derselbe Begriff gilt fuer Kunden- und
Creatorrechnungen, auch wenn die Speicherung ihn in zwei Woertern festhaelt.
_Avoid_: Überwiesen, beglichen, erledigt

**Berichtsstand**:
Ein eingefrorener Stand der Stakeholder-Finanzuebersicht (Monatsauswertung und Zahlungsstand), der
belegt, worauf ein verschicktes Update beruhte. Die Ansicht rechnet immer live; ein Berichtsstand
wird nie korrigiert, sondern durch einen neuen Stand ersetzt.
_Avoid_: Snapshot, Report, Export

**Investor**:
View-only Lesezugang auf Finanzuebersicht und operative Plattform. Zwei Wege, dieselbe
Einschraenkung: die Rolle `investor` (eigener Login, RLS-Wahrheit) oder die
Mitarbeiter-Klasse Finanzen (`rolle = mitarbeiter`, sieht Preise). Beide laufen ueber
dieselbe Feature-Zeile im PermissionSystem: keine Mails bei Ansprechpartnern, keine
Tabellen-Werkzeuge, keine Uploads, kein Skript-Kommentieren, kein Feedback.
_Avoid_: Admin, Mitarbeiter, Gast, Stakeholder (das ist die Finanzuebersicht)

**Accounting-Bereich**:
Eigener Bereich unter /admin fuer Admins und Investoren. Reduzierte Navigation auf Zahlen und Auftrag
(Dashboard = Stakeholder-Uebersicht, Datenqualitaet, Projekt anlegen, Auftraege,
Kundenrechnungen, Creatorrechnungen). Datenqualitaet und Projekt anlegen bleiben Admin.
Einstieg ueber den Schild-Button; die volle App liegt hinter Zurueck zur App.
_Avoid_: Adminbereich, Backend, Admin-Panel, Einstellungen

**Berechtigung**:
Das Modul in `src/core/PermissionSystem.js`. UI fragt Capabilities ueber `can(entity, verb)`
mit den vier Verben `view / create / edit / delete` — nie Rollen wie `isKunde`/`isMitarbeiter`
und nie Roh-Flags wie `permissions?.x?.can_edit`. Dazu kommen `canFeature(name)` fuer
Nicht-Entity-Features (contactMail, kampagneTableFilter, kampagneTableLayout, mediaUpload,
skriptKommentieren) und `canEditField(entity, field)` fuer die Feld-Editierbarkeit
(Kunden-Denylist plus optionale FIELD_LOCKS pro Rolle). Rolle, Mitarbeiter-Klasse,
zugriffsrechte und das user_permissions-Overlay bleiben Implementation des Moduls. Eine
neue Rolle oder Klasse ist eine Zeile True/False in der Matrix, kein neuer Code-Pfad.
Admin-Toggles schlagen die Klassen-Zeile (Klasse ist Default, kein hartes Preset). RLS
bleibt die Server-Wahrheit; die UI versteckt nur, was ohne Recht eh fehlschluege.
_Avoid_: Rolle-Check im Renderer, `!isKunde` als Write-Gate, `can_edit !== false`

**Datenqualitaetsanzeige**:
Seite im Accounting-Bereich, die Pflegemaengel an Finanzdaten nach Kampagne gruppiert und nach
betroffenem Geldvolumen sortiert zeigt. Sie benennt die Faelle; korrigiert wird von den Teams.
Gleicher Ein- und Verkaufspreis ist bewusst kein Mangel (Fee-Modell).
_Avoid_: Qualitaetsdashboard, Fehlerliste, Audit

**Pflegegrad**:
Anteil fehlerfreier gepruefter Einheiten (Videos, Kooperationen, Auftraege, Rechnungen) einer
Kampagne in der Datenqualitaetsanzeige. 100 % heisst: alles Gepruefte ist vollstaendig gepflegt.
_Avoid_: Score, Qualitaetsindex, Ampel
