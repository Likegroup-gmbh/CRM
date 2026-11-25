import { formSystem } from '../core/FormSystem.js';
import { dataService } from '../core/DataService.js';

describe('FormSystem DataService', () => {
  it('hängt den DataService beim Erzeugen an, auch ohne window.dataService', () => {
    delete window.dataService;
    expect(formSystem.dataLoader.dataService).toBe(dataService);
    expect(typeof formSystem.dataLoader.dataService.loadEntities).toBe('function');
  });
});
