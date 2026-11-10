import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  berechneBudgetTab,
  budgetQuelle,
  koopBetrag,
  ladeBudgetDaten,
  renderBudgetTab,
  skalaTicks
} from '../modules/produktion/budgetTab.js';
import { getVisibleWorkflowTabs, resolveInitialWorkflowTab } from '../modules/kampagne/KampagneDetailWorkflow.js';
import { tabHatAlleLinien } from '../modules/kampagne/linienScope.js';

const lena = { id: 'c1', vorname: 'Lena', nachname: 'Hartmann', instagram: 'https://instagram.com/lena.lifts/' };
const mia = { id: 'c2', vorname: 'Mia', nachname: 'Okafor', tiktok: '@miaokafor' };

function koop(id, { briefing_id = 'l1', creator = null, videos = [], zusatz = null, produktion_id = 'p1', name } = {}) {
  return {
    id,
    name: name || `Koop ${id}`,
    briefing_id,
    produktion_id,
    creator,
    verkaufspreis_zusatzkosten: zusatz,
    kooperation_videos: videos.map(v => ({ verkaufspreis_netto: v }))
  };
}

const koops = [
  koop('k1', { creator: lena, videos: [2000, 1800], zusatz: 500 }),
  koop('k2', { creator: lena, briefing_id: 'l2', videos: [2000] }),
  koop('k3', { creator: mia, briefing_id: 'l2', videos: [3000, '400.5'] }),
  koop('k4', { name: 'Altbestand Max', briefing_id: null, videos: [1000] })
];

beforeEach(() => {
  window.validatorSystem = {
    sanitizeHtml: (value) => String(value ?? ''),
    sanitizeUrl: (value) => String(value ?? '')
  };
});

describe('koopBetrag', () => {
  it('zählt Video-Verkaufspreise plus Zusatzkosten', () => {
    expect(koopBetrag(koops[0])).toEqual({ honorar: 3800, zusatz: 500, betrag: 4300, videos: 2 });
    expect(koopBetrag({})).toEqual({ honorar: 0, zusatz: 0, betrag: 0, videos: 0 });
  });
});

describe('berechneBudgetTab', () => {
  it('rechnet Verbrauch, Noch frei und Prozent gegen die Decke', () => {
    const m = berechneBudgetTab({ koops, decke: 40000 });
    expect(m.verbrauch).toBe(10700.5);
    expect(m.zusatzkosten).toBe(500);
    expect(m.frei).toBe(29299.5);
    expect(m.prozent).toBe(27);
    expect(m.skala).toBe(40000);
    expect(m.dieseLinie).toBeNull();
    expect(m.segmente.every(s => s.art === 'gesamt')).toBe(true);
    expect(m.freiAnteil).toBeCloseTo(73.25, 1);
  });

  it('hebt die gewählte Linie hervor; Kooperationen ohne Linie gehören zu jeder', () => {
    const m = berechneBudgetTab({ koops, decke: 40000, linieId: 'l1' });
    expect(m.dieseLinie).toBe(5300);
    expect(m.andereLinien).toBe(5400.5);
    expect(m.anzahl.dieseLinie).toBe(2);
    expect(m.segmente[0].art).toBe('linie');
    expect(m.segmente.map(s => s.art)).toEqual(['linie', 'linie', 'andere', 'andere']);
  });

  it('gruppiert die Verteilung nach Creator, absteigend, ohne Datensatz je Kooperation', () => {
    const m = berechneBudgetTab({ koops, decke: 40000, linieId: 'l1' });
    expect(m.creators.map(c => c.name)).toEqual(['Lena Hartmann', 'Mia Okafor', 'Altbestand Max']);
    const [l, mi, alt] = m.creators;
    expect(l.betrag).toBe(6300);
    expect(l.kooperationen).toBe(2);
    expect(l.zusatz).toBe(500);
    expect(l.anteil).toBe(100);
    expect(l.linieAnteil).toBeCloseTo((4300 / 6300) * 100, 5);
    expect(l.kanal).toEqual({ handle: 'lena.lifts', plattform: 'Instagram' });
    expect(mi.kanal).toEqual({ handle: 'miaokafor', plattform: 'TikTok' });
    expect(alt.creatorId).toBeNull();
    expect(alt.kanal).toBeNull();
  });

  it('klemmt eine Überschreitung nicht und markiert die Decke', () => {
    const m = berechneBudgetTab({ koops, decke: 8000 });
    expect(m.frei).toBe(-2700.5);
    expect(m.prozent).toBe(134);
    expect(m.skala).toBe(10700.5);
    expect(m.freiAnteil).toBe(0);
    expect(m.deckeMarke).toBeCloseTo((8000 / 10700.5) * 100, 5);
  });

  it('ohne Decke: kein Noch frei, Skala bis zum Verbrauch', () => {
    const m = berechneBudgetTab({ koops, decke: null });
    expect(m.budget).toBeNull();
    expect(m.frei).toBeNull();
    expect(m.prozent).toBeNull();
    expect(m.skala).toBe(10700.5);
  });

  it('zieht im geteilten Topf die anderen Produktionen ab', () => {
    const m = berechneBudgetTab({ koops, decke: 40000, andereProduktionen: 9299.5 });
    expect(m.belegt).toBe(20000);
    expect(m.frei).toBe(20000);
    expect(m.prozent).toBe(50);
    expect(m.segmente.at(-1)).toMatchObject({ art: 'produktionen', betrag: 9299.5 });
  });
});

describe('skalaTicks', () => {
  it('setzt Marken auf runde Werte und endet an der Skala', () => {
    expect(skalaTicks(40000).map(t => t.wert)).toEqual([0, 10000, 20000, 30000, 40000]);
    expect(skalaTicks(231000).map(t => t.wert)).toEqual([0, 50000, 100000, 150000, 231000]);
    expect(skalaTicks(0)).toEqual([]);
  });

  it('lässt eine runde Marke weg, die das End-Label überdecken würde', () => {
    expect(skalaTicks(41000).map(t => t.wert)).toEqual([0, 10000, 20000, 30000, 41000]);
    expect(skalaTicks(10700.5).map(t => t.wert)).toEqual([0, 2500, 5000, 7500, 10700.5]);
  });

  it('markiert das Budget am Ende oder, bei Überschreitung, an seiner Stelle', () => {
    expect(skalaTicks(40000, 40000).at(-1)).toEqual({ pos: 100, wert: 40000, budget: true });

    const ueber = skalaTicks(50300, 45000);
    expect(ueber.map(t => t.wert)).toEqual([0, 10000, 20000, 30000, 45000]);
    expect(ueber.at(-1)).toMatchObject({ budget: true, decke: true });
  });
});

describe('budgetQuelle', () => {
  it('benennt die Herkunft der Decke', () => {
    expect(budgetQuelle({ decke: 15000, eigen: true }, 15000).label).toBe('Produktionsbudget');
    expect(budgetQuelle({ decke: 0, eigen: true }, null).label).toBe('Kein Produktionsbudget');
    expect(budgetQuelle({ decke: 40000, eigen: false, quelle: 'creator' }, null).label).toBe('Creator-Budget der Kampagne');
    expect(budgetQuelle({ decke: 40000, eigen: false, quelle: 'volumen' }, null).label).toBe('Volumen der Kampagne');
    expect(budgetQuelle({ decke: null }, null).label).toBe('Kein Budget hinterlegt');
  });
});

describe('renderBudgetTab', () => {
  const stand = { decke: 40000, eigen: true, verbrauch: 0 };
  // Intl setzt ein geschütztes Leerzeichen vor das €.
  const render = (...args) => renderBudgetTab(...args).replace(/\u00a0/g, ' ');

  it('zeigt Linie, andere Linien, Noch frei und die Creator', () => {
    const html = render({ stand, koops }, { linieId: 'l1', linieName: 'Nano', eigenesBudget: 40000 });
    expect(html).not.toContain('budget-tab__overline');
    expect(html).toContain('budget-tab__segment-tip--start');
    expect(html).toContain('10.700,50 €');
    expect(html).toContain('40.000 €');
    expect(html).toContain('Diese Linie');
    expect(html).toContain('2 Kooperationen · Nano');
    expect(html).toContain('Andere Linien');
    expect(html).toContain('Noch frei');
    expect(html).toContain('Davon 500 € Zusatzkosten.');
    expect(html).toContain('budget-tab__segment--linie');
    expect(html).toContain('class="budget-tab__kanal" href="https://instagram.com/lena.lifts"');
    expect(html).toContain('@lena.lifts</a> auf Instagram');
    expect(html).toContain('href="https://www.tiktok.com/@miaokafor"');
    expect(html).toContain('href="/creator/c1"');
    expect(html).toContain('Kooperation ohne Creator-Datensatz');
    expect(html).not.toContain('Kategorien');
    expect(html).not.toContain('data-linie=');
  });

  it('zeigt bei Alle Linien eine Kachel Verbraucht ohne Hervorhebung', () => {
    const html = render({ stand, koops }, { linieId: null, eigenesBudget: 40000 });
    expect(html).toContain('Verbraucht');
    expect(html).not.toContain('Diese Linie');
    expect(html).not.toContain('budget-tab__segment--linie');
  });

  it('zeigt eine Überschreitung als Überschritten', () => {
    const html = render({ stand: { decke: 8000, eigen: true }, koops }, { eigenesBudget: 8000 });
    expect(html).toContain('Überschritten');
    expect(html).toContain('2.700,50 €');
    expect(html).toContain('34 % über dem Budget');
    expect(html).toContain('budget-tab__decke');
  });

  it('kommt ohne Kooperationen und ohne Budget aus', () => {
    const html = render({ stand: { decke: null }, koops: [] });
    expect(html).toContain('Weder Produktion noch Kampagne haben ein Budget.');
    expect(html).toContain('Noch kein Verbrauch');
    expect(html).toContain('Noch keine Kooperationen');
    expect(html).not.toContain('Noch frei');
  });
});

describe('ladeBudgetDaten', () => {
  function supabaseMock({ produktion, kampagne, koopRows }) {
    const calls = [];
    const builder = (table) => {
      const state = { table, filters: [] };
      const chain = {
        select: () => chain,
        eq: (col, val) => { state.filters.push(['eq', col, val]); return chain; },
        not: (col, op, val) => { state.filters.push(['not', col, val]); return chain; },
        in: () => chain,
        limit: () => chain,
        maybeSingle: () => {
          if (table === 'produktion') return Promise.resolve({ data: produktion, error: null });
          if (table === 'kampagne') return Promise.resolve({ data: kampagne, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        then: (resolve) => {
          calls.push(state);
          if (table === 'kooperationen') return resolve({ data: koopRows, error: null });
          if (table === 'produktion') return resolve({ data: [{ id: 'p1' }, { id: 'p2' }].filter(() => !state.filters.some(f => f[0] === 'not')), error: null });
          return resolve({ data: [], error: null });
        }
      };
      return chain;
    };
    return { from: vi.fn(builder), calls };
  }

  it('lädt im geteilten Topf die Kooperationen der Kampagne und summiert die anderen Produktionen', async () => {
    const supabase = supabaseMock({
      produktion: { id: 'p1', budget: null, kampagne_id: 'k' },
      kampagne: { creator_budget: 40000 },
      koopRows: [
        koop('a', { videos: [1000] }),
        koop('b', { produktion_id: 'p2', videos: [2500], zusatz: 100 })
      ]
    });
    const daten = await ladeBudgetDaten(supabase, { produktionId: 'p1', kampagneId: 'k' });
    expect(daten.stand.eigen).toBe(false);
    expect(daten.koops.map(k => k.id)).toEqual(['a']);
    expect(daten.andereProduktionen).toBe(2600);
    const koopCall = supabase.calls.find(c => c.table === 'kooperationen');
    expect(koopCall.filters).toContainEqual(['eq', 'kampagne_id', 'k']);
  });

  it('lädt mit eigenem Budget nur die eigene Produktion', async () => {
    const supabase = supabaseMock({
      produktion: { id: 'p1', budget: 15000, kampagne_id: 'k' },
      koopRows: [koop('a', { videos: [1000] })]
    });
    const daten = await ladeBudgetDaten(supabase, { produktionId: 'p1', kampagneId: 'k' });
    expect(daten.stand).toMatchObject({ decke: 15000, eigen: true });
    expect(daten.andereProduktionen).toBe(0);
    const koopCall = supabase.calls.find(c => c.table === 'kooperationen');
    expect(koopCall.filters).toContainEqual(['eq', 'produktion_id', 'p1']);
  });
});

describe('Budget als Workflow-Tab', () => {
  beforeEach(() => {
    window.isAdmin = () => true;
  });

  it('steht vor Briefing, nur mit Preis-Sicht', () => {
    window.canSeePricing = () => true;
    expect(getVisibleWorkflowTabs().map(t => t.id).slice(0, 2)).toEqual(['budget', 'briefing']);
    window.canSeePricing = () => false;
    expect(getVisibleWorkflowTabs().map(t => t.id)).not.toContain('budget');
  });

  it('öffnet weiter mit Briefing, ?tab=budget bleibt als Deeplink', () => {
    window.canSeePricing = () => true;
    window.history.replaceState(null, '', '/produktion/p1');
    expect(resolveInitialWorkflowTab()).toBe('briefing');
    window.history.replaceState(null, '', '/produktion/p1?tab=budget');
    expect(resolveInitialWorkflowTab()).toBe('budget');
    window.canSeePricing = () => false;
    expect(resolveInitialWorkflowTab()).toBe('briefing');
    window.history.replaceState(null, '', '/');
  });

  it('bietet im Linien-Umschalter Alle Linien an', () => {
    expect(tabHatAlleLinien('budget')).toBe(true);
  });
});
