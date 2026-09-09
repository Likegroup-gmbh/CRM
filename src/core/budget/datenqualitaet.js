// datenqualitaet.js
// Datenqualitaetsanzeige (PRD Schritt 9, ADR 0007): findet Pflegemaengel,
// die Finanzzahlen verfaelschen, gruppiert sie nach Kampagne und sortiert
// nach betroffenem Geldvolumen. Die Anzeige benennt die Faelle — korrigiert
// werden sie von den Teams, nicht hier.
//
// EK gleich VK ist ausdruecklich KEINE Pruefung: bei Influencer-Auftraegen
// verdient die Agentur ueber die Fee und reicht den Creatorpreis durch
// (belegt ueber die Fakturierungsquote, siehe PRD).
//
// Die acht Pruefungen sind an den Live-Daten kalibriert (Stand 2026-09-09):
//   1/2. Videos ohne EK/VK: Preis fehlt oder ist 0.
//   3. Kaum erfasster Einkauf: fakturiert > 0 und erfasstes Soll deckt
//      weniger als die Haelfte der Fakturierung.
//   4. Videos ohne Kampagnenart nur in gemischten Auftraegen — nur dort
//      verfaelscht die fehlende Art die Bereichs-Zuordnung.
//   5. Auftraege ohne Kampagnenart-Block (Contracting braucht keinen).
//   6. Gemischte Auftraege ohne Block-Umsatz (nicht anteilig aufteilbar).
//   7. Rechnungen mit gestellt_am vor 2020 (CRM startete spaeter).
//   8. Offener Restbetrag nur bei Kooperationen mit mindestens einer
//      Rechnung — angefangen, aber nicht zu Ende fakturiert. Ohne
//      Rechnung ist "noch nichts fakturiert" der Normalzustand.
//
// Zaehlweise: Auftrags-Level-Befunde werden jeder Kampagne des Auftrags
// zugeordnet (Gruppensicht). Die Pruefungs-Karten und die Gesamtsummen
// zaehlen denselben Fall dagegen nur einmal (Fallsicht, dedupliziert) —
// sonst weichen die Karten von den kalibrierten Fallzahlen ab.

import { leistungsbereichForAuftrag } from './leistungsbereich.js';
import { calculateKoopFakturierung } from './koopFakturierung.js';

const MIN_PLAUSIBLES_JAHR = 2020;
const KAUM_ERFASST_QUOTE = 0.5;

export const DATENQUALITAET_PRUEFUNGEN = {
  video_ohne_ek: {
    label: 'Videos ohne Einkaufspreis',
    hint: 'Ohne EK ist die Marge unbekannt. Betroffenes Volumen = Verkaufspreis des Videos.',
  },
  video_ohne_vk: {
    label: 'Videos ohne Verkaufspreis',
    hint: 'Ohne VK fehlt der Umsatzanteil des Videos. Betroffenes Volumen = Einkaufspreis des Videos.',
  },
  koop_kaum_einkauf: {
    label: 'Kooperationen mit Rechnung, aber kaum erfasstem Einkauf',
    hint: 'Die Creatorrechnungen uebersteigen den erfassten Einkaufspreis um mehr als das Doppelte — der EK wurde offenbar nicht gepflegt.',
  },
  video_ohne_kampagnenart: {
    label: 'Videos ohne Kampagnenart in gemischten Auftraegen',
    hint: 'Gemischte Auftraege brauchen die Kampagnenart am Video, sonst ist die Zuordnung zum Leistungsbereich nicht moeglich.',
  },
  auftrag_ohne_block: {
    label: 'Auftraege ohne Kampagnenart-Block',
    hint: 'Ohne Block landet der Auftrag in "Nicht zugeordnet" und die Monatsauswertung kann ihn keinem Leistungsbereich zuordnen.',
  },
  gemischt_ohne_umsatz: {
    label: 'Gemischte Auftraege ohne Block-Umsatz',
    hint: 'Ohne umsatz_netto an den Bloecken laesst sich der Auftrag nicht anteilig auf die Bereiche aufteilen.',
  },
  rechnung_unplausibel: {
    label: 'Rechnungen mit unmoeglichem Rechnungsdatum',
    hint: 'Gestellt-Datum vor 2020 ist falsch (das CRM startete spaeter) und wuerde Phantom-Monate erzeugen.',
  },
  koop_restbetrag_offen: {
    label: 'Kooperationen mit offenem Restbetrag',
    hint: 'Mindestens eine Creatorrechnung existiert, aber der kalkulierte Einkaufspreis ist noch nicht voll fakturiert.',
  },
};

function betrag(v) {
  return parseFloat(v) || 0;
}

// Gepflegt heisst: positiver Betrag. null, 0 und negative Werte gelten
// als fehlend.
function gepflegt(v) {
  return betrag(v) > 0;
}

/**
 * @param {object} params
 * @param {Array} params.auftraege - bereits um Entwuerfe gefiltert
 *   (Konvention wie bei der Monatsauswertung)
 * @param {Array} params.blocks - auftrag_kampagnenart_blocks
 * @param {Array} params.kampagnen
 * @param {Array} params.kooperationen
 * @param {Array} params.videos - kooperation_videos
 * @param {Array} params.rechnungen - Creatorrechnungen
 * @param {Array} [params.creators] - fuer lesbare Kooperations-Labels
 */
export function calculateDatenqualitaet({
  auftraege = [],
  blocks = [],
  kampagnen = [],
  kooperationen = [],
  videos = [],
  rechnungen = [],
  creators = [],
} = {}) {
  const gueltigeAuftragIds = new Set(auftraege.map(a => a.id));
  const kampagneById = new Map(kampagnen.map(k => [k.id, k]));
  const koopById = new Map(kooperationen.map(k => [k.id, k]));
  const creatorNameById = new Map(creators.map(c => [
    c.id,
    [c.vorname, c.nachname].filter(Boolean).join(' ').trim(),
  ]));

  const blocksByAuftrag = new Map();
  blocks.forEach(b => {
    if (!blocksByAuftrag.has(b.auftrag_id)) blocksByAuftrag.set(b.auftrag_id, []);
    blocksByAuftrag.get(b.auftrag_id).push(b);
  });

  const bereichByAuftrag = new Map();
  const blockUmsatzByAuftrag = new Map();
  auftraege.forEach(a => {
    const eigene = blocksByAuftrag.get(a.id) || [];
    bereichByAuftrag.set(a.id, leistungsbereichForAuftrag(a, eigene));
    blockUmsatzByAuftrag.set(a.id, eigene.reduce((s, b) => s + betrag(b.umsatz_netto), 0));
  });

  const kampagnenIdsByAuftrag = new Map();
  kampagnen.forEach(k => {
    if (!k.auftrag_id) return;
    if (!kampagnenIdsByAuftrag.has(k.auftrag_id)) kampagnenIdsByAuftrag.set(k.auftrag_id, []);
    kampagnenIdsByAuftrag.get(k.auftrag_id).push(k.id);
  });

  // --- Gruppen- und Pruefungs-Akkumulatoren ---
  const gruppen = new Map();
  const proPruefung = {};
  Object.keys(DATENQUALITAET_PRUEFUNGEN).forEach(key => {
    proPruefung[key] = { anzahl: 0, volumen: 0 };
  });

  const gruppeFor = (kampagneId) => {
    const key = kampagneId || null;
    if (!gruppen.has(key)) {
      const kampagne = key ? kampagneById.get(key) : null;
      gruppen.set(key, {
        kampagneId: key,
        name: kampagne?.kampagnenname || (key ? 'Unbenannte Kampagne' : 'Ohne Kampagne'),
        volumen: 0,
        pflegegrad: null,
        geprueft: 0,
        fehlerfrei: 0,
        maengel: [],
        _maengelByPruefung: new Map(),
        _units: new Map(),
      });
    }
    return gruppen.get(key);
  };

  // Eine Einheit (Video, Kooperation, Auftrag, Rechnung) zaehlt als
  // geprueft, sobald mindestens eine Pruefung auf sie anwendbar war, und
  // als fehlerfrei, solange keine Pruefung angeschlagen hat.
  const unitFor = (gruppe, typ, id) => {
    const key = `${typ}:${id}`;
    if (!gruppe._units.has(key)) {
      gruppe._units.set(key, { fehlerfrei: true });
    }
    return gruppe._units.get(key);
  };

  // Fallsicht: derselbe Fall (Pruefung x Einheit) zaehlt global nur einmal,
  // auch wenn er mehreren Kampagnen zugeordnet wird (Mehrkampagnen-Auftrag).
  const gezaehlteFaelle = new Set();

  const addMangel = (gruppe, pruefung, detail) => {
    if (!gruppe._maengelByPruefung.has(pruefung)) {
      gruppe._maengelByPruefung.set(pruefung, { pruefung, anzahl: 0, volumen: 0, details: [] });
    }
    const m = gruppe._maengelByPruefung.get(pruefung);
    m.anzahl += 1;
    m.volumen += detail.betrag || 0;
    m.details.push(detail);
    gruppe.volumen += detail.betrag || 0;

    const fallKey = `${pruefung}:${detail.typ}:${detail.id}`;
    if (!gezaehlteFaelle.has(fallKey)) {
      gezaehlteFaelle.add(fallKey);
      proPruefung[pruefung].anzahl += 1;
      proPruefung[pruefung].volumen += detail.betrag || 0;
    }
  };

  const videoLabel = (v) => v.titel || v.video_name || 'Video';
  const koopLabel = (k) => creatorNameById.get(k?.creator_id) || 'Kooperation';
  const auftragLabel = (a) => a?.auftragsname || a?.titel || 'Auftrag';

  // --- 1/2/4. Video-Pruefungen ---
  videos.forEach(v => {
    const koop = v.kooperation_id ? koopById.get(v.kooperation_id) : null;
    const kampagneId = koop?.kampagne_id || null;
    const auftragId = kampagneId ? kampagneById.get(kampagneId)?.auftrag_id : null;
    // Entwuerfe sind herausgefiltert; Videos ohne Auftragsbezug bleiben drin.
    if (auftragId && !gueltigeAuftragIds.has(auftragId)) return;

    const gruppe = gruppeFor(kampagneId);
    const unit = unitFor(gruppe, 'video', v.id);

    const ek = betrag(v.einkaufspreis_netto);
    const vk = betrag(v.verkaufspreis_netto);
    // Am Video haengt der VK; fehlt auch der, ist der EK die beste Naeherung.
    const volumen = vk > 0 ? vk : ek;

    if (!gepflegt(v.einkaufspreis_netto)) {
      unit.fehlerfrei = false;
      addMangel(gruppe, 'video_ohne_ek', { typ: 'video', id: v.id, label: videoLabel(v), betrag: volumen });
    }
    if (!gepflegt(v.verkaufspreis_netto)) {
      unit.fehlerfrei = false;
      addMangel(gruppe, 'video_ohne_vk', { typ: 'video', id: v.id, label: videoLabel(v), betrag: volumen });
    }
    const gemischt = auftragId && bereichByAuftrag.get(auftragId) === 'gemischt';
    if (gemischt && !String(v.kampagnenart || '').trim()) {
      unit.fehlerfrei = false;
      addMangel(gruppe, 'video_ohne_kampagnenart', { typ: 'video', id: v.id, label: videoLabel(v), betrag: volumen });
    }
  });

  // --- 3/8. Kooperations-Pruefungen (Soll/Fakturiert aus koopFakturierung) ---
  const fakturierung = calculateKoopFakturierung({
    kooperationen,
    videos,
    rechnungen,
    kampagnen,
    gueltigeAuftragIds,
  });

  fakturierung.proKoop.forEach(({ id, kampagne_id, soll, fakturiert, rest, anzahlRechnungen }) => {
    // Ohne Rechnung ist "noch nichts fakturiert" der Normalzustand und
    // kein Pflegemangel dieser Anzeige. Entscheidend ist das Vorhandensein
    // einer Rechnung, nicht ihr Betrag (auch eine 0-€-Rechnung zaehlt als
    // angefangene Fakturierung).
    if (!anzahlRechnungen) return;

    const koop = koopById.get(id);
    const gruppe = gruppeFor(kampagne_id || null);
    const unit = unitFor(gruppe, 'kooperation', id);
    const label = koopLabel(koop);

    // Die 50-%-Quote braucht eine positive Fakturierung als Nenner.
    if (fakturiert > 0 && soll < KAUM_ERFASST_QUOTE * fakturiert) {
      unit.fehlerfrei = false;
      addMangel(gruppe, 'koop_kaum_einkauf', {
        typ: 'kooperation',
        id,
        label,
        betrag: fakturiert - soll,
        extra: { fakturiert, erfasst: soll },
      });
    }
    if (rest > 0.005) {
      unit.fehlerfrei = false;
      addMangel(gruppe, 'koop_restbetrag_offen', {
        typ: 'kooperation',
        id,
        label,
        betrag: rest,
        extra: { fakturiert, erfasst: soll },
      });
    }
  });

  // --- 5/6. Auftrags-Pruefungen ---
  auftraege.forEach(a => {
    const bereich = bereichByAuftrag.get(a.id);
    // Contracting braucht keine Kampagnenart-Bloecke.
    if (bereich === 'contracting') return;

    const kampagneIds = kampagnenIdsByAuftrag.get(a.id) || [];
    const ziele = kampagneIds.length > 0 ? kampagneIds : [null];
    ziele.forEach(kampagneId => {
      const gruppe = gruppeFor(kampagneId);
      const unit = unitFor(gruppe, 'auftrag', a.id);
      const detail = { typ: 'auftrag', id: a.id, label: auftragLabel(a), betrag: betrag(a.nettobetrag) };

      if (bereich === 'nicht_zugeordnet') {
        unit.fehlerfrei = false;
        addMangel(gruppe, 'auftrag_ohne_block', detail);
      } else if (bereich === 'gemischt' && blockUmsatzByAuftrag.get(a.id) === 0) {
        unit.fehlerfrei = false;
        addMangel(gruppe, 'gemischt_ohne_umsatz', detail);
      }
    });
  });

  // --- 7. Rechnungs-Pruefung ---
  rechnungen.forEach(r => {
    // Ohne Gestellt-Datum ist die Pruefung nicht anwendbar.
    if (!r.gestellt_am) return;

    const koop = r.kooperation_id ? koopById.get(r.kooperation_id) : null;
    const auftragId = r.auftrag_id
      || (koop?.kampagne_id ? kampagneById.get(koop.kampagne_id)?.auftrag_id : null)
      || null;
    if (auftragId && !gueltigeAuftragIds.has(auftragId)) return;

    let kampagneIds = [];
    if (r.kampagne_id) kampagneIds = [r.kampagne_id];
    else if (koop?.kampagne_id) kampagneIds = [koop.kampagne_id];
    else if (auftragId) kampagneIds = kampagnenIdsByAuftrag.get(auftragId) || [];
    const ziele = kampagneIds.length > 0 ? kampagneIds : [null];

    const jahr = new Date(r.gestellt_am).getFullYear();
    const unplausibel = Number.isFinite(jahr) && jahr < MIN_PLAUSIBLES_JAHR;
    const honorar = betrag(r.nettobetrag) + betrag(r.nettobetrag_steuerfrei);

    ziele.forEach(kampagneId => {
      const gruppe = gruppeFor(kampagneId);
      const unit = unitFor(gruppe, 'rechnung', r.id);
      if (unplausibel) {
        unit.fehlerfrei = false;
        addMangel(gruppe, 'rechnung_unplausibel', {
          typ: 'rechnung',
          id: r.id,
          label: r.rechnung_nr || 'Rechnung',
          betrag: honorar,
          extra: { gestellt_am: r.gestellt_am },
        });
      }
    });
  });

  // --- Finalisieren: Pflegegrad, Maengel-Listen, Sortierung ---
  const gruppenList = [];
  gruppen.forEach(g => {
    g.geprueft = g._units.size;
    g.fehlerfrei = [...g._units.values()].filter(u => u.fehlerfrei).length;
    g.pflegegrad = g.geprueft > 0 ? g.fehlerfrei / g.geprueft : null;
    g.maengel = [...g._maengelByPruefung.values()].sort((a, b) => b.volumen - a.volumen);
    delete g._maengelByPruefung;
    delete g._units;
    // Kampagnen ohne pruefbare Einheiten und ohne Befund sagen nichts aus.
    if (g.geprueft > 0 || g.maengel.length > 0) gruppenList.push(g);
  });

  gruppenList.sort((a, b) =>
    b.volumen - a.volumen
    || (b.maengel.reduce((s, m) => s + m.anzahl, 0) - a.maengel.reduce((s, m) => s + m.anzahl, 0))
    || a.name.localeCompare(b.name)
  );

  return {
    gruppen: gruppenList,
    proPruefung,
    summen: {
      gruppen: gruppenList.length,
      mitMaengeln: gruppenList.filter(g => g.maengel.length > 0).length,
      // Fallsicht (dedupliziert), konsistent mit den Pruefungs-Karten.
      // Die Summe der Gruppen-Volumina kann hoeher liegen, weil ein
      // Auftrags-Befund jeder Kampagne des Auftrags zugeordnet wird.
      maengel: Object.values(proPruefung).reduce((s, p) => s + p.anzahl, 0),
      volumen: Object.values(proPruefung).reduce((s, p) => s + p.volumen, 0),
    },
  };
}
