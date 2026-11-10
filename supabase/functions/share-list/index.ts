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
import {
  EMAIL_REGEX,
  ENTITY_CONFIG,
  normalizeFromEmail,
  corsHeaders,
  jsonRes,
  generateToken,
  generateCode,
  jwtSecret,
  hashCode,
  parseEmails,
  buildInviteEmail,
  requireStaff,
  scriptTitleList,
  buildPaketInviteEmail,
  entityName,
  sendInviteMails,
  mailAccountLinks,
} from './support.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { classifyShareEmails } from '../_shared/share-recipients.ts';
import { handleGuestAction } from './guest.ts';

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

  const guestResponse = await handleGuestAction({ req, body, admin, headers, action, secret });
  if (guestResponse) return guestResponse;

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
    const message = String(body.message ?? '').trim().slice(0, 500);
    const emails = parseEmails(body.emails ?? body.email);
    const expiresAtRaw = body.expiresAt ? String(body.expiresAt) : '';
    const endsWithKampagne = Boolean(body.endsWithKampagne);

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

    let plan;
    try {
      plan = await classifyShareEmails(admin, emails, entityType, entityId);
    } catch (err) {
      console.error('Empfänger-Aufteilung fehlgeschlagen:', err);
      return jsonRes({ error: 'Empfänger konnten nicht geprüft werden.' }, 500, headers);
    }
    const guestEmails = plan.guest;
    const origin = req.headers.get('origin') || Deno.env.get('APP_BASE_URL') || '';
    const accountMail = () => mailAccountLinks({
      emails: plan.listLink,
      entityType,
      entityId,
      entityLabel: entityConfig.label,
      entityName: info.name,
      sharedByName: staff.name || 'Ihr Ansprechpartner',
      origin,
    });

    if (emails.length > 0 && guestEmails.length === 0) {
      const accountResult = await accountMail();
      if (plan.listLink.length > 0 && accountResult.error && accountResult.sent === 0) {
        return jsonRes({ error: accountResult.error, plan }, 502, headers);
      }
      return jsonRes({
        success: true,
        link: null,
        code: null,
        shareId: null,
        mailed: accountResult.sent,
        plan,
      }, 200, headers);
    }

    let expiresAt: string | null = null;
    if (expiresAtRaw) {
      const d = new Date(expiresAtRaw);
      if (Number.isNaN(d.getTime())) return jsonRes({ error: 'Ungültiges Ablaufdatum.' }, 400, headers);
      expiresAt = d.toISOString();
    }

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
        expires_at: expiresAt,
        ends_with_kampagne: endsWithKampagne && Boolean(info.kampagneId),
        created_by: staff.id,
        empfaenger_emails: guestEmails,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('list_shares insert error:', insertError);
      return jsonRes({ error: 'Zugang konnte nicht angelegt werden.' }, 500, headers);
    }

    const link = `${origin}/share/${token}`;

    const titles = scriptTitleList(body.scriptTitles);
    const paketMail = entityType === 'skript_paket';
    const mailResult = await sendInviteMails({
      emails: guestEmails,
      fromEmail: normalizeFromEmail(Deno.env.get('SHARE_FROM_EMAIL')),
      subject: paketMail
        ? `Skripte der Kampagne ${info.name}`
        : `${entityConfig.label} „${info.name}" wurde mit Ihnen geteilt`,
      html: paketMail
        ? buildPaketInviteEmail({ kampagneName: info.name, titles, link, code })
        : buildInviteEmail({
          entityLabel: entityConfig.label,
          entityArticle: entityConfig.article,
          entityName: info.name,
          sharedByName: staff.name || 'Ihr Ansprechpartner',
          rechte,
          link,
          code,
          message: message || undefined,
        }),
    });
    const accountResult = await accountMail();

    if (guestEmails.length > 0 && mailResult.error && mailResult.sent === 0) {
      return jsonRes({
        error: `Zugang angelegt, aber ${mailResult.error}`,
        link,
        code,
        shareId: inserted.id,
        plan,
      }, 502, headers);
    }

    return jsonRes({
      success: true,
      link,
      code,
      shareId: inserted.id,
      mailed: mailResult.sent + accountResult.sent,
      plan,
    }, 200, headers);
  }

  if (action === 'send_account_links') {
    const entityType = String(body.entityType ?? '');
    const entityId = String(body.entityId ?? '');
    const emails = parseEmails(body.emails ?? body.email);
    const entityConfig = ENTITY_CONFIG[entityType];
    if (!entityConfig) return jsonRes({ error: 'Ungültiger Listen-Typ.' }, 400, headers);
    if (!/^[0-9a-f-]{36}$/i.test(entityId)) return jsonRes({ error: 'Ungültige Listen-ID.' }, 400, headers);
    const info = await entityName(admin, entityType, entityId);
    if (!info) return jsonRes({ error: 'Liste nicht gefunden.' }, 404, headers);
    let plan;
    try {
      plan = await classifyShareEmails(admin, emails, entityType, entityId);
    } catch (err) {
      console.error('Empfänger-Aufteilung fehlgeschlagen:', err);
      return jsonRes({ error: 'Empfänger konnten nicht geprüft werden.' }, 500, headers);
    }
    const origin = req.headers.get('origin') || Deno.env.get('APP_BASE_URL') || '';
    const accountResult = await mailAccountLinks({
      emails: plan.listLink,
      entityType,
      entityId,
      entityLabel: entityConfig.label,
      entityName: info.name,
      sharedByName: staff.name || 'Ihr Ansprechpartner',
      origin,
    });
    if (plan.listLink.length > 0 && accountResult.error && accountResult.sent === 0) {
      return jsonRes({ error: accountResult.error, plan }, 502, headers);
    }
    return jsonRes({ success: true, mailed: accountResult.sent, plan }, 200, headers);
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
    if (body.emails !== undefined) {
      const emails = parseEmails(body.emails);
      for (const email of emails) {
        if (!EMAIL_REGEX.test(email) || email.length > 320) {
          return jsonRes({ error: `Ungültige E-Mail-Adresse: ${email}` }, 400, headers);
        }
      }
      patch.empfaenger_emails = emails;
    }
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
    let plan;
    try {
      plan = await classifyShareEmails(admin, emails, share.entity_type, share.entity_id);
    } catch (err) {
      console.error('Empfänger-Aufteilung fehlgeschlagen:', err);
      return jsonRes({ error: 'Empfänger konnten nicht geprüft werden.' }, 500, headers);
    }
    const accountResult = await mailAccountLinks({
      emails: plan.listLink,
      entityType: share.entity_type,
      entityId: share.entity_id,
      entityLabel: entityConfig?.label || 'Liste',
      entityName: info?.name || share.label || 'Unbenannt',
      sharedByName: staff.name || 'Ihr Ansprechpartner',
      origin,
    });
    if (plan.guest.length === 0) {
      if (plan.listLink.length > 0 && accountResult.error && accountResult.sent === 0) {
        return jsonRes({ error: accountResult.error, plan }, 502, headers);
      }
      return jsonRes({ success: true, mailed: accountResult.sent, plan }, 200, headers);
    }
    // Code ist gehasht — bei Resend ohne Rotation nur der Link. Für den Code: rotate zuerst.
    const code = String(body.code ?? '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(code)) {
      return jsonRes({ error: 'Zum erneuten Versand bitte zuerst den Code rotieren und den neuen Code mitsenden.' }, 400, headers);
    }
    const titles = scriptTitleList(body.scriptTitles);
    const paketMail = share.entity_type === 'skript_paket';
    const mailResult = await sendInviteMails({
      emails: plan.guest,
      fromEmail: normalizeFromEmail(Deno.env.get('SHARE_FROM_EMAIL')),
      subject: paketMail
        ? `Skripte der Kampagne ${info?.name || share.label}`
        : `${entityConfig?.label || 'Liste'} „${info?.name || share.label}" wurde mit Ihnen geteilt`,
      html: paketMail
        ? buildPaketInviteEmail({
          kampagneName: info?.name || share.label || 'Kampagne',
          titles,
          link,
          code,
        })
        : buildInviteEmail({
          entityLabel: entityConfig?.label || 'Liste',
          entityArticle: entityConfig?.article || 'die',
          entityName: info?.name || share.label || 'Unbenannt',
          sharedByName: staff.name || 'Ihr Ansprechpartner',
          rechte: share.rechte,
          link,
          code,
          message: String(body.message ?? '').trim().slice(0, 500) || undefined,
        }),
    });
    if (mailResult.error && mailResult.sent === 0) return jsonRes({ error: mailResult.error, plan }, 502, headers);
    return jsonRes({ success: true, mailed: mailResult.sent + accountResult.sent, plan }, 200, headers);
  }

  return jsonRes({ error: 'Unbekannte Action.' }, 400, headers);
});
