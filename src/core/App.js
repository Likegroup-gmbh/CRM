import { K } from './AppKeys.js';

const registry = new Map();

const App = {
  get(key) {
    if (registry.has(key)) return registry.get(key);
    if (typeof window !== 'undefined' && key in window) return window[key];
    return undefined;
  },

  set(key, value) {
    registry.set(key, value);
  },

  mock(overrides) {
    registry.clear();
    if (overrides) {
      for (const [k, v] of Object.entries(overrides)) {
        registry.set(k, v);
      }
    }
  },

  reset() {
    registry.clear();
  },

  has(key) {
    return registry.has(key) || (typeof window !== 'undefined' && key in window);
  },

  K
};

export default App;
