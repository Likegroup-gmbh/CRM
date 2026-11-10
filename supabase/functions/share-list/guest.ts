// Öffentliche share-list-Aktionen: Diagnose, Link auflösen, Code prüfen.

import {
  VERIFY_WINDOW_MIN,
  VERIFY_MAX_ATTEMPTS,
  JWT_TTL_SEC,
  normalizeFromEmail,
  jsonRes,
  hashCode,
  timingSafeEqual,
  signGuestJwt,
  clientIp,
  shareIsUsable,
  entityName,
} from './support.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function handleGuestAction(ctx: {
  req: Request;
  body: Record<string, unknown>;
  admin: ReturnType<typeof createClient>;
  headers: Record<string, string>;
  action: string;
  secret: string | null;
}): Promise<Response | null> {
  const { req, body, admin, headers, action, secret } = ctx;

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
      iss: `${Deno.env.get('SUPABASE_URL')}/auth/v1`,
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

  return null;
}
