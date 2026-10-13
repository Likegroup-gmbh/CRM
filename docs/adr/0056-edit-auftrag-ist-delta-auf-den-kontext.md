# Edit-Auftrag ist ein Delta auf den Kontext

Bei „überarbeite die Hook, sprich den Pain an“ hat Liky den Pain angesprochen und dafür die Leber gestrichen, die das Briefing für den Hook verlangt, und einen Satz aus dem Hauptteil in den Hook geholt. Bei „Erster Satz ist gut, die Frage am Ende sollte lauten …“ hat Liky den Hook im Dokument umgebaut statt den offenen Vorschlag, auf den sich der Satz bezog. Beides ist derselbe Fehler: die Anweisung wurde als vollständige Aufgabe gelesen. Ab jetzt ist sie ein Delta. Sie sagt, was sich ändert; alles, was sie nicht nennt, gilt weiter und muss die neue Fassung bedienen: Rolle der Zelle laut Master und Produktionskopf, Kernidee der Videoidee, Persona, Produkt, Briefing-Vorgaben und der Anschluss an die Nachbarzellen. Geht beides nicht zusammen, setzt Liky die Anweisung um und nennt in der Antwort jede Abweichung. Die Basis ist der offene Vorschlag der Zelle, wenn es einen gibt, sonst das Dokument.

## Considered Options

- **Anweisung als vollständige Aufgabe, Kontext nur als Hintergrund.** So war es. Jede Anweisung, die einen Aspekt hervorhebt, verdrängt die übrigen; die Leber geht bei „Pain“ verloren. Abgelehnt.
- **Hook-spezifische Regeln („Hook nennt immer die Kategorie“).** Löst den einen Fall, nicht Hauptteil, CTA oder Visuals, und widerspricht Briefings ohne diese Vorgabe. Abgelehnt, die Regel ist generisch.
- **Checks, die Vorschläge verwerfen oder nachbessern** (Hook zu lang, Satz doppelt, Persona fehlt). Ein Check irrt sich, und dann verliert der Mitarbeiter einen Vorschlag, den er wollte. Abgelehnt: Checks markieren nur (ADR 0035), die Entscheidung bleibt beim Menschen.
- **Basis immer das Dokument, offene Vorschläge nur im Verlauf.** Das Modell muss dann aus dem Verlauf erraten, worauf sich „erster Satz ist gut“ bezieht, und rät falsch. Abgelehnt: der Server bestimmt den offenen Vorschlag und stellt ihn ausdrücklich in den Auftrag.
- **Persona bei fehlender Angabe automatisch wählen.** Spart eine Rückfrage, legt aber die Zielgruppe ohne Mensch fest. Abgelehnt: Drawer warnt, Rückfrage fragt, Liky wählt nie selbst.

## Consequences

- Pro Zelle ist höchstens ein Vorschlag offen: der neueste. Ein neuerer Vorschlag oder ein späteres Annehmen auf derselben Zelle macht ältere veraltet; ein abgelehnter neuerer Vorschlag ersetzt nichts. Verschiedene markierte Stellen derselben Zelle bleiben nebeneinander offen. Wer ein Mehr-Zellen-Paket nachschärfen will, nimmt es erst an.
- Eine Ablehnung wird zur Festlegung „Abgelehnt für <Zelle>: …“ mit dem abgelehnten Stück. Die Anweisung dieses Turns wird nie Festlegung; sie galt nur dem Turn.
- Nach jedem Edit stehen Wortbudget, Hook-Zeit laut Briefing, verbotene Claims und Doppelungen zwischen Hook, Hauptteil und CTA in der Prüfung. Neue oder verschlimmerte Befunde nennt die Chat-Antwort. Nichts wird umgeschrieben.
- Zeitmarker der Visuals werden beim Annehmen und beim Speichern von Hand für alle Zellen neu gestempelt, nicht nur für die geänderte.
- Ein Ortswechsel bleibt skriptweit (ADR 0051): im freien Chat Umfang Alles, sonst fragt Liky.
