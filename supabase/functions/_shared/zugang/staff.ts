// Mitarbeiter-Prüfung und JWT-Secret der Zugangs-Functions.

import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Admin = ReturnType<typeof createClient>;

export interface Staff {
  id: string;
  name: string | null;
  email: string | null;
  rolle: string;
}

export function jwtSecret(): string | null {
  return Deno.env.get('JWT_SECRET')
    || Deno.env.get('SUPABASE_JWT_SECRET')
    || Deno.env.get('GUEST_JWT_SECRET')
    || null;
}

/** Nur freigeschaltete Admins und Mitarbeiter. */
export async function requireStaff(
  admin: Admin,
  req: Request,
  verbotText = 'Nur Mitarbeiter haben Zugriff.',
): Promise<{ staff: Staff } | { error: string; status: number }> {
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return { error: 'Nicht autorisiert.', status: 401 };
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return { error: 'Nicht autorisiert.', status: 401 };
  const { data: staff } = await admin
    .from('benutzer')
    .select('id, name, email, rolle, freigeschaltet')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!staff || staff.freigeschaltet !== true || !['admin', 'mitarbeiter'].includes(staff.rolle)) {
    return { error: verbotText, status: 403 };
  }
  return { staff: { id: staff.id, name: staff.name ?? null, email: staff.email ?? null, rolle: staff.rolle } };
}
