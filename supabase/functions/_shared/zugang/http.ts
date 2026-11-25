// HTTP-Hilfen der Zugangs-Functions: CORS, JSON-Antwort, Client-IP.

export function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function jsonRes(data: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export function istUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

/**
 * cf-connecting-ip setzt Cloudflare selbst; der erste x-forwarded-for-Eintrag kommt vom Client.
 * Kein IP-Header ist garantiert echt, deshalb gilt zusätzlich das Limit pro Token (limit.ts).
 */
export function clientIp(req: Request): string {
  const direkt = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '';
  const weitergeleitet = (req.headers.get('x-forwarded-for') || '').split(',')[0];
  return (direkt || weitergeleitet).trim().slice(0, 64);
}

/** Für diag: welche IP-Header kommen an (ohne Werte). */
export function ipHeaderDiagnose(req: Request): Record<string, unknown> {
  return {
    cfConnectingIp: req.headers.has('cf-connecting-ip'),
    xRealIp: req.headers.has('x-real-ip'),
    xForwardedForEintraege: (req.headers.get('x-forwarded-for') || '').split(',').filter((s) => s.trim()).length,
  };
}
