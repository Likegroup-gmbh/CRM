// Kern von management-anfrage-send: eine Mail pro Person, eigener Link, kein Anhang.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const { sendManagementAnfragen, pageBaseFromEvent } = require('../../netlify/functions/management-anfrage-send.js');

const PAGE = 'https://likebase.example';

function lookupChain(rowFor) {
  const state = { id: null };
  const chain = {
    select: () => chain,
    eq: (_col, id) => {
      state.id = id;
      return chain;
    },
    maybeSingle: () => Promise.resolve(rowFor(state.id)),
  };
  return chain;
}

function makeSupabase() {
  const inserts = [];
  const deletes = [];
  const supabase = {
    from: vi.fn((table) => {
      if (table === 'creator_auswahl') {
        return lookupChain((id) => ({
          data: id === 'liste-1' ? { id: 'liste-1' } : null,
          error: null,
        }));
      }
      if (table === 'management') {
        return lookupChain((id) => {
          if (id === 'm1') return { data: { id: 'm1', firmenname: 'Studio One', email: 'hallo@studio.test' }, error: null };
          if (id === 'm-ohne') return { data: { id: 'm-ohne', firmenname: 'Ohne Mail', email: null }, error: null };
          return { data: null, error: null };
        });
      }
      if (table === 'ansprechpartner') {
        return lookupChain((id) => {
          if (id === 'p1') {
            return { data: { id: 'p1', vorname: 'Lea', nachname: 'Klein', email: 'lea@studio.test', management_id: 'm1' }, error: null };
          }
          if (id === 'p-other') {
            return { data: { id: 'p-other', vorname: 'Kim', nachname: 'S', email: 'kim@other.test', management_id: 'other' }, error: null };
          }
          return { data: null, error: null };
        });
      }
      if (table === 'management_anfrage_link') {
        return {
          insert: (row) => {
            inserts.push(row);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: `link-${inserts.length}` }, error: null }),
              }),
            };
          },
          delete: () => ({
            eq: (_col, id) => {
              deletes.push(id);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      throw new Error(`unerwartete Tabelle ${table}`);
    }),
  };
  return { supabase, inserts, deletes };
}

function tokenFrom(html) {
  return html.match(/token=([a-f0-9]{64})/)?.[1];
}

describe('sendManagementAnfragen', () => {
  it('schickt jeder Person eine eigene Mail mit Link und ohne Anhang', async () => {
    const { supabase, inserts } = makeSupabase();
    const mails = [];
    const sendMail = vi.fn(async (mail) => {
      mails.push(mail);
      return { ok: true, id: 're_1' };
    });

    const result = await sendManagementAnfragen(
      { supabase, sendMail, benutzerId: 'user-1', pageBase: PAGE },
      {
        castingId: 'liste-1',
        betreff: 'Creator für Forgeworks',
        body: 'Über den Link kannst du Creator vorschlagen.',
        empfaenger: [
          { managementId: 'm1', ansprechpartnerId: 'p1' },
          { managementId: 'm1' },
        ],
      }
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ sent: 2, failed: 0, total: 2 });
    const byTo = Object.fromEntries(mails.map((mail) => [mail.to, mail]));
    expect(Object.keys(byTo).sort()).toEqual(['hallo@studio.test', 'lea@studio.test']);
    expect(byTo['lea@studio.test'].subject).toBe('Creator für Forgeworks');
    expect(byTo['lea@studio.test'].attachments).toBeUndefined();
    expect(byTo['lea@studio.test'].html).toContain('Creator vorschlagen');
    expect(byTo['lea@studio.test'].html).not.toContain('hängen als PDF');

    const byEmail = Object.fromEntries(inserts.map((row) => [row.email, row]));
    for (const [email, mail] of Object.entries(byTo)) {
      const token = tokenFrom(mail.html);
      expect(byEmail[email].token_hash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
      expect(byEmail[email].created_by).toBe('user-1');
    }
    expect(new Set(mails.map((mail) => tokenFrom(mail.html))).size).toBe(2);
    expect(byEmail['lea@studio.test'].ansprechpartner_id).toBe('p1');
    expect(byEmail['hallo@studio.test'].ansprechpartner_id).toBeNull();
  });

  it('legt keinen Link an, wenn die Adresse fehlt oder die Person fremd ist', async () => {
    const { supabase, inserts } = makeSupabase();
    const sendMail = vi.fn();
    const result = await sendManagementAnfragen(
      { supabase, sendMail, benutzerId: 'user-1', pageBase: PAGE },
      {
        castingId: 'liste-1',
        betreff: 'Creator',
        body: 'Text',
        empfaenger: [
          { managementId: 'm-ohne' },
          { managementId: 'm1', ansprechpartnerId: 'p-other' },
        ],
      }
    );
    expect(result.body.sent).toBe(0);
    expect(result.body.failed).toBe(2);
    expect(inserts).toEqual([]);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('löscht den Link, wenn der Versand fehlschlägt', async () => {
    const { supabase, inserts, deletes } = makeSupabase();
    const sendMail = vi.fn(async () => ({ ok: false, error: 'Resend 422' }));
    const result = await sendManagementAnfragen(
      { supabase, sendMail, benutzerId: 'user-1', pageBase: PAGE },
      {
        castingId: 'liste-1',
        betreff: 'Creator',
        body: 'Text',
        empfaenger: [{ managementId: 'm1' }],
      }
    );
    expect(result.body).toMatchObject({ sent: 0, failed: 1 });
    expect(result.body.errors[0].error).toBe('Resend 422');
    expect(inserts).toHaveLength(1);
    expect(deletes).toEqual(['link-1']);
  });

  it('verweigert ein unbekanntes Casting', async () => {
    const { supabase } = makeSupabase();
    const result = await sendManagementAnfragen(
      { supabase, sendMail: vi.fn(), benutzerId: 'user-1', pageBase: PAGE },
      { castingId: 'fehlt', betreff: 'Creator', body: 'Text', empfaenger: [{ managementId: 'm1' }] }
    );
    expect(result.status).toBe(400);
  });
});

describe('pageBaseFromEvent', () => {
  it('nimmt die gesetzte Basis-URL vor dem Origin', () => {
    const previous = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = 'https://v2.example/';
    expect(pageBaseFromEvent({ headers: { origin: 'http://localhost:3001' } })).toBe('https://v2.example');
    if (previous === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = previous;
  });
});
