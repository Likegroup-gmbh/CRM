# 0080 Report-PDF aus einer HTML-Vorlage, gedruckt von Chromium

Das Report-PDF soll aussehen wie das Deck, das das Team bisher von Hand baut: A4 quer, große Poster, wenige Kennzahlen, viel Weißraum. Am Look wird anfangs ständig geschraubt. Die übrigen PDFs im CRM (Briefing, Rechnung, Skript) zeichnet jsPDF Punkt für Punkt.

## Entscheidung

- **Die Vorlage ist HTML und CSS im Code** (`src/modules/report-pdf/`): eine reine Funktion vom View-Model zum HTML-Dokument, ohne DOM-Zugriff.
- **Gedruckt wird mit Chromium:** Die Background-Function `report-pdf-background` lädt dieselbe Vorlage, druckt sie mit Puppeteer `page.pdf()` und legt das PDF im privaten Bucket `report-pdfs` ab. Der Client legt dafür einen Job in `report_pdf_jobs` an und wartet per Realtime.
- **Die Seiten bricht die Vorlage um, nicht Chrome:** Jede Seite ist ein fester Block 297 × 210 mm. Die Kacheln verteilen sich gleichmäßig auf so wenige Seiten wie nötig.
- **PDF-Vorlagen zeigt dasselbe HTML** in einem iframe, mit Beispieldaten oder einer echten Produktion. Im Dev-Server tauscht HMR die Vorlage ohne Neuladen aus.
- **In der Function lädt Chromium nur eingebettete Daten und Signed URLs aus dem eigenen Supabase-Storage.** Geist geht als base64 mit, weil Lambda-Chromium keine Schriften hat. Das Kundenlogo geht als data-URL mit. Die Poster sind frische Signed URLs von `poster-urls`.

## Verworfen

- **Nachbau in jsPDF.** Dann gäbe es zwei Vorlagen: die Vorschau in HTML und die PDF in Koordinaten. Sie würden auseinanderlaufen, und 1:1 wäre nicht mehr zu halten.
- **Druckdialog des Browsers (`window.print`).** Ränder, Kopf- und Fußzeilen und Hintergrundfarben hängen am Browser und an den Einstellungen des Nutzers. Ein PDF ohne Klick auf „Speichern“ gibt es so nicht.
- **html2canvas mit Bild-PDF.** Text wird zu Pixeln: nicht durchsuchbar, unscharf beim Zoomen und schnell zweistellige MB groß.
- **Vorlage in der Datenbank, im Browser bearbeitbar.** Das brächte Versionierung, Rechte und Validierung für etwas, das selten und nur von Entwicklern geändert wird. Im Code bleibt die Vorlage testbar und im Review sichtbar.

## Folgen

- Ein PDF braucht einige Sekunden (Kaltstart von Chromium). Deshalb läuft es als Job und nicht als direkter Download.
- Für Kunde und Gast (Schritt 2) muss die Function die Daten selbst laden oder prüfen. In Schritt 1 schickt der Admin das fertige View-Model mit.
- Das View-Model kommt schon formatiert aus derselben Strecke wie der Auswertungs-Tab (`baueModell`). Die Vorlage braucht keine Formatierer und keine Kenntnis der Plattformen.
