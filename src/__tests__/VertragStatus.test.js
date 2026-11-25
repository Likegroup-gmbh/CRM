import { describe, it, expect } from 'vitest';
import {
  getVertragStatus,
  deriveVertragStatus,
  statusOnFinalize,
  fallbackStatusAfterUnsigned,
  isGesendetUeberfaellig,
  shouldPersistVerzoegert,
  applyVertragStatusFilter,
  VERTRAG_STATUS,
  VERZOEGERT_NACH_MS,
} from '../modules/vertrag/vertragStatus.js';
import { VERTRAG_FILTERS } from '../modules/vertrag/filters/VertragFilterConfig.js';

const TAGE_31 = VERZOEGERT_NACH_MS + 24 * 60 * 60 * 1000;

function queryRecorder() {
  const calls = [];
  const q = {
    eq(...args) { calls.push(['eq', ...args]); return q; },
    or(...args) { calls.push(['or', ...args]); return q; },
    calls,
  };
  return q;
}

function fallbackSupabase({ vertrag = null, logRows = [] } = {}) {
  return {
    from: (table) => {
      if (table === 'vertraege') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: vertrag, error: null }),
            }),
          }),
        };
      }
      if (table === 'anschreiben_log') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => Promise.resolve({ data: logRows, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unbekannte Tabelle: ${table}`);
    },
  };
}

describe('vertragStatus', () => {
  it('signed Datei gewinnt ueber gespeicherten Status', () => {
    expect(getVertragStatus({
      status: 'gesendet',
      dropbox_file_url: 'https://dropbox.com/signed.pdf',
    })).toBe('unterschrieben');
  });

  it('liest gespeicherten Status', () => {
    expect(getVertragStatus({ status: 'gesendet', datei_url: 'https://x.pdf', is_draft: false }))
      .toBe('gesendet');
    expect(getVertragStatus({ status: 'verzoegert', datei_url: 'https://x.pdf' }))
      .toBe('verzoegert');
    expect(getVertragStatus({
      status: 'unterschrieben',
      datei_url: 'https://x.pdf',
      is_draft: false,
    })).toBe('erstellt');
  });

  it('faellt ohne status auf Ableitung', () => {
    expect(getVertragStatus({ is_draft: true })).toBe('entwurf');
    expect(getVertragStatus({ is_draft: false, datei_url: 'https://x.pdf' })).toBe('erstellt');
    expect(getVertragStatus({ is_draft: false })).toBe('kein_vertrag');
    expect(getVertragStatus(null)).toBe('kein_vertrag');
  });

  it('deriveVertragStatus ignoriert gespeicherten Status', () => {
    expect(deriveVertragStatus({ status: 'gesendet', is_draft: true })).toBe('entwurf');
  });

  it('statusOnFinalize ueberschreibt Gesendet/Unterschrieben nicht', () => {
    expect(statusOnFinalize('entwurf')).toBe('erstellt');
    expect(statusOnFinalize(null)).toBe('erstellt');
    expect(statusOnFinalize('gesendet')).toBe('gesendet');
    expect(statusOnFinalize('unterschrieben')).toBe('unterschrieben');
    expect(statusOnFinalize('verzoegert')).toBe('verzoegert');
  });

  it('Gesendet wird nach 30 Tagen Verzögert', () => {
    const now = Date.parse('2026-09-21T12:00:00.000Z');
    const frisch = new Date(now - VERZOEGERT_NACH_MS + 1000).toISOString();
    const alt = new Date(now - TAGE_31).toISOString();
    expect(getVertragStatus({
      status: 'gesendet',
      gesendet_am: frisch,
      datei_url: 'https://x.pdf',
    }, now)).toBe('gesendet');
    expect(getVertragStatus({
      status: 'gesendet',
      gesendet_am: alt,
      datei_url: 'https://x.pdf',
    }, now)).toBe('verzoegert');
  });

  it('neue gesendet_am setzt die Uhr zurueck', () => {
    const now = Date.parse('2026-09-21T12:00:00.000Z');
    expect(getVertragStatus({
      status: 'gesendet',
      gesendet_am: new Date(now).toISOString(),
      datei_url: 'https://x.pdf',
    }, now)).toBe('gesendet');
  });

  it('ohne gesendet_am bleibt Gesendet', () => {
    expect(getVertragStatus({
      status: 'gesendet',
      datei_url: 'https://x.pdf',
    })).toBe('gesendet');
  });
});

describe('shouldPersistVerzoegert', () => {
  const now = Date.parse('2026-09-21T12:00:00.000Z');
  const alt = new Date(now - TAGE_31).toISOString();

  it('nur gesendet + alt + keine Signed-URL', () => {
    expect(shouldPersistVerzoegert({
      status: 'gesendet',
      gesendet_am: alt,
    }, now)).toBe(true);
    expect(shouldPersistVerzoegert({
      status: 'gesendet',
      gesendet_am: alt,
      dropbox_file_url: 'https://x.pdf',
    }, now)).toBe(false);
    expect(shouldPersistVerzoegert({
      status: 'erstellt',
      gesendet_am: alt,
    }, now)).toBe(false);
    expect(shouldPersistVerzoegert({
      status: 'gesendet',
      gesendet_am: new Date(now).toISOString(),
    }, now)).toBe(false);
  });

  it('isGesendetUeberfaellig braucht Timestamp', () => {
    expect(isGesendetUeberfaellig(null, now)).toBe(false);
    expect(isGesendetUeberfaellig(alt, now)).toBe(true);
  });
});

describe('applyVertragStatusFilter', () => {
  it('Gesendet schliesst Ueberfaellige aus', () => {
    const now = Date.parse('2026-09-21T12:00:00.000Z');
    const q = queryRecorder();
    applyVertragStatusFilter(q, 'gesendet', now);
    expect(q.calls[0]).toEqual(['eq', 'status', 'gesendet']);
    expect(q.calls[1][0]).toBe('or');
    expect(q.calls[1][1]).toContain('gesendet_am.is.null');
    expect(q.calls[1][1]).toContain('gesendet_am.gt.');
  });

  it('Verzögert nimmt gespeicherte und ueberfaellige Gesendet', () => {
    const now = Date.parse('2026-09-21T12:00:00.000Z');
    const q = queryRecorder();
    applyVertragStatusFilter(q, 'verzoegert', now);
    expect(q.calls[0][0]).toBe('or');
    expect(q.calls[0][1]).toContain('status.eq.verzoegert');
    expect(q.calls[0][1]).toContain('status.eq.gesendet');
    expect(q.calls[0][1]).toContain('gesendet_am.lte.');
  });

  it('andere Status bleiben eq', () => {
    const q = queryRecorder();
    applyVertragStatusFilter(q, 'erstellt');
    expect(q.calls).toEqual([['eq', 'status', 'erstellt']]);
  });
});

describe('fallbackStatusAfterUnsigned', () => {
  it('gesendet wenn gesendet_am frisch', async () => {
    const now = Date.parse('2026-09-21T12:00:00.000Z');
    const supabase = fallbackSupabase({
      vertrag: { gesendet_am: new Date(now).toISOString() },
    });
    expect(await fallbackStatusAfterUnsigned(supabase, 'v1', now)).toBe(VERTRAG_STATUS.GESENDET);
  });

  it('verzoegert wenn gesendet_am aelter als 30 Tage', async () => {
    const now = Date.parse('2026-09-21T12:00:00.000Z');
    const supabase = fallbackSupabase({
      vertrag: { gesendet_am: new Date(now - TAGE_31).toISOString() },
    });
    expect(await fallbackStatusAfterUnsigned(supabase, 'v1', now)).toBe(VERTRAG_STATUS.VERZOEGERT);
  });

  it('gesendet wenn Anschreiben-Log sent', async () => {
    const supabase = fallbackSupabase({ vertrag: {}, logRows: [{ id: 'l1' }] });
    expect(await fallbackStatusAfterUnsigned(supabase, 'v1')).toBe(VERTRAG_STATUS.GESENDET);
  });

  it('erstellt ohne Log', async () => {
    const supabase = fallbackSupabase({ vertrag: {}, logRows: [] });
    expect(await fallbackStatusAfterUnsigned(supabase, 'v1')).toBe(VERTRAG_STATUS.ERSTELLT);
  });
});

describe('VERTRAG_FILTERS', () => {
  it('enthaelt die sechs Vertrag-Status', () => {
    const status = VERTRAG_FILTERS.find((f) => f.id === 'status');
    expect(status.options.map((o) => o.value)).toEqual([
      'entwurf', 'erstellt', 'gesendet', 'unterschrieben', 'verzoegert', 'abgelehnt',
    ]);
  });
});
