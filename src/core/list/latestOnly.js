// latestOnly.js
// Race-Condition-Schutz für asynchrone Requests: nur das Ergebnis des zuletzt
// gestarteten Requests zählt, ältere werden verworfen. Rein, ohne DOM.
//
// const latest = createLatestOnly();
// const req = latest.start();
// const result = await req.resolve(fetchPage());
// if (result === STALE) return;   // inzwischen wurde ein neuerer Request gestartet

export const STALE = Symbol('latestOnly.stale');

export function createLatestOnly() {
  let counter = 0;

  function start() {
    const id = ++counter;

    const req = {
      /** true, solange kein neuerer Request gestartet wurde */
      isCurrent() {
        return id === counter;
      },

      /**
       * Wartet auf den Wert. Liefert STALE, wenn inzwischen ein neuerer Request
       * gestartet wurde. Fehler veralteter Requests werden verschluckt, Fehler des
       * aktuellen Requests werden weitergereicht.
       */
      async resolve(promiseOrValue) {
        let value;
        try {
          value = await promiseOrValue;
        } catch (error) {
          if (!req.isCurrent()) return STALE;
          throw error;
        }
        return req.isCurrent() ? value : STALE;
      }
    };

    return req;
  }

  return {
    start,

    /** Kurzform: startet einen Request und führt fn aus. */
    run(fn) {
      const req = start();
      return req.resolve(fn(req));
    }
  };
}
