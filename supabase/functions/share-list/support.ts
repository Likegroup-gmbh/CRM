// Hilfen für share-list: Token, Gast-JWT, Einladungsmails.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  accountLinkMail,
  accountListPath,
} from '../_shared/share-recipients.ts';

export const RESEND_API_URL = 'https://api.resend.com/emails';
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

export const FROM_DISPLAY = 'LikeGroup';
export const FROM_LOCAL = 'hello';

export function rewriteFromAddress(addr: string): string {
  return addr.replace(/^noreply@/i, `${FROM_LOCAL}@`);
}

export function normalizeFromEmail(raw: string | undefined): string {
  const fallback = `${FROM_DISPLAY} <onboarding@resend.dev>`;
  let value = (raw ?? '').trim().replace(/^["']+|["']+$/g, '').trim();
  if (!value) return fallback;
  const nameAddr = value.match(/^(.*)<\s*([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)\s*>$/);
  if (nameAddr) {
    let name = nameAddr[1].trim().replace(/^["']+|["']+$/g, '').trim();
    if (!name || /^CreatorJobs24$/i.test(name)) name = FROM_DISPLAY;
    return `${name} <${rewriteFromAddress(nameAddr[2])}>`;
  }
  if (EMAIL_REGEX.test(value)) return `${FROM_DISPLAY} <${rewriteFromAddress(value)}>`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return `${FROM_DISPLAY} <${FROM_LOCAL}@${value}>`;
  console.error(`SHARE_FROM_EMAIL hat ungültiges Format: "${raw}" — Fallback auf ${fallback}`);
  return fallback;
}

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

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

export function buildInviteEmail(params: {
  entityLabel: string;
  entityArticle: string;
  entityName: string;
  sharedByName: string;
  rechte: string;
  link: string;
  code: string;
  message?: string;
}): string {
  const article = params.entityArticle || 'die';
  const articleCapitalized = article === 'das' ? 'Ein' : 'Eine';
  const isSkript = params.entityLabel === 'Skript';
  const rechteText = params.rechte === 'feedback'
    ? (isSkript
      ? `Sie können ${article} ${params.entityLabel} ansehen, kommentieren und Änderungen vornehmen.`
      : `Sie können ${article} ${params.entityLabel} ansehen und Feedback geben.`)
    : `Sie können ${article} ${params.entityLabel} ansehen.`;
  const messageBlock = params.message
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
            <tr><td style="padding:12px 16px;background:#f4f4f5;border-left:3px solid #d4d4d4;border-radius:4px;">
              <p style="margin:0 0 4px 0;color:#555;font-size:12px;font-weight:600;">Nachricht von ${escapeHtml(params.sharedByName)}:</p>
              <p style="margin:0;color:#1a1a1a;font-size:14px;white-space:pre-line;">${escapeHtml(params.message)}</p>
            </td></tr>
          </table>`
    : '';
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>${escapeHtml(params.entityLabel)} geteilt</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="padding:32px 40px;color:#1a1a1a;font-size:15px;line-height:1.6;">
          <h2 style="margin:0 0 16px 0;font-size:20px;">${articleCapitalized} ${escapeHtml(params.entityLabel)} wurde mit Ihnen geteilt</h2>
          <p style="margin:0 0 16px 0;">${escapeHtml(params.sharedByName)} hat ${article} ${escapeHtml(params.entityLabel)} <strong>${escapeHtml(params.entityName)}</strong> mit Ihnen geteilt.</p>
          <p style="margin:0 0 24px 0;">${rechteText} Leiten Sie diese Mail gerne an Kolleginnen und Kollegen weiter.</p>
          ${messageBlock}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
            <tr><td style="border-radius:6px;background:#4f46e5;">
              <a href="${params.link}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">${escapeHtml(params.entityLabel)} öffnen</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px 0;color:#1a1a1a;font-size:15px;">Ihr Zugangscode:</p>
          <p style="margin:0 0 16px 0;font-size:28px;letter-spacing:6px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(params.code)}</p>
          <p style="margin:0 0 8px 0;color:#555;font-size:13px;">Beim Öffnen geben Sie den Code und Ihren Namen ein. Ein Account ist nicht nötig.</p>
          <p style="margin:0;color:#999;font-size:12px;">Falls der Button nicht funktioniert, kopieren Sie diesen Link:<br><a href="${params.link}" style="color:#4f46e5;word-break:break-all;">${params.link}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

export function buildPaketInviteEmail(params: {
  kampagneName: string;
  titles: string[];
  link: string;
  code: string;
}): string {
  const items = params.titles.length
    ? `<ul style="margin:0 0 24px 0;padding-left:20px;color:#1a1a1a;font-size:15px;">${
      params.titles.map((t) => `<li style="margin:0 0 6px 0;">${escapeHtml(t)}</li>`).join('')
    }</ul>`
    : '';
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>Skripte geteilt</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="padding:32px 40px;color:#1a1a1a;font-size:15px;line-height:1.6;">
          <h2 style="margin:0 0 16px 0;font-size:20px;">Skripte der Kampagne ${escapeHtml(params.kampagneName)}</h2>
          <p style="margin:0 0 16px 0;">Diese Skripte liegen in dem Link:</p>
          ${items}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
            <tr><td style="border-radius:6px;background:#111111;">
              <a href="${params.link}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">Skripte öffnen</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px 0;color:#1a1a1a;font-size:15px;">Ihr Zugangscode:</p>
          <p style="margin:0 0 16px 0;font-size:28px;letter-spacing:6px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(params.code)}</p>
          <p style="margin:0;color:#999;font-size:12px;">Falls der Button nicht funktioniert, kopieren Sie diesen Link:<br><a href="${params.link}" style="color:#111111;word-break:break-all;">${params.link}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function entityName(admin: ReturnType<typeof createClient>, entityType: string, entityId: string): Promise<{ name: string; kampagneId: string | null } | null> {
  if (entityType === 'skript_paket') {
    const { data, error } = await admin
      .from('skript_pakete')
      .select('kampagne_id, kampagne:kampagne_id(kampagnenname, eigener_name)')
      .eq('id', entityId)
      .maybeSingle();
    if (error || !data) return null;
    const kampagne = (data as { kampagne?: { kampagnenname?: string | null; eigener_name?: string | null } | null }).kampagne;
    const name = kampagne?.eigener_name || kampagne?.kampagnenname || 'Kampagne';
    return { name, kampagneId: (data as { kampagne_id: string }).kampagne_id };
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

export async function sendInviteMails(params: {
  emails: string[];
  fromEmail: string;
  subject: string;
  html: string;
}): Promise<{ sent: number; error?: string }> {
  if (params.emails.length === 0) return { sent: 0 };
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    return { sent: 0, error: 'E-Mail-Versand nicht konfiguriert: RESEND_API_KEY fehlt.' };
  }
  let sent = 0;
  let lastError = '';
  for (const to of params.emails) {
    try {
      const mailRes = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: params.fromEmail,
          reply_to: params.fromEmail,
          to: [to],
          subject: params.subject,
          html: params.html,
        }),
      });
      if (!mailRes.ok) {
        lastError = await mailRes.text();
        console.error(`Resend error ${mailRes.status}: ${lastError}`);
      } else {
        sent += 1;
      }
    } catch (err) {
      lastError = String(err);
      console.error('Resend fetch error:', err);
    }
  }
  if (sent === 0 && lastError) {
    let detail = '';
    try { detail = JSON.parse(lastError)?.message || ''; } catch { /* raw */ }
    return { sent, error: `E-Mail-Versand fehlgeschlagen${detail ? `: ${detail}` : '.'}` };
  }
  return { sent };
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
  const mail = accountLinkMail({
    entityLabel: params.entityLabel,
    entityName: params.entityName,
    url: `${params.origin}${path}`,
    sharedByName: params.sharedByName,
  });
  return sendInviteMails({
    emails: params.emails,
    fromEmail: normalizeFromEmail(Deno.env.get('SHARE_FROM_EMAIL')),
    subject: mail.betreff,
    html: mail.html,
  });
}
