/**
 * share-list v2 — Zugänge ohne Gast-Account
 *
 * Actions (POST JSON):
 *  - create:       Staff-JWT. Legt Zugang an (token + 6-stelliger Code), optional Mails.
 *  - resolve:      öffentlich. Token → Listen-Infos für die Eingangs-Maske.
 *  - verify:       öffentlich, rate-limitiert. token + code + name → Gast-JWT (30d).
 *  - rotate_code:  Staff-JWT. Neuen Code erzeugen.
 *  - revoke:       Staff-JWT. Zugang widerrufen.
 *  - update:       Staff-JWT. Label/Rechte/Ablauf/endsWithKampagne.
 *  - participants: Staff-JWT. Teilnehmer-Liste.
 *
 * Ops: JWT_SECRET (oder SUPABASE_JWT_SECRET / GUEST_JWT_SECRET) muss als
 * Edge-Function-Secret gesetzt sein — damit PostgREST das Gast-JWT akzeptiert.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFY_WINDOW_MIN = 15;
const VERIFY_MAX_ATTEMPTS = 5;
const JWT_TTL_SEC = 60 * 60 * 24 * 30;

const ENTITY_CONFIG: Record<string, { table: string; nameColumns: string[]; label: string }> = {
  kampagne: { table: 'kampagne', nameColumns: ['eigener_name', 'kampagnenname'], label: 'Kampagne' },
  sourcing: { table: 'creator_auswahl', nameColumns: ['name'], label: 'Sourcing-Liste' },
  strategie: { table: 'strategie', nameColumns: ['name'], label: 'Strategie-Liste' },
};

function normalizeFromEmail(raw: string | undefined): string {
  const fallback = 'CreatorJobs24 <onboarding@resend.dev>';
  let value = (raw ?? '').trim().replace(/^["']+|["']+$/g, '').trim();
  if (!value) return fallback;
  const nameAddr = value.match(/^(.*)<\s*([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)\s*>$/);
  if (nameAddr) {
    const name = nameAddr[1].trim().replace(/^["']+|["']+$/g, '').trim();
    return name ? `${name} <${nameAddr[2]}>` : nameAddr[2];
  }
  if (EMAIL_REGEX.test(value)) return `CreatorJobs24 <${value}>`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return `CreatorJobs24 <noreply@${value}>`;
  console.error(`SHARE_FROM_EMAIL hat ungültiges Format: "${raw}" — Fallback auf ${fallback}`);
  return fallback;
}

function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function jsonRes(data: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const n = new DataView(bytes.buffer).getUint32(0) % 1_000_000;
  return String(n).padStart(6, '0');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jwtSecret(): string | null {
  return Deno.env.get('JWT_SECRET')
    || Deno.env.get('SUPABASE_JWT_SECRET')
    || Deno.env.get('GUEST_JWT_SECRET')
    || null;
}

function b64url(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashCode(code: string, secret: string): Promise<string> {
  return sha256Hex(`share-code:${secret}:${code}`);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signGuestJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
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

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '')
    .split(',')[0]
    .trim()
    .slice(0, 64);
}

function parseEmails(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  }
  const text = String(raw ?? '').trim();
  if (!text) return [];
  return text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function buildInviteEmail(params: {
  entityLabel: string;
  entityName: string;
  sharedByName: string;
  rechte: string;
  link: string;
  code: string;
}): string {
  const rechteText = params.rechte === 'feedback'
    ? 'Sie können die Liste ansehen und Feedback geben.'
    : 'Sie können die Liste ansehen.';
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>Liste geteilt</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="padding:32px 40px;color:#1a1a1a;font-size:15px;line-height:1.6;">
          <h2 style="margin:0 0 16px 0;font-size:20px;">Eine Liste wurde mit Ihnen geteilt</h2>
          <p style="margin:0 0 16px 0;">${escapeHtml(params.sharedByName)} hat die ${escapeHtml(params.entityLabel)} <strong>${escapeHtml(params.entityName)}</strong> mit Ihnen geteilt.</p>
          <p style="margin:0 0 24px 0;">${rechteText} Leiten Sie diese Mail gerne an Kolleginnen und Kollegen weiter.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
            <tr><td style="border-radius:6px;background:#4f46e5;">
              <a href="${params.link}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">Liste öffnen</a>
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

async function requireStaff(admin: ReturnType<typeof createClient>, req: Request) {
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

function shareIsUsable(share: {
  revoked_at: string | null;
  expires_at: string | null;
}): string | null {
  if (share.revoked_at) return 'Dieser Zugang wurde widerrufen.';
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
    return 'Dieser Zugang ist abgelaufen.';
  }
  return null;
}

async function entityName(admin: ReturnType<typeof createClient>, entityType: string, entityId: string): Promise<{ name: string; kampagneId: string | null } | null> {
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

async function sendInviteMails(params: {
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
        body: JSON.stringify({ from: params.fromEmail, to: [to], subject: params.subject, html: params.html }),
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

serve(async (req: Request) => {
  const headers = corsHeaders(req);

  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers });
  if (req.method !== 'POST') return jsonRes({ error: 'Method Not Allowed' }, 405, headers);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: 'Ungültiger JSON-Body.' }, 400, headers);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const action = String(body.action ?? '');
  const secret = jwtSecret();

  if (action === 'diag') {
    return jsonRes({
      hasResendKey: Boolean(Deno.env.get('RESEND_API_KEY')),
      hasFromEmail: Boolean(Deno.env.get('SHARE_FROM_EMAIL')),
      hasJwtSecret: Boolean(secret),
      effectiveFrom: normalizeFromEmail(Deno.env.get('SHARE_FROM_EMAIL')),
    }, 200, headers);
  }

  // -------------------------------------------------------------------
  // resolve
  // -------------------------------------------------------------------
  if (action === 'resolve') {
    const token = String(body.token ?? '').trim();
    if (!token || token.length < 32) return jsonRes({ error: 'Ungültiger Token.' }, 400, headers);

    const { data: share, error } = await admin
      .from('list_shares')
      .select('id, token, entity_type, entity_id, rechte, label, revoked_at, expires_at, ends_with_kampagne')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      console.error('resolve error:', error);
      return jsonRes({ error: 'Fehler beim Laden.' }, 500, headers);
    }
    if (!share) return jsonRes({ valid: false, error: 'Link ungültig.' }, 404, headers);

    const blocked = shareIsUsable(share);
    if (blocked) return jsonRes({ valid: false, error: blocked }, 403, headers);

    const info = await entityName(admin, share.entity_type, share.entity_id);

    if (share.ends_with_kampagne) {
      const kampagneId = info?.kampagneId ?? (share.entity_type === 'kampagne' ? share.entity_id : null);
      if (kampagneId) {
        const { data: isDone } = await admin.rpc('kampagne_is_completed', { p_kampagne_id: kampagneId });
        if (isDone === true) {
          return jsonRes({ valid: false, error: 'Dieser Zugang ist beendet, weil die Kampagne abgeschlossen ist.' }, 403, headers);
        }
      }
    }
    return jsonRes({
      valid: true,
      shareId: share.id,
      email: null,
      entityType: share.entity_type,
      entityId: share.entity_id,
      rechte: share.rechte,
      label: share.label,
      entityName: info?.name ?? null,
    }, 200, headers);
  }

  // -------------------------------------------------------------------
  // verify
  // -------------------------------------------------------------------
  if (action === 'verify') {
    if (!secret) {
      return jsonRes({ error: 'Gast-Zugang nicht konfiguriert: JWT_SECRET fehlt als Secret.' }, 500, headers);
    }
    const token = String(body.token ?? '').trim();
    const code = String(body.code ?? '').replace(/\D/g, '');
    const name = String(body.name ?? '').trim();
    if (!token || token.length < 32) return jsonRes({ error: 'Ungültiger Token.' }, 400, headers);
    if (!/^\d{6}$/.test(code)) return jsonRes({ error: 'Bitte den 6-stelligen Code eingeben.' }, 400, headers);
    if (name.length < 2 || name.length > 80) {
      return jsonRes({ error: 'Bitte Ihren Namen eingeben (2–80 Zeichen).' }, 400, headers);
    }

    const { data: share, error } = await admin
      .from('list_shares')
      .select('id, token, entity_type, entity_id, rechte, label, revoked_at, expires_at, ends_with_kampagne, code_hash')
      .eq('token', token)
      .maybeSingle();

    if (error || !share) return jsonRes({ valid: false, error: 'Link ungültig.' }, 404, headers);
    const blocked = shareIsUsable(share);
    if (blocked) return jsonRes({ valid: false, error: blocked }, 403, headers);

    const ip = clientIp(req) || 'unknown';
    const windowStart = new Date(Date.now() - VERIFY_WINDOW_MIN * 60 * 1000).toISOString();
    const { count } = await admin
      .from('share_verify_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('share_id', share.id)
      .eq('ip', ip)
      .gte('attempted_at', windowStart);

    if ((count ?? 0) >= VERIFY_MAX_ATTEMPTS) {
      return jsonRes({ error: 'Zu viele Versuche. Bitte 15 Minuten warten.' }, 429, headers);
    }

    await admin.from('share_verify_attempts').insert({ share_id: share.id, ip });
    await admin.from('share_verify_attempts').delete().lt('attempted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const incomingHash = await hashCode(code, secret);
    if (!timingSafeEqual(incomingHash, String(share.code_hash))) {
      return jsonRes({ error: 'Der Code ist ungültig.' }, 403, headers);
    }

    if (share.ends_with_kampagne) {
      const info = await entityName(admin, share.entity_type, share.entity_id);
      const kampagneId = info?.kampagneId ?? (share.entity_type === 'kampagne' ? share.entity_id : null);
      if (kampagneId) {
        const { data: isDone } = await admin.rpc('kampagne_is_completed', { p_kampagne_id: kampagneId });
        if (isDone === true) {
          return jsonRes({ valid: false, error: 'Dieser Zugang ist beendet, weil die Kampagne abgeschlossen ist.' }, 403, headers);
        }
      }
    }

    const nowIso = new Date().toISOString();
    const { data: existing } = await admin
      .from('share_participants')
      .select('id, name')
      .eq('share_id', share.id)
      .ilike('name', name)
      .maybeSingle();

    let participantId: string;
    if (existing) {
      participantId = existing.id;
      await admin.from('share_participants').update({ last_seen_at: nowIso }).eq('id', existing.id);
    } else {
      const { data: created, error: partError } = await admin
        .from('share_participants')
        .insert({ share_id: share.id, name, first_seen_at: nowIso, last_seen_at: nowIso })
        .select('id')
        .single();
      if (partError || !created) {
        console.error('participant insert error:', partError);
        return jsonRes({ error: 'Teilnehmer konnte nicht gespeichert werden.' }, 500, headers);
      }
      participantId = created.id;
    }

    await admin.from('list_shares').update({ last_access_at: nowIso }).eq('id', share.id);

    const nowSec = Math.floor(Date.now() / 1000);
    const jwt = await signGuestJwt({
      role: 'anon',
      iss: `${supabaseUrl}/auth/v1`,
      aud: 'authenticated',
      sub: participantId,
      iat: nowSec,
      exp: nowSec + JWT_TTL_SEC,
      share_id: share.id,
      participant_id: participantId,
      name,
    }, secret);

    const info = await entityName(admin, share.entity_type, share.entity_id);
    return jsonRes({
      jwt,
      shareId: share.id,
      entityType: share.entity_type,
      entityId: share.entity_id,
      rechte: share.rechte,
      label: share.label,
      entityName: info?.name ?? null,
      name,
      participantId,
    }, 200, headers);
  }

  // Staff-only ab hier
  const staffResult = await requireStaff(admin, req);
  if (!('staff' in staffResult) || !staffResult.staff) {
    return staffResult.error ?? jsonRes({ error: 'Nicht autorisiert.' }, 401, headers);
  }
  const staff = staffResult.staff;

  // -------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------
  if (action === 'create') {
    if (!secret) {
      return jsonRes({ error: 'Gast-Zugang nicht konfiguriert: JWT_SECRET fehlt als Secret.' }, 500, headers);
    }
    const entityType = String(body.entityType ?? '');
    const entityId = String(body.entityId ?? '');
    const rechte = String(body.rechte ?? 'ansehen');
    const label = String(body.label ?? '').trim().slice(0, 80) || 'Zugang';
    const emails = parseEmails(body.emails ?? body.email);

    const entityConfig = ENTITY_CONFIG[entityType];
    if (!entityConfig) return jsonRes({ error: 'Ungültiger Listen-Typ.' }, 400, headers);
    if (!/^[0-9a-f-]{36}$/i.test(entityId)) return jsonRes({ error: 'Ungültige Listen-ID.' }, 400, headers);
    if (!['ansehen', 'feedback'].includes(rechte)) return jsonRes({ error: 'Ungültige Rechte-Stufe.' }, 400, headers);
    for (const email of emails) {
      if (!EMAIL_REGEX.test(email) || email.length > 320) {
        return jsonRes({ error: `Ungültige E-Mail-Adresse: ${email}` }, 400, headers);
      }
    }

    const info = await entityName(admin, entityType, entityId);
    if (!info) return jsonRes({ error: 'Liste nicht gefunden.' }, 404, headers);

    const token = generateToken();
    const code = generateCode();
    const codeHash = await hashCode(code, secret);

    const { data: inserted, error: insertError } = await admin
      .from('list_shares')
      .insert({
        token,
        entity_type: entityType,
        entity_id: entityId,
        rechte,
        label,
        code_hash: codeHash,
        expires_at: null,
        ends_with_kampagne: Boolean(info.kampagneId),
        created_by: staff.id,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('list_shares insert error:', insertError);
      return jsonRes({ error: 'Zugang konnte nicht angelegt werden.' }, 500, headers);
    }

    const origin = req.headers.get('origin') || Deno.env.get('APP_BASE_URL') || '';
    const link = `${origin}/share/${token}`;

    const mailResult = await sendInviteMails({
      emails,
      fromEmail: normalizeFromEmail(Deno.env.get('SHARE_FROM_EMAIL')),
      subject: `${entityConfig.label} „${info.name}" wurde mit Ihnen geteilt`,
      html: buildInviteEmail({
        entityLabel: entityConfig.label,
        entityName: info.name,
        sharedByName: staff.name || 'Ihr Ansprechpartner',
        rechte,
        link,
        code,
      }),
    });

    if (emails.length > 0 && mailResult.error && mailResult.sent === 0) {
      return jsonRes({
        error: `Zugang angelegt, aber ${mailResult.error}`,
        link,
        code,
        shareId: inserted.id,
      }, 502, headers);
    }

    return jsonRes({ success: true, link, code, shareId: inserted.id, mailed: mailResult.sent }, 200, headers);
  }

  // -------------------------------------------------------------------
  // rotate_code / revoke / update / participants
  // -------------------------------------------------------------------
  const shareId = String(body.shareId ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(shareId)) {
    return jsonRes({ error: 'Ungültige Zugangs-ID.' }, 400, headers);
  }

  if (action === 'rotate_code') {
    if (!secret) return jsonRes({ error: 'JWT_SECRET fehlt.' }, 500, headers);
    const code = generateCode();
    const codeHash = await hashCode(code, secret);
    const { error } = await admin.from('list_shares').update({ code_hash: codeHash }).eq('id', shareId);
    if (error) return jsonRes({ error: 'Code konnte nicht erneuert werden.' }, 500, headers);
    return jsonRes({ success: true, code }, 200, headers);
  }

  if (action === 'revoke') {
    const { error } = await admin.from('list_shares').update({ revoked_at: new Date().toISOString() }).eq('id', shareId);
    if (error) return jsonRes({ error: 'Widerruf fehlgeschlagen.' }, 500, headers);
    return jsonRes({ success: true }, 200, headers);
  }

  if (action === 'update') {
    const patch: Record<string, unknown> = {};
    if (body.rechte !== undefined) {
      const rechte = String(body.rechte);
      if (!['ansehen', 'feedback'].includes(rechte)) return jsonRes({ error: 'Ungültige Rechte-Stufe.' }, 400, headers);
      patch.rechte = rechte;
    }
    if (body.label !== undefined) patch.label = String(body.label).trim().slice(0, 80) || 'Zugang';
    if (body.expiresAt !== undefined) {
      if (body.expiresAt === null || body.expiresAt === '') patch.expires_at = null;
      else {
        const d = new Date(String(body.expiresAt));
        if (Number.isNaN(d.getTime())) return jsonRes({ error: 'Ungültiges Ablaufdatum.' }, 400, headers);
        patch.expires_at = d.toISOString();
      }
    }
    if (body.endsWithKampagne !== undefined) patch.ends_with_kampagne = Boolean(body.endsWithKampagne);
    if (Object.keys(patch).length === 0) return jsonRes({ error: 'Keine Änderungen.' }, 400, headers);
    const { error } = await admin.from('list_shares').update(patch).eq('id', shareId);
    if (error) return jsonRes({ error: 'Aktualisierung fehlgeschlagen.' }, 500, headers);
    return jsonRes({ success: true }, 200, headers);
  }

  if (action === 'participants') {
    const { data, error } = await admin
      .from('share_participants')
      .select('id, name, first_seen_at, last_seen_at')
      .eq('share_id', shareId)
      .order('last_seen_at', { ascending: false });
    if (error) return jsonRes({ error: 'Teilnehmer konnten nicht geladen werden.' }, 500, headers);
    return jsonRes({ participants: data || [] }, 200, headers);
  }

  if (action === 'resend') {
    if (!secret) return jsonRes({ error: 'JWT_SECRET fehlt.' }, 500, headers);
    const emails = parseEmails(body.emails ?? body.email);
    if (emails.length === 0) return jsonRes({ error: 'Bitte mindestens eine E-Mail angeben.' }, 400, headers);
    const { data: share } = await admin
      .from('list_shares')
      .select('id, token, entity_type, entity_id, rechte, label, revoked_at')
      .eq('id', shareId)
      .maybeSingle();
    if (!share || share.revoked_at) return jsonRes({ error: 'Zugang nicht gefunden.' }, 404, headers);
    const info = await entityName(admin, share.entity_type, share.entity_id);
    const entityConfig = ENTITY_CONFIG[share.entity_type];
    const origin = req.headers.get('origin') || Deno.env.get('APP_BASE_URL') || '';
    const link = `${origin}/share/${share.token}`;
    // Code ist gehasht — bei Resend ohne Rotation nur der Link. Für den Code: rotate zuerst.
    const code = String(body.code ?? '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(code)) {
      return jsonRes({ error: 'Zum erneuten Versand bitte zuerst den Code rotieren und den neuen Code mitsenden.' }, 400, headers);
    }
    const mailResult = await sendInviteMails({
      emails,
      fromEmail: normalizeFromEmail(Deno.env.get('SHARE_FROM_EMAIL')),
      subject: `${entityConfig?.label || 'Liste'} „${info?.name || share.label}" wurde mit Ihnen geteilt`,
      html: buildInviteEmail({
        entityLabel: entityConfig?.label || 'Liste',
        entityName: info?.name || share.label || 'Unbenannt',
        sharedByName: staff.name || 'Ihr Ansprechpartner',
        rechte: share.rechte,
        link,
        code,
      }),
    });
    if (mailResult.error && mailResult.sent === 0) return jsonRes({ error: mailResult.error }, 502, headers);
    return jsonRes({ success: true, mailed: mailResult.sent }, 200, headers);
  }

  return jsonRes({ error: 'Unbekannte Action.' }, 400, headers);
});
