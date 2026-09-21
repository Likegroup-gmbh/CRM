import { describe, it, expect } from 'vitest';
import {
  getVertragStatus,
  deriveVertragStatus,
  statusOnFinalize,
  canEditVertragStatusManually,
  manualStatusOptions,
  fallbackStatusAfterUnsigned,
  VERTRAG_STATUS,
} from '../modules/vertrag/vertragStatus.js';
import { VERTRAG_FILTERS } from '../modules/vertrag/filters/VertragFilterConfig.js';

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

  it('manuelles Setzen nur ab Erstellt', () => {
    expect(canEditVertragStatusManually('entwurf')).toBe(false);
    expect(canEditVertragStatusManually('unterschrieben')).toBe(false);
    expect(canEditVertragStatusManually('erstellt')).toBe(true);
    expect(canEditVertragStatusManually('gesendet')).toBe(true);
    expect(manualStatusOptions('erstellt').map((o) => o.value))
      .toEqual(['verzoegert', 'abgelehnt']);
    expect(manualStatusOptions('verzoegert').some((o) => o.value === '__zurueck')).toBe(true);
  });
});

describe('fallbackStatusAfterUnsigned', () => {
  it('gesendet wenn Anschreiben-Log sent', async () => {
    const supabase = {
      from: (table) => {
        expect(table).toBe('anschreiben_log');
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => Promise.resolve({ data: [{ id: 'l1' }], error: null }),
                }),
              }),
            }),
          }),
        };
      },
    };
    expect(await fallbackStatusAfterUnsigned(supabase, 'v1')).toBe(VERTRAG_STATUS.GESENDET);
  });

  it('erstellt ohne Log', async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    };
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

