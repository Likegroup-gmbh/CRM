// vorlauf.js
// Frische-Vertrag fuer Finanzzahlen: nie cachen, nur Wartezeit ueberlappen.
//   - In-Flight: wer waehrend eines laufenden Loads fragt, teilt ihn sich.
//   - Prefetch: der Boot startet den Load, waehrend noch Auth laeuft. Das
//     Ergebnis wird von genau einem Load uebernommen, hoechstens `maxAlterMs`
//     nach dem Start, danach ist es verbraucht.
// Gemeinsam genutzt vom Finanzbestand (Rohzeilen) und vom Dashboard-Ergebnis.

export function createVorlauf(ladeFn, { maxAlterMs }) {
  let inFlight = null;
  let prefetched = null; // { promise, startedAt }

  // Ein zweiter Prefetch waehrend eines laufenden Loads oder eines frischen
  // ersten ist ein No-op. Fehler werden verschluckt; der spaetere Load laedt
  // dann selbst.
  function prefetch(arg) {
    if (inFlight) return false;
    if (prefetched && Date.now() - prefetched.startedAt <= maxAlterMs) return false;
    prefetched = {
      startedAt: Date.now(),
      promise: ladeFn(arg).catch(() => null),
    };
    return true;
  }

  // Kein await vor dem Setzen von inFlight: parallele Caller sehen sofort den
  // laufenden Load. Ein frischer Prefetch wird genau einmal uebernommen (und
  // wird zum In-Flight); fehlgeschlagen oder abgelaufen laedt der Caller live.
  function load(arg) {
    if (inFlight) return inFlight;

    const entry = prefetched;
    prefetched = null;
    const vorlauf = entry && Date.now() - entry.startedAt <= maxAlterMs
      ? entry.promise
      : null;

    const lauf = (vorlauf ? vorlauf.then((ergebnis) => ergebnis || ladeFn(arg)) : ladeFn(arg))
      .finally(() => {
        if (inFlight === lauf) inFlight = null;
      });
    inFlight = lauf;
    return lauf;
  }

  function invalidate() {
    inFlight = null;
    prefetched = null;
  }

  return { prefetch, load, invalidate };
}
