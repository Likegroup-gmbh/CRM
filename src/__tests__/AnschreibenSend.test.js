// Testet den Kern der Netlify Function anschreiben-send (injizierte Deps):
// Draft-Gate, 1:1-Versand mit Attachment, Platzhalter-Merge, Dedup, Log-Status.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  sendAnschreiben,
  mergeTemplate,
  textToHtml,
} = require('../../netlify/functions/anschreiben-send.js');

const BRIEFING = {
  id: 'b1',
  aktivierung_name: 'Glow Up',
  is_draft: false,
  unternehmen: { firmenname: 'VHV' },
  marke: { markenname: 'VHV Arena' },
};

function chain(result) {
  const c = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return c;
}

function makeSupabase({ briefing = BRIEFING, creator, management, vertrag } = {}) {
  const logUpdates = [];
  const logInserts = [];
  const vertragUpdates = [];
  const supabase = {
    from: vi.fn((table) => {
      if (table === 'campaign_briefings') return chain({ data: briefing, error: null });
      if (table === 'vertraege') {
        const c = chain({ data: vertrag, error: null });
        c.update = vi.fn((fields) => {
          vertragUpdates.push(fields);
          return { eq: vi.fn(() => Promise.resolve({ error: null })) };
        });
        return c;
      }
      if (table === 'creator') return chain({ data: creator ?? { id: 'c1', vorname: 'Lisa', nachname: 'K', mail: 'lisa@x.de' }, error: null });
      if (table === 'management') return chain({ data: management ?? { id: 'm1', firmenname: 'Agentur', email: 'info@a.de' }, error: null });
      if (table === 'anschreiben_log') {
        return {
          insert: vi.fn((rows) => {
            logInserts.push(rows);
            return {
              select: vi.fn(() => Promise.resolve({
                data: rows.map((r, i) => ({ id: `log${i}`, empfaenger_typ: r.empfaenger_typ, empfaenger_id: r.empfaenger_id })),
                error: null,
              })),
            };
          }),
          update: vi.fn((fields) => {
            logUpdates.push(fields);
            return { eq: vi.fn(() => Promise.resolve({ error: null })) };
          }),
        };
      }
      throw new Error(`Unbekannte Tabelle: ${table}`);
    }),
    _logUpdates: logUpdates,
    _logInserts: logInserts,
    _vertragUpdates: vertragUpdates,
  };
  return supabase;
}

function payload(overrides = {}) {
  return {
    dokumentTyp: 'briefing',
    dokumentId: 'b1',
    empfaenger: [{ typ: 'creator', id: 'c1' }],
    betreff: 'Briefing: {{briefing}}',
    body: 'Hallo {{vorname}},\n\nfür {{unternehmen}}.',
    pdfBase64: 'QUJD',
    dateiname: 'glow.pdf',
    ...overrides,
  };
}

describe('sendAnschreiben', () => {
  it('lehnt Entwuerfe ab', async () => {
    const supabase = makeSupabase({ briefing: { ...BRIEFING, is_draft: true } });
    const sendMail = vi.fn();
    const res = await sendAnschreiben({ supabase, sendMail, benutzerId: 'ben1' }, payload());

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('finalisierte');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sendet 1:1 mit Attachment und merged Platzhalter serverseitig', async () => {
    const supabase = makeSupabase();
    const sendMail = vi.fn(async () => ({ ok: true, id: 'resend-1' }));
    const res = await sendAnschreiben({ supabase, sendMail, benutzerId: 'ben1' }, payload());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sent: 1, failed: 0, total: 1 });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe('lisa@x.de');
    expect(mail.subject).toBe('Briefing: Glow Up');
    expect(mail.html).toContain('Hallo Lisa,');
    expect(mail.html).toContain('für VHV.');
    expect(mail.attachments).toEqual([{ filename: 'glow.pdf', content: 'QUJD' }]);
  });

  it('loest Management-Empfaenger serverseitig auf', async () => {
    const supabase = makeSupabase();
    const sendMail = vi.fn(async () => ({ ok: true, id: 'r1' }));
    const res = await sendAnschreiben(
      { supabase, sendMail, benutzerId: 'ben1' },
      payload({ empfaenger: [{ typ: 'management', id: 'm1' }], body: 'Hallo {{name}}' })
    );

    expect(res.status).toBe(200);
    expect(sendMail.mock.calls[0][0].to).toBe('info@a.de');
    expect(sendMail.mock.calls[0][0].html).toContain('Hallo Agentur');
  });

  it('markiert Empfaenger ohne Mail als error, sendet den Rest', async () => {
    const supabase = makeSupabase({ creator: { id: 'c1', vorname: 'X', nachname: '', mail: null } });
    const sendMail = vi.fn(async () => ({ ok: true, id: 'r1' }));
    const res = await sendAnschreiben(
      { supabase, sendMail, benutzerId: 'ben1' },
      payload({ empfaenger: [{ typ: 'creator', id: 'c1' }, { typ: 'management', id: 'm1' }] })
    );

    expect(res.body.sent).toBe(1);
    expect(res.body.failed).toBe(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(supabase._logUpdates).toContainEqual(expect.objectContaining({ status: 'error', error: 'Keine E-Mail am Datensatz' }));
    expect(supabase._logUpdates).toContainEqual(expect.objectContaining({ status: 'sent', resend_id: 'r1' }));
  });

  it('dedupt Empfaenger serverseitig', async () => {
    const supabase = makeSupabase();
    const sendMail = vi.fn(async () => ({ ok: true, id: 'r1' }));
    const res = await sendAnschreiben(
      { supabase, sendMail, benutzerId: 'ben1' },
      payload({ empfaenger: [{ typ: 'creator', id: 'c1' }, { typ: 'creator', id: 'c1' }] })
    );

    expect(res.body.total).toBe(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(supabase._logInserts[0]).toHaveLength(1);
  });

  it('schreibt Log-Zeilen zuerst pending', async () => {
    const supabase = makeSupabase();
    const sendMail = vi.fn(async () => ({ ok: true, id: 'r1' }));
    await sendAnschreiben({ supabase, sendMail, benutzerId: 'ben1' }, payload());

    expect(supabase._logInserts[0][0]).toMatchObject({
      dokument_typ: 'briefing',
      dokument_id: 'b1',
      empfaenger_typ: 'creator',
      empfaenger_id: 'c1',
      status: 'pending',
      created_by: 'ben1',
    });
  });

  it('zaehlt Resend-Fehler als failed', async () => {
    const supabase = makeSupabase();
    const sendMail = vi.fn(async () => ({ ok: false, error: 'Resend 422' }));
    const res = await sendAnschreiben({ supabase, sendMail, benutzerId: 'ben1' }, payload());

    expect(res.body.sent).toBe(0);
    expect(res.body.failed).toBe(1);
    expect(supabase._logUpdates).toContainEqual(expect.objectContaining({ status: 'error', error: 'Resend 422' }));
  });

  it('lehnt fehlende Pflichtfelder ab', async () => {
    const supabase = makeSupabase();
    const sendMail = vi.fn();
    expect((await sendAnschreiben({ supabase, sendMail, benutzerId: 'b' }, payload({ empfaenger: [] }))).status).toBe(400);
    expect((await sendAnschreiben({ supabase, sendMail, benutzerId: 'b' }, payload({ betreff: ' ' }))).status).toBe(400);
    expect((await sendAnschreiben({ supabase, sendMail, benutzerId: 'b' }, payload({ pdfBase64: '' }))).status).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('lehnt unbekannten dokument_typ ab', async () => {
    const supabase = makeSupabase();
    const sendMail = vi.fn();
    const res = await sendAnschreiben(
      { supabase, sendMail, benutzerId: 'b' },
      payload({ dokumentTyp: 'rechnung' })
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Unbekannter');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('setzt Vertrag auf gesendet nach erfolgreichem Versand', async () => {
    const VERTRAG = {
      id: 'v1',
      name: 'UGC Max',
      is_draft: false,
      datei_url: 'https://x.pdf',
      status: 'erstellt',
      creator: { vorname: 'Max', nachname: 'M' },
      kunde: { firmenname: 'Acme' },
      kampagne: { marke: { markenname: 'Marke' } },
    };
    const supabase = makeSupabase({ vertrag: VERTRAG });
    const sendMail = vi.fn(async () => ({ ok: true, id: 'r1' }));
    const res = await sendAnschreiben(
      { supabase, sendMail, benutzerId: 'ben1' },
      payload({ dokumentTyp: 'vertrag', dokumentId: 'v1' })
    );
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(1);
    expect(supabase._vertragUpdates).toContainEqual({ status: 'gesendet' });
  });

  it('lehnt Vertrags-Entwurf ab', async () => {
    const supabase = makeSupabase({
      vertrag: { id: 'v1', is_draft: true, datei_url: 'https://x.pdf', name: 'X' },
    });
    const sendMail = vi.fn();
    const res = await sendAnschreiben(
      { supabase, sendMail, benutzerId: 'b' },
      payload({ dokumentTyp: 'vertrag', dokumentId: 'v1' })
    );
    expect(res.status).toBe(400);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('ueberschreibt unterschrieben nicht nach Versand', async () => {
    const VERTRAG = {
      id: 'v1',
      name: 'UGC Max',
      is_draft: false,
      datei_url: 'https://x.pdf',
      status: 'unterschrieben',
      creator: { vorname: 'Max', nachname: 'M' },
      kunde: { firmenname: 'Acme' },
    };
    const supabase = makeSupabase({ vertrag: VERTRAG });
    const sendMail = vi.fn(async () => ({ ok: true, id: 'r1' }));
    const res = await sendAnschreiben(
      { supabase, sendMail, benutzerId: 'ben1' },
      payload({ dokumentTyp: 'vertrag', dokumentId: 'v1' })
    );
    expect(res.status).toBe(200);
    expect(supabase._vertragUpdates).toEqual([]);
  });

  it('laedt Vertrags-PDF serverseitig wenn pdfBase64 fehlt', async () => {
    const VERTRAG = {
      id: 'v1',
      name: 'UGC Max',
      is_draft: false,
      datei_url: 'https://dropbox.com/v?dl=0',
      status: 'erstellt',
      creator: { vorname: 'Max', nachname: 'M' },
      kunde: { firmenname: 'Acme' },
    };
    const supabase = makeSupabase({ vertrag: VERTRAG });
    const sendMail = vi.fn(async () => ({ ok: true, id: 'r1' }));
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([37, 80, 68, 70]).buffer,
    })));
    try {
      const res = await sendAnschreiben(
        { supabase, sendMail, benutzerId: 'ben1' },
        payload({ dokumentTyp: 'vertrag', dokumentId: 'v1', pdfBase64: '' })
      );
      expect(res.status).toBe(200);
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('https://dropbox.com/v?raw=1');
      expect(supabase._vertragUpdates).toContainEqual({ status: 'gesendet' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('mergeTemplate', () => {
  it('ersetzt Variablen und escaped HTML', () => {
    expect(mergeTemplate('Hallo {{vorname}}', { vorname: '<b>Lisa</b>' }))
      .toBe('Hallo &lt;b&gt;Lisa&lt;/b&gt;');
  });

  it('rendert Sektionen nur bei truthy Wert', () => {
    expect(mergeTemplate('A{{#marke}} für {{marke}}{{/marke}}', { marke: 'VHV' })).toBe('A für VHV');
    expect(mergeTemplate('A{{#marke}} für {{marke}}{{/marke}}', { marke: '' })).toBe('A');
  });

  it('laesst unbekannte Platzhalter stehen', () => {
    expect(mergeTemplate('{{unbekannt}}', {})).toBe('{{unbekannt}}');
  });
});

describe('textToHtml', () => {
  it('wandelt Absaetze und Zeilenumbrueche um', () => {
    expect(textToHtml('Eins\nZwei\n\nDrei')).toBe('<p>Eins<br>Zwei</p><p>Drei</p>');
  });
});
