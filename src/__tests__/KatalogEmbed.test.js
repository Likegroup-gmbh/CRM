import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProduktList } from '../modules/produkt/ProduktList.js';
import { PersonaList } from '../modules/persona/PersonaList.js';
import { katalogScope } from '../modules/kampagne/KampagneDetailKatalog.js';

function queryResult({ rows = [], single = null } = {}) {
  const q = {
    calls: [],
    select(...args) { q.calls.push(['select', args]); return q; },
    not() { return q; },
    order() { return q; },
    in(...args) { q.calls.push(['in', args]); return q; },
    overlaps() { return q; },
    eq(...args) { q.calls.push(['eq', args]); return q; },
    is() { return q; },
    range() { return q; },
    maybeSingle() {
      return Promise.resolve({ data: single, error: null });
    },
    then(resolve, reject) {
      return Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve, reject);
    }
  };
  return q;
}

describe('Listen embedded in der Produktion', () => {
  const queries = [];

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function installWindow() {
    queries.length = 0;
    window.isAdmin = () => true;
    window.isKunde = () => false;
    window.canBulkDelete = () => false;
    window.currentUser = { permissions: {} };
    window.validatorSystem = { sanitizeHtml: (value) => String(value ?? '') };
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn();
    window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
    window.content = document.createElement('div');
    window.supabase = {
      from(table) {
        let result;
        if (table === 'campaign_briefings') {
          result = queryResult({
            single: { persona_ids: ['pe1', 'pe2'] },
            rows: [{ id: 'b1', aktivierung_name: 'Sommer', persona_ids: ['pe1'] }]
          });
        } else if (table === 'campaign_briefing_produkt') {
          result = queryResult({
            rows: [
              { produkt: { id: 'aus-briefing', name: 'Serum' } },
              { produkt: null }
            ]
          });
        } else {
          result = queryResult({ rows: [] });
        }
        queries.push({ table, q: result });
        return result;
      }
    };
    window.history.pushState({}, '', '/produktion/p1?tab=produkte');
    vi.spyOn(window.history, 'replaceState');
  }

  const scope = {
    briefingId: 'b1',
    briefingName: 'Sommer',
    produktId: 'serum',
    produktName: 'Serum',
    produktionId: 'p1',
    unternehmenId: 'u1',
    unternehmenName: 'Hautica',
    markeId: 'm1',
    markeName: 'Clear'
  };

  it('mountet nur das Produkt der Produktion in der flachen Tabelle', async () => {
    installWindow();
    const root = document.createElement('div');
    document.body.appendChild(root);
    const list = new ProduktList();

    await list.mountEmbedded(root, scope);

    expect(root.querySelector('#companies-grid')).toBeNull();
    expect(root.querySelector('#btn-view-grid')).toBeNull();
    expect(root.querySelector('.data-table')).toBeTruthy();
    expect(root.textContent).toContain('Produkt anlegen');
    expect(window.setHeadline).not.toHaveBeenCalled();
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(queries.map(q => q.table)).not.toContain('campaign_briefing_produkt');
    const produktQuery = queries.find(q => q.table === 'produkt');
    expect(produktQuery.q.calls).toEqual(expect.arrayContaining([
      ['in', ['id', ['serum']]]
    ]));
    expect(list.resolveDetailRoute('abc')).toBe(
      '/produkt/abc'
    );

    window.navigateTo = vi.fn();
    list.showCreateForm();
    expect(window.navigateTo).toHaveBeenCalledWith(
      '/produkt/new?unternehmen=u1&marke=m1&briefing=b1&produktion=p1'
    );
    list.destroy();
  });

  it('fällt ohne produkt_id auf die Briefing-Produkte zurück', async () => {
    installWindow();
    const root = document.createElement('div');
    document.body.appendChild(root);
    const list = new ProduktList();

    await list.mountEmbedded(root, { briefingId: 'b1' });

    expect(queries.map(q => q.table)).toContain('campaign_briefing_produkt');
    const produktQuery = queries.find(q => q.table === 'produkt');
    expect(produktQuery.q.calls).toEqual(expect.arrayContaining([
      ['in', ['id', ['aus-briefing']]]
    ]));
    list.destroy();
  });

  it('lädt ohne Zuordnung keine Produkte', async () => {
    installWindow();
    const root = document.createElement('div');
    document.body.appendChild(root);
    const list = new ProduktList();

    await list.mountEmbedded(root, {});

    expect(queries.map(q => q.table)).not.toContain('produkt');
    expect(root.querySelector('.data-table')).toBeTruthy();
    list.destroy();
  });

  it('mountet nur die Personas des Briefings', async () => {
    installWindow();
    window.history.pushState({}, '', '/produktion/p1?tab=personas');
    const root = document.createElement('div');
    document.body.appendChild(root);
    const list = new PersonaList();

    await list.mountEmbedded(root, scope);

    expect(root.querySelector('#companies-grid')).toBeNull();
    expect(root.querySelector('#btn-view-grid')).toBeNull();
    expect(root.querySelector('.data-table')).toBeTruthy();
    expect(root.textContent).toContain('Persona anlegen');
    expect(window.setHeadline).not.toHaveBeenCalled();
    expect(window.history.replaceState).not.toHaveBeenCalled();
    const briefingQuery = queries.find(q => q.table === 'campaign_briefings');
    expect(briefingQuery.q.calls).toEqual(expect.arrayContaining([
      ['eq', ['id', 'b1']]
    ]));
    const personaQuery = queries.find(q => q.table === 'personas');
    expect(personaQuery.q.calls).toEqual(expect.arrayContaining([
      ['in', ['id', ['pe1', 'pe2']]]
    ]));
    expect(list.resolveDetailRoute('abc')).toBe(
      '/persona/abc'
    );

    list.openCreateDrawer();
    await vi.waitFor(() => {
      expect(document.getElementById('pccreate-briefing')?.value).toBe('b1');
    });
    expect(document.getElementById('pccreate-unternehmen').value).toBe('u1');
    expect(document.getElementById('pccreate-marke').value).toBe('m1');
    list.destroy();
  });

  it('lädt ohne Briefing keine Personas', async () => {
    installWindow();
    const root = document.createElement('div');
    document.body.appendChild(root);
    const list = new PersonaList();

    await list.mountEmbedded(root, {});

    expect(queries.map(q => q.table)).not.toContain('personas');
    expect(queries.map(q => q.table)).not.toContain('campaign_briefings');
    list.destroy();
  });
});

describe('katalogScope', () => {
  it('nimmt Briefing und Produkt von der Produktion', () => {
    expect(katalogScope({
      produktionId: 'p1',
      produktion: {
        id: 'p1',
        briefing_id: 'b1',
        produkt_id: 'serum',
        briefing: { aktivierung_name: 'Sommer' },
        produkt: { name: 'Serum' }
      },
      kampagneData: {
        unternehmen_id: 'u1',
        marke_id: 'm1',
        unternehmen: { firmenname: 'Hautica' },
        marke: { markenname: 'Clear' }
      }
    })).toMatchObject({
      briefingId: 'b1',
      briefingName: 'Sommer',
      produktId: 'serum',
      produktName: 'Serum',
      produktionId: 'p1',
      unternehmenId: 'u1',
      unternehmenName: 'Hautica',
      markeId: 'm1',
      markeName: 'Clear'
    });
  });
});
