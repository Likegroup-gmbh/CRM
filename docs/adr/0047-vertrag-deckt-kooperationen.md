# 0047 Ein Vertrag deckt mehrere Kooperationen

Ein Vertrag zeigte über `vertraege.kooperation_id` auf genau eine Kooperation. Kam derselbe Creator in einer zweiten Linie oder Produktion dazu (etwa drei weitere der sechs vertraglichen Videos), war ein neuer Vertrag nötig. Jetzt deckt ein Vertrag über die Junction `vertrag_kooperation` mehrere Kooperationen desselben Creators in derselben Kampagne. Das PDF bleibt unverändert, es gibt keinen Nachtrag, und die Rechnungen der zweiten Kooperation laufen auf diesen Vertrag.

## Entscheidung

- Scope: gleiche Kampagne, gleicher Creator. Andere Linie, Produktion, Briefing und Produkt sind erlaubt, eine andere Kampagne nicht.
- Harter Deckel auf `anzahl_videos`: Summe `kooperationen.videoanzahl` der gedeckten Kooperationen darf sie nicht übersteigen. Der Deckel gilt nur bei `anzahl_videos > 0` (Influencer-Verträge zählen Reels und Posts, nicht Videos) und beim Ändern der Videoanzahl nur für Verträge mit mehr als einer gedeckten Kooperation, damit Bestand mit Überschreitung nicht blockiert wird.
- Kein Geld-Deckel. EK und Rechnungen bleiben an der Kooperation; die UI zeigt nur eine Überschreitung der Vergütung an.
- Kein Vertragstyp-Gate an der Kooperation. Der Typ steht am PDF, Contracting bleibt außen.
- Eine Kooperation hat höchstens einen nicht abgelehnten Vertrag (Unique auf `kooperation_id`; abgelehnte Verträge lösen ihre Zeilen).
- Lösen nur ohne Rechnung und ohne hochgeladenes Kooperationsvideo. Der Creator-Tausch lehnt einen unsignierten Vertrag nur ab, wenn er danach keine Kooperation mehr deckt; ein unterschriebener Vertrag sperrt den Tausch auf jeder gedeckten Kooperation.
- Rechnungen nutzen nur noch die explizite Bindung. Der Fallback auf irgendeinen unterschriebenen Vertrag von Creator plus Kampagne und der Kampagnen-Backfill entfallen. Bestehende `rechnung.vertrag_id` bleiben.
- `vertraege.kooperation_id` bleibt als Erzeuger-Kooperation und ist immer Mitglied der Junction.

## Considered Options

- **Nachtrag-Dokument für die neue Linie**: rechtlich sauberer, aber ein zweites Dokument pro Welle und genau der Aufwand, den die Verknüpfung vermeiden soll.
- **Rechnungs-Fallback über Creator plus Kampagne behalten**: bequem, unterläuft aber den Deckel, weil die Rechnung auf dem Vertrag läuft, ohne dass die Kooperation gedeckt wäre.
- **Weicher Deckel wie beim Rechnungs-Restbetrag (ADR 0004)**: dort sprechen Bestandsdaten dagegen. Hier gibt es keinen Bestand mit Mehrfachdeckung, und die Videozahl ist die vertragliche Leistung.

## Consequences

- Das PDF nennt die zweite Linie und das zweite Produkt nicht. Die Verknüpfung ist operativ.
- Bestand mit mehreren nicht abgelehnten Verträgen auf einer Kooperation wird nicht migriert; die Kooperation bleibt über die Altspalte erreichbar, bis jemand entscheidet.
