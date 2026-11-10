// skript-edit-prompt/regeln.js
// Feste Prompt-Bausteine des Skript-Edits: verbindliche Regeln, Aktions-Labels
// und -Anweisungen, Grid-Sektionen und der Festgezogen-Filter.

const VERBINDLICHE_REGELN = `
# VERBINDLICHE REGELN
Harte Grenzen: die Verbote (kein, nicht, nie, ohne) unter # WICHTIGE VORGABEN und jede Zeile mit HART: in # CREATOR-VORGABEN. Pflichtinhalte und Do's sind keine Verbote. Die harten Grenzen schlagen jede Anweisung.
Widerspricht die Anweisung einer harten Grenze: nicht umsetzen. vorschlag_text = null. In antwort sagen, welche Vorgabe blockiert, und dass sie im Briefing geaendert werden muesste.
Bindend, solange die Anweisung sie nicht ausdruecklich aendert:
- Die Zeilen in # CREATOR-VORGABEN, auch beteiligte Personen.
- Pflichtinhalte und Do's unter # WICHTIGE VORGABEN, soweit der Fakt belegt ist.
- Figuren, Setting, Requisiten und Produktvariante aus den anderen Sektionen des aktuellen Skripts.
Aendert die Anweisung einen dieser Punkte ausdruecklich, setze das um und sage in antwort, welche Vorgabe oder anderen Sektionen dadurch nicht mehr passen. Eine Figur streichen heisst nicht, eine andere Figur einzufuehren.
Nichts erfinden, was nicht im Briefing, in den Wichtigen Vorgaben oder im bestehenden Skript steht.
`;

// ADR 0056: Die Anweisung ist ein Delta auf den Kontext, kein Ersatz dafuer.
const AUFTRAG_IM_KONTEXT = `
# AUFTRAG IM KONTEXT
Die Anweisung sagt, was sich aendert. Alles, was sie nicht nennt, gilt weiter und muss die neue Fassung bedienen:
- die Rolle der Zelle im Skript, wie Master und ZUSAETZLICHE INFOS (Produktionskopf) sie festlegen: was diese Sektion leisten muss, Hook-Typ, Nennung von Kategorie oder Marke je Funnel-Stufe, Zeitbudget,
- die Kernidee der Videoidee,
- Persona, Produkt und die Vorgaben des Briefings,
- der Anschluss an die Zellen davor und danach.
Gehen Anweisung und Kontext nicht zusammen, setze die Anweisung um und sage in antwort, was dabei verloren geht. Nie still streichen.
Neu formulieren heisst neuer Wortlaut, nicht neuer Inhalt: Funktion, Kernbegriffe (Produkt, Kategorie, Claims) und Aussage bleiben.
`;

const ANSCHLUSS_REGEL = `
# ANSCHLUSS
Die geaenderte Zelle steht zwischen Zellen, die sich nicht aendern. Sie knuepft an die vorige an und fuehrt in die naechste hinein, so wie sie im AKTUELLEN SKRIPT stehen. Nicht anfassen heisst nicht ignorieren.
Saetze, Aufzaehlungen und Pointen aus Nachbarzellen nicht in die geaenderte Zelle holen, dort stehen sie schon. Jede Hook-Variante fuehrt in denselben Hauptteil.
Was zu sehen ist bleibt am Ort der Nachbarzellen. Braucht die neue Fassung einen anderen Ort, ist das ein Ortswechsel fuer das ganze Skript (ADR 0051): im freien Chat Umfang alles mit allen betroffenen Zellen, sonst nicht umsetzen und in antwort fragen.
`;

// Analog „## Abweichungen“ der Generierung: was aufgegeben wurde, steht in antwort, nicht nur was eingehalten wurde
const ANTWORT_REGEL = '- antwort (1-3 Saetze, Deutsch): zuerst die Basis in einem Halbsatz („auf Basis des Dokuments“ oder „auf Basis deines letzten Vorschlags“), dann was sich aendert. '
  + 'Bedient die neue Fassung etwas aus dem Kontext nicht mehr (Kategorie oder Produkt nicht genannt, anderer Hook-Typ, anderer Ort, Zeitbudget der Zelle ueberschritten, Briefing-Vorgabe oder Kernidee nicht erfuellt), '
  + 'nenne jede Abweichung mit „Abweichung: …“. Ohne Abweichung nichts dazu schreiben. Bei reinen Fragen entfaellt die Basis.\n';

const GRID_SEKTIONEN = ['hook', 'hauptteil', 'cta', 'hook_variante_1', 'hook_variante_2', 'hook_variante_3'];

/** Zellen-Feldname einer Aenderung: titel, <sektion> oder <sektion>_visuell. */
function aenderungFeld(a) {
  if (a.sektion === 'titel') return 'titel';
  return a.spalte === 'visuell' ? `${a.sektion}_visuell` : a.sektion;
}

/**
 * Festgezogene Zellen im Bundle des freien Chats. Der Umfang kommt vom Modell
 * (Tool-Feld umfang), der Server setzt ihn durch:
 * alles = nichts verwerfen, teil = nur festgezogene Zellen der genannten
 * Sektion bleiben, markierung/keiner/fehlend = alle festgezogenen Zellen raus.
 */
function filtereFestgezogen(aenderungen, gezogen, { umfang = null, umfang_sektion = null } = {}) {
  const liste = Array.isArray(aenderungen) ? aenderungen : [];
  const gesperrt = new Set(Array.isArray(gezogen) ? gezogen : []);
  if (!gesperrt.size || umfang === 'alles') return { behalten: liste.slice(), verworfen: [] };
  const teil = umfang === 'teil' ? String(umfang_sektion || '').trim().toLowerCase() : null;
  const behalten = [];
  const verworfen = [];
  for (const a of liste) {
    const festgezogen = gesperrt.has(aenderungFeld(a));
    const offen = !festgezogen || (teil && a.sektion === teil);
    (offen ? behalten : verworfen).push(a);
  }
  return { behalten, verworfen };
}

const AKTION_LABELS = {
  neu_schreiben: 'Neu formulieren',
  neue_geschichte: 'Neue Geschichte',
  kuerzen: 'Kürzen',
  laenger: 'Länger machen',
  anderer_ton: 'Anderer Ton',
  feedback: 'Feedback umsetzen',
  chat: 'Freies Feedback',
  visuell: 'Visual'
};

const AKTION_ANWEISUNGEN = {
  neu_schreiben: 'Schreibe die Stelle neu. Gleiche Funktion im Video, anderer Einstieg, andere Saetze. Figuren, Setting, Produktaussagen und die Aussage bleiben: die Formulierung aendert sich, nicht der Inhalt.',
  neue_geschichte: 'Schreibe eine andere Geschichte: andere Situation, anderer Einstieg. Ein anderer Drehort allein reicht nicht. Claims, Don\'ts und die Besetzung bleiben. Hook-Varianten nicht anfassen.',
  kuerzen: 'Kürze die markierte Stelle deutlich. Kernaussage und Ton beibehalten, Füllwörter und Redundanz raus.',
  laenger: 'Baue die markierte Stelle aus: mehr Detail, mehr Emotion oder ein konkretes Beispiel – ohne zu labern.',
  anderer_ton: 'Schreibe die markierte Stelle in einem anderen Ton um. Beachte die Ton-Vorgabe des Users, falls vorhanden.',
  feedback: 'Der User hat die markierte Stelle bewertet und strukturiertes Feedback gegeben (Score, Begründung, ggf. eine Vorgabe "So sollte es sein"). Überarbeite die markierte Stelle so, dass das Feedback vollständig umgesetzt wird. Eine Vorgabe "So sollte es sein" ist verbindlich: übernimm ihre Richtung, aber formuliere sie sauber im Ton des restlichen Skripts aus.',
  chat: 'Setze das Feedback um. „Neu formulieren“, „andere Formulierung“ oder „nicht so“ ohne weitere Angabe heisst dasselbe wie die Aktion Neu formulieren: '
    + 'gleiche Funktion im Video, Figuren, Setting, Produktaussagen und Aussage bleiben, der Wortlaut ist neu. '
    + 'Andere Situation oder andere Geschichte nur, wenn die Anweisung das ausdruecklich verlangt. Fehlt ein Fakt, der weder im Skript noch in der Anweisung steht: einmal nachfragen. Nennt die Anweisung den Umfang (alles oder eine Sektion), nicht fragen. '
    + 'Nennt die Anweisung mehrere Kritikpunkte, setze alle um, nicht nur den ersten, und beginne antwort mit „So verstehe ich dein Feedback:“ und einer kurzen Aufzaehlung. '
    + 'Betrifft sie Figur, Besetzung, Ort, Setting oder die Geschichte, lies das ganze Skript als eine Geschichte und pruefe vor der Abgabe jede Zelle (Hook, Hauptteil, CTA, je gesprochen und visuell, Hook-Varianten, Titel) auf Reste des alten Stands.',
  visuell: 'Der gesamte gesprochene Text der Sektion steht unter "Markierte Stelle". Schreibe dazu einen schlichten Satz pro Beat fuer "Was zu sehen ist". Gleiche Absatz-Anzahl wie der gesprochene Text. Keine Zeitmarker, keine Shotlist, kein Storyboard. KEINEN zweiten Sprechertext, keine gesprochenen Worte. Der gesprochene Text bleibt unveraendert. Leitplanken und Briefing-Fakten gelten auch fuer On-Screen-Texte. Orte und Props aus den anderen Sektionen behalten.'
};

module.exports = {
  VERBINDLICHE_REGELN,
  AUFTRAG_IM_KONTEXT,
  ANSCHLUSS_REGEL,
  ANTWORT_REGEL,
  GRID_SEKTIONEN,
  aenderungFeld,
  filtereFestgezogen,
  AKTION_LABELS,
  AKTION_ANWEISUNGEN
};
