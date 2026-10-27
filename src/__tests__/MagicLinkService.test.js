import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MagicLinkService } from '../modules/auth/MagicLinkService.js';

const TOKEN = 'a'.repeat(48);

function baueSupabase({ vorschau, signUp } = {}) {
  return {
    rpc: vi.fn(async () => vorschau ?? { data: null, error: null }),
    from: vi.fn(() => {
      throw new Error('Kein direkter Tabellenzugriff erlaubt');
    }),
    auth: {
      signUp: vi.fn(async () => signUp ?? { data: { user: { id: 'u1', identities: [{}] } }, error: null })
    }
  };
}

describe('MagicLinkService (kein Tabellenzugriff als anon)', () => {
  let service;

  beforeEach(() => {
    service = new MagicLinkService();
  });

  it('validateToken nutzt ausschliesslich die RPC magic_link_vorschau', async () => {
    window.supabase = baueSupabase({
      vorschau: {
        data: {
          valid: true,
          magic_link_id: 'ml1',
          expires_at: '2030-01-01T00:00:00Z',
          ansprechpartner: { id: 'ap1', vorname: 'A', nachname: 'B', unternehmen: [], marken: [] }
        },
        error: null
      }
    });

    const res = await service.validateToken(TOKEN);

    expect(window.supabase.rpc).toHaveBeenCalledWith('magic_link_vorschau', { p_token: TOKEN });
    expect(window.supabase.from).not.toHaveBeenCalled();
    expect(res.valid).toBe(true);
    expect(res.ansprechpartner.id).toBe('ap1');
    expect(res.magicLink.id).toBe('ml1');
  });

  it.each([
    ['used', 'Dieser Link wurde bereits verwendet'],
    ['expired', 'Dieser Link ist abgelaufen'],
    ['not_found', 'Ungültiger oder abgelaufener Link']
  ])('mappt Fehler %s auf deutschen Text', async (code, text) => {
    window.supabase = baueSupabase({ vorschau: { data: { valid: false, error: code }, error: null } });
    const res = await service.validateToken(TOKEN);
    expect(res).toEqual({ valid: false, error: text });
  });

  it('behandelt RPC-Fehler als ungültig', async () => {
    window.supabase = baueSupabase({ vorschau: { data: null, error: { message: 'boom' } } });
    const res = await service.validateToken(TOKEN);
    expect(res.valid).toBe(false);
  });

  it('registerWithMagicLink schickt nur den Token, keine Rolle, und schreibt nicht auf benutzer', async () => {
    window.supabase = baueSupabase({
      vorschau: { data: { valid: true, magic_link_id: 'ml1', ansprechpartner: { id: 'ap1' } }, error: null }
    });

    const res = await service.registerWithMagicLink(TOKEN, 'k@example.com', 'Passwort123!', 'Kunde');

    expect(res.success).toBe(true);
    const arg = window.supabase.auth.signUp.mock.calls[0][0];
    expect(arg.options.data.magic_token).toBe(TOKEN);
    expect(arg.options.data).not.toHaveProperty('role');
    expect(arg.options.data).not.toHaveProperty('subrole');
    expect(window.supabase.from).not.toHaveBeenCalled();
  });

  it('registerWithMagicLink bricht bei ungültigem Token ab, ohne signUp', async () => {
    window.supabase = baueSupabase({ vorschau: { data: { valid: false, error: 'used' }, error: null } });
    const res = await service.registerWithMagicLink(TOKEN, 'k@example.com', 'Passwort123!', 'Kunde');
    expect(res.success).toBe(false);
    expect(window.supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('registerWithMagicLink erkennt bereits registrierte E-Mail (identities leer)', async () => {
    window.supabase = baueSupabase({
      vorschau: { data: { valid: true, magic_link_id: 'ml1', ansprechpartner: { id: 'ap1' } }, error: null },
      signUp: { data: { user: { id: 'u1', identities: [] } }, error: null }
    });
    const res = await service.registerWithMagicLink(TOKEN, 'k@example.com', 'Passwort123!', 'Kunde');
    expect(res.success).toBe(false);
    expect(res.error).toContain('bereits');
  });
});
