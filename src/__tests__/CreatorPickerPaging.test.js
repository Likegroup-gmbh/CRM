// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadDirectQueryOptions } from '../core/form/data/DirectQueryLoader.js';
import { loadFieldOptions } from '../core/form/data/FieldOptionsLoader.js';
import { loadSelectOptions } from '../core/filters/FilterDropdownSelectOptions.js';
import { renderFilterBar } from '../core/FilterUI.js';
import { EmpfaengerComposer } from '../core/anschreiben/EmpfaengerComposer.js';
import { DuplicateChecker } from '../core/validation/DuplicateChecker.js';
import { KooperationEditLoader } from '../modules/kooperation/KooperationEditLoader.js';
import { showAddCreatorDialog } from '../modules/management/ManagementDetailEdit.js';
import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';

const ZOE_ID = '8e94c941-b43b-460b-9538-22866844b1e2';

function creatorPages() {
  const page1 = [
    { id: 'schneider', vorname: 'Zoe', nachname: 'Schneider', mail: 'zoe@schneider.de', instagram: null, umsatzsteuerpflichtig: true },
    ...Array.from({ length: 999 }, (_, i) => ({
      id: `c-${i}`,
      vorname: 'Aaron',
      nachname: String(i),
      mail: null,
      instagram: null,
      umsatzsteuerpflichtig: true
    }))
  ];
  const page2 = [{
    id: ZOE_ID,
    vorname: 'Zoe',
    nachname: 'Bohnen',
    mail: 'zoe@bohnen.de',
    instagram: null,
    umsatzsteuerpflichtig: false
  }];
  return [page1, page2];
}

function pagingSupabase(pagesByTable) {
  return {
    from(table) {
      const pages = pagesByTable[table] || [[]];
      const total = pages.reduce((sum, page) => sum + page.length, 0);
      let fromIdx = 0;
      let ranged = false;
      const query = {
        select: () => query,
        order: () => query,
        eq: () => query,
        neq: () => query,
        not: () => query,
        in: () => query,
        or: () => query,
        limit: () => query,
        single: () => Promise.resolve({ data: (pages[0] || [])[0] || null, error: null }),
        range(from) {
          ranged = true;
          fromIdx = from;
          return query;
        },
        then(resolve, reject) {
          const pageIdx = Math.floor(fromIdx / 1000);
          const data = ranged ? (pages[pageIdx] || []) : (pages[0] || []);
          return Promise.resolve({ data, error: null, count: ranged ? total : null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
}

describe('Creator-Picker laden ueber die 1000-Zeilen-Grenze', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.supabase = pagingSupabase({ creator: creatorPages() });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.supabase;
  });

  it('nimmt Zoe im Formular-Select mit table creator auf', async () => {
    const form = document.createElement('form');
    const options = await loadDirectQueryOptions({
      name: 'creator_ids',
      table: 'creator',
      displayField: 'vorname,nachname',
      valueField: 'id'
    }, form);

    expect(options.some(option => option.value === ZOE_ID && option.label === 'Zoe Bohnen')).toBe(true);
  });

  it('nimmt Zoe im creator_id-Switch des Formulars auf', async () => {
    const form = document.createElement('form');
    const select = document.createElement('select');
    select.name = 'creator_id';
    form.appendChild(select);
    const seen = [];
    await loadFieldOptions.call({
      dataService: {},
      updateSelectOptions(_el, options) { seen.push(options); }
    }, 'kooperation', { name: 'creator_id', type: 'select' }, form);

    expect(seen[0].some(option => option.value === ZOE_ID && option.label === 'Zoe Bohnen')).toBe(true);
  });

  it('nimmt Zoe in den Filter-Pickern auf, auch unter Nachname', async () => {
    const ctx = { getCachedOptions: () => null, setCachedOptions: () => {} };
    const dropdown = await loadSelectOptions(ctx, 'kooperation', {
      id: 'creator_id',
      table: 'creator',
      displayField: 'vorname',
      valueField: 'id',
      dynamic: true
    });
    expect(dropdown.some(option => option.value === ZOE_ID && option.label === 'Zoe Bohnen')).toBe(true);

    const mount = document.createElement('div');
    document.body.appendChild(mount);
    await renderFilterBar(
      [{ id: 'creator_id', type: 'select', label: 'Creator', table: 'creator', displayField: 'vorname', valueField: 'id', dynamic: true }],
      {},
      () => {},
      () => {},
      mount
    );
    expect(mount.innerHTML).toContain('Zoe Bohnen');
  });

  it('nimmt Zoe im Anschreiben, in der Kooperation-Bearbeitung und im Vertrag auf', async () => {
    const composer = new EmpfaengerComposer({
      container: document.createElement('div'),
      db: window.supabase,
      unternehmenId: 'u1'
    });
    const recipients = await composer._loadCreatorOptions();
    expect(recipients.some(option => option.value === ZOE_ID && option.label === 'Zoe Bohnen')).toBe(true);

    const creators = await new KooperationEditLoader()._loadCreators();
    expect(creators.some(creator => creator.id === ZOE_ID)).toBe(true);

    const wizard = new VertraegeCreate();
    await wizard.loadStammdaten();
    expect(wizard.creators.some(creator => creator.id === ZOE_ID)).toBe(true);
  });

  it('bietet Zoe im Management-Dialog an', async () => {
    await showAddCreatorDialog({ creators: [], managementId: 'm1' });

    const select = document.getElementById('mgmt-add-creator-select');
    expect([...select.options].some(option => option.value === ZOE_ID && option.textContent.includes('Zoe Bohnen'))).toBe(true);
  });

  it('bezieht Zoe in die Duplikatpruefung ein', async () => {
    const creators = await new DuplicateChecker().loadAllCreators();
    expect(creators.some(creator => creator.id === ZOE_ID)).toBe(true);
  });
});
