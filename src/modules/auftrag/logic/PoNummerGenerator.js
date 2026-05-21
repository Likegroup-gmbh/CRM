// PoNummerGenerator.js
// Reine Helper-Funktionen für die Generierung eindeutiger PO-Nummern.
// Format: PO-Kürzel-Jahr-AufträgeKunde-GesamtPO (z.B. PO-ABC-2025-3-42)

/**
 * Fallback-Methode: Ermittelt die nächste GesamtPO anhand bestehender Daten.
 * Nur korrekt formatierte POs (PO-XXX-JJJJ-N-N) werden berücksichtigt.
 * @returns {Promise<number>} Nächste verfügbare GesamtPO-Nummer
 */
export async function getMaxPoFromExistingData() {
  try {
    const { data: auftraegeMitPo, error } = await window.supabase
      .from('auftrag')
      .select('po')
      .not('po', 'is', null);

    if (error) {
      console.error('❌ Fehler beim Laden der PO-Nummern:', error);
      return 1;
    }

    const poRegex = /^PO-.+-\d{4}-\d+-(\d+)$/;
    let maxGesamtPo = 0;

    for (const auftrag of auftraegeMitPo || []) {
      if (auftrag.po) {
        const match = auftrag.po.match(poRegex);
        if (match) {
          const gesamtPo = parseInt(match[1], 10);
          if (gesamtPo > maxGesamtPo) {
            maxGesamtPo = gesamtPo;
          }
        } else {
          console.warn(`⚠️ Ungültiges PO-Format ignoriert: "${auftrag.po}"`);
        }
      }
    }

    console.log(`📊 Höchste gültige GesamtPO aus Daten: ${maxGesamtPo}`);
    return maxGesamtPo + 1;
  } catch (e) {
    console.error('❌ Fehler bei Fallback PO-Ermittlung:', e);
    return 1;
  }
}

/**
 * Reserviert die globale GesamtPO-Nummer (atomarer DB-Zähler).
 * @returns {Promise<{success: boolean, gesamtPoNummer?: number, error?: string}>}
 */
export async function reservePoGesamtNummer() {
  try {
    const { data: counterData, error: counterError } = await window.supabase
      .rpc('increment_po_counter');

    if (!counterError && counterData) {
      return { success: true, gesamtPoNummer: counterData };
    }

    console.warn('⚠️ DB-Zähler nicht verfügbar, nutze Fallback:', counterError?.message);
    const gesamtPoNummer = await getMaxPoFromExistingData();
    return { success: true, gesamtPoNummer };
  } catch (e) {
    console.error('❌ Fehler bei PO-Reservierung:', e);
    return { success: false, error: 'PO-Nummer konnte nicht reserviert werden.' };
  }
}

/**
 * Baut eine Vorschau-PO vor Unternehmenswahl.
 * @param {number} gesamtPoNummer
 * @returns {string}
 */
export function buildPartialPoPreview(gesamtPoNummer) {
  const currentYear = new Date().getFullYear();
  return `PO-…-${currentYear}-…-${gesamtPoNummer}`;
}

/**
 * Generiert eine PO-Nummer für einen neuen Auftrag.
 * @param {string} unternehmenId - ID des Unternehmens (für Kürzel + Zählung)
 * @param {{ gesamtPoNummer?: number|null }} [options] - Bereits reservierte GesamtPO (kein erneutes Inkrement)
 * @returns {Promise<{success: boolean, poNummer?: string, gesamtPoNummer?: number, error?: string}>}
 */
export async function generatePoNummer(unternehmenId, { gesamtPoNummer = null } = {}) {
  const currentYear = new Date().getFullYear();

  try {
    if (!unternehmenId) {
      return { success: false, error: 'Bitte wählen Sie ein Unternehmen aus.' };
    }

    // 1. Unternehmen mit internem Kürzel laden
    const { data: unternehmen, error: unternehmenError } = await window.supabase
      .from('unternehmen')
      .select('*')
      .eq('id', unternehmenId)
      .single();

    if (unternehmenError || !unternehmen) {
      console.error('❌ Fehler beim Laden des Unternehmens:', unternehmenError);
      return { success: false, error: 'Unternehmen konnte nicht geladen werden.' };
    }

    const kuerzel = unternehmen.internes_kuerzel;
    if (!kuerzel || kuerzel.trim() === '') {
      return {
        success: false,
        error: `Das Unternehmen "${unternehmen.firmenname}" hat kein internes Kürzel. Bitte zuerst das Kürzel beim Unternehmen hinterlegen.`
      };
    }

    // 2. Anzahl der Aufträge dieses Kunden zählen (+1 für den neuen)
    const { count: kundenAuftraegeCount, error: kundenError } = await window.supabase
      .from('auftrag')
      .select('id', { count: 'exact', head: true })
      .eq('unternehmen_id', unternehmenId);

    if (kundenError) {
      console.error('❌ Fehler beim Zählen der Kunden-Aufträge:', kundenError);
      return { success: false, error: 'Kundenaufträge konnten nicht gezählt werden.' };
    }

    const kundenAuftragNummer = (kundenAuftraegeCount || 0) + 1;

    // 3. GesamtPO-Nummer ermitteln (primär via atomarem DB-Zähler, Fallback Regex)
    let resolvedGesamtPoNummer = gesamtPoNummer;
    if (resolvedGesamtPoNummer == null) {
      const reserved = await reservePoGesamtNummer();
      if (!reserved.success) {
        return { success: false, error: reserved.error || 'PO-Nummer konnte nicht reserviert werden.' };
      }
      resolvedGesamtPoNummer = reserved.gesamtPoNummer;
    }

    const poNummer = `PO-${kuerzel.trim()}-${currentYear}-${kundenAuftragNummer}-${resolvedGesamtPoNummer}`;
    console.log(`✅ Neue PO-Nummer generiert: ${poNummer}`);

    return { success: true, poNummer, gesamtPoNummer: resolvedGesamtPoNummer };
  } catch (e) {
    console.error('❌ Fehler bei PO-Nummer Generierung:', e);
    return { success: false, error: 'Ein unerwarteter Fehler bei der PO-Generierung ist aufgetreten.' };
  }
}
