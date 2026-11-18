# 0075 Ein Skript für mehrere Creator, oder eine Kopie je Creator

Bisher war ein Skript Text für genau ein Video und genau einen Creator. Im Alltag drehen aber oft mehrere Creator wörtlich denselben Text, und manchmal braucht derselbe Ansatz je Creator eine eigene Fassung. Beides wird möglich: ein **geteiltes Skript** über mehrere Kooperationsvideos und **Skript kopieren** für einen weiteren Creator. Ergänzt ADR 0010 und ADR 0039.

## Entscheidung

- **Geteiltes Skript hängt nur an Kooperationsvideos.** Jedes Video zeigt auf höchstens ein Skript, ein Skript darf an Videos verschiedener Creator hängen. Die Videoidee bleibt eine Umsetzung mit höchstens einem Casting-Eintrag (ADR 0010).
- **Hauptbesetzung ist der Creator der Videoidee.** Für ihn schreibt Liky, die übrigen Creator übernehmen den Text. Eine Festlegung zur Besetzung schlägt das wie bisher.
- **Kundenfreigabe gilt gemeinsam.** Eine Freigabe setzt die Skript-Freigabe an allen verknüpften Videos, ein Statuswechsel nimmt sie an allen zurück.
- **Creator-Tausch an einem geteilten Skript** wechselt nur Kooperation und Video. Das Skript behält Text und Kundenfreigabe und bekommt einen Hinweis, aber keine Festlegung zur Besetzung, auch wenn die Hauptbesetzung wechselt. Hängt das Skript nur an Videos des Abspringers, bleibt es beim Verhalten aus ADR 0039.
- **Skript kopieren** legt für einen weiteren Creator ein eigenes Skript an derselben Videoidee an. Übernommen werden Skript-Tabelle, Hook-Varianten, Freie Blöcke und Festlegungen ohne die Besetzung. Die Kopie beginnt als Entwurf, ohne Kundenfreigabe, Kommentare, Versionen und Chat, und bekommt eine Festlegung zur Besetzung des neuen Creators. Verknüpft wird sie mit dessen Kooperationsvideo.
- Die Regel aus ADR 0010, dass der Creator der Kooperation der Creator des Casting-Eintrags sein muss, gilt für die Verknüpfung von Video und Videoidee, nicht von Video und Skript.

## Verworfen

- **Mehrere Casting-Einträge an der Videoidee.** Bricht ADR 0010 (eine Umsetzung, nicht eine Kernidee mit mehreren Creatorn) und zieht Casting-Gates, Konzept-Einladung, Skript-Nummern und Creator-Tausch mit. Die Kooperationsvideos tragen die zusätzlichen Creator schon.
- **Liky schreibt personenneutral, sobald mehrere Creator verknüpft sind.** Das Skript würde sich beim zweiten Video im Ton ändern, obwohl am Text nichts verlangt wurde.
- **Freigabe je Video.** Der Kunde gibt einen Text frei, nicht eine Person. Wer eine abweichende Fassung braucht, nimmt Skript kopieren.
- **Tausch spaltet automatisch eine Kopie ab.** Bei gleichem Text gibt es nichts abzuspalten. Wer für den Ersatz eine eigene Fassung will, kopiert von Hand.

## Folgen

- Änderungen an einem geteilten Skript treffen alle verknüpften Creator. Nach einer Kundenfreigabe ist eine Abweichung für einen einzelnen Creator nur über eine Kopie möglich.
- Kopien an derselben Videoidee tragen dieselbe Skript-Nummer.
- Skript-Anschreiben und Skript-Paket führen ein geteiltes Skript bei jedem verknüpften Creator.
- Überall, wo der Creator eines Skripts erscheint (Skripte-Tabellen, Paket, Anschreiben, Creator-Tausch aus dem Editor), gehen die Video-Creator vor der Videoidee. Instagram- und TikTok-Links aus dem Casting-Eintrag gelten nur für dessen Creator.
- Ein neu verknüpftes Video übernimmt den Freigabe-Haken des Skripts.
