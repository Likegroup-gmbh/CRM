import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ListScope } from '../core/list/ListScope.js';

describe('ListScope', () => {
  let root;
  let scope;
  const saved = {};

  beforeEach(() => {
    saved.content = window.content;
    saved.setContentSafely = window.setContentSafely;
    window.content = null;
    window.setContentSafely = undefined;

    document.body.innerHTML = `
      <div id="dashboard-content"></div>
      <div id="root"><span id="in" class="x"></span></div>
      <span id="out" class="x"></span>
    `;
    root = null;
    scope = new ListScope(() => root);
  });

  afterEach(() => {
    window.content = saved.content;
    window.setContentSafely = saved.setContentSafely;
    document.body.innerHTML = '';
  });

  describe('ohne Mount-Root', () => {
    it('arbeitet auf dem gesamten Dokument', () => {
      expect(scope.byId('out')).toBe(document.getElementById('out'));
      expect(scope.query('.x')).toBe(document.getElementById('in'));
      expect(scope.queryAll('.x').length).toBe(2);
      expect(scope.eventRoot()).toBe(document);
    });

    it('byId ohne ID liefert null', () => {
      expect(scope.byId(null)).toBeNull();
      expect(scope.byId('')).toBeNull();
    });

    it('contentTarget bevorzugt window.content, sonst #dashboard-content', () => {
      expect(scope.contentTarget()).toBe(document.getElementById('dashboard-content'));
      const custom = document.createElement('div');
      window.content = custom;
      expect(scope.contentTarget()).toBe(custom);
    });
  });

  describe('mit Mount-Root', () => {
    beforeEach(() => {
      root = document.getElementById('root');
    });

    it('beschränkt Suche auf das Root', () => {
      expect(scope.byId('in')).not.toBeNull();
      expect(scope.byId('out')).toBeNull();
      expect(scope.queryAll('.x').length).toBe(1);
      expect(scope.query('.x').id).toBe('in');
      expect(scope.eventRoot()).toBe(root);
      expect(scope.contentTarget()).toBe(root);
    });

    it('liest das Root lazy (Root kann nach der Konstruktion wechseln)', () => {
      root = null;
      expect(scope.eventRoot()).toBe(document);
      root = document.getElementById('root');
      expect(scope.eventRoot()).toBe(root);
    });
  });

  describe('writeContent', () => {
    it('schreibt per innerHTML ohne setContentSafely', () => {
      scope.writeContent('<p id="w">x</p>');
      expect(document.querySelector('#dashboard-content #w')).not.toBeNull();
    });

    it('nutzt setContentSafely, wenn vorhanden und nicht gemountet', () => {
      window.setContentSafely = vi.fn();
      scope.writeContent('<p>x</p>');
      expect(window.setContentSafely).toHaveBeenCalledWith(document.getElementById('dashboard-content'), '<p>x</p>');
    });

    it('ignoriert setContentSafely mit Mount-Root', () => {
      window.setContentSafely = vi.fn();
      root = document.getElementById('root');
      scope.writeContent('<p id="w">x</p>');
      expect(window.setContentSafely).not.toHaveBeenCalled();
      expect(root.querySelector('#w')).not.toBeNull();
    });

    it('tut nichts ohne Ziel', () => {
      document.body.innerHTML = '';
      expect(() => scope.writeContent('<p>x</p>')).not.toThrow();
    });
  });
});
