/**
 * Gemeinsamer Mail-Code der Edge Functions (share-list, einladung).
 * Ein Resend-Versand, ein Absender-Format (Secret SHARE_FROM_EMAIL), ein HTML-Escape.
 * Die Netlify-Functions haben ihren eigenen Helper (netlify/functions/_shared/resend.js, Node).
 */

export const RESEND_API_URL = 'https://api.resend.com/emails';
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FROM_DISPLAY = 'LikeGroup';
const FROM_LOCAL = 'hello';

function rewriteFromAddress(addr: string): string {
  return addr.replace(/^noreply@/i, `${FROM_LOCAL}@`);
}

export function normalizeFromEmail(raw: string | undefined): string {
  const fallback = `${FROM_DISPLAY} <onboarding@resend.dev>`;
  const value = (raw ?? '').trim().replace(/^["']+|["']+$/g, '').trim();
  if (!value) return fallback;
  const nameAddr = value.match(/^(.*)<\s*([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)\s*>$/);
  if (nameAddr) {
    let name = nameAddr[1].trim().replace(/^["']+|["']+$/g, '').trim();
    if (!name || /^CreatorJobs24$/i.test(name)) name = FROM_DISPLAY;
    return `${name} <${rewriteFromAddress(nameAddr[2])}>`;
  }
  if (EMAIL_REGEX.test(value)) return `${FROM_DISPLAY} <${rewriteFromAddress(value)}>`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return `${FROM_DISPLAY} <${FROM_LOCAL}@${value}>`;
  console.error(`SHARE_FROM_EMAIL hat ungültiges Format: "${raw}" — Fallback auf ${fallback}`);
  return fallback;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface MailResult {
  ok: boolean;
  /** Lesbarer Grund bei Fehlschlag (Resend-Meldung, falls vorhanden). */
  error?: string;
}

/** Eine Mail über Resend. Absender kommt aus SHARE_FROM_EMAIL, Antworten gehen an replyTo (sonst an den Absender). */
export async function sendResendMail(
  p: { to: string; subject: string; html: string; replyTo?: string | null },
): Promise<MailResult> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { ok: false, error: 'E-Mail-Versand nicht konfiguriert: RESEND_API_KEY fehlt.' };
  const from = normalizeFromEmail(Deno.env.get('SHARE_FROM_EMAIL'));
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from,
        reply_to: p.replyTo || from,
        to: [p.to],
        subject: p.subject,
        html: p.html,
      }),
    });
    if (res.ok) return { ok: true };
    const text = await res.text();
    console.error(`Resend error ${res.status}: ${text}`);
    let detail = '';
    try { detail = JSON.parse(text)?.message || ''; } catch { /* raw */ }
    return { ok: false, error: `E-Mail-Versand fehlgeschlagen${detail ? `: ${detail}` : '.'}` };
  } catch (err) {
    console.error('Resend fetch error:', err);
    return { ok: false, error: `E-Mail-Versand fehlgeschlagen: ${String(err)}` };
  }
}
