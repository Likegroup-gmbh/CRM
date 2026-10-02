# 0039 Creator-Tausch über einen Ersatz-Eintrag im Casting

Springt ein Creator nach Zusage ab, hängen Videoideen, Skripte, Kooperation und Verträge an ihm. Der Tausch hängt diese Verknüpfungen auf einen anderen Casting-Eintrag desselben Castings um und setzt den alten Eintrag auf Abgesagt. Die Umbuchung läuft als eine Transaktion in der Datenbank (`creator_tausch`), damit nie ein halber Tausch entsteht.

## Entscheidung

- Der Ersatz ist ein bestehender Casting-Eintrag mit `creator_id` und erfüllten Gates aus ADR 0018. Er kommt nie direkt aus der Creator-Datenbank. So bleiben Persona, Kundenfeedback und Prozessstatus am Ersatz wahr.
- Der alte Eintrag bleibt als Abgesagt bestehen. Track zählt den Abspringer weiter, und das Buchungsbild bleibt korrekt.
- Gesperrt ist der Tausch bei unterschriebenem Vertrag, existierender Rechnung zur Kooperation und hochgeladenem Kooperationsvideo. Nicht unterschriebene Verträge werden auf Abgelehnt gesetzt und von der Kooperation gelöst. Das System setzt den Status, nicht der Mensch.
- Die Kooperation bleibt, nur ihr Creator wechselt. Hat der Ersatz in der Produktion schon eine Kooperation, wandern die Videos dorthin (pro Creator eine Kooperation).
- Der Skript-Text und die Kundenfreigabe bleiben unverändert. Das Skript bekommt einen quittierbaren Hinweis und eine Festlegung zur neuen Besetzung.
- Der Creator an der Kooperation ist danach nicht mehr frei editierbar, sondern nur über den Tausch änderbar.
- Zwei Einstiege, ein Dialog: Aktionsmenü der Casting-Zeile und Kopf des Skript-Editors.

## Verworfen

- **`creator_id` am Eintrag überschreiben.** Einfacher, aber der Abspringer fiele aus Track und Buchungsbild, und Prio und Zusage des Ersatzes würden vom Vorgänger geerbt.
- **Kooperation umhängen, auch bei Rechnung oder Vertrag.** Geld und Unterschrift sind an die Person gebunden. Ein Umhängen würde Rechnungs-Trigger, Creator-Soll und Buchhaltung verfälschen.

## Folgen

- Das Umhängen lässt sich nicht automatisch zurückdrehen. Ein Rückweg wäre ein zweiter Tausch in die Gegenrichtung.
- Ein Einkaufspreis an der Kooperation bleibt unverändert und muss bei abweichender Vereinbarung mit dem Ersatz von Hand angepasst werden.
- Altbestand-Kooperationen ohne Casting-Eintrag sind nicht tauschbar.
