// Gemeinsames für share-list: Kontext, Listen-Typen, Sperrprüfung, Einladungsmails.

import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { EMAIL_REGEX, sendResendMail } from '../_shared/mail.ts';
import { listenLinkMail } from '../_shared/mail/index.ts';
import type { MailErgebnis } from '../_shared/mail/index.ts';
import { accountListPath } from '../_shared/share-recipients-plan.ts';
import { jsonRes } from '../_shared/zugang/http.ts';
import type { Staff } from '../_shared/zugang/staff.ts';

export type Admin = ReturnType<typeof createClient>;

export interface ShareKontext {
  req: Request;
  body: Record<string, unknown>;
  admin: Admin;
  headers: Record<string, string>;
  action: string;
  secret: string | null;
  origin: string;
}

export interface StaffKontext extends ShareKontext {
  staff: Staff;
}

export interface ShareZeile {
  id: string;
  token: string;
  entity_type: string;
  entity_id: string;
  rechte: string;
  label: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  ends_with_kampagne: boolean;
  code_hash?: string;
}

export const SHARE_SPALTEN = 'id, token, entity_type, entity_id, rechte, label, revoked_at, expires_at, ends_with_kampagne';
export const JWT_TTL_SEC = 60 * 60 * 24 * 30;
export const VORSCHAU_TTL_SEC = 60 * 60;

export const ENTITY_CONFIG: Record<string, { table: string; nameColumns: string[]; label: string; article: string }> = {
  kampagne: { table: 'kampagne', nameColumns: ['eigener_name', 'kampagnenname'], label: 'Kampagne', article: 'die' },
  sourcing: { table: 'creator_auswahl', nameColumns: ['name'], label: 'Sourcing-Liste', article: 'die' },
  strategie: { table: 'strategie', nameColumns: ['name'], label: 'Strategie-Liste', article: 'die' },
  skript: { table: 'skripte', nameColumns: ['titel'], label: 'Skript', article: 'das' },
  skript_paket: { table: 'skript_pakete', nameColumns: ['id'], label: 'Skripte', article: 'die' },
};

export function parseEmails(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  }
  const text = String(raw ?? '').trim();
  if (!text) return [];
  return text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function scriptTitleList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => String(t || '').trim()).filter(Boolean).slice(0, 40);
}

export function creatorAnzeigeName(creator: { vorname?: string | null; nachname?: string | null } | null): string {
  return `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
}

export function gueltigerToken(raw: unknown): string | null {
  const token = String(raw ?? '').trim();
  return token.length >= 32 ? token : null;
}

/** Share per Token, oder die fertige Fehlerantwort (404/500). */
export async function ladeShare(ctx: ShareKontext, token: string, mitHash = false): Promise<ShareZeile | Response> {
  const spalten = mitHash ? `${SHARE_SPALTEN}, code_hash` : SHARE_SPALTEN;
  const { data, error } = await ctx.admin.from('list_shares').select(spalten).eq('token', token).maybeSingle();
  if (error) {
    console.error('share laden fehlgeschlagen:', error);
    return jsonRes({ error: 'Fehler beim Laden.' }, 500, ctx.headers);
  }
  return (data as ShareZeile | null) ?? jsonRes({ valid: false, error: 'Link ungültig.' }, 404, ctx.headers);
}

export function shareAntwort(share: ShareZeile, info: { name: string } | null) {
  return {
    shareId: share.id,
    entityType: share.entity_type,
    entityId: share.entity_id,
    rechte: share.rechte,
    label: share.label,
    entityName: info?.name ?? null,
  };
}

export async function entityName(admin: Admin, entityType: string, entityId: string): Promise<{ name: string; kampagneId: string | null } | null> {
  if (entityType === 'skript_paket') {
    const { data, error } = await admin
      .from('skript_pakete')
      .select('kampagne_id, creator:creator_id(vorname, nachname)')
      .eq('id', entityId)
      .maybeSingle();
    if (error || !data) return null;
    const creatorName = creatorAnzeigeName(data.creator as { vorname?: string | null; nachname?: string | null } | null);
    return {
      name: creatorName ? `Skripte für ${creatorName}` : 'Skripte',
      kampagneId: data.kampagne_id,
    };
  }
  const entityConfig = ENTITY_CONFIG[entityType];
  if (!entityConfig) return null;
  const extra = entityType === 'kampagne' ? '' : ', kampagne_id';
  const { data: entity, error } = await admin
    .from(entityConfig.table)
    .select(`id, ${entityConfig.nameColumns.join(', ')}${extra}`)
    .eq('id', entityId)
    .maybeSingle();
  if (error || !entity) return null;
  const name = entityConfig.nameColumns
    .map((c) => (entity as Record<string, string | null>)[c])
    .find((v) => v && String(v).trim()) || 'Unbenannt';
  const kampagneId = entityType === 'kampagne'
    ? entityId
    : ((entity as { kampagne_id?: string | null }).kampagne_id ?? null);
  return { name, kampagneId };
}

/** Widerrufen, abgelaufen oder mit der Kampagne beendet? Liefert den Grund und die Listen-Infos. */
export async function pruefeShare(admin: Admin, share: ShareZeile): Promise<{
  gesperrt: string | null;
  info: { name: string; kampagneId: string | null } | null;
}> {
  if (share.revoked_at) return { gesperrt: 'Dieser Zugang wurde widerrufen.', info: null };
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
    return { gesperrt: 'Dieser Zugang ist abgelaufen.', info: null };
  }
  const info = await entityName(admin, share.entity_type, share.entity_id);
  if (!share.ends_with_kampagne) return { gesperrt: null, info };
  const kampagneId = info?.kampagneId ?? (share.entity_type === 'kampagne' ? share.entity_id : null);
  if (!kampagneId) return { gesperrt: null, info };
  const { data: isDone } = await admin.rpc('kampagne_is_completed', { p_kampagne_id: kampagneId });
  return {
    gesperrt: isDone === true ? 'Dieser Zugang ist beendet, weil die Kampagne abgeschlossen ist.' : null,
    info,
  };
}

export async function kampagneDisplayName(admin: Admin, kampagneId: string | null): Promise<string | null> {
  if (!kampagneId) return null;
  const { data } = await admin
    .from('kampagne')
    .select('eigener_name, kampagnenname')
    .eq('id', kampagneId)
    .maybeSingle();
  if (!data) return null;
  const eigener = String(data.eigener_name ?? '').trim();
  const name = String(data.kampagnenname ?? '').trim();
  return eigener || name || null;
}

/** `mail` als Funktion, wenn die Mail je Empfänger anders aussieht. Antworten gehen an replyTo (der teilende Mitarbeiter). */
export async function sendInviteMails(params: {
  emails: string[];
  mail: MailErgebnis | ((to: string) => MailErgebnis);
  replyTo?: string | null;
}): Promise<{ sent: number; error?: string }> {
  let sent = 0;
  let lastError = '';
  // Resend lehnt die ganze Mail ab, wenn reply_to kein gültiges Format hat.
  const replyTo = params.replyTo && EMAIL_REGEX.test(params.replyTo) ? params.replyTo : null;
  for (const to of params.emails) {
    const mail = typeof params.mail === 'function' ? params.mail(to) : params.mail;
    const result = await sendResendMail({ to, subject: mail.betreff, html: mail.html, replyTo });
    if (result.ok) sent += 1;
    else lastError = result.error || '';
  }
  return sent === 0 && lastError ? { sent, error: lastError } : { sent };
}

export async function mailAccountLinks(params: {
  emails: string[];
  entityType: string;
  entityId: string;
  entityLabel: string;
  entityArticle: string;
  entityName: string;
  sharedByName: string;
  message?: string;
  replyTo?: string | null;
  origin: string;
}): Promise<{ sent: number; error?: string }> {
  if (params.emails.length === 0) return { sent: 0 };
  const path = accountListPath(params.entityType, params.entityId);
  if (!path) return { sent: 0 };
  return sendInviteMails({
    emails: params.emails,
    replyTo: params.replyTo,
    mail: (to) => listenLinkMail({
      entityLabel: params.entityLabel,
      entityArticle: params.entityArticle,
      entityName: params.entityName,
      url: `${params.origin}${path}`,
      sharedByName: params.sharedByName,
      email: to,
      message: params.message || undefined,
      basisUrl: params.origin,
    }),
  });
}
