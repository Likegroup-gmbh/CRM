// koopFakturierung.js
// Restbetrag je Kooperation: kalkuliertes Soll minus bereits fakturiertes
// Honorar. Das Soll folgt der Kalkulation — Video-EK schlagen den
// Kooperations-EK, wo Videos gepflegt sind (Konvention aus
// collectEkVkPriceRows); bei Selbstzahlern kommt der KSK-Aufschlag dazu,
// weil ihre Rechnung ihn mitfakturiert.
// Geteilt zwischen Monatsauswertung (Sonderzeilen) und Rechnungsstatus
// (creatorseitig "noch nicht gestellt"), damit beide dasselbe Soll benutzen.

function betrag(v) {
  return parseFloat(v) || 0;
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

  const videoEkByKoop = new Map();
  const koopMitVideos = new Set();
  videos.forEach(v => {
    if (!v.kooperation_id) return;
    koopMitVideos.add(v.kooperation_id);
    videoEkByKoop.set(
      v.kooperation_id,
      (videoEkByKoop.get(v.kooperation_id) || 0) + betrag(v.einkaufspreis_netto)
    );
  });

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

    const ekSoll = koopMitVideos.has(k.id)
      ? (videoEkByKoop.get(k.id) || 0)
      : betrag(k.einkaufspreis_netto);
    const soll = ekSoll + (k.ksk_selbstzahler ? betrag(k.ksk_betrag) : 0);
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
