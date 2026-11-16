// Öffentliche share-list-Aktionen: Diagnose, Link auflösen, Code prüfen.

import { normalizeFromEmail } from '../_shared/mail.ts';
import { hashCode, signJwt, timingSafeEqual } from '../_shared/zugang/krypto.ts';
import { clientIp, ipHeaderDiagnose, jsonRes } from '../_shared/zugang/http.ts';
import { SHARE_VERIFY, codeVersucheGesperrt, merkeVersuch, vergesseVersuch } from '../_shared/zugang/limit.ts';
import { JWT_TTL_SEC, gueltigerToken, ladeShare, pruefeShare, shareAntwort } from './support.ts';
import type { ShareKontext } from './support.ts';

async function resolve(ctx: ShareKontext): Promise<Response> {
  const token = gueltigerToken(ctx.body.token);
  if (!token) return jsonRes({ error: 'Ungültiger Token.' }, 400, ctx.headers);
  const share = await ladeShare(ctx, token);
  if (share instanceof Response) return share;
  const { gesperrt, info } = await pruefeShare(ctx.admin, share);
  if (gesperrt) return jsonRes({ valid: false, error: gesperrt }, 403, ctx.headers);
  return jsonRes({ valid: true, email: null, ...shareAntwort(share, info) }, 200, ctx.headers);
}

async function teilnehmerMerken(ctx: ShareKontext, shareId: string, name: string): Promise<string | null> {
  const nowIso = new Date().toISOString();
  const { data: existing } = await ctx.admin
    .from('share_participants')
    .select('id, name')
    .eq('share_id', shareId)
    .ilike('name', name)
    .maybeSingle();
  if (existing) {
    await ctx.admin.from('share_participants').update({ last_seen_at: nowIso }).eq('id', existing.id);
    return existing.id;
  }
  const { data: created, error } = await ctx.admin
    .from('share_participants')
    .insert({ share_id: shareId, name, first_seen_at: nowIso, last_seen_at: nowIso })
    .select('id')
    .single();
  if (error || !created) {
    console.error('participant insert error:', error);
    return null;
  }
  return created.id;
}

async function verify(ctx: ShareKontext, secret: string): Promise<Response> {
  const { headers } = ctx;
  const token = gueltigerToken(ctx.body.token);
  const code = String(ctx.body.code ?? '').replace(/\D/g, '');
  const name = String(ctx.body.name ?? '').trim();
  if (!token) return jsonRes({ error: 'Ungültiger Token.' }, 400, headers);
  if (!/^\d{6}$/.test(code)) return jsonRes({ error: 'Bitte den 6-stelligen Code eingeben.' }, 400, headers);
  if (name.length < 2 || name.length > 80) {
    return jsonRes({ error: 'Bitte Ihren Namen eingeben (2–80 Zeichen).' }, 400, headers);
  }

  const share = await ladeShare(ctx, token, true);
  if (share instanceof Response) return share;
  const { gesperrt, info } = await pruefeShare(ctx.admin, share);
  if (gesperrt) return jsonRes({ valid: false, error: gesperrt }, 403, headers);

  const ip = clientIp(ctx.req) || 'unknown';
  if (await codeVersucheGesperrt(ctx.admin, SHARE_VERIFY, share.id, ip)) {
    return jsonRes({ error: 'Zu viele Versuche. Bitte 15 Minuten warten.' }, 429, headers);
  }
  const versuchId = await merkeVersuch(ctx.admin, SHARE_VERIFY, share.id, ip);

  const incomingHash = await hashCode('share-code', code, secret);
  if (!timingSafeEqual(incomingHash, String(share.code_hash))) {
    return jsonRes({ error: 'Der Code ist ungültig.' }, 403, headers);
  }
  await vergesseVersuch(ctx.admin, SHARE_VERIFY, versuchId);

  const participantId = await teilnehmerMerken(ctx, share.id, name);
  if (!participantId) return jsonRes({ error: 'Teilnehmer konnte nicht gespeichert werden.' }, 500, headers);
  await ctx.admin.from('list_shares').update({ last_access_at: new Date().toISOString() }).eq('id', share.id);

  const nowSec = Math.floor(Date.now() / 1000);
  const jwt = await signJwt({
    role: 'anon',
    iss: `${Deno.env.get('SUPABASE_URL')}/auth/v1`,
    aud: 'authenticated',
    sub: participantId,
    iat: nowSec,
    exp: nowSec + JWT_TTL_SEC,
    share_id: share.id,
    participant_id: participantId,
    name,
  }, secret);

  return jsonRes({ jwt, ...shareAntwort(share, info), name, participantId }, 200, headers);
}

export async function handleGuestAction(ctx: ShareKontext): Promise<Response | null> {
  const { action, secret, headers } = ctx;

  if (action === 'diag') {
    return jsonRes({
      hasResendKey: Boolean(Deno.env.get('RESEND_API_KEY')),
      hasFromEmail: Boolean(Deno.env.get('SHARE_FROM_EMAIL')),
      hasJwtSecret: Boolean(secret),
      effectiveFrom: normalizeFromEmail(Deno.env.get('SHARE_FROM_EMAIL')),
      ipHeader: ipHeaderDiagnose(ctx.req),
    }, 200, headers);
  }

  if (action === 'resolve') return resolve(ctx);

  if (action === 'verify') {
    if (!secret) {
      return jsonRes({ error: 'Gast-Zugang nicht konfiguriert: JWT_SECRET fehlt als Secret.' }, 500, headers);
    }
    return verify(ctx, secret);
  }

  return null;
}
