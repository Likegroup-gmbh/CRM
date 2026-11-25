// Smoke-Test: Alle Unterklassen von BasePaginatedList lassen sich laden und
// instanziieren, ihre Aliase auf selectedItems bleiben gültig und die
// geerbte Auswahl-/Event-Infrastruktur ist vorhanden.

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { BasePaginatedList } from '../core/BasePaginatedList.js';
import { MarkeList } from '../modules/marke/MarkeList.js';
import { UnternehmenList } from '../modules/unternehmen/UnternehmenList.js';
import { AnsprechpartnerList } from '../modules/ansprechpartner/AnsprechpartnerList.js';
import { CreatorList } from '../modules/creator/CreatorListCore.js';
import { PersonaList } from '../modules/persona/PersonaList.js';
import { ProduktList } from '../modules/produkt/ProduktList.js';
import { ManagementList } from '../modules/management/ManagementList.js';

const CASES = [
  ['MarkeList', MarkeList, 'selectedMarken'],
  ['UnternehmenList', UnternehmenList, 'selectedUnternehmen'],
  ['AnsprechpartnerList', AnsprechpartnerList, 'selectedAnsprechpartner'],
  ['CreatorList', CreatorList, 'selectedCreator'],
  ['PersonaList', PersonaList, null],
  ['ProduktList', ProduktList, null],
  ['ManagementList', ManagementList, 'selectedManagement']
];

describe('BasePaginatedList Unterklassen', () => {
  let inst;

  beforeEach(() => {
    window.isAdmin = () => true;
    window.isKunde = () => false;
    window.currentUser = { rolle: 'admin' };
  });

  afterEach(() => {
    inst?.destroy();
    inst = null;
  });

  it.each(CASES)('%s erbt von BasePaginatedList', (name, Cls) => {
    inst = new Cls();
    expect(inst).toBeInstanceOf(BasePaginatedList);
    expect(inst.selectedItems).toBeInstanceOf(Set);
  });

  it.each(CASES.filter(c => c[2]))('%s: Alias %s zeigt auf dasselbe Set', (name, Cls, alias) => {
    inst = new Cls();
    expect(inst[alias]).toBe(inst.selectedItems);
    inst[alias].add('x');
    expect(inst.selectedItems.has('x')).toBe(true);
    inst.deselectAll();
    expect(inst[alias]).toBe(inst.selectedItems);
    expect(inst[alias].size).toBe(0);
  });

  it.each(CASES)('%s: Basis-Infrastruktur vorhanden', (name, Cls) => {
    inst = new Cls();
    for (const method of ['byId', 'query', 'queryAll', 'eventRoot', 'updateSelection', 'deselectAll', 'bindEvents', 'loadData', 'destroy']) {
      expect(typeof inst[method], method).toBe('function');
    }
  });

  it.each(CASES)('%s: destroy() ist wiederholbar', (name, Cls) => {
    inst = new Cls();
    expect(() => { inst.destroy(); inst.destroy(); }).not.toThrow();
  });

  it('CreatorList: _superLoadData ist die Basis-loadData, an die Instanz gebunden', () => {
    inst = new CreatorList();
    expect(typeof inst._superLoadData).toBe('function');
    expect(inst.loadData).not.toBe(BasePaginatedList.prototype.loadData);
  });

  it('CreatorList: destroy() reicht an die Basis durch', () => {
    inst = new CreatorList();
    inst.destroy();
    expect(inst._destroyed).toBe(true);
  });
});
