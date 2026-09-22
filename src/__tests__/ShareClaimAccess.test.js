import { describe, it, expect } from 'vitest';

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
  if (write && share.rechte !== 'feedback') return false;
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
  if (write && share.rechte !== 'feedback') return false;
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
  });
});
