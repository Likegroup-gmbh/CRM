// splitEvenly.js
// Gleichmaessige Aufteilung mit Rest auf dem letzten Slot,
// damit Summe === Total (Geld in Cent, Counts ganzzahlig).

export function roundMoney(value) {
  return Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
}

export function splitMoneyEvenly(total, count) {
  const n = Math.max(1, parseInt(count, 10) || 1);
  const cents = Math.round((Number(total) || 0) * 100);
  const base = Math.trunc(cents / n);
  const remainder = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i === n - 1 ? remainder : 0)) / 100);
}

export function splitCountEvenly(total, count) {
  const n = Math.max(1, parseInt(count, 10) || 1);
  const t = Math.max(0, parseInt(total, 10) || 0);
  const base = Math.trunc(t / n);
  const remainder = t - base * n;
  return Array.from({ length: n }, (_, i) => base + (i === n - 1 ? remainder : 0));
}

export function sumBy(items, key) {
  return (items || []).reduce((sum, item) => sum + (Number(item?.[key]) || 0), 0);
}

export function allocateProportionalMoney(weights, total) {
  const n = (weights || []).length;
  if (n === 0) return [];
  const cents = Math.round((Number(total) || 0) * 100);
  const weightSum = weights.reduce((sum, w) => sum + (Number(w) || 0), 0);
  if (weightSum <= 0) return splitMoneyEvenly(total, n);

  let allocated = 0;
  return weights.map((weight, i) => {
    if (i === n - 1) return (cents - allocated) / 100;
    const share = Math.round(cents * (Number(weight) || 0) / weightSum);
    allocated += share;
    return share / 100;
  });
}
