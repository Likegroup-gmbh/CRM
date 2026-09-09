// rechnungsstatus.js
// Zahlungsstand als Snapshot "Stand heute" (PRD Schritt 5): je Seite —
// Kunden und Creator — gestellt, davon bezahlt, davon offen und noch nicht
// gestellt. Die Monatsauswertung periodisiert Buchungen (wann wurde
// gebucht?); dieser Block beantwortet die andere Frage: wo stehen wir
// gerade? Er haengt deshalb bewusst an keinem Zeitraum-Filter.
//
// Identitaeten (per Konstruktion, im Test abgesichert):
//   gestellt = bezahlt + offen            (je Seite)
//   nettobetrag = gestellt + nichtGestellt (kundenseitig, je Auftrag)
// ueberfaellig ist eine Teilmenge von offen.
//
// ADR 0007: nichtGestellt wird nicht geklemmt — ein negativer Wert ist
// kundenseitige Ueberfakturierung und muss sichtbar bleiben.

import { berechneKskBetrag } from './kskSelbstzahler.js';
import { calculateKoopFakturierung } from './koopFakturierung.js';

function betrag(v) {
  return parseFloat(v) || 0;
}

function hatWert(v) {
  return v !== undefined && v !== null && v !== '';
}

// Dieselbe Tageslogik wie PaymentRowStatus.isReFaelligkeitOverdue —
// hier dupliziert, damit core/budget nicht von modules abhaengt.
function istUeberfaellig(datumStr, heute) {
  if (!datumStr) return false;
  const d = new Date(datumStr);
  if (Number.isNaN(d.getTime())) return false;
  d.setHours(0, 0, 0, 0);
  const h = new Date(heute);
  h.setHours(0, 0, 0, 0);
  return d < h;
}

const leereSeite = () => ({ gestellt: 0, bezahlt: 0, offen: 0, ueberfaellig: 0, nichtGestellt: 0 });

/**
 * @param {object} params
 * @param {Array} params.auftraege - bereits um Entwuerfe gefiltert
 * @param {Array} params.kampagnen
 * @param {Array} params.kooperationen
 * @param {Array} params.videos - kooperation_videos
 * @param {Array} params.rechnungen - Creatorrechnungen inkl. status/bezahlt_am/zahlungsziel
 * @param {Array} params.teilrechnungen - auftrag_teilrechnung inkl. ueberwiesen_am/re_faelligkeit
 * @param {Date} [params.heute] - Referenztag fuer Ueberfaelligkeit (tests injizieren ihn)
 */
export function calculateRechnungsstatus({
  auftraege = [],
  kampagnen = [],
  kooperationen = [],
  videos = [],
  rechnungen = [],
  teilrechnungen = [],
  heute = new Date(),
} = {}) {
  const kunden = leereSeite();
  const creator = leereSeite();

  // --- Kundenseite ---
  // Wie in der Monatsauswertung: hat ein Auftrag Teilrechnungen, zaehlen
  // ausschliesslich diese, sonst der Auftrag selbst — sonst wird doppelt
  // gezaehlt. Bezahlt setzt gestellt voraus; eine bezahlte, aber nicht als
  // gestellt markierte Zeile zaehlt als beides, sonst bricht die Identitaet.
  const teileByAuftrag = new Map();
  teilrechnungen.forEach(t => {
    if (!teileByAuftrag.has(t.auftrag_id)) teileByAuftrag.set(t.auftrag_id, []);
    teileByAuftrag.get(t.auftrag_id).push(t);
  });

  auftraege.forEach(a => {
    const nettobetrag = betrag(a.nettobetrag);
    const teile = teileByAuftrag.get(a.id) || [];

    let positionen;
    if (teile.length > 0) {
      positionen = teile.map(t => {
        // Wie PaymentRowStatus: die Datumsfelder sind massgeblich, die
        // Boolean-Flags nur Fallback — sie koennen veraltet sein.
        const bezahlt = hatWert(t.ueberwiesen_am) || Boolean(t.ueberwiesen);
        const gestellt = hatWert(t.rechnung_gestellt_am) || Boolean(t.rechnung_gestellt) || bezahlt;
        return { betrag: betrag(t.nettobetrag), gestellt, bezahlt, faelligkeit: t.re_faelligkeit };
      });
    } else if (hatWert(a.rechnung_gestellt_am) || hatWert(a.ueberwiesen_am) || a.ueberwiesen) {
      positionen = [{
        betrag: nettobetrag,
        gestellt: true,
        bezahlt: hatWert(a.ueberwiesen_am) || Boolean(a.ueberwiesen),
        faelligkeit: a.re_faelligkeit,
      }];
    } else {
      positionen = [];
    }

    let gestelltSumme = 0;
    positionen.forEach(p => {
      if (!p.gestellt) return;
      gestelltSumme += p.betrag;
      kunden.gestellt += p.betrag;
      if (p.bezahlt) {
        kunden.bezahlt += p.betrag;
      } else {
        kunden.offen += p.betrag;
        if (istUeberfaellig(p.faelligkeit, heute)) kunden.ueberfaellig += p.betrag;
      }
    });
    // Ungeklemmt: negativ = kundenseitig ueberfakturiert (ADR 0007).
    kunden.nichtGestellt += nettobetrag - gestelltSumme;
  });

  // --- Creatorseite ---
  // Dieselbe Betragsdefinition wie die Monatsmatrix: Honorar (netto +
  // steuerfrei) + berechnete KSK (Selbstzahler ausgenommen) + Zusatzkosten.
  const gueltigeAuftragIds = new Set(auftraege.map(a => a.id));
  const koopById = new Map(kooperationen.map(k => [k.id, k]));
  const kampagneToAuftrag = new Map(kampagnen.map(k => [k.id, k.auftrag_id]));

  rechnungen.forEach(r => {
    const koop = r.kooperation_id ? koopById.get(r.kooperation_id) : null;
    const auftragId = r.auftrag_id
      || (koop ? kampagneToAuftrag.get(koop.kampagne_id) : null);
    // Belege zu Entwuerfen (oder sonst herausgefilterten Auftraegen) zaehlen nicht.
    if (auftragId && !gueltigeAuftragIds.has(auftragId)) return;

    const honorar = betrag(r.nettobetrag) + betrag(r.nettobetrag_steuerfrei);
    const ksk = koop?.ksk_selbstzahler ? 0 : berechneKskBetrag(honorar);
    const gesamt = honorar + ksk + betrag(r.zusatzkosten);

    creator.gestellt += gesamt;
    // Status ist das gepflegte Feld; bezahlt_am gilt ebenfalls als Beleg
    // des Zahlungseingangs, falls der Status nicht nachgezogen wurde.
    if (r.status === 'Bezahlt' || hatWert(r.bezahlt_am)) {
      creator.bezahlt += gesamt;
    } else {
      creator.offen += gesamt;
      if (istUeberfaellig(r.zahlungsziel, heute)) creator.ueberfaellig += gesamt;
    }
  });

  // Creatorseitig noch nicht gestellt = offener Restbetrag je Kooperation,
  // aus derselben Quelle wie die Sonderzeile der Monatsauswertung.
  creator.nichtGestellt = calculateKoopFakturierung({
    kooperationen,
    videos,
    rechnungen,
    kampagnen,
    gueltigeAuftragIds,
  }).nochNichtFakturiert.betrag;

  return { kunden, creator };
}
