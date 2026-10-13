// skriptEditorMessages.test.js
// Pure Helfer der Chat-Message-Liste: Dedupe, Ablauf, laufende Auftraege.

import { describe, it, expect } from 'vitest';
import {
  upsertById, entdoppeln, istAbgelaufen, istLangsam, laufendeMessages,
  PENDING_TIMEOUT_MS, RUNNING_TIMEOUT_MS
} from '../modules/skripte/editor/skriptEditorMessages.js';

const vorMs = (ms) => new Date(Date.now() - ms).toISOString();
const msg = (over = {}) => ({
  id: 'm1', rolle: 'assistant', status: 'pending', created_at: vorMs(1000), ...over
});

describe('upsertById', () => {
  it('fuegt neue ids an', () => {
    const liste = [];
    upsertById(liste, msg());
    expect(liste).toHaveLength(1);
  });

  it('behaelt den vorhandenen Eintrag bei gleicher id', () => {
    const vorhanden = msg({ status: 'fertig' });
    const liste = [vorhanden];
    const ergebnis = upsertById(liste, msg({ status: 'pending' }));
    expect(liste).toHaveLength(1);
    expect(ergebnis).toBe(vorhanden);
  });
});

describe('entdoppeln', () => {
  it('entfernt Kopien, die erste bleibt', () => {
    const erste = msg({ status: 'fertig' });
    const liste = [erste, msg({ id: 'm2' }), msg()];
    expect(entdoppeln(liste)).toBe(true);
    expect(liste).toHaveLength(2);
    expect(liste[0]).toBe(erste);
  });

  it('ohne Duplikate keine Aenderung', () => {
    expect(entdoppeln([msg(), msg({ id: 'm2' })])).toBe(false);
  });
});

describe('Ablauf', () => {
  it('pending laeuft nach 45 s ab, running erst nach 12 min', () => {
    expect(istAbgelaufen(msg({ created_at: vorMs(PENDING_TIMEOUT_MS + 1000) }))).toBe(true);
    expect(istAbgelaufen(msg({ created_at: vorMs(PENDING_TIMEOUT_MS - 5000) }))).toBe(false);
    expect(istAbgelaufen(msg({ status: 'running', created_at: vorMs(PENDING_TIMEOUT_MS + 1000) }))).toBe(false);
    expect(istAbgelaufen(msg({ status: 'running', created_at: vorMs(RUNNING_TIMEOUT_MS + 1000) }))).toBe(true);
  });

  it('fertige Messages und fehlendes created_at laufen nie ab', () => {
    expect(istAbgelaufen(msg({ status: 'fertig', created_at: vorMs(RUNNING_TIMEOUT_MS * 2) }))).toBe(false);
    expect(istAbgelaufen(msg({ created_at: undefined }))).toBe(false);
  });

  it('istLangsam: running ab 60 s, aber nicht mehr nach Ablauf', () => {
    expect(istLangsam(msg({ status: 'running', created_at: vorMs(30000) }))).toBe(false);
    expect(istLangsam(msg({ status: 'running', created_at: vorMs(90000) }))).toBe(true);
    expect(istLangsam(msg({ status: 'running', created_at: vorMs(RUNNING_TIMEOUT_MS + 1000) }))).toBe(false);
  });
});

describe('laufendeMessages', () => {
  it('zaehlt nur eindeutige, nicht abgelaufene Assistant-Auftraege', () => {
    const liste = [
      msg({ id: 'a' }),
      msg({ id: 'a' }),                                             // Geister-Kopie
      msg({ id: 'b', created_at: vorMs(PENDING_TIMEOUT_MS + 5000) }), // abgelaufen
      msg({ id: 'c', rolle: 'user' }),
      msg({ id: 'd', status: 'fertig' }),
      msg({ id: 'e', status: 'running' })
    ];
    expect(laufendeMessages(liste).map((m) => m.id)).toEqual(['a', 'e']);
  });
});
