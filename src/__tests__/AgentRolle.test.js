import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionSystem } from '../core/PermissionSystem.js';

function makeUser(rolle) {
  return { id: 'u1', rolle, zugriffsrechte: null };
}

describe('Rolle agent', () => {
  let ps;

  beforeEach(() => {
    ps = new PermissionSystem();
    ps.setUserPermissions(makeUser('agent'));
  });

  it('liest die Plattform wie investor', () => {
    const investor = new PermissionSystem();
    investor.setUserPermissions(makeUser('investor'));
    expect(ps.calculatedPermissions).toEqual(investor.calculatedPermissions);
    expect(ps.isInvestor).toBe(true);
    expect(ps.isInternal).toBe(false);
    expect(ps.isKunde).toBe(false);
  });

  it('sieht Entities, aber bearbeitet und loescht nichts', () => {
    for (const entity of ['kampagne', 'kooperation', 'creator', 'briefing', 'rechnung', 'strategie']) {
      expect(ps.checkPermission(entity, 'view')).toBe(true);
      expect(ps.checkPermission(entity, 'create')).toBe(false);
      expect(ps.checkPermission(entity, 'edit')).toBe(false);
      expect(ps.checkPermission(entity, 'delete')).toBe(false);
    }
  });

  it('hat keine Verwaltung, keine Uploads und keine Kontakt-Mails', () => {
    expect(ps.checkPermission('mitarbeiter', 'view')).toBe(false);
    expect(ps.canManageStaff).toBe(false);
    expect(ps.canBulkDelete).toBe(false);
    expect(ps.canCreateProject).toBe(false);
    for (const f of ['contactMail', 'mediaUpload', 'mediaDownload', 'skriptKommentieren', 'kampagneTableLayout']) {
      expect(ps.canFeature(f)).toBe(false);
    }
    expect(ps.canEditField('kooperation', 'status_id')).toBe(false);
  });
});
