import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  TARGET_RULES,
  isKnownTarget,
  isVersionedTarget,
  holdsInFlightLock,
} from '../../netlify/functions/_shared/creator-upload.js';

// Der Rohmaterial-Dump laedt viele Dateien parallel auf dieselbe Kooperation.
// Zwei Mechanismen wuerden das blockieren, beide haengen an singleInFlight:
//   1. der Unique-Index creator_upload_job_inflight_unique (DB)
//   2. der Stale-Reclaim in creator-upload-start, der pending-Jobs desselben
//      Ziels abbricht (Code, via holdsInFlightLock)
// Laufen die beiden auseinander, sind parallele Uploads wieder kaputt — darum
// wird hier die Regel selbst und ihre Deckung mit der Migration geprueft.

const MIGRATION = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260907_kooperation_rohmaterial.sql'),
  'utf8'
);

describe('Zieltyp-Regeln', () => {
  it('behandelt Rohmaterial als versionslosen Multi-Datei-Dump', () => {
    expect(isKnownTarget('rohmaterial')).toBe(true);
    expect(isVersionedTarget('rohmaterial')).toBe(false);
    expect(holdsInFlightLock('rohmaterial')).toBe(false);
  });

  it('laesst Video und Story bei Feedbackschleife plus Einzel-Lock', () => {
    for (const targetType of ['video', 'story']) {
      expect(isVersionedTarget(targetType)).toBe(true);
      expect(holdsInFlightLock(targetType)).toBe(true);
    }
  });

  it('haelt Bilder versionslos, aber weiter unter Einzel-Lock', () => {
    expect(isVersionedTarget('bilder')).toBe(false);
    expect(holdsInFlightLock('bilder')).toBe(true);
  });

  it('weist unbekannte Zieltypen ab', () => {
    for (const targetType of ['rohdaten', '', null, undefined, 'constructor', 'toString']) {
      expect(isKnownTarget(targetType)).toBe(false);
      expect(isVersionedTarget(targetType)).toBe(false);
      expect(holdsInFlightLock(targetType)).toBe(false);
    }
  });
});

describe('Migration deckt die Zieltyp-Regeln', () => {
  it('kennt in der CHECK-Constraint genau die Zieltypen aus TARGET_RULES', () => {
    const match = MIGRATION.match(/CHECK \(target_type IN \(([^)]*)\)\)/);
    expect(match).not.toBeNull();

    const inSql = match[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
    expect(inSql.sort()).toEqual(Object.keys(TARGET_RULES).sort());
  });

  it('nimmt genau die Dump-Zieltypen aus dem In-Flight-Index aus', () => {
    const match = MIGRATION.match(
      /CREATE UNIQUE INDEX creator_upload_job_inflight_unique[\s\S]*?WHERE ([\s\S]*?);/
    );
    expect(match).not.toBeNull();

    const where = match[1];
    expect(where).toMatch(/status IN \('pending', 'processing'\)/);

    for (const targetType of Object.keys(TARGET_RULES)) {
      const excluded = where.includes(`target_type <> '${targetType}'`);
      expect(excluded).toBe(!holdsInFlightLock(targetType));
    }
  });
});
