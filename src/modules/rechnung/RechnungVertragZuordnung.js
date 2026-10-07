// Rechnung <-> Vertrag. Eine Rechnung laeuft nur ueber die explizite Bindung auf einen Vertrag:
// die Kooperation ist von ihm gedeckt (vertrag_kooperation, ADR 0047). Ein Vertrag derselben
// Kampagne und desselben Creators, der die Kooperation nicht deckt, zaehlt nicht.

/**
 * Prueft, ob die Kooperation abrechenbar ist (es gibt einen finalen Vertrag fuer Creator
 * und Kampagne) und liefert den unterschriebenen Vertrag, der sie deckt.
 * vertragId ist null, wenn kein gedeckter, unterschriebener Vertrag existiert.
 */
export async function findSignedVertragForKooperation(kooperationId, supabase) {
  const sb = supabase || window.supabase;

  const { data: koop, error: koopError } = await sb
    .from('kooperationen')
    .select('id, creator_id, kampagne_id')
    .eq('id', kooperationId)
    .single();

  if (koopError || !koop) {
    return { ok: false, message: 'Die ausgewaehlte Kooperation konnte nicht geladen werden.', vertragId: null };
  }

  if (!koop.creator_id || !koop.kampagne_id) {
    return { ok: false, message: 'Die Kooperation ist unvollstaendig (Creator oder Kampagne fehlt).', vertragId: null };
  }

  const { data: vertraege, error: vertragError } = await sb
    .from('vertraege')
    .select('id, status, unterschriebener_vertrag_url, dropbox_file_url, kooperation_id, vertrag_kooperation(kooperation_id)')
    .eq('creator_id', koop.creator_id)
    .eq('kampagne_id', koop.kampagne_id)
    .eq('is_draft', false);

  if (vertragError) {
    return { ok: false, message: 'Vertrag konnte nicht geprueft werden. Bitte erneut versuchen.', vertragId: null };
  }

  if (!vertraege || vertraege.length === 0) {
    return { ok: false, message: 'Vor der Rechnung muss ein finaler Vertrag angelegt werden.', vertragId: null };
  }

  const isSigned = (v) => v.unterschriebener_vertrag_url || v.dropbox_file_url;
  const deckt = (v) => v.status !== 'abgelehnt' && (
    (v.vertrag_kooperation || []).some((r) => r.kooperation_id === kooperationId)
    || v.kooperation_id === kooperationId
  );

  const matched = vertraege.find((v) => deckt(v) && isSigned(v));

  return {
    ok: true,
    vertragId: matched ? matched.id : null
  };
}

// getKooperationIdsMitMehrfachRechnung ist mit ADR 0004/0015 entfallen:
// die Freigabe weiterer Rechnungen ergibt sich aus dem Restbetrag
// (calculateKoopAbrechenbarkeit), nicht mehr aus vertraege.mehrere_rechnungen_erlaubt.

/**
 * Verknuepft nachtraeglich alle Rechnungen mit vertrag_id = NULL, die zu einer Kooperation
 * gehoeren, die der gerade unterschriebene Vertrag deckt.
 *
 * Wird aufgerufen, nachdem ein Vertrag unterschrieben wurde (via Dropbox oder Supabase Storage).
 * Fixt das Timing-Problem, bei dem eine Rechnung vor der Vertrags-Unterschrift erstellt wurde
 * und dadurch `vertrag_id = NULL` hatte. Kooperationen, die der Vertrag nicht deckt, bekommen
 * ihn nicht, auch wenn Creator und Kampagne gleich sind.
 *
 * @param {string} vertragId - ID des unterschriebenen Vertrags
 * @param {object} [supabase] - optionaler Supabase-Client (default: window.supabase)
 * @returns {Promise<{success: boolean, updatedCount: number, error?: string}>}
 */
export async function backfillRechnungVertragId(vertragId, supabase) {
  const sb = supabase || window.supabase;

  if (!vertragId) {
    return { success: false, updatedCount: 0, error: 'vertragId ist erforderlich' };
  }

  try {
    const [junction, erzeuger] = await Promise.all([
      sb.from('vertrag_kooperation').select('kooperation_id').eq('vertrag_id', vertragId),
      sb.from('vertraege').select('kooperation_id').eq('id', vertragId)
    ]);

    const fehler = junction.error || erzeuger.error;
    if (fehler) {
      console.warn('backfillRechnungVertragId: Kooperationen-Abfrage fehlgeschlagen:', fehler);
      return { success: false, updatedCount: 0, error: fehler.message || String(fehler) };
    }

    const koopIds = [...new Set([
      ...(junction.data || []).map((r) => r.kooperation_id),
      ...(erzeuger.data || []).map((r) => r.kooperation_id)
    ].filter(Boolean))];

    if (koopIds.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    const { data: updated, error: updateError } = await sb
      .from('rechnung')
      .update({ vertrag_id: vertragId })
      .is('vertrag_id', null)
      .in('kooperation_id', koopIds)
      .select('id');

    if (updateError) {
      console.warn('backfillRechnungVertragId: Update fehlgeschlagen:', updateError);
      return { success: false, updatedCount: 0, error: updateError.message || String(updateError) };
    }

    const updatedCount = updated?.length || 0;
    if (updatedCount > 0) {
      console.log(`backfillRechnungVertragId: ${updatedCount} Rechnung(en) mit vertrag_id=${vertragId} verknuepft`);
    }

    return { success: true, updatedCount };
  } catch (err) {
    console.warn('backfillRechnungVertragId: Exception:', err);
    return { success: false, updatedCount: 0, error: err.message || String(err) };
  }
}
