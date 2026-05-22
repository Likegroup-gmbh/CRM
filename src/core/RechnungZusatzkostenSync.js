/**
 * RechnungZusatzkostenSync.js
 *
 * Synchronisiert rechnung.zusatzkosten -> kooperationen (EK + VK).
 * Rechnung = Source of Truth: jeder Save ueberschreibt EK + VK in der Kooperation.
 * USt/Gesamt werden jeweils konsistent neu berechnet.
 *
 * Backfill: supabase/migrations/20260522_backfill_koop_zusatzkosten_from_rechnung.sql
 */

const VK_UST_SATZ_DEFAULT = 19;

function deriveEkUstSatz({ ustProzent, koop }) {
  const direct = parseFloat(ustProzent);
  if (Number.isFinite(direct) && direct >= 0) {
    return direct;
  }

  const koopNetto = parseFloat(koop?.einkaufspreis_netto) || 0;
  const koopUst = parseFloat(koop?.einkaufspreis_ust);
  if (koopNetto > 0 && Number.isFinite(koopUst)) {
    return (koopUst / koopNetto) * 100;
  }

  return VK_UST_SATZ_DEFAULT;
}

function deriveVkUstSatz(koop) {
  const koopNetto = parseFloat(koop?.verkaufspreis_netto) || 0;
  const koopUst = parseFloat(koop?.verkaufspreis_ust);
  if (koopNetto > 0 && Number.isFinite(koopUst)) {
    return (koopUst / koopNetto) * 100;
  }

  return VK_UST_SATZ_DEFAULT;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function calcPreisBlock(netto, zusatz, ustSatz) {
  const ustRate = (ustSatz || 0) / 100;
  const ust = round2((netto + zusatz) * ustRate);
  const gesamt = round2(netto + zusatz + ust);
  return { zusatz, ust, gesamt, ustSatz };
}

function parseZusatzkosten(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function dispatchKooperationUpdated(kooperationId, rechnungId) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('entityUpdated', {
    detail: {
      entity: 'kooperation',
      id: kooperationId,
      action: 'updated',
      source: 'rechnung_zusatzkosten_sync',
      rechnungId,
    },
  }));
}

async function applyKooperationUpdate(supabase, kooperationId, payload, label) {
  const { data, error } = await supabase
    .from('kooperationen')
    .update(payload)
    .eq('id', kooperationId)
    .select('id, einkaufspreis_zusatzkosten, verkaufspreis_zusatzkosten')
    .single();

  if (error) {
    console.warn(`Zusatzkosten-Sync (${label}): Update fehlgeschlagen:`, error);
    return { success: false, error: error.message || String(error) };
  }

  return { success: true, data };
}

/**
 * Laedt die gespeicherte Rechnung und synchronisiert Zusatzkosten zur Kooperation.
 */
export async function syncEkZusatzkostenFromRechnungId(rechnungId, { supabase: sb } = {}) {
  if (!rechnungId) {
    return { success: false, error: 'Keine rechnungId' };
  }

  const supabase = sb || (typeof window !== 'undefined' ? window.supabase : null);
  if (!supabase) {
    return { success: false, error: 'Kein Supabase-Client verfuegbar' };
  }

  const { data: rechnung, error } = await supabase
    .from('rechnung')
    .select('id, kooperation_id, zusatzkosten, ust_prozent')
    .eq('id', rechnungId)
    .single();

  if (error) {
    console.warn('Zusatzkosten-Sync: Rechnung laden fehlgeschlagen:', error);
    return { success: false, error: error.message || String(error) };
  }

  return syncEkZusatzkostenFromRechnung({
    kooperationId: rechnung?.kooperation_id,
    zusatzkosten: rechnung?.zusatzkosten,
    ustProzent: rechnung?.ust_prozent,
    supabase,
    rechnungId,
  });
}

export async function syncEkZusatzkostenFromRechnung({
  kooperationId,
  zusatzkosten,
  ustProzent,
  supabase: sb,
  rechnungId = null,
} = {}) {
  if (!kooperationId) {
    return { success: false, error: 'Keine kooperationId' };
  }

  const zusatz = parseZusatzkosten(zusatzkosten);
  if (zusatz <= 0) {
    return { success: true, skipped: 'no_zusatzkosten' };
  }

  const supabase = sb || (typeof window !== 'undefined' ? window.supabase : null);
  if (!supabase) {
    return { success: false, error: 'Kein Supabase-Client verfuegbar' };
  }

  try {
    const { data: koop, error: loadErr } = await supabase
      .from('kooperationen')
      .select(
        'id, einkaufspreis_netto, einkaufspreis_zusatzkosten, einkaufspreis_ust, verkaufspreis_netto, verkaufspreis_zusatzkosten, verkaufspreis_ust'
      )
      .eq('id', kooperationId)
      .single();

    if (loadErr) {
      console.warn('Zusatzkosten-Sync: Kooperation laden fehlgeschlagen:', loadErr);
      return { success: false, error: loadErr.message || String(loadErr) };
    }

    const updated = {};
    const updatedSides = [];
    let lastError = null;

    // EK immer ueberschreiben (Rechnung ist Source of Truth)
    const ekNetto = parseFloat(koop?.einkaufspreis_netto) || 0;
    const ek = calcPreisBlock(ekNetto, zusatz, deriveEkUstSatz({ ustProzent, koop }));
    const ekResult = await applyKooperationUpdate(supabase, kooperationId, {
      einkaufspreis_zusatzkosten: ek.zusatz,
      einkaufspreis_ust: ek.ust,
      einkaufspreis_gesamt: ek.gesamt,
    }, 'EK');

    if (!ekResult.success) {
      lastError = ekResult.error;
    } else {
      updatedSides.push('ek');
      Object.assign(updated, {
        einkaufspreis_zusatzkosten: ek.zusatz,
        einkaufspreis_ust: ek.ust,
        einkaufspreis_gesamt: ek.gesamt,
        ek_ust_satz: ek.ustSatz,
      });
    }

    // VK immer separat schreiben, damit ein EK-Fehler VK nicht blockiert
    const vkNetto = parseFloat(koop?.verkaufspreis_netto) || 0;
    const vk = calcPreisBlock(vkNetto, zusatz, deriveVkUstSatz(koop));
    const vkResult = await applyKooperationUpdate(supabase, kooperationId, {
      verkaufspreis_zusatzkosten: vk.zusatz,
      verkaufspreis_ust: vk.ust,
      verkaufspreis_gesamt: vk.gesamt,
    }, 'VK');

    if (!vkResult.success) {
      lastError = lastError || vkResult.error;
    } else {
      updatedSides.push('vk');
      Object.assign(updated, {
        verkaufspreis_zusatzkosten: vk.zusatz,
        verkaufspreis_ust: vk.ust,
        verkaufspreis_gesamt: vk.gesamt,
        vk_ust_satz: vk.ustSatz,
      });

      if (vkResult.data?.verkaufspreis_zusatzkosten == null) {
        console.warn('Zusatzkosten-Sync (VK): Update ohne Fehler, aber verkaufspreis_zusatzkosten weiterhin null', vkResult.data);
        lastError = lastError || 'VK-Zusatzkosten nach Update weiterhin leer';
      }
    }

    if (updatedSides.length === 0) {
      return { success: false, error: lastError || 'Kein Feld aktualisiert' };
    }

    dispatchKooperationUpdated(kooperationId, rechnungId);

    return {
      success: true,
      updated,
      updatedSides,
      partial: Boolean(lastError),
      warning: lastError || null,
    };
  } catch (err) {
    console.warn('Zusatzkosten-Sync Exception:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/** Nach Rechnung-Save: Sync aus DB + sichtbares Feedback. */
export async function syncEkZusatzkostenAfterRechnungSave(rechnungId, { supabase: sb } = {}) {
  const result = await syncEkZusatzkostenFromRechnungId(rechnungId, { supabase: sb });

  if (result.success && result.updated) {
    const sides = (result.updatedSides || []).join(' + ').toUpperCase() || 'EK/VK';
    console.log(`Zusatzkosten-Sync: Kooperation aktualisiert (${sides})`, result.updated);

    if (typeof window !== 'undefined') {
      if (result.partial) {
        window.toastSystem?.show?.(
          `Zusatzkosten teilweise übernommen (${sides}). Bitte Konsole prüfen: ${result.warning}`,
          'warning'
        );
      } else {
        window.toastSystem?.show?.(
          `Zusatzkosten in Kooperation übernommen (${sides})`,
          'success'
        );
      }
    }
    return result;
  }

  if (result.skipped) {
    console.log('Zusatzkosten-Sync uebersprungen:', result.skipped);
    return result;
  }

  if (!result.success) {
    const rawError = result.error || 'Unbekannter Fehler';
    const looksLikeRls = /permission|denied|policy|JSON object requested|0 rows|PGRST116/i.test(rawError);
    const hint = looksLikeRls
      ? ' (moeglicherweise fehlt UPDATE-Permission/RLS auf kooperationen)'
      : '';
    console.warn('Zusatzkosten-Sync fehlgeschlagen:', rawError, hint);
    if (typeof window !== 'undefined') {
      window.toastSystem?.show?.(
        `Rechnung gespeichert, aber Zusatzkosten konnten nicht in die Kooperation übernommen werden: ${rawError}${hint}`,
        'warning'
      );
    }
  }

  return result;
}
