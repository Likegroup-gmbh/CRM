import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderItemRow, renderItemsTable, refreshItemActions, updateItemRow } from '../modules/strategie/StrategieDetailRenderer.js';
import { STRATEGIE_FIXED_COLUMNS } from '../modules/strategie/strategieColumns.js';
import { FormRenderer } from '../core/form/FormRenderer.js';
import { kooperationConfig } from '../core/form/config/KooperationFormConfig.js';
import { DependentFields } from '../core/form/logic/DependentFields.js';
import {
  buildProduktionStartKontext,
  findKooperationForCreator,
  restoreKontextFelder,
  startProduktionFromItem
} from '../modules/kooperation/produktionStart.js';
import { openProduktionStartDrawer } from '../modules/kooperation/ProduktionStartDrawer.js';
import { setup as setupKooperationEvents } from '../core/form/logic/events/KooperationEvents.js';

function detailStub(overrides = {}) {
  return {
    isKunde: false,
    canEdit: true,
    hiddenColumns: [],
    customColumns: null,
    items: [],
    getTeilbereicheFromStrategie: () => ['A'],
    ...overrides
  };
}

function renderRow(item, detailOverrides = {}) {
  const html = renderItemRow(detailStub(detailOverrides), { id: 'i1', ...item }, 0);
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

function supabaseReturning(rows, error = null) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    limit: vi.fn(async () => ({ data: rows, error }))
  };
  return {
    from: vi.fn(() => chain),
    chain
  };
}

const STRATEGIE = {
  unternehmen_id: 'u1',
  marke_id: 'm1',
  kampagne_id: 'k1',
  briefing_id: 'b1',
  produktion_id: 'p1'
};

const ITEM = {
  id: 'i1',
  video_umgesetzt: true,
  produkt_id: 'pr1',
  casting_eintrag: {
    creator_id: 'c1',
    name: 'Ada'
  }
};

beforeEach(() => {
  window.isGastReadonly = () => false;
  window.ActionsDropdown = { getHeroIcon: () => '' };
});

describe('Umsetzen-Spalte', () => {
  it('heisst Umsetzen', () => {
    expect(STRATEGIE_FIXED_COLUMNS.find(col => col.key === 'umgesetzt').label).toBe('Umsetzen');
  });

  it('zeigt die Spalte in der Tabelle als Umsetzen', () => {
    const html = renderItemsTable(detailStub({
      items: [{ id: 'i1', teilbereich: 'A' }]
    }));
    expect(html).toContain('>Umsetzen<');
    expect(html).not.toContain('>Umgesetzt<');
  });
});

describe('Konzept-Aktionsmenü Produktion starten', () => {
  it('zeigt Produktion starten disabled, wenn Umsetzen aus ist', () => {
    const doc = renderRow({
      video_umgesetzt: false,
      produkt_id: 'pr1',
      casting_eintrag: { creator_id: 'c1' }
    });
    const action = doc.querySelector('[data-action="start-produktion"]');
    expect(action).not.toBeNull();
    expect(action.classList.contains('action-disabled')).toBe(true);
    expect(action.getAttribute('aria-disabled')).toBe('true');
    expect(action.getAttribute('title')).toBe('Zuerst Umsetzen aktivieren');
  });

  it('zeigt Produktion starten, wenn Umsetzen an ist und Creator und Produkt da sind', () => {
    const doc = renderRow({
      video_umgesetzt: true,
      produkt_id: 'pr1',
      casting_eintrag: { creator_id: 'c1' }
    });
    const action = doc.querySelector('[data-action="start-produktion"]');
    expect(action).not.toBeNull();
    expect(action.classList.contains('action-disabled')).toBe(false);
    expect(action.textContent).toContain('Produktion starten');
  });

  it('ist disabled ohne Creator', () => {
    const doc = renderRow({
      video_umgesetzt: true,
      produkt_id: 'pr1',
      casting_eintrag: { name: 'Offen' }
    });
    const action = doc.querySelector('[data-action="start-produktion"]');
    expect(action).not.toBeNull();
    expect(action.classList.contains('action-disabled')).toBe(true);
    expect(action.getAttribute('title')).toBe('Zuerst den Creator anlegen');
  });

  it('ist disabled ohne verbundenen Creator', () => {
    const doc = renderRow({
      video_umgesetzt: true,
      produkt_id: 'pr1'
    });
    const action = doc.querySelector('[data-action="start-produktion"]');
    expect(action.getAttribute('title')).toBe('Zuerst den Creator verbinden');
  });

  it('ist disabled ohne Produkt', () => {
    const doc = renderRow({
      video_umgesetzt: true,
      casting_eintrag: { creator_id: 'c1' }
    });
    const action = doc.querySelector('[data-action="start-produktion"]');
    expect(action.classList.contains('action-disabled')).toBe(true);
    expect(action.getAttribute('title')).toBe('Zuerst das Produkt verbinden');
  });

  it('koppelt fehlende Bedingungen im Tooltip', () => {
    const doc = renderRow({ video_umgesetzt: false });
    const action = doc.querySelector('[data-action="start-produktion"]');
    expect(action.getAttribute('title')).toBe(
      'Zuerst Umsetzen aktivieren · Zuerst den Creator verbinden · Zuerst das Produkt verbinden'
    );
  });

  it('zieht das Menü und ein offenes Portal nach, sobald das Produkt gesetzt ist', () => {
    const item = {
      id: 'i1',
      video_umgesetzt: true,
      casting_eintrag: { creator_id: 'c1' }
    };
    const detail = detailStub({ items: [item] });
    document.body.innerHTML = `<table class="strategie-items-table"><tbody>${renderItemRow(detail, item, 0)}</tbody></table>`;

    const toggle = document.querySelector('.actions-toggle');
    const portal = document.querySelector('.actions-dropdown').cloneNode(true);
    portal.className = 'actions-dropdown-portal';
    portal._sourceToggle = toggle;
    document.body.appendChild(portal);

    try {
      expect(document.querySelector('.actions-dropdown [data-action="start-produktion"]').classList.contains('action-disabled')).toBe(true);

      item.produkt_id = 'pr1';
      expect(refreshItemActions(detail, 'i1')).toBe(true);

      const source = document.querySelector('.actions-dropdown [data-action="start-produktion"]');
      const portaled = portal.querySelector('[data-action="start-produktion"]');
      expect(source.classList.contains('action-disabled')).toBe(false);
      expect(source.getAttribute('title')).toBe('Produktion starten');
      expect(portaled.classList.contains('action-disabled')).toBe(false);
      expect(portaled.getAttribute('title')).toBe('Produktion starten');
    } finally {
      document.body.innerHTML = '';
    }
  });

  it('lässt eine fokussierte Textarea stehen und aktualisiert das Menü trotzdem', () => {
    const item = {
      id: 'i1',
      video_umgesetzt: true,
      beschreibung: 'alt',
      casting_eintrag: { creator_id: 'c1' }
    };
    const detail = detailStub({
      items: [item],
      _bindTableEvents: () => {}
    });
    document.body.innerHTML = `<table class="strategie-items-table"><tbody>${renderItemRow(detail, item, 0)}</tbody></table>`;
    const area = document.querySelector('textarea[data-field="beschreibung"]');

    try {
      area.value = 'halb';
      area.focus();
      item.produkt_id = 'pr1';

      expect(updateItemRow(detail, 'i1')).toBe(false);
      expect(document.querySelector('textarea[data-field="beschreibung"]').value).toBe('halb');
      expect(document.querySelector('[data-action="start-produktion"]').classList.contains('action-disabled')).toBe(false);
    } finally {
      document.body.innerHTML = '';
    }
  });
});

describe('startProduktionFromItem', () => {
  it('öffnet den Drawer nicht, wenn der Creator in dieser Linie schon eine Kooperation hat', async () => {
    const client = supabaseReturning([{ id: 'koop-1' }]);
    const open = vi.fn();
    const toast = { show: vi.fn() };

    const result = await startProduktionFromItem(
      { strategie: STRATEGIE, items: [ITEM] },
      'i1',
      { client, open, toast }
    );

    expect(result.opened).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith(
      'Für diesen Creator gibt es in dieser Linie schon eine Kooperation',
      'warning'
    );
    expect(client.from).toHaveBeenCalledWith('kooperationen');
    expect(client.chain.eq).toHaveBeenCalledWith('produktion_id', 'p1');
    expect(client.chain.eq).toHaveBeenCalledWith('creator_id', 'c1');
  });

  it('öffnet den Drawer nicht ohne Produkt', async () => {
    const client = supabaseReturning([]);
    const open = vi.fn();
    const toast = { show: vi.fn() };

    const result = await startProduktionFromItem(
      { strategie: STRATEGIE, items: [{ ...ITEM, produkt_id: null }] },
      'i1',
      { client, open, toast }
    );

    expect(result.opened).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith('Zuerst das Produkt verbinden', 'warning');
    expect(client.from).not.toHaveBeenCalled();
  });

  it('öffnet den Drawer mit dem Kontext aus dem Konzept', async () => {
    const client = supabaseReturning([]);
    const open = vi.fn();

    const result = await startProduktionFromItem(
      { strategie: STRATEGIE, items: [ITEM] },
      'i1',
      { client, open, toast: { show: vi.fn() } }
    );

    expect(result.opened).toBe(true);
    expect(open).toHaveBeenCalledWith(buildProduktionStartKontext(STRATEGIE, ITEM));
  });
});

describe('findKooperationForCreator', () => {
  it('liefert null ohne Treffer', async () => {
    const client = supabaseReturning([]);
    await expect(findKooperationForCreator(client, { produktionId: 'p1', creatorId: 'c1' })).resolves.toBeNull();
  });
});

describe('Kooperation-Drawer ohne Zuordnung', () => {
  it('schreibt die IDs versteckt und zeigt keine Zuordnungs-Labels', () => {
    const renderer = new FormRenderer();
    renderer.getFormConfig = () => kooperationConfig;
    const kontext = buildProduktionStartKontext(STRATEGIE, ITEM);
    const html = renderer.renderFormOnly('kooperation', kontext);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const labels = [...doc.querySelectorAll('label')].map(label => label.textContent.replace(/\*/g, '').replace(/\s+/g, ' ').trim());
    for (const hidden of ['Unternehmen', 'Marke', 'Kampagne', 'Briefing', 'Creator', 'Name']) {
      expect(labels).not.toContain(hidden);
    }
    expect(html).not.toContain('Zuordnung');
    expect(labels.some(label => label.startsWith('Tags'))).toBe(false);
    expect(html).not.toContain('koop-tag-container');
    expect(labels.some(label => label.startsWith('Video Anzahl'))).toBe(true);
    expect(html).toContain('Content');
    expect(html).toContain('Preise');

    expect(doc.querySelector('input[name="unternehmen_id"]').value).toBe('u1');
    expect(doc.querySelector('input[name="marke_id"]').value).toBe('m1');
    expect(doc.querySelector('input[name="briefing_id"]').value).toBe('b1');
    expect(doc.querySelector('input[name="creator_id"]').value).toBe('c1');
    expect(doc.querySelector('input[name="produktion_id"]').value).toBe('p1');
    expect(doc.querySelector('input[name="name"]')).not.toBeNull();

    const kampagne = doc.querySelector('select[name="kampagne_id"]');
    expect(kampagne).not.toBeNull();
    expect(kampagne.hasAttribute('hidden')).toBe(true);
    expect(kampagne.value).toBe('k1');
  });
});

function supabaseChain(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  };
  return builder;
}

describe('Kampagne aus dem Konzept', () => {
  it('lässt die Kaskade die versteckte Kampagne stehen', async () => {
    vi.useFakeTimers();
    const df = new DependentFields(null);
    df.dynamicDataLoader = {};
    df.getFormConfig = () => kooperationConfig;
    window.supabase = {
      from(table) {
        if (table === 'kooperationen') return supabaseChain({ data: [], error: null });
        return supabaseChain({
          data: [{ id: 'andere', kampagnenname: 'Andere', unternehmen_id: 'u1', videoanzahl: 1 }],
          error: null
        });
      }
    };

    document.body.innerHTML = `
      <form data-entity="kooperation">
        <input type="hidden" name="unternehmen_id" value="u1">
        <select name="kampagne_id" hidden><option value="k1" selected>k1</option></select>
      </form>
    `;
    const form = document.querySelector('form');
    const updateSpy = vi.spyOn(df, 'updateDependentFieldOptions');

    try {
      df.setupFormDelegation(form);
      await vi.advanceTimersByTimeAsync(300);
      expect(form.querySelector('[name="kampagne_id"]').value).toBe('k1');
      expect(updateSpy).not.toHaveBeenCalled();
    } finally {
      df.cleanup(form);
      vi.useRealTimers();
      delete window.supabase;
      document.body.innerHTML = '';
    }
  });

  it('setzt eine geleerte Kampagne vor dem Submit wieder', () => {
    document.body.innerHTML = `
      <form>
        <select name="kampagne_id" disabled><option value="">Bitte wählen...</option></select>
        <input type="hidden" name="produktion_id" value="" disabled>
      </form>
    `;
    const form = document.querySelector('form');

    try {
      restoreKontextFelder(form, buildProduktionStartKontext(STRATEGIE, ITEM));
      const kampagne = form.querySelector('[name="kampagne_id"]');
      expect(kampagne.value).toBe('k1');
      expect(kampagne.disabled).toBe(false);
      expect(kampagne.options).toHaveLength(2);
      const produktion = form.querySelector('[name="produktion_id"]');
      expect(produktion.value).toBe('p1');
      expect(produktion.disabled).toBe(false);
    } finally {
      document.body.innerHTML = '';
    }
  });
});

describe('Produktion-starten-Drawer ohne Nachladen', () => {
  it('wird erst sichtbar, wenn das Formular gebunden ist', async () => {
    const frames = [];
    const previousFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => {
      frames.push(cb);
      return frames.length;
    };
    let release;
    const bind = new Promise((resolve) => { release = resolve; });
    window.formSystem = {
      renderFormOnly: () => `
        <form id="kooperation-form">
          <button type="button" class="mdc-btn mdc-btn--cancel">Abbrechen</button>
          <button type="submit" class="mdc-btn mdc-btn--create"><span class="mdc-btn__label">Erstellen</span></button>
        </form>
      `,
      bindFormEvents: () => bind
    };
    document.body.innerHTML = '';

    try {
      const opening = openProduktionStartDrawer({ creatorName: 'Ada' });
      await Promise.resolve();
      const panel = document.getElementById('produktion-start-drawer');
      expect(panel).not.toBeNull();
      expect(panel.classList.contains('show')).toBe(false);

      release();
      await opening;
      expect(panel.classList.contains('show')).toBe(false);
      expect(frames).toHaveLength(1);
      frames[0]();
      expect(panel.classList.contains('show')).toBe(true);
    } finally {
      window.requestAnimationFrame = previousFrame;
      delete window.formSystem;
      document.getElementById('produktion-start-drawer')?.remove();
      document.getElementById('produktion-start-drawer-overlay')?.remove();
    }
  });
});

describe('Kooperation-Videos vor Setup-Ende', () => {
  it('legt die Videozeile an, bevor setup zurückkommt', async () => {
    let releaseKampagne;
    const kampagneGate = new Promise((resolve) => { releaseKampagne = resolve; });
    const query = (result) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        neq: () => builder,
        in: () => builder,
        order: () => builder,
        single: () => Promise.resolve(result),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
      };
      return builder;
    };

    window.supabase = {
      from(table) {
        if (table === 'kampagne') {
          return {
            select: () => ({
              eq: () => ({ single: () => kampagneGate })
            })
          };
        }
        if (table === 'kampagne_art_typen') return query({ data: [{ name: 'UGC' }], error: null });
        return query({ data: [], error: null });
      }
    };

    document.body.innerHTML = `
      <form id="kooperation-form">
        <select name="kampagne_id"><option value="k1" selected>Kampagne</option></select>
        <input name="videoanzahl" value="">
        <div class="videos-container" data-options="[]"><div class="videos-list"></div></div>
      </form>
    `;
    const form = document.getElementById('kooperation-form');

    try {
      const pending = setupKooperationEvents(form, {});
      await Promise.resolve();
      expect(form.querySelector('.video-item')).toBeNull();

      releaseKampagne({
        data: {
          videoanzahl: 0,
          auftrag_id: null,
          ugc_paid_video_anzahl: 0,
          ugc_organic_video_anzahl: 0,
          influencer_video_anzahl: 0,
          story_video_anzahl: 0,
          vor_ort_video_anzahl: 0,
          ugc_video_anzahl: 0,
          igc_video_anzahl: 0
        },
        error: null
      });
      await pending;
      expect(form.querySelectorAll('.video-item')).toHaveLength(1);
      expect(form.querySelector('.video-kampagnenart-select').textContent).toContain('UGC');
    } finally {
      delete window.supabase;
      document.body.innerHTML = '';
    }
  });
});
