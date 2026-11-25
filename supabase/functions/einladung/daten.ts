// Einladung und Casting-Eintrag laden, Sperrgründe, Kopfdaten für Maske und Mail.

import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Staff } from '../_shared/zugang/staff.ts';
import { parseEmpfaenger } from './felder.ts';

export type Admin = ReturnType<typeof createClient>;

export const BUCKET = 'einreichung';
export const SITZUNG_TTL_SEC = 60 * 60 * 6;
export const UPLOAD_MAX_PRO_STUNDE = 40;
export const SUBMIT_MAX_PRO_STUNDE = 10;
export const OFFEN_MAX = 50;
export const NACHRICHT_MAX = 500;

export interface EinladungKontext {
  req: Request;
  body: Record<string, unknown>;
  admin: Admin;
  headers: Record<string, string>;
  action: string;
  secret: string | null;
  origin: string;
}

export interface EinladungStaffKontext extends EinladungKontext {
  secret: string;
  staff: Staff;
}

export interface EinladungRow {
  id: string;
  token: string;
  code_hash: string;
  art: 'produkt' | 'briefing' | 'konzept';
  label: string;
  unternehmen_id: string;
  marke_id: string | null;
  produktion_id: string | null;
  briefing_typ: string | null;
  briefing_id: string | null;
  creator_auswahl_item_id: string | null;
  created_by: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export const EINLADUNG_SPALTEN =
  'id, token, code_hash, art, label, unternehmen_id, marke_id, produktion_id, briefing_typ, briefing_id, creator_auswahl_item_id, created_by, expires_at, revoked_at';

export function nutzbar(e: Pick<EinladungRow, 'revoked_at' | 'expires_at'>): string | null {
  if (e.revoked_at) return 'Diese Einladung wurde widerrufen.';
  if (e.expires_at && new Date(e.expires_at).getTime() <= Date.now()) return 'Diese Einladung ist abgelaufen.';
  return null;
}

export interface EintragRow {
  id: string;
  name: string | null;
  kategorie: string | null;
  abgelehnt: boolean | null;
  absage: boolean | null;
  nicht_umsetzen: boolean | null;
  creator_id: string | null;
  link_instagram: string | null;
  email: string | null;
  creator_auswahl: { briefing_id: string | null; kampagne_id: string | null } | null;
}

const EINTRAG_SPALTEN =
  'id, name, kategorie, abgelehnt, absage, nicht_umsetzen, creator_id, link_instagram, email, creator_auswahl:creator_auswahl_id(briefing_id, kampagne_id)';

/** Gate der Konzept-Einladung: weder vom Kunden abgelehnt, noch abgesagt, noch „Nicht umsetzen“. */
export function eintragGesperrt(e: Pick<EintragRow, 'abgelehnt' | 'absage' | 'nicht_umsetzen' | 'kategorie'>): string | null {
  if (e.abgelehnt) return 'Der Kunde hat diesen Eintrag abgelehnt.';
  if (e.absage) return 'Dieser Eintrag ist abgesagt.';
  if (e.nicht_umsetzen || e.kategorie === 'Nicht umsetzen') return 'Dieser Eintrag steht unter „Nicht umsetzen“.';
  return null;
}

export async function ladeEintrag(admin: Admin, id: string): Promise<EintragRow | null> {
  const { data } = await admin.from('creator_auswahl_items').select(EINTRAG_SPALTEN).eq('id', id).maybeSingle();
  return (data as unknown as EintragRow | null) ?? null;
}

/**
 * Konzept-Einladung gilt nur, solange der Eintrag im Casting steht und das Gate erfüllt.
 * Das deckt Creator-Tausch (Eintrag abgesagt) und Löschen (FK SET NULL) ohne Trigger ab.
 */
export async function konzeptGesperrt(admin: Admin, e: EinladungRow): Promise<string | null> {
  if (e.art !== 'konzept') return null;
  if (!e.creator_auswahl_item_id) return 'Der Eintrag ist nicht mehr im Casting. Die Einladung ist nicht mehr gültig.';
  const eintrag = await ladeEintrag(admin, e.creator_auswahl_item_id);
  if (!eintrag) return 'Der Eintrag ist nicht mehr im Casting. Die Einladung ist nicht mehr gültig.';
  const grund = eintragGesperrt(eintrag);
  return grund ? `Die Einladung ist nicht mehr gültig. ${grund}` : null;
}

/**
 * Mailziel eines Eintrags: Mail im Casting-Eintrag (Spalte „E-Mail“, wie im Casting gepflegt),
 * sonst Creator-Mail, sonst Management-Mail der aktiven Zuordnung, sonst keins.
 */
export async function konzeptMailziel(
  admin: Admin,
  creatorId: string | null,
  eintragMail: string | null = null,
): Promise<string | null> {
  const imEintrag = parseEmpfaenger([eintragMail]);
  if (!imEintrag.fehler && imEintrag.emails.length === 1) return imEintrag.emails[0];
  if (!creatorId) return null;
  const { data } = await admin
    .from('creator')
    .select('mail, creator_management(ist_aktiv, management:management_id(email))')
    .eq('id', creatorId)
    .maybeSingle();
  const creator = data as {
    mail?: string | null;
    creator_management?: { ist_aktiv: boolean | null; management: { email: string | null } | null }[];
  } | null;
  if (!creator) return null;
  const direkt = String(creator.mail ?? '').trim().toLowerCase();
  if (direkt) return direkt;
  for (const z of creator.creator_management ?? []) {
    const m = String(z.management?.email ?? '').trim().toLowerCase();
    if (z.ist_aktiv && m) return m;
  }
  return null;
}

export async function ladeEinladung(admin: Admin, token: string): Promise<EinladungRow | null> {
  if (!/^[0-9a-f]{32,}$/i.test(token)) return null;
  const { data } = await admin.from('einladung').select(EINLADUNG_SPALTEN).eq('token', token).maybeSingle();
  return (data as EinladungRow | null) ?? null;
}

export async function kopfdaten(admin: Admin, e: EinladungRow) {
  const { data: firma } = await admin
    .from('unternehmen')
    .select('firmenname')
    .eq('id', e.unternehmen_id)
    .maybeSingle();
  let markenname: string | null = null;
  if (e.marke_id) {
    const { data: marke } = await admin.from('marke').select('markenname').eq('id', e.marke_id).maybeSingle();
    markenname = marke?.markenname ?? null;
  }
  const kopf: {
    firmenname: string | null;
    markenname: string | null;
    eintragName?: string | null;
    eintragHandle?: string | null;
    projektname?: string | null;
  } = { firmenname: firma?.firmenname ?? null, markenname };

  // Konzept-Einladung: Person, Marke und Projektname, sonst nichts (kein Briefing, keine Budgets).
  if (e.art === 'konzept' && e.creator_auswahl_item_id) {
    const eintrag = await ladeEintrag(admin, e.creator_auswahl_item_id);
    kopf.eintragName = eintrag?.name ?? null;
    kopf.eintragHandle = eintrag?.link_instagram ?? null;
    const linieId = e.briefing_id || eintrag?.creator_auswahl?.briefing_id || null;
    if (linieId) {
      const { data: linie } = await admin
        .from('campaign_briefings')
        .select('aktivierung_name')
        .eq('id', linieId)
        .maybeSingle();
      kopf.projektname = linie?.aktivierung_name ?? null;
    }
  }
  return kopf;
}
