// skriptEditorMessages.js
// Pure Helfer fuer die Chat-Message-Liste des Editors: Dedupe nach id,
// Ablauf-Erkennung fuer offene Auftraege und die Liste der "wirklich
// laufenden" Messages. Die DB ist die Wahrheit - der Client darf nie an
// einem lokal zusammengebauten Zustand haengen bleiben.

/** pending = Function hat den Job noch nicht geclaimt (Invoke verloren). */
export const PENDING_TIMEOUT_MS = 45000;
/** running = Claude-Timeout ist 8 min; danach gilt die Function als tot. */
export const RUNNING_TIMEOUT_MS = 12 * 60 * 1000;
/** Ab hier zeigt die Working-Bubble "dauert laenger als ueblich". */
export const LANGSAM_HINWEIS_MS = 60000;
/** Frisch angelegte lokale Rows duerfen im Resync kurz ohne DB-Gegenstueck sein. */
export const RESYNC_GNADENFRIST_MS = 30000;

export const OFFENE_STATUS = ['pending', 'running'];

export function istOffen(m) {
  return OFFENE_STATUS.includes(m?.status);
}

/** Alter der Message in ms; ohne gueltiges created_at null (nie "abgelaufen"). */
export function alterMs(m, jetzt = Date.now()) {
  const t = new Date(m?.created_at || '').getTime();
  return Number.isFinite(t) ? jetzt - t : null;
}

/** Offen und laenger als erlaubt in diesem Status. */
export function istAbgelaufen(m, jetzt = Date.now()) {
  if (!istOffen(m)) return false;
  const alter = alterMs(m, jetzt);
  if (alter === null) return false;
  return alter >= (m.status === 'pending' ? PENDING_TIMEOUT_MS : RUNNING_TIMEOUT_MS);
}

/** Offene Message, die laenger als LANGSAM_HINWEIS_MS laeuft (aber noch nicht abgelaufen ist). */
export function istLangsam(m, jetzt = Date.now()) {
  if (!istOffen(m) || istAbgelaufen(m, jetzt)) return false;
  const alter = alterMs(m, jetzt);
  return alter !== null && alter >= LANGSAM_HINWEIS_MS;
}

/** Fehlertext fuer eine abgelaufene Message (Anzeige und Watchdog teilen ihn). */
export function ablaufFehlertext(m) {
  return m?.status === 'pending'
    ? 'Start fehlgeschlagen – bitte nochmal versuchen.'
    : 'Zeitüberschreitung – bitte nochmal versuchen.';
}

/**
 * Laufende Assistant-Auftraege: offen, nicht abgelaufen, eindeutig nach id.
 * Geister-Kopien und tote Auftraege sperren damit nie die Eingabe.
 */
export function laufendeMessages(messages, jetzt = Date.now()) {
  const gesehen = new Set();
  const liste = [];
  for (const m of messages || []) {
    if (m?.rolle !== 'assistant' || !istOffen(m) || istAbgelaufen(m, jetzt)) continue;
    if (gesehen.has(m.id)) continue;
    gesehen.add(m.id);
    liste.push(m);
  }
  return liste;
}

/**
 * Message einfuegen, falls die id noch fehlt. Existiert sie schon (z.B.
 * kam das Realtime-INSERT vor der HTTP-Antwort), bleibt der vorhandene
 * Eintrag - er kann schon neuer sein als die Insert-Antwort.
 * Liefert den Eintrag, der in der Liste steht.
 */
export function upsertById(messages, row) {
  if (!row) return row;
  const vorhanden = messages.find((m) => m.id === row.id);
  if (vorhanden) return vorhanden;
  messages.push(row);
  return row;
}

/** Doppelte ids entfernen (erste Kopie bleibt). In place, liefert true bei Aenderung. */
export function entdoppeln(messages) {
  const gesehen = new Set();
  let geaendert = false;
  for (let i = 0; i < messages.length; i++) {
    const id = messages[i]?.id;
    if (gesehen.has(id)) {
      messages.splice(i, 1);
      i--;
      geaendert = true;
    } else {
      gesehen.add(id);
    }
  }
  return geaendert;
}
