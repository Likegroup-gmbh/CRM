import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const verifyAuth = require('../../netlify/functions/_shared/verify-auth.js');

const USERS = {
  'tok-staff': { id: 'u-staff', rolle: 'mitarbeiter' },
  'tok-kunde': { id: 'u-kunde', rolle: 'kunde' },
};

const getUser = vi.fn(async (token) => (
  USERS[token]
    ? { data: { user: { id: USERS[token].id } }, error: null }
    : { data: { user: null }, error: { status: 401, code: 'bad_jwt', message: 'bad jwt' } }
));

function fakeClient() {
  return {
    auth: { getUser },
    from() {
      const filters = {};
      const chain = {
        select: () => chain,
        eq: (col, val) => { filters[col] = val; return chain; },
        limit: () => chain,
        maybeSingle: async () => {
          const u = Object.values(USERS).find((x) => x.id === filters.auth_user_id);
          return { data: u ? { id: `b-${u.id}`, rolle: u.rolle } : null, error: null };
        },
      };
      return chain;
    },
  };
}

const event = (token) => ({ httpMethod: 'POST', headers: { authorization: `Bearer ${token}` }, body: '{}' });

beforeEach(() => {
  verifyAuth._clearStaffCache();
  getUser.mockClear();
});

describe('requireStaff Cache', () => {
  it('fragt GoTrue pro Token nur einmal, auch bei mehreren Aufrufen', async () => {
    const client = fakeClient();
    for (let i = 0; i < 3; i++) {
      const res = await verifyAuth.requireStaff(event('tok-staff'), client);
      expect(res.ok).toBe(true);
    }
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('cached keine Ablehnungen', async () => {
    const client = fakeClient();
    const erste = await verifyAuth.requireStaff(event('tok-kunde'), client);
    await verifyAuth.requireStaff(event('tok-kunde'), client);
    expect(erste.ok).toBe(false);
    expect(erste.response.statusCode).toBe(403);
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});
