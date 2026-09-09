# Teilrechnungen werden über den Restbetrag freigeschaltet, nicht über ein Vertragsflag

Ob zu einer Kooperation eine weitere Rechnung gestellt werden darf, ergibt sich aus ihrem Restbetrag: solange die Summe der gestellten Rechnungen unter dem Sollbetrag liegt, bleibt die Kooperation abrechenbar. Bisher entschied das `vertraege.mehrere_rechnungen_erlaubt`, eine Checkbox im Vertrags-Wizard, die gesetzt sein musste, bevor die erste Rechnung existierte, und die im UI nicht mehr zurückgenommen werden konnte. Eine abgeleitete Bedingung braucht keine Vorhersage darüber, wie später abgerechnet wird.

## Considered Options

- **Flag beibehalten, Rücknahme nachrüsten** (Toggle im Vertragsdetail): löst die Sackgasse, verlangt aber weiterhin, dass jemand die Abrechnungsweise vorab kennt und den Umweg über den Vertrag geht.
- **Ad-hoc-Entscheidung beim Anlegen der Rechnung**: kein Vorabwissen nötig, aber eine zusätzliche Frage an den Nutzer, deren Antwort aus den Daten ohnehin ableitbar ist.
- **Restbetrag als Bedingung** (gewählt): keine Entscheidung, keine Schulung, und die Auswahlliste bleibt automatisch klein, weil voll fakturierte Kooperationen herausfallen.

## Consequences

- Das Kooperations-Auswahlfeld in der Rechnungserstellung wächst nicht: rund 390 unfakturierte plus rund 40 teilfakturierte Kooperationen entsprechen der heutigen Listengröße. Voll fakturierte fallen ohne Zutun heraus.
- Der Sollbetrag wirkt weich: Überschreitungen werden gewarnt, nie blockiert. Zum Zeitpunkt der Entscheidung lagen 36 Kooperationen über und 41 unter ihrem Einkaufspreis — eine harte Sperre hätte Bestandsdaten unbearbeitbar gemacht.
- 30 Kooperationen mit zusammen 47.778,99 € offenem Restbetrag waren durch das Flag von weiterer Abrechnung ausgeschlossen und werden durch die Umstellung wieder abrechenbar. Gerechnet auf Netto-Basis inklusive `nettobetrag_steuerfrei`; ohne die steuerfreien Anteile wären es 32 Fälle und 48.778,99 €.
- `mehrere_rechnungen_erlaubt` verliert seine Funktion. Solange Spalte und Checkbox noch existieren, ist der Code in `FieldOptionsLoader.loadKooperationenOhneRechnung` und `RechnungVertragZuordnung` die verbindliche Quelle, nicht das Flag.
