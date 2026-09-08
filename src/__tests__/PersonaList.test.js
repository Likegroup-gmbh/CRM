import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PersonaList } from '../modules/persona/PersonaList.js';
import { NUR_UNTERNEHMEN_LABEL, OHNE_QUERY } from '../modules/persona/PersonaFolders.js';
import {
  renderCompaniesView,
  updateCompaniesGrid,
  renderBrandsView,
  updateBrandsGrid,
  renderItemsView
} from '../modules/persona/PersonaFolderRenderer.js';

function stubList(overrides = {}) {
  return {
    listViewMode: 'grid',
    companyFolders: [],
    brandFolders: [],
    sanitize: (v) => String(v ?? ''),
    ...overrides
  };
}

describe('PersonaList URLs', () => {
  let list;

  beforeEach(() => {
    window.isAdmin = () => true;
    window.isKunde = () => false;
    window.currentUser = { rolle: 'admin', permissions: { persona: { can_view: true, can_edit: true } } };
    list = new PersonaList();
  });

  it('startet im Grid auf Unternehmen', () => {
    expect(list.listViewMode).toBe('grid');
    expect(list.viewMode).toBe('companies');
    expect(list.listUrl()).toBe('/persona');
  });

  it('liest Unternehmen-Query als Marken-Ebene', () => {
    list.applyQueryParams(new URLSearchParams('unternehmen=u1&unternehmen_name=Acme'));
    expect(list.viewMode).toBe('brands');
    expect(list.currentUnternehmenId).toBe('u1');
    expect(list.listUrl()).toContain('unternehmen=u1');
  });

  it('liest marke=ohne als Items ohne Marke', () => {
    list.applyQueryParams(new URLSearchParams(
      `unternehmen=u1&unternehmen_name=Acme&marke=${OHNE_QUERY}&marke_name=${encodeURIComponent(NUR_UNTERNEHMEN_LABEL)}`
    ));
    expect(list.viewMode).toBe('items');
    expect(list._ohneMarke).toBe(true);
    expect(list.listUrl()).toContain('marke=ohne');
  });

  it('Liste setzt die URL auf /persona zurueck', () => {
    list.listViewMode = 'list';
    list.currentUnternehmenId = 'u1';
    list.syncListUrl = PersonaList.prototype.syncListUrl;
    window.history.replaceState = vi.fn();
    list.syncListUrl();
    expect(window.history.replaceState).toHaveBeenCalledWith(
      { route: '/persona' },
      '',
      '/persona'
    );
  });
});

describe('PersonaFolderRenderer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.isKunde;
    delete window.isAdmin;
    delete window.currentUser;
  });

  it('zeigt Grid-Toggle und Anlegen auf der Unternehmen-Ebene', () => {
    window.isAdmin = () => true;
    window.isKunde = () => false;
    window.currentUser = { permissions: { persona: { can_edit: true } } };
    const html = renderCompaniesView(stubList());
    expect(html).toContain('btn-view-list');
    expect(html).toContain('btn-view-grid');
    expect(html).toContain('companies-grid');
    expect(html).toContain('Persona anlegen');
  });

  it('rendert Unternehmens-Karten mit Zaehler', () => {
    document.body.innerHTML = '<div id="companies-grid"></div>';
    updateCompaniesGrid(stubList({
      companyFolders: [
        { id: 'u1', firmenname: 'Acme', logo_url: null, count: 2 }
      ]
    }));
    const card = document.querySelector('.folder-card');
    expect(card.dataset.unternehmenId).toBe('u1');
    expect(card.textContent).toContain('Acme');
    expect(card.textContent).toContain('2 Personas');
  });

  it('Marken-Grid hat Zurueck und virtuellen Nur-Unternehmen-Ordner', () => {
    window.isAdmin = () => true;
    window.isKunde = () => false;
    expect(renderBrandsView(stubList())).toContain('btn-back-to-companies');

    document.body.innerHTML = '<div id="brands-grid"></div>';
    updateBrandsGrid(stubList({
      brandFolders: [
        { id: null, markenname: NUR_UNTERNEHMEN_LABEL, logo_url: null, count: 1, virtual: true }
      ]
    }));
    const card = document.querySelector('.folder-card');
    expect(card.dataset.ohneMarke).toBe('1');
    expect(card.textContent).toContain(NUR_UNTERNEHMEN_LABEL);
    expect(card.textContent).toContain('1 Persona');
  });

  it('Items-View hat Persona-Spalten statt Produkt-Preis', () => {
    window.isAdmin = () => true;
    window.isKunde = () => false;
    const html = renderItemsView(stubList());
    expect(html).toContain('btn-back-to-brands');
    expect(html).toContain('Oberbegriff');
    expect(html).toContain('Geschlecht');
    expect(html).not.toContain('Preis');
    expect(html).not.toContain('Varianten');
  });
});
