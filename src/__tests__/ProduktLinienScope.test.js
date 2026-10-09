// Produkte-Tab einer Linie: Standardprodukt zeigt seine Daten, übernommene die der Linie; „Von der Linie lösen“ im Aktionsmenü (ADR 0052).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionBuilder } from '../core/actions/ActionBuilder.js';
import { ActionConfig } from '../core/actions/ActionConfig.js';
import { GLOBAL_ACTIONS, handleAction } from '../core/ActionsDropdownHandlers.js';
import { ProduktList } from '../modules/produkt/ProduktList.js';

function chain(rows = [], single = null, onDelete = null) {
  const q = {
    select: () => q,
    not: () => q,
    order: () => q,
    in: () => q,
    overlaps: () => q,
    eq: (...args) => { q.eqs.push(args); return q; },
    is: () => q,
    range: () => q,
    eqs: [],
    delete: () => { q.deleted = true; return q; },
    maybeSingle: () => Promise.resolve({ data: single, error: null }),
    then(resolve, reject) {
      if (q.deleted) onDelete?.(q.eqs);
      return Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve, reject);
    }
  };
  return q;
}

const produkt = {
  id: 'creme',
  name: 'Creme',
  unternehmen_id: 'u1',
  unternehmen: { id: 'u1', firmenname: 'FAG' },
  marken: [],
  varianten: [],
  persona_vorschlaege: [
    { status: 'accepted', persona: { id: 'mutti', name: 'Mutti' } },
    { status: 'accepted', persona: { id: 'sportler', name: 'Sportler' } }
  ],
  briefing_links: [
    { briefing: { id: 'nano', aktivierung_name: 'Nano Briefing' } },
    { briefing: { id: 'ugc', aktivierung_name: 'UGC Briefing' } }
  ],
  skripte: [
    { id: 's-nano', titel: 'Nano Skript', briefing_id: 'nano' },
    { id: 's-ugc', titel: 'UGC Skript', briefing_id: 'ugc' },
    { id: 's-alt', titel: 'Altes Skript', briefing_id: null }
  ]
};

function installWindow(onDelete) {
  window.isAdmin = () => true;
  window.isKunde = () => false;
  window.canBulkDelete = () => false;
  window.currentUser = { permissions: {}, rolle: 'admin' };
  window.validatorSystem = { sanitizeHtml: (value) => String(value ?? '') };
  window.setContentSafely = vi.fn();
  window.supabase = {
    from(table) {
      if (table === 'campaign_briefings') return chain([], { persona_ids: ['linien-persona'], produkt_id: null });
      if (table === 'produktion') return chain([], { produkt_id: 'standard' });
      if (table === 'personas') return chain([{ id: 'linien-persona', name: 'Linien-Persona' }]);
      if (table === 'campaign_briefing_produkt') return chain([], null, onDelete);
      return chain([]);
    }
  };
}

async function mountList(scope) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const list = new ProduktList();
  await list.mountEmbedded(root, scope);
  return { list, root };
}

describe('optIn-Action im Produkt-Menü', () => {
  it('fehlt ohne Freigabe und erscheint mit actionStates', () => {
    const builder = new ActionBuilder();
    const config = ActionConfig.get('produkt', 'admin');

    const ohne = builder.buildActionsHTML(config.actions, 'p1', 'produkt', {});
    expect(ohne).not.toContain('produkt-von-linie-loesen');

    const mit = builder.buildActionsHTML(config.actions, 'p1', 'produkt', {
      actionStates: { 'produkt-von-linie-loesen': { mode: 'enabled' } }
    });
    expect(mit).toContain('data-action="produkt-von-linie-loesen"');
    expect(mit).toContain('Von der Linie lösen');
    expect(mit.indexOf('produkt-von-linie-loesen')).toBeLessThan(mit.indexOf('data-action="delete"'));
  });

  it('ist eine bekannte globale Action und schickt ein Event mit der Produkt-ID', async () => {
    expect(GLOBAL_ACTIONS.has('produkt-von-linie-loesen')).toBe(true);

    const handler = vi.fn();
    window.addEventListener('produkt-von-linie-loesen', handler);
    await handleAction({}, 'produkt-von-linie-loesen', 'creme', 'produkt', null);
    window.removeEventListener('produkt-von-linie-loesen', handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ produktId: 'creme' });
  });
});

describe('ProduktList auf dem Produkte-Tab einer Linie', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.supabase;
    delete window.confirmationModal;
    vi.restoreAllMocks();
  });

  const scope = { briefingId: 'ugc', unternehmenId: 'u1', markeId: null, produktionId: 'p1' };

  const standard = {
    ...produkt,
    id: 'standard',
    name: 'Standard',
    persona_vorschlaege: [{ status: 'accepted', persona: { id: 'alex', name: 'Alex' } }],
    briefing_links: [{ briefing: { id: 'ugc', aktivierung_name: 'UGC Briefing' } }],
    skripte: []
  };

  it('das Standardprodukt der Linie zeigt seine eigenen Personas, Briefings und Skripte', async () => {
    installWindow();
    const { list } = await mountList(scope);

    const spalten = list.verknuepfungenFuerLinie({
      ...standard,
      skripte: [{ id: 's-std', titel: 'Eigenes Skript', briefing_id: 'ugc' }]
    });

    expect(spalten.personas.map(p => p.label)).toEqual(['Alex']);
    expect(spalten.briefings.map(b => b.label)).toEqual(['UGC Briefing']);
    expect(spalten.skripte.map(s => s.label)).toEqual(['Eigenes Skript']);
    list.destroy();
  });

  it('ein übernommenes Produkt bekommt Personas, Briefing und Skripte der Linie, nicht die der Herkunftslinie', async () => {
    installWindow();
    const { list } = await mountList(scope);

    const spalten = list.verknuepfungenFuerLinie({
      ...produkt,
      skripte: [...produkt.skripte, { id: 's-hier', titel: 'Hier erstellt', briefing_id: 'ugc' }]
    });

    expect(spalten.personas.map(p => p.label)).toEqual(['Linien-Persona']);
    expect(spalten.briefings.map(b => b.label)).toEqual(['UGC Briefing']);
    expect(spalten.skripte.map(s => s.label)).toEqual(['UGC Skript', 'Hier erstellt']);
    expect(spalten.skripte.map(s => s.label)).not.toContain('Nano Skript');
    list.destroy();
  });

  it('ein frisch übernommenes Produkt zeigt keine Skripte der anderen Linie', async () => {
    installWindow();
    const { list } = await mountList({ ...scope, briefingId: 'neu' });

    const spalten = list.verknuepfungenFuerLinie(produkt);

    expect(spalten.skripte).toEqual([]);
    expect(spalten.briefings).toEqual([]);
    list.destroy();
  });

  it('zeigt ohne Linie weiter alles, was am Produkt hängt', () => {
    const list = new ProduktList();
    const spalten = list.verknuepfungenFuerLinie(produkt);

    expect(spalten.briefings).toHaveLength(2);
    expect(spalten.skripte).toHaveLength(3);
    expect(spalten.personas).toHaveLength(2);
  });

  it('rendert „Von der Linie lösen“ im Menü der Zeile, nicht als Button', async () => {
    installWindow();
    const { list } = await mountList(scope);

    const html = list.renderSingleRow(produkt);

    expect(html).toContain('data-action="produkt-von-linie-loesen"');
    expect(html).not.toContain('<button type="button" class="mdc-btn mdc-btn--text');
    list.destroy();
  });

  it('versteckt die Action ohne Linien-Kontext', () => {
    window.currentUser = { rolle: 'admin' };
    const list = new ProduktList();
    expect(list.renderSingleRow(produkt)).not.toContain('produkt-von-linie-loesen');
  });

  it('löst nach Bestätigung nur die Verknüpfung der Linie, wenn das Menü-Event kommt', async () => {
    const geloescht = [];
    installWindow((eqs) => geloescht.push(eqs));
    window.confirmationModal = { open: vi.fn(async () => ({ confirmed: true })) };
    window.toastSystem = { show: vi.fn() };
    const { list, root } = await mountList(scope);
    list.reloadEmbedded = vi.fn(async () => {});
    root.querySelector('tbody').insertAdjacentHTML('beforeend', list.renderSingleRow(produkt));

    window.dispatchEvent(new CustomEvent('produkt-von-linie-loesen', { detail: { produktId: 'creme' } }));
    await vi.waitFor(() => expect(list.reloadEmbedded).toHaveBeenCalled());

    expect(window.confirmationModal.open).toHaveBeenCalled();
    expect(geloescht).toEqual([[['briefing_id', 'ugc'], ['produkt_id', 'creme']]]);
    list.destroy();
  });
});
