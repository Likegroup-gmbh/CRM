import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SharesAdminPage } from '../modules/shares/SharesAdminPage.js';

function createChain(result) {
  const chain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    in: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };
  return chain;
}

describe('SharesAdminPage Zugänge', () => {
  beforeEach(() => {
    window.isInternal = () => true;
    window.setHeadline = vi.fn();
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
    window.toastSystem = { show: vi.fn() };
    window.supabase = { from: vi.fn() };
  });

  it('zeigt Label und Teilnehmer statt E-Mail-Spalte', async () => {
    const sharesChain = createChain({
      data: [{
        id: 's1',
        token: 'tok',
        entity_type: 'kampagne',
        entity_id: 'k1',
        label: 'Kunde Nord',
        rechte: 'feedback',
        created_at: new Date().toISOString(),
        last_access_at: null,
        revoked_at: null,
        expires_at: null,
        ends_with_kampagne: true,
        ersteller: { name: 'Oliver' },
        share_participants: [{ id: 'p1', name: 'Eileen', last_seen_at: null }],
      }],
      error: null,
    });
    window.supabase.from.mockImplementation((table) => {
      if (table === 'list_shares') return sharesChain;
      return createChain({ data: [{ id: 'k1', eigener_name: 'Nord-Kampagne' }], error: null });
    });

    const page = new SharesAdminPage();
    await page.init();

    expect(window.content.textContent).toContain('Kunde Nord');
    expect(window.content.textContent).toContain('Eileen');
    expect(window.content.textContent).toContain('Teilnehmer');
    expect(window.content.textContent).not.toContain('E-Mail');
  });
});
