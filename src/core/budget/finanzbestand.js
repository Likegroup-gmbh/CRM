// finanzbestand.js
// Gemeinsamer Load des Finanzbestands fuer die Admin-Finanzseiten
// (Datenqualitaetsanzeige, Stakeholder-Uebersicht). Beide rechnen gegen
// denselben Bestand — ohne dieses Modul scannt jede Page die Tabellen
// selbst, und ModuleRegistry.destroy() wirft das Ergebnis bei jeder
// Navigation weg.
//
// Interface ist der Bestand, nicht die Tabellenliste: Pages bekommen ein
// Objekt und mappen es auf ihre Felder. Die Selects und die Pagination
// (fetchAllRows) bleiben implementation des Moduls.
//
// Cache auf Modul-Ebene, inkl. In-Flight: ein zweiter Caller wartet auf
// dasselbe Promise statt denselben Scan zu starten. Nicht StaticDataCache
// (24h, Stammdaten) — der Bestand gilt nur innerhalb des Adminbereichs;
// ModuleRegistry.invalidiert ihn, sobald die Route hinausfuehrt.

import { fetchAllRows } from '../fetchAllRows.js';
import { fetchBerichtsstaende } from '../../modules/stakeholder/berichtsstandStore.js';
import { dropTestunternehmenBestand } from './testunternehmen.js';

let cached = null;
let inFlight = null;

// Superset der bisherigen loadData-Selects der beiden Pages. Unterschiede
// sind bewusst: DQ braucht creator und video-Labels (titel, video_name),
// Stakeholder braucht auftrag breit inkl. marke-Join, details, unternehmen,
// teilrechnungen und den Zahlungsstand an rechnung.
const FINANZBESTAND_SELECTS = [
  ['auftrag',
    'id, titel, auftragsname, nettobetrag, bruttobetrag, creator_budget, auftragtype, start, ende, created_at, is_draft, unternehmen_id, marke_id, agency_services_enabled, percentage_fee_enabled, percentage_fee_value, ksk_enabled, ksk_value, rechnung_gestellt_am, ueberwiesen, ueberwiesen_am, re_faelligkeit, marke:marke_id(id, markenname)'],
  ['auftrag_kampagnenart_blocks',
    'id, auftrag_id, campaign_type, campaign_type_label, umsatz_netto, sort_order'],
  ['kampagne',
    'id, kampagnenname, auftrag_id, videoanzahl, creatoranzahl'],
  ['kooperationen',
    'id, kampagne_id, creator_id, videoanzahl, einkaufspreis_netto, verkaufspreis_netto, verkaufspreis_zusatzkosten, ksk_selbstzahler, ksk_betrag'],
  ['kooperation_videos',
    'id, kooperation_id, einkaufspreis_netto, verkaufspreis_netto, kampagnenart, titel, video_name'],
  ['rechnung',
    'id, kooperation_id, auftrag_id, kampagne_id, status, nettobetrag, nettobetrag_steuerfrei, zusatzkosten, gestellt_am, bezahlt_am, zahlungsziel, rechnungstyp, rechnung_nr'],
  ['creator',
    'id, vorname, nachname'],
  ['auftrag_details',
    'auftrag_id, campaign_type, agency_services_enabled, percentage_fee_enabled, percentage_fee_value, ksk_enabled, ksk_value'],
  ['unternehmen',
    'id, firmenname, ist_test'],
  ['auftrag_teilrechnung',
    'id, auftrag_id, nettobetrag, bruttobetrag, rechnung_gestellt, rechnung_gestellt_am, ueberwiesen, ueberwiesen_am, re_faelligkeit'],
];

async function load(supabase) {
  // Berichtsstaende im selben Durchgang statt als Wasserfall danach.
  // Add-on-Charakter bleibt: scheitert die Liste, faellt sie auf [].
  const berichtsstaendePromise = fetchBerichtsstaende(supabase).catch((e) => {
    console.error('❌ Finanzbestand: Berichtsstände konnten nicht geladen werden', e);
    return [];
  });

  const entries = await Promise.all(
    FINANZBESTAND_SELECTS.map(([table, select]) => fetchAllRows(supabase, table, select)),
  );
  const [auftraege, blocks, kampagnen, kooperationen, videos, rechnungen,
    creators, details, unternehmen, teilrechnungen] = entries;
  const berichtsstaende = await berichtsstaendePromise;

  return dropTestunternehmenBestand({
    // Entwuerfe und Testunternehmen werden im Helper gefiltert; die
    // Rechenkerne (Datenqualitaet, Monatsauswertung) erwarten das schon.
    auftraege: auftraege || [],
    blocks: blocks || [],
    kampagnen: kampagnen || [],
    kooperationen: kooperationen || [],
    videos: videos || [],
    rechnungen: rechnungen || [],
    creators: creators || [],
    details: details || [],
    unternehmen: unternehmen || [],
    teilrechnungen: teilrechnungen || [],
    berichtsstaende: berichtsstaende || [],
  });
}

export async function loadFinanzbestand(supabase) {
  if (!supabase) throw new Error('Supabase nicht verfügbar');
  if (cached) return cached;
  if (inFlight) return inFlight;
  inFlight = load(supabase)
    .then((bestand) => {
      cached = bestand;
      return bestand;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function invalidateFinanzbestand() {
  cached = null;
  inFlight = null;
}
