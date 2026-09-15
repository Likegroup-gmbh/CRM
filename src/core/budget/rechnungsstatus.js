// rechnungsstatus.js
// Zahlungsstand je Seite: Kunden, Contracting, Creator — gestellt, davon
// bezahlt, davon offen und noch nicht gestellt. Der Aufrufer kann die
// Auftragsmenge vorfiltern (Jahr, Leistungsbereich); ohne Filter ist es
// der Snapshot aller Auftraege.
//
// Identitaeten (per Konstruktion, im Test abgesichert):
//   gestellt = bezahlt + offen            (je Seite)
//   nettobetrag = gestellt + nichtGestellt (Kunden- und Contracting-Auftraege)
// ueberfaellig ist eine Teilmenge von offen.
//
// ADR 0007: nichtGestellt wird nicht geklemmt — ein negativer Wert ist
// Ueberfakturierung und muss sichtbar bleiben.
//
// Contractingrechnungen sind nur Zeilen rechnung mit Typ contracting
// (Netto, ohne KSK/Zusatz). Auftrag/Teilrechnung eines Contracting-
// Auftrags zaehlen weder bei Kunden- noch extra bei Contracting.
// Creator-Belege und -Reste nutzen dieselbe Kooperationsmenge wie die
// Kalkulationskarten: Auftrag im Filter, Rechnung nur mit dieser Kooperation.

import { berechneKskBetrag } from './kskSelbstzahler.js';
import { calculateKoopFakturierung } from './koopFakturierung.js';
import { isContracting } from './leistungsbereich.js';

function betrag(v) {
  return parseFloat(v) || 0;
}

function hatWert(v) {
  return v !== undefined && v !== null && v !== '';
}

function auftragIdVonKoop(koop, kampagneToAuftrag) {
  return koop ? (kampagneToAuftrag.get(koop.kampagne_id) || null) : null;
}

function auftragIdVonBeleg(r, koop, kampagneToAuftrag) {
  return r.auftrag_id || auftragIdVonKoop(koop, kampagneToAuftrag);
}

// Creator-Belege zaehlen nur mit Kooperation, deren Auftrag im Filter liegt
// — dieselbe Menge wie Creatoranteil. Contracting bleibt auftragsbezogen
// und darf ohne Kooperation stehen.
function zaehltCreatorBeleg(koop, kampagneToAuftrag, gueltigeAuftragIds) {
  const auftragId = auftragIdVonKoop(koop, kampagneToAuftrag);
  return Boolean(auftragId && gueltigeAuftragIds.has(auftragId));
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

export function leereRechnungsseite() {
  return {
    gestellt: 0, bezahlt: 0, offen: 0, ueberfaellig: 0, nichtGestellt: 0,
    kskGestellt: 0, zusatzGestellt: 0,
  };
}

/**
 * @param {object} params
 * @param {Array} params.auftraege - bereits um Entwuerfe gefiltert
 * @param {Array} params.kampagnen
 * @param {Array} params.kooperationen
 * @param {Array} params.videos - kooperation_videos
 * @param {Array} params.rechnungen - inkl. status/bezahlt_am/zahlungsziel/rechnungstyp
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
  const kunden = leereRechnungsseite();
  const contracting = leereRechnungsseite();
  const creator = leereRechnungsseite();

  // --- Kundenseite ---
  // Wie in der Monatsauswertung: hat ein Auftrag Teilrechnungen, zaehlen
  // ausschliesslich diese, sonst der Auftrag selbst — sonst wird doppelt
  // gezaehlt. Bezahlt setzt gestellt voraus; eine bezahlte, aber nicht als
  // gestellt markierte Zeile zaehlt als beides, sonst bricht die Identitaet.
  // Contracting-Auftraege gehoeren nicht hierher (eigene Seite).
  const teileByAuftrag = new Map();
  teilrechnungen.forEach(t => {
    if (!teileByAuftrag.has(t.auftrag_id)) teileByAuftrag.set(t.auftrag_id, []);
    teileByAuftrag.get(t.auftrag_id).push(t);
  });

  let contractingAuftragNetto = 0;
  auftraege.forEach(a => {
    const nettobetrag = betrag(a.nettobetrag);
    if (isContracting(a)) {
      contractingAuftragNetto += nettobetrag;
      return;
    }
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

  // --- Belege in rechnung: Contracting (Netto) vs Creator (Honorar+KSK+Zusatz) ---
  const gueltigeAuftragIds = new Set(auftraege.map(a => a.id));
  const koopById = new Map(kooperationen.map(k => [k.id, k]));
  const kampagneToAuftrag = new Map(kampagnen.map(k => [k.id, k.auftrag_id]));

  let contractingGestelltSumme = 0;
  rechnungen.forEach(r => {
    const koop = r.kooperation_id ? koopById.get(r.kooperation_id) : null;

    if (r.rechnungstyp === 'contracting') {
      const auftragId = auftragIdVonBeleg(r, koop, kampagneToAuftrag);
      // Belege zu Entwuerfen (oder sonst herausgefilterten Auftraegen) zaehlen nicht.
      if (auftragId && !gueltigeAuftragIds.has(auftragId)) return;
      const netto = betrag(r.nettobetrag);
      contracting.gestellt += netto;
      contractingGestelltSumme += netto;
      if (r.status === 'Bezahlt' || hatWert(r.bezahlt_am)) {
        contracting.bezahlt += netto;
      } else {
        contracting.offen += netto;
        if (istUeberfaellig(r.zahlungsziel, heute)) contracting.ueberfaellig += netto;
      }
      return;
    }

    if (!zaehltCreatorBeleg(koop, kampagneToAuftrag, gueltigeAuftragIds)) return;

    const honorar = betrag(r.nettobetrag) + betrag(r.nettobetrag_steuerfrei);
    const ksk = koop?.ksk_selbstzahler ? 0 : berechneKskBetrag(honorar);
    const zusatz = betrag(r.zusatzkosten);
    const gesamt = honorar + ksk + zusatz;

    creator.gestellt += gesamt;
    creator.kskGestellt += ksk;
    creator.zusatzGestellt += zusatz;
    // Status ist das gepflegte Feld; bezahlt_am gilt ebenfalls als Beleg
    // des Zahlungseingangs, falls der Status nicht nachgezogen wurde.
    if (r.status === 'Bezahlt' || hatWert(r.bezahlt_am)) {
      creator.bezahlt += gesamt;
    } else {
      creator.offen += gesamt;
      if (istUeberfaellig(r.zahlungsziel, heute)) creator.ueberfaellig += gesamt;
    }
  });

  // Ungeklemmt: negativ = Contracting ueberfakturiert (ADR 0007).
  contracting.nichtGestellt = contractingAuftragNetto - contractingGestelltSumme;

  // Creatorseitig noch nicht gestellt = Netto-Summe der Kooperations-
  // Restbetraege (positiv und negativ, ADR 0007). Dieselbe Quelle wie
  // die Sonderzeile der Monatsauswertung, nur ungeklemmt.
  creator.nichtGestellt = calculateKoopFakturierung({
    kooperationen,
    videos,
    rechnungen,
    kampagnen,
    gueltigeAuftragIds,
  }).proKoop.reduce((sum, k) => sum + k.rest, 0);

  return { kunden, contracting, creator };
}

function auftragLabel(a) {
  return (a?.auftragsname || a?.titel || '').trim() || 'Auftrag';
}

function rechnungLabel(r, auftrag) {
  const nr = (r?.rechnung_nr || '').trim();
  if (nr) return nr;
  return auftragLabel(auftrag);
}

function istRechnungBezahlt(r) {
  return r.status === 'Bezahlt' || hatWert(r.bezahlt_am);
}

function creatorPosten(r, koop) {
  const honorar = betrag(r.nettobetrag) + betrag(r.nettobetrag_steuerfrei);
  const ksk = koop?.ksk_selbstzahler ? 0 : berechneKskBetrag(honorar);
  const zusatz = betrag(r.zusatzkosten);
  return { honorar, ksk, zusatz, gesamt: honorar + ksk + zusatz };
}

function sortiertNachBetrag(belege) {
  return belege.slice().sort((a, b) => (b.betrag || 0) - (a.betrag || 0));
}

function hatRest(v) {
  return Math.abs(v) >= 0.005;
}

function leereBelegeSeite() {
  return { gestellt: [], bezahlt: [], offen: [], nichtGestellt: [] };
}

function sortierteBelegeSeite(seite) {
  return {
    gestellt: sortiertNachBetrag(seite.gestellt),
    bezahlt: sortiertNachBetrag(seite.bezahlt),
    offen: sortiertNachBetrag(seite.offen),
    nichtGestellt: sortiertNachBetrag(seite.nichtGestellt),
  };
}

function kundenPosition(t, a) {
  const bezahlt = hatWert(t.ueberwiesen_am) || Boolean(t.ueberwiesen);
  const gestellt = hatWert(t.rechnung_gestellt_am) || Boolean(t.rechnung_gestellt) || bezahlt;
  return {
    id: t.id || a.id,
    betrag: betrag(t.nettobetrag),
    gestellt,
    bezahlt,
    gestelltAm: t.rechnung_gestellt_am || null,
    bezahltAm: t.ueberwiesen_am || null,
    faelligkeit: t.re_faelligkeit || null,
  };
}

function pushKundenBeleg(ziel, kategorie, a, position) {
  const datum = kategorie === 'gestellt' ? position.gestelltAm
    : kategorie === 'bezahlt' ? position.bezahltAm
    : position.faelligkeit;
  ziel[kategorie].push({
    seite: 'kunden',
    kategorie,
    id: position.id,
    label: auftragLabel(a),
    datum,
    betrag: position.betrag,
    route: `/auftrag/${a.id}`,
  });
}

function koopLabel(k, auftrag) {
  const name = (k?.name || '').trim();
  if (name) return name;
  const auftragName = (auftrag?.auftragsname || auftrag?.titel || '').trim();
  return auftragName || 'Kooperation';
}

/**
 * Belege und Restbetraege, die die Zahlungsstand-Zellen ergeben.
 * Summe je Seite und Kategorie = calculateRechnungsstatus(...).seite.kategorie
 */
export function listZahlungsstandBelege({
  auftraege = [],
  kampagnen = [],
  kooperationen = [],
  videos = [],
  rechnungen = [],
  teilrechnungen = [],
} = {}) {
  const kunden = leereBelegeSeite();
  const contracting = leereBelegeSeite();
  const creator = leereBelegeSeite();

  const auftragById = new Map(auftraege.map(a => [a.id, a]));
  const teileByAuftrag = new Map();
  teilrechnungen.forEach(t => {
    if (!teileByAuftrag.has(t.auftrag_id)) teileByAuftrag.set(t.auftrag_id, []);
    teileByAuftrag.get(t.auftrag_id).push(t);
  });

  const contractingNettoByAuftrag = new Map();
  auftraege.forEach(a => {
    if (isContracting(a)) {
      contractingNettoByAuftrag.set(a.id, betrag(a.nettobetrag));
      return;
    }
    const teile = teileByAuftrag.get(a.id) || [];
    let positionen;
    if (teile.length > 0) {
      positionen = teile.map(t => kundenPosition(t, a));
    } else if (hatWert(a.rechnung_gestellt_am) || hatWert(a.ueberwiesen_am) || a.ueberwiesen) {
      positionen = [kundenPosition(a, a)];
    } else {
      positionen = [];
    }

    let gestelltSumme = 0;
    positionen.forEach(p => {
      if (!p.gestellt) return;
      gestelltSumme += p.betrag;
      pushKundenBeleg(kunden, 'gestellt', a, p);
      if (p.bezahlt) pushKundenBeleg(kunden, 'bezahlt', a, p);
      else pushKundenBeleg(kunden, 'offen', a, p);
    });
    const rest = betrag(a.nettobetrag) - gestelltSumme;
    if (!hatRest(rest)) return;
    kunden.nichtGestellt.push({
      seite: 'kunden',
      kategorie: 'nichtGestellt',
      id: a.id,
      label: auftragLabel(a),
      datum: null,
      betrag: rest,
      route: `/auftrag/${a.id}`,
    });
  });

  const gueltigeAuftragIds = new Set(auftraege.map(a => a.id));
  const koopById = new Map(kooperationen.map(k => [k.id, k]));
  const kampagneToAuftrag = new Map(kampagnen.map(k => [k.id, k.auftrag_id]));
  const contractingGestelltByAuftrag = new Map();

  rechnungen.forEach(r => {
    const koop = r.kooperation_id ? koopById.get(r.kooperation_id) : null;

    if (r.rechnungstyp === 'contracting') {
      const auftragId = auftragIdVonBeleg(r, koop, kampagneToAuftrag);
      if (auftragId && !gueltigeAuftragIds.has(auftragId)) return;
      const auftrag = auftragId ? auftragById.get(auftragId) : null;
      if (auftragId) {
        contractingGestelltByAuftrag.set(
          auftragId,
          (contractingGestelltByAuftrag.get(auftragId) || 0) + betrag(r.nettobetrag)
        );
      }
      const row = {
        seite: 'contracting',
        id: r.id,
        label: rechnungLabel(r, auftrag),
        betrag: betrag(r.nettobetrag),
        route: `/rechnung/${r.id}`,
      };
      contracting.gestellt.push({ ...row, kategorie: 'gestellt', datum: r.gestellt_am || null });
      if (istRechnungBezahlt(r)) {
        contracting.bezahlt.push({ ...row, kategorie: 'bezahlt', datum: r.bezahlt_am || null });
      } else {
        contracting.offen.push({ ...row, kategorie: 'offen', datum: r.zahlungsziel || null });
      }
      return;
    }

    if (!zaehltCreatorBeleg(koop, kampagneToAuftrag, gueltigeAuftragIds)) return;
    const auftrag = auftragById.get(auftragIdVonKoop(koop, kampagneToAuftrag));
    const posten = creatorPosten(r, koop);
    const row = {
      seite: 'creator',
      id: r.id,
      label: rechnungLabel(r, auftrag),
      betrag: posten.gesamt,
      honorar: posten.honorar,
      ksk: posten.ksk,
      zusatz: posten.zusatz,
      route: `/rechnung/${r.id}`,
    };
    creator.gestellt.push({ ...row, kategorie: 'gestellt', datum: r.gestellt_am || null });
    if (istRechnungBezahlt(r)) {
      creator.bezahlt.push({ ...row, kategorie: 'bezahlt', datum: r.bezahlt_am || null });
    } else {
      creator.offen.push({ ...row, kategorie: 'offen', datum: r.zahlungsziel || null });
    }
  });

  contractingNettoByAuftrag.forEach((netto, auftragId) => {
    const rest = netto - (contractingGestelltByAuftrag.get(auftragId) || 0);
    if (!hatRest(rest)) return;
    const auftrag = auftragById.get(auftragId);
    contracting.nichtGestellt.push({
      seite: 'contracting',
      kategorie: 'nichtGestellt',
      id: auftragId,
      label: auftragLabel(auftrag),
      datum: null,
      betrag: rest,
      route: `/auftrag/${auftragId}`,
    });
  });

  const koopFakt = calculateKoopFakturierung({
    kooperationen,
    videos,
    rechnungen,
    kampagnen,
    gueltigeAuftragIds,
  });
  koopFakt.proKoop.forEach(k => {
    if (!hatRest(k.rest)) return;
    const koop = koopById.get(k.id);
    const auftragId = koop ? kampagneToAuftrag.get(koop.kampagne_id) : null;
    const auftrag = auftragId ? auftragById.get(auftragId) : null;
    creator.nichtGestellt.push({
      seite: 'creator',
      kategorie: 'nichtGestellt',
      id: k.id,
      label: koopLabel(koop, auftrag),
      datum: null,
      betrag: k.rest,
      route: `/kooperation/${k.id}`,
    });
  });

  return {
    kunden: sortierteBelegeSeite(kunden),
    contracting: sortierteBelegeSeite(contracting),
    creator: sortierteBelegeSeite(creator),
  };
}
