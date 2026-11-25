/**
 * einladung — Link + Code ohne Konto, mit dem ein Kunde Produkt oder Briefing abschickt (ADR 0055). Nur Router.
 *
 * Staff-JWT:
 *  - anlegen.ts / konzept.ts: create (Produkt, Briefing / Konzept je Casting-Eintrag), optional mit Mail
 *  - verwalten.ts:            rotate_code, resend (neuer Code + Mail), revoke
 * Öffentlich:
 *  - oeffentlich.ts: resolve (Kopfdaten), verify (token + code + name → Sitzungs-Token, 6 h, rate-limitiert)
 *  - einreichen.ts:  upload_url (signierte Upload-URL in den privaten Bucket `einreichung`), submit
 *
 * Die Kunden-Seite schreibt nie in produkt oder campaign_briefings und nutzt kein Gast-JWT
 * mit Tabellen-Rechten. Alles läuft hier mit Service Role, nach Code- und Sitzungsprüfung.
 *
 * Ops: JWT_SECRET (oder SUPABASE_JWT_SECRET / GUEST_JWT_SECRET) muss als Secret gesetzt sein.
 * Optional: RESEND_API_KEY, SHARE_FROM_EMAIL, APP_BASE_URL.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonRes } from '../_shared/zugang/http.ts';
import { jwtSecret, requireStaff } from '../_shared/zugang/staff.ts';
import { konzeptGesperrt, ladeEinladung, nutzbar } from './daten.ts';
import type { EinladungKontext } from './daten.ts';
import { erstelleEinladung } from './anlegen.ts';
import { legeKonzeptEinladungenAn } from './konzept.ts';
import { verwalteEinladung } from './verwalten.ts';
import { resolveEinladung, verifyEinladung } from './oeffentlich.ts';
import { submit, uploadUrl } from './einreichen.ts';
import { pruefeSitzung } from './sitzung.ts';

const STAFF_AKTIONEN = ['create', 'rotate_code', 'revoke', 'resend'];

async function staffAktion(ctx: EinladungKontext): Promise<Response> {
  const { headers, secret } = ctx;
  if (!secret) return jsonRes({ error: 'JWT_SECRET fehlt als Secret.' }, 500, headers);
  const auth = await requireStaff(ctx.admin, ctx.req, 'Nur Mitarbeiter können Einladungen verwalten.');
  if ('error' in auth) return jsonRes({ error: auth.error }, auth.status, headers);
  const staffCtx = { ...ctx, secret, staff: auth.staff };

  if (ctx.action === 'create' && String(ctx.body.art ?? '') === 'konzept') {
    const { status, data } = await legeKonzeptEinladungenAn(ctx.admin, {
      body: ctx.body,
      secret,
      origin: ctx.origin,
      staff: auth.staff,
    });
    return jsonRes(data, status, headers);
  }
  if (ctx.action === 'create') return erstelleEinladung(staffCtx);
  return verwalteEinladung(staffCtx);
}

async function oeffentlicheAktion(ctx: EinladungKontext): Promise<Response> {
  const { admin, headers, secret, action } = ctx;
  const einladung = await ladeEinladung(admin, String(ctx.body.token ?? '').trim());
  if (!einladung) return jsonRes({ valid: false, error: 'Link ungültig.' }, 404, headers);
  const gesperrt = nutzbar(einladung) || await konzeptGesperrt(admin, einladung);
  if (gesperrt) return jsonRes({ valid: false, error: gesperrt }, 403, headers);

  if (action === 'resolve') return resolveEinladung(ctx, einladung);
  if (!secret) return jsonRes({ error: 'Einladungen sind nicht konfiguriert: JWT_SECRET fehlt.' }, 500, headers);
  if (action === 'verify') return verifyEinladung(ctx, einladung, secret);

  const sitzung = await pruefeSitzung(String(ctx.body.sitzung ?? ''), einladung.id, secret);
  if (!sitzung) {
    return jsonRes({ error: 'Die Sitzung ist abgelaufen. Bitte den Code erneut eingeben.', sitzungAbgelaufen: true }, 401, headers);
  }
  if (action === 'upload_url') return uploadUrl(ctx, einladung);
  if (action === 'submit') return submit(ctx, einladung, sitzung);
  return jsonRes({ error: 'Unbekannte Action.' }, 400, headers);
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

  const ctx: EinladungKontext = {
    req,
    body,
    admin: createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    }),
    headers,
    action: String(body.action ?? ''),
    secret: jwtSecret(),
    origin: Deno.env.get('APP_BASE_URL') || req.headers.get('origin') || '',
  };

  return STAFF_AKTIONEN.includes(ctx.action) ? staffAktion(ctx) : oeffentlicheAktion(ctx);
});
