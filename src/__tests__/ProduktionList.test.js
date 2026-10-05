import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/produktion/ProduktionService.js', () => ({
  listAllProduktionen: vi.fn()
}));

import { listAllProduktionen } from '../modules/produktion/ProduktionService.js';
import { ProduktionList, renderProduktionListHtml } from '../modules/produktion/ProduktionList.js';

describe('globale Produktionsliste', () => {
  beforeEach(() => {
    window.validatorSystem = {
      sanitizeHtml: (value) => String(value ?? '')
    };
  });

  it('zeigt Produktion, Kampagne und den Link auf die Produktion', () => {
    const html = renderProduktionListHtml([{
      id: 'p1',
      name: 'Neuer Süßer Senf 2.0',
      produkt: { id: 'pr1', name: 'Senf' },
      briefing: {
        aktivierung_name: 'Briefing Senf',
        produkte: [{ produkt: { id: 'pr1', name: 'Senf' } }],
        verknuepfte_personas: [{ id: 'pe1', name: 'Anna' }]
      },
      creator_auswahl: [{ id: 'c1', name: 'Cast Senf' }],
      strategie: [{ id: 's1', name: 'Konzept Senf' }],
      skripte: [{ id: 'sk1', titel: 'Hook Senf' }],
      vertraege: [{ id: 'v1', name: 'Vertrag Senf' }],
      budgetUsed: 1000,
      kampagne: {
        id: 'k1',
        eigener_name: 'Burger',
        auftrag: { creator_budget: 40000 }
      }
    }]);

    expect(html).toContain('>Produktion<');
    expect(html).toContain('>Produkte<');
    expect(html).toContain('>Personas<');
    expect(html).toContain('>Casting<');
    expect(html).toContain('>Konzept<');
    expect(html).toContain('>Skripte<');
    expect(html).toContain('>Verträge<');
    expect(html).toContain('produktion-search-input');
    expect(html).toContain('Neuer Süßer Senf 2.0');
    expect(html).toContain('href="/produktion/p1"');
    expect(html).toContain('data-table="produktion"');
    expect(html).toContain('Burger');
    expect(html).toContain('href="/kampagne/k1"');
    expect(html).toContain('href="/produkt/pr1"');
    expect(html).toContain('Senf');
    expect(html.match(/href="\/produkt\/pr1"/g)).toHaveLength(1);
    expect(html).toContain('Briefing Senf');
    expect(html).toContain('href="/persona/pe1"');
    expect(html).toContain('href="/castings/c1"');
    expect(html).toContain('href="/konzepte/s1"');
    expect(html).toContain('href="/skripte/sk1"');
    expect(html).toContain('href="/vertraege/v1/edit"');
    expect(html).toContain('budget-progress-cell');
  });

  it('filtert über Kampagne, Produkt, Briefing und Casting', () => {
    const rows = [{
      id: 'p1',
      name: 'Senf',
      produkt: { id: 'pr1', name: 'Senf' },
      briefing: { aktivierung_name: 'Briefing Senf' },
      creator_auswahl: [{ id: 'c1', name: 'Cast Senf' }],
      kampagne: { id: 'k1', eigener_name: 'Burger' }
    }, {
      id: 'p2',
      name: 'Ketchup',
      kampagne: { id: 'k2', kampagnenname: 'Safari' }
    }];

    expect(renderProduktionListHtml(rows, { searchQuery: 'burger' })).toContain('href="/produktion/p1"');
    expect(renderProduktionListHtml(rows, { searchQuery: 'burger' })).not.toContain('href="/produktion/p2"');
    expect(renderProduktionListHtml(rows, { searchQuery: 'safari' })).toContain('Ketchup');
    expect(renderProduktionListHtml(rows, { searchQuery: 'briefing senf' })).toContain('href="/produktion/p1"');
    expect(renderProduktionListHtml(rows, { searchQuery: 'cast' })).toContain('Cast Senf');

    const miss = renderProduktionListHtml(rows, { searchQuery: 'nichts' });
    expect(miss).toContain('Keine Treffer');
    expect(miss).not.toContain('href="/produktion/');
  });

  it('zeigt den Leerzustand ohne Zeilen', () => {
    const html = renderProduktionListHtml([]);
    expect(html).toContain('Noch keine Produktion');
    expect(html).not.toContain('href="/produktion/');
  });

  it('zeigt einen Platzhalter, solange der Verbrauch fehlt', () => {
    const html = renderProduktionListHtml([{
      id: 'p1',
      name: 'Senf',
      kampagne: { id: 'k1', eigener_name: 'Burger', auftrag: { creator_budget: 40000 } }
    }]);

    expect(html).toContain('budget-pending');
    expect(html).not.toContain('budget-progress-cell');
  });

  it('zeigt die Budget-Spalte mit eigenem Budget oder Platzhalter', () => {
    const html = renderProduktionListHtml([
      {
        id: 'p1',
        name: 'Senf',
        budget: 15000,
        budgetUsed: 1000,
        kampagne: { id: 'k1', eigener_name: 'Burger', auftrag: { creator_budget: 40000 } }
      },
      {
        id: 'p2',
        name: 'Ketchup',
        budgetUsed: 500,
        kampagne: { id: 'k1', eigener_name: 'Burger', auftrag: { creator_budget: 40000 } }
      }
    ]);

    expect(html).toContain('>Budget<');
    expect(html).toContain('15.000,00');
    expect(html).toContain('<span class="text-muted">–</span>');
    // Eigenes Budget: 1.000 / 15.000 = 7%
    expect(html).toContain('style="width: 7%"');
  });

  it('rechnet den Verbrauch budget-loser Produktionen derselben Kampagne gegen', () => {
    const kampagne = { id: 'k1', eigener_name: 'Burger', auftrag: { creator_budget: 40000 } };
    const html = renderProduktionListHtml([
      { id: 'p1', name: 'Senf', budgetUsed: 1000, kampagne },
      { id: 'p2', name: 'Ketchup', budgetUsed: 1000, kampagne }
    ]);

    // 1.000 + 1.000 = 2.000 von 40.000 -> beide Balken zeigen 5%
    expect(html.match(/style="width: 5%"/g)).toHaveLength(2);
    expect(html.match(/2\.000,00/g)).toHaveLength(2);
  });

  it('trennt den geteilten Topf zwischen Kampagnen und nutzt das Kampagnen-Budget', () => {
    const html = renderProduktionListHtml([
      {
        id: 'p1',
        name: 'Senf',
        budgetUsed: 15000,
        kampagne: { id: 'k1', eigener_name: 'Burger', volumen: 25000, creator_budget: 30000, auftrag: { creator_budget: 40000 } }
      },
      {
        id: 'p2',
        name: 'Ketchup',
        budgetUsed: 1000,
        kampagne: { id: 'k2', eigener_name: 'Safari', auftrag: { creator_budget: 40000 } }
      }
    ]);

    // k1: Kampagnen-Budget 30.000 schlägt Auftrag -> 15.000 / 30.000 = 50%
    expect(html).toContain('style="width: 50%"');
    // k2: eigener Topf, nur eigener Verbrauch -> 1.000 / 40.000 = 3%
    expect(html).toContain('style="width: 3%"');
  });
});

describe('ProduktionList.init', () => {
  const row = {
    id: 'p1',
    name: 'Senf',
    kampagne: { id: 'k1', unternehmen_id: 'u1', eigener_name: 'Burger', auftrag: { creator_budget: 40000 } }
  };

  beforeEach(() => {
    // Direkt auf der Produktionen-Ebene, dort liegt die Tabelle
    window.history.replaceState({}, '', '/produktionen?unternehmen=u1&unternehmen_name=Firma&marke=ohne&kampagne=k1&kampagne_name=Burger');
    window.validatorSystem = { sanitizeHtml: (value) => String(value ?? '') };
    window.canViewPage = () => true;
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
    window.setContentSafely = (el, html) => { el.innerHTML = html; };
    window.ErrorHandler = { handle: (error) => { throw error; } };
    listAllProduktionen.mockReset();
  });

  afterEach(() => {
    window.content?.remove();
  });

  it('zeichnet die Tabelle vor dem Verbrauch und zieht die Zelle nach', async () => {
    let finish;
    listAllProduktionen.mockImplementation(({ onRows }) => {
      onRows([row]);
      return new Promise(resolve => { finish = resolve; });
    });

    const list = new ProduktionList();
    const done = list.init();
    expect(window.content.innerHTML).toContain('budget-pending');

    finish([{ ...row, budgetUsed: 1000 }]);
    await done;

    expect(window.content.innerHTML).toContain('budget-progress-cell');
    expect(window.content.innerHTML).not.toContain('budget-pending');
    list.destroy();
  });

  it('zieht den Verbrauch nicht nach, wenn die Liste schon verlassen wurde', async () => {
    let finish;
    listAllProduktionen.mockImplementation(({ onRows }) => {
      onRows([row]);
      return new Promise(resolve => { finish = resolve; });
    });

    const list = new ProduktionList();
    const done = list.init();
    list.destroy();
    finish([{ ...row, budgetUsed: 1000 }]);
    await done;

    expect(window.content.innerHTML).toContain('budget-pending');
    expect(window.content.innerHTML).not.toContain('budget-progress-cell');
  });

  it('filtert nur den Tabellenkörper und behält den Verbrauch', async () => {
    const other = {
      id: 'p2',
      name: 'Ketchup',
      kampagne: { id: 'k2', eigener_name: 'Safari', auftrag: { creator_budget: 40000 } }
    };
    listAllProduktionen.mockImplementation(({ onRows }) => {
      onRows([row, other]);
      return Promise.resolve([
        { ...row, budgetUsed: 1000 },
        { ...other, budgetUsed: 500 }
      ]);
    });

    const list = new ProduktionList();
    await list.init();

    const input = window.content.querySelector('#produktion-search-input');
    input.value = 'Safari';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(input.isConnected).toBe(true);
    expect(window.content.innerHTML).toContain('Ketchup');
    expect(window.content.innerHTML).not.toContain('href="/produktion/p1"');
    expect(window.content.innerHTML).toContain('budget-progress-cell');
    list.destroy();
    window.content.remove();
  });

  it('aktiviert Drag-to-Scroll und räumt es beim Verlassen ab', async () => {
    listAllProduktionen.mockImplementation(({ onRows }) => {
      onRows([row]);
      return Promise.resolve([{ ...row, budgetUsed: 1000 }]);
    });

    const list = new ProduktionList();
    await list.init();

    const container = window.content.querySelector('.data-table-container');
    expect(container.classList.contains('drag-scroll-enabled')).toBe(true);

    list.destroy();
    expect(container.classList.contains('drag-scroll-enabled')).toBe(false);
  });
});

describe('ProduktionList Ordner-Navigation', () => {
  const kampagne = (id, name, unternehmen, marke) => ({
    id,
    eigener_name: name,
    unternehmen_id: unternehmen.id,
    unternehmen,
    marke_id: marke?.id || null,
    marke: marke || null
  });
  const alpha = { id: 'u1', firmenname: 'Alpha', logo_url: null };
  const beta = { id: 'u2', firmenname: 'Beta', logo_url: null };
  const gamma = { id: 'u3', firmenname: 'Gamma', logo_url: null };
  const mx = { id: 'm1', markenname: 'Marke X', logo_url: null };
  const rows = [
    { id: 'p1', name: 'Senf', kampagne: kampagne('k1', 'Burger', alpha, mx) },
    { id: 'p2', name: 'Ketchup', kampagne: kampagne('k2', 'Safari', alpha, null) },
    { id: 'p3', name: 'Mayo', kampagne: kampagne('k3', 'Sommer', beta, null) },
    { id: 'p4', name: 'Salz', kampagne: kampagne('k4', 'Winter', gamma, null) },
    { id: 'p5', name: 'Pfeffer', kampagne: kampagne('k4', 'Winter', gamma, null) }
  ];

  const click = (selector) => window.content.querySelector(selector).click();
  const names = () => [...window.content.querySelectorAll('.folder-name')].map(el => el.textContent);

  beforeEach(() => {
    window.history.replaceState({}, '', '/produktionen');
    window.validatorSystem = { sanitizeHtml: (value) => String(value ?? '') };
    window.canViewPage = () => true;
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
    window.setContentSafely = (el, html) => { el.innerHTML = html; };
    window.ErrorHandler = { handle: (error) => { throw error; } };
    window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
    listAllProduktionen.mockReset();
    listAllProduktionen.mockImplementation(({ onRows }) => {
      onRows(rows);
      return Promise.resolve(rows);
    });
  });

  afterEach(() => {
    window.content?.remove();
    delete window.breadcrumbSystem;
  });

  const crumbLabels = () => window.breadcrumbSystem.updateBreadcrumb.mock.calls.at(-1)[0].map(c => c.label);

  it('startet im Grid mit den Unternehmen', async () => {
    const list = new ProduktionList();
    await list.init();

    expect(window.content.querySelector('.folders-grid')).not.toBeNull();
    expect(names()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(window.content.querySelector('#btn-view-grid').classList.contains('active')).toBe(true);
    expect(window.content.querySelector('#btn-produktion-back').style.display).toBe('none');
    list.destroy();
  });

  it('geht Unternehmen, Marke, Kampagne bis zu den Produktionen', async () => {
    const list = new ProduktionList();
    await list.init();

    click('[data-unternehmen-id="u1"]');
    expect(names()).toEqual(['Marke X', 'Nur Unternehmen']);
    expect(window.location.search).toContain('unternehmen=u1');

    click('[data-marke-id="m1"]');
    expect(names()).toEqual(['Burger']);

    click('[data-kampagne-id="k1"]');
    expect(window.content.querySelector('a[href="/produktion/p1"]')).not.toBeNull();
    expect(window.content.querySelector('a[href="/produktion/p2"]')).toBeNull();
    expect(crumbLabels()).toEqual(['Produktion', 'Alpha', 'Marke X', 'Burger']);
    expect(window.location.search).toContain('kampagne=k1');

    click('#btn-produktion-back');
    expect(names()).toEqual(['Burger']);
    click('#btn-produktion-back');
    expect(names()).toEqual(['Marke X', 'Nur Unternehmen']);
    click('#btn-produktion-back');
    expect(names()).toEqual(['Alpha', 'Beta', 'Gamma']);
    list.destroy();
  });

  it('überspringt die Marken-Ebene bei Unternehmen ohne echte Marke', async () => {
    const list = new ProduktionList();
    await list.init();

    click('[data-unternehmen-id="u2"]');
    expect(names()).toEqual(['Sommer']);
    expect(window.location.search).toContain('marke=ohne');
    expect(crumbLabels()).toEqual(['Produktion', 'Beta']);

    click('[data-kampagne-id="k3"]');
    expect(crumbLabels()).toEqual(['Produktion', 'Beta', 'Sommer']);

    click('#btn-produktion-back');
    expect(names()).toEqual(['Sommer']);
    click('#btn-produktion-back');
    expect(names()).toEqual(['Alpha', 'Beta', 'Gamma']);
    list.destroy();
  });

  it('zählt Produktionen je Kampagne und schaltet auf die Liste um', async () => {
    const list = new ProduktionList();
    await list.init();

    click('#btn-view-list');
    expect(window.content.querySelector('.folders-grid')).toBeNull();
    expect(window.content.querySelector('tr[data-folder-level="companies"]')).not.toBeNull();
    expect(window.content.querySelector('#btn-view-list').classList.contains('active')).toBe(true);

    click('tr[data-unternehmen-id="u3"] a.table-link');
    expect(window.content.textContent).toContain('Winter');
    expect(window.content.textContent).toContain('2');
    list.destroy();
  });

  it('öffnet einen Deeplink direkt auf der Kampagnen-Ebene', async () => {
    window.history.replaceState({}, '', '/produktionen?unternehmen=u1&unternehmen_name=Alpha&marke=ohne');
    const list = new ProduktionList();
    await list.init();

    expect(names()).toEqual(['Safari']);
    expect(crumbLabels()).toEqual(['Produktion', 'Alpha', 'Nur Unternehmen']);
    list.destroy();
  });

  it('sucht global als flache Trefferliste und bringt die Ordner zurück', async () => {
    const list = new ProduktionList();
    await list.init();

    const input = window.content.querySelector('#produktion-search-input');
    input.value = 'mayo';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(window.content.querySelector('.folders-grid')).toBeNull();
    expect(window.content.querySelector('a[href="/produktion/p3"]')).not.toBeNull();
    expect(window.content.querySelector('a[href="/produktion/p1"]')).toBeNull();
    expect(window.content.querySelector('#btn-produktion-back').style.display).toBe('none');
    expect(crumbLabels()).toEqual(['Produktion']);

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(names()).toEqual(['Alpha', 'Beta', 'Gamma']);
    list.destroy();
  });
});
