import { describe, it, expect } from 'vitest';
import { EntityRegistry, EntityModules } from '../core/data/entities/index.js';
import golden from './fixtures/entityRegistry.golden.json';

// Sicherheitsnetz fuer Refactorings an der Entity-Registry: jede Aenderung an
// Feldern, Relationen oder Sortierung muss hier bewusst im Golden-File landen.
describe('EntityRegistry Golden', () => {
  it('Registry entspricht dem Golden-File', () => {
    expect(JSON.parse(JSON.stringify(EntityRegistry))).toEqual(golden.registry);
  });

  it('EntityModules hat die erwarteten Keys', () => {
    expect(Object.keys(EntityModules).sort()).toEqual(golden.moduleKeys);
  });

  it('auftrag_details und auftragsdetails sind identisch', () => {
    expect(EntityRegistry.auftragsdetails).toBe(EntityRegistry.auftrag_details);
    expect(EntityModules.auftragsdetails).toBe(EntityModules.auftrag_details);
  });
});
