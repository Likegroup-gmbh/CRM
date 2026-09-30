// skript-vertrag.js
// Ton, Aufbau und Leiter. Organic und Influencer sind eine Empfehlung.
// Paid bleibt Performance. Der Block steht am Ende des Auftrags.

const EMPFEHLUNG_BEREICHE = ['owned_social', 'influencer_marketing'];

function istEmpfehlungBereich(bereich) {
  return EMPFEHLUNG_BEREICHE.includes(bereich);
}

function leiterBlock() {
  return '\n# LEITER\n'
    + 'Von oben nach unten. Das Obere schlaegt das Untere.\n'
    + '1. Don\'ts und belegte Fakten (Claims, Preis, Mechanik, Besetzung). Verletzt die Anweisung das: nicht umsetzen.\n'
    + '2. Eine ausdrueckliche Anweisung im Editor schlaegt DNA und Master beim Ton und bei der Geschichte.\n'
    + '3. DNA gilt fuer No-Gos und Markenworte, nicht als Werbeton und nicht vor einer Anweisung.\n'
    + '4. Dos sind Soll, kein Lock.\n';
}

function vertragBlock(bereich) {
  let text = leiterBlock();
  if (istEmpfehlungBereich(bereich)) {
    text += '\n# STANDARDTON UND AUFBAU\n'
      + 'Das Skript ist eine Empfehlung von Person zu Person, als wuerde der Creator es Freunden oder der Community empfehlen. '
      + 'Keine Werbesaetze, keine aufgesetzten Sprueche, kein klassischer Verkaufstext. '
      + 'Ausnahme: ein Don\'t oder das Briefing verlangt ausdruecklich einen anderen Ton.\n'
      + 'Gesprochene Reihenfolge: Alltag, Problem, erst dann Produkt, dann CTA.\n'
      + '- Alltag: konkreter Moment, bevor das Produkt vorkommt. Hat die Persona eine Audience Situation, ist das dieser Moment.\n'
      + '- Problem: die Lage in diesem Moment, ohne die Loesung vorwegzunehmen.\n'
      + '- Produkt: ein Satz, was es ist, wie es funktioniert und warum es hilft. '
      + 'Tarife und Konditionsvergleiche nur, wenn das Briefing sie zum Thema macht.\n'
      + '- CTA: eine Empfehlung, kein Verkaufsbefehl.\n';
  } else if (bereich === 'paid_creator_ads') {
    text += '\n# PAID\n'
      + 'Paid bleibt ein Performance-Creative. Kein Empfehlungston als Default. '
      + 'Kein Aufbau Alltag-Problem-Produkt-CTA. Der Funnel-Aufbau aus dem Paid-Master gilt.\n';
  }
  return text;
}

const DNA_KOPF = '\n# SKRIPT-DNA (No-Gos und Markenworte, geschichtet - spaetere Layer haben Vorrang)\n'
  + 'Die DNA ist kein Werbeton. Eine ausdrueckliche Anweisung schlaegt sie beim Ton.\n';

module.exports = {
  EMPFEHLUNG_BEREICHE,
  istEmpfehlungBereich,
  leiterBlock,
  vertragBlock,
  DNA_KOPF
};
