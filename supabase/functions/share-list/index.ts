/**
 * share-list — Listen-Sharing per E-Mail (Gast-Zugang ohne Account)
 *
 * Actions (POST JSON):
 *  - create:  { action: 'create', entityType, entityId, email, rechte }
 *             Erfordert Staff-JWT (admin/mitarbeiter). Legt Gast-User + Share an
 *             und verschickt die Einladungs-Mail via Resend. Idempotent: bei
 *             bestehendem aktivem Share wird der Link erneut versendet.
 *  - resolve: { action: 'resolve', token }
 *             Ohne Auth (Token ist das Geheimnis). Liefert E-Mail + Entität
 *             für den Gast-Onboarding-Flow.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';

const ENTITY_CONFIG: Record<string, { table: string; nameColumns: string[]; label: string }> = {
  kampagne: { table: 'kampagne', nameColumns: ['eigener_name', 'kampagnenname'], label: 'Kampagne' },
  sourcing: { table: 'creator_auswahl', nameColumns: ['name'], label: 'Sourcing-Liste' },
  strategie: { table: 'strategie', nameColumns: ['name'], label: 'Strategie-Liste' },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildInviteEmail(params: {
  entityLabel: string;
  entityName: string;
  sharedByName: string;
  rechte: string;
  link: string;
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
          <p style="margin:0 0 24px 0;">${rechteText}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
            <tr><td style="border-radius:6px;background:#4f46e5;">
              <a href="${params.link}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">Liste öffnen</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px 0;color:#555;font-size:13px;">Beim ersten Öffnen auf einem Gerät senden wir Ihnen zur Bestätigung einen Sicherheitscode an diese E-Mail-Adresse. Ein Account oder Passwort ist nicht nötig.</p>
          <p style="margin:0;color:#999;font-size:12px;">Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br><a href="${params.link}" style="color:#4f46e5;word-break:break-all;">${params.link}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req: Request) => {
  const headers = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers });
  }
  if (req.method !== 'POST') {
    return jsonRes({ error: 'Method Not Allowed' }, 405, headers);
  }

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

  // -------------------------------------------------------------------
  // diag: Konfigurations-Check (nur Booleans, keine Secrets)
  // -------------------------------------------------------------------
  if (action === 'diag') {
    return jsonRes({
      hasResendKey: Boolean(Deno.env.get('RESEND_API_KEY')),
      hasFromEmail: Boolean(Deno.env.get('SHARE_FROM_EMAIL')),
    }, 200, headers);
  }

  // -------------------------------------------------------------------
  // resolve: Token → Share-Infos für den Gast-Onboarding-Flow
  // -------------------------------------------------------------------
  if (action === 'resolve') {
    const token = String(body.token ?? '').trim();
    if (!token || token.length < 32) {
      return jsonRes({ error: 'Ungültiger Token.' }, 400, headers);
    }

    const { data: share, error } = await admin
      .from('list_shares')
      .select('id, email, entity_type, entity_id, rechte, revoked_at, gast_benutzer_id, benutzer:gast_benutzer_id (name)')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      console.error('resolve error:', error);
      return jsonRes({ error: 'Fehler beim Laden.' }, 500, headers);
    }
    if (!share) {
      return jsonRes({ valid: false, error: 'Link ungültig.' }, 404, headers);
    }
    if (share.revoked_at) {
      return jsonRes({ valid: false, error: 'Dieser Zugang wurde widerrufen.' }, 403, headers);
    }

    const gastName = (share as Record<string, unknown>).benutzer
      ? ((share as { benutzer: { name?: string } }).benutzer.name ?? null)
      : null;

    return jsonRes({
      valid: true,
      email: share.email,
      entityType: share.entity_type,
      entityId: share.entity_id,
      rechte: share.rechte,
      gastName,
    }, 200, headers);
  }

  // -------------------------------------------------------------------
  // create: Staff legt Share an, Mail wird versendet
  // -------------------------------------------------------------------
  if (action === 'create') {
    // 1. Staff-JWT prüfen
    const authHeader = req.headers.get('authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) {
      return jsonRes({ error: 'Nicht autorisiert.' }, 401, headers);
    }
    const { data: { user: authUser }, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authUser) {
      return jsonRes({ error: 'Nicht autorisiert.' }, 401, headers);
    }

    const { data: staff } = await admin
      .from('benutzer')
      .select('id, name, rolle')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (!staff || !['admin', 'mitarbeiter'].includes(staff.rolle)) {
      return jsonRes({ error: 'Nur Mitarbeiter können Listen teilen.' }, 403, headers);
    }

    // 2. Input validieren
    const entityType = String(body.entityType ?? '');
    const entityId = String(body.entityId ?? '');
    const email = String(body.email ?? '').trim().toLowerCase();
    const rechte = String(body.rechte ?? 'ansehen');

    const entityConfig = ENTITY_CONFIG[entityType];
    if (!entityConfig) {
      return jsonRes({ error: 'Ungültiger Listen-Typ.' }, 400, headers);
    }
    if (!/^[0-9a-f-]{36}$/i.test(entityId)) {
      return jsonRes({ error: 'Ungültige Listen-ID.' }, 400, headers);
    }
    if (!EMAIL_REGEX.test(email) || email.length > 320) {
      return jsonRes({ error: 'Ungültige E-Mail-Adresse.' }, 400, headers);
    }
    if (!['ansehen', 'feedback'].includes(rechte)) {
      return jsonRes({ error: 'Ungültige Rechte-Stufe.' }, 400, headers);
    }

    // 3. Entität laden (Name für die Mail + Existenz-Check)
    const { data: entity, error: entityError } = await admin
      .from(entityConfig.table)
      .select(`id, ${entityConfig.nameColumns.join(', ')}`)
      .eq('id', entityId)
      .maybeSingle();

    if (entityError || !entity) {
      return jsonRes({ error: 'Liste nicht gefunden.' }, 404, headers);
    }
    const entityName = entityConfig.nameColumns
      .map((c) => (entity as Record<string, string | null>)[c])
      .find((v) => v && String(v).trim()) || 'Unbenannt';

    // 4. Kollisionscheck: E-Mail gehört zu bestehendem Nicht-Gast-Account
    const { data: existing } = await admin
      .from('benutzer')
      .select('id, rolle, auth_user_id')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    const existingUser = existing?.[0] ?? null;
    if (existingUser && existingUser.rolle !== 'gast') {
      return jsonRes({
        error: 'Diese E-Mail gehört bereits zu einem Account. Bitte Zugriffsrechte über die Kunden-Verwaltung pflegen.',
        code: 'account_exists',
      }, 409, headers);
    }

    // 5. Gast-User finden oder anlegen (Auth-User passwortlos + benutzer-Zeile)
    let gastBenutzerId: string;
    if (existingUser) {
      gastBenutzerId = existingUser.id;
    } else {
      let authUserId: string | null = null;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { role: 'gast', source: 'list_share' },
      });

      if (createError) {
        // Auth-User existiert evtl. schon (z.B. verwaister Auth-Eintrag) → suchen
        const { data: found } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const match = found?.users?.find((u) => u.email?.toLowerCase() === email);
        if (!match) {
          console.error('createUser error:', createError);
          return jsonRes({ error: 'Gast-Zugang konnte nicht angelegt werden.' }, 500, headers);
        }
        authUserId = match.id;
      } else {
        authUserId = created.user.id;
      }

      const { data: benutzer, error: benutzerError } = await admin
        .from('benutzer')
        .upsert({
          auth_user_id: authUserId,
          email,
          rolle: 'gast',
          freigeschaltet: true,
        }, { onConflict: 'auth_user_id' })
        .select('id')
        .single();

      if (benutzerError || !benutzer) {
        console.error('benutzer upsert error:', benutzerError);
        return jsonRes({ error: 'Gast-Zugang konnte nicht angelegt werden.' }, 500, headers);
      }
      gastBenutzerId = benutzer.id;
    }

    // 6. Share finden oder anlegen (idempotent: aktiver Share wird wiederverwendet)
    const { data: activeShare } = await admin
      .from('list_shares')
      .select('id, token, rechte')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .ilike('email', email)
      .is('revoked_at', null)
      .maybeSingle();

    let token: string;
    if (activeShare) {
      token = activeShare.token;
      if (activeShare.rechte !== rechte) {
        await admin.from('list_shares').update({ rechte }).eq('id', activeShare.id);
      }
    } else {
      token = generateToken();
      const { error: insertError } = await admin
        .from('list_shares')
        .insert({
          token,
          entity_type: entityType,
          entity_id: entityId,
          email,
          rechte,
          gast_benutzer_id: gastBenutzerId,
          created_by: staff.id,
        });
      if (insertError) {
        console.error('list_shares insert error:', insertError);
        return jsonRes({ error: 'Share konnte nicht angelegt werden.' }, 500, headers);
      }
    }

    // 7. Mail via Resend
    const origin = req.headers.get('origin') || Deno.env.get('APP_BASE_URL') || '';
    const link = `${origin}/share/${token}`;

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('RESEND_API_KEY is not set');
      return jsonRes({ error: 'E-Mail-Versand nicht konfiguriert.', link }, 500, headers);
    }

    const fromEmail = Deno.env.get('SHARE_FROM_EMAIL') || 'CreatorJobs24 <onboarding@resend.dev>';
    const emailHtml = buildInviteEmail({
      entityLabel: entityConfig.label,
      entityName: String(entityName),
      sharedByName: staff.name || 'Ihr Ansprechpartner',
      rechte,
      link,
    });

    try {
      const mailRes = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: `${entityConfig.label} „${entityName}" wurde mit Ihnen geteilt`,
          html: emailHtml,
        }),
      });

      if (!mailRes.ok) {
        const errBody = await mailRes.text();
        console.error(`Resend error ${mailRes.status}: ${errBody}`);
        let detail = '';
        try { detail = JSON.parse(errBody)?.message || ''; } catch { /* raw body bleibt im Log */ }
        return jsonRes({
          error: `Share angelegt, aber E-Mail-Versand fehlgeschlagen${detail ? `: ${detail}` : '.'}`,
          link,
        }, 502, headers);
      }
    } catch (mailErr) {
      console.error('Resend fetch error:', mailErr);
      return jsonRes({ error: 'Share angelegt, aber E-Mail-Versand fehlgeschlagen (Netzwerkfehler).', link }, 502, headers);
    }

    return jsonRes({ success: true, link }, 200, headers);
  }

  return jsonRes({ error: 'Unbekannte Action.' }, 400, headers);
});
