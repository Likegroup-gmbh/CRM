// Regeln für das Produktionsbudget. Die Decke ist das Volumen der Kampagne.
// Leer heißt: die Produktion teilt sich das Volumen mit den anderen ohne Budget.

import { parseCurrencyInput } from '../../core/utils/parseCurrency.js';

export function roundMoney(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function budgetOrNull(value) {
  if (value === '' || value == null) return null;
  const n = typeof value === 'number' ? value : parseCurrencyInput(value);
  if (n == null || !Number.isFinite(n)) return null;
  return roundMoney(n);
}

export function sumBudgets(rows) {
  return roundMoney((rows || []).reduce((sum, row) => {
    const budget = budgetOrNull(row?.budget);
    return budget == null ? sum : sum + budget;
  }, 0));
}

export function hatGesetztesBudget(rows) {
  return (rows || []).some(row => budgetOrNull(row?.budget) != null);
}

/**
 * Topf der Kampagne für die Anzeige. Spiegelt _budgetTotal aus dem RPC
 * get_kampagnen_list: eigenes Kampagnen-Budget schlägt das des Auftrags.
 */
export function kampagneBudgetPot(kampagne) {
  return parseFloat(
    kampagne?.creator_budget ||
    kampagne?.volumen ||
    kampagne?.auftrag?.creator_budget ||
    kampagne?.auftrag?.gesamt_budget ||
    kampagne?.auftrag?.nettobetrag || 0
  ) || 0;
}

/**
 * Verbrauchs-Anzeige je Produktion. Eigenes Budget trägt nur den eigenen
 * Verbrauch; budget-lose Produktionen teilen sich den Topf und rechnen den
 * Verbrauch der anderen gegen (Summe statt Einzelwert).
 * used ist null, solange der Verbrauch noch nicht geladen ist.
 * Rückgabe: Array parallel zu produktionen mit { eigenesBudget, used, total }.
 */
export function verbrauchZeilen(produktionen, pot) {
  const rows = Array.isArray(produktionen) ? produktionen : [];
  const topf = roundMoney(pot);
  const budgetLos = rows.filter(row => budgetOrNull(row?.budget) == null);
  const geteiltPending = budgetLos.some(row => row?.budgetUsed == null);
  const geteilterVerbrauch = geteiltPending
    ? null
    : roundMoney(budgetLos.reduce((sum, row) => sum + (parseFloat(row?.budgetUsed) || 0), 0));

  return rows.map(row => {
    const eigenesBudget = budgetOrNull(row?.budget);
    if (eigenesBudget != null) {
      const used = row?.budgetUsed == null ? null : roundMoney(row.budgetUsed);
      return { eigenesBudget, used, total: eigenesBudget };
    }
    return { eigenesBudget: null, used: geteilterVerbrauch, total: topf };
  });
}

/**
 * Wie verbrauchZeilen, aber über Kampagnen-Grenzen hinweg: gruppiert nach
 * kampagne_id, jede Kampagne hat ihren eigenen Topf. Für die globale Liste.
 * Rückgabe: Map(produktion.id -> { eigenesBudget, used, total }).
 */
export function verbrauchZeilenProKampagne(produktionen) {
  const groups = new Map();
  for (const row of produktionen || []) {
    const key = row?.kampagne_id || row?.kampagne?.id || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const result = new Map();
  for (const rows of groups.values()) {
    const zeilen = verbrauchZeilen(rows, kampagneBudgetPot(rows[0]?.kampagne));
    rows.forEach((row, index) => {
      if (row?.id != null) result.set(row.id, zeilen[index]);
    });
  }
  return result;
}

/**
 * Sobald ein Budget gesetzt ist, braucht jede Zeile eins, größer als 0
 * und mindestens so hoch wie der schon gebuchte Verkaufspreis.
 * Die Summe bleibt im Volumen. Kein gesetztes Budget ist der alte Flow.
 */
export function validateProduktionsbudgets(rows, volumen) {
  const list = Array.isArray(rows) ? rows : [];
  const errors = [];
  if (!hatGesetztesBudget(list)) return { valid: true, errors };

  const decke = roundMoney(volumen);
  let summe = 0;

  for (const row of list) {
    const budget = budgetOrNull(row?.budget);
    const name = (row?.name || '').trim() || 'Produktion';
    if (budget == null) {
      errors.push(`Sobald ein Produktionsbudget gesetzt ist, braucht ${name} eins`);
      continue;
    }
    if (!(budget > 0)) {
      errors.push(`Produktionsbudget von ${name} muss größer als 0 sein`);
      continue;
    }
    const verbrauch = roundMoney(row?.verbrauch || 0);
    if (budget < verbrauch) {
      errors.push(`Produktionsbudget von ${name} liegt unter dem Verbrauch`);
    }
    summe += budget;
  }

  if (roundMoney(summe) > decke) {
    errors.push('Die Summe der Produktionsbudgets übersteigt das Volumen der Kampagne');
  }

  return { valid: errors.length === 0, errors };
}

export function validateAllProduktionsbudgets(produktionen, kampagnen) {
  const slots = Array.isArray(kampagnen) && kampagnen.length
    ? kampagnen
    : [{ kampagnen_nummer: 1, volumen: 0 }];
  const groups = new Map();

  slots.forEach((slot, index) => {
    const nummer = slot.kampagnen_nummer || index + 1;
    const key = slot.id || `n${nummer}`;
    groups.set(key, {
      volumen: budgetOrNull(slot.volumen) || 0,
      rows: []
    });
  });

  for (const row of produktionen || []) {
    const key = row.kampagne_id || `n${row.kampagnen_nummer || 1}`;
    if (!groups.has(key)) {
      groups.set(key, { volumen: 0, rows: [] });
    }
    groups.get(key).rows.push(row);
  }

  const errors = [];
  for (const group of groups.values()) {
    errors.push(...validateProduktionsbudgets(group.rows, group.volumen).errors);
  }
  return { valid: errors.length === 0, errors };
}

export function preisBleibtImBudget({ verbrauch, delta, decke }) {
  if (decke == null) return true;
  return roundMoney((verbrauch || 0) + (delta || 0)) <= roundMoney(decke);
}

export function budgetMeldung(eigen) {
  return eigen
    ? 'Verkaufspreis übersteigt das Produktionsbudget.'
    : 'Verkaufspreis übersteigt das Volumen der Kampagne.';
}

export async function ladeBudgetStand(supabase, produktionId) {
  if (!supabase || !produktionId) return null;
  const { data: produktion, error } = await supabase
    .from('produktion')
    .select('id, budget, kampagne_id')
    .eq('id', produktionId)
    .maybeSingle();
  if (error) throw error;
  if (!produktion) return null;

  const { data: verbrauchRow, error: verbrauchError } = await supabase
    .from('produktion_verbrauch')
    .select('budget_used')
    .eq('produktion_id', produktionId)
    .maybeSingle();
  if (verbrauchError) throw verbrauchError;
  const eigenVerbrauch = parseFloat(verbrauchRow?.budget_used) || 0;

  if (produktion.budget != null) {
    return { decke: parseFloat(produktion.budget), verbrauch: eigenVerbrauch, eigen: true };
  }

  const { data: andere, error: andereError } = await supabase
    .from('produktion')
    .select('id')
    .eq('kampagne_id', produktion.kampagne_id)
    .not('budget', 'is', null)
    .limit(1);
  if (andereError) throw andereError;
  if ((andere || []).length) {
    return { decke: 0, verbrauch: eigenVerbrauch, eigen: true };
  }

  const { data: kampagne, error: kampagneError } = await supabase
    .from('kampagne')
    .select('volumen')
    .eq('id', produktion.kampagne_id)
    .maybeSingle();
  if (kampagneError) throw kampagneError;
  if (kampagne?.volumen == null) return { decke: null, verbrauch: eigenVerbrauch, eigen: false };

  const { data: geschwister, error: geschwisterError } = await supabase
    .from('produktion')
    .select('id')
    .eq('kampagne_id', produktion.kampagne_id);
  if (geschwisterError) throw geschwisterError;
  const ids = (geschwister || []).map(row => row.id);
  if (!ids.length) {
    return { decke: parseFloat(kampagne.volumen) || 0, verbrauch: 0, eigen: false };
  }
  const { data: sums, error: sumsError } = await supabase
    .from('produktion_verbrauch')
    .select('budget_used')
    .in('produktion_id', ids);
  if (sumsError) throw sumsError;
  const verbrauch = (sums || []).reduce((sum, row) => sum + (parseFloat(row.budget_used) || 0), 0);
  return { decke: parseFloat(kampagne.volumen) || 0, verbrauch, eigen: false };
}

export async function assertVerkaufspreisDelta(supabase, produktionId, delta) {
  if (!produktionId || !delta || delta <= 0) return;
  const stand = await ladeBudgetStand(supabase, produktionId);
  if (!stand?.decke && stand?.decke !== 0) return;
  if (!preisBleibtImBudget({ verbrauch: stand.verbrauch, delta, decke: stand.decke })) {
    throw new Error(budgetMeldung(stand.eigen));
  }
}
