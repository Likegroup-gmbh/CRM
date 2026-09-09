// monatsauswertung.js
// Reine Aggregationslogik der Monatsauswertung (ADR 0006): Umsatz und
// Fremdkosten je Monat und Leistungsbereich, in zwei Sichten.
//   Buchhaltungssicht: jeder Beleg steht im Monat seines Rechnungsdatums
//     (kundenseitig rechnung_gestellt_am, creatorseitig gestellt_am).
//   Margensicht: Umsatz wie oben; die Fremdkosten eines Auftrags folgen
//     seinem Umsatz anteilig ueber dessen Kundenrechnungsmonate. Bei einer
//     einzigen Kundenrechnung ist das deren Monat; bei 50/50-Teilrechnungen
//     traegt jeder Monat die Haelfte der Kosten — sonst kippt die Monatsmarge
//     genau bei den Raten-Auftraegen.
// Grundlage sind ausschliesslich gestellte Rechnungen, nicht die Kalkulation.
//
// ADR 0007: Was keinen Monat oder keinen Bereich hat, wird in Sonderzeilen
// ausgewiesen statt still zu verschwinden. Die Summe der Bereiche ergibt
// deshalb immer das Gesamt.

import { berechneKskBetrag } from './kskSelbstzahler.js';
import { leistungsbereichForAuftrag } from './leistungsbereich.js';

// Rechnungen mit gestellt_am vor 2020 sind in dieser Datenbank falsch
// (CRM startete spaeter) und wuerden Phantom-Monate erzeugen.
const MIN_PLAUSIBLES_JAHR = 2020;

function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isPlausibleMonth(key) {
  return !!key && parseInt(key.slice(0, 4), 10) >= MIN_PLAUSIBLES_JAHR;
}

function emptyCellBuckets() {
  return { umsatz: {}, honorar: {}, ksk: {}, zusatzkosten: {}, differenz: {} };
}

function addTo(row, field, month, betrag) {
  row[field][month] = (row[field][month] || 0) + betrag;
}

function addKosten(row, month, kosten, anteil = 1) {
  addTo(row, 'honorar', month, kosten.honorar * anteil);
  if (kosten.ksk) addTo(row, 'ksk', month, kosten.ksk * anteil);
  if (kosten.zusatzkosten) addTo(row, 'zusatzkosten', month, kosten.zusatzkosten * anteil);
}

function finalizeDifferenz(bereiche) {
  Object.values(bereiche).forEach(row => {
    const months = new Set([
      ...Object.keys(row.umsatz),
      ...Object.keys(row.honorar),
      ...Object.keys(row.ksk),
      ...Object.keys(row.zusatzkosten),
    ]);
    months.forEach(m => {
      row.differenz[m] = (row.umsatz[m] || 0)
        - (row.honorar[m] || 0) - (row.ksk[m] || 0) - (row.zusatzkosten[m] || 0);
    });
  });
}

/**
 * @param {object} params
 * @param {Array} params.auftraege - bereits um Entwuerfe gefiltert
 * @param {Array} params.blocks - auftrag_kampagnenart_blocks
 * @param {Array} params.kampagnen
 * @param {Array} params.kooperationen
 * @param {Array} params.videos - kooperation_videos
 * @param {Array} params.rechnungen - Creatorrechnungen inkl. gestellt_am
 * @param {Array} params.teilrechnungen - auftrag_teilrechnung
 */
export function calculateMonatsauswertung({
  auftraege = [],
  blocks = [],
  kampagnen = [],
  kooperationen = [],
  videos = [],
  rechnungen = [],
  teilrechnungen = [],
} = {}) {
  const gueltigeAuftragIds = new Set(auftraege.map(a => a.id));

  const blocksByAuftrag = new Map();
  blocks.forEach(b => {
    if (!blocksByAuftrag.has(b.auftrag_id)) blocksByAuftrag.set(b.auftrag_id, []);
    blocksByAuftrag.get(b.auftrag_id).push(b);
  });

  const bereichByAuftrag = new Map();
  auftraege.forEach(a => {
    bereichByAuftrag.set(a.id, leistungsbereichForAuftrag(a, blocksByAuftrag.get(a.id) || []));
  });

  const koopById = new Map(kooperationen.map(k => [k.id, k]));
  const kampagneToAuftrag = new Map(kampagnen.map(k => [k.id, k.auftrag_id]));

  // Video-EK je Kooperation, wo Videos gepflegt sind (Konvention aus
  // collectEkVkPriceRows: Video-Preise schlagen den Kooperations-Preis).
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

  const teilrechnungenByAuftrag = new Map();
  teilrechnungen.forEach(t => {
    if (!teilrechnungenByAuftrag.has(t.auftrag_id)) teilrechnungenByAuftrag.set(t.auftrag_id, []);
    teilrechnungenByAuftrag.get(t.auftrag_id).push(t);
  });

  const views = {
    buchhaltung: { bereiche: {} },
    marge: { bereiche: {} },
  };
  const months = new Set();

  const rowFor = (sicht, bereich) => {
    const map = views[sicht].bereiche;
    if (!map[bereich]) map[bereich] = emptyCellBuckets();
    return map[bereich];
  };

  // --- Umsatz: in beiden Sichten identisch, immer nach Rechnungsdatum ---
  // Nebenbei je Auftrag die Umsatzverteilung ueber die Monate sammeln — sie
  // ist der Verteilschluessel der Fremdkosten in der Margensicht.
  const umsatzByAuftragMonth = new Map();
  let umsatzGesamt = 0;

  const addUmsatz = (auftragId, bereich, month, betrag) => {
    addTo(rowFor('buchhaltung', bereich), 'umsatz', month, betrag);
    addTo(rowFor('marge', bereich), 'umsatz', month, betrag);
    if (!umsatzByAuftragMonth.has(auftragId)) umsatzByAuftragMonth.set(auftragId, {});
    const perMonth = umsatzByAuftragMonth.get(auftragId);
    perMonth[month] = (perMonth[month] || 0) + betrag;
    months.add(month);
    umsatzGesamt += betrag;
  };

  auftraege.forEach(a => {
    const bereich = bereichByAuftrag.get(a.id) || 'nicht_zugeordnet';
    const gestellteTeile = (teilrechnungenByAuftrag.get(a.id) || [])
      .filter(t => t.rechnung_gestellt && isPlausibleMonth(monthKey(t.rechnung_gestellt_am)));

    if (gestellteTeile.length > 0) {
      // Teilrechnungen ersetzen den Auftrags-Nettobetrag, sonst doppelt.
      gestellteTeile.forEach(t => {
        const betrag = parseFloat(t.nettobetrag) || 0;
        if (!betrag) return;
        addUmsatz(a.id, bereich, monthKey(t.rechnung_gestellt_am), betrag);
      });
      return;
    }

    const month = monthKey(a.rechnung_gestellt_am);
    if (!isPlausibleMonth(month)) return;
    const betrag = parseFloat(a.nettobetrag) || 0;
    if (!betrag) return;
    addUmsatz(a.id, bereich, month, betrag);
  });

  // --- Fremdkosten: je Sicht anders periodisiert ---
  const sonderzeilen = {
    nochNichtFakturiert: { betrag: 0, faelle: 0 },
    ueberfakturiert: { betrag: 0, faelle: 0 },
    ohneKundenrechnung: { betrag: 0, faelle: 0 },
    unplausibleDaten: { betrag: 0, faelle: 0 },
  };
  const honorarInMatrix = { buchhaltung: 0, marge: 0 };
  const fakturiertByKoop = new Map();

  rechnungen.forEach(r => {
    const honorar = (parseFloat(r.nettobetrag) || 0) + (parseFloat(r.nettobetrag_steuerfrei) || 0);
    const zusatzkosten = parseFloat(r.zusatzkosten) || 0;

    if (r.kooperation_id) {
      fakturiertByKoop.set(
        r.kooperation_id,
        (fakturiertByKoop.get(r.kooperation_id) || 0) + honorar
      );
    }

    const koop = r.kooperation_id ? koopById.get(r.kooperation_id) : null;
    const auftragId = r.auftrag_id
      || (koop ? kampagneToAuftrag.get(koop.kampagne_id) : null);

    // Belege zu Entwuerfen (oder sonst herausgefilterten Auftraegen) gehoeren
    // nicht in die Auswertung — sonst landen sie in "Nicht zugeordnet".
    if (auftragId && !gueltigeAuftragIds.has(auftragId)) return;

    // Selbstzahler führen die KSK selbst ab; der Aufschlag steckt im Honorar.
    const ksk = koop?.ksk_selbstzahler ? 0 : berechneKskBetrag(honorar);
    const kosten = { honorar, ksk, zusatzkosten };
    const kostenGesamt = honorar + ksk + zusatzkosten;

    const bereich = (auftragId && bereichByAuftrag.get(auftragId)) || 'nicht_zugeordnet';

    const month = monthKey(r.gestellt_am);
    if (!isPlausibleMonth(month)) {
      // Ausgewiesen statt in einem Phantom-Monat (ADR 0007).
      sonderzeilen.unplausibleDaten.betrag += kostenGesamt;
      sonderzeilen.unplausibleDaten.faelle += 1;
      return;
    }

    addKosten(rowFor('buchhaltung', bereich), month, kosten);
    honorarInMatrix.buchhaltung += honorar;
    months.add(month);

    const umsatzMonate = auftragId ? umsatzByAuftragMonth.get(auftragId) : null;
    if (!umsatzMonate || Object.keys(umsatzMonate).length === 0) {
      sonderzeilen.ohneKundenrechnung.betrag += kostenGesamt;
      sonderzeilen.ohneKundenrechnung.faelle += 1;
      return;
    }

    // Die Kosten folgen dem Umsatz: jeder Kundenrechnungsmonat traegt seinen
    // Umsatzanteil an den Fremdkosten (bei einer Rechnung: 100 %).
    const umsatzAuftrag = Object.values(umsatzMonate).reduce((s, v) => s + v, 0);
    Object.entries(umsatzMonate).forEach(([margeMonth, anteilBetrag]) => {
      const anteil = umsatzAuftrag > 0 ? anteilBetrag / umsatzAuftrag : 0;
      if (anteil <= 0) return;
      addKosten(rowFor('marge', bereich), margeMonth, kosten, anteil);
      honorarInMatrix.marge += honorar * anteil;
      months.add(margeMonth);
    });
  });

  // --- Noch nicht fakturiert / ueberfakturiert: Restbetrag je Kooperation ---
  kooperationen.forEach(k => {
    const auftragId = kampagneToAuftrag.get(k.kampagne_id);
    if (auftragId && !gueltigeAuftragIds.has(auftragId)) return;

    // Soll wie in der Kalkulation: Video-Preise, wo gepflegt, sonst der
    // Kooperations-Preis. Bei Selbstzahlern kommt der KSK-Aufschlag dazu,
    // weil ihre Rechnung ihn mitfakturiert.
    const ekSoll = koopMitVideos.has(k.id)
      ? (videoEkByKoop.get(k.id) || 0)
      : (parseFloat(k.einkaufspreis_netto) || 0);
    const soll = ekSoll + (k.ksk_selbstzahler ? (parseFloat(k.ksk_betrag) || 0) : 0);
    const fakturiert = fakturiertByKoop.get(k.id) || 0;
    const rest = soll - fakturiert;
    if (rest > 0.005) {
      sonderzeilen.nochNichtFakturiert.betrag += rest;
      sonderzeilen.nochNichtFakturiert.faelle += 1;
    } else if (rest < -0.005) {
      // ADR 0007: Ueberfakturierung wird ausgewiesen, nicht geklemmt.
      sonderzeilen.ueberfakturiert.betrag += -rest;
      sonderzeilen.ueberfakturiert.faelle += 1;
    }
  });

  finalizeDifferenz(views.buchhaltung.bereiche);
  finalizeDifferenz(views.marge.bereiche);

  const sortedMonths = [...months].sort();

  return {
    months: sortedMonths,
    views,
    sonderzeilen,
    kontrolle: {
      umsatzGesamt,
      honorarInMatrix,
    },
  };
}

// Zuordnungsquote: Anteil des Umsatzes, der einem echten Leistungsbereich
// zugeordnet ist. Gemischt ist eine bekannte Mehrbereichs-Zuordnung und
// zaehlt als zugeordnet; Nicht zugeordnet ist der Datenmangel.
export function zuordnungsquote(view) {
  const bereiche = view?.bereiche || {};
  let gesamt = 0;
  let nichtZugeordnet = 0;
  Object.entries(bereiche).forEach(([key, row]) => {
    const summe = Object.values(row.umsatz || {}).reduce((s, v) => s + v, 0);
    gesamt += summe;
    if (key === 'nicht_zugeordnet') nichtZugeordnet += summe;
  });
  if (gesamt <= 0) return null;
  return (gesamt - nichtZugeordnet) / gesamt;
}
