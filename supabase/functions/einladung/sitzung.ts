// Sitzungs-Token nach richtigem Code: gilt nur für diese Einladung, trägt den Namen des Absenders.

import { b64url, fromB64url, hmac, timingSafeEqual } from '../_shared/zugang/krypto.ts';
import { SITZUNG_TTL_SEC } from './daten.ts';

export async function signSitzung(einladungId: string, name: string, secret: string): Promise<string> {
  const body = b64url(JSON.stringify({
    eid: einladungId,
    name,
    exp: Math.floor(Date.now() / 1000) + SITZUNG_TTL_SEC,
  }));
  return `${body}.${await hmac(`einladung-sitzung:${body}`, secret)}`;
}

export async function pruefeSitzung(
  sitzung: string,
  einladungId: string,
  secret: string,
): Promise<{ name: string } | null> {
  const [body, sig] = String(sitzung || '').split('.');
  if (!body || !sig) return null;
  const expected = await hmac(`einladung-sitzung:${body}`, secret);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const claims = JSON.parse(fromB64url(body)) as { eid: string; name: string; exp: number };
    if (claims.eid !== einladungId) return null;
    if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
    return { name: String(claims.name || '') };
  } catch {
    return null;
  }
}
