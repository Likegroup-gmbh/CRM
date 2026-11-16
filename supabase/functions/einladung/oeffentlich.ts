// Öffentliche Einladungs-Aktionen ohne Sitzung: resolve (Kopfdaten) und verify (Code → Sitzung).

import { hashCode, timingSafeEqual } from '../_shared/zugang/krypto.ts';
import { clientIp, jsonRes } from '../_shared/zugang/http.ts';
import { codeVersucheGesperrt, einladungBereich, merkeVersuch, vergesseVersuch } from '../_shared/zugang/limit.ts';
import { SITZUNG_TTL_SEC, kopfdaten } from './daten.ts';
import type { EinladungKontext, EinladungRow } from './daten.ts';
import { signSitzung } from './sitzung.ts';

export async function resolveEinladung(ctx: EinladungKontext, einladung: EinladungRow): Promise<Response> {
  const kopf = await kopfdaten(ctx.admin, einladung);
  return jsonRes({
    valid: true,
    art: einladung.art,
    label: einladung.label,
    briefingTyp: einladung.briefing_typ,
    ...kopf,
  }, 200, ctx.headers);
}

export async function verifyEinladung(ctx: EinladungKontext, einladung: EinladungRow, secret: string): Promise<Response> {
  const { body, admin, headers } = ctx;
  const code = String(body.code ?? '').replace(/\D/g, '');
  let name = String(body.name ?? '').trim();
  // Konzept-Einladung: die Person steht fest, der Name kommt vom Casting-Eintrag, nicht vom Besucher.
  if (einladung.art === 'konzept') {
    const kopf = await kopfdaten(admin, einladung);
    name = String(kopf.eintragName ?? '').trim().slice(0, 80) || name;
  }
  if (!/^\d{6}$/.test(code)) return jsonRes({ error: 'Bitte den 6-stelligen Code eingeben.' }, 400, headers);
  if (name.length < 2 || name.length > 80) {
    return jsonRes({ error: 'Bitte Ihren Namen eingeben (2–80 Zeichen).' }, 400, headers);
  }

  const bereich = einladungBereich('verify');
  const ip = clientIp(ctx.req) || 'unknown';
  if (await codeVersucheGesperrt(admin, bereich, einladung.id, ip)) {
    return jsonRes({ error: 'Zu viele Versuche. Bitte 15 Minuten warten.' }, 429, headers);
  }
  const versuchId = await merkeVersuch(admin, bereich, einladung.id, ip);

  const incoming = await hashCode('einladung-code', code, secret);
  if (!timingSafeEqual(incoming, String(einladung.code_hash))) {
    return jsonRes({ error: 'Der Code ist ungültig.' }, 403, headers);
  }
  await vergesseVersuch(admin, bereich, versuchId);

  await admin.from('einladung').update({ last_access_at: new Date().toISOString() }).eq('id', einladung.id);
  return jsonRes({
    success: true,
    sitzung: await signSitzung(einladung.id, name, secret),
    ablaufSekunden: SITZUNG_TTL_SEC,
  }, 200, headers);
}
