/**
 * share-list: Zugänge per Link + Code, ohne Gast-Account. Nur Router.
 *
 * Öffentlich (guest.ts):
 *  - diag, resolve, verify (token + code + name → Gast-JWT, 30 Tage, rate-limitiert)
 * Staff-JWT:
 *  - anlegen.ts:   create, send_account_links
 *  - verwalten.ts: rotate_code, revoke, update, participants, resend, plan
 *  - vorschau.ts:  preview (Gast-Ansicht ohne Code, 1 h, nur lesen)
 *
 * Ops: JWT_SECRET (oder SUPABASE_JWT_SECRET / GUEST_JWT_SECRET) muss als
 * Edge-Function-Secret gesetzt sein, damit PostgREST das Gast-JWT akzeptiert.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonRes } from '../_shared/zugang/http.ts';
import { jwtSecret, requireStaff } from '../_shared/zugang/staff.ts';
import { handleGuestAction } from './guest.ts';
import { handleAnlegen } from './anlegen.ts';
import { handleVerwalten } from './verwalten.ts';
import { handleVorschau } from './vorschau.ts';
import type { ShareKontext } from './support.ts';

serve(async (req: Request) => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers });
  if (req.method !== 'POST') return jsonRes({ error: 'Method Not Allowed' }, 405, headers);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: 'Ungültiger JSON-Body.' }, 400, headers);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const ctx: ShareKontext = {
    req,
    body,
    admin,
    headers,
    action: String(body.action ?? ''),
    secret: jwtSecret(),
    origin: req.headers.get('origin') || Deno.env.get('APP_BASE_URL') || '',
  };

  const guestResponse = await handleGuestAction(ctx);
  if (guestResponse) return guestResponse;

  const auth = await requireStaff(admin, req, 'Nur Mitarbeiter können Listen teilen.');
  if ('error' in auth) return jsonRes({ error: auth.error }, auth.status, headers);
  const staffCtx = { ...ctx, staff: auth.staff };

  return (await handleAnlegen(staffCtx))
    ?? (await handleVorschau(staffCtx))
    ?? (await handleVerwalten(staffCtx))
    ?? jsonRes({ error: 'Unbekannte Action.' }, 400, headers);
});
