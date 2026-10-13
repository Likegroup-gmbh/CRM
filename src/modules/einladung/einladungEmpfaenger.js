// einladungEmpfaenger.js
// Empfänger der Einladungs-Mail (ADR 0055): Ansprechpartner der Kampagne, des Unternehmens und der Marke
// plus freie Adressen. Creator und Managements gehören nicht dazu, die Einladung geht an den Kunden.

import { loadAnsprechpartnerRows } from '../../core/anschreiben/snapshot.js';

/** Obergrenze pro Versand, gleicher Wert wie in der Edge Function (MAIL_MAX_EMPFAENGER). */
export const MAX_EMPFAENGER = 10;

export function normalisiereEmail(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

export function istGueltigeEmail(raw) {
  const email = normalisiereEmail(raw);
  return email.length <= 320 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email);
}

/** Angehakte Ansprechpartner und freie Adressen zu einer Liste ohne Duplikate. */
export function mergeEmpfaenger(...listen) {
  const out = [];
  for (const liste of listen) {
    for (const raw of liste || []) {
      const email = normalisiereEmail(raw);
      if (email && !out.includes(email)) out.push(email);
    }
  }
  return out;
}

function zeile(ap) {
  const email = String(ap?.email || '').trim();
  const name = [ap?.vorname, ap?.nachname].filter(Boolean).join(' ') || email;
  return { id: ap.id, email, name };
}

async function ladeKampagnenAnsprechpartner(db, kampagneId) {
  if (!kampagneId) return { rows: [], skipped: 0 };
  const { data, error } = await db
    .from('ansprechpartner_kampagne')
    .select('ansprechpartner:ansprechpartner_id(id, vorname, nachname, email)')
    .eq('kampagne_id', kampagneId);
  if (error) throw error;
  const rows = [];
  let skipped = 0;
  const gesehen = new Set();
  for (const eintrag of data || []) {
    const ap = eintrag.ansprechpartner;
    if (!ap?.id || gesehen.has(ap.id)) continue;
    gesehen.add(ap.id);
    if (!istGueltigeEmail(ap.email)) {
      skipped += 1;
      continue;
    }
    rows.push(zeile(ap));
  }
  return { rows, skipped };
}

/**
 * Vorschlagsliste für den Drawer.
 * Gruppe 1: Ansprechpartner der Kampagne. Gruppe 2: die des Unternehmens und der Marke
 * (ohne Treffer aus Gruppe 1). Ansprechpartner ohne gültige Mail zählen nur als `ohneMail`.
 * Ein Ladefehler leert die betroffene Gruppe, der Drawer bleibt benutzbar (freie Adresse).
 */
export async function ladeAnsprechpartnerGruppen(db, { kampagneId = null, unternehmenId = null, markeId = null } = {}) {
  const gruppen = [];
  let ohneMail = 0;
  const belegt = new Set();

  try {
    const kampagne = await ladeKampagnenAnsprechpartner(db, kampagneId);
    kampagne.rows.forEach((row) => belegt.add(normalisiereEmail(row.email)));
    ohneMail += kampagne.skipped;
    if (kampagne.rows.length) gruppen.push({ id: 'kampagne', titel: 'Kampagne', rows: kampagne.rows });
  } catch (err) {
    console.warn('Ansprechpartner der Kampagne nicht geladen:', err);
  }

  if (unternehmenId || markeId) {
    try {
      const stamm = await loadAnsprechpartnerRows(db, { unternehmenId, markeId });
      ohneMail += stamm.skipped;
      const rows = stamm.rows
        .filter((row) => !belegt.has(normalisiereEmail(row.email)))
        .map((row) => ({ id: row.id, email: row.email, name: row.name }));
      if (rows.length) {
        gruppen.push({ id: 'stamm', titel: markeId ? 'Unternehmen und Marke' : 'Unternehmen', rows });
      }
    } catch (err) {
      console.warn('Ansprechpartner von Unternehmen/Marke nicht geladen:', err);
    }
  }

  return { gruppen, ohneMail };
}
