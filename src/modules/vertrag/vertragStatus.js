// Vertrag-Status: Lebenszyklus des PDFs, sitzt an vertraege.status.
// Nicht Kooperation-Status, nicht Finalisiert (is_draft). ADR 0026.

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

const MANUAL = new Set([VERTRAG_STATUS.VERZOEGERT, VERTRAG_STATUS.ABGELEHNT]);
const MANUAL_FROM = new Set([
  VERTRAG_STATUS.ERSTELLT,
  VERTRAG_STATUS.GESENDET,
  VERTRAG_STATUS.VERZOEGERT,
  VERTRAG_STATUS.ABGELEHNT,
]);

export function isSignedVertrag(vertrag) {
  return Boolean(vertrag?.dropbox_file_url || vertrag?.unterschriebener_vertrag_url);
}

export function deriveVertragStatus(vertrag) {
  if (!vertrag) return 'kein_vertrag';
  if (isSignedVertrag(vertrag)) return VERTRAG_STATUS.UNTERSCHRIEBEN;
  if (vertrag.is_draft) return VERTRAG_STATUS.ENTWURF;
  if (vertrag.datei_url) return VERTRAG_STATUS.ERSTELLT;
  return 'kein_vertrag';
}

export function getVertragStatus(vertrag) {
  if (!vertrag) return 'kein_vertrag';
  if (isSignedVertrag(vertrag)) return VERTRAG_STATUS.UNTERSCHRIEBEN;
  const stored = vertrag.status;
  if (stored === VERTRAG_STATUS.UNTERSCHRIEBEN) {
    return deriveVertragStatus(vertrag);
  }
  if (stored && VERTRAG_STATUS_VALUES.includes(stored)) {
    return stored;
  }
  return deriveVertragStatus(vertrag);
}

export function vertragStatusLabel(status) {
  return VERTRAG_STATUS_LABELS[status] || status || '—';
}

export function canEditVertragStatusManually(status) {
  return MANUAL_FROM.has(status);
}

export function manualStatusOptions(status) {
  if (!canEditVertragStatusManually(status)) return [];
  const options = [];
  if (MANUAL.has(status)) {
    options.push({ value: '__zurueck', label: 'Zurück' });
  }
  if (status !== VERTRAG_STATUS.VERZOEGERT) {
    options.push({ value: VERTRAG_STATUS.VERZOEGERT, label: VERTRAG_STATUS_LABELS.verzoegert });
  }
  if (status !== VERTRAG_STATUS.ABGELEHNT) {
    options.push({ value: VERTRAG_STATUS.ABGELEHNT, label: VERTRAG_STATUS_LABELS.abgelehnt });
  }
  return options;
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

export async function fallbackStatusAfterUnsigned(supabase, vertragId) {
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
