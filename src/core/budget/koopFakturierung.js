// koopFakturierung.js
// Restbetrag je Kooperation: kalkuliertes Soll minus bereits fakturiertes
// Honorar. Das Soll folgt der Kalkulation — Video-EK schlagen den
// Kooperations-EK, wo Videos gepflegt sind (Konvention aus
// collectEkVkPriceRows); bei Selbstzahlern kommt der KSK-Aufschlag dazu,
// weil ihre Rechnung ihn mitfakturiert.
// Geteilt zwischen Monatsauswertung (Sonderzeilen) und Rechnungsstatus
// (creatorseitig "noch nicht gestellt"), damit beide dasselbe Soll benutzen.

export function calculateKoopFakturierung({
  kooperationen = [],
  videos = [],
  rechnungen = [],
  kampagnen = [],
  gueltigeAuftragIds = null,
} = {}) {
  const kampagneToAuftrag = new Map(kampagnen.map(k => [k.id, k.auftrag_id]));

  const videoEkByKoop = new Map();
  const koopMitVideos = new Set();
  videos.forEach(v => {
    if (!v.kooperation_id) return;
    koopMitVideos.add(v.kooperation_id);
    videoEkByKoop.set(
      v.kooperation_id,
      (videoEkByKoop.get(v.kooperation_id) || 0) + (parseFloat(v.einkaufspreis_netto) || 0)
    );
  });

  // Fakturiert ist das Honorar (netto + steuerfrei), ohne KSK/Zusatzkosten.
  const fakturiertByKoop = new Map();
  rechnungen.forEach(r => {
    if (!r.kooperation_id) return;
    const honorar = (parseFloat(r.nettobetrag) || 0) + (parseFloat(r.nettobetrag_steuerfrei) || 0);
    fakturiertByKoop.set(
      r.kooperation_id,
      (fakturiertByKoop.get(r.kooperation_id) || 0) + honorar
    );
  });

  const ergebnis = {
    nochNichtFakturiert: { betrag: 0, faelle: 0 },
    ueberfakturiert: { betrag: 0, faelle: 0 },
  };

  kooperationen.forEach(k => {
    const auftragId = kampagneToAuftrag.get(k.kampagne_id);
    // Kooperationen herausgefilterter Auftraege (z. B. Entwuerfe) gehoeren
    // nicht in die Auswertung; Kooperationen ohne Auftrag schon.
    if (auftragId && gueltigeAuftragIds && !gueltigeAuftragIds.has(auftragId)) return;

    const ekSoll = koopMitVideos.has(k.id)
      ? (videoEkByKoop.get(k.id) || 0)
      : (parseFloat(k.einkaufspreis_netto) || 0);
    const soll = ekSoll + (k.ksk_selbstzahler ? (parseFloat(k.ksk_betrag) || 0) : 0);
    const rest = soll - (fakturiertByKoop.get(k.id) || 0);

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
