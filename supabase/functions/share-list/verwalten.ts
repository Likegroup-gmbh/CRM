// Staff-Aktionen an bestehenden Zugängen (rotate_code, revoke, update, participants, resend)
// und die Empfänger-Vorschau plan.

import { EMAIL_REGEX } from '../_shared/mail.ts';
import { teilenMail } from '../_shared/mail/index.ts';
import { classifyShareEmails } from '../_shared/share-recipients.ts';
import { generateCode, hashCode } from '../_shared/zugang/krypto.ts';
import { istUuid, jsonRes } from '../_shared/zugang/http.ts';
import {
  ENTITY_CONFIG,
  entityName,
  kampagneDisplayName,
  mailAccountLinks,
  parseEmails,
  scriptTitleList,
  sendInviteMails,
} from './support.ts';
import type { StaffKontext } from './support.ts';

const SHARE_AKTIONEN = ['rotate_code', 'revoke', 'update', 'participants', 'resend'];

async function plan(ctx: StaffKontext): Promise<Response> {
  const entityType = String(ctx.body.entityType ?? '');
  const entityId = String(ctx.body.entityId ?? '');
  if (!ENTITY_CONFIG[entityType]) return jsonRes({ error: 'Ungültiger Listen-Typ.' }, 400, ctx.headers);
  if (entityType !== 'skript_paket' && !istUuid(entityId)) {
    return jsonRes({ error: 'Ungültige Listen-ID.' }, 400, ctx.headers);
  }
  try {
    const ergebnis = await classifyShareEmails(ctx.admin, parseEmails(ctx.body.emails), entityType, entityId);
    return jsonRes({ plan: ergebnis }, 200, ctx.headers);
  } catch (err) {
    console.error('Empfänger-Aufteilung fehlgeschlagen:', err);
    return jsonRes({ error: 'Empfänger konnten nicht geprüft werden.' }, 500, ctx.headers);
  }
}

async function rotateCode(ctx: StaffKontext, shareId: string, secret: string): Promise<Response> {
  const code = generateCode();
  const { error } = await ctx.admin
    .from('list_shares')
    .update({ code_hash: await hashCode('share-code', code, secret) })
    .eq('id', shareId);
  if (error) return jsonRes({ error: 'Code konnte nicht erneuert werden.' }, 500, ctx.headers);
  return jsonRes({ success: true, code }, 200, ctx.headers);
}

async function revoke(ctx: StaffKontext, shareId: string): Promise<Response> {
  const { error } = await ctx.admin
    .from('list_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', shareId);
  if (error) return jsonRes({ error: 'Widerruf fehlgeschlagen.' }, 500, ctx.headers);
  return jsonRes({ success: true }, 200, ctx.headers);
}

async function update(ctx: StaffKontext, shareId: string): Promise<Response> {
  const { body, headers } = ctx;
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
    const falsch = emails.find((email) => !EMAIL_REGEX.test(email) || email.length > 320);
    if (falsch) return jsonRes({ error: `Ungültige E-Mail-Adresse: ${falsch}` }, 400, headers);
    patch.empfaenger_emails = emails;
  }
  if (Object.keys(patch).length === 0) return jsonRes({ error: 'Keine Änderungen.' }, 400, headers);
  const { error } = await ctx.admin.from('list_shares').update(patch).eq('id', shareId);
  if (error) return jsonRes({ error: 'Aktualisierung fehlgeschlagen.' }, 500, headers);
  return jsonRes({ success: true }, 200, headers);
}

async function participants(ctx: StaffKontext, shareId: string): Promise<Response> {
  const { data, error } = await ctx.admin
    .from('share_participants')
    .select('id, name, first_seen_at, last_seen_at')
    .eq('share_id', shareId)
    .order('last_seen_at', { ascending: false });
  if (error) return jsonRes({ error: 'Teilnehmer konnten nicht geladen werden.' }, 500, ctx.headers);
  return jsonRes({ participants: data || [] }, 200, ctx.headers);
}

/** Der Code liegt nur gehasht vor: für Gäste muss der Aufrufer den frisch rotierten Code mitsenden. */
async function resend(ctx: StaffKontext, shareId: string): Promise<Response> {
  const { body, admin, headers, staff, origin } = ctx;
  const emails = parseEmails(body.emails ?? body.email);
  if (emails.length === 0) return jsonRes({ error: 'Bitte mindestens eine E-Mail angeben.' }, 400, headers);
  const { data: share } = await admin
    .from('list_shares')
    .select('id, token, entity_type, entity_id, rechte, label, revoked_at, skript_scope')
    .eq('id', shareId)
    .maybeSingle();
  if (!share || share.revoked_at) return jsonRes({ error: 'Zugang nicht gefunden.' }, 404, headers);
  const info = await entityName(admin, share.entity_type, share.entity_id);
  const entityConfig = ENTITY_CONFIG[share.entity_type];
  const link = `${origin}/share/${share.token}`;
  let empfaenger;
  try {
    empfaenger = await classifyShareEmails(admin, emails, share.entity_type, share.entity_id);
  } catch (err) {
    console.error('Empfänger-Aufteilung fehlgeschlagen:', err);
    return jsonRes({ error: 'Empfänger konnten nicht geprüft werden.' }, 500, headers);
  }
  const message = String(body.message ?? '').trim().slice(0, 500) || undefined;
  const accountResult = await mailAccountLinks({
    emails: empfaenger.listLink,
    entityType: share.entity_type,
    entityId: share.entity_id,
    entityLabel: entityConfig?.label || 'Liste',
    entityArticle: entityConfig?.article || 'die',
    entityName: info?.name || share.label || 'Unbenannt',
    sharedByName: staff.name || 'Ihr Ansprechpartner',
    message,
    replyTo: staff.email,
    origin,
  });
  if (empfaenger.guest.length === 0) {
    if (empfaenger.listLink.length > 0 && accountResult.error && accountResult.sent === 0) {
      return jsonRes({ error: accountResult.error, plan: empfaenger }, 502, headers);
    }
    return jsonRes({ success: true, mailed: accountResult.sent, plan: empfaenger }, 200, headers);
  }
  const code = String(body.code ?? '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(code)) {
    return jsonRes({ error: 'Zum erneuten Versand bitte zuerst den Code rotieren und den neuen Code mitsenden.' }, 400, headers);
  }
  const allScripts = share.entity_type === 'skript' && share.skript_scope === 'kampagne';
  const paket = share.entity_type === 'skript_paket';
  const mailName = (allScripts || paket)
    ? (await kampagneDisplayName(admin, info?.kampagneId ?? null)) || info?.name || share.label
    : (info?.name || share.label || 'Unbenannt');
  const mailResult = await sendInviteMails({
    emails: empfaenger.guest,
    replyTo: staff.email,
    mail: teilenMail({
      entityLabel: entityConfig?.label || 'Liste',
      entityArticle: entityConfig?.article || 'die',
      entityName: mailName,
      sharedByName: staff.name || 'Ihr Ansprechpartner',
      rechte: share.rechte,
      allScripts: allScripts || paket,
      titles: paket ? scriptTitleList(body.scriptTitles) : undefined,
      link,
      code,
      message,
      basisUrl: origin,
    }),
  });
  if (mailResult.error && mailResult.sent === 0) return jsonRes({ error: mailResult.error, plan: empfaenger }, 502, headers);
  return jsonRes({ success: true, mailed: mailResult.sent + accountResult.sent, plan: empfaenger }, 200, headers);
}

export async function handleVerwalten(ctx: StaffKontext): Promise<Response | null> {
  if (ctx.action === 'plan') return plan(ctx);
  if (!SHARE_AKTIONEN.includes(ctx.action)) return null;

  const shareId = String(ctx.body.shareId ?? '').trim();
  if (!istUuid(shareId)) return jsonRes({ error: 'Ungültige Zugangs-ID.' }, 400, ctx.headers);
  if (['rotate_code', 'resend'].includes(ctx.action) && !ctx.secret) {
    return jsonRes({ error: 'JWT_SECRET fehlt.' }, 500, ctx.headers);
  }

  if (ctx.action === 'rotate_code') return rotateCode(ctx, shareId, ctx.secret!);
  if (ctx.action === 'revoke') return revoke(ctx, shareId);
  if (ctx.action === 'update') return update(ctx, shareId);
  if (ctx.action === 'participants') return participants(ctx, shareId);
  return resend(ctx, shareId);
}
