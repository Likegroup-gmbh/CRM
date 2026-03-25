import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import App from '../core/App.js';
import { K } from '../core/AppKeys.js';

describe('App Service Locator', () => {
  beforeEach(() => {
    App.reset();
  });

  afterEach(() => {
    App.reset();
    delete window.__testValue;
  });

  describe('get / set', () => {
    it('gibt gesetzten Wert zurück', () => {
      const mock = { from: vi.fn() };
      App.set('supabase', mock);
      expect(App.get('supabase')).toBe(mock);
    });

    it('gibt undefined für unbekannten Key ohne window-Fallback', () => {
      expect(App.get('gibtsNicht')).toBeUndefined();
    });

    it('fällt auf window.* zurück wenn Key nicht in Registry', () => {
      window.__testValue = 42;
      expect(App.get('__testValue')).toBe(42);
    });

    it('Registry hat Vorrang vor window.*', () => {
      window.__testValue = 'window';
      App.set('__testValue', 'registry');
      expect(App.get('__testValue')).toBe('registry');
    });
  });

  describe('mock', () => {
    it('setzt alle übergebenen Werte und löscht vorherige', () => {
      App.set('a', 1);
      App.set('b', 2);

      App.mock({ c: 3, d: 4 });

      expect(App.get('a')).toBeUndefined();
      expect(App.get('b')).toBeUndefined();
      expect(App.get('c')).toBe(3);
      expect(App.get('d')).toBe(4);
    });

    it('leert Registry wenn ohne Argument aufgerufen', () => {
      App.set('x', 1);
      App.mock();
      expect(App.get('x')).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('leert die gesamte Registry', () => {
      App.set('a', 1);
      App.set('b', 2);
      App.reset();
      expect(App.get('a')).toBeUndefined();
      expect(App.get('b')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('gibt true für registrierten Key', () => {
      App.set('foo', 'bar');
      expect(App.has('foo')).toBe(true);
    });

    it('gibt true für window-Key', () => {
      window.__testValue = 1;
      expect(App.has('__testValue')).toBe(true);
    });

    it('gibt false für unbekannten Key', () => {
      expect(App.has('totalUnbekannt_xyz')).toBe(false);
    });
  });

  describe('AppKeys', () => {
    it('exportiert K mit den wichtigsten Keys', () => {
      expect(K.SUPABASE).toBe('supabase');
      expect(K.NAVIGATE_TO).toBe('navigateTo');
      expect(K.CURRENT_USER).toBe('currentUser');
      expect(K.BREADCRUMB_SYSTEM).toBe('breadcrumbSystem');
    });

    it('K ist gefroren', () => {
      expect(Object.isFrozen(K)).toBe(true);
    });

    it('App.K referenziert dieselben Keys', () => {
      expect(App.K).toBe(K);
    });
  });

  describe('Test-Isolation', () => {
    it('mock in einem Test beeinflusst nächsten nicht (durch reset in beforeEach)', () => {
      App.mock({ supabase: 'mockClient' });
      expect(App.get('supabase')).toBe('mockClient');
    });

    it('vorheriger mock ist weg', () => {
      expect(App.get('supabase')).toBeUndefined();
    });
  });
});
