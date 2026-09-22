// Vertrag-Status: Lebenszyklus des PDFs, sitzt an vertraege.status.
// Nicht Kooperation-Status, nicht Finalisiert (is_draft). ADR 0026.
// Wird nicht manuell gesetzt. Verzögert: 30 Tage nach Anschreiben ohne Unterschrift.

export const VERTRAG_STATUS = Object.freeze({
  ENTWURF: 'entwurf',
  ERSTELLT: 'erstellt',
  GESENDET: 'gesendet',
  UNTERSCHRIEBEN: 'unterschrieben',
  VERZOEGERT: 'verzoegert',
  ABGELEHNT: 'abgelehnt',
});

export const VERTRAG_STATUS_LABELS = Object.freeze({
  entwurf: 'Entwurf',
  erstellt: 'Erstellt',
  gesendet: 'Gesendet',
  unterschrieben: 'Unterschrieben',
  verzoegert: 'Verzögert',
  abgelehnt: 'Abgelehnt',
});

export const VERTRAG_STATUS_VALUES = Object.freeze(Object.values(VERTRAG_STATUS));

export const VERZOEGERT_NACH_TAGE = 30;
export const VERZOEGERT_NACH_MS = VERZOEGERT_NACH_TAGE * 24 * 60 * 60 * 1000;

export function isSignedVertrag(vertrag) {
  return Boolean(vertrag?.dropbox_file_url || vertrag?.unterschriebener_vertrag_url);
}

export function gesendetUeberfaelligSeit(now = Date.now()) {
  return new Date(now - VERZOEGERT_NACH_MS).toISOString();
}

export function isGesendetUeberfaellig(gesendetAm, now = Date.now()) {
  if (!gesendetAm) return false;
  const t = new Date(gesendetAm).getTime();
  if (Number.isNaN(t)) return false;
  return now - t >= VERZOEGERT_NACH_MS;
}

export function shouldPersistVerzoegert(vertrag, now = Date.now()) {
  if (!vertrag) return false;
  if (isSignedVertrag(vertrag)) return false;
  if (vertrag.status !== VERTRAG_STATUS.GESENDET) return false;
  return isGesendetUeberfaellig(vertrag.gesendet_am, now);
}

export function deriveVertragStatus(vertrag) {
  if (!vertrag) return 'kein_vertrag';
  if (isSignedVertrag(vertrag)) return VERTRAG_STATUS.UNTERSCHRIEBEN;
  if (vertrag.is_draft) return VERTRAG_STATUS.ENTWURF;
  if (vertrag.datei_url) return VERTRAG_STATUS.ERSTELLT;
  return 'kein_vertrag';
}

export function getVertragStatus(vertrag, now = Date.now()) {
  if (!vertrag) return 'kein_vertrag';
  if (isSignedVertrag(vertrag)) return VERTRAG_STATUS.UNTERSCHRIEBEN;
  const stored = vertrag.status;
  if (stored === VERTRAG_STATUS.UNTERSCHRIEBEN) {
    return deriveVertragStatus(vertrag);
  }
  if (stored === VERTRAG_STATUS.GESENDET && isGesendetUeberfaellig(vertrag.gesendet_am, now)) {
    return VERTRAG_STATUS.VERZOEGERT;
  }
  if (stored && VERTRAG_STATUS_VALUES.includes(stored)) {
    return stored;
  }
  return deriveVertragStatus(vertrag);
}

export function vertragStatusLabel(status) {
  return VERTRAG_STATUS_LABELS[status] || status || '—';
}

export function applyVertragStatusFilter(query, status, now = Date.now()) {
  if (!query || !status) return query;
  if (status === VERTRAG_STATUS.GESENDET) {
    const cutoff = gesendetUeberfaelligSeit(now);
    return query
      .eq('status', VERTRAG_STATUS.GESENDET)
      .or(`gesendet_am.is.null,gesendet_am.gt."${cutoff}"`);
  }
  if (status === VERTRAG_STATUS.VERZOEGERT) {
    const cutoff = gesendetUeberfaelligSeit(now);
    return query.or(
      `status.eq.verzoegert,and(status.eq.gesendet,gesendet_am.lte."${cutoff}",dropbox_file_url.is.null,unterschriebener_vertrag_url.is.null)`
    );
  }
  return query.eq('status', status);
}

export async function hasGesendetesAnschreiben(supabase, vertragId) {
  if (!supabase || !vertragId) return false;
  const { data, error } = await supabase
    .from('anschreiben_log')
    .select('id')
    .eq('dokument_typ', 'vertrag')
    .eq('dokument_id', vertragId)
    .eq('status', 'sent')
    .limit(1);
  if (error) {
    console.warn('anschreiben_log Lookup fehlgeschlagen:', error);
    return false;
  }
  return Boolean(data?.length);
}

export async function fallbackStatusAfterUnsigned(supabase, vertragId, now = Date.now()) {
  if (!supabase || !vertragId) return VERTRAG_STATUS.ERSTELLT;
  const { data, error } = await supabase
    .from('vertraege')
    .select('gesendet_am')
    .eq('id', vertragId)
    .maybeSingle();
  if (error) {
    console.warn('gesendet_am Lookup fehlgeschlagen:', error);
  } else if (data?.gesendet_am) {
    return isGesendetUeberfaellig(data.gesendet_am, now)
      ? VERTRAG_STATUS.VERZOEGERT
      : VERTRAG_STATUS.GESENDET;
  }
  const sent = await hasGesendetesAnschreiben(supabase, vertragId);
  return sent ? VERTRAG_STATUS.GESENDET : VERTRAG_STATUS.ERSTELLT;
}

export function statusOnFinalize(current) {
  if (current === VERTRAG_STATUS.UNTERSCHRIEBEN
    || current === VERTRAG_STATUS.GESENDET
    || current === VERTRAG_STATUS.VERZOEGERT
    || current === VERTRAG_STATUS.ABGELEHNT) {
    return current;
  }
  return VERTRAG_STATUS.ERSTELLT;
}
