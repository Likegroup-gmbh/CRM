// Hilfen für share-list: Token, Gast-JWT, Einladungsmails.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendResendMail } from '../_shared/mail.ts';
import type { MailErgebnis } from '../_shared/mail/index.ts';
import {
  accountLinkMail,
  accountListPath,
} from '../_shared/share-recipients.ts';

export const VERIFY_WINDOW_MIN = 15;
export const VERIFY_MAX_ATTEMPTS = 5;
export const JWT_TTL_SEC = 60 * 60 * 24 * 30;

export const ENTITY_CONFIG: Record<string, { table: string; nameColumns: string[]; label: string; article: string }> = {
  kampagne: { table: 'kampagne', nameColumns: ['eigener_name', 'kampagnenname'], label: 'Kampagne', article: 'die' },
  sourcing: { table: 'creator_auswahl', nameColumns: ['name'], label: 'Sourcing-Liste', article: 'die' },
  strategie: { table: 'strategie', nameColumns: ['name'], label: 'Strategie-Liste', article: 'die' },
  skript: { table: 'skripte', nameColumns: ['titel'], label: 'Skript', article: 'das' },
  skript_paket: { table: 'skript_pakete', nameColumns: ['id'], label: 'Skripte', article: 'die' },
};

export function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function jsonRes(data: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const n = new DataView(bytes.buffer).getUint32(0) % 1_000_000;
  return String(n).padStart(6, '0');
}

export function jwtSecret(): string | null {
  return Deno.env.get('JWT_SECRET')
    || Deno.env.get('SUPABASE_JWT_SECRET')
    || Deno.env.get('GUEST_JWT_SECRET')
    || null;
}

export function b64url(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashCode(code: string, secret: string): Promise<string> {
  return sha256Hex(`share-code:${secret}:${code}`);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signGuestJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${b64url(sig)}`;
}

export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '')
    .split(',')[0]
    .trim()
    .slice(0, 64);
}

export function parseEmails(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  }
  const text = String(raw ?? '').trim();
  if (!text) return [];
  return text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export async function requireStaff(admin: ReturnType<typeof createClient>, req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return { error: jsonRes({ error: 'Nicht autorisiert.' }, 401, corsHeaders(req)) };
  const { data: { user: authUser }, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !authUser) return { error: jsonRes({ error: 'Nicht autorisiert.' }, 401, corsHeaders(req)) };

  const { data: staff } = await admin
    .from('benutzer')
    .select('id, name, rolle')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (!staff || !['admin', 'mitarbeiter'].includes(staff.rolle)) {
    return { error: jsonRes({ error: 'Nur Mitarbeiter können Listen teilen.' }, 403, corsHeaders(req)) };
  }
  return { staff };
}

export function shareIsUsable(share: {
  revoked_at: string | null;
  expires_at: string | null;
}): string | null {
  if (share.revoked_at) return 'Dieser Zugang wurde widerrufen.';
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
    return 'Dieser Zugang ist abgelaufen.';
  }
  return null;
}

export function scriptTitleList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => String(t || '').trim()).filter(Boolean).slice(0, 40);
}

export function creatorAnzeigeName(creator: { vorname?: string | null; nachname?: string | null } | null): string {
  return `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
}

export async function entityName(admin: ReturnType<typeof createClient>, entityType: string, entityId: string): Promise<{ name: string; kampagneId: string | null } | null> {
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

export async function kampagneDisplayName(
  admin: ReturnType<typeof createClient>,
  kampagneId: string | null,
): Promise<string | null> {
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

export async function sendInviteMails(params: {
  emails: string[];
  mail: MailErgebnis;
}): Promise<{ sent: number; error?: string }> {
  let sent = 0;
  let lastError = '';
  for (const to of params.emails) {
    const result = await sendResendMail({ to, subject: params.mail.betreff, html: params.mail.html });
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
  entityName: string;
  sharedByName: string;
  origin: string;
}): Promise<{ sent: number; error?: string }> {
  if (params.emails.length === 0) return { sent: 0 };
  const path = accountListPath(params.entityType, params.entityId);
  if (!path) return { sent: 0 };
  return sendInviteMails({
    emails: params.emails,
    mail: accountLinkMail({
      entityLabel: params.entityLabel,
      entityName: params.entityName,
      url: `${params.origin}${path}`,
      sharedByName: params.sharedByName,
    }),
  });
}
