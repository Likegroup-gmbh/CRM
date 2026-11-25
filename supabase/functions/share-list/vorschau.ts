// Staff-Aktion preview: Gast-Ansicht eines Zugangs ohne Code, kurzlebig und nur lesend.
// Nur lesend erzwingt die RLS über den Claim vorschau (share_claim_ist_vorschau).

import { signJwt } from '../_shared/zugang/krypto.ts';
import { jsonRes } from '../_shared/zugang/http.ts';
import { VORSCHAU_TTL_SEC, gueltigerToken, ladeShare, pruefeShare, shareAntwort } from './support.ts';
import type { StaffKontext } from './support.ts';

export async function handleVorschau(ctx: StaffKontext): Promise<Response | null> {
  if (ctx.action !== 'preview') return null;
  const { headers, secret, staff } = ctx;
  if (!secret) return jsonRes({ error: 'Gast-Zugang nicht konfiguriert: JWT_SECRET fehlt als Secret.' }, 500, headers);

  const token = gueltigerToken(ctx.body.token);
  if (!token) return jsonRes({ error: 'Ungültiger Token.' }, 400, headers);
  const share = await ladeShare(ctx, token);
  if (share instanceof Response) return share;
  const { gesperrt, info } = await pruefeShare(ctx.admin, share);
  if (gesperrt) return jsonRes({ valid: false, error: gesperrt }, 403, headers);

  const name = `Vorschau: ${staff.name || 'Mitarbeiter'}`.slice(0, 80);
  const nowSec = Math.floor(Date.now() / 1000);
  const jwt = await signJwt({
    role: 'anon',
    iss: `${Deno.env.get('SUPABASE_URL')}/auth/v1`,
    aud: 'authenticated',
    sub: crypto.randomUUID(),
    iat: nowSec,
    exp: nowSec + VORSCHAU_TTL_SEC,
    share_id: share.id,
    participant_id: null,
    vorschau: true,
    name,
  }, secret);

  return jsonRes({
    jwt,
    ...shareAntwort(share, info),
    rechte: 'ansehen',
    name,
    participantId: null,
    vorschau: true,
  }, 200, headers);
}
