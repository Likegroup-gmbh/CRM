import { describe, it, expect, vi, afterEach } from 'vitest';
import { ActionsDropdown } from '../core/ActionsDropdown.js';

// Regression: der globale .submenu-item-Handler aus bindGlobalEvents() rief frueher
// fuer JEDES .submenu-item stopImmediatePropagation() auf – egal ob es zum
// Actions-Dropdown gehoerte. Dadurch starben die document-delegierten Filter- und
// Sortier-Handler des Kampagne-Plus-Menüs (Status/Tags/Sortierung), waehrend
// Sourcing (Handler direkt am Dropdown-Element) weiterlief.

function clickOn(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('ActionsDropdown – .submenu-item Isolation', () => {
  let dd;

  afterEach(() => {
    dd?.destroy();
    dd = null;
    document.body.innerHTML = '';
  });

  it('laesst fremde .submenu-item-Klicks (Toolbar-Plus-Menü) zu spaeter registrierten document-Handlern durch', () => {
    document.body.innerHTML = `
      <div class="toolbar-menu">
        <div class="toolbar-menu-dropdown show">
          <div class="action-submenu" data-filter-submenu="status">
            <div class="submenu">
              <button type="button" class="submenu-item" data-filter-key="status" data-filter-value="Aktiv">Aktiv</button>
            </div>
          </div>
          <div class="action-submenu" data-sort-submenu>
            <div class="submenu">
              <button type="button" class="submenu-item" data-sort-value="name_asc">A-Z</button>
            </div>
          </div>
        </div>
      </div>`;

    dd = new ActionsDropdown();
    dd.bindGlobalEvents(); // Core-Handler zuerst, wie beim App-Boot

 // Seiten-Handler danach registriert und per closest() gefiltert, wie in
    // KampagneDetailEvents.setupEvents
    const filterSpy = vi.fn();
    const sortSpy = vi.fn();
    const filterHandler = (e) => {
      if (e.target.closest('.submenu-item[data-filter-key]')) filterSpy();
    };
    const sortHandler = (e) => {
      if (e.target.closest('.submenu-item[data-sort-value]')) sortSpy();
    };
    document.addEventListener('click', filterHandler);
    document.addEventListener('click', sortHandler);

    clickOn(document.querySelector('.submenu-item[data-filter-key]'));
    clickOn(document.querySelector('.submenu-item[data-sort-value]'));

    expect(filterSpy).toHaveBeenCalledTimes(1);
    expect(sortSpy).toHaveBeenCalledTimes(1);

    document.removeEventListener('click', filterHandler);
    document.removeEventListener('click', sortHandler);
  });

  it('faengt eigene set-field-Items weiterhin ab und blockt spaetere document-Handler', () => {
    document.body.innerHTML = `
      <div class="actions-dropdown-container" data-entity-type="kampagne">
        <div class="actions-dropdown">
          <div class="action-submenu">
            <div class="submenu">
              <a href="#" class="submenu-item" data-action="set-field" data-field="status_id" data-value="42" data-id="k1">Aktiv</a>
            </div>
          </div>
        </div>
      </div>`;

    dd = new ActionsDropdown();
    dd.setField = vi.fn().mockResolvedValue();
    dd.closeAllDropdowns = vi.fn();
    dd.bindGlobalEvents();

    const lateSpy = vi.fn();
    document.addEventListener('click', lateSpy);

    clickOn(document.querySelector('.submenu-item[data-action="set-field"]'));

    // setField wird synchron bis zum ersten await aufgerufen
    expect(dd.setField).toHaveBeenCalledWith('kampagne', 'k1', 'status_id', '42');
    expect(lateSpy).not.toHaveBeenCalled();

    document.removeEventListener('click', lateSpy);
  });

  it('blockt .action-item-Klicks ohne data-action (Teilen/Spalten im Plus-Menü) nicht', () => {
    document.body.innerHTML = `
      <div class="toolbar-menu">
        <div class="toolbar-menu-dropdown show">
          <button type="button" class="action-item" id="btn-share-kampagne">Teilen</button>
        </div>
      </div>`;

    dd = new ActionsDropdown();
    dd.bindGlobalEvents();

    const spy = vi.fn();
    document.addEventListener('click', spy);

    clickOn(document.getElementById('btn-share-kampagne'));

    expect(spy).toHaveBeenCalledTimes(1);

    document.removeEventListener('click', spy);
  });

  it('reicht toggle-skript-freigabe an spaetere Page-Handler durch statt zu claimen', () => {
    document.body.innerHTML = `
      <div class="actions-dropdown-container" data-entity-type="strategie">
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="toggle-skript-freigabe" data-id="i1">Für Skript freigeben</a>
        </div>
      </div>`;

    dd = new ActionsDropdown();
    dd.handleAction = vi.fn();
    dd.closeAllDropdowns = vi.fn();
    dd.bindGlobalEvents();

    const pageSpy = vi.fn();
    const pageHandler = (e) => {
      if (e.target.closest('.action-item')?.dataset.action === 'toggle-skript-freigabe') pageSpy();
    };
    document.addEventListener('click', pageHandler);

    clickOn(document.querySelector('.action-item[data-action="toggle-skript-freigabe"]'));

    expect(pageSpy).toHaveBeenCalledTimes(1);
    expect(dd.handleAction).not.toHaveBeenCalled();
    expect(dd.closeAllDropdowns).toHaveBeenCalled();

    document.removeEventListener('click', pageHandler);
  });

  it('reicht reprocess-item an spaetere Page-Handler durch', () => {
    document.body.innerHTML = `
      <div class="actions-dropdown-container" data-entity-type="strategie">
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="reprocess-item" data-id="i1">Neu verarbeiten</a>
        </div>
      </div>`;

    dd = new ActionsDropdown();
    dd.handleAction = vi.fn();
    dd.bindGlobalEvents();

    const pageSpy = vi.fn();
    const pageHandler = (e) => {
      if (e.target.closest('.action-item')?.dataset.action === 'reprocess-item') pageSpy();
    };
    document.addEventListener('click', pageHandler);

    clickOn(document.querySelector('.action-item[data-action="reprocess-item"]'));

    expect(pageSpy).toHaveBeenCalledTimes(1);
    expect(dd.handleAction).not.toHaveBeenCalled();

    document.removeEventListener('click', pageHandler);
  });

  it('reicht unbekannte Actions durch statt in handleAction zu landen', () => {
    document.body.innerHTML = `
      <div class="actions-dropdown-container" data-entity-type="strategie">
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="neue-page-action" data-id="i1">Neu</a>
        </div>
      </div>`;

    dd = new ActionsDropdown();
    dd.handleAction = vi.fn();
    dd.closeAllDropdowns = vi.fn();
    dd.bindGlobalEvents();

    const pageSpy = vi.fn();
    const pageHandler = (e) => {
      if (e.target.closest('.action-item')?.dataset.action === 'neue-page-action') pageSpy();
    };
    document.addEventListener('click', pageHandler);

    clickOn(document.querySelector('.action-item[data-action="neue-page-action"]'));

    expect(pageSpy).toHaveBeenCalledTimes(1);
    expect(dd.handleAction).not.toHaveBeenCalled();
    expect(dd.closeAllDropdowns).toHaveBeenCalled();

    document.removeEventListener('click', pageHandler);
  });

  it('claimt bekannte Global-Actions weiterhin ueber handleAction', () => {
    document.body.innerHTML = `
      <div class="actions-dropdown-container" data-entity-type="strategie">
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="s1">Ansehen</a>
        </div>
      </div>`;

    dd = new ActionsDropdown();
    dd.handleAction = vi.fn();
    dd.closeAllDropdowns = vi.fn();
    dd.bindGlobalEvents();

    const lateSpy = vi.fn();
    document.addEventListener('click', lateSpy);

    clickOn(document.querySelector('.action-item[data-action="view"]'));

    expect(dd.handleAction).toHaveBeenCalledWith('view', 's1', 'strategie', expect.anything());
    expect(lateSpy).not.toHaveBeenCalled();

    document.removeEventListener('click', lateSpy);
  });
});
