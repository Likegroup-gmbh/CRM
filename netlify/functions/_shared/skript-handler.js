// skript-handler.js
// Dedupliziertes Boilerplate der Skript-Background-Functions:
// POST-Check, Supabase-Service-Client, Bearer-Auth, Intern-Check, JSON-Parse.
// Die eigentliche Logik liegt in fn({ supabase, user, payload }).

const { createClient } = require('@supabase/supabase-js');
const { verifyAuth, requireInternal, authErrorBody } = require('./verify-auth');

function withSkriptHandler(fn) {
  return async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const auth = await verifyAuth(event, supabase);
    if (!auth.user) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authErrorBody(auth))
      };
    }
    const intern = await requireInternal(supabase, auth.user);
    if (!intern.ok) return intern.response;

    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (_) {
      return { statusCode: 400, body: 'Invalid JSON' };
    }

    return fn({ supabase, user: auth.user, payload, event });
  };
}

module.exports = { withSkriptHandler };
