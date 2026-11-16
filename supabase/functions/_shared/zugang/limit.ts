// Versuchsbegrenzung für Code-Eingaben und öffentliche Aktionen, pro IP und pro Token.

import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Admin = ReturnType<typeof createClient>;

export const CODE_FENSTER_MIN = 15;
export const CODE_MAX_PRO_IP = 5;
export const CODE_MAX_PRO_TOKEN = 30;

/** Tabelle der Versuche; `aktion` nur, wenn die Tabelle die Spalte hat. */
export interface VersuchsBereich {
  tabelle: 'share_verify_attempts' | 'einladung_verify_attempts';
  spalte: 'share_id' | 'einladung_id';
  aktion?: string;
}

export const SHARE_VERIFY: VersuchsBereich = { tabelle: 'share_verify_attempts', spalte: 'share_id' };

export function einladungBereich(aktion: 'verify' | 'upload' | 'submit'): VersuchsBereich {
  return { tabelle: 'einladung_verify_attempts', spalte: 'einladung_id', aktion };
}

export async function zaehleVersuche(
  admin: Admin,
  bereich: VersuchsBereich,
  id: string,
  seitMinuten: number,
  ip?: string,
): Promise<number> {
  const seit = new Date(Date.now() - seitMinuten * 60 * 1000).toISOString();
  let q = admin
    .from(bereich.tabelle)
    .select('id', { count: 'exact', head: true })
    .eq(bereich.spalte, id)
    .gte('attempted_at', seit);
  if (bereich.aktion) q = q.eq('aktion', bereich.aktion);
  if (ip) q = q.eq('ip', ip);
  const { count } = await q;
  return count ?? 0;
}

/** Merkt den Versuch und räumt Einträge älter als 24 h ab. Gibt die ID des Versuchs zurück. */
export async function merkeVersuch(admin: Admin, bereich: VersuchsBereich, id: string, ip: string): Promise<string | null> {
  const zeile: Record<string, string> = { [bereich.spalte]: id, ip };
  if (bereich.aktion) zeile.aktion = bereich.aktion;
  const { data } = await admin.from(bereich.tabelle).insert(zeile).select('id').maybeSingle();
  await admin
    .from(bereich.tabelle)
    .delete()
    .lt('attempted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  return (data as { id?: string } | null)?.id ?? null;
}

/** Ein richtiger Code zählt nicht gegen das Limit, sonst sperren sich viele Gäste eines Links gegenseitig. */
export async function vergesseVersuch(admin: Admin, bereich: VersuchsBereich, versuchId: string | null) {
  if (!versuchId) return;
  await admin.from(bereich.tabelle).delete().eq('id', versuchId);
}

/** Gesperrt bei zu vielen Versuchen von dieser IP oder insgesamt für dieses Token. */
export async function codeVersucheGesperrt(
  admin: Admin,
  bereich: VersuchsBereich,
  id: string,
  ip: string,
): Promise<boolean> {
  if (await zaehleVersuche(admin, bereich, id, CODE_FENSTER_MIN, ip) >= CODE_MAX_PRO_IP) return true;
  return await zaehleVersuche(admin, bereich, id, CODE_FENSTER_MIN) >= CODE_MAX_PRO_TOKEN;
}
