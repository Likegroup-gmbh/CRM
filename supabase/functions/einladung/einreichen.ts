// Öffentliche Einladungs-Aktionen mit Sitzung: upload_url und submit.

import { sendResendMail } from '../_shared/mail.ts';
import { einreichungMail } from '../_shared/mail/index.ts';
import { clientIp, jsonRes } from '../_shared/zugang/http.ts';
import { einladungBereich, merkeVersuch, zaehleVersuche } from '../_shared/zugang/limit.ts';
import {
  BILD_MIME,
  MAX_DATEI_BYTES,
  UPLOAD_MIME,
  bereinigeBriefing,
  bereinigeKonzept,
  bereinigeProdukt,
  pruefeEinreichung,
} from './felder.ts';
import { BUCKET, OFFEN_MAX, SUBMIT_MAX_PRO_STUNDE, UPLOAD_MAX_PRO_STUNDE, kopfdaten, ladeEintrag } from './daten.ts';
import type { Admin, EinladungKontext, EinladungRow } from './daten.ts';

export async function uploadUrl(ctx: EinladungKontext, einladung: EinladungRow): Promise<Response> {
  const { body, admin, headers } = ctx;
  if (einladung.art === 'konzept') return jsonRes({ error: 'Hier sind keine Uploads vorgesehen.' }, 400, headers);
  const slot = String(body.slot ?? '');
  const mime = String(body.mime ?? '');
  const groesse = Number(body.groesse ?? 0);
  const erlaubt: readonly string[] = slot === 'bild' ? BILD_MIME : UPLOAD_MIME;
  if (!['bild', 'referenz'].includes(slot)) return jsonRes({ error: 'Ungültiger Upload.' }, 400, headers);
  if (!erlaubt.includes(mime)) return jsonRes({ error: 'Dieser Dateityp ist nicht erlaubt.' }, 400, headers);
  if (!Number.isFinite(groesse) || groesse <= 0 || groesse > MAX_DATEI_BYTES) {
    return jsonRes({ error: 'Die Datei ist zu groß (max. 25 MB).' }, 400, headers);
  }

  const bereich = einladungBereich('upload');
  const ip = clientIp(ctx.req) || 'unknown';
  if (await zaehleVersuche(admin, bereich, einladung.id, 60) >= UPLOAD_MAX_PRO_STUNDE) {
    return jsonRes({ error: 'Zu viele Uploads. Bitte später erneut versuchen.' }, 429, headers);
  }
  await merkeVersuch(admin, bereich, einladung.id, ip);

  const sauber = String(body.name ?? 'datei').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'datei';
  const pfad = `${einladung.id}/${crypto.randomUUID()}_${sauber}`;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(pfad);
  if (error || !data) {
    console.error('createSignedUploadUrl error:', error);
    return jsonRes({ error: 'Upload konnte nicht vorbereitet werden.' }, 500, headers);
  }
  return jsonRes({ success: true, pfad, token: data.token }, 200, headers);
}

/** Nur Dateien übernehmen, die wirklich hochgeladen wurden. */
async function vorhandeneDateien<D extends { pfad: string }>(
  admin: Admin,
  einladung: EinladungRow,
  bereinigt: { formData: unknown; dateien: D[] },
): Promise<D[]> {
  if (!bereinigt.dateien.length) return bereinigt.dateien;
  const { data: liste } = await admin.storage.from(BUCKET).list(einladung.id, { limit: 200 });
  const vorhanden = new Set((liste || []).map((f: { name: string }) => `${einladung.id}/${f.name}`));
  const dateien = bereinigt.dateien.filter((d) => vorhanden.has(d.pfad));
  const gueltig = new Set(dateien.map((d) => d.pfad));
  const fd = bereinigt.formData as Record<string, unknown>;
  if (Array.isArray(fd.bilder)) fd.bilder = (fd.bilder as { pfad: string }[]).filter((b) => gueltig.has(b.pfad));
  if (Array.isArray(fd.referenzen)) {
    fd.referenzen = (fd.referenzen as { typ: string; value: string }[])
      .filter((r) => r.typ !== 'upload' || gueltig.has(r.value));
  }
  return dateien;
}

/** Link in der Mail an den Einladenden: dorthin, wo die Einreichung auftaucht. */
async function zielLink(admin: Admin, einladung: EinladungRow, origin: string): Promise<string> {
  const produktionDerLinie = async (linieId: string) => {
    const { data: linie } = await admin
      .from('campaign_briefings')
      .select('produktion_id')
      .eq('id', linieId)
      .maybeSingle();
    return linie?.produktion_id ?? null;
  };

  if (einladung.art === 'briefing' && einladung.produktion_id) {
    return `${origin}/produktion/${einladung.produktion_id}?tab=briefing`;
  }
  if (einladung.art === 'produkt' && einladung.briefing_id) {
    // Einladung von einer Linie: Link auf deren Produkte-Tab (ADR 0057).
    const produktionId = await produktionDerLinie(einladung.briefing_id);
    return produktionId ? `${origin}/produktion/${produktionId}?tab=produkte` : `${origin}/produkt`;
  }
  if (einladung.art === 'konzept') {
    // Konzept-Einladung: Link auf den Konzepte-Tab der Linie (ADR 0059).
    let linieId = einladung.briefing_id;
    if (!linieId && einladung.creator_auswahl_item_id) {
      linieId = (await ladeEintrag(admin, einladung.creator_auswahl_item_id))?.creator_auswahl?.briefing_id ?? null;
    }
    const produktionId = linieId ? await produktionDerLinie(linieId) : null;
    return produktionId ? `${origin}/produktion/${produktionId}?tab=konzepte` : `${origin}/kampagne`;
  }
  return `${origin}/produkt`;
}

/** Eine Mail pro Einreichung an die Person, die eingeladen hat. Ein Fehler hier ändert nichts am Absenden. */
async function meldeEinreichung(ctx: EinladungKontext, einladung: EinladungRow, einreicherName: string) {
  if (!einladung.created_by) return;
  const { admin, origin } = ctx;
  const { data: ersteller } = await admin
    .from('benutzer')
    .select('email, name')
    .eq('id', einladung.created_by)
    .maybeSingle();
  if (!ersteller?.email) return;
  const kopf = await kopfdaten(admin, einladung);
  const firma = [kopf.firmenname, kopf.markenname].filter(Boolean).join(' · ');
  const mail = einreichungMail({
    art: einladung.art,
    einreicherName,
    einladungLabel: einladung.label,
    kunde: firma || undefined,
    link: await zielLink(admin, einladung, origin),
    basisUrl: origin,
  });
  await sendResendMail({ to: ersteller.email, subject: mail.betreff, html: mail.html });
}

export async function submit(
  ctx: EinladungKontext,
  einladung: EinladungRow,
  sitzung: { name: string },
): Promise<Response> {
  const { body, admin, headers } = ctx;
  const bereich = einladungBereich('submit');
  const ip = clientIp(ctx.req) || 'unknown';
  if (await zaehleVersuche(admin, bereich, einladung.id, 60) >= SUBMIT_MAX_PRO_STUNDE) {
    return jsonRes({ error: 'Zu viele Einreichungen. Bitte später erneut versuchen.' }, 429, headers);
  }
  const { count: offen } = await admin
    .from('einreichung')
    .select('id', { count: 'exact', head: true })
    .eq('einladung_id', einladung.id)
    .eq('status', 'offen');
  if ((offen ?? 0) >= OFFEN_MAX) {
    return jsonRes({ error: 'Es liegen schon sehr viele offene Einreichungen vor. Bitte beim Team melden.' }, 429, headers);
  }

  const bereinigt = einladung.art === 'produkt'
    ? bereinigeProdukt(body.formData, { einladungId: einladung.id })
    : einladung.art === 'konzept'
      ? bereinigeKonzept(body.formData)
      : bereinigeBriefing(body.formData, { einladungId: einladung.id, bereich: String(einladung.briefing_typ) });

  const fehler = pruefeEinreichung(einladung.art, bereinigt.formData);
  if (fehler) return jsonRes({ error: fehler }, 400, headers);

  const dateien = await vorhandeneDateien(admin, einladung, bereinigt);

  await merkeVersuch(admin, bereich, einladung.id, ip);
  const { data: einreichung, error } = await admin
    .from('einreichung')
    .insert({
      einladung_id: einladung.id,
      absender_name: sitzung.name || 'Unbekannt',
      payload: { formData: bereinigt.formData },
      dateien,
    })
    .select('id')
    .single();
  if (error || !einreichung) {
    console.error('einreichung insert error:', error);
    return jsonRes({ error: 'Die Einreichung konnte nicht gespeichert werden.' }, 500, headers);
  }

  await meldeEinreichung(ctx, einladung, sitzung.name);
  return jsonRes({ success: true, einreichungId: einreichung.id }, 200, headers);
}
