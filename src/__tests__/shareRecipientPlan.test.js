import { describe, it, expect } from 'vitest';
import {
  accountListPath,
  canCustomerSee,
  planShareRecipients,
} from '../modules/share/shareRecipientPlan.js';

const scope = {
  unternehmenId: 'firma',
  markeId: 'marke',
  markeUnternehmenId: 'firma',
  kampagneUnternehmenId: 'firma',
  kampagneMarkeId: 'marke',
  kampagneMarkeUnternehmenId: 'firma',
};

describe('planShareRecipients', () => {
  it('gibt Kunden mit Zuordnung den Listen-Link und alle anderen den Gast-Zugang', () => {
    const plan = planShareRecipients({
      emails: ['kunde@telekom.de', 'agentur@beispiel.de'],
      entityType: 'kampagne',
      customersByEmail: {
        'kunde@telekom.de': { canSee: true },
      },
    });
    expect(plan.listLink).toEqual(['kunde@telekom.de']);
    expect(plan.guest).toEqual(['agentur@beispiel.de']);
    expect(plan.blocked).toEqual([]);
  });

  it('sperrt ein Kundenkonto ohne Zuordnung und weicht nicht auf den Gast-Zugang aus', () => {
    const plan = planShareRecipients({
      emails: ['kunde@telekom.de'],
      entityType: 'sourcing',
      customersByEmail: {
        'kunde@telekom.de': { canSee: false },
      },
    });
    expect(plan).toEqual({
      listLink: [],
      guest: [],
      blocked: [{ email: 'kunde@telekom.de', reason: 'scope' }],
    });
  });

  it('sperrt ein Kundenkonto beim Skript-Paket auch mit Zuordnung', () => {
    const plan = planShareRecipients({
      emails: ['kunde@telekom.de', 'creator@beispiel.de'],
      entityType: 'skript_paket',
      customersByEmail: {
        'kunde@telekom.de': { canSee: true },
      },
    });
    expect(plan.listLink).toEqual([]);
    expect(plan.guest).toEqual(['creator@beispiel.de']);
    expect(plan.blocked).toEqual([{ email: 'kunde@telekom.de', reason: 'paket' }]);
  });

  it('erkennt die Zuordnung über Unternehmen oder Marke', () => {
    expect(canCustomerSee({ unternehmenIds: ['firma'], markeIds: [] }, scope)).toBe(true);
    expect(canCustomerSee({ unternehmenIds: [], markeIds: ['marke'] }, scope)).toBe(true);
    expect(canCustomerSee({ unternehmenIds: ['andere'], markeIds: [] }, scope)).toBe(false);
    expect(canCustomerSee({ unternehmenIds: ['firma'], markeIds: [] }, null)).toBe(false);
  });

  it('baut die Konto-Adresse für Liste und einzelnes Skript', () => {
    expect(accountListPath('kampagne', 'k1')).toBe('/kampagne/k1');
    expect(accountListPath('sourcing', 'c1')).toBe('/castings/c1');
    expect(accountListPath('strategie', 's1')).toBe('/konzepte/s1');
    expect(accountListPath('skript', 'sk1')).toBe('/skripte/sk1');
    expect(accountListPath('skript_paket', 'p1')).toBeNull();
  });
});
