import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetIgFetchBudget,
  enqueueIgFetch,
  noteMetaUsage,
  currentMetaUsage
} from '../modules/creator-auswahl/igFetchBudget.js';

const HOT = { total_time: 100, call_count: 40, total_cputime: 10 };

describe('Instagram-Abruf-Warteschlange', () => {
  beforeEach(() => {
    resetIgFetchBudget();
  });

  it('reicht den vollen Stand an den nächsten Creator weiter, damit der nicht mehr bei Meta anfragt', async () => {
    const seen = [];
    const limit = Object.assign(new Error('(#4) Application request limit reached'), {
      retryable: true,
      metaUsage: HOT
    });

    const first = enqueueIgFetch(async (usage) => {
      seen.push(usage);
      throw limit;
    });
    const second = enqueueIgFetch(async (usage) => {
      seen.push(usage);
      return { ok: true };
    });

    await expect(first).rejects.toBe(limit);
    await second;
    expect(seen).toEqual([null, HOT]);
  });

  it('misst einen vollen Stand nach zehn Minuten neu und lässt Zwischenmeldungen die Uhr nicht zurücksetzen', () => {
    noteMetaUsage(HOT, 1_000);
    noteMetaUsage({ total_time: 97 }, 1_000 + 9 * 60 * 1000);
    expect(currentMetaUsage(1_000 + 9 * 60 * 1000)).toEqual({ total_time: 97 });
    expect(currentMetaUsage(1_000 + 10 * 60 * 1000)).toBeNull();
  });
});
