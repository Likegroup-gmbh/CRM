# 0040 Das Dashboard rechnet serverseitig, mit denselben Modulen

Das Investor-Dashboard lud bis jetzt den kompletten Finanzbestand (1,96 MB Rohzeilen: 196 Aufträge, 1.296 Kooperationen, 2.807 Videos, 896 Rechnungen) in den Browser und rechnete dort jede Summe selbst. Die Datenbank braucht für diese RPC 105 ms, der Download im Browser dauerte rund 3 s. Jetzt rechnet die Netlify-Function `stakeholder-dashboard` und liefert je Auftrag eine fertig gerechnete Zeile plus die Monatsauswertung.

## Entscheidung

- Es gibt weiter genau eine Implementation der Regeln: `berechneDashboard` in `src/modules/stakeholder/daten/stakeholderDashboard.js`. Sie ruft dieselben reinen Module wie vorher (`calculateBudgetOverview`, `calculateMonatsauswertung`, `invoiceCardTotals`). ADR 0006 (zwei Periodisierungen) und ADR 0007 (nicht klemmen) gelten unverändert, weil derselbe Code läuft.
- Die Function ruft die bestehende RPC `stakeholder_finanzbestand` mit dem JWT des Aufrufers. Die Rollenprüfung (Admin oder Investor) bleibt in der Datenbank. Die Function kennt keinen Service-Key-Pfad und keine eigene Rechtelogik.
- Jahr und Leistungsbereich bleiben Filter im Browser. Darum liefert die Function keine Gesamtsummen, sondern eine Zeile je Auftrag mit allem, was der Browser nur noch filtern, gruppieren und addieren muss. Alle Summen in der Zeile sind additiv. Ein Klick auf einen Filter braucht keinen Server-Call.
- Ist die Function nicht erreichbar (lokal ohne Netlify, 404/501/502/503/504, Netzfehler, anderes Schema), lädt der Browser den Finanzbestand und ruft dasselbe `berechneDashboard`. Kein Zugriff (403) und ungültige Sitzung (401) fallen nicht zurück, sondern werden gemeldet.
- Frische-Vertrag bleibt: nichts wird gecacht, die Antwort trägt `Cache-Control: no-store`. Nur laufender Load und Boot-Prefetch teilen sich Wartezeit (`core/budget/vorlauf.js`, gemeinsam mit dem Finanzbestand).
- Die Datenqualitätsseite braucht die Rohzeilen und lädt weiter den Finanzbestand. Detailseiten rechnen weiter im Browser.

## Verworfen

- **Rechnen in SQL (plpgsql).** Schnellste Laufzeit, aber rund 1.400 Zeilen Regel-Logik (Fee, KSK, Rechnungsstatus, Monatsauswertung, Kampagnenart-Mapping) müssten ein zweites Mal geschrieben werden. Die beiden Rechenkerne würden auseinanderlaufen, genau dort, wo ADR 0006 und ADR 0007 Zahlen festlegen. Bleibt die Option, falls Messung zeigt, dass der Hop über Netlify zu langsam ist; `berechneDashboard` ist dann die Referenz für einen Paritätstest.
- **Fertige Gesamtsummen je Filter vom Server.** Jeder Filterklick wäre ein Netzaufruf.

## Folgen

- Gemessen an synthetischen Daten in Produktionsgröße: Rechnen rund 5 bis 9 ms, Antwort rund 150 KB roh, rund 9 KB gzip (Nullfelder der Zahlungssummen fehlen in der Zeile). Nicht gemessen sind Netlify-Region, Cold Start und das echte Verhalten der RPC-Antwort; dafür liefert die Function einen `Server-Timing`-Header (`rpc`, `rechnen`).
- Liegt die Netlify-Function in einer anderen Region als das Supabase-Projekt (eu-north-1), kostet der 2-MB-Download zwischen beiden Zeit. Die Region der Functions steht in den Netlify-Site-Einstellungen, nicht in `netlify.toml`.
- Zeitabhängige Teile („überfällig") rechnet der Server mit seiner Uhr (UTC). Rund um Mitternacht kann das gegenüber der Berliner Uhr um bis zu zwei Stunden abweichen. Die zeitanteilige Fee im Influencer-Tab rechnet weiter der Browser.
- Ändert sich die Form des Ergebnisses, steigt `DASHBOARD_VERSION`. Ein Browser mit alter Version fällt bei fremdem Schema auf die Browser-Rechnung zurück, statt falsche Zahlen zu zeigen.
