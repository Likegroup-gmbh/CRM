# CRM

Stammdaten und operative Arbeit rund um Firmen, ihre Marken und die Kampagnen dazwischen.

## Language

**Unternehmen**:
Die juristische oder organisatorische Einheit, Parent von Marken. Kann ohne Marke existieren.
_Avoid_: Firma, Company, Account

**Testunternehmen**:
Ein Unternehmen, das beim Anlegen als Test markiert ist. Nur Admins sehen es und seinen Unterbaum; Investor-Zahlen enthalten es nicht.
_Avoid_: Sandbox, intern, Demo, hidden, Stakeholder-Exclude

**Marke**:
Eine Marke unter genau einem Unternehmen. Hat keine eigene Rechnungsadresse.
_Avoid_: Brand, Label

**Auftrag**:
Das Kundenprojekt mit Volumen, Laufzeit und Teilrechnungen. Ein neuer Auftrag hat genau eine Kampagne. Bestand darf mehrere Kampagnen aus dem früheren Split haben; deren Volumen wird nicht zusammengelegt.
_Avoid_: Deal, Job, Projekt (in der UI heisst der Anlege-Flow so, die Entity bleibt Auftrag)

**Kampagne**:
Überübersicht unter einem Auftrag. Hält den Budget-Topf, die Kampagnenarten und das Video- und Creator-Soll. Parent der Produktionen. Die Seite zeigt Summe und Soll, keine Workflow-Tabs.
_Avoid_: Überkampagne, Auftrag

**Produktion**:
Lauf unter genau einer Kampagne. Entsteht mit dem Briefing, das Produkt kommt danach und hängt dann an dieser Produktion. Anzeigename ist der Briefing-Titel. Kein eigenes Volumen und kein eigenes Soll. Darunter hängen Casting, Konzept, Skripte, Verträge, Kooperationen, Videos und Auswertung.
_Avoid_: Kooperation, Vor-Ort-Produktion

**Kooperation**:
Creator-Buchung innerhalb einer Produktion. Dieselbe Person in einer zweiten Produktion ist ein eigener Datensatz und zählt erneut auf das Creator-Soll der Kampagne. Liegt in der Produktion im Tab Produktion.
_Avoid_: Produktion als Name der Buchung

**Neuigkeit**:
Kurzmitteilung über eine Produkt-Änderung an Mitarbeiter (titel + kurztext, Du-Form).
Wird automatisch aus Commits generiert und erscheint nur als Card auf dem Dashboard.
Es gibt keine Detail-Seite, kein Archiv und keine Screenshots.
_Avoid_: Report, News, Update-Post, Release-Notes

**Persona**:
Typ Mensch auf Unternehmensebene, optional mehreren Marken, Produkten und Briefings zugeordnet.
Liky am Produkt legt zuerst den breitesten tragfähigen Typ vor; engere Typen sind eigene Personas.
Hat Audience Situations als Bestandteil, keine eigene Prozessstufe.
Der produkt-spezifische Fit (warum, welche Use Cases) sitzt nicht an der Persona, sondern an der Zuordnung.
_Avoid_: Zielgruppe, Buyer-Persona, Kunde

**Audience Situation**:
Bestandteil einer Persona. Konkreter Moment, in dem diese Persona empfänglich sein kann.
Wiederverwendet über die Persona, nicht pro Produkt.
_Avoid_: Situation, Einsatzsituation, Use Case, Lebenssituation, Setting, Kontext

**Produkt**:
Angebot eines Unternehmens, optional mehreren Marken zugeordnet.
Personas hängen über die Zuordnung, nicht als Eigentum des Produkts.
_Avoid_: Artikel, SKU, Offer

**Use Case**:
Benannte Einsatzsituation eines Produkts. Sitzt am Produkt, nicht an der Persona.
_Avoid_: Audience Situation, Situation

**Liky**:
Der KI-Assistent. Liest Shop-URLs und Kundenbriefings aus, schlägt Personas, Creator für ein Casting und Videoideen für ein Konzept vor und schreibt im Skript-Editor.
Sitzt in der rechten Spalte der Detail-Worksheets (Produkt, Persona).
_Avoid_: Bot, Chatbot, Copilot

**Vertrag**:
Rechtliches Dokument zwischen Parteien, wird als PDF generiert. Hat genau einen Vertragstyp.
_Avoid_: Agreement, Kontrakt

**Vertrag-Status**:
Lebenszyklus des Vertragsdokuments: Entwurf, Erstellt, Gesendet, Unterschrieben, Verzögert, Abgelehnt.
Sitzt am Vertrag, nicht an der Kooperation. Wird nicht manuell gesetzt.
_Avoid_: Finalisiert, Kooperation-Status, Produktionsstatus

**Gesendet**:
Vertrag-Status nach erfolgreichem Anschreiben mit generiertem PDF.
_Avoid_: Verschickt, An Creator gesendet, Geöffnet

**Verzögert**:
Vertrag-Status, 30 Tage nach Anschreiben ohne unterschriebenes PDF.
_Avoid_: Überfällig, Ausstehend

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
Das Aktivierungsdokument eines Unternehmens, optional einer Marke. Ablage bleibt dort, die Firmenliste zeigt alle. Operativ genau einer Produktion zugeordnet und nicht wiederverwendet. Beim Anlegen wird kein Produkt gewählt; das Produkt entsteht danach. Titel frei, Vorschlag ist der Kampagnenname. Verbindliche Grundlage für Casting und Konzept dieser Produktion.
_Avoid_: Kampagnen-Briefing (das ist die Tabelle `campaign_briefings`), Kundenbriefing

**Entwurf**:
Briefing, Vertrag oder Auftrag, der noch nicht verbindlich ist. Andere Entities
verknüpfen ihn nicht über Picker; der eigene Editor bleibt beschreibbar.
_Avoid_: Draft, unpublished, nicht live

**Finalisiert**:
Briefing, Vertrag oder Auftrag, der kein Entwurf mehr ist. Auftrag-Altbestand ohne Flag
gilt als finalisiert.
_Avoid_: Final, published, live, aktiv (Prozessstatus bzw. Regelwerk)

**Briefing-Typ**:
Paid, Organic oder Influencer. Der primäre Produktionszweck eines Briefings, nicht die
spätere Nutzung und nicht die Kampagnenart.
_Avoid_: Bereich, Kampagnenart, Paid Creator Ads, Owned Social

**Verhandlungshinweis**:
Interner Hinweis am Briefing für die Vertragsverhandlung, etwa die Nutzungsdauer wenn
ein Full Buyout nicht möglich ist. Steht nicht auf dem Creator-PDF.
_Avoid_: Verhandlungsspielraum (das sitzt an den Auftragsdetails)

**Voraussetzungen**:
Checkbox-Liste der gesuchten Casting-Bedingungen am Briefing.
_Avoid_: Sonstige Voraussetzungen, Produktspezifische Erfahrung

**Sonstige Voraussetzungen**:
Freitext für Casting-Bedingungen, die in keine Checkbox passen.
_Avoid_: Voraussetzungen, Produktspezifische Erfahrung

**Produktspezifische Erfahrung**:
Ob der Creator die Marke oder das Produkt schon kennt oder selbst genutzt hat.
_Avoid_: Sonstige Voraussetzungen, Voraussetzungen

**Freigabeprozess**:
Kundenfreigabe der Inhalte vor Veröffentlichung, am Influencer-Briefing.
_Avoid_: Skript-Freigabe, Video-Freigabe

**Kundenbriefing**:
Das vom Kunden gelieferte PDF als Vorlage für ein Briefing. Genau eines pro Briefing.
Liegt im Storage der Marke, sonst des Unternehmens.
Nicht das Briefing selbst.
_Avoid_: Briefing, Quelldokument, Kundendokument

**Casting**:
Die Creator-Auswahlliste einer Produktion. Entsteht mit dem Finalisieren des Briefings. Heißt `{Briefing-Titel} Casting` und folgt der Umbenennung des Briefings. 1:1 mit dem Konzept dieser Produktion.
_Avoid_: Sourcing (außer Code/Route), Creator-Liste, Art der Liste

**Konzept**:
Das Strategie-Dokument einer Produktion. Entsteht mit dem Finalisieren des Briefings. Heißt `{Briefing-Titel} Konzept` und folgt der Umbenennung des Briefings. Sammlung von Videoideen. 1:1 mit dem Casting dieser Produktion.
_Avoid_: Strategie (außer Tabelle `strategie`), Strategie-Doc

**Casting-Eintrag**:
Eine Person auf einem Casting, zugeordnet einer Persona des Briefings.
Nicht der CRM-Creator; die Stammdaten-Identität kann später entstehen.
Darf an mehreren Videoideen des verknüpften Konzepts hängen.
_Avoid_: Casting-Item, Kandidat, Sourcing-Creator, Kategorie

**Kundenfeedback**:
Die Kundenbewertung eines Casting-Eintrags: Prio 1, Prio 2 oder Abgelehnt.
Unabhängig vom internen Prozessstatus (Angefragt … Gebucht).
_Avoid_: Freigabe, Freigabeprozess, Status

**Creator**:
Stammdaten-Entity einer Person (Tabelle `creator`), mit Mail (`mail`) und Management-Zuordnung.
Nicht der Casting-Eintrag; der kann später zum Creator werden.
_Avoid_: Casting-Eintrag, Influencer, Kandidat

**Bedarf**:
Das gesuchte Creator-Profil eines Castings, abgeleitet aus Briefing, Produkt
und den Briefing-Personas. Pro Briefing-Persona ein eigener Bedarf
(Briefing plus diese Karte plus accepted Produkt-Fit).
_Avoid_: Suche, Zielgruppe, Filter

**Buchungsbild**:
Die historisch gebuchten bzw. bewerteten Creator zu Marke und Kampagnenart.
Dient als Wiederholungs- und Ablehnungsfilter (Gates) und liefert die Historie für Track.
_Avoid_: Qualitätsurteil, Proven-Slot

**Casting-Vorschlag**:
Ein für ein Casting vorgeschlagener Creator, zugeordnet genau einer Briefing-Persona.
Wird durch Aktivieren zum Casting-Eintrag.
Pro Briefing-Persona stehen bis zu sechs pending Vorschläge;
innerhalb der Gruppe Ranking nach Matching.
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

**Übernehmen**:
Einen KI-Vorschlag zur Stammdaten-Entity machen: Videoidee-Vorschlag wird zur normalen Videoidee (Flag weg, Ohne Kategorie); Persona-Vorschlag `typ=neu` wird zur Persona unter Unternehmen/Marke. Speichern des Produkts allein übernimmt keine Persona.
_Avoid_: Aktivieren (Casting), Annehmen (Persona)

**Management**:
Die Talent-Agentur als Stammdaten-Entity (Tabelle `management`), n:m zu Creator über `creator_management`.
Nicht die Mitarbeiter-Rolle `management`.
_Avoid_: Agentur-Rolle, Mitarbeiter-Klasse Management

**Videoidee**:
Eintrag in einem Konzept: verlinkte Videoidee oder reine Idee. Genau eine Umsetzung, nicht
eine Kernidee mit mehreren Creatorn. Höchstens ein Casting-Eintrag aus dem verknüpften Casting;
zuordenbar einem Kooperationsvideo. Kann als Videoidee-Vorschlag entstehen.
_Avoid_: Idee/Strategie, Referenzvideo, Kernidee

**Videoidee-Vorschlag**:
KI-generierte Videoidee in einem Konzept, noch nicht übernommen. Dieselbe Zeile wie die
Videoidee, visuell abgetrennt. Übernehmen macht sie zur normalen Videoidee; Verwerfen löscht sie.
_Avoid_: Creative Angle, Grobkonzept, Casting-Vorschlag

**Skript**:
Text für genau ein Video und genau einen Creator: den der verknüpften Kooperation, sonst den Creator der Videoidee.
_Avoid_: Drehbuch, Copy

**Skript-Freigabe**:
Ausdrückliche Freigabe einer Videoidee für die Skripterstellung. Voraussetzung: zugeordneter
Casting-Eintrag und nicht „Nicht umsetzen“. Gate nur für Neuanlage, nicht für bestehende Skripte.
_Avoid_: Freigabe (alleinstehend – Kollision mit Video-Freigabe am Kooperationsvideo), Freigabeprozess

**Hook-Variante**:
Alternativer gesprochener Opener am selben Skript (Hook 1–3). Keine eigene Version.
_Avoid_: Variante, Alternative Version, Hook-Option

**Kooperationsvideo**:
Das hochgeladene Videofile in einer Kooperation (Dropbox-Asset), wird in der
VideoPlayerLightbox abgespielt. Nicht zu verwechseln mit der Videoidee.
_Avoid_: Upload, Videodatei

**Video-Nr**:
Positionsnummer des Kooperationsvideos in der Kooperation (1, 2, 3), Feld `position`.
Steht im Dropbox-Ordner (`Video_2_...`) und im Dateinamen vor `v{n}` bzw. `final`.
Nicht die Feedbackschleife.
_Avoid_: Version (das ist die Feedbackschleife), Videoversion

**Feedbackschleife**:
Eine Überarbeitungsrunde desselben Kooperationsvideos (`version_number`, max 3).
Steht im Dateinamen als `v1`/`v2`/`v3` hinter der Video-Nr.
_Avoid_: Version (alleinstehend), Revision

**Kooperationstabelle**:
Tabelle auf der Produktion mit Kooperationen und Video-Stacks. Tab-Label innerhalb der Produktion ist Produktion.
_Avoid_: Kampagnen-Tabelle

**Eigene Spalte**:
User-definierte Spalte in der Kooperationstabelle.
_Avoid_: Custom Column (in der UI)

**Anschreiben**:
E-Mail mit Dokumentanhang (Briefing-PDF, Vertrags-PDF oder Skript-PDF) an adressierbare Empfänger.
Kein CRM-Login, kein Link. Pro Empfänger eine eigene Mail. Ein Modul, mehrere Dokumenttypen.
_Avoid_: Versand (das ist der Paketversand an Kooperationen), Teilen, Einladen

**Empfänger**:
Wer ein Anschreiben bekommt: CRM-Creator (`creator.mail`) oder Management (`management.email`),
jeweils mit ID und Mail. Am Skript-Anschreiben auch ein Ansprechpartner (`ansprechpartner.email`)
des Unternehmens, und der Marke wenn das Skript eine hat.
Kann am Dokument feststehen (dann Anzeige) oder im Anschreiben gewählt
werden — gesteuert am Anschreiben-Kernel, nicht pro Seite.
Am Skript-Anschreiben sind die wählbaren Creator die, denen ein Skript im aktuellen Umfang gehört:
das Kooperation-Video, sonst der Casting-Creator der Videoidee. Das Management ist nur deren aktive
Zuordnung, die Kampagne nur die des Skripts. Der Anhang eines Creators sind nur seine Skripte,
der eines Managements die seiner Creator, der eines Ansprechpartners der ganze Umfang.
Kein Casting-Eintrag ohne CRM, keine freie Adresse ohne Datensatz.
_Avoid_: Casting-Eintrag, freie E-Mail

**Mailvorlage**:
Gespeicherter Betreff und Body mit Platzhaltern für ein Anschreiben. Ein Standard pro Dokumenttyp
(Briefing, Vertrag, Skript); weitere sind privat, optional „für alle nutzbar“.
_Avoid_: Template (Kollision mit Vertragstemplate), E-Mail-Template

**Zugang**:
Gast-Link plus Code auf eine geteilte Liste (`list_shares`). Bei einem Skript wahlweise dieses Skript oder alle Skripte derselben Kampagne, auch später entstandene. Live-Sicht im CRM, kein Anhang.
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

**Kampagnen-Ordnerblatt**:
Grid-Ansicht der Kampagnen-Übersicht: Unternehmen-/Marken-Hierarchie als Ordner.
Zählt Kampagnen pro Ordner, lädt sie erst auf der letzten Ebene. Flach unter der
Marke — der Auftrag ist Spalte, keine eigene Ebene.
_Avoid_: Ordneransicht, Kampagnen-Explorer

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
Die Leistungsform einer Kampagne: UGC Paid, UGC Organic, Influencer Kampagne, Influencer Story,
Influencer Events, Vor-Ort-Produktion, Whitelisting oder Darkposting. Sitzt an der Kampagne,
nicht an der Produktion und nicht am Auftrag. Video-Soll und Creator-Soll gelten für die ganze Kampagne; jede Kooperation zählt, auch wenn dieselbe Person in zwei Produktionen gebucht ist.
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
Ein eingefrorener Stand des Investor-Dashboards (Monatsauswertung und Zahlungsstand), der
belegt, worauf ein verschicktes Update beruhte. Die Ansicht rechnet immer live; ein Berichtsstand
wird nie korrigiert, sondern durch einen neuen Stand ersetzt.
_Avoid_: Snapshot, Report, Export

**Investor**:
View-only Lesezugang auf Finanzuebersicht und operative Plattform. Zwei Wege, dieselbe
Einschraenkung: die Rolle `investor` (eigener Login, RLS-Wahrheit) oder die
Mitarbeiter-Klasse Finanzen (`rolle = mitarbeiter`, sieht Preise). Beide laufen ueber
dieselbe Feature-Zeile im PermissionSystem: keine Mails bei Ansprechpartnern, keine
Tabellen-Werkzeuge, keine Uploads, kein Skript-Kommentieren, kein Feedback.
_Avoid_: Admin, Mitarbeiter, Gast, Stakeholder (alter Name der Finanzuebersicht; jetzt Investor-Dashboard)

**Accounting-Bereich**:
Eigener Bereich unter /admin fuer Admins und Investoren. Reduzierte Navigation auf Zahlen und Auftrag
(Dashboard = Investor-Dashboard, Datenqualitaet, Projekt anlegen, Auftraege,
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
