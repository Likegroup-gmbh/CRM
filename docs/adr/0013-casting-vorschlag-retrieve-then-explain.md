# Casting-Vorschläge sind Retrieve-then-explain, keine Casting-Einträge

Die KI pickt nicht den Creator-Pool: Bedarf, Gates, Scores und Slots laufen deterministisch, das Modell schreibt nur `fit_grund` und Risiken auf einer validierten Shortlist (unbekannte `creator_id` fliegt wie bei `validateVorschlaege`). Vorschläge sind eigene Zeilen über der Liste und werden erst durch Aktivieren zu Casting-Einträgen — sonst würden Gast-Zugang, Status und Videoideen-Zuordnung (ADR 0010) auf halbfertige Zeilen greifen.
