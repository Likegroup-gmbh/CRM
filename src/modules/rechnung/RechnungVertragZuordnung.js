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
    .select('id, unterschriebener_vertrag_url, dropbox_file_url, kooperation_id')
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

  // Deterministisch: zuerst den signierten Vertrag der exakten Kooperation bevorzugen,
  // erst danach auf irgendeinen signierten Vertrag der creator+kampagne-Kombination ausweichen.
  const signedForKoop = vertraege.find(v => v.kooperation_id === kooperationId && isSigned(v));
  const anySigned = vertraege.find(v => isSigned(v));
  const matched = signedForKoop || anySigned;

  return {
    ok: true,
    vertragId: matched ? matched.id : null
  };
}

/**
 * Ermittelt, welche Kooperationen fuer Mehrfachrechnungen freigeschaltet sind.
 *
 * Ein Vertrag mit mehrere_rechnungen_erlaubt = true schaltet frei:
 * - direkt seine kooperation_id (primaeres Matching)
 * - als Fallback alle Kooperationen mit gleicher creator_id + kampagne_id
 *   (gleiche Logik wie findSignedVertragForKooperation, da aeltere Vertraege
 *   teils keine kooperation_id gesetzt haben)
 *
 * @param {Array<{id: string, creator_id?: string, kampagne_id?: string}>} kooperationen
 *   Kooperationen die geprueft werden sollen
 * @param {object} [supabase] - optionaler Supabase-Client (default: window.supabase)
 * @returns {Promise<Set<string>>} Set der freigeschalteten Kooperations-IDs
 */
export async function getKooperationIdsMitMehrfachRechnung(kooperationen, supabase) {
  const sb = supabase || window.supabase;
  const result = new Set();
  if (!sb || !kooperationen || kooperationen.length === 0) return result;

  try {
    const { data: vertraege, error } = await sb
      .from('vertraege')
      .select('kooperation_id, creator_id, kampagne_id')
      .eq('mehrere_rechnungen_erlaubt', true)
      .eq('is_draft', false);

    if (error || !vertraege || vertraege.length === 0) {
      if (error) console.warn('getKooperationIdsMitMehrfachRechnung: Abfrage fehlgeschlagen:', error);
      return result;
    }

    const freigeschalteteKoopIds = new Set(
      vertraege.map(v => v.kooperation_id).filter(Boolean)
    );
    const freigeschalteteKombis = new Set(
      vertraege
        .filter(v => v.creator_id && v.kampagne_id)
        .map(v => `${v.creator_id}__${v.kampagne_id}`)
    );

    kooperationen.forEach(k => {
      if (freigeschalteteKoopIds.has(k.id)) {
        result.add(k.id);
      } else if (k.creator_id && k.kampagne_id && freigeschalteteKombis.has(`${k.creator_id}__${k.kampagne_id}`)) {
        result.add(k.id);
      }
    });

    return result;
  } catch (err) {
    console.warn('getKooperationIdsMitMehrfachRechnung: Exception:', err);
    return result;
  }
}

/**
 * Verknuepft nachtraeglich alle Rechnungen mit vertrag_id = NULL, die zur selben
 * creator_id + kampagne_id Kombination gehoeren wie der gerade unterschriebene Vertrag.
 *
 * Wird aufgerufen, nachdem ein Vertrag unterschrieben wurde (via Dropbox oder Supabase Storage).
 * Fixt das Timing-Problem, bei dem eine Rechnung vor der Vertrags-Unterschrift erstellt wurde
 * und dadurch `vertrag_id = NULL` hatte.
 *
 * @param {string} vertragId - ID des unterschriebenen Vertrags
 * @param {string} creatorId - creator_id des Vertrags
 * @param {string} kampagneId - kampagne_id des Vertrags
 * @param {object} [supabase] - optionaler Supabase-Client (default: window.supabase)
 * @returns {Promise<{success: boolean, updatedCount: number, error?: string}>}
 */
export async function backfillRechnungVertragId(vertragId, creatorId, kampagneId, supabase) {
  const sb = supabase || window.supabase;

  if (!vertragId || !creatorId || !kampagneId) {
    return { success: false, updatedCount: 0, error: 'vertragId, creatorId und kampagneId sind erforderlich' };
  }

  try {
    const { data: koops, error: koopError } = await sb
      .from('kooperationen')
      .select('id')
      .eq('creator_id', creatorId)
      .eq('kampagne_id', kampagneId);

    if (koopError) {
      console.warn('backfillRechnungVertragId: Kooperationen-Abfrage fehlgeschlagen:', koopError);
      return { success: false, updatedCount: 0, error: koopError.message || String(koopError) };
    }

    if (!koops || koops.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    const koopIds = koops.map(k => k.id);

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
