import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  renderVerknuepfungen,
  attachPersonasToBriefings,
  attachBriefingsToPersonas,
  skripteAusStrategie
} from '../core/ui/tableVerknuepfungen.js';
import { BriefingList } from '../modules/briefing/BriefingList.js';
import { renderItemsView as renderBriefingItems } from '../modules/briefing/BriefingFolderRenderer.js';
import { PersonaList } from '../modules/persona/PersonaList.js';
import { renderItemsView as renderPersonaItems } from '../modules/persona/PersonaFolderRenderer.js';
import { ProduktList } from '../modules/produkt/ProduktList.js';
import { renderItemsView as renderProduktItems } from '../modules/produkt/ProduktFolderRenderer.js';
import { CreatorAuswahlList } from '../modules/creator-auswahl/CreatorAuswahlList.js';
import { renderItemsView as renderKonzeptItems, renderItemsRows as renderKonzeptRows } from '../modules/strategie/StrategieListRenderer.js';
import { renderItemsView as renderSkriptItems, renderItemsRows as renderSkriptRows } from '../modules/skripte/SkriptListRenderer.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('renderVerknuepfungen', () => {
  it('leere Liste ist ein Strich', () => {
    expect(renderVerknuepfungen([])).toBe('-');
    expect(renderVerknuepfungen(null)).toBe('-');
    expect(renderVerknuepfungen([{ id: 'x' }])).toBe('-');
  });

  it('setzt mehrere Links mit den Listen-Routen', () => {
    const html = renderVerknuepfungen([
      { id: 'b1', label: 'Summer', kind: 'briefing' },
      { id: 'p1', label: 'Anna', kind: 'persona' },
      { id: 'pr1', label: 'Serum', kind: 'produkt' },
      { id: 'c1', label: 'Cast A', kind: 'casting' },
      { id: 'k1', label: 'Idee', kind: 'konzept' },
      { id: 's1', label: 'Hook', kind: 'skript' }
    ]);

    expect(html).toContain('href="/briefing/b1"');
    expect(html).toContain('href="/persona/p1"');
    expect(html).toContain('href="/produkt/pr1"');
    expect(html).toContain('href="/castings/c1"');
    expect(html).toContain('href="/konzepte/k1"');
    expect(html).toContain('href="/skripte/s1"');
    expect(html).toContain('class="table-link table-link--rel"');
    expect(html).not.toContain('data-table');
  });

  it('escaped Labels und navigiert per Klick', () => {
    window.navigateTo = vi.fn();
    const html = renderVerknuepfungen([{ id: 'b1', label: 'A & B <x>', kind: 'briefing' }]);
    expect(html).toContain('A &amp; B &lt;x&gt;');
    expect(html).not.toContain('A & B');

    document.body.innerHTML = html;
    document.querySelector('a').click();
    expect(window.navigateTo).toHaveBeenCalledWith('/briefing/b1');
  });
});

describe('persona_ids Zuordnung', () => {
  const briefings = [
    { id: 'b1', aktivierung_name: 'Summer', persona_ids: ['p1', 'p2'] },
    { id: 'b2', aktivierung_name: 'Winter', persona_ids: ['p2'] },
    { id: 'b3', aktivierung_name: 'Leer', persona_ids: [] }
  ];
  const personas = [
    { id: 'p1', name: 'Anna' },
    { id: 'p2', name: 'Ben' },
    { id: 'p9', name: 'Ohne' }
  ];

  it('hängt nur die Personas aus persona_ids an das Briefing', () => {
    const rows = attachPersonasToBriefings(briefings, personas);
    expect(rows[0].verknuepfte_personas.map((p) => p.name)).toEqual(['Anna', 'Ben']);
    expect(rows[1].verknuepfte_personas.map((p) => p.id)).toEqual(['p2']);
    expect(rows[2].verknuepfte_personas).toEqual([]);
  });

  it('gruppiert Briefings über persona_ids auf die Persona', () => {
    const rows = attachBriefingsToPersonas(personas, briefings);
    expect(rows.find((p) => p.id === 'p1').verknuepfte_briefings.map((b) => b.id)).toEqual(['b1']);
    expect(rows.find((p) => p.id === 'p2').verknuepfte_briefings.map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(rows.find((p) => p.id === 'p9').verknuepfte_briefings).toEqual([]);
  });
});

describe('Listen-Zeilen', () => {
  beforeEach(() => {
    window.validatorSystem = { sanitizeHtml: (value) => String(value ?? '') };
    window.canBulkDelete = () => false;
    window.isAdmin = () => true;
    window.isKunde = () => false;
    window.canCreate = () => false;
    window.currentUser = { rolle: 'admin', permissions: {} };
  });

  it('Briefing-Zeile und Grid-Header zeigen die Verknüpfungen', () => {
    const html = new BriefingList().renderBriefingRow({
      id: 'b1',
      aktivierung_name: 'Summer',
      produkte: [{ produkt: { id: 'pr1', name: 'Serum' } }],
      verknuepfte_personas: [{ id: 'p1', name: 'Anna' }],
      creator_auswahl: [{ id: 'c1', name: 'Cast A' }],
      strategie: [{ id: 'k1', name: 'Idee' }],
      skripte: [{ id: 's1', titel: 'Hook' }]
    }, { checkbox: false });
    expect(html).toContain('href="/produkt/pr1"');
    expect(html).toContain('href="/persona/p1"');
    expect(html).toContain('href="/castings/c1"');
    expect(html).toContain('href="/konzepte/k1"');
    expect(html).toContain('href="/skripte/s1"');

    const head = renderBriefingItems({});
    for (const label of ['Produkte', 'Personas', 'Casting', 'Konzept', 'Skript']) {
      expect(head).toContain(label);
    }
  });

  it('Persona- und Produkt-Zeile verlinken nur akzeptierte Vorschläge', () => {
    const persona = new PersonaList().renderSingleRow({
      id: 'p1',
      name: 'Anna',
      produkte: [
        { status: 'accepted', produkt: { id: 'pr1', name: 'Serum' } },
        { status: 'pending', produkt: { id: 'pr2', name: 'Weg' } }
      ],
      verknuepfte_briefings: [{ id: 'b1', aktivierung_name: 'Summer' }],
      skripte: [{ id: 's1', titel: 'Hook' }]
    }, { checkbox: false });
    expect(persona).toContain('href="/produkt/pr1"');
    expect(persona).not.toContain('Weg');
    expect(persona).toContain('href="/briefing/b1"');
    expect(persona).toContain('href="/skripte/s1"');
    expect(renderPersonaItems({})).toContain('Briefings');

    const produkt = new ProduktList().renderSingleRow({
      id: 'pr1',
      name: 'Serum',
      persona_vorschlaege: [
        { status: 'accepted', persona: { id: 'p1', name: 'Anna' } }
      ],
      briefing_links: [{ briefing: { id: 'b1', aktivierung_name: 'Summer' } }],
      skripte: []
    }, { checkbox: false });
    expect(produkt).toContain('href="/persona/p1"');
    expect(produkt).toContain('href="/briefing/b1"');
    expect(produkt).toContain('>-<');
    expect(renderProduktItems({})).toContain('Personas');
  });

  it('Casting, Konzept und Skript zeigen die Gegenrichtung', () => {
    const casting = new CreatorAuswahlList().renderItemsRows([{
      id: 'c1',
      name: 'Cast A',
      briefing: { id: 'b1', aktivierung_name: 'Summer' },
      strategie: {
        id: 'k1',
        name: 'Idee',
        strategie_items: [{ skripte: [{ id: 's1', titel: 'Hook' }] }]
      }
    }]);
    expect(casting).toContain('href="/briefing/b1"');
    expect(casting).toContain('href="/konzepte/k1"');
    expect(casting).toContain('href="/skripte/s1"');
    expect(new CreatorAuswahlList().renderItemsView()).toContain('Briefing');

    const konzept = renderKonzeptRows({
      sanitize: (value) => String(value ?? '')
    }, [{
      id: 'k1',
      name: 'Idee',
      briefing: { id: 'b1', aktivierung_name: 'Summer' },
      creator_auswahl: { id: 'c1', name: 'Cast A' },
      strategie_items: [{ skripte: [{ id: 's1', titel: 'Hook' }] }]
    }]);
    expect(konzept).toContain('href="/briefing/b1"');
    expect(konzept).toContain('href="/castings/c1"');
    expect(konzept).toContain('href="/skripte/s1"');
    expect(renderKonzeptItems({ pagination: {} })).toContain('Casting');

    const skript = renderSkriptRows({
      sanitize: (value) => String(value ?? '')
    }, [{
      id: 's1',
      titel: 'Hook',
      status: 'fragen',
      briefing: { id: 'b1', aktivierung_name: 'Summer' },
      produkt: { id: 'pr1', name: 'Serum' },
      personas: { id: 'p1', name: 'Anna' },
      strategie_item: { strategie: { id: 'k1', name: 'Idee' } }
    }]);
    expect(skript).toContain('href="/briefing/b1"');
    expect(skript).toContain('href="/produkt/pr1"');
    expect(skript).toContain('href="/persona/p1"');
    expect(skript).toContain('href="/konzepte/k1"');
    expect(renderSkriptItems({ pagination: {} })).toContain('Persona');
  });
});

describe('skripteAusStrategie', () => {
  it('flacht Skripte der Videoideen und dedupliziert', () => {
    const skripte = skripteAusStrategie({
      strategie_items: [
        { skripte: [{ id: 's1', titel: 'A' }, { id: 's2', titel: 'B' }] },
        { skripte: { id: 's1', titel: 'A' } }
      ]
    });
    expect(skripte.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(skripteAusStrategie(null)).toEqual([]);
  });
});
