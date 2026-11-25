// skriptEditorTestKit.js
// Gemeinsame Fakes für Skript-Editor-Tests: Fenster-Globals (Rollen, Supabase)
// und ein geladenes Skript. vi.mock bleibt in der jeweiligen Testdatei.

import { vi } from 'vitest';

export const skriptFixture = {
  id: 's1',
  skript_nr: 3,
  titel: 'Morgenroutine',
  kampagne_id: 'k1',
  briefing_id: 'b1',
  status: 'entwurf',
  hook: 'Hook',
  hauptteil: 'Hauptteil',
  cta: 'CTA',
  created_at: '2026-08-20'
};

/** Interner Admin mit Bearbeiten-Recht; intern = false spielt den Kunden. */
export function setupEditorWindow({ intern = true } = {}) {
  window.isKunde = vi.fn(() => !intern);
  window.isAdmin = vi.fn(() => intern);
  window.isInternal = vi.fn(() => intern);
  window.canEdit = vi.fn(() => true);
  window.currentUser = { id: 'user-1', rolle: intern ? 'admin' : 'kunde' };
  window.setHeadline = vi.fn();
  window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
  window.toastSystem = { show: vi.fn() };
  window.supabase = {
    removeChannel: vi.fn(),
    channel: vi.fn(() => ({ on: vi.fn(() => ({ subscribe: vi.fn() })) })),
    from: vi.fn(() => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => Promise.resolve({ data: [], error: null }),
        order: () => Promise.resolve({ data: [], error: null })
      };
      return chain;
    })
  };
}
