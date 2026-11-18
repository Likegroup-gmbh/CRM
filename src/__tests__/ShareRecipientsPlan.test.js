// Empfänger-Aufteilung: Logik im Backend (share-recipients-plan.ts), Anzeige im Frontend.
import { describe, it, expect } from 'vitest';
import {
  accountListPath as serverListPath,
  canSee,
  planShareRecipients,
} from '../../supabase/functions/_shared/share-recipients-plan.ts';
import {
  accountListPath,
  recipientPlanGroups,
  recipientPlanRows,
  renderRecipientPlan,
  renderRecipientPlanGrouped,
  BLOCKED_TEXT,
  GUEST_TEXT,
  LIST_LINK_TEXT,
} from '../modules/share/shareRecipientPlan.js';

const scope = {
  unternehmenId: 'firma',
  markeId: 'marke',
  markeUnternehmenId: 'firma',
  kampagneUnternehmenId: 'firma',
  kampagneMarkeId: 'marke',
  kampagneMarkeUnternehmenId: 'firma',
};

describe('planShareRecipients (Server)', () => {
  it('gibt Kunden mit Zuordnung den Listen-Link und alle anderen den Gast-Zugang', () => {
    const plan = planShareRecipients(
      ['Kunde@Telekom.de', 'agentur@beispiel.de'],
      { 'kunde@telekom.de': { canSee: true } },
      'kampagne',
    );
    expect(plan).toEqual({ listLink: ['kunde@telekom.de'], guest: ['agentur@beispiel.de'], blocked: [] });
  });

  it('sperrt ein Kundenkonto ohne Zuordnung und weicht nicht auf den Gast-Zugang aus', () => {
    const plan = planShareRecipients(['kunde@telekom.de'], { 'kunde@telekom.de': { canSee: false } }, 'sourcing');
    expect(plan).toEqual({
      listLink: [],
      guest: [],
      blocked: [{ email: 'kunde@telekom.de', reason: 'scope' }],
    });
  });

  it('sperrt ein Kundenkonto beim Skript-Paket auch mit Zuordnung', () => {
    const plan = planShareRecipients(
      ['kunde@telekom.de', 'creator@beispiel.de'],
      { 'kunde@telekom.de': { canSee: true } },
      'skript_paket',
    );
    expect(plan.listLink).toEqual([]);
    expect(plan.guest).toEqual(['creator@beispiel.de']);
    expect(plan.blocked).toEqual([{ email: 'kunde@telekom.de', reason: 'paket' }]);
  });

  it('gibt einem Mitarbeiterkonto, das die Liste sieht, den Link ins Konto', () => {
    const plan = planShareRecipients(['Oliver@LikeGroup.de'], { 'oliver@likegroup.de': { canSee: true, staff: true } }, 'sourcing');
    expect(plan).toEqual({ listLink: ['oliver@likegroup.de'], guest: [], blocked: [] });
  });

  it('schickt ein Mitarbeiterkonto ohne Sicht als Gast statt es zu sperren', () => {
    const plan = planShareRecipients(['ma@likegroup.de'], { 'ma@likegroup.de': { canSee: false, staff: true } }, 'kampagne');
    expect(plan).toEqual({ listLink: [], guest: ['ma@likegroup.de'], blocked: [] });
  });

  it('schickt ein Mitarbeiterkonto beim Skript-Paket als Gast, Kundenkonten bleiben gesperrt', () => {
    const plan = planShareRecipients(
      ['ma@likegroup.de', 'kunde@telekom.de'],
      { 'ma@likegroup.de': { canSee: true, staff: true }, 'kunde@telekom.de': { canSee: true } },
      'skript_paket',
    );
    expect(plan).toEqual({
      listLink: [],
      guest: ['ma@likegroup.de'],
      blocked: [{ email: 'kunde@telekom.de', reason: 'paket' }],
    });
  });

  it('erkennt die Zuordnung über Unternehmen oder Marke', () => {
    expect(canSee({ unternehmenIds: ['firma'], markeIds: [] }, scope)).toBe(true);
    expect(canSee({ unternehmenIds: [], markeIds: ['marke'] }, scope)).toBe(true);
    expect(canSee({ unternehmenIds: ['andere'], markeIds: [] }, scope)).toBe(false);
    expect(canSee({ unternehmenIds: ['firma'], markeIds: [] }, null)).toBe(false);
  });
});

describe('Konto-Adresse', () => {
  it('ist in Frontend und Server gleich', () => {
    for (const [type, id] of [['kampagne', 'k1'], ['sourcing', 'c1'], ['strategie', 's1'], ['skript', 'sk1'], ['skript_paket', 'p1']]) {
      expect(accountListPath(type, id)).toBe(serverListPath(type, id));
    }
    expect(accountListPath('sourcing', 'c1')).toBe('/castings/c1');
    expect(accountListPath('skript_paket', 'p1')).toBeNull();
  });
});

describe('Anzeige der Aufteilung', () => {
  const plan = {
    listLink: ['kunde@telekom.de'],
    guest: ['gast@beispiel.de'],
    blocked: [{ email: 'konto@x.de', reason: 'paket' }, { email: 'alt@x.de', reason: 'unbekannt' }],
  };

  it('ordnet jeder Adresse ihren Text zu', () => {
    expect(recipientPlanRows(plan)).toEqual([
      { email: 'kunde@telekom.de', text: LIST_LINK_TEXT },
      { email: 'gast@beispiel.de', text: GUEST_TEXT },
      { email: 'konto@x.de', text: BLOCKED_TEXT.paket },
      { email: 'alt@x.de', text: BLOCKED_TEXT.scope },
    ]);
    expect(recipientPlanRows(null)).toEqual([]);
  });

  it('rendert escaped und leert bei fehlendem Plan', () => {
    const el = document.createElement('div');
    renderRecipientPlan(el, { listLink: [], guest: ['<b>@x.de'], blocked: [] });
    expect(el.querySelectorAll('.share-plan-row')).toHaveLength(1);
    expect(el.innerHTML).toContain('&lt;b&gt;@x.de');
    renderRecipientPlan(el, null);
    expect(el.innerHTML).toBe('');
  });

  it('gruppiert nach Versandart und gesperrte Adressen nach Grund', () => {
    expect(recipientPlanGroups({ ...plan, guest: ['gast@beispiel.de', 'zwei@beispiel.de'] })).toEqual([
      { art: 'konto', text: LIST_LINK_TEXT, emails: ['kunde@telekom.de'] },
      { art: 'gast', text: GUEST_TEXT, emails: ['gast@beispiel.de', 'zwei@beispiel.de'] },
      { art: 'gesperrt', text: BLOCKED_TEXT.paket, emails: ['konto@x.de'] },
      { art: 'gesperrt', text: BLOCKED_TEXT.scope, emails: ['alt@x.de'] },
    ]);
    const el = document.createElement('div');
    renderRecipientPlanGrouped(el, { listLink: [], guest: ['<b>@x.de'], blocked: [] });
    expect(el.querySelectorAll('.share-plan-row--gast')).toHaveLength(1);
    expect(el.innerHTML).toContain('&lt;b&gt;@x.de');
    renderRecipientPlanGrouped(el, null);
    expect(el.innerHTML).toBe('');
  });
});
