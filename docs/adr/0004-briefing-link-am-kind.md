# Briefing-Link sitzt an Casting und Konzept, nicht an der Kampagne

Step 1 der Briefing-Pflicht: Casting (`creator_auswahl`) und Konzept (`strategie`) bekommen je ein `briefing_id` auf `campaign_briefings`. Beim Anlegen ist ein finalisiertes Briefing Pflicht, der Picker folgt Unternehmen/Marke. Altbestand bleibt ohne Link gültig, ein gesetzter Link ist eingefroren.

Der Link hängt bewusst am Kind und nicht als `kampagne.briefing_id` an der Kampagne. Das Briefing ist ein Unternehmensdokument ohne `kampagne_id`; eine Kampagne kann mehrere Castings und Konzepte haben, und die Auswahl soll dem Mitarbeiter im Auto-Suggest folgen wie Unternehmen/Marke/Kampagne. Eine Pflicht-FK an der Kampagne würde das Briefing zur Kampagnen-Eigenschaft machen und die 1:n-Realität (mehrere Castings/Konzepte, teils unterschiedliche Briefings) verstecken.

## Considered Options

- **`kampagne.briefing_id` Pflicht, Kinder erben**: ein Picker weniger, aber Briefing wird Kampagnen-Attribut. Passt nicht zum Modell (Briefing ohne `kampagne_id`) und verhindert unterschiedliche Briefings pro Casting/Konzept derselben Kampagne.
- **Briefing bekommt `kampagne_id`**: stärkste Bindung, aber das Briefing ist heute bewusst kampagne-unabhängig (v1-Design in `20260818_campaign_briefings.sql`). Umzug wäre ein größerer Schnitt, nicht Step 1.

## Consequences

- Casting/Konzept tragen `briefing_id` nullable (Grandfather), `ON DELETE RESTRICT`.
- Kooperation und Skript behalten ihren optionalen `briefing_id`; die Pflicht gilt vorerst nur für Casting/Konzept.
- Picker laden nur finalisierte Briefings (auch Kooperation); siehe ADR 0022.
