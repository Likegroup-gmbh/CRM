/**
 * einladung — Link + Code ohne Konto, mit dem ein Kunde Produkt oder Briefing abschickt (ADR 0055)
 *
 * Actions (POST JSON):
 *  - create:       Staff-JWT. Legt eine Einladung an (token + 6-stelliger Code).
 *                  Optional emails (max. 10) und nachricht: Link + Code gehen direkt per Mail raus.
 *  - rotate_code:  Staff-JWT. Neuen Code erzeugen.
 *  - resend:       Staff-JWT. Neuen Code erzeugen und mit dem Link an emails mailen.
 *  - revoke:       Staff-JWT. Einladung widerrufen.
 *  - resolve:      öffentlich. Token → Kopfdaten für die Eingangsmaske.
 *  - verify:       öffentlich, rate-limitiert. token + code + name → Sitzungs-Token (6 h).
 *  - upload_url:   öffentlich mit Sitzung. Signierte Upload-URL in den privaten Bucket `einreichung`.
 *  - submit:       öffentlich mit Sitzung. Legt eine Einreichung an, Mail an den Einladenden.
 *
 * Die Kunden-Seite schreibt nie in produkt oder campaign_briefings und nutzt kein Gast-JWT
 * mit Tabellen-Rechten. Alles läuft hier mit Service Role, nach Code- und Sitzungsprüfung.
 *
 * Ops: JWT_SECRET (oder SUPABASE_JWT_SECRET / GUEST_JWT_SECRET) muss als Secret gesetzt sein.
 * Optional: RESEND_API_KEY, SHARE_FROM_EMAIL, APP_BASE_URL.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  BILD_MIME,
  BRIEFING_TYPEN,
  MAX_DATEI_BYTES,
  UPLOAD_MIME,
  bereinigeBriefing,
  bereinigeProdukt,
  parseEmpfaenger,
  pruefeEinreichung,
} from './felder.ts';
import { escapeHtml, sendResendMail } from '../_shared/mail.ts';

const BUCKET = 'einreichung';
const VERIFY_WINDOW_MIN = 15;
const VERIFY_MAX_ATTEMPTS = 5;
const SITZUNG_TTL_SEC = 60 * 60 * 6;
const UPLOAD_MAX_PRO_STUNDE = 40;
const SUBMIT_MAX_PRO_STUNDE = 10;
const OFFEN_MAX = 50;
const NACHRICHT_MAX = 500;

type Admin = ReturnType<typeof createClient>;

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

function jwtSecret(): string | null {
  return Deno.env.get('JWT_SECRET')
    || Deno.env.get('SUPABASE_JWT_SECRET')
    || Deno.env.get('GUEST_JWT_SECRET')
    || null;
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

function b64url(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64url(value: string): string {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const bin = atob(value.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashCode(code: string, secret: string): Promise<string> {
  return sha256Hex(`einladung-code:${secret}:${code}`);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}

/** Sitzungs-Token: gilt nur für diese Einladung, trägt den Namen des Absenders. */
async function signSitzung(einladungId: string, name: string, secret: string): Promise<string> {
  const body = b64url(JSON.stringify({
    eid: einladungId,
    name,
    exp: Math.floor(Date.now() / 1000) + SITZUNG_TTL_SEC,
  }));
  return `${body}.${await hmac(`einladung-sitzung:${body}`, secret)}`;
}

async function pruefeSitzung(
  sitzung: string,
  einladungId: string,
  secret: string,
): Promise<{ name: string } | null> {
  const [body, sig] = String(sitzung || '').split('.');
  if (!body || !sig) return null;
  const expected = await hmac(`einladung-sitzung:${body}`, secret);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const claims = JSON.parse(fromB64url(body)) as { eid: string; name: string; exp: number };
    if (claims.eid !== einladungId) return null;
    if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
    return { name: String(claims.name || '') };
  } catch {
    return null;
  }
}

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '')
    .split(',')[0]
    .trim()
    .slice(0, 64);
}

function istUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

async function requireStaff(admin: Admin, req: Request) {
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return { error: 'Nicht autorisiert.', status: 401 };
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return { error: 'Nicht autorisiert.', status: 401 };
  const { data: staff } = await admin
    .from('benutzer')
    .select('id, name, email, rolle')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!staff || !['admin', 'mitarbeiter'].includes(staff.rolle)) {
    return { error: 'Nur Mitarbeiter können Einladungen verwalten.', status: 403 };
  }
  return { staff };
}

interface EinladungRow {
  id: string;
  token: string;
  code_hash: string;
  art: 'produkt' | 'briefing';
  label: string;
  unternehmen_id: string;
  marke_id: string | null;
  produktion_id: string | null;
  briefing_typ: string | null;
  created_by: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

const EINLADUNG_SPALTEN =
  'id, token, code_hash, art, label, unternehmen_id, marke_id, produktion_id, briefing_typ, created_by, expires_at, revoked_at';

function nutzbar(e: Pick<EinladungRow, 'revoked_at' | 'expires_at'>): string | null {
  if (e.revoked_at) return 'Diese Einladung wurde widerrufen.';
  if (e.expires_at && new Date(e.expires_at).getTime() <= Date.now()) return 'Diese Einladung ist abgelaufen.';
  return null;
}

async function ladeEinladung(admin: Admin, token: string): Promise<EinladungRow | null> {
  if (!/^[0-9a-f]{32,}$/i.test(token)) return null;
  const { data } = await admin.from('einladung').select(EINLADUNG_SPALTEN).eq('token', token).maybeSingle();
  return (data as EinladungRow | null) ?? null;
}

async function zaehleVersuche(
  admin: Admin,
  einladungId: string,
  aktion: 'verify' | 'upload' | 'submit',
  seitMinuten: number,
  ip?: string,
): Promise<number> {
  const seit = new Date(Date.now() - seitMinuten * 60 * 1000).toISOString();
  let q = admin
    .from('einladung_verify_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('einladung_id', einladungId)
    .eq('aktion', aktion)
    .gte('attempted_at', seit);
  if (ip) q = q.eq('ip', ip);
  const { count } = await q;
  return count ?? 0;
}

async function merkeVersuch(admin: Admin, einladungId: string, aktion: 'verify' | 'upload' | 'submit', ip: string) {
  await admin.from('einladung_verify_attempts').insert({ einladung_id: einladungId, aktion, ip });
  await admin
    .from('einladung_verify_attempts')
    .delete()
    .lt('attempted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
}

function mailHtml(p: { titel: string; zeilen: string[]; link: string; knopf: string }): string {
  const zeilen = p.zeilen.map((z) => `<p style="margin:0 0 12px 0;">${z}</p>`).join('');
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(p.titel)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;max-width:600px;width:100%;">
        <tr><td style="padding:32px 40px;color:#1a1a1a;font-size:15px;line-height:1.6;">
          <h2 style="margin:0 0 16px 0;font-size:20px;">${escapeHtml(p.titel)}</h2>
          ${zeilen}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 0 0;">
            <tr><td style="border-radius:6px;background:#4f46e5;">
              <a href="${escapeHtml(p.link)}" style="display:inline-block;padding:12px 28px;color:#fff;text-decoration:none;font-weight:600;">${escapeHtml(p.knopf)}</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function kopfdaten(admin: Admin, e: EinladungRow) {
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
  return { firmenname: firma?.firmenname ?? null, markenname };
}

/** Eine Mail pro Empfänger mit Link und Code. Antworten gehen an den Einladenden. */
async function versendeEinladung(
  admin: Admin,
  e: EinladungRow,
  p: {
    link: string;
    code: string;
    emails: string[];
    nachricht: string;
    staff: { name?: string | null; email?: string | null };
  },
): Promise<{ gesendet: string[]; fehlgeschlagen: string[]; fehler?: string }> {
  const gesendet: string[] = [];
  const fehlgeschlagen: string[] = [];
  let fehler: string | undefined;
  if (p.emails.length === 0) return { gesendet, fehlgeschlagen };

  const kopf = await kopfdaten(admin, e);
  const fuer = [kopf.firmenname, kopf.markenname].filter(Boolean).join(' · ');
  const absender = (p.staff.name || '').trim() || 'Ihr Ansprechpartner bei LikeGroup';
  const was = e.art === 'briefing' ? 'ein Briefing auszufüllen' : 'Ihre Produkte einzutragen';
  const titel = e.art === 'briefing' ? 'Bitte füllen Sie Ihr Briefing aus' : 'Bitte tragen Sie Ihr Produkt ein';

  const zeilen = [
    `${escapeHtml(absender)} bittet Sie${fuer ? ` für <strong>${escapeHtml(fuer)}</strong>` : ''}, ${was}.`,
  ];
  if (p.nachricht) {
    zeilen.push(`<em style="color:#555;">${escapeHtml(p.nachricht).replace(/\n/g, '<br>')}</em>`);
  }
  zeilen.push(
    `Ihr Code: <strong style="font-size:20px;letter-spacing:3px;">${escapeHtml(p.code)}</strong>`,
    '<span style="color:#555;font-size:13px;">Beim Öffnen geben Sie den Code und Ihren Namen ein. Ein Account ist nicht nötig.</span>',
  );
  const html = mailHtml({ titel, zeilen, link: p.link, knopf: 'Formular öffnen' });
  const betreff = fuer ? `${titel} – ${fuer}` : titel;

  for (const to of p.emails) {
    const result = await sendResendMail({ to, subject: betreff, html, replyTo: p.staff.email });
    if (!result.ok) fehler = result.error;
    (result.ok ? gesendet : fehlgeschlagen).push(to);
  }
  return { gesendet, fehlgeschlagen, fehler };
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

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const action = String(body.action ?? '');
  const secret = jwtSecret();
  const origin = Deno.env.get('APP_BASE_URL') || req.headers.get('origin') || '';

  // -------------------------------------------------------------------
  // Staff: create / rotate_code / revoke
  // -------------------------------------------------------------------
  if (['create', 'rotate_code', 'revoke', 'resend'].includes(action)) {
    if (!secret) return jsonRes({ error: 'JWT_SECRET fehlt als Secret.' }, 500, headers);
    const auth = await requireStaff(admin, req);
    if ('error' in auth) return jsonRes({ error: auth.error }, auth.status, headers);
    const staff = auth.staff!;

    if (action === 'create') {
      const art = String(body.art ?? '');
      const label = String(body.label ?? '').trim().slice(0, 80);
      let unternehmenId = String(body.unternehmenId ?? '');
      let markeId: string | null = body.markeId ? String(body.markeId) : null;
      let produktionId: string | null = null;
      let briefingTyp: string | null = null;

      if (art === 'briefing') {
        produktionId = String(body.produktionId ?? '');
        briefingTyp = String(body.briefingTyp ?? '');
        if (!istUuid(produktionId)) return jsonRes({ error: 'Ungültige Produktion.' }, 400, headers);
        if (!(BRIEFING_TYPEN as readonly string[]).includes(briefingTyp)) {
          return jsonRes({ error: 'Bitte den Briefing-Typ wählen.' }, 400, headers);
        }
        const { data: produktion } = await admin
          .from('produktion')
          .select('id, kampagne:kampagne_id(unternehmen_id, marke_id)')
          .eq('id', produktionId)
          .maybeSingle();
        const kampagne = (produktion as { kampagne?: { unternehmen_id: string | null; marke_id: string | null } } | null)?.kampagne;
        if (!produktion || !kampagne?.unternehmen_id) {
          return jsonRes({ error: 'Produktion nicht gefunden.' }, 404, headers);
        }
        unternehmenId = kampagne.unternehmen_id;
        markeId = kampagne.marke_id ?? null;
      } else if (art === 'produkt') {
        if (!istUuid(unternehmenId)) return jsonRes({ error: 'Ungültiges Unternehmen.' }, 400, headers);
        if (markeId) {
          if (!istUuid(markeId)) return jsonRes({ error: 'Ungültige Marke.' }, 400, headers);
          const { data: marke } = await admin.from('marke').select('id, unternehmen_id').eq('id', markeId).maybeSingle();
          if (!marke || marke.unternehmen_id !== unternehmenId) {
            return jsonRes({ error: 'Die Marke gehört nicht zu diesem Unternehmen.' }, 400, headers);
          }
        }
      } else {
        return jsonRes({ error: 'Ungültige Art.' }, 400, headers);
      }

      let expiresAt: string | null = null;
      if (body.expiresAt) {
        const d = new Date(String(body.expiresAt));
        if (Number.isNaN(d.getTime())) return jsonRes({ error: 'Ungültiges Ablaufdatum.' }, 400, headers);
        expiresAt = d.toISOString();
      }

      const empfaenger = parseEmpfaenger(body.emails);
      if (empfaenger.fehler) return jsonRes({ error: empfaenger.fehler }, 400, headers);
      const nachricht = String(body.nachricht ?? '').trim().slice(0, NACHRICHT_MAX);

      const token = generateToken();
      const code = generateCode();
      const { data: inserted, error } = await admin
        .from('einladung')
        .insert({
          token,
          code_hash: await hashCode(code, secret),
          art,
          label: label || (art === 'briefing' ? 'Briefing-Einladung' : 'Produkt-Einladung'),
          unternehmen_id: unternehmenId,
          marke_id: markeId,
          produktion_id: produktionId,
          briefing_typ: briefingTyp,
          created_by: staff.id,
          expires_at: expiresAt,
        })
        .select(EINLADUNG_SPALTEN)
        .single();
      if (error || !inserted) {
        console.error('einladung insert error:', error);
        return jsonRes({ error: 'Einladung konnte nicht angelegt werden.' }, 500, headers);
      }
      const link = `${origin}/einladung/${token}`;
      const versand = await versendeEinladung(admin, inserted as EinladungRow, {
        link,
        code,
        emails: empfaenger.emails,
        nachricht,
        staff,
      });
      return jsonRes({
        success: true,
        einladungId: (inserted as EinladungRow).id,
        link,
        code,
        gesendet: versand.gesendet,
        fehlgeschlagen: versand.fehlgeschlagen,
        fehler: versand.fehler,
      }, 200, headers);
    }

    const einladungId = String(body.einladungId ?? '');
    if (!istUuid(einladungId)) return jsonRes({ error: 'Ungültige Einladungs-ID.' }, 400, headers);

    if (action === 'rotate_code') {
      const code = generateCode();
      const { error } = await admin
        .from('einladung')
        .update({ code_hash: await hashCode(code, secret) })
        .eq('id', einladungId)
        .is('revoked_at', null);
      if (error) return jsonRes({ error: 'Code konnte nicht erneuert werden.' }, 500, headers);
      return jsonRes({ success: true, code }, 200, headers);
    }

    if (action === 'resend') {
      const empfaenger = parseEmpfaenger(body.emails);
      if (empfaenger.fehler) return jsonRes({ error: empfaenger.fehler }, 400, headers);
      if (empfaenger.emails.length === 0) {
        return jsonRes({ error: 'Bitte mindestens eine E-Mail angeben.' }, 400, headers);
      }
      const nachricht = String(body.nachricht ?? '').trim().slice(0, NACHRICHT_MAX);

      const { data: zeile } = await admin
        .from('einladung')
        .select(EINLADUNG_SPALTEN)
        .eq('id', einladungId)
        .maybeSingle();
      const einladungRow = zeile as EinladungRow | null;
      if (!einladungRow) return jsonRes({ error: 'Einladung nicht gefunden.' }, 404, headers);
      const gesperrt = nutzbar(einladungRow);
      if (gesperrt) return jsonRes({ error: gesperrt }, 400, headers);

      // Der Code liegt nur als Hash vor: für den Versand wird ein neuer erzeugt.
      const code = generateCode();
      const { error: rotError } = await admin
        .from('einladung')
        .update({ code_hash: await hashCode(code, secret) })
        .eq('id', einladungId)
        .is('revoked_at', null);
      if (rotError) return jsonRes({ error: 'Code konnte nicht erneuert werden.' }, 500, headers);

      const link = `${origin}/einladung/${einladungRow.token}`;
      const versand = await versendeEinladung(admin, einladungRow, {
        link,
        code,
        emails: empfaenger.emails,
        nachricht,
        staff,
      });
      return jsonRes({
        success: true,
        link,
        code,
        gesendet: versand.gesendet,
        fehlgeschlagen: versand.fehlgeschlagen,
        fehler: versand.fehler,
      }, 200, headers);
    }

    const { error } = await admin
      .from('einladung')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', einladungId);
    if (error) return jsonRes({ error: 'Widerruf fehlgeschlagen.' }, 500, headers);
    return jsonRes({ success: true }, 200, headers);
  }

  // -------------------------------------------------------------------
  // Öffentlich: resolve / verify / upload_url / submit
  // -------------------------------------------------------------------
  const token = String(body.token ?? '').trim();
  const einladung = await ladeEinladung(admin, token);
  if (!einladung) return jsonRes({ valid: false, error: 'Link ungültig.' }, 404, headers);
  const gesperrt = nutzbar(einladung);
  if (gesperrt) return jsonRes({ valid: false, error: gesperrt }, 403, headers);

  if (action === 'resolve') {
    const kopf = await kopfdaten(admin, einladung);
    return jsonRes({
      valid: true,
      art: einladung.art,
      label: einladung.label,
      briefingTyp: einladung.briefing_typ,
      ...kopf,
    }, 200, headers);
  }

  if (!secret) return jsonRes({ error: 'Einladungen sind nicht konfiguriert: JWT_SECRET fehlt.' }, 500, headers);

  if (action === 'verify') {
    const code = String(body.code ?? '').replace(/\D/g, '');
    const name = String(body.name ?? '').trim();
    if (!/^\d{6}$/.test(code)) return jsonRes({ error: 'Bitte den 6-stelligen Code eingeben.' }, 400, headers);
    if (name.length < 2 || name.length > 80) {
      return jsonRes({ error: 'Bitte Ihren Namen eingeben (2–80 Zeichen).' }, 400, headers);
    }

    const ip = clientIp(req) || 'unknown';
    const versuche = await zaehleVersuche(admin, einladung.id, 'verify', VERIFY_WINDOW_MIN, ip);
    if (versuche >= VERIFY_MAX_ATTEMPTS) {
      return jsonRes({ error: 'Zu viele Versuche. Bitte 15 Minuten warten.' }, 429, headers);
    }
    await merkeVersuch(admin, einladung.id, 'verify', ip);

    const incoming = await hashCode(code, secret);
    if (!timingSafeEqual(incoming, String(einladung.code_hash))) {
      return jsonRes({ error: 'Der Code ist ungültig.' }, 403, headers);
    }

    await admin.from('einladung').update({ last_access_at: new Date().toISOString() }).eq('id', einladung.id);
    return jsonRes({
      success: true,
      sitzung: await signSitzung(einladung.id, name, secret),
      ablaufSekunden: SITZUNG_TTL_SEC,
    }, 200, headers);
  }

  const sitzung = await pruefeSitzung(String(body.sitzung ?? ''), einladung.id, secret);
  if (!sitzung) {
    return jsonRes({ error: 'Die Sitzung ist abgelaufen. Bitte den Code erneut eingeben.', sitzungAbgelaufen: true }, 401, headers);
  }

  if (action === 'upload_url') {
    const slot = String(body.slot ?? '');
    const mime = String(body.mime ?? '');
    const groesse = Number(body.groesse ?? 0);
    const erlaubt: readonly string[] = slot === 'bild' ? BILD_MIME : UPLOAD_MIME;
    if (!['bild', 'referenz'].includes(slot)) return jsonRes({ error: 'Ungültiger Upload.' }, 400, headers);
    if (!erlaubt.includes(mime)) return jsonRes({ error: 'Dieser Dateityp ist nicht erlaubt.' }, 400, headers);
    if (!Number.isFinite(groesse) || groesse <= 0 || groesse > MAX_DATEI_BYTES) {
      return jsonRes({ error: 'Die Datei ist zu groß (max. 25 MB).' }, 400, headers);
    }

    const ip = clientIp(req) || 'unknown';
    if (await zaehleVersuche(admin, einladung.id, 'upload', 60) >= UPLOAD_MAX_PRO_STUNDE) {
      return jsonRes({ error: 'Zu viele Uploads. Bitte später erneut versuchen.' }, 429, headers);
    }
    await merkeVersuch(admin, einladung.id, 'upload', ip);

    const sauber = String(body.name ?? 'datei').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'datei';
    const pfad = `${einladung.id}/${crypto.randomUUID()}_${sauber}`;
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(pfad);
    if (error || !data) {
      console.error('createSignedUploadUrl error:', error);
      return jsonRes({ error: 'Upload konnte nicht vorbereitet werden.' }, 500, headers);
    }
    return jsonRes({ success: true, pfad, token: data.token }, 200, headers);
  }

  if (action === 'submit') {
    const ip = clientIp(req) || 'unknown';
    if (await zaehleVersuche(admin, einladung.id, 'submit', 60) >= SUBMIT_MAX_PRO_STUNDE) {
      return jsonRes({ error: 'Zu viele Einreichungen. Bitte später erneut versuchen.' }, 429, headers);
    }
    const { count: offen } = await admin
      .from('einreichung')
      .select('id', { count: 'exact', head: true })
      .eq('einladung_id', einladung.id)
      .eq('status', 'offen');
    if ((offen ?? 0) >= OFFEN_MAX) {
      return jsonRes({ error: 'Es liegen schon sehr viele offene Einreichungen vor. Bitte beim Team melden.' }, 429, headers);
    }

    const bereinigt = einladung.art === 'produkt'
      ? bereinigeProdukt(body.formData, { einladungId: einladung.id })
      : bereinigeBriefing(body.formData, { einladungId: einladung.id, bereich: String(einladung.briefing_typ) });

    const fehler = pruefeEinreichung(einladung.art, bereinigt.formData);
    if (fehler) return jsonRes({ error: fehler }, 400, headers);

    // Nur Dateien übernehmen, die wirklich hochgeladen wurden.
    let dateien = bereinigt.dateien;
    if (dateien.length) {
      const { data: liste } = await admin.storage.from(BUCKET).list(einladung.id, { limit: 200 });
      const vorhanden = new Set((liste || []).map((f: { name: string }) => `${einladung.id}/${f.name}`));
      dateien = dateien.filter((d) => vorhanden.has(d.pfad));
      const gueltig = new Set(dateien.map((d) => d.pfad));
      const fd = bereinigt.formData as Record<string, unknown>;
      if (Array.isArray(fd.bilder)) fd.bilder = (fd.bilder as { pfad: string }[]).filter((b) => gueltig.has(b.pfad));
      if (Array.isArray(fd.referenzen)) {
        fd.referenzen = (fd.referenzen as { typ: string; value: string }[])
          .filter((r) => r.typ !== 'upload' || gueltig.has(r.value));
      }
    }

    await merkeVersuch(admin, einladung.id, 'submit', ip);
    const { data: einreichung, error } = await admin
      .from('einreichung')
      .insert({
        einladung_id: einladung.id,
        absender_name: sitzung.name || 'Unbekannt',
        payload: { formData: bereinigt.formData },
        dateien,
      })
      .select('id')
      .single();
    if (error || !einreichung) {
      console.error('einreichung insert error:', error);
      return jsonRes({ error: 'Die Einreichung konnte nicht gespeichert werden.' }, 500, headers);
    }

    // Eine Mail pro Einreichung an die Person, die eingeladen hat. Ein Fehler hier ändert nichts am Absenden.
    if (einladung.created_by) {
      const { data: ersteller } = await admin
        .from('benutzer')
        .select('email, name')
        .eq('id', einladung.created_by)
        .maybeSingle();
      if (ersteller?.email) {
        const kopf = await kopfdaten(admin, einladung);
        const ziel = einladung.art === 'briefing' && einladung.produktion_id
          ? `${origin}/produktion/${einladung.produktion_id}?tab=briefing`
          : `${origin}/produkt`;
        const wasText = einladung.art === 'briefing' ? 'ein Briefing' : 'ein Produkt';
        const firma = [kopf.firmenname, kopf.markenname].filter(Boolean).join(' · ');
        const titel = einladung.art === 'briefing' ? 'Neues Briefing eingereicht' : 'Neues Produkt eingereicht';
        await sendResendMail({
          to: ersteller.email,
          subject: `${titel}: ${einladung.label}`,
          html: mailHtml({
            titel,
            zeilen: [
              `${escapeHtml(sitzung.name)} hat über die Einladung „${escapeHtml(einladung.label)}“ ${wasText} eingereicht.`,
              firma ? `Kunde: ${escapeHtml(firma)}` : '',
              'Die Einreichung wartet auf deine Prüfung. Erst „Anlegen“ erstellt das Produkt bzw. Briefing.',
            ].filter(Boolean),
            link: ziel,
            knopf: 'Einreichung prüfen',
          }),
        });
      }
    }

    return jsonRes({ success: true, einreichungId: einreichung.id }, 200, headers);
  }

  return jsonRes({ error: 'Unbekannte Action.' }, 400, headers);
});
