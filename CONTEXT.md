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
Die PDF-Variante innerhalb des Vertragstyps Influencer Kooperation: Standard oder Direktvertrag.
_Avoid_: Vertragstyp, Layout

**Direktvertrag**:
Vertragstemplate der Influencer Kooperation, bei dem der Kunde (z.B. BURGA, UAB Hautica) direkt
Vertragspartei des Influencers ist. LikeGroup tritt nicht als Vertragspartei auf.
Wird nur bei diesen Kunden angeboten. Hat einen Anhang pro gebuchter Plattform (Anhang A, B, ...).
_Avoid_: Awareness-Vertrag, BURGA-Vertrag
