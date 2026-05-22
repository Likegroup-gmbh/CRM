import { describe, it, expect } from 'vitest';
import { DataPreparer } from '../core/data/DataPreparer.js';
import { EntityRegistry } from '../core/data/entities/index.js';

describe('kein_dropbox in EntityRegistry + DataPreparer', () => {
  const preparer = new DataPreparer();
  const fields = EntityRegistry.unternehmen.fields;

  it('EntityRegistry.unternehmen.fields enthält kein_dropbox als boolean', () => {
    const field = fields.find(f => f.name === 'kein_dropbox');
    expect(field).toBeDefined();
    expect(field.type).toBe('boolean');
  });

  it('prepareDataForSupabase setzt kein_dropbox: true korrekt', async () => {
    const result = await preparer.prepareDataForSupabase(
      { kein_dropbox: true },
      fields,
      'unternehmen'
    );
    expect(result.kein_dropbox).toBe(true);
  });

  it('prepareDataForSupabase setzt kein_dropbox: false korrekt', async () => {
    const result = await preparer.prepareDataForSupabase(
      { kein_dropbox: false },
      fields,
      'unternehmen'
    );
    expect(result.kein_dropbox).toBe(false);
  });

  it('prepareDataForSupabase konvertiert "on" zu true (Toggle checked)', async () => {
    const result = await preparer.prepareDataForSupabase(
      { kein_dropbox: 'on' },
      fields,
      'unternehmen'
    );
    expect(result.kein_dropbox).toBe(true);
  });

  it('prepareDataForSupabase konvertiert leeren/fehlenden Wert zu false', async () => {
    const result = await preparer.prepareDataForSupabase(
      { kein_dropbox: '' },
      fields,
      'unternehmen'
    );
    expect(result.kein_dropbox).toBe(false);
  });
});
