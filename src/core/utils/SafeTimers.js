export class SafeTimers {
  constructor() {
    this._timers = new Set();
    this._intervals = new Set();
  }

  setTimeout(fn, ms) {
    const id = setTimeout(() => {
      this._timers.delete(id);
      fn();
    }, ms);
    this._timers.add(id);
    return id;
  }

  setInterval(fn, ms) {
    const id = setInterval(fn, ms);
    this._intervals.add(id);
    return id;
  }

  clearTimeout(id) {
    clearTimeout(id);
    this._timers.delete(id);
  }

  clearInterval(id) {
    clearInterval(id);
    this._intervals.delete(id);
  }

  clearAll() {
    this._timers.forEach(id => clearTimeout(id));
    this._timers.clear();
    this._intervals.forEach(id => clearInterval(id));
    this._intervals.clear();
  }
}
