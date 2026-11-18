// Testhilfen für den Teilen-Drawer.

import { vi } from 'vitest';

export function createListChain(result) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    update: vi.fn(() => chain),
    or: vi.fn(() => chain),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

export function createPartnerChain(partners) {
  const chain = {
    select: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve({ data: partners, error: null })),
  };
  return chain;
}

export function mockFrom({ shares = { data: [], error: null }, partners = [], skripte = { data: [], error: null } } = {}) {
  const shareChain = createListChain(shares);
  const partnerChain = createPartnerChain(partners);
  const skriptChain = createListChain(skripte);
  window.supabase.from = vi.fn((table) => {
    if (table === 'ansprechpartner') return partnerChain;
    if (table === 'skripte') return skriptChain;
    return shareChain;
  });
}

/** shareApi.plan als Mock: ohne Kundenkonten ist jede Adresse ein Gast. */
export function mockSharePlan(planMock, plan = null) {
  planMock.mockImplementation(async ({ emails } = {}) => plan || ({
    listLink: [],
    guest: [...(emails || [])],
    blocked: [],
  }));
}

/** Antwort von functions.invoke bei Status ≠ 2xx: data null, Body in error.context. */
export function httpFehler(status, body) {
  return { data: null, error: { message: 'non-2xx', context: { status, json: async () => body } } };
}

export function typeEmail(value) {
  const input = document.getElementById('share-email-tag-input');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}

export function pressEnter(el) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
}

export function shareRow(id, extra = {}) {
  return {
    id,
    token: `tok-${id}`,
    label: 'Marketing',
    rechte: 'ansehen',
    created_at: new Date().toISOString(),
    last_access_at: null,
    expires_at: null,
    ends_with_kampagne: true,
    share_participants: [],
    ...extra,
  };
}

/** Klick im Drei-Punkte-Menü einer Zeile, so wie ActionsDropdown das Portal an body hängt. */
export function klickMenue(shareId, action) {
  const container = document.querySelector(`[data-share-id="${shareId}"] .actions-dropdown-container`);
  const portal = container.querySelector('.actions-dropdown').cloneNode(true);
  portal.classList.replace('actions-dropdown', 'actions-dropdown-portal');
  portal._sourceContainer = container;
  document.body.appendChild(portal);
  portal.querySelector(`[data-action="${action}"]`).click();
  portal.remove();
}

/** functions.invoke je Action beantworten; unbekannte Actions bekommen success. */
export function mockActions(antworten) {
  window.supabase.functions.invoke.mockImplementation(async (_name, { body }) => ({
    data: { success: true, ...(antworten[body.action] || {}) },
    error: null,
  }));
}

export function actionsAufgerufen() {
  return window.supabase.functions.invoke.mock.calls.map((call) => call[1].body.action);
}
