import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * RLS-Matrix für share_claim_has_access — spiegelt die SQL-Funktion.
 * Live-Check läuft zusätzlich gegen die DB (execute_sql im Cutover).
 */
function shareClaimHasAccess(jwt, share, { entityType, entityId, write = false, now = Date.now(), kampagneCompleted = false }) {
  if (!jwt?.share_id || jwt.share_id !== share.id) return false;
  if (share.entity_type !== entityType || share.entity_id !== entityId) return false;
  if (share.revoked_at) return false;
  if (share.expires_at && new Date(share.expires_at).getTime() <= now) return false;
  if (share.ends_with_kampagne && kampagneCompleted) return false;
  if (write && (share.rechte !== 'feedback' || jwt.vorschau === true)) return false;
  return true;
}

const share = {
  id: 'share-1',
  entity_type: 'sourcing',
  entity_id: 'list-1',
  rechte: 'ansehen',
  revoked_at: null,
  expires_at: null,
  ends_with_kampagne: false,
};

describe('share_claim_has_access (RLS-Matrix)', () => {
  it('liest nur die geteilte Entität', () => {
    const jwt = { share_id: 'share-1' };
    expect(shareClaimHasAccess(jwt, share, { entityType: 'sourcing', entityId: 'list-1' })).toBe(true);
    expect(shareClaimHasAccess(jwt, share, { entityType: 'sourcing', entityId: 'other' })).toBe(false);
    expect(shareClaimHasAccess(jwt, share, { entityType: 'kampagne', entityId: 'list-1' })).toBe(false);
    expect(shareClaimHasAccess({ share_id: 'other' }, share, { entityType: 'sourcing', entityId: 'list-1' })).toBe(false);
  });

  it('Write nur bei rechte=feedback', () => {
    const jwt = { share_id: 'share-1' };
    expect(shareClaimHasAccess(jwt, share, { entityType: 'sourcing', entityId: 'list-1', write: true })).toBe(false);
    expect(shareClaimHasAccess(jwt, { ...share, rechte: 'feedback' }, { entityType: 'sourcing', entityId: 'list-1', write: true })).toBe(true);
  });

  it('Mitarbeiter-Vorschau liest, schreibt aber auch bei rechte=feedback nie', () => {
    const vorschau = { share_id: 'share-1', vorschau: true };
    const feedback = { ...share, rechte: 'feedback' };
    expect(shareClaimHasAccess(vorschau, feedback, { entityType: 'sourcing', entityId: 'list-1' })).toBe(true);
    expect(shareClaimHasAccess(vorschau, feedback, { entityType: 'sourcing', entityId: 'list-1', write: true })).toBe(false);
  });

  it('revoked / expired / kampagne abgeschlossen = kein Zugriff', () => {
    const jwt = { share_id: 'share-1' };
    const args = { entityType: 'sourcing', entityId: 'list-1' };
    expect(shareClaimHasAccess(jwt, { ...share, revoked_at: new Date().toISOString() }, args)).toBe(false);
    expect(shareClaimHasAccess(jwt, { ...share, expires_at: '2000-01-01T00:00:00Z' }, args)).toBe(false);
    expect(shareClaimHasAccess(jwt, { ...share, ends_with_kampagne: true }, { ...args, kampagneCompleted: true })).toBe(false);
    expect(shareClaimHasAccess(jwt, { ...share, ends_with_kampagne: true }, { ...args, kampagneCompleted: false })).toBe(true);
  });
});

/**
 * Spiegel von can_gast_access_skript: exakt das geteilte Skript,
 * oder bei skript_scope=kampagne jedes Skript derselben Kampagne.
 */
function canGastAccessSkript(jwt, share, {
  skriptId,
  sharedKampagneId = null,
  targetKampagneId = null,
  write = false,
  now = Date.now(),
  kampagneCompleted = false,
}) {
  if (!jwt?.share_id || jwt.share_id !== share.id) return false;
  if (share.entity_type !== 'skript') return false;
  if (share.revoked_at) return false;
  if (share.expires_at && new Date(share.expires_at).getTime() <= now) return false;
  if (share.ends_with_kampagne && kampagneCompleted) return false;
  if (write && (share.rechte !== 'feedback' || jwt.vorschau === true)) return false;
  if (share.entity_id === skriptId) return true;
  return share.skript_scope === 'kampagne'
    && sharedKampagneId != null
    && sharedKampagneId === targetKampagneId;
}

const skriptShare = {
  id: 'share-1',
  entity_type: 'skript',
  entity_id: 'skript-1',
  skript_scope: 'kampagne',
  rechte: 'ansehen',
  revoked_at: null,
  expires_at: null,
  ends_with_kampagne: false,
};

describe('can_gast_access_skript (RLS-Matrix)', () => {
  const jwt = { share_id: 'share-1' };

  it('Kampagnen-Scope sieht Geschwister, nicht eine andere Kampagne', () => {
    const base = { sharedKampagneId: 'k1', targetKampagneId: 'k1' };
    expect(canGastAccessSkript(jwt, skriptShare, { ...base, skriptId: 'skript-1' })).toBe(true);
    expect(canGastAccessSkript(jwt, skriptShare, { ...base, skriptId: 'skript-2' })).toBe(true);
    expect(canGastAccessSkript(jwt, skriptShare, {
      skriptId: 'skript-3',
      sharedKampagneId: 'k1',
      targetKampagneId: 'k2',
    })).toBe(false);
    expect(canGastAccessSkript(jwt, skriptShare, {
      skriptId: 'skript-4',
      sharedKampagneId: null,
      targetKampagneId: null,
    })).toBe(false);
  });

  it('einzeln bleibt auf dem einen Skript', () => {
    const einzeln = { ...skriptShare, skript_scope: 'einzeln' };
    expect(canGastAccessSkript(jwt, einzeln, {
      skriptId: 'skript-1',
      sharedKampagneId: 'k1',
      targetKampagneId: 'k1',
    })).toBe(true);
    expect(canGastAccessSkript(jwt, einzeln, {
      skriptId: 'skript-2',
      sharedKampagneId: 'k1',
      targetKampagneId: 'k1',
    })).toBe(false);
  });

  it('Write nur bei rechte=feedback, auch für Geschwister', () => {
    const args = { skriptId: 'skript-2', sharedKampagneId: 'k1', targetKampagneId: 'k1', write: true };
    expect(canGastAccessSkript(jwt, skriptShare, args)).toBe(false);
    expect(canGastAccessSkript(jwt, { ...skriptShare, rechte: 'feedback' }, args)).toBe(true);
    expect(canGastAccessSkript({ ...jwt, vorschau: true }, { ...skriptShare, rechte: 'feedback' }, args)).toBe(false);
  });
});

describe('Migration Vorschau nur lesen', () => {
  const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261217_share_vorschau_nur_lesen.sql'), 'utf8');

  it('sperrt den Schreibzweig in share_claim_has_access und beiden Zweigen von can_gast_access_skript', () => {
    const zweige = sql.match(/AND \(NOT p_write OR \(ls\.rechte = 'feedback' AND NOT share_claim_ist_vorschau\(\)\)\)/g) || [];
    expect(zweige).toHaveLength(3);
    expect(sql).not.toMatch(/NOT p_write OR ls\.rechte = 'feedback'\)/);
  });

  it('liest den Claim so, wie vorschau.ts ihn setzt (JSON true)', () => {
    expect(sql).toContain("COALESCE(auth.jwt() ->> 'vorschau', '') = 'true'");
    const vorschauTs = readFileSync(resolve(__dirname, '../../supabase/functions/share-list/vorschau.ts'), 'utf8');
    expect(vorschauTs).toMatch(/vorschau: true/);
  });
});
