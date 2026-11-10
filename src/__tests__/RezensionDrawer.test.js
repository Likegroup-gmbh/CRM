import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openRezensionDrawer } from '../modules/creator/RezensionDrawer.js';
import { renderActionsInner } from '../modules/kampagne/videoTableKoopCells.js';

function fakeSupabase(existing = null) {
  const writes = [];
  const supabase = {
    from: (table) => {
      if (table === 'benutzer') {
        return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) })
        }),
        insert: (payload) => {
          writes.push({ op: 'insert', payload });
          return { select: () => ({ single: async () => ({ data: { id: 'neu' }, error: null }) }) };
        },
        update: (payload) => {
          writes.push({ op: 'update', payload });
          return {
            eq: (_col, id) => {
              writes[writes.length - 1].id = id;
              return { select: () => ({ single: async () => ({ data: { id }, error: null }) }) };
            }
          };
        }
      };
    }
  };
  return { supabase, writes };
}

const root = () => document.getElementById('koop-rezension');
const saveButton = () => document.querySelector('#rezension-drawer .drawer-footer [data-action="save-rezension"]');
const star = (axis, value) => root().querySelector(`[data-axis="${axis}"][data-value="${value}"]`);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  window.isInternal = () => true;
  window.canEdit = () => true;
  window.toastSystem = { show: vi.fn() };
});

afterEach(() => {
  document.body.innerHTML = '';
  delete window.isInternal;
  delete window.canEdit;
  delete window.toastSystem;
  delete window.supabase;
  delete window.permissionSystem;
});

describe('RezensionDrawer', () => {
  it('gibt Speichern erst frei, wenn beide Achsen Sterne haben, und legt dann an', async () => {
    const { supabase, writes } = fakeSupabase();
    window.supabase = supabase;
    await openRezensionDrawer('k1', 'c1');

    expect(saveButton().classList.contains('mdc-btn--create')).toBe(true);
    expect(document.querySelectorAll('#rezension-drawer [data-action="save-rezension"]')).toHaveLength(1);
    expect(document.querySelector('#rezension-drawer .drawer-footer .mdc-btn--cancel')).not.toBeNull();
    expect(saveButton().disabled).toBe(true);
    star('produktion', 4).click();
    expect(saveButton().disabled).toBe(true);
    star('kommunikation', 5).click();
    expect(saveButton().disabled).toBe(false);
    expect(root().querySelector('[data-rezension-wert]').textContent).toBe('4,5');

    root().querySelector('[name="kommentar"]').value = 'Pünktlich';
    saveButton().click();
    await flush();

    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe('insert');
    expect(writes[0].payload).toMatchObject({
      kooperation_id: 'k1',
      produktionsqualitaet: 4,
      kommunikation_verlaesslichkeit: 5,
      kommentar: 'Pünktlich'
    });
    expect(window.toastSystem.show).toHaveBeenCalledWith('Rezension gespeichert', 'success');
  });

  it('ändert eine vorhandene Rezension statt eine zweite anzulegen', async () => {
    const { supabase, writes } = fakeSupabase({
      id: 'r1', kooperation_id: 'k1', produktionsqualitaet: 3, kommunikation_verlaesslichkeit: 3, kommentar: null
    });
    window.supabase = supabase;
    await openRezensionDrawer('k1', 'c1');

    expect(saveButton().disabled).toBe(false);
    star('produktion', 5).click();
    saveButton().click();
    await flush();

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: 'update', id: 'r1' });
    expect(writes[0].payload.produktionsqualitaet).toBe(5);
  });
});

describe('Aktionsmenü der Kooperation', () => {
  const ctx = (koop) => ({ koop, t: { canDeleteKooperation: () => false, kampagneId: 'kamp1' } });

  beforeEach(() => {
    window.permissionSystem = { canEdit: () => true, canEditField: () => false };
  });

  it('bietet mit Bearbeitungsrecht das Verschieben in eine andere Linie an', () => {
    const html = renderActionsInner(ctx({ id: 'k1', creator_id: null }));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const item = doc.querySelector('[data-action="linie-verschieben"]');
    expect(item.textContent).toContain('In andere Linie verschieben');
    expect(item.dataset.id).toBe('k1');

    window.permissionSystem = { canEdit: () => false, canEditField: () => false };
    expect(renderActionsInner(ctx({ id: 'k1', creator_id: 'c1' }))).not.toContain('data-action="linie-verschieben"');
  });

  it('bietet intern mit Bearbeitungsrecht und Creator die Rezension an', () => {
    const html = renderActionsInner(ctx({ id: 'k1', creator_id: 'c1' }));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const item = doc.querySelector('[data-action="rezension"]');
    expect(item.textContent).toContain('Rezension abgeben');
    expect(item.dataset.id).toBe('k1');
    expect(item.dataset.creatorId).toBe('c1');
  });

  it('blendet die Rezension ohne Creator, für Externe und ohne Bearbeitungsrecht aus', () => {
    expect(renderActionsInner(ctx({ id: 'k1', creator_id: null }))).not.toContain('data-action="rezension"');

    window.isInternal = () => false;
    expect(renderActionsInner(ctx({ id: 'k1', creator_id: 'c1' }))).not.toContain('data-action="rezension"');

    window.isInternal = () => true;
    window.canEdit = () => false;
    expect(renderActionsInner(ctx({ id: 'k1', creator_id: 'c1' }))).not.toContain('data-action="rezension"');
  });
});
