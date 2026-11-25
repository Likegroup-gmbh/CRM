// Sieht ein Mitarbeiterkonto die Liste im eigenen Konto? Folgt den SELECT-Policies der Listen.
// Nur wer sie sieht, bekommt den Link ins Konto; die anderen gehen als Gast wie ein Externer.

import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Admin = ReturnType<typeof createClient>;

export type StaffRow = { id: string; rolle: string; auth_user_id: string | null };

/** creator_auswahl und strategie: is_admin_or_mitarbeiter() sieht alles. */
const FUER_ALLE_MITARBEITER = new Set(['sourcing', 'strategie']);

async function zeile(admin: Admin, table: string, id: string, columns: string) {
  const { data, error } = await admin.from(table).select(columns).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Record<string, string | null> | null;
}

async function zugeordnet(admin: Admin, table: string, column: string, value: string | null, ids: string[]): Promise<string[]> {
  if (!value || ids.length === 0) return [];
  const { data, error } = await admin.from(table).select('mitarbeiter_id').eq(column, value).in('mitarbeiter_id', ids);
  if (error) throw error;
  return (data || []).map((row: { mitarbeiter_id: string }) => row.mitarbeiter_id);
}

/** kampagne_select_policy: Unternehmen, Marke oder Kampagne direkt zugeordnet. */
async function kampagneSichtbar(admin: Admin, kampagneId: string, ids: string[]): Promise<Set<string>> {
  const kampagne = await zeile(admin, 'kampagne', kampagneId, 'unternehmen_id, marke_id');
  if (!kampagne) return new Set();
  const treffer = await Promise.all([
    zugeordnet(admin, 'kampagne_mitarbeiter', 'kampagne_id', kampagneId, ids),
    zugeordnet(admin, 'marke_mitarbeiter', 'marke_id', kampagne.marke_id, ids),
    zugeordnet(admin, 'mitarbeiter_unternehmen', 'unternehmen_id', kampagne.unternehmen_id, ids),
  ]);
  return new Set(treffer.flat());
}

/** skripte_select: dieselbe Funktion, die die RLS aufruft, nur mit der auth_user_id des Empfängers. */
async function skriptSichtbar(admin: Admin, skriptId: string, staff: StaffRow[]): Promise<Set<string>> {
  const skript = await zeile(admin, 'skripte', skriptId, 'unternehmen_id, marke_id, kampagne_id, created_by');
  if (!skript) return new Set();
  const sichtbar = new Set<string>();
  for (const row of staff) {
    if (!row.auth_user_id) continue;
    const { data, error } = await admin.rpc('can_mitarbeiter_access_skript_for', {
      p_auth_user_id: row.auth_user_id,
      p_unternehmen_id: skript.unternehmen_id,
      p_marke_id: skript.marke_id,
      p_kampagne_id: skript.kampagne_id,
      p_created_by: skript.created_by,
    });
    if (error) throw error;
    if (data === true) sichtbar.add(row.id);
  }
  return sichtbar;
}

/** benutzer.id → sieht die Liste. Skript-Pakete haben keine Kontoansicht. */
export async function staffVisibility(
  admin: Admin,
  staff: StaffRow[],
  entityType: string,
  entityId: string,
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  const mitarbeiter: StaffRow[] = [];
  for (const row of staff) {
    if (row.rolle === 'admin') result[row.id] = entityType !== 'skript_paket';
    else mitarbeiter.push(row);
  }
  if (mitarbeiter.length === 0) return result;

  let sichtbar = new Set<string>();
  if (FUER_ALLE_MITARBEITER.has(entityType)) sichtbar = new Set(mitarbeiter.map((row) => row.id));
  else if (entityType === 'kampagne') sichtbar = await kampagneSichtbar(admin, entityId, mitarbeiter.map((row) => row.id));
  else if (entityType === 'skript') sichtbar = await skriptSichtbar(admin, entityId, mitarbeiter);

  for (const row of mitarbeiter) result[row.id] = sichtbar.has(row.id);
  return result;
}
