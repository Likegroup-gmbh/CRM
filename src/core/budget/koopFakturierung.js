// koopFakturierung.js
// Restbetrag je Kooperation: kalkuliertes Soll minus bereits fakturiertes
// Honorar. Das Soll folgt der Kalkulation — Video-EK schlagen den
// Kooperations-EK, wo Videos gepflegt sind (Konvention aus
// collectEkVkPriceRows). KSK-Selbstzahler-Aufschlaenge beruehren den
// Restbetrag nicht: sie sind ein separates Konto (ADR 0015, Entscheid Marc
// 30.09.2026 — "die KSK-Zahlung darf das Gesamtbudget nicht mindern").
// Geteilt zwischen Monatsauswertung (Sonderzeilen) und Rechnungsstatus
// (creatorseitig "noch nicht gestellt"), damit beide dasselbe Soll benutzen.

function betrag(v) {
  return parseFloat(v) || 0;
}

// Video-EK schlaegt den Kooperations-EK nur, wo ein Video-EK gepflegt ist.
// Eine Video-Zeile ohne Einkaufspreis ist kein Soll: dann gilt der
// Kooperations-EK (ADR 0015 — unpruefbar nur, wenn weder Kooperations-EK
// noch Video-EK gepflegt sind).
function videoSollNachKoop(videos) {
  const summe = new Map();
  const gepflegt = new Set();
  videos.forEach(v => {
    if (!v.kooperation_id) return;
    if (v.einkaufspreis_netto == null || v.einkaufspreis_netto === '') return;
    gepflegt.add(v.kooperation_id);
    summe.set(v.kooperation_id, (summe.get(v.kooperation_id) || 0) + betrag(v.einkaufspreis_netto));
  });
  return { summe, gepflegt };
}

function sollFuerKoop(koop, videoSoll) {
  if (videoSoll.gepflegt.has(koop.id)) return videoSoll.summe.get(koop.id) || 0;
  return betrag(koop.einkaufspreis_netto);
}

// Abrechenbarkeit fuer den Kooperations-Selektor der Rechnungserstellung
// (ADR 0004, ADR 0015). Soll und fakturiert sind reines Honorar: Video-EK
// schlaegt Kooperations-EK, fakturiert = nettobetrag + nettobetrag_steuerfrei.
// KSK-Selbstzahler-Aufschlag und Zusatzkosten bleiben aussen vor — KSK ist
// ein separates Konto (sichtbar ueber fakturiertKsk), Zusatzkosten sind
// durchlaufende Posten.
// Rueckgabe: Map(koopId -> { soll, fakturiert, fakturiertKsk, rest,
// anzahlRechnungen, hatSchlussrechnung, abrechenbar }).
export function calculateKoopAbrechenbarkeit({ kooperationen = [], videos = [], rechnungen = [] } = {}) {
  const videoSoll = videoSollNachKoop(videos);

  const fakturiertByKoop = new Map();
  const fakturiertKskByKoop = new Map();
  const anzahlByKoop = new Map();
  const schlussrechnungByKoop = new Set();
  rechnungen.forEach(r => {
    if (!r.kooperation_id) return;
    const honorar = betrag(r.nettobetrag) + betrag(r.nettobetrag_steuerfrei);
    fakturiertByKoop.set(r.kooperation_id, (fakturiertByKoop.get(r.kooperation_id) || 0) + honorar);
    fakturiertKskByKoop.set(r.kooperation_id, (fakturiertKskByKoop.get(r.kooperation_id) || 0) + betrag(r.ksk_betrag));
    anzahlByKoop.set(r.kooperation_id, (anzahlByKoop.get(r.kooperation_id) || 0) + 1);
    if (r.ist_schlussrechnung) schlussrechnungByKoop.add(r.kooperation_id);
  });

  const ergebnis = new Map();
  kooperationen.forEach(k => {
    const soll = sollFuerKoop(k, videoSoll);
    const fakturiert = fakturiertByKoop.get(k.id) || 0;
    const fakturiertKsk = fakturiertKskByKoop.get(k.id) || 0;
    const rest = soll - fakturiert;
    const anzahlRechnungen = anzahlByKoop.get(k.id) || 0;
    const hatSchlussrechnung = schlussrechnungByKoop.has(k.id);

    // Weich (ADR 0004): ohne Rechnung immer abrechenbar; ohne pruefbares
    // Soll (soll <= 0) ebenfalls — die Regel sperrt nur bei pruefbarem Soll.
    const abrechenbar = !hatSchlussrechnung
      && (anzahlRechnungen === 0 || soll <= 0 || rest > 0.005);

    ergebnis.set(k.id, { soll, fakturiert, fakturiertKsk, rest, anzahlRechnungen, hatSchlussrechnung, abrechenbar });
  });

  return ergebnis;
}

// Rechnungsstatus je Kooperation fuer die Auftragsdetails-Uebersicht
// (ADR 0015): „Bezahlt" erst, wenn das Honorar-Soll per bezahlter Rechnung
// erreicht ist oder eine bezahlte Schlussrechnung existiert (Minderabrechnung).
// Bezahlte Betraege unter dem Soll werden als „Teilweise bezahlt" ausgewiesen,
// statt alle Videos der Kooperation pauschal als bezahlt zu markieren.
// Wie ueberall in ADR 0015 zaehlt nur das Honorar (netto + steuerfrei) —
// KSK bleibt ein separates Konto. Ohne pruefbares Soll (soll <= 0) faellt
// eine bezahlte Rechnung weich auf „Bezahlt" zurueck.
// Rueckgabe: { koopId: status } — Kooperationen ohne Rechnung fehlen in der
// Map, die UI zeigt dann „Nicht erstellt".
export function buildKoopRechnungsStatusMap({ kooperationen = [], videos = [], rechnungen = [] } = {}) {
  const abrechenbarkeit = calculateKoopAbrechenbarkeit({ kooperationen, videos, rechnungen });

  const rechnungenByKoop = new Map();
  rechnungen.forEach(r => {
    if (!r.kooperation_id) return;
    const list = rechnungenByKoop.get(r.kooperation_id) || [];
    list.push(r);
    rechnungenByKoop.set(r.kooperation_id, list);
  });

  const map = {};
  rechnungenByKoop.forEach((list, koopId) => {
    const bezahlt = list.filter(r => r.status === 'Bezahlt');
    const bezahltHonorar = bezahlt.reduce((s, r) => s + betrag(r.nettobetrag) + betrag(r.nettobetrag_steuerfrei), 0);
    const hatBezahlteSchlussrechnung = bezahlt.some(r => r.ist_schlussrechnung);
    const soll = abrechenbarkeit.get(koopId)?.soll ?? 0;

    if (hatBezahlteSchlussrechnung || (bezahltHonorar > 0 && (soll <= 0 || bezahltHonorar >= soll - 0.005))) {
      map[koopId] = 'Bezahlt';
    } else if (bezahltHonorar > 0) {
      map[koopId] = 'Teilweise bezahlt';
    } else {
      // Keine bezahlte Rechnung: den Status der neuesten Rechnung zeigen
      // (z. B. „Offen"), statt bei mehreren Rechnungen eine zufaellige.
      const neueste = [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
      map[koopId] = neueste?.status || 'Offen';
    }
  });

  return map;
}

export function calculateKoopFakturierung({
  kooperationen = [],
  videos = [],
  rechnungen = [],
  kampagnen = [],
  // Pflicht: beide Aufrufer (Monatsauswertung, Rechnungsstatus) filtern
  // Entwuerfe vorher heraus und uebergeben das Set der gueltigen IDs.
  gueltigeAuftragIds,
} = {}) {
  const kampagneToAuftrag = new Map(kampagnen.map(k => [k.id, k.auftrag_id]));

  const videoSoll = videoSollNachKoop(videos);

  // Fakturiert ist das Honorar (netto + steuerfrei), ohne KSK/Zusatzkosten.
  const fakturiertByKoop = new Map();
  const anzahlRechnungenByKoop = new Map();
  rechnungen.forEach(r => {
    if (!r.kooperation_id) return;
    const honorar = betrag(r.nettobetrag) + betrag(r.nettobetrag_steuerfrei);
    fakturiertByKoop.set(
      r.kooperation_id,
      (fakturiertByKoop.get(r.kooperation_id) || 0) + honorar
    );
    anzahlRechnungenByKoop.set(
      r.kooperation_id,
      (anzahlRechnungenByKoop.get(r.kooperation_id) || 0) + 1
    );
  });

  const ergebnis = {
    nochNichtFakturiert: { betrag: 0, faelle: 0 },
    ueberfakturiert: { betrag: 0, faelle: 0 },
    // Pro-Kooperation-Aufstellung fuer die Datenqualitaetsanzeige (PRD
    // Schritt 9): dieselbe Soll/Fakturiert-Rechnung wie oben, aber je
    // Kooperation statt summiert. Enthaelt nur ausgewertete Kooperationen
    // (Entwuerfe sind bereits herausgefiltert).
    proKoop: [],
  };

  kooperationen.forEach(k => {
    const auftragId = kampagneToAuftrag.get(k.kampagne_id);
    // Dieselbe Menge wie die Kalkulationskarten: nur Kooperationen mit
    // Auftrag im Filter. Ohne Auftrag (oder Entwurf) gehoeren sie in die
    // Datenqualitaet, nicht in Soll/Rest.
    if (!auftragId || !gueltigeAuftragIds.has(auftragId)) return;

    // Soll ist reines Honorar — der KSK-Selbstzahler-Aufschlag gehoert
    // nicht dazu (ADR 0015, separates Konto). Dadurch loest sich der
    // fruehere Dauer-Rest in KSK-Hoehe bei Selbstzahlern auf.
    const soll = sollFuerKoop(k, videoSoll);
    const fakturiert = fakturiertByKoop.get(k.id) || 0;
    const rest = soll - fakturiert;

    ergebnis.proKoop.push({
      id: k.id,
      kampagne_id: k.kampagne_id,
      soll,
      fakturiert,
      rest,
      anzahlRechnungen: anzahlRechnungenByKoop.get(k.id) || 0,
    });

    if (rest > 0.005) {
      ergebnis.nochNichtFakturiert.betrag += rest;
      ergebnis.nochNichtFakturiert.faelle += 1;
    } else if (rest < -0.005) {
      // ADR 0007: Ueberfakturierung wird ausgewiesen, nicht geklemmt.
      ergebnis.ueberfakturiert.betrag += -rest;
      ergebnis.ueberfakturiert.faelle += 1;
    }
  });

  return ergebnis;
}
