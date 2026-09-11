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
Der KI-Assistent. Liest Shop-URLs aus, schlägt Personas vor und schreibt im Skript-Editor.
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
Interner Lesezugang fuer die Finanzuebersicht und die operative Plattform, ohne Schreibrecht.
_Avoid_: Admin, Mitarbeiter, Finanzen, Gast

**Accounting-Bereich**:
Eigener Bereich unter /admin fuer Admins und Investoren. Reduzierte Navigation auf Zahlen und Auftrag
(Dashboard = Stakeholder-Uebersicht, Datenqualitaet, Projekt anlegen, Auftraege,
Kundenrechnungen, Creatorrechnungen). Datenqualitaet und Projekt anlegen bleiben Admin.
Einstieg ueber den Schild-Button; die volle App liegt hinter Zurueck zur App.
_Avoid_: Adminbereich, Backend, Admin-Panel, Einstellungen

**Datenqualitaetsanzeige**:
Seite im Accounting-Bereich, die Pflegemaengel an Finanzdaten nach Kampagne gruppiert und nach
betroffenem Geldvolumen sortiert zeigt. Sie benennt die Faelle; korrigiert wird von den Teams.
Gleicher Ein- und Verkaufspreis ist bewusst kein Mangel (Fee-Modell).
_Avoid_: Qualitaetsdashboard, Fehlerliste, Audit

**Pflegegrad**:
Anteil fehlerfreier gepruefter Einheiten (Videos, Kooperationen, Auftraege, Rechnungen) einer
Kampagne in der Datenqualitaetsanzeige. 100 % heisst: alles Gepruefte ist vollstaendig gepflegt.
_Avoid_: Score, Qualitaetsindex, Ampel
