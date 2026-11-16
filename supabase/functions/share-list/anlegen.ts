// Staff-Aktionen create und send_account_links: Zugang anlegen, Listen-Links an Kundenkonten.

import { EMAIL_REGEX } from '../_shared/mail.ts';
import { teilenMail } from '../_shared/mail/index.ts';
import { classifyShareEmails } from '../_shared/share-recipients.ts';
import type { RecipientPlan } from '../_shared/share-recipients.ts';
import { generateCode, generateToken, hashCode } from '../_shared/zugang/krypto.ts';
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

function ungueltigeEmail(emails: string[]): string | null {
  return emails.find((email) => !EMAIL_REGEX.test(email) || email.length > 320) ?? null;
}

async function planOderFehler(ctx: StaffKontext, emails: string[], entityType: string, entityId: string): Promise<RecipientPlan | Response> {
  try {
    return await classifyShareEmails(ctx.admin, emails, entityType, entityId);
  } catch (err) {
    console.error('Empfänger-Aufteilung fehlgeschlagen:', err);
    return jsonRes({ error: 'Empfänger konnten nicht geprüft werden.' }, 500, ctx.headers);
  }
}

function skriptUmfang(raw: unknown, entityType: string, kampagneId: string | null): string | { error: string } {
  if (entityType !== 'skript') return 'einzeln';
  const scope = String(raw ?? 'einzeln');
  if (!['einzeln', 'kampagne'].includes(scope)) return { error: 'Ungültiger Skript-Umfang.' };
  if (scope === 'kampagne' && !kampagneId) return { error: 'Ohne Kampagne kann nur dieses Skript geteilt werden.' };
  return scope;
}

async function create(ctx: StaffKontext, secret: string): Promise<Response> {
  const { body, admin, headers, staff, origin } = ctx;
  const entityType = String(body.entityType ?? '');
  const entityId = String(body.entityId ?? '');
  const rechte = String(body.rechte ?? 'ansehen');
  const label = String(body.label ?? '').trim().slice(0, 80) || 'Zugang';
  const message = String(body.message ?? '').trim().slice(0, 500);
  const emails = parseEmails(body.emails ?? body.email);
  const endsWithKampagne = Boolean(body.endsWithKampagne);

  const entityConfig = ENTITY_CONFIG[entityType];
  if (!entityConfig) return jsonRes({ error: 'Ungültiger Listen-Typ.' }, 400, headers);
  if (!istUuid(entityId)) return jsonRes({ error: 'Ungültige Listen-ID.' }, 400, headers);
  if (!['ansehen', 'feedback'].includes(rechte)) return jsonRes({ error: 'Ungültige Rechte-Stufe.' }, 400, headers);
  const falsch = ungueltigeEmail(emails);
  if (falsch) return jsonRes({ error: `Ungültige E-Mail-Adresse: ${falsch}` }, 400, headers);

  const info = await entityName(admin, entityType, entityId);
  if (!info) return jsonRes({ error: 'Liste nicht gefunden.' }, 404, headers);

  const plan = await planOderFehler(ctx, emails, entityType, entityId);
  if (plan instanceof Response) return plan;

  const skriptScope = skriptUmfang(body.skriptScope, entityType, info.kampagneId);
  if (typeof skriptScope !== 'string') return jsonRes(skriptScope, 400, headers);
  const allScripts = entityType === 'skript' && skriptScope === 'kampagne';

  let expiresAt: string | null = null;
  if (body.expiresAt) {
    const d = new Date(String(body.expiresAt));
    if (Number.isNaN(d.getTime())) return jsonRes({ error: 'Ungültiges Ablaufdatum.' }, 400, headers);
    expiresAt = d.toISOString();
  }

  const accountMail = () => mailAccountLinks({
    emails: plan.listLink,
    entityType,
    entityId,
    entityLabel: entityConfig.label,
    entityName: info.name,
    sharedByName: staff.name || 'Ihr Ansprechpartner',
    origin,
  });

  if (emails.length > 0 && plan.guest.length === 0) {
    const accountResult = await accountMail();
    if (plan.listLink.length > 0 && accountResult.error && accountResult.sent === 0) {
      return jsonRes({ error: accountResult.error, plan }, 502, headers);
    }
    return jsonRes({ success: true, link: null, code: null, shareId: null, mailed: accountResult.sent, plan }, 200, headers);
  }

  const token = generateToken();
  const code = generateCode();
  const { data: inserted, error: insertError } = await admin
    .from('list_shares')
    .insert({
      token,
      entity_type: entityType,
      entity_id: entityId,
      rechte,
      label,
      code_hash: await hashCode('share-code', code, secret),
      expires_at: expiresAt,
      ends_with_kampagne: endsWithKampagne && Boolean(info.kampagneId),
      skript_scope: skriptScope,
      created_by: staff.id,
      empfaenger_emails: plan.guest,
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    console.error('list_shares insert error:', insertError);
    return jsonRes({ error: 'Zugang konnte nicht angelegt werden.' }, 500, headers);
  }

  const link = `${origin}/share/${token}`;
  const paket = entityType === 'skript_paket';
  const mailName = (allScripts || paket)
    ? (await kampagneDisplayName(admin, info.kampagneId)) || info.name
    : info.name;

  const mailResult = await sendInviteMails({
    emails: plan.guest,
    mail: teilenMail({
      entityLabel: entityConfig.label,
      entityArticle: entityConfig.article,
      entityName: mailName,
      sharedByName: staff.name || 'Ihr Ansprechpartner',
      rechte,
      link,
      code,
      message: message || undefined,
      allScripts: allScripts || paket,
      titles: paket ? scriptTitleList(body.scriptTitles) : undefined,
      basisUrl: origin,
    }),
  });
  const accountResult = await accountMail();

  if (plan.guest.length > 0 && mailResult.error && mailResult.sent === 0) {
    return jsonRes({ error: `Zugang angelegt, aber ${mailResult.error}`, link, code, shareId: inserted.id, plan }, 502, headers);
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

async function sendAccountLinks(ctx: StaffKontext): Promise<Response> {
  const { body, admin, headers, staff, origin } = ctx;
  const entityType = String(body.entityType ?? '');
  const entityId = String(body.entityId ?? '');
  const entityConfig = ENTITY_CONFIG[entityType];
  if (!entityConfig) return jsonRes({ error: 'Ungültiger Listen-Typ.' }, 400, headers);
  if (!istUuid(entityId)) return jsonRes({ error: 'Ungültige Listen-ID.' }, 400, headers);
  const info = await entityName(admin, entityType, entityId);
  if (!info) return jsonRes({ error: 'Liste nicht gefunden.' }, 404, headers);

  const plan = await planOderFehler(ctx, parseEmails(body.emails ?? body.email), entityType, entityId);
  if (plan instanceof Response) return plan;
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

export async function handleAnlegen(ctx: StaffKontext): Promise<Response | null> {
  if (ctx.action === 'create') {
    if (!ctx.secret) {
      return jsonRes({ error: 'Gast-Zugang nicht konfiguriert: JWT_SECRET fehlt als Secret.' }, 500, ctx.headers);
    }
    return create(ctx, ctx.secret);
  }
  if (ctx.action === 'send_account_links') return sendAccountLinks(ctx);
  return null;
}
