# Unplausible Zahlen werden ausgewiesen, nicht geglaettet

Die Finanzuebersicht rechnet gegen das Datenmodell, wie es gedacht ist, nicht gegen den Zustand, in dem die Daten heute sind. Wo Werte fehlen oder unplausibel sind, zeigt die Uebersicht, was eingetragen wurde, und markiert den Datensatz — sie ersetzt nichts, klemmt nichts ab und repariert nichts per Heuristik. Der Grund ist zeitlich: die Teams pflegen die Daten laufend nach, und ein Dashboard, das die heutigen Fehler ausgleicht, muesste nach der Bereinigung wieder umgebaut werden. Schlimmer noch, es verdeckt bis dahin genau die Faelle, die jemand korrigieren muesste.

Heute passiert das Gegenteil an rund zehn Stellen der Finanzberechnung: `Math.max(0, auftragsvolumen - verbrauchtesBudget)` und Varianten davon setzen jede Ueberschreitung auf null. Ein Auftrag, der sein Budget um 20.000 € reisst, ist optisch nicht von einem punktgenau ausgeschoepften zu unterscheiden. Ebenso zaehlt `calculateEkVkTotals` Zeilen mit nur einem gepflegten Preis in `ekSum` und `vkSum`, laesst sie in `marginSum` aber weg, sodass die Marge nicht mehr der Differenz beider Summen entspricht. Aktuell heben sich die beiden Luecken mit 35.386 € und 35.045 € fast auf und die Abweichung betraegt nur 341 € — die Uebereinstimmung ist Zufall, nicht Konstruktion.

## Considered Options

- **Weiter klemmen**: hält die Oberflaeche ruhig, macht die Zahlen aber unbrauchbar fuer genau den Zweck, fuer den sie gebaut werden.
- **Klemmen mit Warnhinweis**: der Hinweis erklaert eine Zahl, die trotzdem falsch bleibt, und niemand kann die Abweichung beziffern.
- **Vorzeichen zeigen, Unplausibles markieren** (gewaehlt): die Zahl bleibt wahr, und die Markierung erzeugt genau den Druck, der zur Korrektur fuehrt.

## Consequences

- Negative Restbudgets, Ueberzahlungen und Ueberfakturierungen werden sichtbar. Das ist gewollt: eine Uebersicht, in der nie etwas negativ wird, hat kein Fehlersignal.
- Die Datenqualitaetsanzeige gehoert nicht in die Stakeholder Uebersicht, sondern in den Adminbereich. Eine Liste offener Datenfehler in einer Ansicht, die Investoren zu sehen bekommen, steht an der falschen Stelle; umgekehrt braucht die Uebersicht eine knappe Zuordnungsquote, die dorthin verweist.
- Sortiert wird nach betroffenem Geldvolumen, nicht nach Anzahl der Maengel. Eine Kampagne mit einem fehlenden Preis ueber 40.000 € gehoert vor zwanzig fehlende Kleinbetraege. Die Anzeige gruppiert dabei nach Kampagne, weil genau so hingeschaut wird.
- Ein gleicher Ein- und Verkaufspreis ist kein Fehlersignal. Bei Influencer-Auftraegen verdient die Agentur ueber die Fee und reicht den Creatorpreis durch: 46 % der Influencer-Videos und alle Influencer-Storys haben EK gleich VK, bei UGC Organic kommt es in 719 bepreisten Videos kein einziges Mal vor. Belegt ist es ueber die Creatorrechnungen, die zeigen, was tatsaechlich geflossen ist: Kooperationen mit durchgaengig EK gleich VK haben 97,1 % ihres erfassten Einkaufspreises fakturiert, Kooperationen mit Spanne 99,5 % — waere der EK ein versehentlich kopierter VK, laege die erste Quote weit darunter. Eine Pruefung ohne diese Unterscheidung wuerde 2,8 Mio. € als verdaechtig melden und damit sich selbst entwerten.
- Marcs Monatsauswertung ist von den EK/VK-Maengeln nicht betroffen, weil sie auf Kunden- und Creatorrechnungen beruht, nicht auf der Kalkulation. Die Datenqualitaet schlaegt dort nur auf die Zeile „noch nicht fakturiert" durch.
