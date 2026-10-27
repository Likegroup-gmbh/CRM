import { describe, expect, it } from 'vitest';
import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/prepareVertragPayload.js';
import '../modules/vertrag/create/VertragDraftLoad.js';

function wizard(formData, typ) {
  const inst = new VertraegeCreate();
  inst.selectedTyp = typ;
  inst.formData = { typ, ...formData };
  return inst;
}

describe('Vertrag bleibt an der Produktion', () => {
  it('schreibt die Produktion, wenn das Formular sie kennt', () => {
    const data = wizard({ produktion_id: 'prod-1', name: 'UGC Test' }, 'UGC').prepareDataForDB();
    expect(data.produktion_id).toBe('prod-1');
  });

  it('lässt die Produktion beim Speichern weg, wenn das Formular sie nicht geladen hat', () => {
    const data = wizard({ name: 'UGC Test' }, 'UGC').prepareDataForDB();
    expect(data).not.toHaveProperty('produktion_id');
  });

  it('schreibt eine leere Produktion nicht als null, damit das Update die Zuordnung behält', () => {
    for (const produktion_id of [null, '']) {
      const data = wizard({ produktion_id, name: 'UGC Test' }, 'UGC').prepareDataForDB();
      expect(data).not.toHaveProperty('produktion_id');
    }
  });

  it('hängt Contracting von der Produktion ab', () => {
    const data = wizard({ produktion_id: 'prod-1' }, 'Contracting').prepareDataForDB();
    expect(data.produktion_id).toBeNull();
  });

  it('nimmt die Produktion beim erneuten Öffnen wieder ins Formular', async () => {
    const inst = new VertraegeCreate();
    inst._parseProfileHandles = () => ({});
    inst.updateFilteredKampagnen = () => {};
    inst.updateFilteredCreators = async () => {};
    inst.creators = [];
    window.supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { id: 'v1', typ: 'UGC', name: 'UGC Test', produktion_id: 'prod-1' },
              error: null
            })
          })
        })
      })
    };

    await inst.loadDraftFromDB('v1');

    expect(inst.formData.produktion_id).toBe('prod-1');
    expect(inst.prepareDataForDB().produktion_id).toBe('prod-1');
  });
});
