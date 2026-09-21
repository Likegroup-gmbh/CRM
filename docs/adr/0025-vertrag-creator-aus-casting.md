# Vertrag-Creator-Picker kommt aus Casting (Zusage/Gebucht), nicht aus Kooperation

Nach ADR 0018 entsteht die Kooperation erst in der Produktion, nicht bei der Buchung. Der Vertrag-Picker über Kooperationen blieb deshalb leer. Quelle ist jetzt der Casting-Eintrag der Kampagne mit Status Zusage oder Gebucht und `creator_id`; bestehende Kooperationen bleiben als Union für Altdaten. Kein Prio-Gate — das gilt für Videoidee, nicht für den Vertrag.

## Considered Options

- **Nur Kooperationen**: bricht, sobald die Buchung keine Kooperation mehr anlegt.
- **Nur Casting, ohne Union**: wirft Produktion-first-Altdaten aus dem Picker.
- **Prio plus Zusage wie Videoidee**: zu eng; der Vertrag gilt für jeden zugesagten oder gebuchten Creator.
