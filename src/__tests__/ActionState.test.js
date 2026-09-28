import { describe, it, expect, beforeEach } from 'vitest';
import { actionState } from '../core/actions/actionState.js';
import { ActionBuilder } from '../core/actions/ActionBuilder.js';

describe('actionState', () => {
  it('ist enabled bei leerer Liste', () => {
    expect(actionState([])).toEqual({ mode: 'enabled', title: '' });
    expect(actionState(null)).toEqual({ mode: 'enabled', title: '' });
  });

  it('ist enabled wenn alle Checks ok sind', () => {
    expect(actionState([{ ok: true, reason: 'egal' }])).toEqual({ mode: 'enabled', title: '' });
  });

  it('nennt eine Ursache', () => {
    expect(actionState([{ ok: false, reason: 'Zuerst das Produkt verbinden' }])).toEqual({
      mode: 'disabled',
      title: 'Zuerst das Produkt verbinden'
    });
  });

  it('koppelt mehrere Ursachen und lässt bestandene Checks weg', () => {
    expect(actionState([
      { ok: false, reason: 'Zuerst Umsetzen aktivieren' },
      { ok: true, reason: 'egal' },
      { ok: false, reason: 'Zuerst das Produkt verbinden' }
    ])).toEqual({
      mode: 'disabled',
      title: 'Zuerst Umsetzen aktivieren · Zuerst das Produkt verbinden'
    });
  });

  it('blendet bei onFail hidden aus', () => {
    expect(actionState(
      [{ ok: false, reason: 'weg' }],
      { onFail: 'hidden' }
    )).toEqual({ mode: 'hidden', title: '' });
  });
});

describe('ActionBuilder actionStates', () => {
  beforeEach(() => {
    window.currentUser = { rolle: 'admin' };
  });

  it('setzt Titel und action-disabled', () => {
    const html = new ActionBuilder().create('strategie', 's1', window.currentUser, {
      actionStates: {
        edit: { mode: 'disabled', title: 'Zuerst speichern' }
      }
    });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const edit = doc.querySelector('[data-action="edit"]');
    expect(edit.classList.contains('action-disabled')).toBe(true);
    expect(edit.getAttribute('aria-disabled')).toBe('true');
    expect(edit.getAttribute('title')).toBe('Zuerst speichern');
    expect(doc.querySelector('[data-action="view"]').classList.contains('action-disabled')).toBe(false);
  });

  it('rendert hidden nicht und räumt den Separator', () => {
    const html = new ActionBuilder().create('strategie', 's1', window.currentUser, {
      actionStates: {
        view: { mode: 'hidden' },
        edit: { mode: 'hidden' }
      }
    });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('[data-action="view"]')).toBeNull();
    expect(doc.querySelector('[data-action="edit"]')).toBeNull();
    expect(doc.querySelector('.action-separator')).toBeNull();
    expect(doc.querySelector('[data-action="delete"]')).not.toBeNull();
  });

  it('lässt disabledActions ohne Titel', () => {
    const html = new ActionBuilder().create('strategie', 's1', window.currentUser, {
      disabledActions: ['delete']
    });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const del = doc.querySelector('[data-action="delete"]');
    expect(del.classList.contains('action-disabled')).toBe(true);
    expect(del.getAttribute('aria-disabled')).toBe('true');
    expect(del.hasAttribute('title')).toBe(false);
  });
});
