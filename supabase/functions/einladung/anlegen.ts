// Staff-Aktion create für Produkt- und Briefing-Einladungen (Konzept: konzept.ts).

import { generateCode, generateToken, hashCode } from '../_shared/zugang/krypto.ts';
import { istUuid, jsonRes } from '../_shared/zugang/http.ts';
import { BRIEFING_TYPEN, parseEmpfaenger } from './felder.ts';
import { EINLADUNG_SPALTEN, NACHRICHT_MAX } from './daten.ts';
import type { EinladungRow, EinladungStaffKontext } from './daten.ts';
import { versendeEinladung } from './versand.ts';

interface Ziel {
  unternehmenId: string;
  markeId: string | null;
  produktionId: string | null;
  briefingTyp: string | null;
  briefingId: string | null;
}

/** Briefing: Firma und Marke kommen aus der Kampagne der Produktion. */
async function briefingZiel(ctx: EinladungStaffKontext): Promise<Ziel | Response> {
  const { body, admin, headers } = ctx;
  const produktionId = String(body.produktionId ?? '');
  const briefingTyp = String(body.briefingTyp ?? '');
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
  return {
    unternehmenId: kampagne.unternehmen_id,
    markeId: kampagne.marke_id ?? null,
    produktionId,
    briefingTyp,
    briefingId: null,
  };
}

/** Produkt: Firma, optional Marke und optional Linie (Produkte-Tab einer Linie, ADR 0057). */
async function produktZiel(ctx: EinladungStaffKontext): Promise<Ziel | Response> {
  const { body, admin, headers } = ctx;
  const unternehmenId = String(body.unternehmenId ?? '');
  const markeId: string | null = body.markeId ? String(body.markeId) : null;
  if (!istUuid(unternehmenId)) return jsonRes({ error: 'Ungültiges Unternehmen.' }, 400, headers);
  if (markeId) {
    if (!istUuid(markeId)) return jsonRes({ error: 'Ungültige Marke.' }, 400, headers);
    const { data: marke } = await admin.from('marke').select('id, unternehmen_id').eq('id', markeId).maybeSingle();
    if (!marke || marke.unternehmen_id !== unternehmenId) {
      return jsonRes({ error: 'Die Marke gehört nicht zu diesem Unternehmen.' }, 400, headers);
    }
  }
  let briefingId: string | null = null;
  if (body.briefingId) {
    const linie = String(body.briefingId);
    if (!istUuid(linie)) return jsonRes({ error: 'Ungültige Linie.' }, 400, headers);
    const { data: briefing } = await admin
      .from('campaign_briefings')
      .select('id, unternehmen_id')
      .eq('id', linie)
      .maybeSingle();
    if (!briefing) return jsonRes({ error: 'Linie nicht gefunden.' }, 404, headers);
    if (briefing.unternehmen_id !== unternehmenId) {
      return jsonRes({ error: 'Die Linie gehört nicht zu diesem Unternehmen.' }, 400, headers);
    }
    briefingId = linie;
  }
  return { unternehmenId, markeId, produktionId: null, briefingTyp: null, briefingId };
}

export async function erstelleEinladung(ctx: EinladungStaffKontext): Promise<Response> {
  const { body, admin, headers, secret, staff, origin } = ctx;
  const art = String(body.art ?? '');
  const label = String(body.label ?? '').trim().slice(0, 80);

  let ziel: Ziel | Response;
  if (art === 'briefing') ziel = await briefingZiel(ctx);
  else if (art === 'produkt') ziel = await produktZiel(ctx);
  else return jsonRes({ error: 'Ungültige Art.' }, 400, headers);
  if (ziel instanceof Response) return ziel;

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
      code_hash: await hashCode('einladung-code', code, secret),
      art,
      label: label || (art === 'briefing' ? 'Briefing-Einladung' : 'Produkt-Einladung'),
      unternehmen_id: ziel.unternehmenId,
      marke_id: ziel.markeId,
      produktion_id: ziel.produktionId,
      briefing_typ: ziel.briefingTyp,
      briefing_id: ziel.briefingId,
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
    basisUrl: origin,
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
