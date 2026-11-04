# 0060 Die Jahreszuordnung folgt den Teilrechnungen, geklemmt auf die Laufzeit

Das Investor-Dashboard ordnete jeden Auftrag komplett dem Jahr seines `start` zu. Ein Auftrag mit Laufzeit Oktober 2025 bis September 2026 und zwölf Monatsraten (Rabona, 120.000 €) stand mit dem vollen Volumen, allen Kosten und allen Kundenrechnungen in 2025, obwohl neun Raten in 2026 liegen. Die Raten sind als Teilrechnungen vorbereitet; `rechnung_gestellt_am` ist dort auch bei noch nicht gestellten Raten als geplantes Datum gepflegt.

## Entscheidung

- `berechneDashboard` liefert je Auftrag eine Zeile pro Jahr, mit `jahr` und `anteil`. Der Browser filtert auf `jahr`; die Zeilen eines Auftrags summieren sich zum Auftrag.
- Jahr einer Teilrechnung = Jahr von `min(max(rechnung_gestellt_am, start), ende)`, in Europe/Berlin. Ohne Datum gilt `start + (position - 1)` Monate, ebenfalls geklemmt. `start` ist ersatzweise `created_at`. Ein `ende` vor `start` ist ein Datenfehler und klemmt nicht.
- Anteil je Jahr = Netto der Teilrechnungen dieses Jahres / Netto aller Teilrechnungen. Volumen, Creatoranteil, Fee, EK/VK-Marge, KSK, Zusatzkosten, Influencer-Budget und die Creator- und Contracting-Rechnungssummen folgen dem Anteil. Die Kundenrechnungs-Summen stehen ganz im Jahr ihrer Teilrechnung.
- Auftraege ohne Teilrechnungen (oder nur mit 0-€-Raten) bleiben eine Zeile im Startjahr.
- Die Monatsauswertung bleibt beim Rechnungsdatum (ADR 0006). Beide Sichten beantworten verschiedene Fragen: in welchem Jahr ein Auftrag geleistet wird, und in welchem Monat welche Rechnung durch die Buecher geht.
- `stakeholder_finanzbestand()` liefert dafuer an den Teilrechnungen `position`. `DASHBOARD_VERSION` steigt auf 2.

## Verworfen

- **Reines Rechnungsdatum.** Vorab gestellte Rechnungen zogen 200.000 € aus 2026 ins Jahr 2025 (Meggle 120.000 € fuer Laufzeit 2026, gestellt im November 2025; dazu EHG, Hannoversche und ein zweiter Meggle-Auftrag). Fuer ein Investorenupdate zeigt das Volumen dann das Rechnungstempo statt der Leistung.
- **`start` + Position fuer alle Raten.** Ignoriert gepflegte Daten, wenn Raten nicht monatlich laufen (zwei Raten im selben Monat, Pausen).
- **Lineare Verteilung ueber die Laufzeit.** Braucht keine Teilrechnungen, ist aber bei ungleichen Raten falsch.
- **Neue Spalte `abrechnungsmonat`.** Unnoetig, weil `rechnung_gestellt_am` bei vorbereiteten Raten schon das geplante Datum traegt.

## Folgen

- Zum Zeitpunkt der Entscheidung (245 Auftraege, ohne Contracts) aendert sich 2025 von 181.128,40 € auf 61.835,00 €, 2026 von 12.450.156,18 € auf 12.383.569,58 € und 2027 von 120.000,00 € auf 305.880,00 €. Betroffen sind vier Auftraege; die Summe ueber alle Jahre bleibt gleich.
- 70 Raten mit Betrag haben kein Datum und laufen ueber den Positions-Fallback; keine davon aendert derzeit das Jahr. Die obere Klemme auf `ende` aendert derzeit keine Zahl, verhindert aber, dass spaet datierte oder ueberzaehlige Raten ein Folgejahr fuellen.
- Unter „Alle Jahre" steht ein mehrjaehriger Auftrag mehrfach in den Zeilen. Tab-Zaehler und Auftragszahl je Kunde zaehlen deshalb Auftrags-Ids, nicht Zeilen.
- Gespeicherte Berichtsstaende bleiben eingefroren. Ihre Jahreswerte sind mit neuen Staenden nicht vergleichbar.
- Die zeitanteilige Influencer-Fee rechnet weiter ueber die gesamte Laufzeit (`elapsedRatio(start, ende)`), angewandt auf den Jahresanteil der Fee.
