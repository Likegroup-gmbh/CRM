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

**Projektname**:
Der Titel des Auftrags (`auftrag.titel`) und Basisname der Namenskette. Die Kampagne trägt ihn als Kampagnenname; Produktion, Briefing, Casting und Konzept leiten ihre Namen davon ab (ADR 0041). Eine Umbenennung zieht Bestand nicht nach.
_Avoid_: Eigener Name der Kampagne als Basis

**Kampagne**:
Überübersicht unter einem Auftrag. Hält den Budget-Topf, die Kampagnenarten und das Video- und Creator-Soll. Parent der Produktionen. Die Seite zeigt Summe und Soll, keine Workflow-Tabs.
_Avoid_: Überkampagne, Auftrag

**Produktion**:
Container unter genau einer Kampagne, immer sichtbar, auch ohne Briefing. Entsteht mit dem Auftrag (so viele, wie dort geplant) oder jederzeit von Hand. Heißt `Projektname – Produktion N` (frei änderbar); der Titel des ersten finalisierten Briefings wird einmalig übernommen, danach ist der Name eigenständig. Hat ein optionales Produktionsbudget, das alle Linien teilen. Kein eigenes Soll. Enthält null bis beliebig viele Linien; darunter hängen Verträge, Kooperationen, Videos und Auswertung über die Linien.
_Avoid_: Kooperation, Vor-Ort-Produktion, Geist

**Produktionsbudget**:
Betrag, mit dem eine Produktion arbeitet, geschnitten aus dem Volumen ihrer Kampagne. Leer heißt, sie teilt sich das Volumen mit den anderen ohne Budget.
_Avoid_: Creator-Budget, Kooperation, Geist, Anteil

**Linie**:
Ein Strang innerhalb einer Produktion: ein Briefing plus sein Casting, sein Konzept, seine Skripte und seine Kooperationen. Entsteht mit dem Finalisieren des Briefings; ein Entwurf erscheint schon als Linie mit Badge. Casting und Konzept lesen nur das Briefing ihrer Linie, nie das einer anderen. Eine Produktion kann mehrere Linien haben, etwa Nano-Influencer und UGC-Creator mit 20.000 Followern. Das Produkt sitzt an der Linie. Eine Linie mit Kooperationen lässt sich nicht löschen.
_Avoid_: Strang, Briefing-Line, Geist, Zweig

**Kooperation**:
Creator-Buchung innerhalb einer Linie. Dieselbe Person in einer zweiten Linie, auch derselben Produktion, ist ein eigener Datensatz und zählt erneut auf das Creator-Soll der Kampagne. Liegt in der Produktion im Tab Produktion. Ein bestehender Vertrag desselben Creators in derselben Kampagne kann sie mitdecken, statt einen neuen Vertrag zu verlangen.
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
Rechtliches Dokument zwischen Parteien, wird als PDF generiert. Hat genau einen Vertragstyp. Deckt eine oder mehrere Kooperationen desselben Creators in derselben Kampagne, auch über Linien und Produktionen hinweg; das PDF ändert sich dadurch nicht. Eine Kooperation hat höchstens einen Vertrag, der nicht Abgelehnt ist. Die Summe der Videoanzahl der gedeckten Kooperationen darf `anzahl_videos` des Vertrags nicht übersteigen (gilt nur, wenn der Vertrag eine Videoanzahl nennt). Übersteigt die Summe der Einkaufspreise die Vergütung, wird das angezeigt, aber nicht gesperrt. Rechnungen laufen nur über gedeckte Kooperationen auf den Vertrag.
_Avoid_: Agreement, Kontrakt, Rahmenvertrag, Nachtrag, Verträge kombinieren

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
Das Aktivierungsdokument eines Unternehmens, optional einer Marke. Ablage bleibt dort, die Firmenliste zeigt alle. Operativ genau einer Produktion zugeordnet (Pflicht, schon beim Anlegen) und nicht wiederverwendet; eine Produktion kann mehrere Briefings haben, jedes ist eine eigene Linie. Beim Anlegen wird kein Produkt gewählt; das Produkt entsteht danach. Titel ist der Projektname, optional mit Zusatz (`Projektname – Zusatz`); hat die Produktion einen eigenen Namen, ersetzt er den Projektnamen als Basis; im Formular weiter änderbar. Verbindliche Grundlage für Casting und Konzept seiner Linie.
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

**Videolänge**:
Geschlossenes Intervall in ganzen Sekunden am Briefing, von und bis inklusive. Von darf gleich bis sein. Leer heißt, es ist keine Videolänge vorgegeben. Beim Anlegen eines Skripts wird das Intervall kopiert; das Skript zeigt es an. Eine spätere Änderung am Briefing gilt für neue Skripte.
_Avoid_: Videolängen, Nutzungsdauer, Video-Mindestlänge

**Verhandlungshinweis**:
Interner Hinweis am Briefing für die Vertragsverhandlung, etwa die Nutzungsdauer wenn
ein Full Buyout nicht möglich ist. Steht nicht auf dem Creator-PDF.
_Avoid_: Verhandlungsspielraum (das sitzt an den Auftragsdetails)

**Don't**:
Kommunikative Vorgabe am Briefing, was nicht getan werden darf. Wird vor dem Matching gelesen. Trifft er ein Profilfeld, schließt fehlende oder widersprechende Angabe den Creator aus. Trifft er nur den Profiltext, schließt er nur bei einem Beleg aus. Betrifft er die Formulierung, bindet er Konzept und Skript und ist kein Personenfilter.
_Avoid_: Do, Vorgaben und Ausschlüsse, Voraussetzung, Do’s und Don’ts (das alte Sammelfeld), EHG-Unterlage Do’s & Don’ts

**Do**:
Kommunikative Vorgabe am Briefing, was der Inhalt tun soll. Wird nach den Don’ts mitbedacht und ist kein Ausschluss.
_Avoid_: Don’t, Pflichtinhalt, Do’s und Don’ts (das alte Sammelfeld)

**Profilfeld**:
Vordefiniertes Feld am Creator, das eine Suche abfragen kann: Alter, Geschlecht, Branche, Creator-Typ, Sprache, Follower-Größe, Standort, Plattform, Hat Kinder, Hat Haustier, Spielt Instrument. Leer oder daneben schließt aus.
_Avoid_: Profiltext

**Profiltext**:
Freitext am Creator, den er selbst schreibt oder der von Instagram kommt: Bio, Notiz, Captions, Mentions. Ein Treffer belegt einen Personen-Don’t, ein fehlender Treffer ist kein K.-o.
_Avoid_: Profilfeld

**Voraussetzungen**:
Checkbox-Liste der gesuchten Casting-Bedingungen am Briefing.
_Avoid_: Sonstige Voraussetzungen, Produktspezifische Erfahrung, Don’t

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
Die Creator-Auswahlliste einer Linie. Entsteht mit dem Finalisieren des Briefings. Heißt `{Briefing-Titel} Casting` und folgt der Umbenennung des Briefings. 1:1 mit dem Konzept dieser Linie.
_Avoid_: Sourcing (außer Code/Route), Creator-Liste, Art der Liste

**Konzept**:
Das Strategie-Dokument einer Produktion. Entsteht mit dem Finalisieren des Briefings. Heißt `{Briefing-Titel} Konzept` und folgt der Umbenennung des Briefings. Sammlung von Videoideen. 1:1 mit dem Casting dieser Linie.
_Avoid_: Strategie (außer Tabelle `strategie`), Strategie-Doc

**Casting-Eintrag**:
Eine Person auf einem Casting, optional einer eigenen Kategorie des Castings zugeordnet.
Ohne Kategorie steht sie unter „Ohne Kategorie“; „Nicht umsetzen“ ist ein reservierter Eimer.
Nicht der CRM-Creator; die Stammdaten-Identität kann später entstehen.
Darf an mehreren Videoideen des verknüpften Konzepts hängen.
_Avoid_: Casting-Item, Kandidat, Sourcing-Creator

**Kundenfeedback**:
Die Kundenbewertung eines Casting-Eintrags: Prio 1, Prio 2 oder Abgelehnt.
Unabhängig vom internen Prozessstatus (Angefragt … Gebucht).
_Avoid_: Freigabe, Freigabeprozess, Status

**Creator**:
Stammdaten-Entity einer Person (Tabelle `creator`), mit Mail (`mail`) und Management-Zuordnung.
Nicht der Casting-Eintrag; der kann später zum Creator werden.
_Avoid_: Casting-Eintrag, Influencer, Kandidat

**Casting-Bestand**:
Die Personen, die auf mindestens einem Casting standen, auch ohne Creator-Datensatz. Eine Zeile pro Person: mit Datensatz die des Creators, ohne Datensatz gruppiert über den Instagram-Handle, sonst über den Namen. Ein Eintrag ohne Datensatz, dessen Handle zu einem Creator gehört, zählt auf dessen Zeile. Ein Punkt am Bild zeigt, ob der Datensatz da ist (grün) oder fehlt (rot); nur grüne Zeilen öffnen den Creator. Zähler für Castings (je Casting einmal), Prio 1, Prio 2, Abgelehnt und Produktion zählen die ganze Historie. Produktion ist die Zahl der Kooperationsdatensätze des Creators, unabhängig von Rechnungen. Dazu zeigt die Zeile die Branchen des Creators. Sortierbar über die Spaltenköpfe; Filter-Chips gibt es vorerst nicht, nur die Namenssuche. Zeilen lassen sich markieren und auf ein Casting legen („Zu Casting hinzufügen“, Kategorie optional): jede markierte Person wird dort ein neuer Casting-Eintrag, mit Creator-Verknüpfung bei grünem Punkt, sonst ohne. Wer schon auf diesem Casting steht (Creator, sonst Instagram-Handle, sonst Name), wird übersprungen. Die Zeile im Bestand bleibt.
_Avoid_: Casting, Creator-Liste, Creator Casting, Übernehmen, Verschieben

**Bedarf**:
Das gesuchte Creator-Profil eines Castings, abgeleitet aus Briefing, Produkt
und den Briefing-Personas. Ein Bedarf je Casting; die Personas des Briefings
fließen als Hinweis in den Fit ein, gruppieren aber nichts.
_Avoid_: Suche, Zielgruppe, Filter

**Buchungsbild**:
Die historisch gebuchten bzw. bewerteten Creator zu Marke und Kampagnenart.
Dient als Wiederholungs- und Ablehnungsfilter (Gates) und liefert die Historie für Track.
_Avoid_: Qualitätsurteil, Proven-Slot

**Casting-Vorschlag**:
Ein für ein Casting vorgeschlagener Creator.
Wird durch Aktivieren zum Casting-Eintrag unter „Ohne Kategorie“.
Pro Casting stehen bis zu sechs pending Vorschläge in einer Liste, Ranking nach Matching.
_Avoid_: Casting-Eintrag, Kategorie „Vorschläge“, Kandidat, Slot-Portfolio

**Fit**:
Briefing-Passung eines Creators (0-100): Nische, Persona, Voraussetzungen, Größe,
Plattform, Mentions, Standort, Text. Eine abgefragte Angabe, die der Datensatz nicht
beantworten kann oder die nicht trifft, schließt den Creator aus.
_Avoid_: Fit Score als eigenständige Kennzahl (ist Bestandteil von Matching), 0 Punkte bei unbelegt, Raten

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

**Creator-Tausch**:
Ein abspringender Creator wird in einer Produktion durch einen anderen Casting-Eintrag desselben Castings ersetzt. Videoideen, Skripte und Kooperation wechseln zum Ersatz, der alte Eintrag gilt als Abgesagt und zählt in Track. Der Ersatz muss vorher selbst im Casting stehen und die Gates erfüllen (Kunden-Prio, Zusage oder Gebucht). Nicht tauschbar ist, sobald ein Vertrag unterschrieben ist, eine Rechnung existiert oder ein Video hochgeladen wurde. Ein unterschriebener Vertrag sperrt den Tausch auf jeder Kooperation, die er deckt. Nicht unterschriebene Verträge des Abspringers bleiben als Abgelehnt in der Historie, außer sie decken noch eine Kooperation, die nicht getauscht wird: dann bleibt der Vertrag und verliert nur die getauschte Kooperation. Das Skript behält Text und Kundenfreigabe, bekommt aber einen Hinweis und eine Festlegung zur neuen Besetzung.
_Avoid_: Ersetzen (das ist Videoidee-Vorschläge ablösen), Wechsel, Absage-Flow, Umbesetzen

**Übernehmen**:
Einen KI-Vorschlag zur Stammdaten-Entity machen: Videoidee-Vorschlag wird zur normalen Videoidee (Flag weg, Ohne Kategorie); Persona-Vorschlag `typ=neu` wird zur Persona unter Unternehmen/Marke. Speichern des Produkts allein übernimmt keine Persona.
_Avoid_: Aktivieren (Casting), Annehmen (Persona)

**Management**:
Die Talent-Agentur als Stammdaten-Entity (Tabelle `management`), n:m zu Creator über `creator_management`.
Nicht die Mitarbeiter-Rolle `management`.
_Avoid_: Agentur-Rolle, Mitarbeiter-Klasse Management

**Videoidee**:
Eintrag in einem Konzept: Videoreferenz oder Idee. Genau eine Umsetzung, nicht
eine Kernidee mit mehreren Creatorn. Höchstens ein Casting-Eintrag aus dem verknüpften Casting;
zuordenbar einem Kooperationsvideo. Kann als Videoidee-Vorschlag entstehen.
_Avoid_: Konzeptidee, Kernidee

**Videoreferenz**:
Videoidee mit Videolink. Trägt eine Umsetzungsvorgabe.
_Avoid_: Referenzvideo, verlinkte Videoidee

**Idee**:
Videoidee ohne Videolink. Tab beim Hinzufügen, nicht das Konzept und nicht der Videoidee-Vorschlag.
_Avoid_: Konzeptidee, Konzept

**Umsetzungsvorgabe**:
Pflichttext an einer Videoreferenz: was davon umgesetzt werden soll. Sieht nur das Team.
_Avoid_: Was gefällt dir

**Kundenadaption**:
Text an einer Videoidee, wie eine Videoreferenz für diesen Kunden laufen könnte. An einer Idee bleibt sie leer, bis jemand sie schreibt.
_Avoid_: Beschreibung, Videoidee-Vorschlag

**Umsetzen**:
Markierung an einer Videoidee, dass für den zugeordneten Creator die Kooperation dieser
Produktion gestartet werden darf. Pro Creator eine Kooperation.
_Avoid_: Umgesetzt

**Videoidee-Vorschlag**:
KI-generierte Videoidee in einem Konzept, noch nicht übernommen. Dieselbe Zeile wie die
Videoidee, visuell abgetrennt. Übernehmen macht sie zur normalen Videoidee; Verwerfen löscht sie.
_Avoid_: Creative Angle, Grobkonzept, Casting-Vorschlag

**Umschreiben**:
Die Beschreibung eines Videoidee-Vorschlags neu schreiben. Dieselbe Zeile, das Flag bleibt.
_Avoid_: Neu generieren (das ist Ersetzen), Bearbeiten im Drawer

**Ersetzen**:
Die genannten Videoidee-Vorschläge durch neu entworfene ablösen. Die alten bleiben,
bis die neuen in der Tabelle liegen.
_Avoid_: Umschreiben (dieselbe Zeile bleibt), Neu entwerfen (addiert, verwirft nichts)

**Skript**:
Text für genau ein Video und genau einen Creator: den der verknüpften Kooperation, sonst den Creator der Videoidee. Organic und Influencer sind eine Empfehlung von Person zu Person, außer ein Don't oder das Briefing verlangt etwas anderes. Paid bleibt ein Performance-Creative.
_Avoid_: Drehbuch, Copy

**Skript-Freigabe**:
Ausdrückliche Freigabe einer Videoidee für die Skripterstellung. Voraussetzung: zugeordneter
Casting-Eintrag und nicht „Nicht umsetzen“. Gate nur für Neuanlage, nicht für bestehende Skripte.
_Avoid_: Freigabe (alleinstehend – Kollision mit Video-Freigabe am Kooperationsvideo), Freigabeprozess

**Kundenfreigabe**:
Der Kunde gibt ein Skript frei, das intern bereits Final ist. Danach gilt das Skript als freigegeben für weitere Aktionen, und die Skript-Freigabe am verknüpften Kooperationsvideo ist gesetzt.
_Avoid_: Skript-Freigabe, Final

**Hook-Variante**:
Alternativer gesprochener Opener am selben Skript (Hook 1–3). Keine eigene Version.
_Avoid_: Variante, Alternative Version, Hook-Option

**Skript-Titel**:
Arbeitstitel des Skripts. Eigene Zelle im Editor, nicht der On-Screen-Text.
_Avoid_: Headline, On-Screen-Text

**Neuformulierung**:
Auftrag im Editor, dieselbe Geschichte neu zu formulieren. Funktion, Figuren, Setting und Aussage bleiben.
_Avoid_: Neu schreiben, Neue Geschichte, Hook-Variante

**Neue Geschichte**:
Auftrag im Editor, Situation und Einstieg zu wechseln. Claims, Don'ts und Besetzung bleiben.
_Avoid_: Neuformulierung, Hook-Variante, Videoidee

**Festgezogen**:
Zelle eines Skripts, die ein späterer Auftrag nicht ersetzen darf, solange der Auftrag nicht genau diese Zelle verlangt. Ein Satz darin ist nur geschützt, wenn er markiert ist. Ein Auftrag mit Umfang Alles oder ein benannter Teil öffnet die Zellen in diesem Umfang; eine Markierung allein nicht.
_Avoid_: Freigabe, Skript-Freigabe, Kundenfreigabe

**Umfang**:
Reichweite eines Auftrags im Editor. Steht im Text: Alles, ein benannter Teil (Hook, Hauptteil, CTA) oder eine Markierung. Alles und ein benannter Teil schlagen die Markierung und öffnen Festgezogen in diesem Umfang. Benannter Teil meint Was gesagt wird und Was zu sehen ist derselben Sektion. Ohne Umfang und ohne Markierung fragt Liky einmal nach der Sektion. Ein Wechsel von Figur, Besetzung, Ort oder Geschichte im freien Chat hat immer den Umfang Alles, auch ohne das Wort.
_Avoid_: Sektion, Spalte, Kontext

**Festlegung**:
Fakt am Skript, der ab dann in jedem weiteren Auftrag gilt, ohne ihn neu zu nennen. Entsteht aus einer ausdrücklichen Anweisung oder einer Ablehnung, nicht aus dem angenommenen Wortlaut. Zum Beispiel die Besetzung, ein abgelehnter Ansatz oder ein Tarifverbot.
_Avoid_: Feedback, Kundenfeedback, Feedbackschleife, Don't

**Skript-Aufbau**:
Gesprochene Reihenfolge bei Organic und Influencer: Alltag, Problem, Produkt, CTA. Das Produkt kommt erst danach und sagt, was es ist, wie es funktioniert und warum es hilft. Der CTA ist eine Empfehlung. Tarife nur, wenn das Briefing sie zum Thema macht. Paid folgt dem Funnel-Aufbau des Masters.
_Avoid_: Storytelling, Story, Beat

**Alltag**:
Der konkrete Moment am Anfang des Skripts, bevor das Produkt vorkommt. Eine Audience Situation der Persona, wenn sie eine hat.
_Avoid_: Situation, Setting, Audience Situation

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

**Story**:
Ein Story-File in einer Kooperation, mit eigenen Feedbackschleifen und finalen Versionen.
Nicht die Kampagnenart Influencer Story.
_Avoid_: Influencer Story, Slot

**Still**:
Das finale Standbild eines Kooperationsvideos. Trägt kein Seitenverhältnis.
_Avoid_: Bild, Thumbnail, Cover

**Finale Version**:
Das ausgelieferte File eines Kooperationsvideos oder einer Story, in genau einem Seitenverhältnis.
Liegt neben der Feedbackschleife, nicht in ihr.
_Avoid_: Final, Master, Export

**Seitenverhältnis**:
9:16, 4:5 oder 1:1 an einer finalen Version von Kooperationsvideo oder Story. Mehrere finale Versionen desselben Verhältnisses können nebeneinander liegen.
_Avoid_: Format (Kollision mit Kampagnenart), Ratio, 16:9, 4:3

**Abwählen**:
Eine markierte finale Version zurücknehmen. Trifft nur diese eine Datei; die Feedbackschleife, aus der sie stammt, bleibt.
_Avoid_: Löschen, Ersetzen

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
Die Unternehmen-/Marken-Hierarchie der Kampagnen-Übersicht. Liste zeigt die Ordner
als Zeilen, Grid als Karten; die letzte Ebene ist in beiden die Kampagnen-Übersicht.
Zählt Kampagnen pro Ordner, lädt sie erst auf der letzten Ebene. Flach unter der
Marke — der Auftrag ist weder Ebene noch Spalte. Gibt es unter dem Unternehmen keine
Marke, entfällt diese Ebene und die Liste öffnet direkt. Gesetzte Suche hebt die Ordner nur
auf der Liste in der Anzeige auf; das Grid hat keine Suche.
_Avoid_: Ordneransicht, Kampagnen-Explorer

### Rechnungswesen

**Teilrechnung**:
Eine von mehreren Rechnungen zum selben Auftrag oder zur selben Kooperation.
Derselbe Begriff gilt in beide Richtungen; die Richtung ergibt sich aus Kundenrechnung oder Creatorrechnung.
_Avoid_: Abschlagsrechnung, Anzahlung, Rate

**Restbetrag**:
Sollbetrag minus Summe der bereits gestellten Rechnungen. Beziffert, was noch abgerechnet werden darf,
und ist damit die einzige Bedingung dafür, ob eine weitere Teilrechnung möglich ist.
Die Summe zählt nur das Honorar (Netto plus steuerfreie Anteile); der KSK-Selbstzahler-Aufschlag
und Zusatzkosten bleiben außen vor (separates Konto bzw. durchlaufende Posten).
_Avoid_: Offener Posten, Differenz, Rest

**KSK-Selbstzahler**:
Ausnahmefall: Der Creator weist die Künstlersozialabgabe (4,9 %) als Aufschlag auf seiner Rechnung aus
und führt sie selbst ab — die Agentur zahlt nichts an die KSK. Der Aufschlag ist ein separates Konto:
Er berührt weder Restbetrag noch Gesamtbudget und darf nur auf die Creator-Leistung berechnet werden
(Agenturleistung muss separat ausgewiesen sein). Auf der Rechnung als „Creator führt selbst ab"
gekennzeichnet, damit die Buchhaltung nicht doppelt zahlt.
_Avoid_: KSK-pflichtig (Contracting-Seite), KSK abgeführt

**Abrechnungshinweis**:
Rein interner Freitext in den Auftragsdetails, wie Kosten abgerechnet werden, wenn sie vom Standard abweicht
(Zusatzkosten separat ausgewiesen). Erscheint in keinem Kunden-Dokument; Detailansicht nur für interne Rollen.
Wird beim Anlegen einer Creator-Rechnung eingeblendet.
Beispiel Juniper: Programmteilnahmen laufen über das Honorar, Reisekosten bleiben Zusatzkosten.
Bewusst Freitext, weil die Ausnahme pro Kostenart gilt, nicht pro Auftrag.
_Avoid_: Zusatzkosten-Flag, Honorar-Option

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
Bei Kundenrechnungen sitzt der Zahlungsstand an der Teilrechnung, nicht am Auftrag, sobald Teilrechnungen existieren.
_Avoid_: Überwiesen, beglichen, erledigt

**Unbezahlt**:
Eine gestellte Rechnung, deren Zahlung noch nicht eingegangen ist.
_Avoid_: Offen, ausstehend

**Überfällig**:
Eine unbezahlte Rechnung, deren Zahlungsziel überschritten ist. Teilmenge von Unbezahlt, kein eigener Summand.
_Avoid_: Mahnung, Verzug

**Offen**:
Unbezahlt plus noch nicht gestellter Restbetrag auf der Creatoranteil-Kachel. Überfällig steckt in Unbezahlt.
_Avoid_: Offener Posten, Rest

**Berichtsstand**:
Ein eingefrorener Stand des Investor-Dashboards (Monatsauswertung und Zahlungsstand), der
belegt, worauf ein verschicktes Update beruhte. Die Ansicht rechnet immer live; ein Berichtsstand
wird nie korrigiert, sondern durch einen neuen Stand ersetzt.
_Avoid_: Snapshot, Report, Export

**Dashboard-Ergebnis**:
Das fertig gerechnete Ergebnis fuer das Investor-Dashboard: je Auftrag eine Zeile plus die
Monatsauswertung. Es entsteht in `berechneDashboard` (eine Implementation), normalerweise in der
Netlify-Function `stakeholder-dashboard`, sonst im Browser. Jahr und Leistungsbereich filtert der
Browser nur noch auf den Zeilen. Wird nie gecacht (ADR 0040).
_Avoid_: Finanzbestand (das sind die Rohzeilen, die Datenqualitaet braucht), Aggregat, Snapshot

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

**Berechtigung**:
Das Modul in `src/core/PermissionSystem.js`. UI fragt Capabilities ueber `can(entity, verb)`
mit den vier Verben `view / create / edit / delete` — nie Rollen wie `isKunde`/`isMitarbeiter`
und nie Roh-Flags wie `permissions?.x?.can_edit`. Rolle, Mitarbeiter-Klasse, zugriffsrechte
und das user_permissions-Overlay bleiben Implementation des Moduls. Eine neue Rolle oder
Klasse ist eine Zeile True/False in der Matrix, kein neuer Code-Pfad. Admin-Toggles schlagen
die Klassen-Zeile (Klasse ist Default, kein hartes Preset). RLS bleibt die Server-Wahrheit;
die UI versteckt nur, was ohne Recht eh fehlschluege.
_Avoid_: Rolle-Check im Renderer, `!isKunde` als Write-Gate, `can_edit !== false`

**Investor**:
Die Mitarbeiter-Klasse Finanzen. Intern (`rolle = mitarbeiter`, sieht Preise), aber
view-only: `create`/`edit`/`delete` ueberall false. Buttons und Aktionsmenüs, die nur
`!isKunde` fragen, sind genau deshalb die Leak-Stellen — die Investor-Ansicht laeuft ueber
Capabilities, nicht ueber die Rolle.
_Avoid_: Stakeholder (das ist die Finanzuebersicht), Finanzen-Rolle (das ist die Klasse)

**Datenqualitaetsanzeige**:
Seite im Accounting-Bereich, die Pflegemaengel an Finanzdaten nach Kampagne gruppiert und nach
betroffenem Geldvolumen sortiert zeigt. Sie benennt die Faelle; korrigiert wird von den Teams.
Gleicher Ein- und Verkaufspreis ist bewusst kein Mangel (Fee-Modell).
_Avoid_: Qualitaetsdashboard, Fehlerliste, Audit

**Pflegegrad**:
Anteil fehlerfreier gepruefter Einheiten (Videos, Kooperationen, Auftraege, Rechnungen) einer
Kampagne in der Datenqualitaetsanzeige. 100 % heisst: alles Gepruefte ist vollstaendig gepflegt.
_Avoid_: Score, Qualitaetsindex, Ampel

**Navigations-Spur**:
Eine Konsolen-Tabelle pro Navigation, von Klick bis fertigem Render: Phasen (Marken) und Supabase-Requests
mit Header-Zeit, Body-Zeit und dekodierten Bytes. Aktiv in DEV, mit `?perf=1` oder
`localStorage.perfMonitor = '1'`; `crmPerf()` gibt die letzte Spur erneut aus. Komprimierte Groessen
liefert nur DevTools Network (Supabase sendet kein Timing-Allow-Origin).
_Avoid_: PerformanceMonitor-Session, Perf-Log

**Klickpfad**:
Die Ebenen in der Breadcrumb, über die man auf die aktuelle Seite gekommen ist (z. B. Produktion > Casting > Creator).
Ersetzt den offiziellen Weg, solange man sich durch Detailseiten klickt; ein Sprung auf eine Liste oder über die
Sidebar beginnt neu. Abbrechen und Speichern führen auf die vorige Ebene zurück. Ein neuer Tab oder geteilter Link
zeigt den offiziellen Weg (ADR 0042).
_Avoid_: Herkunft, `von`, Return-To, Brotkrumen-Historie

**Offizieller Weg**:
Die feste Breadcrumb-Kette einer Seite aus ihrer Stammdaten-Hierarchie (z. B. Kampagnen > Kampagne > Produktion),
unabhängig davon, woher man kam.
_Avoid_: Standard-Breadcrumb, statische Kette
