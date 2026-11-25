// Einladungsmail: eine Mail pro Empfänger mit Link und Code, Antworten gehen an den Einladenden.

import { sendResendMail } from '../_shared/mail.ts';
import { einladungMail } from '../_shared/mail/index.ts';
import { kopfdaten } from './daten.ts';
import type { Admin, EinladungRow } from './daten.ts';

export async function versendeEinladung(
  admin: Admin,
  e: EinladungRow,
  p: {
    link: string;
    code: string;
    basisUrl: string;
    emails: string[];
    nachricht: string;
    staff: { name?: string | null; email?: string | null };
  },
): Promise<{ gesendet: string[]; fehlgeschlagen: string[]; fehler?: string }> {
  const gesendet: string[] = [];
  const fehlgeschlagen: string[] = [];
  let fehler: string | undefined;
  if (p.emails.length === 0) return { gesendet, fehlgeschlagen };

  const kopf = await kopfdaten(admin, e);
  const kunde = [kopf.firmenname, kopf.markenname].filter(Boolean).join(' · ');
  const { betreff, html } = einladungMail({
    art: e.art,
    briefingTyp: e.briefing_typ,
    absenderName: (p.staff.name || '').trim(),
    kunde: kunde || undefined,
    nachricht: p.nachricht || undefined,
    code: p.code,
    link: p.link,
    basisUrl: p.basisUrl,
  });

  for (const to of p.emails) {
    const result = await sendResendMail({ to, subject: betreff, html, replyTo: p.staff.email });
    if (!result.ok) fehler = result.error;
    (result.ok ? gesendet : fehlgeschlagen).push(to);
  }
  return { gesendet, fehlgeschlagen, fehler };
}
