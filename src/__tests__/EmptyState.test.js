import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderEmptyState,
  renderEmptyStateRow,
  resolveEmptyState,
  createEmptyState,
  insertEmptyState,
  bindEmptyStateActions,
  renderSectionHeader
} from '../core/components/EmptyState.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('renderEmptyState', () => {
  it('rendert Icon, Titel, Text und Actions', () => {
    const html = renderEmptyState({
      icon: 'film',
      title: 'Keine Videos',
      text: 'Lege ein Video an.',
      actions: [{ label: 'Anlegen', action: 'create', variant: 'primary' }]
    });
    expect(html).toContain('class="empty-state"');
    expect(html).toContain('empty-icon--svg');
    expect(html).toContain('<h3>Keine Videos</h3>');
    expect(html).toContain('<p>Lege ein Video an.</p>');
    expect(html).toContain('data-empty-action="create"');
    expect(html).toContain('primary-btn');
  });

  it('escaped HTML in Titel und Text', () => {
    const html = renderEmptyState({ title: '<b>x</b>', text: 'a & b' });
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).not.toContain('<b>x</b>');
  });

  it('nutzt das zentrale SVG-Sprite via <use>, sobald ein DOM existiert', () => {
    renderEmptyState({ icon: 'filter', title: 'x' });
    expect(document.getElementById('crm-icon-sprite')).toBeTruthy();
    const html = renderEmptyState({ icon: 'filter', title: 'x' });
    expect(html).toContain('<use href="#crm-icon-adjustments-horizontal">');
  });

  it('liefert bei identischem State denselben gecachten String', () => {
    const state = { icon: 'check', title: 'Alles erledigt' };
    expect(renderEmptyState(state)).toBe(renderEmptyState({ ...state }));
  });

  it('unterstuetzt size: small', () => {
    expect(renderEmptyState({ title: 'x', size: 'small' }))
      .toContain('class="empty-state empty-state-small"');
  });

  it('zeigt Fallback-Icons (Emoji) unveraendert', () => {
    expect(renderEmptyState({ icon: '🎬', title: 'x' })).toContain('🎬');
  });
});

describe('renderEmptyStateRow', () => {
  it('wrappt in tr/td mit colspan', () => {
    const html = renderEmptyStateRow({ title: 'Leer' }, 7);
    expect(html).toMatch(/^<tr><td colspan="7" class="empty-state-cell">/);
    expect(html).toContain('Leer');
  });

  it('faellt bei ungueltigem colspan auf 1 zurueck', () => {
    expect(renderEmptyStateRow({ title: 'x' }, 0)).toContain('colspan="1"');
  });
});

describe('resolveEmptyState', () => {
  it('rendert bei aktiven Filtern das filtered-Preset mit Reset-Button', () => {
    const html = resolveEmptyState({ hasActiveFilters: true }, 'alle');
    expect(html).toContain('Keine Treffer');
    expect(html).toContain('data-empty-action="reset-filters"');
  });

  it('laesst ein eigenes filtered-Preset zu', () => {
    const html = resolveEmptyState({
      hasActiveFilters: true,
      states: { filtered: { title: 'Nichts gefunden' } }
    }, 'alle');
    expect(html).toContain('Nichts gefunden');
    // Rest des Presets bleibt erhalten
    expect(html).toContain('reset-filters');
  });

  it('rendert ohne Filter den State unter dem Key', () => {
    const html = resolveEmptyState({
      hasActiveFilters: false,
      states: { offen: { title: 'Alles freigegeben' } }
    }, 'offen');
    expect(html).toContain('Alles freigegeben');
  });

  it('faellt bei unbekanntem Key auf einen generischen Default zurueck (kein Filter-Preset)', () => {
    const html = resolveEmptyState({ hasActiveFilters: false, states: {} }, 'gibts-nicht');
    expect(html).toContain('Keine Einträge vorhanden');
    expect(html).not.toContain('reset-filters');
  });
});

describe('createEmptyState', () => {
  it('liefert eigenstaendige DOM-Nodes (Clone)', () => {
    const state = { icon: 'inbox', title: 'Posteingang leer' };
    const a = createEmptyState(state);
    const b = createEmptyState(state);
    expect(a.classList.contains('empty-state')).toBe(true);
    expect(a.querySelector('h3').textContent).toBe('Posteingang leer');
    expect(a).not.toBe(b);
  });
});

describe('insertEmptyState', () => {
  it('ermittelt colspan bei TBODY automatisch aus dem thead', () => {
    document.body.innerHTML = `
      <table><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead><tbody></tbody></table>`;
    const tbody = document.querySelector('tbody');
    insertEmptyState(tbody, { title: 'Nichts da' });
    expect(tbody.innerHTML).toContain('colspan="3"');
    expect(tbody.innerHTML).toContain('Nichts da');
  });

  it('schreibt in beliebige Container ohne tr-Wrapper', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    insertEmptyState(div, { title: 'Leer' });
    expect(div.querySelector('.empty-state')).toBeTruthy();
    expect(div.querySelector('tr')).toBeFalsy();
  });
});

describe('bindEmptyStateActions', () => {
  it('delegiert Klicks auf data-empty-action an den passenden Handler', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const calls = [];
    bindEmptyStateActions(div, { reset: (e, btn) => calls.push(btn.dataset.emptyAction) });
    insertEmptyState(div, {
      title: 'Keine Treffer',
      actions: [{ label: 'Filter zurücksetzen', action: 'reset' }]
    });
    div.querySelector('[data-empty-action="reset"]').click();
    expect(calls).toEqual(['reset']);
  });

  it('ignoriert unbekannte Actions und Klicks ausserhalb', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    let called = 0;
    bindEmptyStateActions(div, { known: () => called++ });
    div.innerHTML = `<button data-empty-action="unknown">x</button>`;
    div.querySelector('button').click();
    document.body.click();
    expect(called).toBe(0);
  });

  it('unterstuetzt AbortSignal und manuelles unbind', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    let called = 0;
    const unbind = bindEmptyStateActions(div, { a: () => called++ });
    div.innerHTML = `<button data-empty-action="a">x</button>`;
    div.querySelector('button').click();
    unbind();
    div.querySelector('button').click();
    expect(called).toBe(1);
  });
});

describe('renderSectionHeader', () => {
  it('rendert Titel und optionale Aktionen', () => {
    const html = renderSectionHeader({ title: 'Videos', actionsHtml: '<button>Neu</button>' });
    expect(html).toContain('tab-section-header');
    expect(html).toContain('<h3>Videos</h3>');
    expect(html).toContain('<button>Neu</button>');
  });
});
