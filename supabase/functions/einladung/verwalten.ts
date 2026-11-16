// Staff-Aktionen an einer bestehenden Einladung: rotate_code, resend, revoke.

import { generateCode, hashCode } from '../_shared/zugang/krypto.ts';
import { istUuid, jsonRes } from '../_shared/zugang/http.ts';
import { parseEmpfaenger } from './felder.ts';
import { EINLADUNG_SPALTEN, NACHRICHT_MAX, konzeptGesperrt, nutzbar } from './daten.ts';
import type { EinladungRow, EinladungStaffKontext } from './daten.ts';
import { versendeEinladung } from './versand.ts';

async function neuerCode(ctx: EinladungStaffKontext, einladungId: string): Promise<string | null> {
  const code = generateCode();
  const { error } = await ctx.admin
    .from('einladung')
    .update({ code_hash: await hashCode('einladung-code', code, ctx.secret) })
    .eq('id', einladungId)
    .is('revoked_at', null);
  return error ? null : code;
}

async function resend(ctx: EinladungStaffKontext, einladungId: string): Promise<Response> {
  const { body, admin, headers, staff, origin } = ctx;
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
  const gesperrt = nutzbar(einladungRow) || await konzeptGesperrt(admin, einladungRow);
  if (gesperrt) return jsonRes({ error: gesperrt }, 400, headers);

  // Der Code liegt nur als Hash vor: für den Versand wird ein neuer erzeugt.
  const code = await neuerCode(ctx, einladungId);
  if (!code) return jsonRes({ error: 'Code konnte nicht erneuert werden.' }, 500, headers);

  const link = `${origin}/einladung/${einladungRow.token}`;
  const versand = await versendeEinladung(admin, einladungRow, {
    link,
    code,
    basisUrl: origin,
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

export async function verwalteEinladung(ctx: EinladungStaffKontext): Promise<Response> {
  const { body, admin, headers, action } = ctx;
  const einladungId = String(body.einladungId ?? '');
  if (!istUuid(einladungId)) return jsonRes({ error: 'Ungültige Einladungs-ID.' }, 400, headers);

  if (action === 'rotate_code') {
    const code = await neuerCode(ctx, einladungId);
    if (!code) return jsonRes({ error: 'Code konnte nicht erneuert werden.' }, 500, headers);
    return jsonRes({ success: true, code }, 200, headers);
  }

  if (action === 'resend') return resend(ctx, einladungId);

  const { error } = await admin
    .from('einladung')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', einladungId);
  if (error) return jsonRes({ error: 'Widerruf fehlgeschlagen.' }, 500, headers);
  return jsonRes({ success: true }, 200, headers);
}
